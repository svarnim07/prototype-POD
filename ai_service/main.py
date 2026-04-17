import base64
import io
import logging
from datetime import datetime, timezone
from typing import Optional, Any, Dict, List

import cv2
import mediapipe as mp
import numpy as np
from PIL import Image
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("examshield-ai")

app = FastAPI(title="ExamShield AI Proctoring Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── MediaPipe Initialization ────────────────────────────────────────────────
MP_AVAILABLE = False
try:
    mp_face_detection = mp.solutions.face_detection
    mp_face_mesh = mp.solutions.face_mesh
    face_detector = mp_face_detection.FaceDetection(model_selection=0, min_detection_confidence=0.6)
    face_mesh = mp_face_mesh.FaceMesh(
        max_num_faces=4,
        refine_landmarks=True,
        min_detection_confidence=0.6,
        min_tracking_confidence=0.6,
    )
    MP_AVAILABLE = True
except AttributeError:
    logger.error("MediaPipe solutions module not found. AI Proctoring will run in mock mode.")
    face_detector = None
    face_mesh = None

# ─── Pydantic Models ─────────────────────────────────────────────────────────
class AnalyzeRequest(BaseModel):
    frame: Optional[str] = None          # base64-encoded JPEG
    audio_level: float = 0.0            # 0–100 RMS
    screen_activity: Dict[str, Any] = {}
    user_id: str = ""
    exam_id: str = ""

class ProctoringEvent(BaseModel):
    event_type: str
    confidence: float
    severity: str                        # LOW | MEDIUM | HIGH
    timestamp: str
    metadata: Dict[str, Any] = {}

class AnalyzeResponse(BaseModel):
    events: List[ProctoringEvent]
    frame_ok: bool


# ─── Helpers ─────────────────────────────────────────────────────────────────
def decode_frame(b64_string: str) -> Optional[np.ndarray]:
    try:
        if "," in b64_string:
            b64_string = b64_string.split(",", 1)[1]
        img_bytes = base64.b64decode(b64_string)
        img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
        return cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)
    except Exception as e:
        logger.warning(f"Frame decode failed: {e}")
        return None

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def classify_severity(confidence: float, base: str) -> str:
    if base == "HIGH":
        return "HIGH"
    if confidence > 0.85:
        return "HIGH" if base == "MEDIUM" else "MEDIUM"
    return base

def get_head_pose_angles(landmarks, w: int, h: int):
    """Estimate yaw/pitch from key facial landmarks."""
    try:
        nose = landmarks[1]
        left_eye = landmarks[33]
        right_eye = landmarks[263]
        mouth_left = landmarks[61]
        mouth_right = landmarks[291]

        dx = (right_eye.x - left_eye.x) * w
        dy = (right_eye.y - left_eye.y) * h
        yaw = np.degrees(np.arctan2(dy, dx))

        eye_y = ((left_eye.y + right_eye.y) / 2) * h
        mouth_y = ((mouth_left.y + mouth_right.y) / 2) * h
        nose_y = nose.y * h
        pitch = np.degrees(np.arctan2(nose_y - eye_y, mouth_y - eye_y))

        return float(yaw), float(pitch)
    except Exception:
        return 0.0, 0.0

def get_gaze_direction(landmarks, w: int, h: int):
    """Estimate gaze ratio from iris landmarks."""
    try:
        # Left iris center vs left eye corners
        left_iris = landmarks[468]
        left_corner_l = landmarks[33]
        left_corner_r = landmarks[133]

        eye_w = abs(left_corner_r.x - left_corner_l.x)
        if eye_w < 0.001:
            return 0.5
        gaze_ratio = (left_iris.x - left_corner_l.x) / eye_w
        return float(gaze_ratio)
    except Exception:
        return 0.5


# ─── Analysis Pipeline ───────────────────────────────────────────────────────
def analyze_frame(bgr_frame: np.ndarray) -> List[ProctoringEvent]:
    if not MP_AVAILABLE:
        return []
    
    events = []
    rgb = cv2.cvtColor(bgr_frame, cv2.COLOR_BGR2RGB)
    h, w = bgr_frame.shape[:2]

    # 1. Face detection
    det_results = face_detector.process(rgb)
    face_count = len(det_results.detections) if det_results.detections else 0

    if face_count == 0:
        events.append(ProctoringEvent(
            event_type="NO_FACE",
            confidence=0.95,
            severity="HIGH",
            timestamp=now_iso(),
            metadata={"face_count": 0},
        ))
        return events  # no point doing mesh if no face

    if face_count > 1:
        conf = min(0.95, 0.7 + face_count * 0.1)
        events.append(ProctoringEvent(
            event_type="MULTIPLE_FACES",
            confidence=conf,
            severity="HIGH",
            timestamp=now_iso(),
            metadata={"face_count": face_count},
        ))

    # 2. Face mesh for head pose + gaze
    mesh_results = face_mesh.process(rgb)
    if mesh_results.multi_face_landmarks:
        landmarks = mesh_results.multi_face_landmarks[0].landmark

        # Head pose
        yaw, pitch = get_head_pose_angles(landmarks, w, h)
        if abs(yaw) > 20 or abs(pitch) > 25:
            conf = min(0.95, (abs(yaw) + abs(pitch)) / 80)
            severity = "HIGH" if (abs(yaw) > 35 or abs(pitch) > 40) else "MEDIUM"
            events.append(ProctoringEvent(
                event_type="HEAD_POSE_ABNORMAL",
                confidence=conf,
                severity=severity,
                timestamp=now_iso(),
                metadata={"yaw": round(yaw, 2), "pitch": round(pitch, 2)},
            ))

        # Gaze / eye deviation
        gaze = get_gaze_direction(landmarks, w, h)
        if gaze < 0.25 or gaze > 0.75:
            deviation = abs(gaze - 0.5) * 2
            conf = min(0.9, deviation + 0.4)
            events.append(ProctoringEvent(
                event_type="EYE_DEVIATION",
                confidence=round(conf, 3),
                severity="MEDIUM" if conf < 0.75 else "HIGH",
                timestamp=now_iso(),
                metadata={"gaze_ratio": round(gaze, 3), "direction": "left" if gaze < 0.5 else "right"},
            ))

    return events

def analyze_audio(audio_level: float) -> List[ProctoringEvent]:
    events = []
    if audio_level > 60:
        conf = min(0.95, audio_level / 100)
        events.append(ProctoringEvent(
            event_type="AUDIO_SPIKE",
            confidence=round(conf, 3),
            severity="HIGH" if audio_level > 80 else "MEDIUM",
            timestamp=now_iso(),
            metadata={"level": round(audio_level, 2)},
        ))
    elif audio_level > 30:
        events.append(ProctoringEvent(
            event_type="AUDIO_SPIKE",
            confidence=round(audio_level / 100, 3),
            severity="LOW",
            timestamp=now_iso(),
            metadata={"level": round(audio_level, 2)},
        ))
    return events


# ─── Routes ──────────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {"status": "ok", "timestamp": now_iso(), "service": "ExamShield AI Proctoring"}

@app.post("/analyze", response_model=AnalyzeResponse)
def analyze(req: AnalyzeRequest):
    all_events: List[ProctoringEvent] = []
    frame_ok = False

    # Vision analysis
    if req.frame:
        frame = decode_frame(req.frame)
        if frame is not None:
            frame_ok = True
            vision_events = analyze_frame(frame)
            all_events.extend(vision_events)
        else:
            logger.warning(f"Could not decode frame for user {req.user_id}")

    # Audio analysis
    audio_events = analyze_audio(req.audio_level)
    all_events.extend(audio_events)

    logger.info(f"[{req.user_id}] exam={req.exam_id} events={len(all_events)} frame_ok={frame_ok}")
    return AnalyzeResponse(events=all_events, frame_ok=frame_ok)

@app.get("/")
def root():
    return {"message": "ExamShield AI Proctoring Service", "docs": "/docs"}

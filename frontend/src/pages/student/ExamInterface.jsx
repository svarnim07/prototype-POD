import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Clock, ChevronLeft, ChevronRight, Save, Send, AlertTriangle, Eye, Mic, Monitor, CheckCircle, Loader2, Shield } from 'lucide-react';
import api from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function useExamTimer(endTime, onExpire) {
  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    if (!endTime) return;
    const tick = () => {
      const diff = Math.max(0, new Date(endTime) - new Date());
      setRemaining(diff);
      if (diff === 0) onExpire?.();
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [endTime, onExpire]);
  const h = Math.floor(remaining / 3600000);
  const m = Math.floor((remaining % 3600000) / 60000);
  const s = Math.floor((remaining % 60000) / 1000);
  const pct = endTime ? (remaining / (new Date(endTime) - new Date(new Date(endTime) - remaining))) * 100 : 100;
  const isWarning = remaining < 5 * 60000;
  const isDanger = remaining < 60000;
  return { h, m, s, remaining, isWarning, isDanger };
}

export default function ExamInterface() {
  const { examId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [exam, setExam] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [current, setCurrent] = useState(0);
  const [submission, setSubmission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aiEvents, setAiEvents] = useState([]);
  const [riskLevel, setRiskLevel] = useState('LOW');
  const [riskScore, setRiskScore] = useState(0);
  const [consentGiven, setConsentGiven] = useState(false);
  const [camAllowed, setCamAllowed] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const socketRef = useRef(null);
  const streamRef = useRef(null);
  const autoSaveRef = useRef(null);
  const analyzeRef = useRef(null);
  const tabSwitchRef = useRef(0);

  const timer = useExamTimer(exam?.endTime, () => handleAutoSubmit());

  // Load exam data
  useEffect(() => {
    Promise.all([api.get(`/exams/${examId}`), api.get(`/questions?examId=${examId}`)])
      .then(([examRes, qRes]) => {
        setExam(examRes.data);
        setQuestions(qRes.data);
        return api.post('/submissions/start', { examId });
      })
      .then(r => setSubmission(r.data))
      .catch(err => {
        toast.error(err?.response?.data?.error || 'Failed to load exam');
        navigate('/student');
      })
      .finally(() => setLoading(false));
  }, [examId, navigate]);

  // WebSocket
  useEffect(() => {
    if (!consentGiven || !user) return;
    const socket = io(SOCKET_URL, { path: '/socket.io', transports: ['websocket'] });
    socketRef.current = socket;
    socket.emit('join_exam', { examId, userId: user.id, role: 'STUDENT' });
    return () => socket.disconnect();
  }, [consentGiven, examId, user]);

  // Camera
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240, facingMode: 'user' }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCamAllowed(true);
    } catch { toast.error('Camera access denied'); }
  }, []);

  // Auto-save every 15s
  useEffect(() => {
    if (!submission || !consentGiven) return;
    autoSaveRef.current = setInterval(async () => {
      const ansArr = Object.entries(answers).map(([questionId, answer]) => ({ questionId, answer }));
      if (ansArr.length === 0) return;
      setSaving(true);
      try {
        await api.post('/submissions/autosave', { examId, answers: ansArr });
      } catch {}
      finally { setSaving(false); }
    }, 15000);
    return () => clearInterval(autoSaveRef.current);
  }, [submission, consentGiven, answers, examId]);

  // Proctoring capture every 2s
  useEffect(() => {
    if (!consentGiven || !camAllowed) return;
    analyzeRef.current = setInterval(async () => {
      let frame = null;
      if (videoRef.current && canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        canvasRef.current.width = 320;
        canvasRef.current.height = 240;
        ctx.drawImage(videoRef.current, 0, 0, 320, 240);
        frame = canvasRef.current.toDataURL('image/jpeg', 0.6);
      }
      try {
        const res = await api.post('/proctoring/analyze', { examId, frame, audioLevel: 0, screenActivity: { tabSwitch: false } });
        if (res.data.events?.length > 0) {
          setAiEvents(prev => [...res.data.events.slice(0, 3), ...prev].slice(0, 8));
        }
        if (res.data.riskScore) {
          setRiskLevel(res.data.riskScore.level);
          setRiskScore(res.data.riskScore.score);
        }
      } catch {}
    }, 2000);
    return () => clearInterval(analyzeRef.current);
  }, [consentGiven, camAllowed, examId]);

  // Tab switch detection
  useEffect(() => {
    if (!consentGiven) return;
    const onBlur = () => {
      tabSwitchRef.current += 1;
      socketRef.current?.emit('screen_event', { examId, userId: user.id, eventType: 'TAB_SWITCH' });
      toast.error('⚠️ Tab switch detected!', { duration: 3000 });
    };
    window.addEventListener('blur', onBlur);
    return () => window.removeEventListener('blur', onBlur);
  }, [consentGiven, examId, user]);

  // Copy-paste block
  useEffect(() => {
    if (!consentGiven) return;
    const block = e => { e.preventDefault(); toast('Copy/paste is disabled during exam', { icon: '🚫' }); };
    document.addEventListener('copy', block);
    document.addEventListener('paste', block);
    document.addEventListener('cut', block);
    return () => { document.removeEventListener('copy', block); document.removeEventListener('paste', block); document.removeEventListener('cut', block); };
  }, [consentGiven]);

  const handleAnswer = (questionId, value) => setAnswers(a => ({ ...a, [questionId]: value }));

  const handleSubmit = async () => {
    if (!confirm('Submit your exam? This cannot be undone.')) return;
    setSubmitting(true);
    const ansArr = Object.entries(answers).map(([questionId, answer]) => ({ questionId, answer }));
    try {
      await api.post('/submissions/submit', { examId, answers: ansArr });
      toast.success('Exam submitted successfully!');
      streamRef.current?.getTracks().forEach(t => t.stop());
      navigate('/student');
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Submission failed');
    } finally { setSubmitting(false); }
  };

  const handleAutoSubmit = async () => {
    const ansArr = Object.entries(answers).map(([questionId, answer]) => ({ questionId, answer }));
    try { await api.post('/submissions/submit', { examId, answers: ansArr }); } catch {}
    toast('⏰ Time up! Exam auto-submitted.');
    streamRef.current?.getTracks().forEach(t => t.stop());
    navigate('/student');
  };

  const riskColors = { LOW: '#10b981', MEDIUM: '#f59e0b', HIGH: '#ef4444' };
  const riskColor = riskColors[riskLevel] || '#10b981';

  // Consent screen
  if (!consentGiven && !loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, position: 'relative' }}>
        <div className="gradient-mesh" />
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass"
          style={{ maxWidth: 520, width: '100%', padding: 40, textAlign: 'center', position: 'relative', zIndex: 1 }}>
          <Shield size={48} color="var(--accent)" style={{ marginBottom: 20 }} />
          <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 12 }}>AI Proctoring Consent</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.7, marginBottom: 28 }}>
            This exam uses AI-based proctoring. By proceeding, you consent to:<br />
            • <strong>Webcam capture</strong> at 1-2 frames per second<br />
            • <strong>Audio level</strong> monitoring (no raw audio stored)<br />
            • <strong>Tab/window</strong> activity tracking<br /><br />
            AI flags are reviewed by faculty — no automatic penalty.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button className="btn-ghost" onClick={() => navigate('/student')}>Decline & Exit</button>
            <button className="btn-primary" onClick={async () => { setConsentGiven(true); await startCamera(); }}>
              <CheckCircle size={16} /> I Agree — Start Exam
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Loader2 size={40} className="spin" color="var(--accent)" />
    </div>
  );

  const q = questions[current];
  const answeredCount = Object.keys(answers).length;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50 }}>
        <div>
          <h1 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{exam?.title}</h1>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Q {current + 1} of {questions.length} • {answeredCount} answered</div>
        </div>

        {/* Timer */}
        <div style={{ textAlign: 'center' }}>
          <div className={`exam-timer ${timer.isDanger ? 'danger' : timer.isWarning ? 'warning' : ''}`}>
            {String(timer.h).padStart(2,'0')}:{String(timer.m).padStart(2,'0')}:{String(timer.s).padStart(2,'0')}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Time Remaining</div>
        </div>

        {/* Risk + status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div className="risk-indicator">
            <div className={`risk-dot ${riskLevel.toLowerCase()}`} />
            <span style={{ color: riskColor, fontSize: 12 }}>Risk: {riskLevel}</span>
          </div>
          {saving && <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}><Loader2 size={12} className="spin" /> Saving...</div>}
          <button className="btn-primary" onClick={handleSubmit} disabled={submitting} style={{ padding: '8px 16px', fontSize: 13 }}>
            {submitting ? <Loader2 size={14} className="spin" /> : <><Send size={14} />Submit</>}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Question panel */}
        <div style={{ flex: 1, padding: '28px 32px', overflowY: 'auto' }}>
          {q && (
            <motion.div key={q.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <span className="badge badge-info">{q.type}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{q.marks} mark{q.marks > 1 ? 's' : ''}</span>
              </div>
              <p style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.7, marginBottom: 28 }}>{q.content}</p>

              {/* MCQ */}
              {q.type === 'MCQ' && (() => {
                let opts = [];
                try { opts = typeof q.options === 'string' ? JSON.parse(q.options) : q.options || []; } catch {}
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {opts.map((opt, i) => (
                      <button key={i} onClick={() => handleAnswer(q.id, opt)}
                        style={{ padding: '14px 18px', borderRadius: 12, border: `2px solid ${answers[q.id] === opt ? 'var(--accent)' : 'var(--border)'}`, background: answers[q.id] === opt ? 'var(--accent-glow)' : 'var(--bg-card)', color: 'var(--text-primary)', textAlign: 'left', cursor: 'pointer', fontSize: 15, transition: 'all 0.15s', fontFamily: 'Inter, sans-serif' }}>
                        <span style={{ color: 'var(--text-muted)', marginRight: 10, fontSize: 13 }}>{String.fromCharCode(65 + i)}.</span>
                        {opt}
                      </button>
                    ))}
                  </div>
                );
              })()}

              {/* Subjective */}
              {q.type === 'SUBJECTIVE' && (
                <textarea value={answers[q.id] || ''} onChange={e => handleAnswer(q.id, e.target.value)}
                  placeholder="Write your answer here..."
                  style={{ width: '100%', minHeight: 200, padding: '14px 16px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text-primary)', fontSize: 14, fontFamily: 'Inter, sans-serif', resize: 'vertical', outline: 'none', lineHeight: 1.7 }}
                  onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                  onBlur={e => e.target.style.borderColor = 'var(--border)'}
                />
              )}

              {/* Coding */}
              {q.type === 'CODING' && (
                <textarea value={answers[q.id] || ''} onChange={e => handleAnswer(q.id, e.target.value)}
                  placeholder="// Write your code here..."
                  style={{ width: '100%', minHeight: 260, padding: '14px 16px', background: '#0d1117', border: '1px solid var(--border)', borderRadius: 12, color: '#e6edf3', fontSize: 13, fontFamily: 'JetBrains Mono, monospace', resize: 'vertical', outline: 'none', lineHeight: 1.8 }}
                />
              )}

              {/* Navigation */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 32 }}>
                <button className="btn-ghost" onClick={() => setCurrent(c => Math.max(0, c - 1))} disabled={current === 0}>
                  <ChevronLeft size={16} /> Previous
                </button>
                <button className="btn-primary" onClick={() => setCurrent(c => Math.min(questions.length - 1, c + 1))} disabled={current === questions.length - 1}>
                  Next <ChevronRight size={16} />
                </button>
              </div>
            </motion.div>
          )}
        </div>

        {/* Right panel */}
        <div style={{ width: 280, background: 'var(--bg-secondary)', borderLeft: '1px solid var(--border)', padding: 20, display: 'flex', flexDirection: 'column', gap: 20, overflowY: 'auto' }}>
          {/* Webcam */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}><Eye size={13} /> Webcam Feed</div>
            <div className="webcam-frame">
              <video ref={videoRef} autoPlay muted playsInline />
              <canvas ref={canvasRef} style={{ display: 'none' }} />
              {!camAllowed && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 12 }}>Camera starting...</div>}
            </div>
          </div>

          {/* AI Events */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}><Shield size={13} /> AI Transparency</div>
            {aiEvents.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '12px', background: 'var(--bg-card)', borderRadius: 10, textAlign: 'center' }}>
                ✅ No issues detected
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {aiEvents.map((ev, i) => (
                  <div key={i} className="ai-event-pill">
                    <AlertTriangle size={12} color={ev.severity === 'HIGH' ? '#ef4444' : ev.severity === 'MEDIUM' ? '#f59e0b' : '#10b981'} />
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)', flex: 1 }}>{ev.event_type?.replace(/_/g, ' ')}</span>
                    <span className={`badge badge-${ev.severity?.toLowerCase()}`} style={{ fontSize: 10, padding: '1px 6px' }}>{ev.severity}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Question grid */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Question Navigator</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 5 }}>
              {questions.map((q, i) => (
                <button key={q.id} onClick={() => setCurrent(i)}
                  style={{ width: '100%', aspectRatio: '1', borderRadius: 8, border: `2px solid ${current === i ? 'var(--accent)' : answers[q.id] ? '#10b981' : 'var(--border)'}`, background: current === i ? 'var(--accent-glow)' : answers[q.id] ? 'rgba(16,185,129,0.1)' : 'var(--bg-card)', color: current === i ? 'var(--accent)' : answers[q.id] ? '#10b981' : 'var(--text-muted)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  {i + 1}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 10, fontSize: 11, color: 'var(--text-muted)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: '#10b981', display: 'inline-block' }} />Answered</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--border)', display: 'inline-block' }} />Unanswered</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

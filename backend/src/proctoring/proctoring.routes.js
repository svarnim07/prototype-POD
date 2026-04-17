const express = require('express');
const { authenticate, authorize } = require('../common/jwt');
const axios = require('axios');
const { updateRiskScore } = require('../realtime/socket');
const { getIO } = require('../realtime/socket');
const router = express.Router();

// POST /proctoring/analyze - receives base64 frame from frontend, forwards to AI service
router.post('/analyze', authenticate, authorize('STUDENT'), async (req, res) => {
  const { examId, frame, audioLevel, screenActivity } = req.body;
  if (!examId) return res.status(400).json({ error: 'examId required' });

  try {
    const aiPayload = {
      frame: frame || null,
      audio_level: audioLevel || 0,
      screen_activity: screenActivity || {},
      user_id: req.user.id,
      exam_id: examId,
    };

    let aiEvents = [];
    try {
      const aiRes = await axios.post(`${process.env.AI_SERVICE_URL}/analyze`, aiPayload, { timeout: 5000 });
      aiEvents = aiRes.data.events || [];
    } catch (aiErr) {
      // AI service unavailable — degrade gracefully
      console.warn('AI service unavailable:', aiErr.message);
    }

    // Persist events
    const saved = [];
    for (const ev of aiEvents) {
      const created = await req.prisma.proctoringEvent.create({
        data: {
          userId: req.user.id,
          examId,
          eventType: ev.event_type,
          confidence: parseFloat(ev.confidence),
          severity: ev.severity,
          metadata: ev.metadata ? JSON.stringify(ev.metadata) : null,
        },
      });
      saved.push(created);
    }

    // Screen activity events
    if (screenActivity?.tabSwitch) {
      const ev = await req.prisma.proctoringEvent.create({
        data: { userId: req.user.id, examId, eventType: 'TAB_SWITCH', confidence: 1.0, severity: 'MEDIUM' },
      });
      saved.push(ev);
    }

    if (saved.length > 0) {
      const risk = await updateRiskScore(req.prisma, req.user.id, examId);
      const io = getIO();
      if (io) {
        io.to(`monitor_${examId}`).emit('risk_update', {
          userId: req.user.id,
          examId,
          events: saved,
          riskScore: risk,
        });
      }
    }

    const risk = await req.prisma.riskScore.findUnique({
      where: { userId_examId: { userId: req.user.id, examId } },
    });

    res.json({ events: saved, riskScore: risk });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Analysis failed' });
  }
});

// GET /proctoring/events/:examId (faculty/admin)
router.get('/events/:examId', authenticate, authorize('FACULTY', 'ADMIN'), async (req, res) => {
  const { userId } = req.query;
  try {
    const events = await req.prisma.proctoringEvent.findMany({
      where: {
        examId: req.params.examId,
        ...(userId && { userId }),
      },
      orderBy: { timestamp: 'desc' },
      take: 200,
    });
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// GET /proctoring/my-events/:examId (student sees their own)
router.get('/my-events/:examId', authenticate, authorize('STUDENT'), async (req, res) => {
  try {
    const events = await req.prisma.proctoringEvent.findMany({
      where: { userId: req.user.id, examId: req.params.examId },
      orderBy: { timestamp: 'desc' },
      take: 50,
    });
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

module.exports = router;

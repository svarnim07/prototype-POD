const express = require('express');
const { authenticate, authorize } = require('../common/jwt');
const router = express.Router();

// GET /risk/:examId/:userId
router.get('/:examId/:userId', authenticate, async (req, res) => {
  try {
    const risk = await req.prisma.riskScore.findUnique({
      where: { userId_examId: { userId: req.params.userId, examId: req.params.examId } },
    });
    res.json(risk || { score: 0, level: 'LOW' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch risk score' });
  }
});

// GET /risk/:examId (all students in exam — faculty)
router.get('/:examId', authenticate, authorize('FACULTY', 'ADMIN'), async (req, res) => {
  try {
    const scores = await req.prisma.riskScore.findMany({
      where: { examId: req.params.examId },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    res.json(scores);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch risk scores' });
  }
});

module.exports = router;

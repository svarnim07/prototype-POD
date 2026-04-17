const express = require('express');
const { authenticate, authorize } = require('../common/jwt');
const router = express.Router();

// POST /submissions/start
router.post('/start', authenticate, authorize('STUDENT'), async (req, res) => {
  const { examId } = req.body;
  if (!examId) return res.status(400).json({ error: 'examId required' });
  try {
    // Check assignment
    const assignment = await req.prisma.examAssignment.findUnique({
      where: { userId_examId: { userId: req.user.id, examId } },
    });
    if (!assignment) return res.status(403).json({ error: 'Not assigned to this exam' });

    // Check exam is active
    const exam = await req.prisma.exam.findUnique({ where: { id: examId } });
    if (!exam) return res.status(404).json({ error: 'Exam not found' });

    const now = new Date();
    if (now < new Date(exam.startTime)) return res.status(400).json({ error: 'Exam has not started yet' });
    if (now > new Date(exam.endTime)) return res.status(400).json({ error: 'Exam has ended' });

    const submission = await req.prisma.submission.upsert({
      where: { userId_examId: { userId: req.user.id, examId } },
      update: {},
      create: { userId: req.user.id, examId, status: 'IN_PROGRESS' },
      include: { answers: true },
    });

    res.json(submission);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to start submission' });
  }
});

// POST /submissions/autosave
router.post('/autosave', authenticate, authorize('STUDENT'), async (req, res) => {
  const { examId, answers } = req.body; // answers: [{ questionId, answer }]
  if (!examId || !Array.isArray(answers)) return res.status(400).json({ error: 'examId and answers required' });
  try {
    const submission = await req.prisma.submission.findUnique({
      where: { userId_examId: { userId: req.user.id, examId } },
    });
    if (!submission) return res.status(404).json({ error: 'Submission not found' });
    if (submission.status !== 'IN_PROGRESS') return res.status(400).json({ error: 'Exam already submitted' });

    for (const { questionId, answer } of answers) {
      await req.prisma.submissionAnswer.upsert({
        where: { submissionId_questionId: { submissionId: submission.id, questionId } },
        update: { answer: String(answer ?? ''), savedAt: new Date() },
        create: { submissionId: submission.id, questionId, answer: String(answer ?? '') },
      });
    }

    await req.prisma.submission.update({
      where: { id: submission.id },
      data: { autoSavedAt: new Date() },
    });

    res.json({ message: 'Auto-saved', savedAt: new Date().toISOString() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Auto-save failed' });
  }
});

// POST /submissions/submit
router.post('/submit', authenticate, authorize('STUDENT'), async (req, res) => {
  const { examId, answers = [] } = req.body;
  if (!examId) return res.status(400).json({ error: 'examId required' });
  try {
    const submission = await req.prisma.submission.findUnique({
      where: { userId_examId: { userId: req.user.id, examId } },
    });
    if (!submission) return res.status(404).json({ error: 'Submission not found' });
    if (submission.status !== 'IN_PROGRESS') return res.status(400).json({ error: 'Already submitted' });

    // Save any final answers
    for (const { questionId, answer } of answers) {
      await req.prisma.submissionAnswer.upsert({
        where: { submissionId_questionId: { submissionId: submission.id, questionId } },
        update: { answer: String(answer ?? '') },
        create: { submissionId: submission.id, questionId, answer: String(answer ?? '') },
      });
    }

    const updated = await req.prisma.submission.update({
      where: { id: submission.id },
      data: { status: 'SUBMITTED', submittedAt: new Date() },
      include: { answers: true },
    });

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Submission failed' });
  }
});

// GET /submissions/:examId (student gets their own)
router.get('/my/:examId', authenticate, authorize('STUDENT'), async (req, res) => {
  try {
    const submission = await req.prisma.submission.findUnique({
      where: { userId_examId: { userId: req.user.id, examId: req.params.examId } },
      include: { answers: true },
    });
    res.json(submission || null);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch submission' });
  }
});

// GET /submissions/exam/:examId (faculty sees all)
router.get('/exam/:examId', authenticate, authorize('FACULTY', 'ADMIN'), async (req, res) => {
  try {
    const submissions = await req.prisma.submission.findMany({
      where: { examId: req.params.examId },
      include: {
        user: { select: { id: true, name: true, email: true } },
        answers: true,
      },
    });
    res.json(submissions);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch submissions' });
  }
});

module.exports = router;

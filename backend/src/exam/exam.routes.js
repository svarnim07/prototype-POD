const express = require('express');
const { authenticate, authorize } = require('../common/jwt');
const router = express.Router();

// GET /exams - list exams based on role
router.get('/', authenticate, async (req, res) => {
  try {
    let exams;
    if (req.user.role === 'STUDENT') {
      const assignments = await req.prisma.examAssignment.findMany({
        where: { userId: req.user.id },
        include: { exam: { include: { questions: { select: { id: true } } } } },
      });
      exams = assignments.map(a => ({ ...a.exam, questionCount: a.exam.questions.length }));
    } else {
      exams = await req.prisma.exam.findMany({
        include: {
          questions: { select: { id: true } },
          assignments: { select: { userId: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
    }
    res.json(exams);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch exams' });
  }
});

// GET /exams/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const exam = await req.prisma.exam.findUnique({
      where: { id: req.params.id },
      include: {
        questions: { orderBy: { order: 'asc' } },
        assignments: { include: { user: { select: { id: true, name: true, email: true } } } },
      },
    });
    if (!exam) return res.status(404).json({ error: 'Exam not found' });
    res.json(exam);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch exam' });
  }
});

// POST /exams (faculty/admin)
router.post('/', authenticate, authorize('FACULTY', 'ADMIN'), async (req, res) => {
  const { title, description, duration, startTime, endTime, studentIds = [] } = req.body;
  if (!title || !duration || !startTime || !endTime) {
    return res.status(400).json({ error: 'title, duration, startTime, endTime are required' });
  }
  try {
    const exam = await req.prisma.exam.create({
      data: {
        title,
        description,
        duration: parseInt(duration),
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        createdBy: req.user.id,
        status: 'DRAFT',
      },
    });

    if (studentIds.length > 0) {
      await req.prisma.examAssignment.createMany({
        data: studentIds.map(userId => ({ userId, examId: exam.id })),
        skipDuplicates: true,
      });
    }

    res.status(201).json(exam);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create exam' });
  }
});

// PATCH /exams/:id (faculty/admin)
router.patch('/:id', authenticate, authorize('FACULTY', 'ADMIN'), async (req, res) => {
  const { title, description, duration, startTime, endTime, status } = req.body;
  try {
    const exam = await req.prisma.exam.update({
      where: { id: req.params.id },
      data: {
        ...(title && { title }),
        ...(description !== undefined && { description }),
        ...(duration && { duration: parseInt(duration) }),
        ...(startTime && { startTime: new Date(startTime) }),
        ...(endTime && { endTime: new Date(endTime) }),
        ...(status && { status }),
      },
    });
    res.json(exam);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update exam' });
  }
});

// POST /exams/:id/assign (assign students)
router.post('/:id/assign', authenticate, authorize('FACULTY', 'ADMIN'), async (req, res) => {
  const { studentIds } = req.body;
  if (!Array.isArray(studentIds)) return res.status(400).json({ error: 'studentIds must be an array' });
  try {
    await req.prisma.examAssignment.createMany({
      data: studentIds.map(userId => ({ userId, examId: req.params.id })),
      skipDuplicates: true,
    });
    res.json({ message: 'Students assigned' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to assign students' });
  }
});

// GET /exams/:id/students-risk (faculty monitoring)
router.get('/:id/students-risk', authenticate, authorize('FACULTY', 'ADMIN'), async (req, res) => {
  try {
    const assignments = await req.prisma.examAssignment.findMany({
      where: { examId: req.params.id },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    const riskScores = await req.prisma.riskScore.findMany({
      where: { examId: req.params.id },
    });
    const riskMap = Object.fromEntries(riskScores.map(r => [r.userId, r]));

    const submissions = await req.prisma.submission.findMany({
      where: { examId: req.params.id },
    });
    const submissionMap = Object.fromEntries(submissions.map(s => [s.userId, s]));

    const data = assignments.map(a => ({
      user: a.user,
      risk: riskMap[a.user.id] || { score: 0, level: 'LOW' },
      submission: submissionMap[a.user.id] || null,
    }));

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch monitoring data' });
  }
});

// DELETE /exams/:id (admin)
router.delete('/:id', authenticate, authorize('ADMIN'), async (req, res) => {
  try {
    await req.prisma.exam.delete({ where: { id: req.params.id } });
    res.json({ message: 'Exam deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete exam' });
  }
});

module.exports = router;

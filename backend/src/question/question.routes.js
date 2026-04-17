const express = require('express');
const { authenticate, authorize } = require('../common/jwt');
const router = express.Router();

// GET /questions?examId=...
router.get('/', authenticate, async (req, res) => {
  const { examId } = req.query;
  if (!examId) return res.status(400).json({ error: 'examId required' });
  try {
    const questions = await req.prisma.question.findMany({
      where: { examId },
      orderBy: { order: 'asc' },
      select: {
        id: true, examId: true, type: true, content: true,
        options: true, marks: true, order: true,
        // Only expose answer to faculty/admin
        ...(true && { answer: true }),
      },
    });
    // Hide answer for students
    const result = req.user.role === 'STUDENT'
      ? questions.map(({ answer, ...q }) => q)
      : questions;
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch questions' });
  }
});

// POST /questions (faculty/admin)
router.post('/', authenticate, authorize('FACULTY', 'ADMIN'), async (req, res) => {
  const { examId, type, content, options, answer, marks = 1, order = 0 } = req.body;
  if (!examId || !type || !content) return res.status(400).json({ error: 'examId, type, content required' });
  if (!['MCQ', 'SUBJECTIVE', 'CODING'].includes(type)) return res.status(400).json({ error: 'Invalid type' });
  try {
    const question = await req.prisma.question.create({
      data: {
        examId,
        type,
        content,
        options: options ? JSON.stringify(options) : null,
        answer: answer || null,
        marks: parseInt(marks),
        order: parseInt(order),
      },
    });
    res.status(201).json(question);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create question' });
  }
});

// POST /questions/bulk
router.post('/bulk', authenticate, authorize('FACULTY', 'ADMIN'), async (req, res) => {
  const { examId, questions } = req.body;
  if (!examId || !Array.isArray(questions)) return res.status(400).json({ error: 'examId and questions[] required' });
  try {
    const created = await req.prisma.question.createMany({
      data: questions.map((q, i) => ({
        examId,
        type: q.type,
        content: q.content,
        options: q.options ? JSON.stringify(q.options) : null,
        answer: q.answer || null,
        marks: q.marks || 1,
        order: q.order ?? i,
      })),
    });
    res.status(201).json({ count: created.count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to bulk create questions' });
  }
});

// PATCH /questions/:id
router.patch('/:id', authenticate, authorize('FACULTY', 'ADMIN'), async (req, res) => {
  const { content, options, answer, marks, order } = req.body;
  try {
    const q = await req.prisma.question.update({
      where: { id: req.params.id },
      data: {
        ...(content && { content }),
        ...(options !== undefined && { options: JSON.stringify(options) }),
        ...(answer !== undefined && { answer }),
        ...(marks && { marks: parseInt(marks) }),
        ...(order !== undefined && { order: parseInt(order) }),
      },
    });
    res.json(q);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update question' });
  }
});

// DELETE /questions/:id
router.delete('/:id', authenticate, authorize('FACULTY', 'ADMIN'), async (req, res) => {
  try {
    await req.prisma.question.delete({ where: { id: req.params.id } });
    res.json({ message: 'Question deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete question' });
  }
});

module.exports = router;

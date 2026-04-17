const express = require('express');
const { authenticate, authorize } = require('../common/jwt');
const router = express.Router();

// POST /grievances (student)
router.post('/', authenticate, authorize('STUDENT'), async (req, res) => {
  const { examId, issue, description } = req.body;
  if (!examId || !issue) return res.status(400).json({ error: 'examId and issue required' });
  try {
    const grievance = await req.prisma.grievance.create({
      data: { userId: req.user.id, examId, issue, description: description || null },
    });
    res.status(201).json(grievance);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create grievance' });
  }
});

// GET /grievances/my (student sees own)
router.get('/my', authenticate, authorize('STUDENT'), async (req, res) => {
  try {
    const grievances = await req.prisma.grievance.findMany({
      where: { userId: req.user.id },
      include: { exam: { select: { title: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(grievances);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch grievances' });
  }
});

// GET /grievances (admin/faculty sees all)
router.get('/', authenticate, authorize('FACULTY', 'ADMIN'), async (req, res) => {
  try {
    const grievances = await req.prisma.grievance.findMany({
      include: {
        user: { select: { id: true, name: true, email: true } },
        exam: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(grievances);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch grievances' });
  }
});

// PATCH /grievances/:id (admin resolves)
router.patch('/:id', authenticate, authorize('FACULTY', 'ADMIN'), async (req, res) => {
  const { status, resolution } = req.body;
  if (!status) return res.status(400).json({ error: 'status required' });
  try {
    const grievance = await req.prisma.grievance.update({
      where: { id: req.params.id },
      data: {
        status,
        ...(resolution && { resolution }),
      },
    });
    res.json(grievance);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update grievance' });
  }
});

module.exports = router;

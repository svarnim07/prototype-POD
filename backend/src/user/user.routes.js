const express = require('express');
const { authenticate, authorize } = require('../common/jwt');
const router = express.Router();

// GET /users (admin only)
router.get('/', authenticate, authorize('ADMIN'), async (req, res) => {
  try {
    const users = await req.prisma.user.findMany({
      select: { id: true, email: true, name: true, role: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// PATCH /users/:id/role (admin only)
router.patch('/:id/role', authenticate, authorize('ADMIN'), async (req, res) => {
  const { role } = req.body;
  if (!['STUDENT', 'FACULTY', 'ADMIN'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
  try {
    const user = await req.prisma.user.update({
      where: { id: req.params.id },
      data: { role },
      select: { id: true, email: true, name: true, role: true },
    });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update role' });
  }
});

// DELETE /users/:id (admin only)
router.delete('/:id', authenticate, authorize('ADMIN'), async (req, res) => {
  try {
    await req.prisma.user.delete({ where: { id: req.params.id } });
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

module.exports = router;

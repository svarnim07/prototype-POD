require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { setupSocket } = require('./realtime/socket');
const authRoutes = require('./auth/auth.routes');
const examRoutes = require('./exam/exam.routes');
const questionRoutes = require('./question/question.routes');
const submissionRoutes = require('./submission/submission.routes');
const proctoringRoutes = require('./proctoring/proctoring.routes');
const riskRoutes = require('./risk/risk.routes');
const grievanceRoutes = require('./grievance/grievance.routes');
const userRoutes = require('./user/user.routes');
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const { execSync } = require('child_process');

// Vercel SQLite Workaround: Move DB to /tmp which is writable
if (process.env.VERCEL) {
  const tmpDbPath = '/tmp/examshield.db';
  process.env.DATABASE_URL = `file:${tmpDbPath}`;
  
  if (!fs.existsSync(tmpDbPath)) {
    console.log('🔄 Initializing SQLite DB in /tmp...');
    try {
      execSync('npx prisma db push --accept-data-loss', { stdio: 'inherit' });
      execSync('node prisma/seed.js', { stdio: 'inherit' });
    } catch (err) {
      console.error('❌ DB initialization failed:', err);
    }
  }
}

const app = express();
const server = http.createServer(app);
const prisma = new PrismaClient();

// Rate limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: { error: 'Too many requests, please try again later.' },
});

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}));
app.use(express.json({ limit: '5mb' }));
app.use(morgan('dev'));
app.use(limiter);

// Attach prisma to request
app.use((req, _res, next) => {
  req.prisma = prisma;
  next();
});

// Handle /api prefix for Vercel
app.use((req, res, next) => {
  if (req.url.startsWith('/api')) {
    req.url = req.url.replace(/^\/api/, '');
  }
  next();
});

// Routes
app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/exams', examRoutes);
app.use('/questions', questionRoutes);
app.use('/submissions', submissionRoutes);
app.use('/proctoring', proctoringRoutes);
app.use('/risk', riskRoutes);
app.use('/grievances', grievanceRoutes);

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// 404
app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));

// Error handler
app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

// Setup WebSocket
const io = setupSocket(server, prisma);
app.set('io', io);

const PORT = process.env.PORT || 3001;
// Only listen if not in a serverless environment (Vercel)
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  server.listen(PORT, () => {
    console.log(`\n🚀 ExamShield Backend running on http://localhost:${PORT}`);
    console.log(`📡 WebSocket ready`);
  });
}

module.exports = app;

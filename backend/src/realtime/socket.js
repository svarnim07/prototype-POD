const { Server } = require('socket.io');

let ioInstance = null;

function setupSocket(server, prisma) {
  const io = new Server(server, {
    cors: {
      origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    path: '/socket.io',
  });

  ioInstance = io;

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Student joins their exam room
    socket.on('join_exam', ({ examId, userId, role }) => {
      const room = `exam_${examId}`;
      socket.join(room);
      console.log(`[WS] ${role} ${userId} joined room ${room}`);

      // Faculty joins monitoring room
      if (role === 'FACULTY' || role === 'ADMIN') {
        socket.join(`monitor_${examId}`);
      }
    });

    // Proctoring event from student
    socket.on('proctoring_event', async (data) => {
      const { examId, userId, eventType, confidence, severity, metadata } = data;
      try {
        const event = await prisma.proctoringEvent.create({
          data: {
            userId,
            examId,
            eventType,
            confidence: parseFloat(confidence),
            severity,
            metadata: metadata ? JSON.stringify(metadata) : null,
          },
        });

        // Update risk score
        const updatedRisk = await updateRiskScore(prisma, userId, examId);

        // Broadcast to faculty monitoring this exam
        io.to(`monitor_${examId}`).emit('risk_update', {
          userId,
          examId,
          event: { ...event, metadata: data.metadata },
          riskScore: updatedRisk,
        });
      } catch (err) {
        console.error('Socket proctoring_event error:', err.message);
      }
    });

    // Tab switch / window blur
    socket.on('screen_event', async (data) => {
      const { examId, userId, eventType } = data;
      try {
        await prisma.proctoringEvent.create({
          data: {
            userId,
            examId,
            eventType,
            confidence: 1.0,
            severity: eventType === 'TAB_SWITCH' ? 'MEDIUM' : 'LOW',
          },
        });
        const updatedRisk = await updateRiskScore(prisma, userId, examId);
        io.to(`monitor_${examId}`).emit('risk_update', { userId, examId, event: data, riskScore: updatedRisk });
      } catch (err) {
        console.error('Socket screen_event error:', err.message);
      }
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });

  return io;
}

// Risk engine with sliding window & decay
async function updateRiskScore(prisma, userId, examId) {
  const WEIGHTS = {
    MULTIPLE_FACES: 5,
    NO_FACE: 3,
    EYE_DEVIATION: 2,
    AUDIO_SPIKE: 1,
    TAB_SWITCH: 2,
    WINDOW_BLUR: 1,
    HEAD_POSE_ABNORMAL: 2,
  };

  const WINDOW_MS = 10 * 60 * 1000; // 10 min sliding window
  const windowStart = new Date(Date.now() - WINDOW_MS);

  const events = await prisma.proctoringEvent.findMany({
    where: { userId, examId, timestamp: { gte: windowStart } },
    orderBy: { timestamp: 'asc' },
  });

  const now = Date.now();
  let score = 0;
  for (const ev of events) {
    const age = now - new Date(ev.timestamp).getTime();
    const decay = Math.max(0.2, 1 - age / WINDOW_MS);
    const weight = WEIGHTS[ev.eventType] || 1;
    score += weight * ev.confidence * decay;
  }

  const level = score < 5 ? 'LOW' : score < 15 ? 'MEDIUM' : 'HIGH';

  const riskScore = await prisma.riskScore.upsert({
    where: { userId_examId: { userId, examId } },
    update: { score, level },
    create: { userId, examId, score, level },
  });

  return riskScore;
}

function getIO() {
  return ioInstance;
}

module.exports = { setupSocket, getIO, updateRiskScore };

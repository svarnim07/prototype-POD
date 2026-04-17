const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding ExamShield database...');

  // Create users
  const adminHash = await bcrypt.hash('admin123', 12);
  const facultyHash = await bcrypt.hash('faculty123', 12);
  const studentHash = await bcrypt.hash('student123', 12);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@examshield.com' },
    update: {},
    create: { email: 'admin@examshield.com', passwordHash: adminHash, name: 'Admin User', role: 'ADMIN' },
  });

  const faculty = await prisma.user.upsert({
    where: { email: 'faculty@examshield.com' },
    update: {},
    create: { email: 'faculty@examshield.com', passwordHash: facultyHash, name: 'Dr. Sarah Johnson', role: 'FACULTY' },
  });

  const student1 = await prisma.user.upsert({
    where: { email: 'alice@student.com' },
    update: {},
    create: { email: 'alice@student.com', passwordHash: studentHash, name: 'Alice Chen', role: 'STUDENT' },
  });

  const student2 = await prisma.user.upsert({
    where: { email: 'bob@student.com' },
    update: {},
    create: { email: 'bob@student.com', passwordHash: studentHash, name: 'Bob Martinez', role: 'STUDENT' },
  });

  const student3 = await prisma.user.upsert({
    where: { email: 'carol@student.com' },
    update: {},
    create: { email: 'carol@student.com', passwordHash: studentHash, name: 'Carol White', role: 'STUDENT' },
  });

  console.log('✅ Users created');

  // Create an exam
  const now = new Date();
  const startTime = new Date(now.getTime() - 30 * 60 * 1000); // started 30 mins ago
  const endTime = new Date(now.getTime() + 90 * 60 * 1000);   // ends 90 mins from now

  const exam = await prisma.exam.upsert({
    where: { id: 'seed-exam-001' },
    update: {},
    create: {
      id: 'seed-exam-001',
      title: 'Data Structures & Algorithms — Midterm',
      description: 'Covers arrays, linked lists, trees, graphs, sorting and searching algorithms.',
      duration: 120,
      startTime,
      endTime,
      createdBy: faculty.id,
      status: 'ACTIVE',
    },
  });

  // Assign students
  for (const student of [student1, student2, student3]) {
    await prisma.examAssignment.upsert({
      where: { userId_examId: { userId: student.id, examId: exam.id } },
      update: {},
      create: { userId: student.id, examId: exam.id },
    });
  }

  // Create questions
  const questions = [
    {
      id: 'q1',
      type: 'MCQ',
      content: 'What is the time complexity of binary search?',
      options: JSON.stringify(['O(n)', 'O(log n)', 'O(n log n)', 'O(1)']),
      answer: 'O(log n)',
      marks: 2,
      order: 0,
    },
    {
      id: 'q2',
      type: 'MCQ',
      content: 'Which data structure uses LIFO ordering?',
      options: JSON.stringify(['Queue', 'Stack', 'Heap', 'Deque']),
      answer: 'Stack',
      marks: 2,
      order: 1,
    },
    {
      id: 'q3',
      type: 'MCQ',
      content: 'What is the worst-case time complexity of QuickSort?',
      options: JSON.stringify(['O(n log n)', 'O(n²)', 'O(n)', 'O(log n)']),
      answer: 'O(n²)',
      marks: 2,
      order: 2,
    },
    {
      id: 'q4',
      type: 'SUBJECTIVE',
      content: 'Explain the difference between BFS and DFS graph traversal algorithms. When would you prefer one over the other?',
      marks: 10,
      order: 3,
    },
    {
      id: 'q5',
      type: 'CODING',
      content: 'Write a function to reverse a linked list in-place. Include time and space complexity analysis.',
      marks: 15,
      order: 4,
    },
  ];

  for (const q of questions) {
    await prisma.question.upsert({
      where: { id: q.id },
      update: {},
      create: { ...q, examId: exam.id },
    });
  }

  console.log('✅ Exam and questions created');
  console.log('\n📋 Demo credentials:');
  console.log('  Admin:   admin@examshield.com    / admin123');
  console.log('  Faculty: faculty@examshield.com  / faculty123');
  console.log('  Student: alice@student.com       / student123');
  console.log('  Student: bob@student.com         / student123');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

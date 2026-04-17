import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';

import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';

import StudentDashboard from './pages/student/StudentDashboard';
import ExamInterface from './pages/student/ExamInterface';
import GrievancePage from './pages/student/GrievancePage';

import FacultyDashboard from './pages/faculty/FacultyDashboard';
import LiveMonitor from './pages/faculty/LiveMonitor';
import FlagReview from './pages/faculty/FlagReview';
import CreateExam from './pages/faculty/CreateExam';

import AdminDashboard from './pages/admin/AdminDashboard';

function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div className="spin" style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%' }} />
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'STUDENT') return <Navigate to="/student" replace />;
  if (user.role === 'FACULTY') return <Navigate to="/faculty" replace />;
  if (user.role === 'ADMIN') return <Navigate to="/admin" replace />;
  return <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                fontSize: '14px',
              },
            }}
          />
          <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            {/* Student */}
            <Route path="/student" element={<ProtectedRoute roles={['STUDENT']}><StudentDashboard /></ProtectedRoute>} />
            <Route path="/student/exam/:examId" element={<ProtectedRoute roles={['STUDENT']}><ExamInterface /></ProtectedRoute>} />
            <Route path="/student/grievances" element={<ProtectedRoute roles={['STUDENT']}><GrievancePage /></ProtectedRoute>} />

            {/* Faculty */}
            <Route path="/faculty" element={<ProtectedRoute roles={['FACULTY', 'ADMIN']}><FacultyDashboard /></ProtectedRoute>} />
            <Route path="/faculty/monitor/:examId" element={<ProtectedRoute roles={['FACULTY', 'ADMIN']}><LiveMonitor /></ProtectedRoute>} />
            <Route path="/faculty/flags/:examId" element={<ProtectedRoute roles={['FACULTY', 'ADMIN']}><FlagReview /></ProtectedRoute>} />
            <Route path="/faculty/create-exam" element={<ProtectedRoute roles={['FACULTY', 'ADMIN']}><CreateExam /></ProtectedRoute>} />

            {/* Admin */}
            <Route path="/admin" element={<ProtectedRoute roles={['ADMIN']}><AdminDashboard /></ProtectedRoute>} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

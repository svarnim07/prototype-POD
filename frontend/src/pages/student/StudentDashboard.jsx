import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LayoutDashboard, BookOpen, FileText, AlertCircle, Clock, CheckCircle, PlayCircle, Loader2 } from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import api from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { format } from 'date-fns';

const NAV = [
  { to: '/student', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/student/grievances', label: 'Grievances', icon: AlertCircle },
];

function ExamStatusBadge({ exam }) {
  const now = new Date();
  const start = new Date(exam.startTime);
  const end = new Date(exam.endTime);
  if (exam.status === 'COMPLETED' || now > end) return <span className="badge badge-info">Completed</span>;
  if (now >= start && now <= end) return <span className="badge badge-active">Live Now</span>;
  return <span className="badge" style={{ background: 'rgba(99,102,241,0.1)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.2)' }}>Upcoming</span>;
}

function TimeRemaining({ exam }) {
  const [remaining, setRemaining] = useState('');
  useEffect(() => {
    const calc = () => {
      const now = new Date();
      const end = new Date(exam.endTime);
      const start = new Date(exam.startTime);
      if (now < start) {
        const diff = start - now;
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        setRemaining(`Starts in ${h}h ${m}m`);
      } else if (now > end) {
        setRemaining('Ended');
      } else {
        const diff = end - now;
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        setRemaining(`${h}h ${m}m ${s}s left`);
      }
    };
    calc();
    const t = setInterval(calc, 1000);
    return () => clearInterval(t);
  }, [exam]);
  return <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{remaining}</span>;
}

export default function StudentDashboard() {
  const { user } = useAuth();
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/exams').then(r => setExams(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const now = new Date();
  const liveExams = exams.filter(e => new Date(e.startTime) <= now && new Date(e.endTime) >= now && e.status === 'ACTIVE');
  const upcomingExams = exams.filter(e => new Date(e.startTime) > now);
  const pastExams = exams.filter(e => new Date(e.endTime) < now || e.status === 'COMPLETED');

  return (
    <div style={{ display: 'flex' }}>
      <div className="gradient-mesh" />
      <Sidebar navItems={NAV} />

      <main className="main-content">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          {/* Header */}
          <div style={{ marginBottom: 32 }}>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)' }}>
              Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 17 ? 'Afternoon' : 'Evening'}, {user?.name?.split(' ')[0]} 👋
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 4 }}>
              {format(new Date(), 'EEEE, MMMM d, yyyy')}
            </p>
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 32 }}>
            {[
              { label: 'Live Exams', value: liveExams.length, icon: PlayCircle, color: '#10b981' },
              { label: 'Upcoming', value: upcomingExams.length, icon: Clock, color: '#6366f1' },
              { label: 'Completed', value: pastExams.length, icon: CheckCircle, color: '#f59e0b' },
            ].map(s => (
              <div key={s.label} className="stat-card">
                <div className="stat-icon" style={{ background: `${s.color}15`, color: s.color }}>
                  <s.icon size={22} />
                </div>
                <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
                <div className="stat-label">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Live Exams */}
          {liveExams.length > 0 && (
            <div style={{ marginBottom: 32 }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 14, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', display: 'inline-block', animation: 'pulse-dot 2s infinite' }} />
                Live Exams
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {liveExams.map(exam => (
                  <motion.div key={exam.id} whileHover={{ scale: 1.01 }}
                    style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.06), rgba(99,102,241,0.06))', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 16, padding: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{exam.title}</h3>
                        <ExamStatusBadge exam={exam} />
                      </div>
                      <div style={{ display: 'flex', gap: 16, fontSize: 13, color: 'var(--text-secondary)' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={13} /> {exam.duration} mins</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><FileText size={13} /> {exam.questionCount || 0} questions</span>
                        <TimeRemaining exam={exam} />
                      </div>
                    </div>
                    <Link to={`/student/exam/${exam.id}`} className="btn-primary" style={{ whiteSpace: 'nowrap' }}>
                      <PlayCircle size={16} /> Start Exam
                    </Link>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* All Exams Table */}
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 14, color: 'var(--text-primary)' }}>All Assigned Exams</h2>
            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Loader2 size={28} className="spin" color="var(--accent)" /></div>
            ) : exams.length === 0 ? (
              <div className="glass-sm" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                <BookOpen size={40} style={{ marginBottom: 12, opacity: 0.4 }} />
                <p>No exams assigned yet</p>
              </div>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Exam Title</th>
                      <th>Duration</th>
                      <th>Start Time</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {exams.map(exam => {
                      const isLive = new Date(exam.startTime) <= now && new Date(exam.endTime) >= now && exam.status === 'ACTIVE';
                      return (
                        <tr key={exam.id}>
                          <td style={{ fontWeight: 500 }}>{exam.title}</td>
                          <td>{exam.duration} min</td>
                          <td>{format(new Date(exam.startTime), 'MMM d, h:mm a')}</td>
                          <td><ExamStatusBadge exam={exam} /></td>
                          <td>
                            {isLive ? (
                              <Link to={`/student/exam/${exam.id}`} className="btn-primary" style={{ padding: '6px 14px', fontSize: 12 }}>
                                Enter
                              </Link>
                            ) : (
                              <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </motion.div>
      </main>
    </div>
  );
}

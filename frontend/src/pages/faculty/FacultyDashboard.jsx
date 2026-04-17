import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LayoutDashboard, Monitor, Flag, Plus, Users, BookOpen, Activity, Loader2, PlayCircle } from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import api from '../../lib/api';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const NAV = [
  { to: '/faculty', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/faculty/create-exam', label: 'Create Exam', icon: Plus },
];

export default function FacultyDashboard() {
  const [exams, setExams] = useState([]);
  const [users, setUsers] = useState([]);
  const [grievances, setGrievances] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.get('/exams'), api.get('/grievances')])
      .then(([ex, gr]) => { setExams(ex.data); setGrievances(gr.data); })
      .catch(() => toast.error('Failed to load data'))
      .finally(() => setLoading(false));
  }, []);

  const activeExams = exams.filter(e => e.status === 'ACTIVE');
  const openGrievances = grievances.filter(g => g.status === 'OPEN');

  const stats = [
    { label: 'Total Exams', value: exams.length, icon: BookOpen, color: '#6366f1' },
    { label: 'Active Now', value: activeExams.length, icon: PlayCircle, color: '#10b981' },
    { label: 'Open Grievances', value: openGrievances.length, icon: Flag, color: '#f59e0b' },
  ];

  return (
    <div style={{ display: 'flex' }}>
      <div className="gradient-mesh" />
      <Sidebar navItems={NAV} />
      <main className="main-content">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <div style={{ marginBottom: 28 }}>
            <h1 style={{ fontSize: 26, fontWeight: 800 }}>Faculty Dashboard</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 4 }}>{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 32 }}>
            {stats.map(s => (
              <div key={s.label} className="stat-card">
                <div className="stat-icon" style={{ background: `${s.color}15`, color: s.color }}><s.icon size={22} /></div>
                <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
                <div className="stat-label">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Exams list */}
          <div style={{ marginBottom: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700 }}>Your Exams</h2>
              <Link to="/faculty/create-exam" className="btn-primary" style={{ padding: '8px 16px', fontSize: 13 }}>
                <Plus size={15} /> Create Exam
              </Link>
            </div>

            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Loader2 size={28} className="spin" color="var(--accent)" /></div>
            ) : exams.length === 0 ? (
              <div className="glass-sm" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                <BookOpen size={36} style={{ opacity: 0.3, marginBottom: 10 }} /><p>No exams created yet</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {exams.map(exam => {
                  const now = new Date();
                  const isActive = exam.status === 'ACTIVE' && new Date(exam.startTime) <= now && new Date(exam.endTime) >= now;
                  return (
                    <motion.div key={exam.id} whileHover={{ scale: 1.005 }}
                      style={{ background: 'var(--bg-card)', border: `1px solid ${isActive ? 'rgba(16,185,129,0.3)' : 'var(--border)'}`, borderRadius: 14, padding: '18px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                          <h3 style={{ fontWeight: 600, fontSize: 15 }}>{exam.title}</h3>
                          {isActive && <span className="badge badge-active">Live</span>}
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'flex', gap: 16 }}>
                          <span>{exam.duration} min</span>
                          <span>{exam.questions?.length || 0} questions</span>
                          <span>{exam.assignments?.length || 0} students</span>
                          <span>{format(new Date(exam.startTime), 'MMM d, h:mm a')}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <Link to={`/faculty/monitor/${exam.id}`} className="btn-ghost" style={{ padding: '7px 14px', fontSize: 12 }}>
                          <Monitor size={13} /> Monitor
                        </Link>
                        <Link to={`/faculty/flags/${exam.id}`} className="btn-ghost" style={{ padding: '7px 14px', fontSize: 12 }}>
                          <Flag size={13} /> Flags
                        </Link>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Grievances */}
          {openGrievances.length > 0 && (
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 14 }}>Open Grievances</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {openGrievances.slice(0, 5).map(g => (
                  <div key={g.id} className="glass-sm" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <p style={{ fontWeight: 600, fontSize: 14 }}>{g.issue}</p>
                      <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{g.user?.name} • {g.exam?.title}</p>
                    </div>
                    <span className="badge badge-medium">Open</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
}

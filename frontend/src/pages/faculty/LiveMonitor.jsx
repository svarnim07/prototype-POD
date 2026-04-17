import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutDashboard, Plus, Monitor, AlertTriangle, Users, RefreshCw, Loader2, Flag, ChevronLeft } from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import api from '../../lib/api';
import { io } from 'socket.io-client';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

const NAV = [
  { to: '/faculty', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/faculty/create-exam', label: 'Create Exam', icon: Plus },
];

const RISK_CONFIG = {
  LOW:    { color: '#10b981', bg: 'rgba(16,185,129,0.1)',  label: 'Low Risk' },
  MEDIUM: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', label: 'Med Risk' },
  HIGH:   { color: '#ef4444', bg: 'rgba(239,68,68,0.1)',  label: 'High Risk' },
};

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function LiveMonitor() {
  const { examId } = useParams();
  const { user } = useAuth();
  const [exam, setExam] = useState(null);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [recentEvents, setRecentEvents] = useState([]);
  const socketRef = useRef(null);

  const load = () => {
    Promise.all([api.get(`/exams/${examId}`), api.get(`/exams/${examId}/students-risk`)])
      .then(([exRes, stRes]) => { setExam(exRes.data); setStudents(stRes.data); })
      .catch(() => toast.error('Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [examId]);

  // WebSocket for real-time updates
  useEffect(() => {
    const socket = io(SOCKET_URL, { path: '/socket.io', transports: ['websocket'] });
    socketRef.current = socket;
    socket.emit('join_exam', { examId, userId: user.id, role: user.role });

    socket.on('risk_update', ({ userId, riskScore, event }) => {
      setStudents(prev => prev.map(s =>
        s.user.id === userId ? { ...s, risk: riskScore } : s
      ));
      if (event) {
        setRecentEvents(prev => [
          { ...event, userName: students.find(s => s.user.id === userId)?.user?.name || userId, timestamp: new Date() },
          ...prev
        ].slice(0, 20));
      }
    });

    return () => socket.disconnect();
  }, [examId, user]);

  const riskCounts = { LOW: 0, MEDIUM: 0, HIGH: 0 };
  students.forEach(s => { riskCounts[s.risk?.level || 'LOW']++; });

  const sortedStudents = [...students].sort((a, b) => (b.risk?.score || 0) - (a.risk?.score || 0));

  return (
    <div style={{ display: 'flex' }}>
      <div className="gradient-mesh" />
      <Sidebar navItems={NAV} />
      <main className="main-content">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
            <Link to="/faculty" className="btn-ghost" style={{ padding: '8px' }}><ChevronLeft size={18} /></Link>
            <div style={{ flex: 1 }}>
              <h1 style={{ fontSize: 22, fontWeight: 800 }}>Live Monitor</h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{exam?.title || 'Loading...'}</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#10b981', fontWeight: 600 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', display: 'inline-block', animation: 'pulse-dot 2s infinite' }} />
              Live
            </div>
            <button onClick={load} className="btn-ghost" style={{ padding: '8px' }}><RefreshCw size={16} /></button>
            <Link to={`/faculty/flags/${examId}`} className="btn-ghost" style={{ padding: '8px 14px', fontSize: 13 }}>
              <Flag size={15} /> Review Flags
            </Link>
          </div>

          {/* Risk summary */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 28 }}>
            {['LOW', 'MEDIUM', 'HIGH'].map(level => {
              const c = RISK_CONFIG[level];
              return (
                <div key={level} style={{ background: c.bg, border: `1px solid ${c.color}33`, borderRadius: 14, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: c.color }}>{riskCounts[level]}</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: c.color }}>{c.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>students</div>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>
            {/* Student grid */}
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Users size={17} /> Students ({students.length})
              </h2>
              {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Loader2 size={32} className="spin" color="var(--accent)" /></div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                  {sortedStudents.map(s => {
                    const level = s.risk?.level || 'LOW';
                    const c = RISK_CONFIG[level];
                    const score = s.risk?.score || 0;
                    return (
                      <motion.div key={s.user.id} whileHover={{ scale: 1.02 }} onClick={() => setSelected(s)}
                        style={{ background: selected?.user?.id === s.user.id ? c.bg : 'var(--bg-card)', border: `2px solid ${selected?.user?.id === s.user.id ? c.color : 'var(--border)'}`, borderRadius: 14, padding: 16, cursor: 'pointer', transition: 'all 0.2s' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                          <div style={{ width: 36, height: 36, borderRadius: '50%', background: `${c.color}22`, border: `2px solid ${c.color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: c.color }}>
                            {s.user.name[0]}
                          </div>
                          <div style={{ overflow: 'hidden' }}>
                            <div style={{ fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.user.name}</div>
                            <div style={{ fontSize: 11, color: c.color, fontWeight: 600 }}>{level}</div>
                          </div>
                        </div>
                        <div style={{ marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Risk Score</span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: c.color }}>{score.toFixed(1)}</span>
                        </div>
                        <div className="progress-bar">
                          <div className="progress-fill" style={{ width: `${Math.min(100, (score / 20) * 100)}%`, background: c.color }} />
                        </div>
                        {s.submission && (
                          <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>
                            {s.submission.status === 'IN_PROGRESS' ? '⏳ In progress' : '✅ Submitted'}
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Recent events feed */}
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={17} /> Event Feed
              </h2>
              <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 14, padding: 16, maxHeight: 480, overflowY: 'auto' }}>
                {recentEvents.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>No events yet — monitoring live...</p>
                ) : (
                  <AnimatePresence>
                    {recentEvents.map((ev, i) => {
                      const sev = ev.severity || 'LOW';
                      const colors = { LOW: '#10b981', MEDIUM: '#f59e0b', HIGH: '#ef4444' };
                      return (
                        <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                          style={{ padding: '10px 0', borderBottom: i < recentEvents.length - 1 ? '1px solid var(--border)' : 'none' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: colors[sev] }}>{(ev.eventType || ev.event_type)?.replace(/_/g,' ')}</span>
                            <span className={`badge badge-${sev.toLowerCase()}`} style={{ fontSize: 10 }}>{sev}</span>
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{ev.userName} • just now</div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                )}
              </div>

              {selected && (
                <div style={{ marginTop: 16 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Selected: {selected.user.name}</h3>
                  <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Risk Score</span>
                      <strong style={{ color: RISK_CONFIG[selected.risk?.level || 'LOW'].color }}>{(selected.risk?.score || 0).toFixed(2)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Risk Level</span>
                      <span className={`badge badge-${(selected.risk?.level || 'LOW').toLowerCase()}`}>{selected.risk?.level || 'LOW'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Status</span>
                      <span style={{ fontSize: 13 }}>{selected.submission?.status || 'Not started'}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}

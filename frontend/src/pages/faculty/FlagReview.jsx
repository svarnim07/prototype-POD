import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LayoutDashboard, Plus, ChevronLeft, AlertTriangle, Loader2, CheckCircle, XCircle, Flag } from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const NAV = [
  { to: '/faculty', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/faculty/create-exam', label: 'Create Exam', icon: Plus },
];

const SEV_COLORS = { LOW: '#10b981', MEDIUM: '#f59e0b', HIGH: '#ef4444' };

export default function FlagReview() {
  const { examId } = useParams();
  const [events, setEvents] = useState([]);
  const [students, setStudents] = useState([]);
  const [grievances, setGrievances] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState(null);
  const [resolution, setResolution] = useState('');

  useEffect(() => {
    Promise.all([
      api.get(`/proctoring/events/${examId}`),
      api.get(`/exams/${examId}/students-risk`),
      api.get('/grievances'),
    ]).then(([ev, st, gr]) => {
      setEvents(ev.data);
      setStudents(st.data);
      setGrievances(gr.data.filter(g => g.exam?.id === examId || g.examId === examId));
    }).catch(() => toast.error('Failed to load'))
      .finally(() => setLoading(false));
  }, [examId]);

  const studentEvents = selected
    ? events.filter(e => e.userId === selected.user.id)
    : [];

  const resolveGrievance = async (id, status) => {
    setResolvingId(id);
    try {
      await api.patch(`/grievances/${id}`, { status, resolution });
      setGrievances(prev => prev.map(g => g.id === id ? { ...g, status, resolution } : g));
      setResolution('');
      toast.success(`Grievance ${status.toLowerCase()}`);
    } catch { toast.error('Failed to update'); }
    finally { setResolvingId(null); }
  };

  return (
    <div style={{ display: 'flex' }}>
      <div className="gradient-mesh" />
      <Sidebar navItems={NAV} />
      <main className="main-content">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <Link to="/faculty" className="btn-ghost" style={{ padding: '8px' }}><ChevronLeft size={18} /></Link>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 800 }}>Flag Review Panel</h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Review proctoring flags & resolve grievances</p>
            </div>
          </div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Loader2 size={32} className="spin" color="var(--accent)" /></div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 20 }}>
              {/* Student sidebar */}
              <div>
                <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, color: 'var(--text-secondary)' }}>STUDENTS</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {students.map(s => {
                    const level = s.risk?.level || 'LOW';
                    const c = SEV_COLORS[level];
                    const count = events.filter(e => e.userId === s.user.id).length;
                    return (
                      <button key={s.user.id} onClick={() => setSelected(s)}
                        style={{ padding: '12px 14px', borderRadius: 12, border: `2px solid ${selected?.user?.id === s.user.id ? c : 'var(--border)'}`, background: selected?.user?.id === s.user.id ? `${c}15` : 'var(--bg-card)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, transition: 'all 0.15s', textAlign: 'left' }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: `${c}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: c }}>{s.user.name[0]}</div>
                        <div style={{ flex: 1, overflow: 'hidden' }}>
                          <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.user.name}</div>
                          <div style={{ fontSize: 11, color: c, fontWeight: 600 }}>{level} • {count} flag{count !== 1 ? 's' : ''}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Events & grievances panel */}
              <div>
                {selected ? (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                      <h2 style={{ fontSize: 18, fontWeight: 700 }}>{selected.user.name}</h2>
                      <span className={`badge badge-${(selected.risk?.level||'LOW').toLowerCase()}`}>{selected.risk?.level || 'LOW'} Risk</span>
                      <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Score: {(selected.risk?.score||0).toFixed(2)}</span>
                    </div>

                    {/* Events timeline */}
                    <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: 'var(--text-secondary)' }}>PROCTORING EVENTS ({studentEvents.length})</h3>
                    {studentEvents.length === 0 ? (
                      <div className="glass-sm" style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', marginBottom: 20, fontSize: 13 }}>No flags for this student</div>
                    ) : (
                      <div className="table-container" style={{ marginBottom: 24 }}>
                        <table>
                          <thead><tr><th>Event</th><th>Severity</th><th>Confidence</th><th>Time</th></tr></thead>
                          <tbody>
                            {studentEvents.map(ev => (
                              <tr key={ev.id}>
                                <td style={{ fontWeight: 500 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <AlertTriangle size={14} color={SEV_COLORS[ev.severity]} />
                                    {ev.eventType.replace(/_/g, ' ')}
                                  </div>
                                </td>
                                <td><span className={`badge badge-${ev.severity.toLowerCase()}`}>{ev.severity}</span></td>
                                <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>{(ev.confidence * 100).toFixed(0)}%</td>
                                <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{format(new Date(ev.timestamp), 'h:mm:ss a')}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Grievances for this student */}
                    {grievances.filter(g => g.user?.id === selected.user.id).length > 0 && (
                      <>
                        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: 'var(--text-secondary)' }}>GRIEVANCES</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {grievances.filter(g => g.user?.id === selected.user.id).map(g => (
                            <div key={g.id} className="glass-sm" style={{ padding: 18 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                                <div>
                                  <p style={{ fontWeight: 600, marginBottom: 4 }}>{g.issue}</p>
                                  {g.description && <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{g.description}</p>}
                                </div>
                                <span style={{ fontSize: 12, fontWeight: 600, color: g.status === 'OPEN' ? '#f59e0b' : g.status === 'RESOLVED' ? '#10b981' : '#ef4444' }}>{g.status}</span>
                              </div>
                              {g.status === 'OPEN' && (
                                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10 }}>
                                  <input className="input" placeholder="Resolution note..." value={resolution}
                                    onChange={e => setResolution(e.target.value)} style={{ flex: 1, padding: '8px 12px', fontSize: 13 }} />
                                  <button className="btn-primary" style={{ padding: '8px 14px', fontSize: 12 }}
                                    onClick={() => resolveGrievance(g.id, 'RESOLVED')} disabled={resolvingId === g.id}>
                                    {resolvingId === g.id ? <Loader2 size={13} className="spin" /> : <><CheckCircle size={13} />Resolve</>}
                                  </button>
                                  <button className="btn-danger" style={{ padding: '8px 14px', fontSize: 12 }}
                                    onClick={() => resolveGrievance(g.id, 'REJECTED')} disabled={resolvingId === g.id}>
                                    <XCircle size={13} />
                                  </button>
                                </div>
                              )}
                              {g.resolution && <p style={{ fontSize: 12, color: '#10b981', marginTop: 8 }}>✓ {g.resolution}</p>}
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <div className="glass-sm" style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>
                    <Flag size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
                    <p>Select a student to view their flags and grievances</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
}

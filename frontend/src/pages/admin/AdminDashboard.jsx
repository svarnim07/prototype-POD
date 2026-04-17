import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { LayoutDashboard, Users, Shield, Loader2, Trash2, BookOpen } from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const NAV = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
];

const ROLE_COLORS = { STUDENT: '#10b981', FACULTY: '#6366f1', ADMIN: '#f59e0b' };

export default function AdminDashboard() {
  const [users, setUsers] = useState([]);
  const [exams, setExams] = useState([]);
  const [grievances, setGrievances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('users');

  const load = () => {
    Promise.all([api.get('/users'), api.get('/exams'), api.get('/grievances')])
      .then(([u, e, g]) => { setUsers(u.data); setExams(e.data); setGrievances(g.data); })
      .catch(() => toast.error('Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const changeRole = async (id, role) => {
    try {
      await api.patch(`/users/${id}/role`, { role });
      setUsers(prev => prev.map(u => u.id === id ? { ...u, role } : u));
      toast.success('Role updated');
    } catch { toast.error('Failed'); }
  };

  const deleteUser = async (id) => {
    if (!confirm('Delete this user?')) return;
    try {
      await api.delete(`/users/${id}`);
      setUsers(prev => prev.filter(u => u.id !== id));
      toast.success('User deleted');
    } catch { toast.error('Failed'); }
  };

  const updateExamStatus = async (id, status) => {
    try {
      await api.patch(`/exams/${id}`, { status });
      setExams(prev => prev.map(e => e.id === id ? { ...e, status } : e));
      toast.success('Exam status updated');
    } catch { toast.error('Failed'); }
  };

  const stats = [
    { label: 'Total Users', value: users.length, icon: Users, color: '#6366f1' },
    { label: 'Total Exams', value: exams.length, icon: BookOpen, color: '#10b981' },
    { label: 'Grievances', value: grievances.length, icon: Shield, color: '#f59e0b' },
  ];

  const TABS = ['users', 'exams', 'grievances'];

  return (
    <div style={{ display: 'flex' }}>
      <div className="gradient-mesh" />
      <Sidebar navItems={NAV} />
      <main className="main-content">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <div style={{ marginBottom: 28 }}>
            <h1 style={{ fontSize: 26, fontWeight: 800 }}>Admin Control Panel</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 4 }}>System management & oversight</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 28 }}>
            {stats.map(s => (
              <div key={s.label} className="stat-card">
                <div className="stat-icon" style={{ background: `${s.color}15`, color: s.color }}><s.icon size={22} /></div>
                <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
                <div className="stat-label">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'var(--bg-secondary)', padding: 4, borderRadius: 12, width: 'fit-content', border: '1px solid var(--border)' }}>
            {TABS.map(t => (
              <button key={t} onClick={() => setTab(t)}
                style={{ padding: '8px 20px', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, background: tab === t ? 'var(--accent)' : 'transparent', color: tab === t ? 'white' : 'var(--text-secondary)', transition: 'all 0.2s', textTransform: 'capitalize' }}>
                {t}
              </button>
            ))}
          </div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Loader2 size={32} className="spin" color="var(--accent)" /></div>
          ) : (
            <>
              {/* Users tab */}
              {tab === 'users' && (
                <div className="table-container">
                  <table>
                    <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Joined</th><th>Actions</th></tr></thead>
                    <tbody>
                      {users.map(u => (
                        <tr key={u.id}>
                          <td style={{ fontWeight: 600 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ width: 30, height: 30, borderRadius: '50%', background: `${ROLE_COLORS[u.role]}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: ROLE_COLORS[u.role] }}>{u.name[0]}</div>
                              {u.name}
                            </div>
                          </td>
                          <td style={{ color: 'var(--text-secondary)' }}>{u.email}</td>
                          <td>
                            <select value={u.role} onChange={e => changeRole(u.id, e.target.value)}
                              style={{ padding: '5px 10px', borderRadius: 8, border: `1px solid ${ROLE_COLORS[u.role]}44`, background: `${ROLE_COLORS[u.role]}15`, color: ROLE_COLORS[u.role], fontSize: 12, fontWeight: 600, cursor: 'pointer', outline: 'none' }}>
                              <option value="STUDENT">STUDENT</option>
                              <option value="FACULTY">FACULTY</option>
                              <option value="ADMIN">ADMIN</option>
                            </select>
                          </td>
                          <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{format(new Date(u.createdAt), 'MMM d, yyyy')}</td>
                          <td>
                            <button onClick={() => deleteUser(u.id)} className="btn-danger" style={{ padding: '5px 10px', fontSize: 12 }}>
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Exams tab */}
              {tab === 'exams' && (
                <div className="table-container">
                  <table>
                    <thead><tr><th>Title</th><th>Duration</th><th>Start Time</th><th>Status</th><th>Actions</th></tr></thead>
                    <tbody>
                      {exams.map(e => (
                        <tr key={e.id}>
                          <td style={{ fontWeight: 600 }}>{e.title}</td>
                          <td>{e.duration} min</td>
                          <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{format(new Date(e.startTime), 'MMM d, h:mm a')}</td>
                          <td>
                            <select value={e.status} onChange={ev => updateExamStatus(e.id, ev.target.value)}
                              style={{ padding: '5px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 12, cursor: 'pointer' }}>
                              <option value="DRAFT">DRAFT</option>
                              <option value="ACTIVE">ACTIVE</option>
                              <option value="COMPLETED">COMPLETED</option>
                              <option value="CANCELLED">CANCELLED</option>
                            </select>
                          </td>
                          <td>
                            <button onClick={async () => { if(!confirm('Delete exam?')) return; await api.delete(`/exams/${e.id}`); setExams(prev => prev.filter(ex => ex.id !== e.id)); toast.success('Deleted'); }} className="btn-danger" style={{ padding: '5px 10px', fontSize: 12 }}>
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Grievances tab */}
              {tab === 'grievances' && (
                <div className="table-container">
                  <table>
                    <thead><tr><th>Student</th><th>Exam</th><th>Issue</th><th>Status</th><th>Filed</th></tr></thead>
                    <tbody>
                      {grievances.map(g => (
                        <tr key={g.id}>
                          <td style={{ fontWeight: 600 }}>{g.user?.name}</td>
                          <td style={{ color: 'var(--text-secondary)' }}>{g.exam?.title}</td>
                          <td>{g.issue}</td>
                          <td>
                            <span style={{ fontSize: 12, fontWeight: 600, color: g.status === 'OPEN' ? '#f59e0b' : g.status === 'RESOLVED' ? '#10b981' : g.status === 'REJECTED' ? '#ef4444' : '#6366f1' }}>
                              {g.status}
                            </span>
                          </td>
                          <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{format(new Date(g.createdAt), 'MMM d')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </motion.div>
      </main>
    </div>
  );
}

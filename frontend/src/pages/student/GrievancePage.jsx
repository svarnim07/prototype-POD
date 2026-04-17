import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, Plus, Send, Loader2, LayoutDashboard, CheckCircle, Clock, XCircle } from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import api from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const NAV = [
  { to: '/student', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/student/grievances', label: 'Grievances', icon: AlertCircle },
];

const STATUS_ICONS = {
  OPEN: { icon: Clock, color: '#f59e0b' },
  UNDER_REVIEW: { icon: AlertCircle, color: '#6366f1' },
  RESOLVED: { icon: CheckCircle, color: '#10b981' },
  REJECTED: { icon: XCircle, color: '#ef4444' },
};

export default function GrievancePage() {
  const { user } = useAuth();
  const [grievances, setGrievances] = useState([]);
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ examId: '', issue: '', description: '' });
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    Promise.all([api.get('/grievances/my'), api.get('/exams')])
      .then(([gr, ex]) => { setGrievances(gr.data); setExams(ex.data); })
      .catch(() => toast.error('Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.examId || !form.issue) return toast.error('Exam and issue are required');
    setSubmitting(true);
    try {
      await api.post('/grievances', form);
      toast.success('Grievance submitted');
      setForm({ examId: '', issue: '', description: '' });
      setShowForm(false);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to submit');
    } finally { setSubmitting(false); }
  };

  return (
    <div style={{ display: 'flex' }}>
      <div className="gradient-mesh" />
      <Sidebar navItems={NAV} />
      <main className="main-content">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 800 }}>Grievances</h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 4 }}>Raise issues regarding your exams</p>
            </div>
            <button className="btn-primary" onClick={() => setShowForm(v => !v)}>
              <Plus size={16} /> New Grievance
            </button>
          </div>

          {showForm && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="glass-sm" style={{ padding: 24, marginBottom: 24 }}>
              <h3 style={{ fontWeight: 700, marginBottom: 18 }}>Submit a Grievance</h3>
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label className="label">Exam</label>
                  <select className="input" value={form.examId} onChange={e => setForm(f => ({ ...f, examId: e.target.value }))} required>
                    <option value="">Select exam...</option>
                    {exams.map(ex => <option key={ex.id} value={ex.id}>{ex.title}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Issue Title</label>
                  <input className="input" placeholder="e.g. Wrong AI flag, Technical issue" value={form.issue}
                    onChange={e => setForm(f => ({ ...f, issue: e.target.value }))} required />
                </div>
                <div>
                  <label className="label">Description (optional)</label>
                  <textarea className="input" placeholder="Describe the issue in detail..." value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    style={{ minHeight: 100, resize: 'vertical' }} />
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="btn-ghost" type="button" onClick={() => setShowForm(false)}>Cancel</button>
                  <button className="btn-primary" type="submit" disabled={submitting}>
                    {submitting ? <Loader2 size={14} className="spin" /> : <><Send size={14} /> Submit</>}
                  </button>
                </div>
              </form>
            </motion.div>
          )}

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Loader2 size={32} className="spin" color="var(--accent)" /></div>
          ) : grievances.length === 0 ? (
            <div className="glass-sm" style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>
              <AlertCircle size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
              <p>No grievances filed yet</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {grievances.map(g => {
                const s = STATUS_ICONS[g.status] || STATUS_ICONS.OPEN;
                return (
                  <div key={g.id} className="glass-sm" style={{ padding: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                          <h3 style={{ fontWeight: 600, fontSize: 15 }}>{g.issue}</h3>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: s.color, fontWeight: 600 }}>
                            <s.icon size={13} />{g.status.replace('_', ' ')}
                          </span>
                        </div>
                        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                          Exam: <strong>{g.exam?.title}</strong> • {format(new Date(g.createdAt), 'MMM d, yyyy')}
                        </p>
                        {g.description && <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>{g.description}</p>}
                        {g.resolution && (
                          <div style={{ marginTop: 10, padding: '10px 14px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 8, fontSize: 13, color: '#10b981' }}>
                            <strong>Resolution:</strong> {g.resolution}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
}

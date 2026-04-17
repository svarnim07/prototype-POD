import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Shield, Eye, EyeOff, Mail, Lock, User, GraduationCap, BookOpen, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

const ROLES = [
  { value: 'STUDENT', label: 'Student', icon: GraduationCap, desc: 'Take exams' },
  { value: 'FACULTY', label: 'Faculty', icon: BookOpen, desc: 'Create & monitor' },
];

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '', name: '', role: 'STUDENT' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await register(form.email, form.password, form.name, form.role);
      toast.success('Account created!');
      if (user.role === 'STUDENT') navigate('/student');
      else navigate('/faculty');
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', position: 'relative' }}>
      <div className="gradient-mesh" />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        style={{ width: '100%', maxWidth: '460px', position: 'relative', zIndex: 1 }}
      >
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 64, height: 64, borderRadius: 20, background: 'var(--accent-glow)', border: '1px solid var(--border-accent)', marginBottom: 16 }}>
            <Shield size={32} color="var(--accent)" />
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6 }}>ExamShield</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Create your account</p>
        </div>

        <div className="glass" style={{ padding: '32px' }}>
          {/* Role selector */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 24 }}>
            {ROLES.map(r => (
              <button key={r.value} type="button" onClick={() => setForm(f => ({ ...f, role: r.value }))}
                style={{
                  padding: '14px', borderRadius: 12, border: `2px solid ${form.role === r.value ? 'var(--accent)' : 'var(--border)'}`,
                  background: form.role === r.value ? 'var(--accent-glow)' : 'var(--bg-card)',
                  cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, transition: 'all 0.2s',
                }}>
                <r.icon size={20} color={form.role === r.value ? 'var(--accent)' : 'var(--text-muted)'} />
                <span style={{ fontSize: 13, fontWeight: 600, color: form.role === r.value ? 'var(--accent)' : 'var(--text-secondary)' }}>{r.label}</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.desc}</span>
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label className="label">Full Name</label>
              <div style={{ position: 'relative' }}>
                <User size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input className="input" type="text" placeholder="Your full name" value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={{ paddingLeft: 36 }} required />
              </div>
            </div>
            <div>
              <label className="label">Email</label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input className="input" type="email" placeholder="you@example.com" value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))} style={{ paddingLeft: 36 }} required />
              </div>
            </div>
            <div>
              <label className="label">Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input className="input" type={showPass ? 'text' : 'password'} placeholder="Min 6 characters" value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))} style={{ paddingLeft: 36, paddingRight: 36 }} required minLength={6} />
                <button type="button" onClick={() => setShowPass(v => !v)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <button className="btn-primary" type="submit" disabled={loading} style={{ width: '100%', marginTop: 8, padding: '13px' }}>
              {loading ? <Loader2 size={18} className="spin" /> : 'Create Account'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'var(--text-secondary)' }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}>Sign in</Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}

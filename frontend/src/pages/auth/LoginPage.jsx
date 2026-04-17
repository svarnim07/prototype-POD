import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Shield, Eye, EyeOff, Mail, Lock, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await login(form.email, form.password);
      toast.success(`Welcome back, ${user.name}!`);
      if (user.role === 'STUDENT') navigate('/student');
      else if (user.role === 'FACULTY') navigate('/faculty');
      else navigate('/admin');
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const demoLogin = async (email, password) => {
    setForm({ email, password });
    setLoading(true);
    try {
      const user = await login(email, password);
      toast.success(`Logged in as ${user.name}`);
      if (user.role === 'STUDENT') navigate('/student');
      else if (user.role === 'FACULTY') navigate('/faculty');
      else navigate('/admin');
    } catch {
      toast.error('Demo login failed — please run seed first');
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
        style={{ width: '100%', maxWidth: '420px', position: 'relative', zIndex: 1 }}
      >
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 64, height: 64, borderRadius: 20, background: 'var(--accent-glow)', border: '1px solid var(--border-accent)', marginBottom: 16 }}>
            <Shield size={32} color="var(--accent)" />
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6 }}>ExamShield</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>AI-Powered Proctoring Platform</p>
        </div>

        {/* Card */}
        <div className="glass" style={{ padding: '32px' }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24, color: 'var(--text-primary)' }}>Sign In</h2>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label className="label">Email</label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  className="input"
                  type="email"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  style={{ paddingLeft: 36 }}
                  required
                />
              </div>
            </div>

            <div>
              <label className="label">Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  className="input"
                  type={showPass ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  style={{ paddingLeft: 36, paddingRight: 36 }}
                  required
                />
                <button type="button" onClick={() => setShowPass(v => !v)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button className="btn-primary" type="submit" disabled={loading} style={{ width: '100%', marginTop: 8, padding: '13px' }}>
              {loading ? <Loader2 size={18} className="spin" /> : 'Sign In'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'var(--text-secondary)' }}>
            No account?{' '}
            <Link to="/register" style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}>Create one</Link>
          </p>
        </div>

        {/* Demo credentials */}
        <div style={{ marginTop: 20 }}>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', marginBottom: 12 }}>— Quick Demo Login —</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {[
              { label: 'Student', email: 'alice@student.com', pass: 'student123', color: '#10b981' },
              { label: 'Faculty', email: 'faculty@examshield.com', pass: 'faculty123', color: '#6366f1' },
              { label: 'Admin', email: 'admin@examshield.com', pass: 'admin123', color: '#f59e0b' },
            ].map(d => (
              <button key={d.label} onClick={() => demoLogin(d.email, d.pass)} disabled={loading}
                style={{ padding: '8px', background: 'var(--bg-card)', border: `1px solid ${d.color}33`, borderRadius: 10, cursor: 'pointer', color: d.color, fontSize: 12, fontWeight: 600, transition: 'all 0.2s' }}>
                {d.label}
              </button>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

import { NavLink, useNavigate } from 'react-router-dom';
import { Shield, LogOut, Sun, Moon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import toast from 'react-hot-toast';

export default function Sidebar({ navItems }) {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    toast.success('Logged out');
    navigate('/login');
  };

  const roleColors = { STUDENT: '#10b981', FACULTY: '#6366f1', ADMIN: '#f59e0b' };
  const roleColor = roleColors[user?.role] || 'var(--accent)';

  return (
    <div className="sidebar">
      <div className="sidebar-logo">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--accent-glow)', border: '1px solid var(--border-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Shield size={20} color="var(--accent)" />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>ExamShield</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>AI Proctoring</div>
          </div>
        </div>
      </div>

      {/* User info */}
      <div style={{ padding: '12px 20px 16px', borderBottom: '1px solid var(--border)', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: '50%', background: `${roleColor}22`, border: `2px solid ${roleColor}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: roleColor }}>
            {user?.name?.[0]?.toUpperCase()}
          </div>
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.name}</div>
            <div style={{ fontSize: 11, color: roleColor, fontWeight: 600 }}>{user?.role}</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, padding: '0 8px' }}>
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => `sidebar-nav-item ${isActive ? 'active' : ''}`}
          >
            <item.icon size={17} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Bottom controls */}
      <div style={{ padding: '12px 8px 0', borderTop: '1px solid var(--border)', marginTop: 'auto', display: 'flex', gap: 8 }}>
        <button onClick={toggle} className="btn-ghost" style={{ flex: 1, padding: '8px', fontSize: 12 }}>
          {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          {theme === 'dark' ? 'Light' : 'Dark'}
        </button>
        <button onClick={handleLogout} className="btn-danger" style={{ flex: 1, padding: '8px', fontSize: 12 }}>
          <LogOut size={15} />
          Logout
        </button>
      </div>
    </div>
  );
}

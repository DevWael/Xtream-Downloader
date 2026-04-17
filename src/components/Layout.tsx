import React, { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Tv, Film, MonitorPlay, LogOut, Settings } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { LoginModal } from './LoginModal';

export const Layout: React.FC = () => {
  const { isAuthenticated, isLoaded, authConfig, logout } = useAuth();
  const [showSettings, setShowSettings] = useState(false);

  // Don't render anything until we've checked localStorage
  if (!isLoaded) return null;

  return (
    <div className="app-container">
      {(!isAuthenticated || showSettings) && <LoginModal />}

      <nav className="navbar">
        <div className="navbar-brand">
          <MonitorPlay color="#3b82f6" size={28} />
          <span>Xtream Downloader</span>
        </div>
        
        {isAuthenticated && (
          <div className="navbar-nav">
            <NavLink 
              to="/" 
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              end
            >
              Dashboard
            </NavLink>
            <NavLink 
              to="/movies" 
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Film size={18} />
                Movies
              </div>
            </NavLink>
            <NavLink 
              to="/series" 
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Tv size={18} />
                Series
              </div>
            </NavLink>
          </div>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {isAuthenticated && authConfig && (
            <>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                {authConfig.username}
              </div>
              <button 
                onClick={() => setShowSettings(!showSettings)}
                className="btn btn-secondary"
                style={{ padding: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                title="Settings"
              >
                <Settings size={18} />
              </button>
              <button 
                onClick={logout}
                className="btn btn-danger"
                style={{ padding: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444' }}
                title="Logout"
              >
                <LogOut size={18} />
              </button>
            </>
          )}
        </div>
      </nav>

      <main className="main-content">
        {isAuthenticated ? <Outlet /> : (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.5 }}>
            <p>Please log in to access the application.</p>
          </div>
        )}
      </main>
    </div>
  );
};

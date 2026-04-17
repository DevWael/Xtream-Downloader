import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Loader2, MonitorPlay } from 'lucide-react';

export const LoginModal: React.FC = () => {
  const { authConfig, setAuthConfig } = useAuth();
  
  const [host, setHost] = useState(authConfig?.host || 'http://');
  const [username, setUsername] = useState(authConfig?.username || '');
  const [password, setPassword] = useState(authConfig?.password || '');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (!host || !username || !password) {
      setError('Please fill in all fields');
      return;
    }

    try {
      setLoading(true);
      
      // Auto-append http:// if missing
      let finalHost = host.trim();
      if (!/^https?:\/\//i.test(finalHost)) {
        finalHost = `http://${finalHost}`;
      }
      
      const baseUrl = finalHost.replace(/\/$/, '');
      const targetUrl = new URL(`${baseUrl}/player_api.php`);
      targetUrl.searchParams.append('username', username);
      targetUrl.searchParams.append('password', password);
      
      const proxyUrl = `/api/proxy?url=${encodeURIComponent(targetUrl.toString())}`;
      const response = await fetch(proxyUrl);
      if (!response.ok) {
        throw new Error(`Network response was not ok: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // If the API returns an object with user_info, it's successful
      if (data.user_info && data.user_info.auth === 1) {
        setAuthConfig({ host: finalHost, username, password });
      } else {
        setError('Invalid username or password');
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setError(`Connection failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-overlay">
      <div className="login-modal">
        <div className="login-header">
          <MonitorPlay color="#3b82f6" size={40} />
          <h2>Welcome to Xtream</h2>
          <p>Please enter your IPTV provider credentials</p>
        </div>
        
        {error && <div className="alert alert-error">{error}</div>}
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Server URL</label>
            <input 
              type="text" 
              placeholder="http://example.com:8080" 
              value={host}
              onChange={(e) => setHost(e.target.value)}
              disabled={loading}
              className="form-control"
            />
          </div>
          
          <div className="form-group">
            <label>Username</label>
            <input 
              type="text" 
              placeholder="Username" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
              className="form-control"
            />
          </div>
          
          <div className="form-group">
            <label>Password</label>
            <input 
              type="password" 
              placeholder="Password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              className="form-control"
            />
          </div>
          
          <button 
            type="submit" 
            className="btn btn-primary btn-block" 
            disabled={loading}
            style={{ marginTop: '1.5rem', padding: '1rem', fontSize: '1.1rem' }}
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : 'Connect'}
          </button>
        </form>
      </div>
    </div>
  );
};

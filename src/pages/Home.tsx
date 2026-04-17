import { Film, Tv, Download } from 'lucide-react';
import { Link } from 'react-router-dom';

export const Home: React.FC = () => {
  return (
    <div>
      <div style={{ textAlign: 'center', margin: '4rem 0' }}>
        <h1 style={{ fontSize: '3rem', marginBottom: '1rem', background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Xtream Downloader
        </h1>
        <p style={{ fontSize: '1.2rem', color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto 3rem' }}>
          Your premium gateway to browse and download Movies and Series from your IPTV subscription directly to your device.
        </p>
        
        <div style={{ display: 'flex', gap: '2rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/movies" className="media-card" style={{ padding: '2rem', minWidth: '250px', alignItems: 'center', textDecoration: 'none' }}>
            <Film size={48} color="var(--primary-color)" style={{ marginBottom: '1rem' }} />
            <h2>Movies</h2>
            <p style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>Browse VODs and download directly</p>
          </Link>
          
          <Link to="/series" className="media-card" style={{ padding: '2rem', minWidth: '250px', alignItems: 'center', textDecoration: 'none' }}>
            <Tv size={48} color="var(--primary-light)" style={{ marginBottom: '1rem' }} />
            <h2>Series</h2>
            <p style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>Browse TV Shows and download episodes</p>
          </Link>
        </div>
      </div>
      
      <div style={{ background: 'var(--secondary-bg)', padding: '2rem', borderRadius: 'var(--border-radius)', marginTop: '4rem' }}>
        <h3><Download size={20} style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} /> How it works</h3>
        <p style={{ color: 'var(--text-secondary)', marginTop: '1rem', lineHeight: 1.6 }}>
          1. Select <strong>Movies</strong> or <strong>Series</strong> from the navigation menu.<br />
          2. Choose a category from the sidebar to view available content.<br />
          3. Click the <strong>Download</strong> button on any movie to save it locally.<br />
          4. For series, click on a show to view its seasons and episodes, then click download on any episode.
        </p>
      </div>
    </div>
  );
};

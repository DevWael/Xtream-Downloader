import React, { useEffect, useState } from 'react';
import { getSettings, saveSettings } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { Settings as SettingsIcon, Save, Plus, Trash2, Palette, Check } from 'lucide-react';
import { showToast } from '../utils/toast';

interface Location {
  name: string;
  path: string;
}

const THEMES = [
  { id: 'ocean',    label: 'Ocean',    value: '',         colors: ['#0f172a', '#3b82f6'] },
  { id: 'emerald',  label: 'Emerald',  value: 'emerald',  colors: ['#022c22', '#10b981'] },
  { id: 'purple',   label: 'Purple',   value: 'purple',   colors: ['#13052e', '#8b5cf6'] },
  { id: 'rose',     label: 'Rose',     value: 'rose',     colors: ['#1c0a12', '#f43f5e'] },
  { id: 'amber',    label: 'Amber',    value: 'amber',    colors: ['#1c1002', '#f59e0b'] },
  { id: 'cyan',     label: 'Cyan',     value: 'cyan',     colors: ['#042f2e', '#06b6d4'] },
  { id: 'slate',    label: 'Slate',    value: 'slate',    colors: ['#111111', '#a1a1aa'] },
  { id: 'midnight', label: 'Midnight', value: 'midnight', colors: ['#0a0e1a', '#7dd3fc'] },
  { id: 'storm',    label: 'Storm',    value: 'storm',    colors: ['#111827', '#64748b'] },
  { id: 'obsidian', label: 'Obsidian', value: 'obsidian', colors: ['#09090b', '#eab308'] },
  { id: 'arctic',   label: 'Arctic',   value: 'arctic',   colors: ['#0c1222', '#38bdf8'] },
  { id: 'carbon',   label: 'Carbon',   value: 'carbon',   colors: ['#121212', '#78716c'] },
  { id: 'sapphire', label: 'Sapphire', value: 'sapphire', colors: ['#0c0a2a', '#6366f1'] },
];

export const Settings: React.FC = () => {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { refreshConfig } = useAuth();

  const [activeTheme, setActiveTheme] = useState(() => {
    return localStorage.getItem('xtream-theme') || '';
  });

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const data = await getSettings();
        if (data.locations) {
          setLocations(data.locations);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleThemeChange = (themeValue: string) => {
    setActiveTheme(themeValue);
    if (themeValue) {
      document.documentElement.setAttribute('data-theme', themeValue);
      localStorage.setItem('xtream-theme', themeValue);
    } else {
      document.documentElement.removeAttribute('data-theme');
      localStorage.removeItem('xtream-theme');
    }
  };

  const handleAddLocation = () => {
    setLocations([...locations, { name: '', path: '' }]);
  };

  const handleLocationChange = (index: number, field: keyof Location, value: string) => {
    const newLocations = [...locations];
    newLocations[index] = { ...newLocations[index], [field]: value };
    setLocations(newLocations);
  };

  const handleRemoveLocation = (index: number) => {
    const newLocations = [...locations];
    newLocations.splice(index, 1);
    setLocations(newLocations);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await saveSettings({ locations });
      if (refreshConfig) await refreshConfig();
      window.dispatchEvent(new Event('auth_config_updated'));
      showToast('Settings saved successfully!');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>Loading settings...</div>;
  }

  return (
    <div className="settings-page">
      <style dangerouslySetInnerHTML={{__html: `
        .settings-page {
          max-width: 800px;
          margin: 0 auto;
          padding: 2rem 1.5rem;
        }

        .settings-header {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-bottom: 2rem;
          padding-bottom: 1.5rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .settings-header-icon {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          background: linear-gradient(135deg, rgba(var(--primary-rgb), 0.2), rgba(var(--primary-rgb), 0.1));
          border: 1px solid rgba(var(--primary-rgb), 0.3);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .settings-header h1 {
          margin: 0;
          font-size: 1.75rem;
          font-weight: 700;
          background: linear-gradient(135deg, #f8fafc, #94a3b8);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .settings-section {
          background: rgba(var(--surface-rgb), 0.4);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 16px;
          padding: 1.75rem;
          margin-bottom: 1.5rem;
        }

        .settings-section-title {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          font-size: 1.1rem;
          font-weight: 600;
          margin-bottom: 0.5rem;
        }

        .settings-section-desc {
          color: var(--text-secondary);
          font-size: 0.9rem;
          line-height: 1.6;
          margin-bottom: 1.5rem;
        }

        .theme-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
          gap: 0.75rem;
        }

        .theme-swatch {
          position: relative;
          border-radius: 12px;
          padding: 1rem 0.75rem;
          text-align: center;
          cursor: pointer;
          border: 2px solid rgba(255, 255, 255, 0.06);
          transition: all 0.25s ease;
          background: rgba(var(--surface-rgb), 0.3);
        }

        .theme-swatch:hover {
          border-color: rgba(255, 255, 255, 0.15);
          transform: translateY(-2px);
        }

        .theme-swatch.active {
          border-color: var(--primary-color);
          box-shadow: 0 0 0 1px var(--primary-color), 0 4px 12px rgba(0, 0, 0, 0.3);
        }

        .theme-swatch-colors {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          margin: 0 auto 0.75rem;
          position: relative;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        }

        .theme-swatch-colors::before,
        .theme-swatch-colors::after {
          content: '';
          position: absolute;
          width: 50%;
          height: 100%;
          top: 0;
        }

        .theme-swatch-colors::before {
          left: 0;
        }

        .theme-swatch-colors::after {
          right: 0;
        }

        .theme-swatch-label {
          font-size: 0.8rem;
          font-weight: 600;
          color: var(--text-secondary);
        }

        .theme-swatch.active .theme-swatch-label {
          color: var(--text-primary);
        }

        .theme-check {
          position: absolute;
          top: 6px;
          right: 6px;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: var(--primary-color);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .location-row {
          display: flex;
          gap: 1rem;
          align-items: flex-end;
          margin-bottom: 1rem;
        }

        .location-field {
          flex: 1;
        }

        .location-field:last-of-type {
          flex: 2;
        }

        .location-field label {
          display: block;
          font-size: 0.8rem;
          font-weight: 500;
          color: var(--text-secondary);
          margin-bottom: 0.35rem;
        }

        .location-field input {
          width: 100%;
          padding: 0.6rem 0.85rem;
          background: rgba(var(--bg-rgb), 0.6);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          color: var(--text-primary);
          font-size: 0.9rem;
          font-family: var(--font-family);
          transition: border-color 0.2s ease;
        }

        .location-field input:focus {
          outline: none;
          border-color: var(--primary-color);
          box-shadow: 0 0 0 2px rgba(var(--primary-rgb), 0.15);
        }

        .location-field input::placeholder {
          color: var(--text-secondary);
          opacity: 0.5;
        }

        .location-remove {
          width: 36px;
          height: 36px;
          border-radius: 8px;
          background: transparent;
          border: none;
          color: var(--text-secondary);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: all 0.2s ease;
        }

        .location-remove:hover {
          background: rgba(239, 68, 68, 0.15);
          color: #ef4444;
        }

        .locations-empty {
          padding: 2rem;
          text-align: center;
          background: rgba(var(--bg-rgb), 0.4);
          border: 1px dashed rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          color: var(--text-secondary);
          margin-bottom: 1rem;
        }

        .settings-actions {
          display: flex;
          justify-content: flex-end;
          gap: 0.75rem;
          margin-top: 0.5rem;
        }

        .settings-add-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: var(--text-secondary);
          font-size: 0.85rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          font-family: var(--font-family);
        }

        .settings-add-btn:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.15);
          color: var(--text-primary);
        }

        .settings-save-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.6rem 1.25rem;
          border-radius: 8px;
          background: var(--primary-color);
          border: none;
          color: white;
          font-size: 0.9rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          font-family: var(--font-family);
        }

        .settings-save-btn:hover {
          background: var(--primary-hover);
          box-shadow: var(--shadow-glow);
        }

        .settings-save-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      `}} />

      {/* Header */}
      <div className="settings-header">
        <div className="settings-header-icon">
          <SettingsIcon size={24} color="var(--primary-color)" />
        </div>
        <h1>Settings</h1>
      </div>

      {error && <div className="error-message" style={{ marginBottom: '1rem' }}>{error}</div>}

      {/* Theme Section */}
      <div className="settings-section">
        <div className="settings-section-title">
          <Palette size={20} color="var(--primary-color)" />
          Color Theme
        </div>
        <p className="settings-section-desc">
          Choose an accent color theme for the application. The theme is applied instantly and saved to your browser.
        </p>
        <div className="theme-grid">
          {THEMES.map(theme => (
            <div
              key={theme.id}
              className={`theme-swatch ${activeTheme === theme.value ? 'active' : ''}`}
              onClick={() => handleThemeChange(theme.value)}
            >
              {activeTheme === theme.value && (
                <div className="theme-check">
                  <Check size={12} color="white" />
                </div>
              )}
              <div
                className="theme-swatch-colors"
                style={{
                  background: `linear-gradient(135deg, ${theme.colors[0]} 0%, ${theme.colors[0]} 50%, ${theme.colors[1]} 50%, ${theme.colors[1]} 100%)`
                }}
              />
              <div className="theme-swatch-label">{theme.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Download Locations Section */}
      <div className="settings-section">
        <div className="settings-section-title">
          <Save size={20} color="var(--primary-color)" />
          Download Locations
        </div>
        <p className="settings-section-desc">
          Define the locations where you want to save your downloaded media. 
          If you are running in Docker, these paths should match the volume mounts inside your container (e.g., <code>/movies</code> or <code>/downloads/movies</code>).
        </p>

        {locations.length === 0 ? (
          <div className="locations-empty">
            No locations defined yet. Add a location to start downloading.
          </div>
        ) : (
          <div>
            {locations.map((loc, index) => (
              <div key={index} className="location-row">
                <div className="location-field">
                  <label>Location Name</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Movies" 
                    value={loc.name} 
                    onChange={(e) => handleLocationChange(index, 'name', e.target.value)}
                  />
                </div>
                <div className="location-field">
                  <label>Container Path</label>
                  <input 
                    type="text" 
                    placeholder="e.g. /movies" 
                    value={loc.path} 
                    onChange={(e) => handleLocationChange(index, 'path', e.target.value)}
                  />
                </div>
                <button 
                  className="location-remove"
                  onClick={() => handleRemoveLocation(index)}
                  title="Remove Location"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>
        )}

        <button className="settings-add-btn" onClick={handleAddLocation}>
          <Plus size={16} />
          Add Location
        </button>
      </div>

      {/* Save Button */}
      <div className="settings-actions">
        <button className="settings-save-btn" onClick={handleSave} disabled={saving}>
          <Save size={18} />
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
};

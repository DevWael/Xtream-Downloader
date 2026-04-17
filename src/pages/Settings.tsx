import React, { useEffect, useState } from 'react';
import { getSettings, saveSettings } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { Settings as SettingsIcon, Save, Plus, Trash2 } from 'lucide-react';
import { showToast } from '../utils/toast';

interface Location {
  name: string;
  path: string;
}

export const Settings: React.FC = () => {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { refreshConfig } = useAuth();

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
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
        <SettingsIcon size={28} color="var(--primary)" />
        <h1 style={{ margin: 0 }}>Settings</h1>
      </div>

      {error && <div className="error-message" style={{ marginBottom: '1rem' }}>{error}</div>}

      <div className="card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
        <h2 style={{ marginTop: 0, marginBottom: '1rem' }}>Download Locations</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
          Define the locations where you want to save your downloaded media. 
          If you are running in Docker, these paths should match the volume mounts inside your container (e.g., <code>/movies</code> or <code>/downloads/movies</code>).
        </p>

        {locations.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', backgroundColor: 'var(--bg-primary)', borderRadius: 'var(--radius-md)', marginBottom: '1rem' }}>
            No locations defined yet.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
            {locations.map((loc, index) => (
              <div key={index} style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Location Name</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="e.g. Movies" 
                    value={loc.name} 
                    onChange={(e) => handleLocationChange(index, 'name', e.target.value)}
                  />
                </div>
                <div style={{ flex: 2 }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Container Path</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="e.g. /movies" 
                    value={loc.path} 
                    onChange={(e) => handleLocationChange(index, 'path', e.target.value)}
                  />
                </div>
                <button 
                  className="btn" 
                  style={{ backgroundColor: 'transparent', color: '#ef4444', marginTop: '1.25rem', padding: '0.5rem' }}
                  onClick={() => handleRemoveLocation(index)}
                  title="Remove Location"
                >
                  <Trash2 size={20} />
                </button>
              </div>
            ))}
          </div>
        )}

        <button className="btn btn-secondary" onClick={handleAddLocation}>
          <Plus size={18} />
          Add Location
        </button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          <Save size={18} />
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
};

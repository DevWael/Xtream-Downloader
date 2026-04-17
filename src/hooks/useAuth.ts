import { useState, useEffect } from 'react';

export interface AuthConfig {
  host: string;
  username: string;
  password: string;
  hasServerDownload?: boolean;
}

const AUTH_KEY = 'xtream_auth_config';

export const getStoredAuthConfig = (): AuthConfig | null => {
  const stored = localStorage.getItem(AUTH_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
};

export const useAuth = () => {
  const [authConfig, setAuthConfigState] = useState<AuthConfig | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  const fetchEnvConfig = async () => {
    let serverHasDownload = false;
    try {
      const response = await fetch('/api/config');
      if (response.ok) {
        const config = await response.json();
        serverHasDownload = !!config.hasServerDownload;
        if (config.url && config.username && config.password) {
          const envConfig = { 
            host: config.url, 
            username: config.username, 
            password: config.password,
            hasServerDownload: serverHasDownload
          };
          setAuthConfigState(envConfig);
          localStorage.setItem(AUTH_KEY, JSON.stringify(envConfig));
          return;
        }
      }
    } catch (e) {
      console.warn('Failed to fetch env config, falling back to local storage');
    }

    // Fallback to local storage
    const stored = localStorage.getItem(AUTH_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        parsed.hasServerDownload = serverHasDownload; // Always use latest server setting
        setAuthConfigState(parsed);
      } catch (e) {
        console.error('Failed to parse auth config');
      }
    }
  };

  useEffect(() => {
    fetchEnvConfig().then(() => setIsLoaded(true));
    
    const handleConfigUpdate = () => {
      fetchEnvConfig();
    };
    window.addEventListener('auth_config_updated', handleConfigUpdate);
    return () => window.removeEventListener('auth_config_updated', handleConfigUpdate);
  }, []);

  const setAuthConfig = (config: AuthConfig | null) => {
    if (config) {
      localStorage.setItem(AUTH_KEY, JSON.stringify(config));
    } else {
      localStorage.removeItem(AUTH_KEY);
    }
    setAuthConfigState(config);
  };

  const logout = () => setAuthConfig(null);

  return {
    authConfig,
    isAuthenticated: authConfig !== null,
    isLoaded,
    setAuthConfig,
    logout,
    refreshConfig: fetchEnvConfig
  };
};

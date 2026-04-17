import React, { useState, useEffect, useContext, createContext } from 'react';

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

interface AuthContextType {
  authConfig: AuthConfig | null;
  isAuthenticated: boolean;
  isLoaded: boolean;
  setAuthConfig: (config: AuthConfig | null) => void;
  logout: () => void;
  refreshConfig: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
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

  return (
    <AuthContext.Provider value={{
      authConfig,
      isAuthenticated: authConfig !== null,
      isLoaded,
      setAuthConfig,
      logout,
      refreshConfig: fetchEnvConfig
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

import { useState, useEffect } from 'react';

export interface AuthConfig {
  host: string;
  username: string;
  password: string;
}

const AUTH_KEY = 'xtream_auth_config';

export const useAuth = () => {
  const [authConfig, setAuthConfigState] = useState<AuthConfig | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(AUTH_KEY);
    if (stored) {
      try {
        setAuthConfigState(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to parse auth config');
      }
    }
    setIsLoaded(true);
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
    logout
  };
};

// Expose a synchronous getter for the API service to use without React hooks
export const getStoredAuthConfig = (): AuthConfig | null => {
  const stored = localStorage.getItem(AUTH_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      return null;
    }
  }
  return null;
};

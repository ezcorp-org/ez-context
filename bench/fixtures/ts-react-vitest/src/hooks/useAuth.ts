import { useState, useCallback } from "react";

interface AuthState {
  isAuthenticated: boolean;
  userName: string | null;
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    userName: null,
  });

  const login = useCallback((userName: string) => {
    setAuthState({ isAuthenticated: true, userName });
  }, []);

  const logout = useCallback(() => {
    setAuthState({ isAuthenticated: false, userName: null });
  }, []);

  return { ...authState, login, logout };
}

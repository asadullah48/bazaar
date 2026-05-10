import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  role: string | null;
  setTokens: (access: string, refresh: string, role: string) => void;
  clearTokens: () => void;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      role: null,
      setTokens: (access, refresh, role) => {
        set({ accessToken: access, refreshToken: refresh, role });
        if (typeof document !== "undefined") {
          document.cookie = `bazaar-auth=${JSON.stringify({ state: { accessToken: access } })}; path=/; max-age=${7 * 24 * 3600}; SameSite=Lax`;
        }
      },
      clearTokens: () => {
        set({ accessToken: null, refreshToken: null, role: null });
        if (typeof document !== "undefined") {
          document.cookie = "bazaar-auth=; path=/; max-age=0";
        }
      },
      isAuthenticated: () => !!get().accessToken,
    }),
    {
      name: "bazaar-auth",
      partialize: (s) => ({
        accessToken: s.accessToken,
        refreshToken: s.refreshToken,
        role: s.role,
      }),
    }
  )
);

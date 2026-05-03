import { getApiBase } from "@/lib/api";
import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from "react";
import { initPushNotifications, unregisterPushNotifications } from "@/lib/pushNotifications";
import { initWebPush } from "@/lib/firebase";
import { getAvatar } from "@/lib/avatar";

export type UserRole = "admin" | "coach" | "user" | "moderator";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  isPremium: boolean;
  coachMembershipActive: boolean;
  membershipPaid: boolean;
  points: number;
  height?: number;
  weight?: number;
  gender?: 'male' | 'female' | 'other';
  steps: number;
  stepGoal: number;
  createdAt?: string;
  dateOfBirth?: string;
  fitnessGoal?: string;
  activityLevel?: string;
  targetWeight?: number;
  weeklyGoal?: string;
  computedActivityLevel?: string;
  city?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  medicalHistory?: string;
  medicalFileUrl?: string;
}

/** Returns true if user is premium OR within the 7-day free trial */
export function isTrialOrPremium(user: User | null): boolean {
  if (!user) return false;
  if (user.isPremium) return true;
  if (!user.createdAt) return true; // assume trial if no date (new user)
  const daysSinceCreation = (Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24);
  return daysSinceCreation <= 7;
}

/** Days remaining in trial */
export function trialDaysLeft(user: User | null): number {
  if (!user || user.isPremium || !user.createdAt) return 7;
  const daysSince = (Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24);
  return Math.max(0, Math.ceil(7 - daysSince));
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<any>;
  register: (email: string, password: string, name: string, role?: "user" | "coach", securityQuestion?: string, securityAnswer?: string) => Promise<void>;
  completeSocialLogin: (jwtToken: string) => Promise<User>;
  logout: () => void;
  updateUser: (data: Partial<User>) => void;
  refreshUser: () => Promise<void>;
  isTrialOrPremium: (u: User | null) => boolean;
  trialDaysLeft: (u: User | null) => number;
  isReady: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** Persist a generated avatar so it never changes unless the user updates it */
function getOrCreateAvatar(data: any): string {
  if (data.avatar && data.avatar.trim()) return data.avatar;
  const lsKey = `fitway_avatar_${data.id}`;
  try {
    const cached = localStorage.getItem(lsKey);
    if (cached) return cached;
  } catch {}
  const generated = getAvatar(data.email || String(data.id), null, data.gender, data.name);
  try { localStorage.setItem(lsKey, generated); } catch {}
  return generated;
}

const mapServerUser = (data: any): User => ({
  id: String(data.id),
  name: data.name || data.email?.split('@')[0] || 'User',
  email: data.email,
  role: (data.role as UserRole) || "user",
  isPremium: Boolean(data.is_premium),
  coachMembershipActive: Boolean(data.coach_membership_active),
  membershipPaid: Boolean(data.membership_paid),
  points: data.points || 0,
  steps: data.steps || 0,
  stepGoal: data.step_goal || 10000,
  avatar: getOrCreateAvatar(data),
  height: data.height,
  weight: data.weight,
  gender: data.gender,
  createdAt: data.created_at,
  dateOfBirth: data.date_of_birth || undefined,
  fitnessGoal: data.fitness_goal || undefined,
  activityLevel: data.activity_level || undefined,
  targetWeight: data.target_weight || undefined,
  weeklyGoal: data.weekly_goal || undefined,
  computedActivityLevel: data.computed_activity_level || undefined,
  city: data.city || undefined,
  country: data.country || undefined,
  latitude: data.latitude ?? undefined,
  longitude: data.longitude ?? undefined,
  medicalHistory: data.medical_history || undefined,
  medicalFileUrl: data.medical_file_url || undefined,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  // Always restore from localStorage on refresh - session persists until explicit logout
  const getInitialState = () => {
    const storedUser = localStorage.getItem("user");
    const storedToken = localStorage.getItem("token");
    let user: User | null = null;
    let token: string | null = null;

    if (storedToken) token = storedToken;
    if (storedUser) {
      try {
        user = JSON.parse(storedUser) as User;
      } catch (e) {
        console.warn("Failed to parse stored user", e);
      }
    }
    return { user, token };
  };

  const initial = getInitialState();
  const [user, setUser] = useState<User | null>(initial.user);
  const [token, setToken] = useState<string | null>(initial.token);
  const [loading, setLoading] = useState(true);

  // Ref that's set synchronously by logout() so any in-flight /api/auth/me
  // response can't re-populate the user after logout.
  const loggedOutRef = React.useRef(false);

  const clearAllAuth = () => {
    loggedOutRef.current = true;
    setToken(null);
    setUser(null);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("remember_token");
    // Clear push token so it isn't used after logout
    localStorage.removeItem("fitway_push_token_web");
  };

  const getStoredAuthUser = (): User | null => {
    try {
      const raw = localStorage.getItem("user");
      return raw ? (JSON.parse(raw) as User) : null;
    } catch {
      return null;
    }
  };

  const ensureSingleAccount = (_nextEmail: string) => {
    // Removed: stale localStorage tokens were blocking legitimate logins.
    // The server handles auth — we don't block login client-side.
  };

  // On mount, re-fetch fresh user data from server to sync any backend changes.
  // IMPORTANT: only clear auth on explicit 401/403 (invalid/expired token).
  // Network errors, 5xx, or timeouts must NOT log the user out — the server
  // may simply be temporarily unavailable (cold start, deploy, etc.).
  useEffect(() => {
    let active = true;
    const t = localStorage.getItem("token");
    const rt = localStorage.getItem("remember_token");

    // Sync state with localStorage if it was somehow skipped in first render
    if (t && !token) setToken(t);
    const storedUser = getStoredAuthUser();
    if (storedUser && !user) setUser(storedUser);

    if (!t) {
      // If no main token, check if we can Auto-Login with remember_token
      if (rt) {
        fetch(getApiBase() + '/api/auth/login-remember', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rememberToken: rt })
        })
          .then(r => r.ok ? r.json() : null)
          .then(data => {
            if (!active || !data?.token) { setLoading(false); return; }
            setToken(data.token);
            localStorage.setItem("token", data.token);
            if (data.user) {
              const fresh = mapServerUser(data.user);
              setUser(fresh);
              localStorage.setItem("user", JSON.stringify(fresh));
            }
            if (data.rememberToken) {
              localStorage.setItem("remember_token", data.rememberToken);
            }
          })
          .catch(() => {})
          .finally(() => { if (active) setLoading(false); });
      } else {
        setLoading(false);
      }
      return () => { active = false; };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    fetch(getApiBase() + '/api/auth/me', {
      headers: { Authorization: `Bearer ${t}` },
      signal: controller.signal,
    })
      .then(async (r) => {
        clearTimeout(timeoutId);
        if (r.status === 401 || r.status === 403) {
          // Token expired. Try remember_token before giving up.
          if (rt) {
            const refreshRes = await fetch(getApiBase() + '/api/auth/login-remember', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ rememberToken: rt })
            }).catch(() => null);

            if (refreshRes?.ok) {
              const data = await refreshRes.json();
              if (data?.token && active) {
                setToken(data.token);
                localStorage.setItem("token", data.token);
                if (data.user) {
                  const fresh = mapServerUser(data.user);
                  setUser(fresh);
                  localStorage.setItem("user", JSON.stringify(fresh));
                }
                if (data.rememberToken) {
                  localStorage.setItem("remember_token", data.rememberToken);
                }
                return { success: true };
              }
            }
          }
          if (active) clearAllAuth();
          return null;
        }
        if (!r.ok) return null;
        return r.json();
      })
      .then(data => {
        if (!active || loggedOutRef.current || !data) return;
        if (data.success) return; // already handled by remember-token branch
        if (data.user) {
          const fresh = mapServerUser(data.user);
          setUser(fresh);
          localStorage.setItem("user", JSON.stringify(fresh));
        }
      })
      .catch((err) => {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') console.warn("Auth refresh timed out");
      })
      .finally(() => { if (active) setLoading(false); });

    return () => { active = false; controller.abort(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep auth state synchronized across tabs/windows.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      // If e.key is null, it means localStorage.clear() was called.
      if (e.key !== null && e.key !== "token" && e.key !== "user") return;
      
      const nextToken = localStorage.getItem("token");
      const rawUser = localStorage.getItem("user");

      if (!nextToken || !rawUser) {
        // Only clear if we aren't already cleared to avoid loops
        setToken(prev => prev === null ? null : null);
        setUser(prev => prev === null ? null : null);
        return;
      }

      try {
        const parsed = JSON.parse(rawUser) as User;
        if (nextToken !== token) setToken(nextToken);
        // Deep compare user or just set it? Setting is safer for sync.
        setUser(parsed);
      } catch {
        setToken(null);
        setUser(null);
      }
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [token]);

  // Register native push token whenever auth token becomes available.
  useEffect(() => {
    if (!token) return;
    initPushNotifications(token).catch((err) => {
      console.warn("Native push initialization skipped:", err);
    });
    initWebPush(token).catch((err) => {
      console.warn("Web push initialization skipped:", err);
    });
  }, [token]);

  const login = async (email: string, password: string, rememberMe: boolean = false) => {
    ensureSingleAccount(email);

    const response = await fetch(getApiBase() + '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const text = await response.text();
    let data: any;
    try { data = JSON.parse(text); } catch { throw new Error('Server is unreachable. Please check your connection and try again.'); }
    if (!response.ok) throw new Error(data.message || 'Login failed');

    const userData = mapServerUser(data.user);
    setToken(data.token);
    setUser(userData);
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(userData));
    if (data.rememberToken) {
      localStorage.setItem("remember_token", data.rememberToken);
    }
    return data;
  };

  const register = async (email: string, password: string, name: string, role: "user" | "coach" = "user", securityQuestion?: string, securityAnswer?: string) => {
    ensureSingleAccount(email);

    const response = await fetch(getApiBase() + '/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name, role, securityQuestion, securityAnswer }),
    });
    const text = await response.text();
    let data: any;
    try { data = JSON.parse(text); } catch { throw new Error('Server is unreachable. Please try again later.'); }
    if (!response.ok) throw new Error(data.message || 'Registration failed');

    const userData = mapServerUser(data.user);
    setToken(data.token);
    setUser(userData);
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(userData));
    if (data.rememberToken) {
      localStorage.setItem("remember_token", data.rememberToken);
    }
  };

  const completeSocialLogin = async (jwtToken: string): Promise<User> => {
    const response = await fetch(getApiBase() + '/api/auth/me', {
      headers: { Authorization: `Bearer ${jwtToken}` },
    });
    const text = await response.text();
    let data: any;
    try { data = JSON.parse(text); } catch { throw new Error('Server is unreachable. Please try again later.'); }
    if (!response.ok || !data?.user) {
      throw new Error(data?.message || 'Failed to complete social login');
    }

    const userData = mapServerUser(data.user);
    setToken(jwtToken);
    setUser(userData);
    localStorage.setItem("token", jwtToken);
    localStorage.setItem("user", JSON.stringify(userData));
    return userData;
  };

  const logout = () => {
    const t = localStorage.getItem("token");
    // Clear everything synchronously FIRST — before any async call
    clearAllAuth();
    if (t) {
      unregisterPushNotifications(t).catch(() => {});
      fetch(getApiBase() + '/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${t}` },
      }).catch(() => {});
    }
  };

  const refreshUser = async () => {
    const t = localStorage.getItem("token");
    if (!t) return;
    const r = await fetch(getApiBase() + '/api/auth/me', { headers: { Authorization: `Bearer ${t}` } });
    if (r.ok) {
      const data = await r.json();
      if (data?.user) {
        const fresh = mapServerUser(data.user);
        setUser(fresh);
        localStorage.setItem("user", JSON.stringify(fresh));
      }
    }
  };

  const updateUser = (data: Partial<User>) => {
    setUser(prev => {
      if (!prev) return null;
      const updated = { ...prev, ...data };
      localStorage.setItem("user", JSON.stringify(updated));
      return updated;
    });

    // Sync all profile fields to backend
    const t = localStorage.getItem("token");
    if (!t) return;

    const payload: any = {};
    if (data.name !== undefined) payload.name = data.name;
    if (data.height !== undefined) payload.height = data.height;
    if (data.weight !== undefined) payload.weight = data.weight;
    if (data.gender !== undefined) payload.gender = data.gender;
    if (data.points !== undefined) payload.points = data.points;

    if (Object.keys(payload).length > 0) {
      fetch(getApiBase() + '/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
        body: JSON.stringify(payload),
      }).then(r => r.ok ? r.json() : null)
        .then(json => {
          if (json?.user) {
            const fresh = mapServerUser(json.user);
            setUser(fresh);
            localStorage.setItem("user", JSON.stringify(fresh));
          }
        })
        .catch(() => {});
    }
  };

  return (
    <AuthContext.Provider value={{
      user, token, loading,
      login, register, completeSocialLogin, logout,
      updateUser, refreshUser,
      isTrialOrPremium, trialDaysLeft,
      isReady: !loading
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

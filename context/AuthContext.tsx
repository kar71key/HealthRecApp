import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';

import { getSupabaseClient, isSupabaseConfigured, SUPABASE_CONFIG_MESSAGE } from '../services/supabase';
import type { AuthUser } from '../types/auth';

type AuthContextValue = {
  user: AuthUser | null;
  session: Session | null;
  isReady: boolean;
  isLoggedIn: boolean;
  isConfigured: boolean;
  configurationMessage: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (fullName: string, email: string, password: string) => Promise<void>;
  restoreSession: () => Promise<void>;
  refreshSession: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function getAvatarLabel(fullName: string, email: string): string {
  const nameParts = fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (nameParts.length >= 2) {
    return `${nameParts[0][0]}${nameParts[1][0]}`.toUpperCase();
  }

  if (nameParts.length === 1 && nameParts[0].length >= 2) {
    return nameParts[0].slice(0, 2).toUpperCase();
  }

  return email.slice(0, 2).toUpperCase();
}

function mapSupabaseUser(user: User | null): AuthUser | null {
  if (!user?.email) {
    return null;
  }

  const fullName =
    typeof user.user_metadata?.full_name === 'string' &&
    user.user_metadata.full_name.trim().length > 0
      ? user.user_metadata.full_name.trim()
      : user.email.split('@')[0];

  return {
    id: user.id,
    email: user.email,
    fullName,
    avatarLabel: getAvatarLabel(fullName, user.email),
  };
}

export function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isReady, setIsReady] = useState(false);

  const restoreSession = async () => {
    if (!isSupabaseConfigured()) {
      setSession(null);
      setUser(null);
      setIsReady(true);
      return;
    }

    const client = getSupabaseClient();
    if (!client) {
      setSession(null);
      setUser(null);
      setIsReady(true);
      return;
    }

    const {
      data: { session: nextSession },
      error,
    } = await client.auth.getSession();

    if (error) {
      throw error;
    }

    setSession(nextSession);
    setUser(mapSupabaseUser(nextSession?.user ?? null));
    setIsReady(true);
  };

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setIsReady(true);
      return;
    }

    const client = getSupabaseClient();
    if (!client) {
      setIsReady(true);
      return;
    }

    let isActive = true;

    const hydrate = async () => {
      try {
        await restoreSession();
      } catch {
        if (isActive) {
          setSession(null);
          setUser(null);
          setIsReady(true);
        }
      }
    };

    hydrate();

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, nextSession) => {
      if (!isActive) {
        return;
      }

      setSession(nextSession);
      setUser(mapSupabaseUser(nextSession?.user ?? null));
      setIsReady(true);
    });

    return () => {
      isActive = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      isReady,
      isLoggedIn: Boolean(session?.user && user),
      isConfigured: isSupabaseConfigured(),
      configurationMessage: isSupabaseConfigured() ? null : SUPABASE_CONFIG_MESSAGE,
      signIn: async (email, password) => {
        const client = getSupabaseClient();
        if (!client) {
          throw new Error(SUPABASE_CONFIG_MESSAGE);
        }

        const { error } = await client.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) {
          throw error;
        }
      },
      signUp: async (fullName, email, password) => {
        const client = getSupabaseClient();
        if (!client) {
          throw new Error(SUPABASE_CONFIG_MESSAGE);
        }

        const normalizedName = fullName.trim();
        const normalizedEmail = email.trim().toLowerCase();

        const { data, error } = await client.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            data: {
              full_name: normalizedName,
            },
          },
        });

        if (error) {
          throw error;
        }

        if (!data.session) {
          const signInResult = await client.auth.signInWithPassword({
            email: normalizedEmail,
            password,
          });

          if (signInResult.error) {
            throw new Error(
              'Account created, but automatic sign-in failed. Disable email confirmation in Supabase or sign in after confirming your email.',
            );
          }
        }
      },
      restoreSession,
      refreshSession: async () => {
        const client = getSupabaseClient();
        if (!client) {
          throw new Error(SUPABASE_CONFIG_MESSAGE);
        }

        const { error } = await client.auth.refreshSession();
        if (error) {
          throw error;
        }
      },
      logout: async () => {
        const client = getSupabaseClient();
        if (!client) {
          setSession(null);
          setUser(null);
          return;
        }

        const { error } = await client.auth.signOut();
        if (error) {
          throw error;
        }

        setSession(null);
        setUser(null);
      },
    }),
    [isReady, session, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}

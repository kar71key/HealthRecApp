import AsyncStorage from '@react-native-async-storage/async-storage';
import 'react-native-url-polyfill/auto';

import { createClient } from '@supabase/supabase-js';
import { APP_SECRETS } from './appSecrets';

const SUPABASE_URL = APP_SECRETS.supabaseUrl;
const SUPABASE_ANON_KEY = APP_SECRETS.supabaseAnonKey;
export const SUPABASE_CONFIG_MESSAGE =
  'Create services/appSecrets.ts from services/appSecrets.example.ts and fill in your Supabase credentials.';

let client: ReturnType<typeof createClient> | null = null;

function hasPlaceholder(value: string): boolean {
  return value.includes('YOUR_') || value.trim().length === 0;
}

export function getSupabaseClient(): ReturnType<typeof createClient> | null {
  if (!isSupabaseConfigured()) {
    return null;
  }

  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: AsyncStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    });
  }

  return client;
}

export function isSupabaseConfigured(): boolean {
  return !hasPlaceholder(SUPABASE_URL) && !hasPlaceholder(SUPABASE_ANON_KEY);
}

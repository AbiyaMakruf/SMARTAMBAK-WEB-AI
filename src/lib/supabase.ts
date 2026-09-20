import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://pkzqlpbhvuiezesstlmz.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export const STORAGE_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || "smartambak";

// Polyfill WebSocket in server/Node environments if not present
if (typeof window === "undefined" && typeof globalThis.WebSocket === "undefined") {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const WebSocket = require("ws");
    (globalThis as any).WebSocket = WebSocket;
  } catch {
    // ignore if ws cannot be loaded
  }
}

// Client for browser usage (anon key)
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
  },
});

// Admin client for server-side API routes (bypasses RLS if secret key is present)
export const getSupabaseAdmin = () => {
  return createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
};

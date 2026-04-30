/* =========================================================
   Technetos Multiplayer — Supabase Configuration
   ========================================================= */

const SUPABASE_URL = 'https://jvnbnsilqgqvsbypibei.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp2bmJuc2lscWdxdnNieXBpYmVpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNjkyMDUsImV4cCI6MjA4ODg0NTIwNX0.UXgUyZhJusIWur2QAuqfja0ZYkpkhxBkgOKI9dg_HY8';

// In-memory storage adapter for auth sessions
// Works in all contexts including sandboxed iframes
const authStorage = {
  _data: {},
  getItem(key) { return this._data[key] || null; },
  setItem(key, value) { this._data[key] = value; },
  removeItem(key) { delete this._data[key]; }
};

// Initialize Supabase client with in-memory auth storage
let _supabase = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storageKey: 'technetos-auth',
        storage: authStorage,
        lock: null,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false
      }
    });
  }
  return _supabase;
}

// Expose for non-Supabase-client callers (e.g. sendBeacon on tab close).
window.SUPABASE_URL = SUPABASE_URL;
window.SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;

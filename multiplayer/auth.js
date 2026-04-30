/* =========================================================
   Technetos Multiplayer — Auth Module
   Handles login, signup, session persistence
   ========================================================= */

const Auth = {
  currentUser: null,
  currentProfile: null,

  /**
   * Cache the user's access token on `window` so synchronous
   * tab-close handlers (which can't await getSession) can use it.
   * Falls back to null when logged out.
   */
  _cacheAccessToken(session) {
    window._cachedAccessToken = session && session.access_token ? session.access_token : null;
  },

  /** Initialize — check for existing session */
  async init() {
    const sb = getSupabase();
    const { data: { session } } = await sb.auth.getSession();
    if (session) {
      this.currentUser = session.user;
      this._cacheAccessToken(session);
      await this._loadProfile();
      return true;
    }
    this._cacheAccessToken(null);
    return false;
  },

  /** Sign up with email/password */
  async signUp(email, password, displayName, role = 'student') {
    const sb = getSupabase();
    const { data, error } = await sb.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName, role }
      }
    });
    if (error) throw error;
    this.currentUser = data.user;
    this._cacheAccessToken(data.session);
    // Profile is auto-created via trigger, but may need a moment
    await new Promise(r => setTimeout(r, 500));
    await this._loadProfile();
    return data;
  },

  /** Sign in with email/password */
  async signIn(email, password) {
    const sb = getSupabase();
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    this.currentUser = data.user;
    this._cacheAccessToken(data.session);
    await this._loadProfile();
    return data;
  },

  /** Sign out */
  async signOut() {
    const sb = getSupabase();
    await sb.auth.signOut();
    this.currentUser = null;
    this.currentProfile = null;
    this._cacheAccessToken(null);
  },

  /** Load profile from public.profiles */
  async _loadProfile() {
    if (!this.currentUser) return;
    const sb = getSupabase();
    const { data, error } = await sb
      .from('profiles')
      .select('*')
      .eq('id', this.currentUser.id)
      .single();
    if (!error && data) {
      this.currentProfile = data;
    }
  },

  /** Get display name */
  getDisplayName() {
    return this.currentProfile?.display_name || 
           this.currentUser?.email?.split('@')[0] || 
           'Unknown';
  },

  /** Check if user is master */
  isMaster() {
    return this.currentProfile?.role === 'master';
  },

  /** Listen for auth state changes */
  onAuthChange(callback) {
    const sb = getSupabase();
    sb.auth.onAuthStateChange((event, session) => {
      // Always refresh cached token — covers TOKEN_REFRESHED events too,
      // so the unload beacon never sends a stale token.
      this._cacheAccessToken(session);
      if (session) {
        this.currentUser = session.user;
        this._loadProfile().then(() => callback(event, session));
      } else {
        this.currentUser = null;
        this.currentProfile = null;
        callback(event, null);
      }
    });
  }
};

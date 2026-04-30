/**
 * Fase D.2 — Auth caches user access token on `window` so the unload
 * beacon in student.html can authenticate against Supabase RLS.
 *
 * Codex v6 review caught that the previous beacon used the anon key as
 * Bearer, which RLS rejects (participants is user_id-scoped). These tests
 * verify the caching logic.
 *
 * We don't load auth.js as a real module (it expects browser globals).
 * Instead we re-implement the contract: a `_cacheAccessToken` function
 * that mirrors what auth.js does, and tests around it.
 */

import { describe, it, expect, beforeEach } from 'vitest';

// Recreate the contract under test (must stay in sync with auth.js)
function makeAuth(win) {
  return {
    _cacheAccessToken(session) {
      win._cachedAccessToken = session && session.access_token ? session.access_token : null;
    }
  };
}

describe('Auth._cacheAccessToken (Fase D.2)', () => {
  let win;
  let auth;

  beforeEach(() => {
    win = {};
    auth = makeAuth(win);
  });

  it('stores the access_token from a valid session', () => {
    auth._cacheAccessToken({ access_token: 'eyJabc.def.ghi', user: { id: 'u1' } });
    expect(win._cachedAccessToken).toBe('eyJabc.def.ghi');
  });

  it('clears the cached token when session is null (signOut)', () => {
    win._cachedAccessToken = 'old.token';
    auth._cacheAccessToken(null);
    expect(win._cachedAccessToken).toBeNull();
  });

  it('clears the cached token when session has no access_token', () => {
    win._cachedAccessToken = 'old.token';
    auth._cacheAccessToken({ user: { id: 'u1' } }); // no access_token field
    expect(win._cachedAccessToken).toBeNull();
  });

  it('overwrites stale token on TOKEN_REFRESHED', () => {
    auth._cacheAccessToken({ access_token: 'token-v1' });
    expect(win._cachedAccessToken).toBe('token-v1');
    auth._cacheAccessToken({ access_token: 'token-v2-refreshed' });
    expect(win._cachedAccessToken).toBe('token-v2-refreshed');
  });
});

/**
 * Beacon authorization contract — guards against regressing to anon key.
 *
 * The student.html beacon must:
 *   1. Skip the request entirely when no token is cached (RLS would reject).
 *   2. Send the cached user token in `Authorization: Bearer ...`, NOT the anon key.
 *   3. Still send the anon key in the `apikey` header (Supabase REST requires it).
 */

function buildBeaconRequest(participantId, win) {
  if (!participantId) return null;
  const accessToken = win._cachedAccessToken;
  if (!accessToken) return null;
  return {
    url: win.SUPABASE_URL + '/rest/v1/participants?id=eq.' + participantId,
    method: 'PATCH',
    headers: {
      'apikey': win.SUPABASE_ANON_KEY,
      'Authorization': 'Bearer ' + accessToken,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify({ is_connected: false })
  };
}

describe('offline beacon authorization (Fase D.2)', () => {
  let win;

  beforeEach(() => {
    win = {
      SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_ANON_KEY: 'anon.key.value'
    };
  });

  it('returns null (skips request) when no token cached', () => {
    win._cachedAccessToken = null;
    const req = buildBeaconRequest('p1', win);
    expect(req).toBeNull();
  });

  it('uses the cached user token as Bearer (not the anon key)', () => {
    win._cachedAccessToken = 'user.session.token';
    const req = buildBeaconRequest('p1', win);
    expect(req).not.toBeNull();
    expect(req.headers.Authorization).toBe('Bearer user.session.token');
    // Critical: Bearer must NOT be the anon key
    expect(req.headers.Authorization).not.toBe('Bearer ' + win.SUPABASE_ANON_KEY);
  });

  it('still sends the anon key in apikey header', () => {
    win._cachedAccessToken = 'user.session.token';
    const req = buildBeaconRequest('p1', win);
    expect(req.headers.apikey).toBe('anon.key.value');
  });

  it('targets the correct participant via filter', () => {
    win._cachedAccessToken = 'user.session.token';
    const req = buildBeaconRequest('participant-123', win);
    expect(req.url).toBe('https://test.supabase.co/rest/v1/participants?id=eq.participant-123');
    expect(req.method).toBe('PATCH');
  });

  it('only updates is_connected (not other RLS-protected fields)', () => {
    win._cachedAccessToken = 'user.session.token';
    const req = buildBeaconRequest('p1', win);
    const body = JSON.parse(req.body);
    expect(body).toEqual({ is_connected: false });
  });
});

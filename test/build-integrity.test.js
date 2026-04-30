/**
 * Fase C.1 — Build integrity tests.
 *
 * The student.html monolith was split into per-concern modules. These
 * tests guard against:
 *   1. The build emitting unresolved <script src="./student-*.js"> tags
 *      (e.g. if String.replace mishandles `$` chars in JS literals — the
 *      bug we hit on first attempt).
 *   2. Module references getting out of sync with build-inline.js.
 *   3. Critical functions disappearing from the inlined output.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..');
const DIST_STUDENT = path.join(REPO, 'dist', 'multiplayer', 'student.html');
const ROOT_STUDENT = path.join(REPO, 'student.html');
const MULTI = path.join(REPO, 'multiplayer');

const STUDENT_MODULES = [
  'student-state.js',
  'student-auth.js',
  'student-sim.js',
  'student-orders-process.js',
  'student-orders-entry.js',
  'student-display.js',
  'student-margin.js',
  'student-toast.js',
  'student-ta-tools.js',
  'student-init.js',
  'student-beacon.js'
];

describe('build integrity (Fase C.1)', () => {
  let dist, root;

  beforeAll(() => {
    // Re-run the build so we test the current state, not stale output.
    execSync('node build-inline.js', { cwd: REPO, stdio: 'pipe' });
    dist = fs.readFileSync(DIST_STUDENT, 'utf-8');
    root = fs.readFileSync(ROOT_STUDENT, 'utf-8');
  });

  it('all student-*.js module files exist on disk', () => {
    for (const mod of STUDENT_MODULES) {
      const p = path.join(MULTI, mod);
      expect(fs.existsSync(p), `missing module: ${mod}`).toBe(true);
    }
  });

  it('source multiplayer/student.html references all 11 student-*.js modules', () => {
    const src = fs.readFileSync(path.join(MULTI, 'student.html'), 'utf-8');
    for (const mod of STUDENT_MODULES) {
      expect(src, `source missing <script src=./${mod}>`).toContain(`<script src="./${mod}"></script>`);
    }
  });

  it('inlined dist/student.html has NO unresolved <script src="./student-*.js"> tags', () => {
    // Catches the `$` String.replace bug: if any module's content contains
    // `$&`/`$'`/etc, the replace can dump the source tag back into the output.
    const matches = dist.match(/<script src="\.\/student-[a-z-]+\.js"><\/script>/g);
    expect(matches).toBeNull();
  });

  it('inlined root student.html has NO unresolved <script src="./student-*.js"> tags', () => {
    const matches = root.match(/<script src="\.\/student-[a-z-]+\.js"><\/script>/g);
    expect(matches).toBeNull();
  });

  it('dist and root student.html are byte-identical (single source of truth)', () => {
    expect(dist).toBe(root);
  });

  it('inlined output preserves critical entry points', () => {
    // Sample functions from each module — if any module dropped or got
    // double-inlined, these counts would go off.
    const checks = [
      { fn: 'function toggleAuthMode',     min: 1, max: 1 }, // student-auth.js
      { fn: 'function startStudentSim',    min: 1, max: 1 }, // student-sim.js
      { fn: 'function processLocalOrders', min: 1, max: 1 }, // student-orders-process.js
      { fn: 'function submitOrder',        min: 1, max: 1 }, // student-orders-entry.js
      { fn: 'function updateOrdersDisplay', min: 1, max: 1 }, // student-display.js
      { fn: 'function showMarginCallBanner', min: 1, max: 1 }, // student-margin.js
      { fn: 'function showToast',          min: 1, max: 1 }, // student-toast.js
      { fn: 'function _sendOfflineBeacon', min: 1, max: 1 }, // student-beacon.js
    ];
    for (const { fn, min, max } of checks) {
      const count = (dist.match(new RegExp(fn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
      expect(count, `${fn}: found ${count}, expected ${min}..${max}`).toBeGreaterThanOrEqual(min);
      expect(count, `${fn}: found ${count}, expected ${min}..${max}`).toBeLessThanOrEqual(max);
    }
  });

  it('Fase D/D.2 beacon code is intact in inlined output', () => {
    // Defends against accidentally regressing the v6/v7 beacon fix.
    expect(dist).toContain('window._cachedAccessToken');
    expect(dist).toContain("'Authorization': 'Bearer ' + accessToken");
    // The anon key should NOT appear as the Bearer token (the bug we fixed in D.2)
    expect(dist).not.toMatch(/Authorization['"]?\s*:\s*['"]Bearer ['"]\s*\+\s*window\.SUPABASE_ANON_KEY/);
  });

  it('Fase D restoreWorkingOrders uses snake_case DB shape', () => {
    // Defends against regressing the v5 P1 fix.
    expect(dist).toContain('order_type: o.order_type');
    expect(dist).toContain('limit_price: o.limit_price');
    expect(dist).toContain('_bestPrice: null');
    // The buggy v5 shape should NOT be present
    expect(dist).not.toContain('orderType: o.order_type');
    expect(dist).not.toContain('_trailPeak: null');
  });
});

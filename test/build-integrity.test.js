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
const DIST_MASTER  = path.join(REPO, 'dist', 'multiplayer', 'master.html');
const ROOT_STUDENT = path.join(REPO, 'student.html');
const ROOT_MASTER  = path.join(REPO, 'master.html');
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

const MASTER_MODULES = [
  'master-state.js',
  'master-auth.js',
  'master-lobby.js',
  'master-resume.js',     // Fase E
  'master-waiting.js',
  'master-sim-start.js',
  'master-chart.js',
  'master-sim-loop.js',
  'master-ticker.js',
  'master-settings.js',
  'master-end.js',
  'master-leaderboard.js',
  'master-timer.js',
  'master-toast.js',
  'master-ta-tools.js',
  'master-init.js'
];

describe('build integrity (Fase C.1 + C.2)', () => {
  let dist, root, distMaster, rootMaster;

  beforeAll(() => {
    // Re-run the build so we test the current state, not stale output.
    execSync('node build-inline.js', { cwd: REPO, stdio: 'pipe' });
    dist = fs.readFileSync(DIST_STUDENT, 'utf-8');
    root = fs.readFileSync(ROOT_STUDENT, 'utf-8');
    distMaster = fs.readFileSync(DIST_MASTER, 'utf-8');
    rootMaster = fs.readFileSync(ROOT_MASTER, 'utf-8');
  });

  it('all student-*.js module files exist on disk', () => {
    for (const mod of STUDENT_MODULES) {
      const p = path.join(MULTI, mod);
      expect(fs.existsSync(p), `missing module: ${mod}`).toBe(true);
    }
  });

  it('all master-*.js module files exist on disk', () => {
    for (const mod of MASTER_MODULES) {
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

  it('source multiplayer/master.html references all 16 master-*.js modules', () => {
    const src = fs.readFileSync(path.join(MULTI, 'master.html'), 'utf-8');
    for (const mod of MASTER_MODULES) {
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

  it('inlined dist/master.html has NO unresolved <script src="./master-*.js"> tags', () => {
    const matches = distMaster.match(/<script src="\.\/master-[a-z-]+\.js"><\/script>/g);
    expect(matches).toBeNull();
  });

  it('inlined root master.html has NO unresolved <script src="./master-*.js"> tags', () => {
    const matches = rootMaster.match(/<script src="\.\/master-[a-z-]+\.js"><\/script>/g);
    expect(matches).toBeNull();
  });

  it('dist and root student.html are byte-identical (single source of truth)', () => {
    expect(dist).toBe(root);
  });

  it('dist and root master.html are byte-identical (single source of truth)', () => {
    expect(distMaster).toBe(rootMaster);
  });

  it('inlined student output preserves critical entry points', () => {
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

  it('inlined master output preserves critical entry points', () => {
    // The student modules also live in master.html, so functions like
    // showToast / toggleAuthMode appear once from master-* and (if shared)
    // could re-appear from student-* — but master.html only inlines
    // master-*.js, never student-*.js. So each function should be exactly 1.
    const checks = [
      { fn: 'function toggleAuthMode',  min: 1, max: 1 }, // master-auth.js
      { fn: 'async function createRoom', min: 1, max: 1 }, // master-lobby.js
      { fn: 'async function startSession', min: 1, max: 1 }, // master-sim-start.js
      { fn: 'function startSimulation', min: 1, max: 1 }, // master-sim-loop.js
      { fn: 'function togglePlayPause', min: 1, max: 1 }, // master-sim-loop.js
      { fn: 'function setSpeed',        min: 1, max: 1 }, // master-sim-loop.js
      { fn: 'function changeTicker',    min: 1, max: 1 }, // master-ticker.js
      { fn: 'async function endSession', min: 1, max: 1 }, // master-end.js
      { fn: 'function showToast',       min: 1, max: 1 }, // master-toast.js
    ];
    for (const { fn, min, max } of checks) {
      const count = (distMaster.match(new RegExp(fn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
      expect(count, `${fn}: found ${count}, expected ${min}..${max}`).toBeGreaterThanOrEqual(min);
      expect(count, `${fn}: found ${count}, expected ${min}..${max}`).toBeLessThanOrEqual(max);
    }
  });

  it('master.html does NOT contain student-only modules (no cross-pollination)', () => {
    // Defends against a future build-inline.js bug where student modules
    // get accidentally inlined into master.html or vice versa.
    expect(distMaster).not.toContain('function _sendOfflineBeacon'); // student-beacon.js
    expect(distMaster).not.toContain('function processLocalOrders');  // student-orders-process.js
    expect(distMaster).not.toContain('function showMarginCallBanner'); // student-margin.js
  });

  it('student.html does NOT contain master-only modules', () => {
    expect(dist).not.toContain('async function createRoom');     // master-lobby.js
    expect(dist).not.toContain('async function endSession');     // master-end.js
    expect(dist).not.toContain('function startSimulation');      // master-sim-loop.js
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

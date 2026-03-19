/**
 * Build script: Inlines all external CSS and JS into master.html and student.html
 * so they work as self-contained files without needing to load separate .js/.css files.
 */
const fs = require('fs');
const path = require('path');

const BASE = '/home/user/workspace/bloomberg-sim';
const MULTI = path.join(BASE, 'multiplayer');

// Read all the source files
const styleCss = fs.readFileSync(path.join(BASE, 'style.css'), 'utf-8');
const supabaseConfig = fs.readFileSync(path.join(MULTI, 'supabase-config.js'), 'utf-8');
const authJs = fs.readFileSync(path.join(MULTI, 'auth.js'), 'utf-8');
const roomManagerJs = fs.readFileSync(path.join(MULTI, 'room-manager.js'), 'utf-8');
const priceEngineJs = fs.readFileSync(path.join(MULTI, 'price-engine.js'), 'utf-8');
const orderEngineJs = fs.readFileSync(path.join(MULTI, 'order-engine.js'), 'utf-8');
const taEngineJs = fs.readFileSync(path.join(MULTI, 'ta-engine.js'), 'utf-8');

// Polyfill injected BEFORE Supabase CDN to prevent SecurityError on navigator.locks
// In sandboxed iframes, locks exists but .request() throws SecurityError
// We override it with a simple pass-through implementation
const locksPolyfill = `<script>
(function() {
  var noop = { held: [], pending: [] };
  var shim = {
    request: function(n, a, b) { var f = typeof a === 'function' ? a : b; return f ? Promise.resolve(f({ name: n, mode: 'exclusive' })) : Promise.resolve(); },
    query: function() { return Promise.resolve(noop); }
  };
  // Always install our shim — it works everywhere and avoids SecurityError
  Object.defineProperty(navigator, 'locks', { value: shim, writable: true, configurable: true });
})();
</script>`;

function buildInlineHtml(htmlFile, jsModules) {
  let html = fs.readFileSync(path.join(MULTI, htmlFile), 'utf-8');
  
  // Replace <link rel="stylesheet" href="../style.css"> with inline <style>
  html = html.replace(
    '<link rel="stylesheet" href="../style.css">',
    `<style>\n${styleCss}\n</style>`
  );
  
  // Inject locks polyfill BEFORE the Supabase CDN script
  html = html.replace(
    '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>',
    locksPolyfill + '\n<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>'
  );
  
  // Replace each <script src="./xxx.js"></script> with inline <script>
  for (const mod of jsModules) {
    const srcTag = `<script src="./${mod.file}"></script>`;
    const inlineTag = `<script>\n${mod.content}\n</script>`;
    html = html.replace(srcTag, inlineTag);
  }
  
  return html;
}

// Master uses all 6 JS modules
const masterModules = [
  { file: 'supabase-config.js', content: supabaseConfig },
  { file: 'auth.js', content: authJs },
  { file: 'room-manager.js', content: roomManagerJs },
  { file: 'price-engine.js', content: priceEngineJs },
  { file: 'order-engine.js', content: orderEngineJs },
  { file: 'ta-engine.js', content: taEngineJs },
];

// Student uses 5 (no price-engine)
const studentModules = [
  { file: 'supabase-config.js', content: supabaseConfig },
  { file: 'auth.js', content: authJs },
  { file: 'room-manager.js', content: roomManagerJs },
  { file: 'order-engine.js', content: orderEngineJs },
  { file: 'ta-engine.js', content: taEngineJs },
];

const masterHtml = buildInlineHtml('master.html', masterModules);
const studentHtml = buildInlineHtml('student.html', studentModules);

// Write to output directory
const OUT = path.join(BASE, 'dist');
fs.mkdirSync(path.join(OUT, 'multiplayer'), { recursive: true });
fs.writeFileSync(path.join(OUT, 'multiplayer', 'master.html'), masterHtml);
fs.writeFileSync(path.join(OUT, 'multiplayer', 'student.html'), studentHtml);

// Also copy style.css and index.html (for single-player compat)
fs.copyFileSync(path.join(BASE, 'style.css'), path.join(OUT, 'style.css'));
fs.copyFileSync(path.join(BASE, 'index.html'), path.join(OUT, 'index.html'));
fs.copyFileSync(path.join(BASE, 'app.js'), path.join(OUT, 'app.js'));

console.log('Built inline versions:');
console.log('  dist/multiplayer/master.html -', (masterHtml.length / 1024).toFixed(1), 'KB');
console.log('  dist/multiplayer/student.html -', (studentHtml.length / 1024).toFixed(1), 'KB');

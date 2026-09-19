import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const root = fileURLToPath(new URL('../', import.meta.url));
const requested = process.argv[2] ?? 'all';
if (!['all', 'chromium', 'webkit'].includes(requested)) throw new Error('Choose chromium, webkit or all.');
const engines = requested === 'all' ? ['chromium', 'webkit'] : [requested];
const base = process.argv[3] ?? 'http://127.0.0.1:4178/';
const evidence = process.env.COLORBREAK_EVIDENCE_DIR ?? join(root, '.browser-evidence');
let server;
let serverOutput = '';
try {
  if (!process.argv[3]) {
    server = spawn(process.execPath, [join(root, 'node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', '4178', '--strictPort'], {
      cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    });
    for (const stream of [server.stdout, server.stderr]) stream.on('data', chunk => { serverOutput = (serverOutput + chunk).slice(-4000); });
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      if (server.exitCode !== null) throw new Error(`Preview exited before the checks: ${serverOutput}`);
      try { ready = serverOutput.includes('4178') && (await fetch(base, { signal: AbortSignal.timeout(1000) })).ok; } catch { /* Wait for this owned preview. */ }
      if (ready) break;
      await delay(100);
    }
    if (!ready) throw new Error(`Preview did not become ready. Run npm run build first. ${serverOutput}`);
  }
  for (const engine of engines) {
    const directory = join(evidence, engine);
    mkdirSync(directory, { recursive: true });
    const checks = ['check-command-panels', 'check-command-viewport'];
    if (engine === 'chromium') checks.push('check-mobile-evidence', 'check-quantity-layout', 'check-command-loading');
    for (const check of checks) {
      console.log(`\n${engine}: ${check} against ${base}`);
      const child = spawn(process.execPath, [join(root, 'tools', `${check}.mjs`), base], {
        cwd: root, windowsHide: true, stdio: 'inherit',
        env: { ...process.env, COLORBREAK_BROWSER: engine, COLORBREAK_EVIDENCE_DIR: directory },
      });
      const [code, signal] = await once(child, 'exit');
      if (code !== 0) throw new Error(`${engine} ${check} failed (${signal ?? code}).`);
    }
  }
} finally {
  if (server && server.exitCode === null) {
    server.kill();
    await once(server, 'exit');
  }
}

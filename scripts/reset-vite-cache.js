#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');

const targets = [
  path.join(root, 'node_modules', '.vite'),
  path.join(root, 'node_modules', '.cache'),
  path.join(root, '.vite'),
  path.join(root, '.cache'),
];

console.log('Resetting Vite cache...');

for (const t of targets) {
  try {
    if (fs.existsSync(t)) {
      console.log('Removing:', t);
      fs.rmSync(t, { recursive: true, force: true });
    } else {
      // silently ignore
    }
  } catch (err) {
    console.warn('Failed to remove', t, err && err.message ? err.message : err);
  }
}

// Delete lockfile depending on package manager priority
try {
  const pkgLock = path.join(root, 'package-lock.json');
  const yarnLock = path.join(root, 'yarn.lock');
  const pnpmLock = path.join(root, 'pnpm-lock.yaml');

  if (fs.existsSync(pkgLock)) {
    try {
      fs.rmSync(pkgLock, { force: true });
      console.log('Removed lockfile:', 'package-lock.json');
    } catch (e) { console.warn('Failed to remove package-lock.json', e && e.message); }
  } else if (fs.existsSync(yarnLock)) {
    try {
      fs.rmSync(yarnLock, { force: true });
      console.log('Removed lockfile:', 'yarn.lock');
    } catch (e) { console.warn('Failed to remove yarn.lock', e && e.message); }
  } else if (fs.existsSync(pnpmLock)) {
    try {
      fs.rmSync(pnpmLock, { force: true });
      console.log('Removed lockfile:', 'pnpm-lock.yaml');
    } catch (e) { console.warn('Failed to remove pnpm-lock.yaml', e && e.message); }
  } else {
    console.log('No lockfile found to remove.');
  }
} catch (err) {
  console.warn('Lockfile removal failed:', err && err.message ? err.message : err);
}

// Run npm install
try {
  console.log('\nRunning `npm install` — this may take a few moments...');
  const res = spawnSync('npm', ['install'], { stdio: 'inherit', cwd: root });
  if (res.error) {
    console.error('npm install failed:', res.error && res.error.message ? res.error.message : res.error);
    process.exitCode = 1;
  } else if (res.status !== 0) {
    console.error('npm install exited with code', res.status);
    process.exitCode = res.status || 1;
  } else {
    console.log('\n✅ Vite cache fully reset. Run: npm run dev');
  }
} catch (err) {
  console.error('Failed to run npm install:', err && err.message ? err.message : err);
  process.exitCode = 1;
}

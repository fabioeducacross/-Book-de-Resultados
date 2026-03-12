#!/usr/bin/env node
/**
 * AIOS Framework Update - Node.js Edition
 * Version: 5.2-node (Windows-compatible, no rsync required)
 *
 * Equivalent logic to update-aios.sh v5.2 using native Node.js fs operations.
 *
 * LOGIC:
 *   LOCAL only  (not in upstream)   → KEEP   (preserved)
 *   LOCAL + UPSTREAM                → OVERWRITE (upstream wins)
 *   UPSTREAM only (not in local)    → CREATE
 *   WAS tracked by git, UPSTREAM removed → DELETE
 *
 * Usage: node .aios-core/scripts/update-aios.js
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const os   = require('os');
const { execSync } = require('child_process');

// ─── Helpers ────────────────────────────────────────────────────────────────

function exec(cmd, opts = {}) {
  try {
    return execSync(cmd, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      ...opts,
    }).trim();
  } catch (err) {
    throw new Error(`Command failed: ${cmd}\n${err.stderr || err.message}`);
  }
}

/** Recursively list all files under dir, returning forward-slash relative paths. */
function listFiles(dir) {
  const results = [];
  function walk(current) {
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else {
        results.push(path.relative(dir, full).replace(/\\/g, '/'));
      }
    }
  }
  walk(dir);
  return results;
}

/** Copy a file, creating parent directories as needed. */
function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

/** Compare two files byte-for-byte. Returns true if identical. */
function filesEqual(a, b) {
  try {
    const sA = fs.statSync(a);
    const sB = fs.statSync(b);
    if (sA.size !== sB.size) return false;
    const bufA = fs.readFileSync(a);
    const bufB = fs.readFileSync(b);
    return bufA.equals(bufB);
  } catch {
    return false;
  }
}

/** Remove empty directories bottom-up. */
function pruneEmptyDirs(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      pruneEmptyDirs(path.join(dir, entry.name));
    }
  }
  try {
    if (fs.readdirSync(dir).length === 0) fs.rmdirSync(dir);
  } catch { /* ignore */ }
}

/** Print up to `max` items from a list, with overflow note. */
function printList(items, max) {
  const shown = items.slice(0, max);
  shown.forEach(f => console.log(`       ${f}`));
  if (items.length > max) {
    console.log(`       ... and ${items.length - max} more`);
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

console.log('⚡ AIOS Update v5.2 (Node.js / Windows edition)');
console.log('');

// Validate: clean working tree for .aios-core
const dirty = exec('git status --porcelain .aios-core/');
if (dirty) {
  console.log('❌ Commit .aios-core changes first:');
  console.log(exec('git status --short .aios-core/'));
  console.log('');
  console.log("Run: git add .aios-core && git commit -m 'your message'");
  process.exit(1);
}

// Temp directory – auto-cleaned on exit
const TEMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'aios-update-'));
const cleanup  = () => {
  try { fs.rmSync(TEMP_DIR, { recursive: true, force: true }); } catch { /* ignore */ }
};
process.on('exit', cleanup);
['SIGINT', 'SIGTERM'].forEach(sig => process.on(sig, () => process.exit(1)));

// ─── Clone upstream ─────────────────────────────────────────────────────────

console.log('📥 Cloning upstream (sparse, shallow)...');

const UPSTREAM_DIR       = path.join(TEMP_DIR, 'upstream');
// Upstream repo uses .aiox-core, local project uses .aios-core
const UPSTREAM_AIOX_CORE = path.join(UPSTREAM_DIR, '.aiox-core');

fs.mkdirSync(UPSTREAM_DIR, { recursive: true });

try {
  exec(
    `git clone --depth 1 --filter=blob:none --sparse` +
    ` https://github.com/SynkraAI/aios-core.git "${UPSTREAM_DIR}"`
  );
} catch (err) {
  console.log('❌ Failed to clone upstream. Check your internet connection.');
  console.log(err.message);
  process.exit(1);
}

// Configure sparse-checkout to only fetch .aiox-core/ (upstream folder name)
exec(`git -C "${UPSTREAM_DIR}" sparse-checkout set .aiox-core`);

// Verify the directory materialised
if (!fs.existsSync(UPSTREAM_AIOX_CORE)) {
  try {
    exec(`git -C "${UPSTREAM_DIR}" read-tree -mu HEAD`);
  } catch { /* ignore */ }
}

if (!fs.existsSync(UPSTREAM_AIOX_CORE)) {
  console.log('❌ Upstream .aiox-core/ not found after clone.');
  console.log('   → Check: https://github.com/SynkraAI/aios-core');
  process.exit(1);
}

// Alias for the rest of the script (upstream content maps to local .aios-core)
const UPSTREAM_AIOS = UPSTREAM_AIOX_CORE;

console.log('✅ Fetched upstream');
console.log('');

// ─── Scan files ─────────────────────────────────────────────────────────────

console.log('📋 Scanning files...');

const PROJECT_ROOT = process.cwd();
const LOCAL_AIOS   = path.join(PROJECT_ROOT, '.aios-core');

const localFilesArr    = listFiles(LOCAL_AIOS);
const upstreamFilesArr = listFiles(UPSTREAM_AIOS);

const localSet    = new Set(localFilesArr);
const upstreamSet = new Set(upstreamFilesArr);

// Git-tracked files (for DELETE detection)
const trackedRaw   = exec('git ls-files .aios-core');
const trackedSet   = new Set(
  trackedRaw.split('\n').filter(Boolean).map(f => f.replace(/^\.aios-core\//, ''))
);

// ─── Classify ───────────────────────────────────────────────────────────────

console.log('🔍 Analyzing differences...');

const preserved = localFilesArr.filter(f => !upstreamSet.has(f));   // LOCAL only → KEEP
const created   = upstreamFilesArr.filter(f => !localSet.has(f));   // UPSTREAM only → CREATE
const inBoth    = localFilesArr.filter(f => upstreamSet.has(f));    // both → OVERWRITE

const preservedSet = new Set(preserved);
// DELETE: was git-tracked + not in upstream + not local-only
const deleted = [...trackedSet].filter(f => !upstreamSet.has(f) && !preservedSet.has(f));

// UPDATED: in both but content differs
console.log('📝 Checking for updates...');
const updated = inBoth.filter(f =>
  !filesEqual(path.join(LOCAL_AIOS, f), path.join(UPSTREAM_AIOS, f))
);

// ─── Backup local-only files ─────────────────────────────────────────────────

console.log('🔐 Backing up local-only files...');
const BACKUP_DIR = path.join(TEMP_DIR, 'local-only');
for (const f of preserved) {
  copyFile(path.join(LOCAL_AIOS, f), path.join(BACKUP_DIR, f));
}

// ─── Apply sync ──────────────────────────────────────────────────────────────

console.log('');
console.log('🔀 Syncing...');

// 1. Delete files removed from upstream (only those that were tracked)
for (const f of deleted) {
  const target = path.join(LOCAL_AIOS, f);
  if (fs.existsSync(target)) fs.unlinkSync(target);
}

// 2. Copy all upstream files (overwrites existing + creates new)
for (const f of upstreamFilesArr) {
  copyFile(path.join(UPSTREAM_AIOS, f), path.join(LOCAL_AIOS, f));
}

// 3. Restore local-only files (ensure they survive the overwrite)
for (const f of preserved) {
  copyFile(path.join(BACKUP_DIR, f), path.join(LOCAL_AIOS, f));
}

// 4. Prune empty directories
pruneEmptyDirs(LOCAL_AIOS);

// ─── Report ──────────────────────────────────────────────────────────────────

const totalChanges = created.length + updated.length + deleted.length;

console.log('');
console.log('════════════════════════════════════════════════════════════');
console.log('  SYNC REPORT');
console.log('════════════════════════════════════════════════════════════');

console.log(`\n  ➕ CREATED:   ${created.length} files`);
if (created.length > 0) printList(created, 20);

console.log(`\n  📝 UPDATED:   ${updated.length} files`);
if (updated.length > 0) printList(updated, 20);

console.log(`\n  🗑️  DELETED:   ${deleted.length} files`);
if (deleted.length > 0) printList(deleted, 20);

console.log(`\n  🔐 PRESERVED: ${preserved.length} local-only files`);
if (preserved.length > 0) printList(preserved, 10);

console.log('');
console.log('════════════════════════════════════════════════════════════');
console.log('');

if (totalChanges === 0) {
  console.log('✅ Framework is already up to date — no changes needed.');
  console.log('');
  process.exit(0);
} else {
  console.log('Choose:');
  console.log("  ✅ Apply:  git add .aios-core && git commit -m 'chore: sync AIOS framework'");
  console.log("  ❌ Cancel: git checkout -- .aios-core/");
  console.log('');
  // Exit code 2 = changes are available (for scripted callers)
  process.exit(2);
}

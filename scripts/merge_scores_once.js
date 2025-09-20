#!/usr/bin/env node

/**
 * One-off script to merge data/scores-old.json into data/all-scores.json
 * - Dedupe by id/game_id
 * - Prefer existing entries in all-scores.json when duplicates found
 * - Stable sort by commence_time/scheduled_time/last_update
 * - Writes a timestamped backup of existing all-scores.json
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const ALL_SCORES = path.join(DATA_DIR, 'all-scores.json');
const OLD_SCORES = path.join(DATA_DIR, 'scores-old.json');

function readArray(filePath, label) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    const arr = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.games) ? parsed.games : []);
    console.log(`✓ Loaded ${arr.length} from ${label}`);
    return arr;
  } catch (e) {
    console.log(`⚠️  Could not read ${label}: ${e.message}`);
    return [];
  }
}

function getId(it) {
  return it?.id || it?.game_id || null;
}

function main() {
  console.log('Merging scores-old.json into all-scores.json (one-off)...');

  if (!fs.existsSync(OLD_SCORES)) {
    console.error('❌ data/scores-old.json not found. Aborting.');
    process.exit(1);
  }

  const baseline = fs.existsSync(ALL_SCORES) ? readArray(ALL_SCORES, 'all-scores.json') : [];
  const oldArr = readArray(OLD_SCORES, 'scores-old.json');

  // Build map from existing
  const map = new Map();
  for (const it of baseline) {
    const id = getId(it);
    if (!id) continue;
    map.set(id, it);
  }

  let added = 0;
  for (const it of oldArr) {
    const id = getId(it);
    if (!id) continue;
    if (!map.has(id)) {
      map.set(id, it);
      added++;
    }
  }

  const merged = Array.from(map.values());

  // Sort for stability
  merged.sort((a, b) => {
    const ad = new Date(a.commence_time || a.scheduled_time || a.last_update || 0).getTime();
    const bd = new Date(b.commence_time || b.scheduled_time || b.last_update || 0).getTime();
    return ad - bd;
  });

  // Backup existing all-scores.json
  if (fs.existsSync(ALL_SCORES)) {
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(DATA_DIR, `all-scores.backup-${ts}.json`);
    try {
      fs.copyFileSync(ALL_SCORES, backupPath);
      console.log(`🗄️  Backup written: ${path.basename(backupPath)}`);
    } catch (e) {
      console.log(`⚠️  Failed to write backup: ${e.message}`);
    }
  }

  // Write merged output
  fs.writeFileSync(ALL_SCORES, JSON.stringify(merged, null, 2));
  console.log(`✅ all-scores.json updated: ${baseline.length} → ${merged.length} (added ${added})`);
}

if (require.main === module) {
  main();
}

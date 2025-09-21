#!/usr/bin/env node

/**
 * Build script to generate a dynamic game manifest
 * Scans the data directory for game files and creates manifest.json
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = './data';
const MANIFEST_FILE = './data/manifest.json';
const ALL_SCORES_FILE = './data/all-scores.json';
const MY_EVENTS_FILE = './data/my_events.json';
const EVENTS_FILE = './data/events.json';

/**
 * Attempt to clean common escaped characters introduced by copy-paste
 * Examples to fix: \[, \], \_, \@, \~, \& (both in and out of strings)
 * Returns { parsed, cleanedContent, wasCleaned }
 */
function tryParseWithCleaning(filePath, rawContent) {
    // First try normal parse
    try {
        const obj = JSON.parse(rawContent);
        // If it parsed fine, still check if we should clean known artifacts
        const needsCleanup = /\\+[\[\]_@~&\(\)]/.test(rawContent) || /\\(?!["\\\/bfnrtu])/g.test(rawContent);
        if (needsCleanup) {
            // Pass 1: remove escapes before known symbols we observed from copy/paste
            let cleaned = rawContent.replace(/\\+([\[\]_@~&\(\)])/g, '$1');
            // Pass 2: remove stray backslashes that are not valid JSON escapes
            cleaned = cleaned.replace(/\\(?!["\\\/bfnrtu])/g, '');
            try {
                const parsed = JSON.parse(cleaned);
                return { parsed, cleanedContent: cleaned, wasCleaned: true };
            } catch {
                // If cleaning broke it, fall back to original parsed object
                return { parsed: obj, cleanedContent: null, wasCleaned: false };
            }
        }
        return { parsed: obj, cleanedContent: null, wasCleaned: false };
    } catch (e) {
        // Try cleaning and re-parse
    let cleaned = rawContent.replace(/\\+([\[\]_@~&\(\)])/g, '$1');
        cleaned = cleaned.replace(/\\(?!["\\\/bfnrtu])/g, '');
        try {
            const parsed = JSON.parse(cleaned);
            return { parsed, cleanedContent: cleaned, wasCleaned: true };
        } catch (e2) {
            // As a last resort, also strip zero-width and non-breaking spaces
            const cleaned2 = cleaned.replace(/[\u200B-\u200D\uFEFF\u00A0]/g, '');
            try {
                const parsed = JSON.parse(cleaned2);
                return { parsed, cleanedContent: cleaned2, wasCleaned: true };
            } catch (e3) {
                // Ultra last resort: strip ALL backslashes and try once more
                try {
                    const cleaned3 = rawContent.replace(/\\/g, '');
                    const parsed = JSON.parse(cleaned3);
                    return { parsed, cleanedContent: cleaned3, wasCleaned: true };
                } catch (e4) {
                    throw e; // rethrow original error for logging
                }
            }
        }
    }
}

function buildManifest() {
    console.log('Building dynamic game manifest...');
    
    try {
        // Recursively find all game files under data/ (includes data/historic/**)
        const gameFiles = (() => {
            const results = [];
            const walk = (relDir) => {
                const absDir = path.join(DATA_DIR, relDir);
                let entries = [];
                try {
                    entries = fs.readdirSync(absDir, { withFileTypes: true });
                } catch (e) {
                    return;
                }
                for (const ent of entries) {
                    const relPath = relDir ? path.join(relDir, ent.name) : ent.name;
                    // Skip deep-archive content entirely
                    if (!relDir && ent.isDirectory() && ent.name === 'deep-archive') {
                        continue;
                    }
                    if (relPath.startsWith('deep-archive/')) {
                        continue;
                    }
                    if (ent.isDirectory()) {
                        walk(relPath);
                    } else if (ent.isFile() && ent.name.startsWith('game-') && ent.name.endsWith('.json')) {
                        results.push(relPath); // store path relative to DATA_DIR
                    }
                }
            };
            walk('');
            return results;
        })();
        
        console.log(`Found ${gameFiles.length} game files:`);
        gameFiles.forEach(file => console.log(`  - ${file}`));
        
        // Also read scores.json to find all games
        let scoresData = null;
        try {
            const scoresContent = fs.readFileSync(path.join(DATA_DIR, 'scores.json'), 'utf8');
            scoresData = JSON.parse(scoresContent);
            const count = Array.isArray(scoresData) ? scoresData.length : (scoresData.games?.length || 0);
            console.log(`Found scores.json with ${count} games`);
        } catch (error) {
            console.log(`Warning: Could not read scores.json - ${error.message}`);
        }

        // Helper: normalize an item to ensure it has an id
        const getId = (item) => item?.id || item?.game_id;
        const mergeScoresArrays = (baseline, incoming) => {
            const resultMap = new Map();
            const arr = Array.isArray(baseline) ? baseline : [];
            const inc = Array.isArray(incoming) ? incoming : [];

            // Seed baseline
            for (const it of arr) {
                const id = getId(it);
                if (!id) continue;
                resultMap.set(id, it);
            }
            // Merge incoming with precedence rules: prefer newer last_update or completed=true
            for (const it of inc) {
                const id = getId(it);
                if (!id) continue;
                const existing = resultMap.get(id);
                if (!existing) {
                    resultMap.set(id, it);
                } else {
                    const exLU = existing.last_update ? new Date(existing.last_update).getTime() : 0;
                    const inLU = it.last_update ? new Date(it.last_update).getTime() : 0;
                    const exCompleted = existing.completed === true || existing.final === true || existing.status === 'final';
                    const inCompleted = it.completed === true || it.final === true || it.status === 'final';
                    // Replace if incoming is newer or marks completion
                    if (inLU > exLU || (inCompleted && !exCompleted)) {
                        resultMap.set(id, it);
                    } else {
                        // Otherwise, shallow merge to keep best of both
                        resultMap.set(id, { ...existing, ...it });
                    }
                }
            }
            return Array.from(resultMap.values());
        };
        
        // Validate each game file has proper structure
        const validGameFiles = [];
        const gameIdSet = new Set(); // Track game IDs to avoid duplicates
        
        for (const filename of gameFiles) {
            try {
                const filePath = path.join(DATA_DIR, filename);
                const content = fs.readFileSync(filePath, 'utf8');
                const { parsed: data, cleanedContent, wasCleaned } = tryParseWithCleaning(filePath, content);
                if (wasCleaned && cleanedContent) {
                    // Persist cleaned JSON with pretty formatting
                    try {
                        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
                        console.log(`  ✨ Cleaned escapes in: ${filename}`);
                    } catch (werr) {
                        console.log(`  ⚠️ Failed to write cleaned file for ${filename}: ${werr.message}`);
                    }
                }
                
                // Check if it has required game structure
                if (data.game_meta && data.game_meta.game_id) {
                    const gameEntry = {
                        filename: filename,
                        game_id: data.game_meta.game_id,
                        title: data.game_meta.title,
                        datetime: data.game_meta.datetime_local,
                        has_detailed_data: true
                    };
                    validGameFiles.push(gameEntry);
                    gameIdSet.add(data.game_meta.game_id);
                    console.log(`  ✓ Valid: ${filename} (${data.game_meta.game_id})`);
                } else {
                    console.log(`  ✗ Invalid: ${filename} - missing game_meta or game_id`);
                }
            } catch (error) {
                console.log(`  ✗ Error reading ${filename}: ${error.message}`);
            }
        }
        
        // Add games from scores.json that don't have individual files
        const scoreGames = Array.isArray(scoresData) ? scoresData : (scoresData && Array.isArray(scoresData.games) ? scoresData.games : null);
        if (scoreGames) {
            console.log('\nChecking for additional games in scores.json...');
            
            // Create a more flexible matching system
            const existingGameTitles = new Set();
            const existingGameDates = new Set();
            
            // Build sets of existing game info for better matching
            for (const gameEntry of validGameFiles) {
                if (gameEntry.title) {
                    existingGameTitles.add(gameEntry.title.toLowerCase());
                }
                if (gameEntry.datetime) {
                    existingGameDates.add(gameEntry.datetime.split('T')[0]); // Just the date part
                }
            }
            
            for (const scoreGame of scoreGames) {
                // Check if this game matches an existing game by ID first
                const scoreId = scoreGame.id || scoreGame.game_id;
                let matchingGameIndex = validGameFiles.findIndex(g => g.game_id === scoreId);
                
                if (matchingGameIndex === -1) {
                    // If no ID match, check for team name matches
                    const awayTeamName = (scoreGame.away_team?.name || scoreGame.away_team || 'Away Team').toLowerCase();
                    const homeTeamName = (scoreGame.home_team?.name || scoreGame.home_team || 'Home Team').toLowerCase();
                    
                    matchingGameIndex = validGameFiles.findIndex(gameFile => {
                        const existingTitle = gameFile.title.toLowerCase();
                        const awayWord = awayTeamName.split(' ')[0];
                        const homeWord = homeTeamName.split(' ')[0];
                        return existingTitle.includes(awayWord) && existingTitle.includes(homeWord);
                    });
                    
                    if (matchingGameIndex >= 0) {
                        // Update the game ID to match scores.json (authoritative source)
                        const oldId = validGameFiles[matchingGameIndex].game_id;
                        validGameFiles[matchingGameIndex].game_id = scoreId;
                        
                        // Update the gameIdSet
                        gameIdSet.delete(oldId);
                        gameIdSet.add(scoreId);
                        
                        console.log(`  ✓ Updated ID: ${oldId} -> ${scoreId}`);
                    } else {
                        // Add new game that only exists in scores
                        const gameEntry = {
                            filename: null,
                            game_id: scoreId,
                            title: `${scoreGame.away_team?.name || scoreGame.away_team} at ${scoreGame.home_team?.name || scoreGame.home_team}`,
                            datetime: scoreGame.commence_time || scoreGame.scheduled_time,
                            has_detailed_data: false,
                            score_only: true
                        };
                        validGameFiles.push(gameEntry);
                        gameIdSet.add(scoreId);
                        console.log(`  + Added from scores: ${scoreId}`);
                    }
                } else {
                    console.log(`  ✓ ID match found: ${scoreId}`);
                }
            }
        }
        
        // Try to enrich manifest using my_events.json matched to events.json
        try {
            if (fs.existsSync(MY_EVENTS_FILE) && fs.existsSync(EVENTS_FILE)) {
                const myEvents = JSON.parse(fs.readFileSync(MY_EVENTS_FILE, 'utf8'));
                const allEvents = JSON.parse(fs.readFileSync(EVENTS_FILE, 'utf8'));

                const norm = (s) => (s || '')
                    .toString()
                    .toLowerCase()
                    .replace(/\(.*?\)/g, '')
                    .replace(/[^a-z0-9]+/g, '-')
                    .replace(/-+/g, '-')
                    .replace(/^-|-$|\s+/g, '')
                    .trim();
                const sameTeam = (a, b) => norm(a) === norm(b);

                const dateOnly = (iso) => {
                    try { return new Date(iso).toISOString().split('T')[0]; } catch { return ''; }
                };

                const existingIds = new Set(validGameFiles.map(g => g.game_id));
                let addedFromMyEvents = 0;

                myEvents.forEach(ev => {
                    const d = (ev.date || '').trim();
                    const t1 = (ev.team1 || '').trim();
                    const t2 = (ev.team2 || '').trim();
                    if (!d || !t1 || !t2) return;

                    // Candidate events same date
                    const candidates = allEvents.filter(e => dateOnly(e.commence_time) === d);
                    // Match either order
                    const match = candidates.find(e => (
                        (sameTeam(e.home_team, t1) && sameTeam(e.away_team, t2)) ||
                        (sameTeam(e.home_team, t2) && sameTeam(e.away_team, t1))
                    ));

                    if (!match) {
                        // Not found; try fuzzy contains on first word
                        const fw = (s) => (s || '').split(/\s+/)[0].toLowerCase();
                        const fmatch = candidates.find(e => {
                            const setEv = new Set([fw(t1), fw(t2)]);
                            const setEv2 = new Set([fw(e.home_team), fw(e.away_team)]);
                            const inter = [...setEv].filter(x => setEv2.has(x));
                            return inter.length >= 2;
                        });
                        if (fmatch) {
                            // Use fuzzy match
                            if (!existingIds.has(fmatch.id)) {
                                validGameFiles.push({
                                    filename: null,
                                    game_id: fmatch.id,
                                    title: `${fmatch.away_team} at ${fmatch.home_team}`,
                                    datetime: fmatch.commence_time,
                                    has_detailed_data: false,
                                    score_only: true
                                });
                                existingIds.add(fmatch.id);
                                addedFromMyEvents++;
                            }
                        }
                        return;
                    }

                    if (!existingIds.has(match.id)) {
                        validGameFiles.push({
                            filename: null,
                            game_id: match.id,
                            title: `${match.away_team} at ${match.home_team}`,
                            datetime: match.commence_time,
                            has_detailed_data: false,
                            score_only: true
                        });
                        existingIds.add(match.id);
                        addedFromMyEvents++;
                    }
                });

                if (addedFromMyEvents > 0) {
                    console.log(`\n📌 Added ${addedFromMyEvents} matches from my_events.json via events.json`);
                } else {
                    console.log(`\n📌 No additional my_events matches found (already present or unmatched)`);
                }

            }
        } catch (e) {
            console.log(`⚠️ my_events/events enrichment skipped: ${e.message}`);
        }

        // Create manifest object
        const manifest = {
            generated_at: new Date().toISOString(),
            game_count: validGameFiles.length,
            games_with_detailed_data: validGameFiles.filter(g => g.has_detailed_data).length,
            games_score_only: validGameFiles.filter(g => g.score_only).length,
            games: validGameFiles
        };
        
        // Write manifest file
        fs.writeFileSync(MANIFEST_FILE, JSON.stringify(manifest, null, 2));
        
        // Generate initial scores.json if it doesn't exist or if we want to reset it
        const scoresFile = path.join(DATA_DIR, 'scores.json');
        if (!fs.existsSync(scoresFile)) {
            console.log('\n📊 Creating initial scores.json...');
            const initialScores = {
                last_updated: new Date().toISOString(),
                games: validGameFiles.map(gameEntry => {
                    // Parse team names from title
                    const titleParts = gameEntry.title.split(' at ');
                    const awayTeam = titleParts[0] || 'Away Team';
                    const homeTeam = titleParts[1] || 'Home Team';
                    
                    return {
                        game_id: gameEntry.game_id,
                        status: 'upcoming',
                        scheduled_time: gameEntry.datetime,
                        home_team: {
                            name: homeTeam,
                            short: homeTeam.split(' ')[0].toUpperCase(),
                            score: 0
                        },
                        away_team: {
                            name: awayTeam,
                            short: awayTeam.split(' ')[0].toUpperCase(),
                            score: 0
                        },
                        quarter: null,
                        time_remaining: null,
                        possession: null,
                        final: false
                    };
                })
            };
            
            fs.writeFileSync(scoresFile, JSON.stringify(initialScores, null, 2));
            console.log(`✅ Initial scores.json created with ${initialScores.games.length} games`);
        } else {
            console.log('📊 scores.json already exists - not overwriting');
        }
        
        // Skipping automatic all-scores.json maintenance per request

        // Maintain all-scores.json by ingesting scores.json (no other fallbacks)
        try {
            const mergeScoresArrays = (baseline, incoming) => {
                const resultMap = new Map();
                const arr = Array.isArray(baseline) ? baseline : [];
                const inc = Array.isArray(incoming) ? incoming : [];
                const getId = (it) => it?.id || it?.game_id;

                for (const it of arr) {
                    const id = getId(it);
                    if (!id) continue;
                    resultMap.set(id, it);
                }
                for (const it of inc) {
                    const id = getId(it);
                    if (!id) continue;
                    const existing = resultMap.get(id);
                    if (!existing) {
                        resultMap.set(id, it);
                    } else {
                        const exLU = existing.last_update ? new Date(existing.last_update).getTime() : 0;
                        const inLU = it.last_update ? new Date(it.last_update).getTime() : 0;
                        const exCompleted = existing.completed === true || existing.final === true || existing.status === 'final';
                        const inCompleted = it.completed === true || it.final === true || it.status === 'final';
                        if (inLU > exLU || (inCompleted && !exCompleted)) {
                            resultMap.set(id, it);
                        } else {
                            resultMap.set(id, { ...existing, ...it });
                        }
                    }
                }
                return Array.from(resultMap.values());
            };

            let allScores = [];
            if (fs.existsSync(ALL_SCORES_FILE)) {
                try {
                    const raw = fs.readFileSync(ALL_SCORES_FILE, 'utf8');
                    const parsed = JSON.parse(raw);
                    allScores = Array.isArray(parsed) ? parsed : [];
                } catch (e) {
                    console.log(`⚠️ Could not parse existing all-scores.json: ${e.message}`);
                }
            }

            const incomingScores = Array.isArray(scoresData) ? scoresData : (scoresData && Array.isArray(scoresData.games) ? scoresData.games : []);
            const before = allScores.length;
            allScores = mergeScoresArrays(allScores, incomingScores);
            allScores.sort((a, b) => {
                const ad = new Date(a.commence_time || a.scheduled_time || a.last_update || 0).getTime();
                const bd = new Date(b.commence_time || b.scheduled_time || b.last_update || 0).getTime();
                return ad - bd;
            });
            fs.writeFileSync(ALL_SCORES_FILE, JSON.stringify(allScores, null, 2));
            const after = allScores.length;
            console.log(`🗃 Ingested scores into all-scores.json: ${before} → ${after}`);
        } catch (e) {
            console.log(`⚠️ Failed to update all-scores.json: ${e.message}`);
        }

        console.log(`\n✅ Generated manifest with ${validGameFiles.length} valid games`);
        console.log(`📄 Manifest saved to: ${MANIFEST_FILE}`);
        
        return true;
        
    } catch (error) {
        console.error('❌ Error building manifest:', error.message);
        return false;
    }
}

// Run if called directly
if (require.main === module) {
    const success = buildManifest();
    process.exit(success ? 0 : 1);
}

module.exports = { buildManifest };
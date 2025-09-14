#!/usr/bin/env node

/**
 * Build script to generate a dynamic game manifest
 * Scans the data directory for game files and creates manifest.json
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = './data';
const MANIFEST_FILE = './data/manifest.json';

function buildManifest() {
    console.log('Building dynamic game manifest...');
    
    try {
        // Read the data directory
        const files = fs.readdirSync(DATA_DIR);
        
        // Filter for game files (those starting with 'game-' and ending with '.json')
        const gameFiles = files.filter(file => 
            file.startsWith('game-') && 
            file.endsWith('.json')
        );
        
        console.log(`Found ${gameFiles.length} game files:`);
        gameFiles.forEach(file => console.log(`  - ${file}`));
        
        // Also read scores.json to find all games
        let scoresData = null;
        try {
            const scoresContent = fs.readFileSync(path.join(DATA_DIR, 'scores.json'), 'utf8');
            scoresData = JSON.parse(scoresContent);
            console.log(`Found scores.json with ${scoresData.games?.length || 0} games`);
        } catch (error) {
            console.log(`Warning: Could not read scores.json - ${error.message}`);
        }
        
        // Validate each game file has proper structure
        const validGameFiles = [];
        const gameIdSet = new Set(); // Track game IDs to avoid duplicates
        
        for (const filename of gameFiles) {
            try {
                const filePath = path.join(DATA_DIR, filename);
                const content = fs.readFileSync(filePath, 'utf8');
                const data = JSON.parse(content);
                
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
        if (scoresData && scoresData.games) {
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
            
            for (const scoreGame of scoresData.games) {
                // Check if this game matches an existing game by ID first
                let matchingGameIndex = validGameFiles.findIndex(g => g.game_id === scoreGame.game_id);
                
                if (matchingGameIndex === -1) {
                    // If no ID match, check for team name matches
                    const awayTeam = scoreGame.away_team.name.toLowerCase();
                    const homeTeam = scoreGame.home_team.name.toLowerCase();
                    
                    matchingGameIndex = validGameFiles.findIndex(gameFile => {
                        const existingTitle = gameFile.title.toLowerCase();
                        const awayWord = awayTeam.split(' ')[0];
                        const homeWord = homeTeam.split(' ')[0];
                        return existingTitle.includes(awayWord) && existingTitle.includes(homeWord);
                    });
                    
                    if (matchingGameIndex >= 0) {
                        // Update the game ID to match scores.json (authoritative source)
                        const oldId = validGameFiles[matchingGameIndex].game_id;
                        validGameFiles[matchingGameIndex].game_id = scoreGame.game_id;
                        
                        // Update the gameIdSet
                        gameIdSet.delete(oldId);
                        gameIdSet.add(scoreGame.game_id);
                        
                        console.log(`  ✓ Updated ID: ${oldId} -> ${scoreGame.game_id}`);
                    } else {
                        // Add new game that only exists in scores
                        const gameEntry = {
                            filename: null,
                            game_id: scoreGame.game_id,
                            title: `${scoreGame.away_team.name} at ${scoreGame.home_team.name}`,
                            datetime: scoreGame.scheduled_time,
                            has_detailed_data: false,
                            score_only: true
                        };
                        validGameFiles.push(gameEntry);
                        gameIdSet.add(scoreGame.game_id);
                        console.log(`  + Added from scores: ${scoreGame.game_id}`);
                    }
                } else {
                    console.log(`  ✓ ID match found: ${scoreGame.game_id}`);
                }
            }
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
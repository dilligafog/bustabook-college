// BustaBook College Picks - Utility Functions
// Auto-discovery and utilities for college football betting picks

/**
 * Date and Time Utilities
 */
const DateUtils = {
    /**
     * Format a date string to local time display
     * @param {string} dateString - ISO date string
     * @returns {object} Formatted date/time components
     */
    formatGameTime(dateString) {
        try {
            const date = new Date(dateString);
            return {
                date: date.toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    month: 'long', 
                    day: 'numeric' 
                }),
                time: date.toLocaleTimeString('en-US', { 
                    hour: 'numeric', 
                    minute: '2-digit',
                    timeZoneName: 'short'
                }),
                datetime: date.toLocaleString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit'
                }),
                sortDate: date
            };
        } catch (error) {
            console.warn('Error formatting date:', dateString, error);
            const fallbackDate = new Date();
            return {
                date: 'Date TBD',
                time: 'Time TBD',
                datetime: 'TBD',
                sortDate: fallbackDate
            };
        }
    },

    /**
     * Get date key for grouping games by day
     * @param {string} dateString - ISO date string
     * @returns {string} Date key for grouping
     */
    getDateKey(dateString) {
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('en-US', { 
                year: 'numeric',
                month: 'long', 
                day: 'numeric' 
            });
        } catch (error) {
            return 'Unknown Date';
        }
    },

    /**
     * Check if game is in progress, upcoming, or completed
     * @param {string} gameDate - Game date string
     * @param {object} scoreData - Score data from scores.json
     * @returns {string} Game status: 'in-progress', 'upcoming', 'completed'
     */
    getGameStatus(gameDate, scoreData = null) {
        // Only use score data to determine status - no time-based assumptions
        if (scoreData) {
            if (scoreData.status === 'final' || scoreData.final === true) {
                return 'completed';
            } else if (scoreData.status === 'in_progress') {
                return 'in_progress';
            }
        }

        // If no score data available, default to upcoming
        return 'upcoming';
    }
};

/**
 * Data Loading and Management Utilities
 */
const DataUtils = {
    /**
     * Load JSON from a URL with error handling
     * @param {string} url - URL to fetch
     * @returns {Promise<object|null>} Parsed JSON or null
     */
    async loadJSON(url) {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return await response.json();
        } catch (error) {
            console.warn(`Failed to load JSON from ${url}:`, error);
            return null;
        }
    },

    /**
     * Discover all available games from the dynamic manifest
     * @returns {Promise<Array>} Array of game entries with metadata
     */
    async discoverGameFiles() {
        console.log('Loading games from dynamic manifest...');
        
        try {
            // Load the dynamically generated manifest
            const manifest = await this.loadJSON('data/manifest.json');
            
            if (!manifest || !manifest.games || !Array.isArray(manifest.games)) {
                throw new Error('Invalid or missing manifest.json. Run build-manifest.js to generate it.');
            }
            
            console.log(`Manifest generated at: ${manifest.generated_at}`);
            console.log(`Found ${manifest.game_count} total games in manifest`);
            console.log(`  - ${manifest.games_with_detailed_data || 0} with detailed data`);
            console.log(`  - ${manifest.games_score_only || 0} score-only games`);
            
            // Return full game entries instead of just filenames
            return manifest.games;
            
        } catch (error) {
            console.error('Failed to load manifest:', error);
            console.log('Falling back to scanning approach...');
            
            // Fallback to scanning if manifest doesn't exist
            const gameFiles = await this.fallbackScanForGameFiles();
            // Convert filenames to basic game entries for backward compatibility
            return gameFiles.map(filename => ({
                filename: filename,
                game_id: filename.replace('game-', '').replace('.json', ''),
                has_detailed_data: true,
                score_only: false
            }));
        }
    },

    /**
     * Fallback scanning method when manifest is not available
     * @returns {Promise<Array<string>>} Array of potential game filenames
     */
    async fallbackScanForGameFiles() {
        console.log('Using fallback scanning for game files...');
        const potentialFiles = [];
        
        // Simple patterns for fallback
        for (let i = 1; i <= 50; i++) {
            potentialFiles.push(`game-${i}.json`);
            potentialFiles.push(`game-${String(i).padStart(3, '0')}.json`);
        }
        
        // Try with today's date
        const today = new Date();
        const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        
        for (let i = 1; i <= 20; i++) {
            potentialFiles.push(`game-${i}-${dateStr}.json`);
        }
        
        // Validate each file
        const validFiles = [];
        for (const filename of potentialFiles.slice(0, 100)) { // Limit to prevent too many requests
            try {
                const data = await this.loadJSON(`data/${filename}`);
                if (data && data.game_meta && data.game_meta.game_id) {
                    validFiles.push(filename);
                }
            } catch (error) {
                continue;
            }
        }
        
        console.log(`Fallback scan found ${validFiles.length} valid files`);
        return validFiles;
    },

    /**
     * Load live scores from scores.json
     * @returns {Promise<object>} Scores data indexed by game_id
     */
    async loadScores() {
        const scoresData = await this.loadJSON('data/scores.json');
        if (!scoresData || !scoresData.games) {
            return {};
        }

        // Convert array to object indexed by game_id for easy lookup
        const scoresMap = {};
        scoresData.games.forEach(game => {
            scoresMap[game.game_id] = {
                // Keep the original structure that evaluateBestBet expects
                home_team: {
                    short: game.home_team.short,
                    name: game.home_team.name,
                    score: game.home_team.score
                },
                away_team: {
                    short: game.away_team.short,
                    name: game.away_team.name,
                    score: game.away_team.score
                },
                quarter: game.quarter,
                time_remaining: game.time_remaining,
                status: game.status,
                final: game.final || game.status === 'final'
            };
        });

        return scoresMap;
    },

    /**
     * Parse team names from game title
     * @param {string} title - Game title like "Wisconsin at Alabama"
     * @returns {object} Object with awayTeam and homeTeam
     */
    parseTeamNames(title) {
        if (!title) {
            return { awayTeam: 'Away Team', homeTeam: 'Home Team' };
        }

        // Split on common separators: "at", "vs", "@"
        const parts = title.split(/\s+(?:at|vs|@)\s+/i);
        
        if (parts.length >= 2) {
            return {
                awayTeam: parts[0].trim(),
                homeTeam: parts[1].trim()
            };
        }

        // Fallback if parsing fails
        return { awayTeam: title, homeTeam: 'vs TBD' };
    }
};

/**
 * UI Utilities for displaying content
 */
const UIUtils = {
    /**
     * Show loading state
     */
    showLoading() {
        const loadingEl = document.getElementById('loading-container');
        if (loadingEl) {
            loadingEl.style.display = 'block';
        }
    },

    /**
     * Hide loading state
     */
    hideLoading() {
        const loadingEl = document.getElementById('loading-container');
        if (loadingEl) {
            loadingEl.style.display = 'none';
        }
    },

    /**
     * Show error message
     * @param {string} message - Error message to display
     */
    showError(message) {
        const errorEl = document.getElementById('error-container');
        if (errorEl) {
            errorEl.textContent = message;
            errorEl.style.display = 'block';
        } else {
            // Fallback to alert if no error container
            alert(`Error: ${message}`);
        }
    },

    /**
     * Clear error message
     */
    clearError() {
        const errorEl = document.getElementById('error-container');
        if (errorEl) {
            errorEl.style.display = 'none';
        }
    }
};

// Export utilities to global scope for use in other scripts
window.DateUtils = DateUtils;
window.DataUtils = DataUtils;
window.UIUtils = UIUtils;

console.log('BustaBook utilities loaded successfully');
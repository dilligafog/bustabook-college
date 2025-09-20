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
     * @param {object} scoreData - Normalized score data (from DataUtils.loadScores)
     * @returns {string} Game status: 'in_progress', 'upcoming', 'completed'
     */
    getGameStatus(gameDate, scoreData = null) {
        // Prefer score data when available
        if (scoreData) {
            if (scoreData.completed === true || scoreData.status === 'final' || scoreData.final === true) {
                return 'completed';
            }
            if (scoreData.in_progress === true || scoreData.status === 'in_progress' || (scoreData.last_update && scoreData.completed === false)) {
                return 'in_progress';
            }
        }

        // Fallback to time-based heuristic when no score info
        try {
            const now = new Date();
            const d = new Date(gameDate);
            if (isNaN(d.getTime())) return 'upcoming';
            if (d.toDateString() === now.toDateString()) return 'upcoming';
            return d < now ? 'completed' : 'upcoming';
        } catch {
            return 'upcoming';
        }
    }
};

/**
 * Data Loading and Management Utilities
 */
const DataUtils = {
    // Static list of Ohio teams (normalized keys). Used for conditional UI (e.g., buckeye emoji)
    OHIO_TEAM_KEYS: [
        'ohio state buckeyes', 'ohio state', 'ohio st buckeyes', 'ohio st',
        'cincinnati bearcats', 'cincinnati',
        'toledo rockets', 'toledo',
        'bowling green falcons', 'bowling green',
        'kent state golden flashes', 'kent state', 'kent st golden flashes', 'kent st',
        'miami redhawks', 'miami oh redhawks', 'miami ohio redhawks', 'miami (oh) redhawks',
        'ohio bobcats', 'ohio',
        'akron zips', 'akron'
    ],

    normalizeTeamName(name) {
        try {
            return String(name || '')
                .toLowerCase()
                .replace(/[()]/g, ' ')
                .replace(/[^a-z0-9\s]/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
        } catch {
            return '';
        }
    },

    /**
     * Check if a given team name belongs to an Ohio team
     * @param {string} teamName
     * @returns {boolean}
     */
    isOhioTeam(teamName) {
        const norm = this.normalizeTeamName(teamName);
        if (!norm) return false;
        // Exact or partial match against keys
        return this.OHIO_TEAM_KEYS.some(key => {
            const k = this.normalizeTeamName(key);
            return norm.includes(k);
        });
    },
    /**
     * Load JSON from a URL with error handling
     * @param {string} url - URL to fetch
     * @returns {Promise<object|null>} Parsed JSON or null
     */
    async loadJSON(url) {
        try {
            const sep = url.includes('?') ? '&' : '?';
            const cacheBusted = `${url}${sep}_ts=${Date.now()}`;
            const response = await fetch(cacheBusted, { cache: 'no-store' });
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
     * Load live scores from scores.json (new API format: array of games)
     * Normalizes into a map keyed by game id with fields expected by the UI.
     * @returns {Promise<object>} Scores data indexed by game id
     */
    async loadScores() {
        const raw = await this.loadJSON('data/all-scores.json');
        if (!raw || !Array.isArray(raw)) {
            return {};
        }

        const coerceName = (val, def = '') => {
            if (val == null) return def;
            if (typeof val === 'string') return val;
            if (typeof val === 'object') {
                const n = val.name || val.team || val.short;
                if (typeof n === 'string') return n;
            }
            try { return String(val); } catch { return def; }
        };
        const shortify = (name) => {
            const s = coerceName(name, '');
            if (!s) return '';
            return s.replace(/\(.*?\)/g, '').trim().split(/\s+/)[0].toUpperCase();
        };

        const scoresMap = {};
        raw.forEach(item => {
            const id = item.id || item.game_id; // prefer new API id
            if (!id) return;

            let homeScore = null;
            let awayScore = null;

            // Source 1: explicit nested team objects (preferred for our all-scores.json)
            const rawHomeScore = item?.home_team?.score;
            const rawAwayScore = item?.away_team?.score;
            if (rawHomeScore !== undefined && rawHomeScore !== null) {
                const v = typeof rawHomeScore === 'number' ? rawHomeScore : parseInt(rawHomeScore);
                if (!isNaN(v)) homeScore = v;
            }
            if (rawAwayScore !== undefined && rawAwayScore !== null) {
                const v = typeof rawAwayScore === 'number' ? rawAwayScore : parseInt(rawAwayScore);
                if (!isNaN(v)) awayScore = v;
            }

            // Source 2: generic array style
            if ((homeScore === null || awayScore === null) && Array.isArray(item.scores)) {
                item.scores.forEach(s => {
                    const n = coerceName(s?.name || s?.team, '').toLowerCase();
                    const ht = coerceName(item.home_team, '').toLowerCase();
                    const at = coerceName(item.away_team, '').toLowerCase();
                    const val = typeof s?.score === 'number' ? s.score : parseInt(s?.score);
                    if (!isNaN(val)) {
                        if (homeScore === null && (n === 'home' || (ht && (n === ht || ht.includes(n) || n.includes('home'))))) {
                            homeScore = val;
                        } else if (awayScore === null && (n === 'away' || (at && (n === at || at.includes(n) || n.includes('away'))))) {
                            awayScore = val;
                        }
                    }
                });
            }

            const normalized = {
                home_team: {
                    short: shortify(item.home_team),
                    name: coerceName(item.home_team, 'Home'),
                    score: homeScore
                },
                away_team: {
                    short: shortify(item.away_team),
                    name: coerceName(item.away_team, 'Away'),
                    score: awayScore
                },
                quarter: item.quarter || null,
                time_remaining: item.time_remaining || null,
                // Derive a simple status compatible with existing UI logic
                status: (item.completed === true || item.final === true || item.status === 'final' || item.status === 'completed')
                    ? 'final'
                    : ((item.status === 'in_progress' || item.status === 'live' || item.last_update) ? 'in_progress' : 'scheduled'),
                final: item.completed === true || item.final === true || item.status === 'final',
                completed: item.completed === true || item.final === true || item.status === 'final',
                last_update: item.last_update || null,
                // Flat scores used by game detail live score
                home_score: homeScore,
                away_score: awayScore
            };

            scoresMap[id] = normalized;
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

/**
 * Theme Utilities - manage Dark Mode Betting Theme
 */
const ThemeUtils = {
    storageKey: 'bb_theme',
    darkClass: 'bb-dark',

    isDark() {
        try {
            return localStorage.getItem(this.storageKey) === 'dark';
        } catch (e) {
            return false;
        }
    },

    applyTheme(dark) {
        const el = document.documentElement || document.body;
        if (dark) {
            el.classList.add(this.darkClass);
        } else {
            el.classList.remove(this.darkClass);
        }
    },

    toggle() {
        const next = !this.isDark();
        try {
            localStorage.setItem(this.storageKey, next ? 'dark' : 'light');
        } catch (e) {
            // ignore
        }
        this.applyTheme(next);
    },

    init() {
        // Apply stored theme on load
        const dark = this.isDark();
        this.applyTheme(dark);

        // Wire up toggle buttons if present
        document.querySelectorAll('#theme-toggle').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.toggle();
                // Update button text to indicate current mode
                const nowDark = this.isDark();
                btn.textContent = nowDark ? 'Light Mode' : 'Dark Mode';
            });

            // Set initial button text
            btn.textContent = dark ? 'Light Mode' : 'Dark Mode';
        });
    }
};

// Initialize theme once DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => ThemeUtils.init());
} else {
    ThemeUtils.init();
}

// Expose ThemeUtils for debugging
window.ThemeUtils = ThemeUtils;
// BustaBook College Picks - Main Application Logic

class BustaBookApp {
    constructor() {
        this.games = [];
        this.scores = {};
        this.gamesContainer = null;
    }

    /**
     * Initialize the application
     */
    async init() {
        try {
            console.log('Initializing BustaBook College Picks...');
            
            // Wait for DOM to be ready
            await this.waitForDOM();
            
            // Set current date in navbar
            this.setCurrentDate();
            
            // Get DOM elements
            this.gamesContainer = document.getElementById('games-container');
            if (!this.gamesContainer) {
                throw new Error('Games container not found in DOM');
            }
            
            // Load data and render
            await this.loadAllData();
            this.renderGames();
            
            console.log('BustaBook app initialized successfully');
        } catch (error) {
            console.error('Failed to initialize app:', error);
            UIUtils.showError('Failed to load application. Please refresh the page.');
        }
    }

    /**
     * Set current date dynamically in the header
     */
    setCurrentDate() {
        const dateElement = document.getElementById('current-date');
        if (dateElement) {
            const today = new Date();
            const formattedDate = today.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            dateElement.textContent = formattedDate;
        }
    }

    /**
     * Wait for DOM to be ready
     */
    waitForDOM() {
        return new Promise((resolve) => {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', resolve);
            } else {
                resolve();
            }
        });
    }

    /**
     * Load all game data and scores
     */
    async loadAllData() {
        UIUtils.showLoading();
        UIUtils.clearError();

        try {
            // Load scores first (they might not exist, that's ok)
            console.log('Loading scores...');
            this.scores = await DataUtils.loadScores();
            
            // Discover and load all game files
            console.log('Discovering games from manifest...');
            const gameEntries = await DataUtils.discoverGameFiles();
            
            if (gameEntries.length === 0) {
                throw new Error('No games found in manifest');
            }

            console.log(`Loading ${gameEntries.length} games...`);
            this.games = [];
            
            // Load each game but only include those with detailed JSON files
            for (const gameEntry of gameEntries) {
                try {
                    if (gameEntry.filename && gameEntry.has_detailed_data) {
                        // Load from individual game file
                        const gameData = await DataUtils.loadJSON(`data/${gameEntry.filename}`);
                        if (gameData && gameData.game_meta) {
                            // Update the game_id to match the manifest (authoritative for score lookups)
                            gameData.game_meta.game_id = gameEntry.game_id;
                            this.games.push(gameData);
                            console.log(`Loaded detailed: ${gameData.game_meta.title} (ID: ${gameEntry.game_id})`);
                        }
                    } // Ignore score-only games on index per requirement
                } catch (error) {
                    console.warn(`Failed to load ${gameEntry.game_id}:`, error);
                }
            }

            console.log(`Successfully loaded ${this.games.length} games`);
            
        } catch (error) {
            console.error('Error loading data:', error);
            throw error;
        } finally {
            UIUtils.hideLoading();
        }
    }

    /**
     * Render all games organized by status and day
     */
    renderGames() {
        if (!this.gamesContainer) {
            console.error('Games container not available');
            return;
        }

        if (this.games.length === 0) {
            this.gamesContainer.innerHTML = '<div class="text-center text-gray-500 py-8">No games available</div>';
            return;
        }

        // Sort games by status priority and then by date
        const sortedGames = this.games.sort((a, b) => {
            const statusA = DateUtils.getGameStatus(a.game_meta.datetime_local, this.scores[a.game_meta.game_id]);
            const statusB = DateUtils.getGameStatus(b.game_meta.datetime_local, this.scores[b.game_meta.game_id]);
            
            // Priority order: in-progress, upcoming, completed
            const statusPriority = { 'in_progress': 0, 'upcoming': 1, 'completed': 2 };
            
            if (statusPriority[statusA] !== statusPriority[statusB]) {
                return statusPriority[statusA] - statusPriority[statusB];
            }
            
            // Within same status, sort by date
            const dateA = new Date(a.game_meta.datetime_local);
            const dateB = new Date(b.game_meta.datetime_local);
            return dateA - dateB;
        });

        // Group games by day
        const gamesByDay = this.groupGamesByDay(sortedGames);

        // Compute ordered day list: today first, then future (asc), then past (desc)
        const allDays = Object.keys(gamesByDay);
        const todayKey = DateUtils.getDateKey(new Date().toISOString());
        const todayDate = new Date(todayKey);

        const today = [];
        const future = [];
        const past = [];
        allDays.forEach(d => {
            if (d === todayKey) {
                today.push(d);
            } else {
                const dd = new Date(d);
                if (!isNaN(dd.getTime()) && dd > todayDate) future.push(d);
                else past.push(d);
            }
        });
        future.sort((a, b) => new Date(a) - new Date(b));
        past.sort((a, b) => new Date(b) - new Date(a));
        const orderedDays = [...today, ...future, ...past];

        // Render the grouped games
        this.gamesContainer.innerHTML = this.renderGamesByDay(gamesByDay, orderedDays);
    }

    /**
     * Group games by day while preserving status order
     */
    groupGamesByDay(games) {
        const grouped = {};
        
        games.forEach(game => {
            const dayKey = DateUtils.getDateKey(game.game_meta.datetime_local);
            if (!grouped[dayKey]) {
                grouped[dayKey] = [];
            }
            grouped[dayKey].push(game);
        });
        
        return grouped;
    }

    /**
     * Calculate daily record for a specific day's games
     */
    calculateDayRecord(dayGames) {
        let wins = 0;
        let losses = 0;
        let upcoming = 0;
        let inProgress = 0;
        
        dayGames.forEach(game => {
            // Get live score if available
            const gameScore = this.scores[game.game_meta.game_id] || null;
            const status = DateUtils.getGameStatus(game.game_meta.datetime_local, gameScore);
            
            if (status === 'completed') {
                // Game is final, check if our bet won
                const bestBet = game.picks?.best_bet;
                if (bestBet && gameScore) {
                    const result = this.evaluateBestBet(bestBet, gameScore);
                    if (result === 'won') {
                        wins++;
                    } else {
                        losses++;
                    }
                }
            } else if (status === 'in_progress') {
                inProgress++;
            } else {
                upcoming++;
            }
        });
        
        return { wins, losses, upcoming, inProgress };
    }

    /**
     * Render games organized by day with proper separation
     */
    renderGamesByDay(gamesByDay, orderedDays = null) {
        let html = '';
        const days = orderedDays || Object.keys(gamesByDay);
        
        days.forEach((day, index) => {
            const dayGames = gamesByDay[day];
            const record = this.calculateDayRecord(dayGames);
            
            // Add day header with record
            html += `
                <div class="day-section">
                    <div class="flex justify-between items-center mb-4 border-b-2 border-blue-500 pb-2">
                        <h2 class="text-2xl font-bold text-gray-800">
                            ${day}
                        </h2>
                        <div class="text-sm font-medium">
                            <span class="text-green-600">${record.wins} wins</span> 
                            <span class="text-red-600">${record.losses} losses</span> 
                            <span class="text-gray-500">${record.upcoming} upcoming</span> 
                            <span class="text-blue-600">${record.inProgress} in progress</span>
                        </div>
                    </div>
                    <div class="games-grid grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
            `;
            
            // Add games for this day
            gamesByDay[day].forEach(game => {
                html += this.renderGameCard(game);
            });
            
            html += `
                    </div>
                </div>
            `;
            
            // Add page break between days (except for the last day)
            if (index < days.length - 1) {
                html += '<hr class="my-8 border-t-2 border-gray-300">';
            }
        });
        
        return html;
    }

    /**
     * Render an individual game card
     */
    renderGameCard(game) {
    const { awayTeam, homeTeam } = DataUtils.parseTeamNames(game.game_meta.title);
    const isOhioGame = DataUtils.isOhioTeam(awayTeam) || DataUtils.isOhioTeam(homeTeam);
        const gameTime = DateUtils.formatGameTime(game.game_meta.datetime_local);
        
        // Get live score if available
        const gameScore = this.scores[game.game_meta.game_id] || null;
        const status = DateUtils.getGameStatus(game.game_meta.datetime_local, gameScore);
        
        // Get picks data
        const picks = game.picks || {};
        const bestBet = picks.best_bet;
        
        // Get odds data
        const odds = game.odds || {};
        
        // Determine card styling based on status - blue borders for live games
        const statusColors = {
            'in_progress': 'border-blue-400',
            'upcoming': 'border-gray-300',
            'completed': 'border-gray-300'
        };
        
        const statusLabels = {
            'in_progress': 'LIVE',
            'upcoming': 'UPCOMING',
            'completed': 'FINAL'
        };

        return `
            <div class="game-card bg-white rounded-lg border-2 ${statusColors[status]} shadow-lg hover:shadow-xl transition-shadow duration-300 relative">
                <!-- Status Badge -->
                <div class="status-badge text-xs font-bold px-2 py-1 rounded-br-lg inline-block ${status === 'in_progress' ? 'bg-green-500 text-white' : status === 'upcoming' ? 'bg-blue-500 text-white' : 'bg-gray-500 text-white'}">
                    ${isOhioGame ? '🌰 ' : ''}${statusLabels[status]}
                </div>
                
                <!-- Game Header -->
                <div class="p-4">
                    <div class="game-teams text-center mb-3">
                        <div class="text-lg font-bold text-gray-800">
                            ${awayTeam} <span class="text-gray-600">@</span> ${homeTeam}
                        </div>
                        <div class="text-sm text-gray-600 mt-1">
                            ${gameTime.datetime}
                        </div>
                        ${game.game_meta.venue ? `<div class="text-xs text-gray-500 mt-1">${game.game_meta.venue}</div>` : ''}
                    </div>
                    
                    ${this.renderGameStatus(status, gameScore, odds)}
                    
                    <!-- Our Best Pick -->
                    ${bestBet ? `
                        <div class="best-pick mb-3 p-3 ${this.getBestBetStyling(status, bestBet, gameScore)} rounded-lg">
                            <div class="text-xs font-bold text-gray-700 mb-1">
                                🏆 OUR BEST BET 
                                ${status === 'completed' ? `<span class="float-right">${this.getBestBetResultText(bestBet, gameScore)}</span>` : ''}
                            </div>
                            <div class="text-sm font-bold">${bestBet.pick}</div>
                            <div class="text-xs text-gray-600 mt-1">${this.getConfidenceDisplay(bestBet.confidence)}</div>
                            ${bestBet.rationale ? `<div class="text-xs text-gray-500 mt-1 italic">${bestBet.rationale}</div>` : ''}
                        </div>
                    ` : ''}
                    
                    <!-- View Details Link -->
                    <div class="text-center mt-4">
                        <a href="game.html?game=${encodeURIComponent(game.game_meta.game_id)}" 
                           class="inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors text-sm font-semibold">
                            View Full Analysis
                        </a>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render game status section based on current state
     */
    renderGameStatus(status, gameScore, odds) {
        if (status === 'in_progress' && gameScore) {
            // Show live score with quarter and time
            return `
                <div class="live-score text-center mb-3 p-3 bg-green-100 border-2 border-green-400 rounded-lg">
                    <div class="text-sm font-bold text-green-800">🔴 LIVE</div>
                    <div class="text-xl font-bold text-gray-900">
                        ${gameScore.away_team?.short || 'AWAY'} ${gameScore.away_team?.score || 0} - ${gameScore.home_team?.score || 0} ${gameScore.home_team?.short || 'HOME'}
                    </div>
                    ${gameScore.quarter ? `<div class="text-sm text-green-700 mt-1">Q${gameScore.quarter} ${gameScore.time_remaining || ''}</div>` : ''}
                </div>
            `;
        } else if (status === 'upcoming' && odds) {
            // Show current odds
            return `
                <div class="odds-display mb-3 p-3 bg-blue-100 border border-blue-400 rounded-lg">
                    <div class="text-xs font-bold text-blue-800 mb-2">CURRENT LINES</div>
                    <div class="grid grid-cols-3 gap-2 text-xs">
                        ${odds.spread ? `
                            <div class="text-center">
                                <div class="font-semibold text-blue-900">SPREAD</div>
                                <div class="text-blue-800">${odds.spread.favorite || 'FAV'} ${odds.spread.line}</div>
                            </div>
                        ` : ''}
                        ${odds.total ? `
                            <div class="text-center">
                                <div class="font-semibold text-blue-900">TOTAL</div>
                                <div class="text-blue-800">O/U ${odds.total.line}</div>
                            </div>
                        ` : ''}
                        ${odds.moneyline && odds.moneyline.home && odds.moneyline.away && odds.moneyline.home.price && odds.moneyline.away.price ? `
                            <div class="text-center">
                                <div class="font-semibold text-blue-900">ML</div>
                                <div class="text-blue-800">${odds.moneyline.home.price}/${odds.moneyline.away.price}</div>
                            </div>
                        ` : `
                            <div class="text-center">
                                <div class="font-semibold text-blue-900">ML</div>
                                <div class="text-blue-800">OFF</div>
                            </div>
                        `}
                    </div>
                </div>
            `;
        } else if (status === 'completed') {
            // Show final score - always show even if no score data
            if (gameScore) {
                return `
                    <div class="final-score text-center mb-3 p-3 bg-gray-100 border border-gray-400 rounded-lg">
                        <div class="text-sm font-bold text-gray-800">✅ FINAL SCORE</div>
                        <div class="text-xl font-bold text-gray-900">
                            ${gameScore.away_team?.short || 'AWAY'} ${gameScore.away_team?.score || 0} - ${gameScore.home_team?.score || 0} ${gameScore.home_team?.short || 'HOME'}
                        </div>
                    </div>
                `;
            } else {
                return `
                    <div class="final-score text-center mb-3 p-3 bg-gray-100 border border-gray-400 rounded-lg">
                        <div class="text-sm font-bold text-gray-800">✅ GAME COMPLETED</div>
                        <div class="text-sm text-gray-600">Final score not available</div>
                    </div>
                `;
            }
        }
        
        return ''; // No status section if no relevant data
    }

    /**
     * Get styling for best bet section
     */
    getBestBetStyling(status, bestBet, gameScore) {
        if (status === 'completed') {
            // For completed games, determine win/loss and style accordingly
            const result = this.evaluateBestBet(bestBet, gameScore);
            if (result === 'won') {
                return 'bg-green-100 border border-green-500 text-green-800';
            } else if (result === 'lost') {
                return 'bg-red-100 border border-red-500 text-red-800';
            } else {
                return 'bg-yellow-100 border border-yellow-500 text-yellow-800'; // Push or unclear
            }
        } else {
            // For live/upcoming games, use default yellow styling
            return 'bg-gradient-to-r from-yellow-100 to-yellow-200 border border-yellow-400';
        }
    }

    /**
     * Get result text for best bet
     */
    getBestBetResultText(bestBet, gameScore) {
        if (!gameScore || !bestBet) return '';
        
        const result = this.evaluateBestBet(bestBet, gameScore);
        if (result === 'won') {
            return '✅ WON';
        } else if (result === 'lost') {
            return '❌ LOST';
        } else {
            return '➖ PUSH';
        }
    }

    /**
     * Evaluate if our best bet won, lost, or pushed
     * Fixed logic for accurate bet grading
     */
    evaluateBestBet(bestBet, gameScore) {
        if (!bestBet || !gameScore || !bestBet.pick) return 'unknown';
        
        const pick = bestBet.pick.toLowerCase().trim();
        const awayScore = parseInt(gameScore.away_team?.score) || 0;
        const homeScore = parseInt(gameScore.home_team?.score) || 0;
        const totalScore = awayScore + homeScore;
        
        console.log(`🔍 DEBUGGING BET: "${bestBet.pick}"`);
        console.log(`📊 Final Score: ${gameScore.away_team?.short || 'AWAY'} ${awayScore} - ${gameScore.home_team?.short || 'HOME'} ${homeScore}`);
        
        // Get team info for dynamic matching
    const safeLower = (v) => typeof v === 'string' ? v.toLowerCase() : '';
    const awayTeamName = safeLower(gameScore.away_team?.name);
    const awayTeamShort = safeLower(gameScore.away_team?.short);
    const homeTeamName = safeLower(gameScore.home_team?.name);
    const homeTeamShort = safeLower(gameScore.home_team?.short);
        
        // Handle moneyline bets FIRST (e.g., "TENN +145 ML", "Alabama ML", "Home ML")
        if (pick.includes('ml') || pick.includes('moneyline')) {
            console.log(`💰 Moneyline bet detected: "${pick}"`);
            
            // Extract team from moneyline bet
            const mlTeam = pick.replace(/\s*(ml|moneyline|\+\d+|\-\d+)\s*/g, '').trim();
            console.log(`🏈 ML Team extracted: "${mlTeam}"`);
            
            // Check which team the ML bet is on
            let bettingOnAway = false;
            let bettingOnHome = false;
            
            if (mlTeam.includes('away') || 
                awayTeamName.includes(mlTeam) || 
                awayTeamShort.includes(mlTeam) ||
                mlTeam.includes(awayTeamShort) ||
                mlTeam.includes(awayTeamName.split(' ')[0])) {
                bettingOnAway = true;
                console.log(`✈️ Betting on AWAY team: ${awayTeamShort.toUpperCase()}`);
            } else if (mlTeam.includes('home') || 
                      homeTeamName.includes(mlTeam) || 
                      homeTeamShort.includes(mlTeam) ||
                      mlTeam.includes(homeTeamShort) ||
                      mlTeam.includes(homeTeamName.split(' ')[0])) {
                bettingOnHome = true;
                console.log(`🏠 Betting on HOME team: ${homeTeamShort.toUpperCase()}`);
            }
            
            if (bettingOnAway) {
                const result = awayScore > homeScore ? 'won' : 'lost';
                console.log(`🎯 Away ML result: ${awayTeamShort.toUpperCase()} ${awayScore} vs ${homeTeamShort.toUpperCase()} ${homeScore} → ${result.toUpperCase()}`);
                return result;
            } else if (bettingOnHome) {
                const result = homeScore > awayScore ? 'won' : 'lost';
                console.log(`🎯 Home ML result: ${homeTeamShort.toUpperCase()} ${homeScore} vs ${awayTeamShort.toUpperCase()} ${awayScore} → ${result.toUpperCase()}`);
                return result;
            }
            
            console.log(`❌ Could not determine team for ML bet: "${mlTeam}"`);
        }
        
        // Handle spread bets (e.g., "Villanova +48.5", "Tennessee +4", "Home -7.5")
        const spreadMatch = pick.match(/(.*?)\s*([+-]\d+\.?\d*)/);
        if (spreadMatch) {
            const team = spreadMatch[1].toLowerCase().trim();
            const line = parseFloat(spreadMatch[2]);
            
            console.log(`Spread bet: "${team}" with line ${line}`);
            
            // Determine which team the bet is on
            let bettingOnAway = false;
            let bettingOnHome = false;
            
            // Check if betting on away team
            if (team.includes('away') || 
                awayTeamName.includes(team) || 
                awayTeamShort.includes(team) ||
                team.includes(awayTeamShort) ||
                team.includes(awayTeamName.split(' ')[0])) { // First word of team name
                bettingOnAway = true;
            }
            // Check if betting on home team  
            else if (team.includes('home') || 
                     homeTeamName.includes(team) || 
                     homeTeamShort.includes(team) ||
                     team.includes(homeTeamShort) ||
                     team.includes(homeTeamName.split(' ')[0])) { // First word of team name
                bettingOnHome = true;
            }
            
            if (bettingOnAway) {
                const adjustedAwayScore = awayScore + line;
                console.log(`Away team bet: ${awayScore} + ${line} = ${adjustedAwayScore} vs ${homeScore}`);
                if (adjustedAwayScore > homeScore) return 'won';
                if (adjustedAwayScore < homeScore) return 'lost';
                return 'push';
            } else if (bettingOnHome) {
                const adjustedHomeScore = homeScore + line;
                console.log(`Home team bet: ${homeScore} + ${line} = ${adjustedHomeScore} vs ${awayScore}`);
                if (adjustedHomeScore > awayScore) return 'won';
                if (adjustedHomeScore < awayScore) return 'lost';
                return 'push';
            }
            
            console.log(`Could not determine which team for spread bet: "${team}"`);
        }
        
        // Handle over/under bets (e.g., "Over 54.5", "Under 45")
        if (pick.includes('over')) {
            const overMatch = pick.match(/over\s*(\d+\.?\d*)/);
            if (overMatch) {
                const line = parseFloat(overMatch[1]);
                console.log(`Over bet: ${totalScore} vs ${line}`);
                if (totalScore > line) return 'won';
                if (totalScore < line) return 'lost';
                return 'push';
            }
        } else if (pick.includes('under')) {
            const underMatch = pick.match(/under\s*(\d+\.?\d*)/);
            if (underMatch) {
                const line = parseFloat(underMatch[1]);
                console.log(`Under bet: ${totalScore} vs ${line}`);
                if (totalScore < line) return 'won';
                if (totalScore > line) return 'lost';
                return 'push';
            }
        }
        
        console.log(`Could not evaluate bet: "${pick}"`);
        return 'unknown';
    }

    /**
     * Format confidence display
     */
    getConfidenceDisplay(confidence) {
        if (!confidence) return '';
        const percentage = Math.round(confidence * 100);
        return `Confidence: ${percentage}%`;
    }
}

// Initialize the app when the page loads
const app = new BustaBookApp();

// Start the app
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => app.init());
} else {
    app.init();
}

console.log('BustaBook main application loaded');
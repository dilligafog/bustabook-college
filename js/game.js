// BustaBook College Picks - Game Detail Page Logic

class GameDetailApp {
    constructor() {
        this.gameData = null;
        this.gameId = null;
        this.scores = {};
    }

    /**
     * Initialize the game detail page
     */
    async init() {
        try {
            console.log('Initializing game detail page...');
            
            // Wait for DOM to be ready
            await this.waitForDOM();
            
            // Get game ID from URL
            this.gameId = this.getGameIdFromURL();
            if (!this.gameId) {
                throw new Error('No game ID specified in URL');
            }

            console.log('Loading game:', this.gameId);
            
            // Load game data and scores
            await this.loadGameData();
            
            // Render the complete game analysis
            this.renderGameDetails();
            
            console.log('Game detail page initialized successfully');
        } catch (error) {
            console.error('Failed to initialize game detail page:', error);
            this.showError(`Failed to load game analysis: ${error.message}<br><br>Debug: Looking for ID "${this.gameId}"`);
            console.log('Game lookup failed for ID:', this.gameId);
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
     * Extract game ID from URL parameters
     */
    getGameIdFromURL() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('game');
    }

    /**
     * Load game data by discovering the correct file
     */
    async loadGameData() {
        UIUtils.showLoading();
        UIUtils.clearError();

        try {
            // Load scores first
            this.scores = await DataUtils.loadScores();

            // Discover all game files and find the one with matching game_id
            console.log(`Looking for game ID: "${this.gameId}"`);
            let gameEntries;
            try {
                gameEntries = await DataUtils.discoverGameFiles();
            } catch (error) {
                throw new Error(`Failed to load manifest: ${error.message}. Make sure manifest.json exists and is valid.`);
            }
            
            console.log(`Found ${gameEntries.length} games in manifest:`, gameEntries.map(g => g.game_id));
            
            // Add visible debug info
            if (gameEntries.length === 0) {
                throw new Error(`No games found in manifest - DataUtils.discoverGameFiles() returned empty array`);
            }
            
            for (const gameEntry of gameEntries) {
                console.log(`Checking: "${gameEntry.game_id}" === "${this.gameId}" ?`, gameEntry.game_id === this.gameId);
                // Check if this is the game we're looking for
                if (gameEntry.game_id === this.gameId) {
                    console.log(`Match found! Loading ${gameEntry.filename}`);
                    if (gameEntry.filename && gameEntry.has_detailed_data) {
                        // Load from individual game file
                        try {
                            this.gameData = await DataUtils.loadJSON(`data/${gameEntry.filename}`);
                            if (this.gameData && this.gameData.game_meta) {
                                // Update the game_id to match the manifest (same as main.js)
                                this.gameData.game_meta.game_id = gameEntry.game_id;
                                console.log(`Successfully loaded game: ${this.gameData.game_meta.title}`);
                                break;
                            }
                        } catch (error) {
                            console.warn(`Failed to load ${gameEntry.filename}:`, error);
                        }
                    } else {
                        throw new Error(`Game "${this.gameId}" exists but has no detailed analysis data`);
                    }
                }
            }

            if (!this.gameData) {
                const availableIds = gameEntries.map(g => g.game_id).join(', ');
                throw new Error(`Game with ID "${this.gameId}" not found. Available IDs: ${availableIds}`);
            }

            console.log('Successfully loaded game data:', this.gameData.game_meta.title);
            console.log('Game data structure:', {
                game_meta: !!this.gameData.game_meta,
                teams: !!this.gameData.teams,
                odds: !!this.gameData.odds,
                picks: !!this.gameData.picks,
                sources: !!this.gameData.sources
            });

        } catch (error) {
            console.error('Error loading game data:', error);
            throw error;
        } finally {
            UIUtils.hideLoading();
        }
    }

    /**
     * Render all game details
     */
    renderGameDetails() {
        try {
            console.log('Starting to render game details...');
            console.log('Game data available:', !!this.gameData);
            
            // Show the main content first
            const gameContent = document.getElementById('game-content');
            if (gameContent) {
                gameContent.style.display = 'block';
                console.log('Game content div is now visible');
            } else {
                throw new Error('game-content element not found in DOM');
            }

            // Render each section with error handling
            try {
                console.log('Rendering game header...');
                this.renderGameHeader();
                console.log('Game header rendered successfully');
            } catch (error) {
                console.error('Error rendering game header:', error);
            }

            try {
                console.log('Rendering teams comparison...');
                this.renderTeamsComparison();
                console.log('Teams comparison rendered successfully');
            } catch (error) {
                console.error('Error rendering teams comparison:', error);
            }

            try {
                console.log('Rendering odds...');
                this.renderOdds();
                console.log('Odds rendered successfully');
            } catch (error) {
                console.error('Error rendering odds:', error);
            }

            try {
                console.log('Rendering matchup history...');
                this.renderMatchupHistory();
                console.log('Matchup history rendered successfully');
            } catch (error) {
                console.error('Error rendering matchup history:', error);
            }

            try {
                console.log('Rendering betting trends...');
                this.renderBettingTrends();
                console.log('Betting trends rendered successfully');
            } catch (error) {
                console.error('Error rendering betting trends:', error);
            }

            try {
                console.log('Rendering key notes...');
                this.renderKeyNotes();
                console.log('Key notes rendered successfully');
            } catch (error) {
                console.error('Error rendering key notes:', error);
            }

            try {
                console.log('Rendering picks...');
                this.renderPicks();
                console.log('Picks rendered successfully');
            } catch (error) {
                console.error('Error rendering picks:', error);
            }

            try {
                console.log('Rendering game details section...');
                this.renderGameDetailsSection();
                console.log('Game details section rendered successfully');
            } catch (error) {
                console.error('Error rendering game details section:', error);
            }

            try {
                console.log('Rendering excitement factors...');
                this.renderExcitementFactors();
                console.log('Excitement factors rendered successfully');
            } catch (error) {
                console.error('Error rendering excitement factors:', error);
            }

            try {
                console.log('Rendering sources...');
                this.renderSources();
                console.log('Sources rendered successfully');
            } catch (error) {
                console.error('Error rendering sources:', error);
            }

            try {
                console.log('Updating last updated...');
                this.updateLastUpdated();
                console.log('Last updated timestamp rendered successfully');
            } catch (error) {
                console.error('Error updating last updated:', error);
            }

            console.log('Finished rendering all sections');
        } catch (error) {
            console.error('Critical error in renderGameDetails:', error);
            this.showError('Failed to render game details');
        }
    }

    /**
     * Render game header with title, time, venue
     */
    renderGameHeader() {
        const meta = this.gameData.game_meta;
        const gameTime = DateUtils.formatGameTime(meta.datetime_local);
        const status = DateUtils.getGameStatus(meta.datetime_local, this.scores[this.gameId]);
        
        const statusColors = {
            'in_progress': 'bg-green-100 text-green-800',
            'upcoming': 'bg-blue-100 text-blue-800',
            'completed': 'bg-gray-100 text-gray-800'
        };
        
        const statusLabels = {
            'in_progress': '🔴 LIVE',
            'upcoming': '🕒 UPCOMING',
            'completed': '✅ FINAL'
        };

        const html = `
            <div class="text-center">
                <div class="mb-4">
                    <span class="inline-block px-3 py-1 rounded-full text-sm font-semibold ${statusColors[status]}">
                        ${statusLabels[status]}
                    </span>
                </div>
                <h1 class="text-4xl font-bold text-gray-900 mb-2">${meta.title}</h1>
                <div class="text-lg text-gray-600 mb-2">${gameTime.datetime}</div>
                <div class="text-md text-gray-500 mb-4">${meta.venue || 'Venue TBD'}</div>
                ${meta.tv && meta.tv.length > 0 ? `
                    <div class="text-sm text-gray-600">
                        📺 ${meta.tv.join(', ')}
                        ${meta.attendance_capacity ? ` • Capacity: ${meta.attendance_capacity.toLocaleString()}` : ''}
                    </div>
                ` : ''}
                ${meta.hype_factors && meta.hype_factors.length > 0 ? `
                    <div class="mt-4 flex flex-wrap justify-center gap-2">
                        ${meta.hype_factors.map(factor => `
                            <span class="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full">${factor}</span>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        `;

        document.getElementById('game-header').innerHTML = html;
    }

    /**
     * Render live score if available
     */
    renderLiveScore() {
        const gameScore = this.scores[this.gameId];
        if (!gameScore) {
            document.getElementById('live-score-section').style.display = 'none';
            return;
        }

        const teams = DataUtils.parseTeamNames(this.gameData.game_meta.title);
        
        const html = `
            <div class="text-center">
                <h3 class="text-lg font-bold text-gray-800 mb-3">🔴 LIVE SCORE</h3>
                <div class="grid grid-cols-2 gap-4 max-w-md mx-auto">
                    <div class="text-center">
                        <div class="text-sm font-semibold text-gray-600">${teams.awayTeam}</div>
                        <div class="text-3xl font-bold">${gameScore.away_score || 0}</div>
                    </div>
                    <div class="text-center">
                        <div class="text-sm font-semibold text-gray-600">${teams.homeTeam}</div>
                        <div class="text-3xl font-bold">${gameScore.home_score || 0}</div>
                    </div>
                </div>
                ${gameScore.quarter ? `<div class="text-sm text-gray-600 mt-2">${gameScore.quarter}</div>` : ''}
            </div>
        `;

        document.getElementById('live-score-section').innerHTML = html;
        document.getElementById('live-score-section').style.display = 'block';
    }

    /**
     * Render teams comparison
     */
    renderTeamsComparison() {
        const teams = this.gameData.teams;
        const rankings = this.gameData.game_meta.rankings;

        const html = `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <!-- Away Team -->
                <div class="border border-blue-200 rounded-lg p-4">
                    <div class="text-center mb-4">
                        <h3 class="text-lg font-bold text-blue-800">${teams.away.name}</h3>
                        <div class="text-sm text-gray-600">${teams.away.conference}</div>
                        ${rankings.away_ap ? `<div class="text-xs text-yellow-600 font-semibold">#${rankings.away_ap} AP</div>` : ''}
                    </div>
                    
                    <div class="space-y-3">
                        <div>
                            <span class="text-sm font-semibold text-gray-600">Record:</span>
                            <span class="text-sm">${teams.away.record}</span>
                        </div>
                        <div>
                            <span class="text-sm font-semibold text-gray-600">Recent Form:</span>
                            <div class="text-sm text-gray-700">${teams.away.recent_form}</div>
                        </div>
                        
                        ${this.renderTeamStats(teams.away.key_stats)}
                        
                        ${teams.away.motivation_factors && teams.away.motivation_factors.length > 0 ? `
                            <div>
                                <span class="text-sm font-semibold text-gray-600">Motivation:</span>
                                <ul class="text-xs text-gray-700 mt-1">
                                    ${teams.away.motivation_factors.map(factor => `<li>• ${factor}</li>`).join('')}
                                </ul>
                            </div>
                        ` : ''}
                    </div>
                </div>
                
                <!-- Home Team -->
                <div class="border border-red-200 rounded-lg p-4">
                    <div class="text-center mb-4">
                        <h3 class="text-lg font-bold text-red-800">${teams.home.name}</h3>
                        <div class="text-sm text-gray-600">${teams.home.conference}</div>
                        ${rankings.home_ap ? `<div class="text-xs text-yellow-600 font-semibold">#${rankings.home_ap} AP</div>` : ''}
                    </div>
                    
                    <div class="space-y-3">
                        <div>
                            <span class="text-sm font-semibold text-gray-600">Record:</span>
                            <span class="text-sm">${teams.home.record}</span>
                        </div>
                        <div>
                            <span class="text-sm font-semibold text-gray-600">Recent Form:</span>
                            <div class="text-sm text-gray-700">${teams.home.recent_form}</div>
                        </div>
                        
                        ${this.renderTeamStats(teams.home.key_stats)}
                        
                        ${teams.home.motivation_factors && teams.home.motivation_factors.length > 0 ? `
                            <div>
                                <span class="text-sm font-semibold text-gray-600">Motivation:</span>
                                <ul class="text-xs text-gray-700 mt-1">
                                    ${teams.home.motivation_factors.map(factor => `<li>• ${factor}</li>`).join('')}
                                </ul>
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;

        document.getElementById('teams-content').innerHTML = html;
    }

    /**
     * Render team stats helper
     */
    renderTeamStats(stats) {
        return `
            <div class="bg-gray-50 rounded p-3">
                <div class="text-xs font-semibold text-gray-600 mb-2">Key Stats</div>
                <div class="grid grid-cols-2 gap-2 text-xs">
                    ${stats.offense_rank ? `<div>Off: #${stats.offense_rank}</div>` : ''}
                    ${stats.defense_rank ? `<div>Def: #${stats.defense_rank}</div>` : ''}
                    ${stats.turnover_margin ? `<div>TO Margin: ${stats.turnover_margin}</div>` : ''}
                    ${stats.ats_record ? `<div>ATS: ${stats.ats_record}</div>` : ''}
                </div>
            </div>
        `;
    }

    /**
     * Render odds and line movement
     */
    renderOdds() {
        const odds = this.gameData.odds;
        if (!odds) {
            document.getElementById('odds-content').innerHTML = '<div class="text-gray-500">Odds data not available</div>';
            return;
        }

        const html = `
            <!-- Spread -->
            ${odds.spread ? `
                <div class="mb-6">
                    <h3 class="text-lg font-semibold mb-3">Point Spread</h3>
                    <div class="bg-gray-50 rounded-lg p-4">
                        <div class="flex justify-between items-center mb-2">
                            <span class="text-2xl font-bold">${odds.spread.favorite || 'FAV'} ${odds.spread.line}</span>
                            <span class="text-sm text-gray-600">Current Line</span>
                        </div>
                        <div class="text-sm text-gray-700 space-y-1">
                            ${odds.spread.opening_line ? `<div>Opening: ${odds.spread.opening_line}</div>` : ''}
                            ${odds.spread.line_movement ? `<div>Movement: ${odds.spread.line_movement}</div>` : ''}
                            ${odds.spread.public_betting && odds.spread.public_betting.note ? `
                                <div class="text-xs bg-blue-50 p-2 rounded mt-2">${odds.spread.public_betting.note}</div>
                            ` : ''}
                        </div>
                    </div>
                </div>
            ` : ''}

            <!-- Total -->
            ${odds.total ? `
                <div class="mb-6">
                    <h3 class="text-lg font-semibold mb-3">Total (Over/Under)</h3>
                    <div class="bg-gray-50 rounded-lg p-4">
                        <div class="flex justify-between items-center mb-2">
                            <span class="text-2xl font-bold">${odds.total.line}</span>
                            <span class="text-sm text-gray-600">O/U ${odds.total.over_price || 'N/A'}/${odds.total.under_price || 'N/A'}</span>
                        </div>
                        <div class="text-sm text-gray-700 space-y-1">
                            ${odds.total.opening_line ? `<div>Opening: ${odds.total.opening_line}</div>` : ''}
                            ${odds.total.line_movement ? `<div>Movement: ${odds.total.line_movement}</div>` : ''}
                        </div>
                    </div>
                </div>
            ` : ''}

            <!-- Moneyline -->
            ${odds.moneyline ? `
                <div class="mb-6">
                    <h3 class="text-lg font-semibold mb-3">Moneyline</h3>
                    <div class="bg-gray-50 rounded-lg p-4">
                        <div class="grid grid-cols-2 gap-4 text-sm">
                            ${odds.moneyline.home ? `
                                <div>
                                    <div class="font-semibold">Home: ${odds.moneyline.home.price || 'N/A'}</div>
                                    ${odds.moneyline.home.implied_prob ? `<div class="text-xs text-gray-600">${(odds.moneyline.home.implied_prob * 100).toFixed(1)}% implied</div>` : ''}
                                </div>
                            ` : ''}
                            ${odds.moneyline.away ? `
                                <div>
                                    <div class="font-semibold">Away: ${odds.moneyline.away.price || 'N/A'}</div>
                                    ${odds.moneyline.away.implied_prob ? `<div class="text-xs text-gray-600">${(odds.moneyline.away.implied_prob * 100).toFixed(1)}% implied</div>` : ''}
                                </div>
                            ` : ''}
                        </div>
                    </div>
                </div>
            ` : ''}

            ${odds.consensus_note ? `
                <div class="text-sm text-gray-600 bg-yellow-50 p-3 rounded">
                    <strong>Market Consensus:</strong> ${odds.consensus_note}
                </div>
            ` : ''}
        `;

        document.getElementById('odds-content').innerHTML = html;
    }

    /**
     * Render matchup history
     */
    renderMatchupHistory() {
        const history = this.gameData.matchup_history;

        const html = `
            <div class="space-y-4">
                <div class="bg-gray-50 rounded-lg p-4">
                    <div class="text-sm font-semibold text-gray-800 mb-2">All-Time Series</div>
                    <div class="text-lg font-bold">${history.all_time_record}</div>
                    ${history.recent_trend ? `<div class="text-sm text-gray-600 mt-1">${history.recent_trend}</div>` : ''}
                </div>
                
                ${history.last_meeting ? `
                    <div class="bg-gray-50 rounded-lg p-4">
                        <div class="text-sm font-semibold text-gray-800 mb-2">Last Meeting</div>
                        <div class="text-lg font-bold">${history.last_meeting.score}</div>
                        <div class="text-sm text-gray-600">${new Date(history.last_meeting.date).toLocaleDateString()}</div>
                        ${history.last_meeting.note ? `<div class="text-sm text-gray-700 mt-1">${history.last_meeting.note}</div>` : ''}
                    </div>
                ` : ''}
            </div>
        `;

        document.getElementById('history-content').innerHTML = html;
    }

    /**
     * Render betting trends and angles
     */
    renderBettingTrends() {
        const angles = this.gameData.betting_angles;

        const html = `
            ${angles.key_trends && angles.key_trends.length > 0 ? `
                <div class="mb-6">
                    <h3 class="text-md font-semibold mb-3">📈 Key Trends</h3>
                    <div class="space-y-2">
                        ${angles.key_trends.map(trend => `
                            <div class="trend-item bg-blue-50 pl-4 pr-3 py-2 rounded">${trend}</div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
            
            ${angles.situational_spots && angles.situational_spots.length > 0 ? `
                <div>
                    <h3 class="text-md font-semibold mb-3">🎯 Situational Spots</h3>
                    <div class="space-y-2">
                        ${angles.situational_spots.map(spot => `
                            <div class="trend-item bg-green-50 pl-4 pr-3 py-2 rounded">${spot}</div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
        `;

        document.getElementById('trends-content').innerHTML = html;
    }

    /**
     * Render key notes and injuries
     */
    renderKeyNotes() {
        const notables = this.gameData.notables;

        const html = `
            ${notables.injuries_news && notables.injuries_news.length > 0 ? `
                <div class="mb-6">
                    <h3 class="text-md font-semibold mb-3">🏥 Injuries & News</h3>
                    <div class="space-y-2">
                        ${notables.injuries_news.map(injury => `
                            <div class="bg-red-50 border-l-4 border-red-400 pl-4 py-2 text-sm">${injury}</div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
            
            ${notables.matchup_notes && notables.matchup_notes.length > 0 ? `
                <div class="mb-6">
                    <h3 class="text-md font-semibold mb-3">⚡ Key Matchups</h3>
                    <div class="space-y-2">
                        ${notables.matchup_notes.map(note => `
                            <div class="bg-yellow-50 border-l-4 border-yellow-400 pl-4 py-2 text-sm">${note}</div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
            
            ${notables.coaching_notes && notables.coaching_notes.length > 0 ? `
                <div>
                    <h3 class="text-md font-semibold mb-3">🏆 Coaching Notes</h3>
                    <div class="space-y-2">
                        ${notables.coaching_notes.map(note => `
                            <div class="bg-purple-50 border-l-4 border-purple-400 pl-4 py-2 text-sm">${note}</div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
        `;

        document.getElementById('notes-content').innerHTML = html;
    }

    /**
     * Render betting picks with confidence indicators
     */
    renderPicks() {
        const picks = this.gameData.picks;

        const html = `
            ${picks.best_bet ? `
                <div class="best-bet-card mb-6 bg-white border-2 border-lime-400 rounded-lg p-4 shadow-md hover:shadow-lg transition-shadow">
                    <div class="flex items-center gap-2 mb-2">
                        <span class="inline-block text-xs font-semibold px-2 py-0.5 rounded bg-lime-100 text-lime-800">BEST BET</span>
                        <h3 class="text-lg font-bold text-gray-900">🏆 ${picks.best_bet.pick}</h3>
                    </div>
                    <div class="best-bet-rationale text-sm text-gray-700">${picks.best_bet.rationale}</div>
                    ${this.renderConfidenceBar(picks.best_bet.confidence)}
                </div>
            ` : ''}
            
            <div class="space-y-4">
                ${picks.spread ? this.renderPickCard('Spread', picks.spread) : ''}
                ${picks.total ? this.renderPickCard('Total', picks.total) : ''}
                ${picks.moneyline ? this.renderPickCard('Moneyline', picks.moneyline) : ''}
            </div>
        `;

        document.getElementById('picks-content').innerHTML = html;
    }

    /**
     * Render individual pick card
     */
    renderPickCard(type, pick) {
        return `
            <div class="border border-gray-200 rounded-lg p-4">
                <div class="flex justify-between items-start mb-2">
                    <h4 class="font-semibold text-gray-800">${type}</h4>
                    <span class="text-xs bg-gray-100 px-2 py-1 rounded">${pick.value_assessment || 'N/A'}</span>
                </div>
                <div class="text-lg font-bold mb-2">${pick.pick}</div>
                <div class="text-sm text-gray-700 mb-3">${pick.rationale}</div>
                ${this.renderConfidenceBar(pick.confidence)}
            </div>
        `;
    }

    /**
     * Render confidence bar
     */
    renderConfidenceBar(confidence) {
        if (!confidence) return '';
        
        const percentage = Math.round(confidence * 100);
        const colorClass = percentage >= 70 ? 'bg-green-500' : percentage >= 50 ? 'bg-yellow-500' : 'bg-red-500';
        
        return `
            <div class="mt-2">
                <div class="flex justify-between text-xs text-gray-600 mb-1">
                    <span>Confidence</span>
                    <span>${percentage}%</span>
                </div>
                <div class="w-full bg-gray-200 rounded-full h-2">
                    <div class="confidence-bar ${colorClass} h-2 rounded-full" style="width: ${percentage}%"></div>
                </div>
            </div>
        `;
    }

    /**
     * Render game details (weather, venue, etc.)
     */
    renderGameDetailsSection() {
        const meta = this.gameData.game_meta;
        const gameTime = DateUtils.formatGameTime(meta.datetime_local);

        const html = `
            <div class="space-y-4">
                <div>
                    <span class="text-sm font-semibold text-gray-600">Date & Time:</span>
                    <div class="text-sm">${gameTime.date}</div>
                    <div class="text-sm">${gameTime.time}</div>
                </div>
                
                ${meta.venue ? `
                    <div>
                        <span class="text-sm font-semibold text-gray-600">Venue:</span>
                        <div class="text-sm">${meta.venue}</div>
                    </div>
                ` : ''}
                
                ${meta.tv && meta.tv.length > 0 ? `
                    <div>
                        <span class="text-sm font-semibold text-gray-600">TV:</span>
                        <div class="text-sm">${meta.tv.join(', ')}</div>
                    </div>
                ` : ''}
                
                ${meta.weather ? `
                    <div>
                        <span class="text-sm font-semibold text-gray-600">Weather:</span>
                        <div class="text-sm">${meta.weather.conditions}</div>
                        <div class="text-sm">${meta.weather.temp_f}°F, Wind: ${meta.weather.wind_mph} mph</div>
                        ${meta.weather.notes ? `<div class="text-xs text-gray-600 mt-1">${meta.weather.notes}</div>` : ''}
                    </div>
                ` : ''}
                
                ${meta.attendance_capacity ? `
                    <div>
                        <span class="text-sm font-semibold text-gray-600">Capacity:</span>
                        <div class="text-sm">${meta.attendance_capacity.toLocaleString()}</div>
                    </div>
                ` : ''}
            </div>
        `;

        document.getElementById('details-content').innerHTML = html;
    }

    /**
     * Render excitement factors and storylines
     */
    renderExcitementFactors() {
        const excitement = this.gameData.excitement_factors;

        const html = `
            <div class="space-y-4">
                ${excitement.playoff_implications ? `
                    <div>
                        <span class="text-sm font-semibold text-gray-600">Playoff Impact:</span>
                        <div class="text-sm">${excitement.playoff_implications}</div>
                    </div>
                ` : ''}
                
                ${excitement.conference_impact ? `
                    <div>
                        <span class="text-sm font-semibold text-gray-600">Conference Impact:</span>
                        <div class="text-sm">${excitement.conference_impact}</div>
                    </div>
                ` : ''}
                
                ${excitement.narrative ? `
                    <div>
                        <span class="text-sm font-semibold text-gray-600">Key Narrative:</span>
                        <div class="text-sm">${excitement.narrative}</div>
                    </div>
                ` : ''}
                
                ${excitement.tv_storylines && excitement.tv_storylines.length > 0 ? `
                    <div>
                        <span class="text-sm font-semibold text-gray-600">TV Storylines:</span>
                        <ul class="text-sm mt-1">
                            ${excitement.tv_storylines.map(story => `<li class="ml-4">• ${story}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}
            </div>
        `;

        document.getElementById('excitement-content').innerHTML = html;
    }

    /**
     * Render data sources
     */
    renderSources() {
        const sources = this.gameData.sources;

        const html = `
            <div class="space-y-3">
                ${sources.map(source => `
                    <div class="text-xs">
                        <div class="font-semibold text-gray-700">${source.label}</div>
                        <div class="text-gray-600">${source.type}</div>
                        ${source.asof_utc ? `<div class="text-gray-500">As of: ${new Date(source.asof_utc).toLocaleString()}</div>` : ''}
                    </div>
                `).join('')}
            </div>
        `;

        document.getElementById('sources-content').innerHTML = html;
    }

    /**
     * Update last updated timestamp
     */
    updateLastUpdated() {
        const lastUpdated = this.gameData.game_meta.last_updated_utc;
        if (lastUpdated) {
            const formatted = new Date(lastUpdated).toLocaleString();
            document.getElementById('last-updated').textContent = `Last updated: ${formatted}`;
        }
    }

    /**
     * Show error message
     */
    showError(message) {
        UIUtils.hideLoading();
        document.getElementById('error-container').textContent = message;
        document.getElementById('error-container').style.display = 'block';
    }
}

// Initialize the app
const gameApp = new GameDetailApp();

// Start the app
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => gameApp.init());
} else {
    gameApp.init();
}

console.log('BustaBook game detail application loaded');
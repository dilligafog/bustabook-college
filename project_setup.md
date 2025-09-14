# BustaBook College Picks - Project Implementation Guide

## Project Overview
A simple, dynamic college football betting picks website that:
- Displays detailed betting analysis from individual game JSON files
- Shows live scores from a separate scores.json file
- Automatically discovers new games when JSON files are added
- Works on GitHub Pages without rebuilds
- Uses vanilla JavaScript/HTML for maximum compatibility

## ✅ PROVEN WORKING IMPLEMENTATION

### Critical Success Factors Discovered:

#### 1. JavaScript Syntax Requirements
- **NEVER use optional chaining (`?.`) in assignment contexts** - This causes silent failures
- ❌ Wrong: `document.getElementById('id')?.textContent = value;`
- ✅ Correct: 
```javascript
const element = document.getElementById('id');
if (element) {
    element.textContent = value;
}
```

#### 2. Data Structure Mapping
The actual JSON structure differs from initial assumptions:
- **Game Data**: `game.game_meta.title` (not `game.home_team`/`game.away_team`)
- **Game Time**: `game.game_meta.datetime_local` (not `game.start_time`)
- **Betting Picks**: `game.betting_analysis.picks[]` (not `game.picks[]`)
- **Pick Data**: `pick.pick` (not `pick.selection`)
- **Game ID**: `game.game_meta.game_id` for URLs

#### 3. DOM Element Matching
- HTML uses `id="loading-container"` but JavaScript looked for `id="loading"`
- **Solution**: Always verify actual HTML structure matches JavaScript selectors
- Use browser dev tools to confirm element IDs exist

#### 4. HTML Structure Complexity
- Index.html has sectioned layout: `in-progress-games`, `upcoming-games`, `completed-games`
- Simple test pages work better for debugging than complex layouts
- **Lesson**: Start simple, add complexity after core functionality works

#### 5. Script Loading Order
- Utils.js must load completely before main.js
- Syntax errors in utils.js prevent DataUtils from being available
- **Solution**: Test each script independently with `node -c filename.js`

### 📁 Files to Preserve
Keep these working files in a `/save/` folder:

1. **js/utils.js** - All utility functions (DataUtils, DateUtils, UIUtils, etc.)
2. **js/main.js** - Working home page logic with correct data structure mapping
3. **diagnostic.html** - Proven debugging tool for testing JavaScript execution
4. **quicktest.html** - Minimal test page that confirmed core functionality
5. **data/games-manifest.json** - Game discovery manifest
6. **data/[all-game-files].json** - Working game data files

## Folder Structure
```
bustabook-college/
├── index.html                 # Home page with games list
├── game.html                  # Game detail page
├── save/                      # PRESERVE THESE WORKING FILES
│   ├── js/
│   │   ├── main.js           # ✅ Working home page logic
│   │   ├── utils.js          # ✅ Working utility functions
│   │   └── game.js           # ✅ Working game detail logic
│   ├── diagnostic.html       # ✅ JavaScript debugging tool
│   ├── quicktest.html        # ✅ Minimal functionality test
│   └── data/                 # ✅ All working game data files
├── css/
│   └── custom.css            # Custom styles
├── js/
│   ├── main.js               # Home page logic
│   ├── game.js               # Game detail page logic
│   └── utils.js              # Shared utilities
├── data/
│   ├── scores.json           # Live scores (updates frequently)
│   ├── games-manifest.json   # Game discovery manifest
│   └── [game-files].json    # Individual game analysis files
└── README.md                 # Documentation
```

## 🔧 Implementation Lessons Learned

### JavaScript Debugging Strategy
1. **Start with diagnostic.html** - Tests each component step-by-step
2. **Use syntax checking**: `node -c filename.js` catches errors early
3. **Test utilities first**: Ensure DataUtils, DateUtils export properly
4. **Check DOM elements**: Verify HTML IDs match JavaScript selectors

### Data Structure Parsing
```javascript
// ✅ Correct team name parsing
const title = game.game_meta.title; // "Georgia at Tennessee"
const parts = title.split(/\s+(?:at|vs|@)\s+/i);
const awayTeam = parts[0]?.trim() || 'Away Team';
const homeTeam = parts[1]?.trim() || 'Home Team';

// ✅ Correct betting picks access
const picks = game.betting_analysis?.picks || [];
const spreadPick = picks.find(p => p.type === 'spread');
const totalPick = picks.find(p => p.type === 'total');
```

### Error Prevention Patterns
```javascript
// ✅ Safe DOM element access
const element = document.getElementById('element-id');
if (element) {
    element.textContent = value;
}

// ✅ Safe data access with fallbacks
const gameTime = game.game_meta?.datetime_local || 'TBD';
const picks = game.betting_analysis?.picks || [];
```

## Core Features

### 1. Home Page (index.html)
- **Auto-discovery**: Scans for game JSON files dynamically
- **Game cards**: Display title, date and time, venue, and live scores
- **Sorting**: Games sorted by date/time
- **Responsive**: Works on desktop and mobile
- **Live scores integration**: Shows current scores if available
- **Sort order of Game Cards**: Cards should be listed in order: In-progress, Upcoming, Completed
- **Day Page Breaks**: the page will list all games,  the days should be seperated by a page break / HR
- **highlight the correct picks**: make a big deal we got one right.

### 2. Game Detail Page (game.html)
- **Complete data display**: Shows ALL data from the game JSON file
- **Fallback handling**: Shows "Data not available" for missing fields
- **Live score overlay**: Current score displayed prominently
- **Betting analysis**: All picks, predictions, and analysis visible
- **Navigation**: Easy back to home page

### 3. Data Management
- **Individual game files**: Detailed betting analysis per game
- **scores.json**: Live scores only, updates independently
- **Auto-discovery**: No manual manifest updates required
- **Error handling**: Graceful handling of missing/corrupt files

## Technical Stack
- **Frontend**: Vanilla HTML5, CSS3, JavaScript (ES6+)
- **Styling**: Tailwind CSS (CDN) + Flowbite components
- **Hosting**: GitHub Pages compatible
- **Dependencies**: None (all CDN-based)

## Implementation Plan

### Phase 1: Core Structure
1. Create folder structure
2. Set up index.html with Tailwind/Flowbite
3. Create basic JavaScript for game discovery
4. Test with existing game files

### Phase 2: Game Discovery
1. Implement automatic JSON file discovery
2. Create fallback patterns for common game naming
3. Build games list renderer
4. Add loading states and error handling

### Phase 3: Game Details
1. Create game.html template
2. Build comprehensive game data renderer
3. Handle all possible JSON fields dynamically
4. Add "data not available" fallbacks

### Phase 4: Live Scores Integration
1. Integrate scores.json loading
2. Overlay live scores on game cards
3. Display current scores on detail pages
4. Handle score update timing

### Phase 5: Polish & Deploy
1. Add responsive design refinements
2. Test on GitHub Pages
3. Create deployment documentation
4. Performance optimization

## File Templates Needed

### 1. index.html
- Clean, modern design
- Game cards grid layout
- Loading and error states
- Navigation header

### 2. game.html
- Detailed game view
- Flexible data rendering
- Score integration
- Back navigation

### 3. js/main.js
- Game discovery logic
- Card rendering
- Score integration
- Error handling

### 4. js/game.js
- URL parameter parsing
- Game data loading
- Dynamic content rendering
- All field display logic

### 5. js/utils.js
- Date formatting
- Score fetching
- Common utilities
- Error handling helpers

## Data Handling Strategy

### Game Discovery Options:
1. **Manifest-based**: Use games-manifest.json for reliable discovery
2. **Pattern-based**: Try common filename patterns
3. **Hybrid**: Use manifest if available, fallback to patterns

### Score Integration:
- Load scores.json separately
- Match games by game_id
- Display live scores prominently
- Handle missing scores gracefully

### Error Handling:
- Graceful degradation for missing files
- Clear error messages for users
- Console logging for debugging
- Fallback to "data not available"

## Deployment Requirements
- GitHub Pages compatible (static files only)
- No build process required
- CDN-based dependencies
- Works with file:// protocol for local testing

## Benefits of This Approach
1. **Zero build process**: Drop files and go
2. **GitHub Pages ready**: Works immediately
3. **Maintenance-free**: Add games by dropping JSON files
4. **Fast loading**: Minimal dependencies
5. **Mobile responsive**: Modern, clean design
6. **Error resilient**: Handles missing data gracefully

This plan creates a robust, maintainable solution that meets all your requirements while being much simpler than the Next.js approach.
/***********************************************
 *  Firebase Initialization & Global Vars      *
 ***********************************************/
const firebaseConfig = {
    apiKey: "AIzaSyBop7YMrZIO05yknhCm_mqjbtXP_Gl58sE", authDomain: "cosmicdodge-5ae20.firebaseapp.com", projectId: "cosmicdodge-5ae20", storageBucket: "cosmicdodge-5ae20.appspot.com", messagingSenderId: "940230809594", appId: "1:940230809594:web:0b3b1dabe1e5c2f5f47643"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// --- Game & Version Info ---
const version = 'grok3_reasoning_uncapped';
const gameTitle = 'steve_jobs_hammurabi';

// --- Firebase Collection/Doc Names ---
const leaderboardCollection = `leaderboard_${gameTitle}_${version}`;
const statsDoc = `stats_${gameTitle}_${version}`;

// --- Local/Session Storage Keys ---
const volumeKey = `${gameTitle}_volume_v2`;
const sessionRankingsKey = `${gameTitle}_rankings`;
const sessionRoundNumberKey = `${gameTitle}_roundNumber`;

// --- Global State ---
let playerName = "";
let gameStarted = false;
let gameEnded = false; // Tracks if current game outcome has been recorded
let roundNumber = parseInt(sessionStorage.getItem(sessionRoundNumberKey) || '0');
// Note: `rankings` isn't strictly needed globally, `saveLocalRecord` handles sessionStorage directly

// --- DOM Elements ---
const startScreen = document.getElementById('startScreen');
const playerInfoDiv = document.getElementById('playerInfo');
const playerNameInput = document.getElementById('playerName');
const startGameBtn = document.getElementById('startGame');
const gameContainer = document.getElementById('gameContainer');
const yearEl = document.getElementById('year');
const foodEl = document.getElementById('food');
const landEl = document.getElementById('land');
const pawnsEl = document.getElementById('pawns');
const landPriceEl = document.getElementById('landPrice');
const decisionYearEl = document.getElementById('decisionYear');
const buyLandInput = document.getElementById('buyLand');
const sellLandInput = document.getElementById('sellLand');
const plantInput = document.getElementById('plant');
const feedInput = document.getElementById('feed');
const nextTurnBtn = document.getElementById('nextTurn');
const messageEl = document.getElementById('message');
const backgroundMusic = document.getElementById('backgroundMusic');
const volumeSlider = document.getElementById('volumeSlider');
const rankingContentEl = document.getElementById('rankingContent'); // For Local Ranking
const globalRankingContentStart = document.getElementById('globalRankingContentStart');
const globalRankingContentGame = document.getElementById('globalRankingContentGame');
const globalGamesPlayedStart = document.getElementById("globalGamesPlayedStart");
const globalGamesPlayedGame = document.getElementById("globalGamesPlayedGame");

// --- Initial Hammurabi Game State ---
let gameState = {}; // Will be populated by resetGameUIAndState


/***********************************************
 *           Volume Control Logic              *
 ***********************************************/
 function setupVolumeControl() {
    if (!backgroundMusic || !volumeSlider) { console.warn("Volume elements not found."); return; }
    const savedVolume = localStorage.getItem(volumeKey); let currentVolume = 0.5;
    if (savedVolume !== null && !isNaN(parseFloat(savedVolume))) { currentVolume = parseFloat(savedVolume); }
    volumeSlider.value = currentVolume; backgroundMusic.volume = currentVolume;
    volumeSlider.addEventListener('input', () => { const newVolume = parseFloat(volumeSlider.value); backgroundMusic.volume = newVolume; try { localStorage.setItem(volumeKey, newVolume.toString()); } catch (e) { console.error("Failed to save volume:", e); } });
}

/***********************************************
 *       Firestore Leaderboard & Stats         *
 ***********************************************/
function updateGlobalLeaderboard() {
    db.collection(leaderboardCollection).orderBy("finalYear", "desc").orderBy("finalPawns", "desc").limit(20).get()
    .then((querySnapshot) => { let html = '<ol>'; if (querySnapshot.empty) html = '<p>No scores yet. Be the first!</p>'; else querySnapshot.forEach((doc) => { const data = doc.data(); const pawnsDisplay = data.finalPawns > 0 ? `(${data.finalPawns} pawns remaining)` : '(all pawns lost)'; html += `<li>${data.playerName || 'Anon'}: ${data.finalYear} years ${pawnsDisplay}</li>`; }); if (!querySnapshot.empty) html += '</ol>'; if (globalRankingContentStart) globalRankingContentStart.innerHTML = html; if (globalRankingContentGame) globalRankingContentGame.innerHTML = html; })
    .catch((error) => { console.error("Error getting global leaderboard:", error); const errorMsg = "<p>Error loading leaderboard.</p>"; if (globalRankingContentStart) globalRankingContentStart.innerHTML = errorMsg; if (globalRankingContentGame) globalRankingContentGame.innerHTML = errorMsg; });
}
function addGlobalRecord(pName, year, pawns) {
    // Submit score only once per game end
    if (gameEnded) { console.log("Score already submitted for this game."); return; }

    const finalPawns = Math.max(0, pawns);
    gameEnded = true; // Mark as ended *before* async operation to prevent race conditions

    db.collection(leaderboardCollection).add({
        playerName: pName || "Anon", finalYear: year, finalPawns: finalPawns, version: version, timestamp: firebase.firestore.FieldValue.serverTimestamp()
    })
    .then(() => { console.log(`Global record added: ${pName || 'Anon'}, Year ${year}, Pawns ${finalPawns}`); updateGlobalLeaderboard(); })
    .catch((error) => {
        console.error("Error adding global record:", error);
        gameEnded = false; // Allow retry if submission fails? Or inform user? For now, allow retry.
    });
}
function incrementGlobalGamesPlayed() {
    db.collection("globalStats").doc(statsDoc).set({ totalGamesPlayed: firebase.firestore.FieldValue.increment(1), gameTitle: gameTitle, version: version }, { merge: true }) .then(() => { console.log("Total games incremented."); displayGlobalGamesPlayed(); }).catch(console.error);
}
function displayGlobalGamesPlayed() {
    db.collection("globalStats").doc(statsDoc).get().then((doc) => { const total = doc.exists ? (doc.data().totalGamesPlayed || 0) : 0; const text = `(Total games played worldwide: ${total})`; if (globalGamesPlayedStart) globalGamesPlayedStart.innerText = text; if (globalGamesPlayedGame) globalGamesPlayedGame.innerText = text; }) .catch((error) => { console.error("Error reading total games:", error); const errorText = "(Total games played worldwide: Error)"; if (globalGamesPlayedStart) globalGamesPlayedStart.innerText = errorText; if (globalGamesPlayedGame) globalGamesPlayedGame.innerText = errorText; });
}

/***********************************************
 *            Local Ranking (Session)          *
 ***********************************************/
 function updateRankingBoard() {
    if (!rankingContentEl) return; // Don't proceed if element doesn't exist
    const currentRankings = JSON.parse(sessionStorage.getItem(sessionRankingsKey) || '[]');
    const sortedRankings = currentRankings.slice().sort((a, b) => {
        if (b.year !== a.year) return b.year - a.year; // Sort by year desc
        return b.pawns - a.pawns; // Then by pawns desc
    });
    let html = '';
    if (sortedRankings.length === 0) html = '<p>No games completed this session.</p>';
    else {
        html = '<ol>';
        sortedRankings.forEach((entry) => {
            const pawnText = entry.pawns > 0 ? `(${entry.pawns} pawns)` : '(all lost)';
            html += `<li>Game ${entry.round}: ${entry.year} years ${pawnText}</li>`;
        });
        html += '</ol>';
    }
    rankingContentEl.innerHTML = html;
}
function saveLocalRecord(currentRound, year, pawns) {
     let currentRankings = JSON.parse(sessionStorage.getItem(sessionRankingsKey) || '[]');
     currentRankings.push({ round: currentRound, year: year, pawns: Math.max(0, pawns) });
     // Optional: Limit the number of entries stored
     // currentRankings = currentRankings.slice(-10); // Keep last 10
     try {
        sessionStorage.setItem(sessionRankingsKey, JSON.stringify(currentRankings));
        updateRankingBoard(); // Update display immediately
     } catch (e) { console.error("Failed to save local ranking:", e); }
}

 /***********************************************
 *          Name Validation (Improved)         *
 ***********************************************/
 function isNameOffensive(name) {
     // Check if blocklist is loaded
     if (typeof offensiveWords === 'undefined') {
         console.warn("Offensive words list (blocklist.js) not loaded!");
         return false; // Fail safe
     }
     if (!name) return false;
     const lowerCaseName = name.toLowerCase();
     for (const word of offensiveWords) {
         const regex = new RegExp(`\\b${word}\\b`, 'i'); // Match whole word, case-insensitive
         if (regex.test(lowerCaseName)) {
             console.log(`Offensive word found: ${word} in ${name}`);
             return true;
         }
     }
     return false;
 }

/***********************************************
 *         Game State & UI Updates             *
 ***********************************************/
function resetGameUIAndState() {
    gameState = { year: 1, food: 1000, land: 100, pawns: 100, landPrice: Math.floor(Math.random()*11)+18 };
    gameEnded = false; // Reset ended flag for the new game instance
    if(buyLandInput) buyLandInput.value=0; if(sellLandInput) sellLandInput.value=0; if(plantInput) plantInput.value=0; if(feedInput) feedInput.value=0;
    if(messageEl) messageEl.innerHTML="A new era begins. Manage your resources wisely.";
    if(nextTurnBtn) nextTurnBtn.disabled=false;
    updateUI();
}
function updateUI() {
    if(!gameStarted) return;
    if(yearEl) yearEl.textContent=gameState.year;
    if(decisionYearEl) decisionYearEl.textContent=gameState.year;
    if(foodEl) foodEl.textContent=Math.floor(gameState.food);
    if(landEl) landEl.textContent=gameState.land;
    if(pawnsEl) pawnsEl.textContent=gameState.pawns;
    if(landPriceEl) landPriceEl.textContent=gameState.landPrice;
}

/***********************************************
 *            Start Game Function              *
 ***********************************************/
function startGameNow() {
    const nameInput = playerNameInput.value.trim();
    if (nameInput === "") { alert("Please enter a player name."); return; }
    if (isNameOffensive(nameInput)) { alert("Please choose a more appropriate player name."); return; }

    playerName = nameInput.substring(0, 10);

    if(startScreen) startScreen.style.display="none";
    if(gameContainer) gameContainer.style.display="flex";

    gameStarted = true;
    resetGameUIAndState(); // Initialize game data

    // Session/Round Handling
    roundNumber++; // Increment round number for this session attempt
    sessionStorage.setItem(sessionRoundNumberKey, roundNumber.toString());

    incrementGlobalGamesPlayed(); // Count this game start globally

    // Load/Update Displays
    updateRankingBoard(); // Show session rankings
    updateGlobalLeaderboard();
    displayGlobalGamesPlayed();

    // --- Play Music ---
    setupVolumeControl();
    if (backgroundMusic) {
        backgroundMusic.play().catch(error => { console.log("Music autoplay prevented:", error); if(messageEl) messageEl.innerHTML += "<br><small>(Music autoplay blocked. Adjust volume.)</small>"; });
    } else { console.error("Background music element not found!"); }
}

/***********************************************
 *          Hammurabi Game Turn Logic          *
 ***********************************************/
function processTurn() {
    // Check game over conditions *before* processing turn
     if (gameState.pawns <= 0) {
         if (!gameEnded) { // Ensure score is recorded only once
            if(messageEl) messageEl.innerHTML = `GAME OVER<br>Your civilization collapsed in year ${gameState.year}.`; // Game ended *after* previous turn's calculations
            saveLocalRecord(roundNumber, gameState.year, 0);
            addGlobalRecord(playerName, gameState.year, 0);
            // gameEnded is set within addGlobalRecord
         }
        if(nextTurnBtn) nextTurnBtn.disabled = true;
        return; // Stop processing if game already over
    }

    if (!gameStarted || gameEnded || !nextTurnBtn) return; // Exit if not ready or already finished

    const buyLand=parseInt(buyLandInput?.value??0)||0, sellLand=parseInt(sellLandInput?.value??0)||0, plant=parseInt(plantInput?.value??0)||0, feed=parseInt(feedInput?.value??0)||0;
    if(messageEl) messageEl.textContent=""; let turnMessages=[]; let validationFailed=false;
    function failValidation(msg) { if(messageEl) messageEl.textContent=msg; validationFailed=true; }

    // --- Input Validation ---
    if(buyLand<0||sellLand<0||plant<0||feed<0){ failValidation("Please enter non-negative values."); }
    else if(buyLand>0&&sellLand>0){ failValidation("Cannot buy AND sell land in the same year."); }
    else if(buyLand*gameState.landPrice>gameState.food){ failValidation(`Not enough food to buy ${buyLand} acres! Have ${Math.floor(gameState.food)}.`); }
    else if(sellLand>gameState.land){ failValidation(`Not enough land to sell! Own ${gameState.land} acres.`); }
    // Check food/land needed *after* accounting for buy/sell this turn
    const foodAfterLandDeals = gameState.food - (buyLand*gameState.landPrice) + (sellLand*gameState.landPrice);
    const landAfterLandDeals = gameState.land + buyLand - sellLand;
    if (plant > foodAfterLandDeals) { failValidation(`Not enough food to plant! Need ${plant} bushels, have ${Math.floor(foodAfterLandDeals)} left after land deals.`); }
    else if (plant > landAfterLandDeals) { failValidation(`Not enough land to plant! Will own ${landAfterLandDeals} acres.`); }
    else if (plant > gameState.pawns * 10) { failValidation(`Not enough pawns to plant! Need ${Math.ceil(plant / 10)}, have ${gameState.pawns}.`); }
    else { const foodAfterPlanting = foodAfterLandDeals - plant; const foodFeedNeed=feed*gameState.pawns; if(foodFeedNeed>foodAfterPlanting){ failValidation(`Not enough food to feed! Need ${foodFeedNeed}, have ${Math.floor(foodAfterPlanting)} left.`); }}
    if(validationFailed) return;

    // --- Process Turn ---
    nextTurnBtn.disabled=true; // Disable during processing

    // Apply Costs/Changes
    if(buyLand>0){ gameState.food-=buyLand*gameState.landPrice; gameState.land+=buyLand; turnMessages.push(`Bought ${buyLand} acres.`); }
    else if(sellLand>0){ gameState.food+=sellLand*gameState.landPrice; gameState.land-=sellLand; turnMessages.push(`Sold ${sellLand} acres.`); }
    if(plant>0){ gameState.food-=plant; turnMessages.push(`Used ${plant} bushels for planting.`); }
    const totalFoodUsedForFeeding=feed*gameState.pawns; if(totalFoodUsedForFeeding>0) gameState.food-=totalFoodUsedForFeeding; if(totalFoodUsedForFeeding>0) turnMessages.push(`Used ${totalFoodUsedForFeeding} bushels for feeding.`);

    // Outcomes
    const yieldPerAcre=Math.floor(Math.random()*5)+2; const foodHarvested=plant*yieldPerAcre; if(plant > 0) gameState.food+=foodHarvested; if(plant > 0) turnMessages.push(`Harvested ${foodHarvested} bushels (${yieldPerAcre}/acre).`);

    // Starvation Failsafe (if food somehow went negative)
    if(gameState.food<0){ const foodShortage=Math.abs(gameState.food); const minFeed=Math.max(1,feed); const pawnsStarved=Math.min(gameState.pawns,Math.ceil(foodShortage/minFeed)); gameState.pawns-=pawnsStarved; turnMessages.push(`!!! STARVATION !!! ${pawnsStarved} pawns died!`); gameState.food=0; }

    // Population Changes & Random Events (only if pawns still > 0)
    if(gameState.pawns>0){ let pawnsGained=0, pawnsLost=0; if(feed>=2){ pawnsGained=Math.min(50,Math.floor(Math.random()*(gameState.pawns*0.1)+1)); gameState.pawns+=pawnsGained; if(pawnsGained>0) turnMessages.push(`${pawnsGained} new pawns arrived.`); } else if(feed<1){ pawnsLost=Math.min(gameState.pawns,Math.floor(Math.random()*(gameState.pawns*0.15)+1)); gameState.pawns-=pawnsLost; if(pawnsLost>0) turnMessages.push(`${pawnsLost} pawns left.`); }
    const eventChance=Math.random(); if(eventChance<0.15&&gameState.food>10){ const foodLost=Math.max(1,Math.floor(gameState.food*(Math.random()*0.2+0.1))); gameState.food-=foodLost; turnMessages.push(`Rats ate ${foodLost} bushels.`); } else if(eventChance>=0.15&&eventChance<0.30&&foodHarvested>0){ const foodGained=Math.max(1,Math.floor(foodHarvested*(Math.random()*0.2+0.1))); gameState.food+=foodGained; turnMessages.push(`Bonus harvest: +${foodGained} bushels.`); } else if(eventChance>=0.30&&eventChance<0.40&&gameState.pawns>0){ let plagueVictims=Math.min(gameState.pawns,Math.max(1,Math.floor(gameState.pawns*(Math.random()*0.3+0.1)))); gameState.pawns-=plagueVictims; turnMessages.push(`A plague killed ${plagueVictims} pawns.`); }}

    // --- Final Check for Game Over THIS Turn ---
    if (gameState.pawns <= 0) {
        gameState.pawns = 0; // Ensure exactly 0
        turnMessages.push("--- GAME OVER ---");
        turnMessages.push(`All your pawns perished in year ${gameState.year}!`);
        if(messageEl) messageEl.innerHTML = turnMessages.join("<br>");
        saveLocalRecord(roundNumber, gameState.year, 0); // Save local score
        addGlobalRecord(playerName, gameState.year, 0); // Save global score
        updateUI();
        // Button remains disabled as gameEnded is now true
        return;
    }

    // --- If game continues: Prepare for Next Turn ---
    gameState.year++;
    gameState.landPrice = Math.floor(Math.random() * 11) + 18; // New land price
    updateUI();
    if(messageEl) messageEl.innerHTML = turnMessages.join("<br>");
    if(buyLandInput) buyLandInput.value=0; if(sellLandInput) sellLandInput.value=0; if(plantInput) plantInput.value=0; if(feedInput) feedInput.value=0;
    nextTurnBtn.disabled = false; // Re-enable for next decision
}


/***********************************************
 *          Initialization & Listeners         *
 ***********************************************/
document.addEventListener('DOMContentLoaded', () => {
    setupVolumeControl();
    updateGlobalLeaderboard();
    displayGlobalGamesPlayed();
    updateRankingBoard(); // Show session rankings on load
});
if (startGameBtn) { startGameBtn.addEventListener("click", startGameNow); }
if (playerNameInput) { playerNameInput.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); startGameNow(); } }); }
if (nextTurnBtn) { nextTurnBtn.addEventListener('click', processTurn); }
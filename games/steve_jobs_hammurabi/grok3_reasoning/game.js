/***********************************************
 *  Firebase Initialization & Global Vars      *
 ***********************************************/

// IMPORTANT: REPLACE THIS WITH YOUR *PRODUCTION* FIREBASE CONFIG
const firebaseConfig = {
    apiKey: "AIzaSyBop7YMrZIO05yknhCm_mqjbtXP_Gl58sE", // REPLACE
    authDomain: "cosmicdodge-5ae20.firebaseapp.com", // REPLACE
    projectId: "cosmicdodge-5ae20", // REPLACE
    storageBucket: "cosmicdodge-5ae20.appspot.com", // REPLACE
    messagingSenderId: "940230809594", // REPLACE
    appId: "1:940230809594:web:0b3b1dabe1e5c2f5f47643" // REPLACE
};
// --- End of config to replace ---

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

const version = 'grok3_reasoning';
const gameTitle = 'steve_jobs_hammurabi';
const maxYears = 10; // Game runs for 10 years (0-9)
const leaderboardCollection = `leaderboard_${gameTitle}_${version}`;
const statsDoc = `stats_${gameTitle}_${version}`;
const volumeKey = `${gameTitle}_volume_v2`;

let playerName = ""; let gameStarted = false; let gameEnded = false;
let currentSessionRoundNumber = 0; let localSessionRankings = {};
let gameState = {};

// DOM Elements (assuming they are correctly defined as before)
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
const rankingContentEl = document.getElementById('rankingContent');
const globalRankingContentStart = document.getElementById('globalRankingContentStart');
const globalRankingContentGame = document.getElementById('globalRankingContentGame');
const globalGamesPlayedStart = document.getElementById("globalGamesPlayedStart");
const globalGamesPlayedGame = document.getElementById("globalGamesPlayedGame");


/***********************************************
 *           Volume Control Logic              *
 ***********************************************/
 function setupVolumeControl() { /* ... no changes ... */
    if (!backgroundMusic || !volumeSlider) return; const savedVolume = localStorage.getItem(volumeKey); let currentVolume = 0.5; if (savedVolume !== null && !isNaN(parseFloat(savedVolume))) currentVolume = parseFloat(savedVolume); volumeSlider.value = currentVolume; backgroundMusic.volume = currentVolume; volumeSlider.addEventListener('input', () => { const newVolume = parseFloat(volumeSlider.value); backgroundMusic.volume = newVolume; try { localStorage.setItem(volumeKey, newVolume.toString()); } catch (e) { console.error("Failed to save volume:", e); } });
}

/***********************************************
 *       Firestore Leaderboard & Stats         *
 ***********************************************/
function updateGlobalLeaderboard() { /* ... no changes, retained debug logs ... */
    console.log(`Fetching leaderboard from: ${leaderboardCollection}`); db.collection(leaderboardCollection).orderBy("finalPawns", "desc").orderBy("timestamp", "desc").limit(50).get()
    .then((querySnapshot) => { let html = '<ol>'; const uniqueEntries = []; const playersSeen = new Set(); const maxDisplay = 10; console.log(`Leaderboard snapshot size: ${querySnapshot.size}`); if (!querySnapshot.empty) { querySnapshot.forEach((doc) => { const data = doc.data(); console.log("Leaderboard Doc:", doc.id, JSON.stringify(data)); if (data && typeof data.finalPawns !== 'undefined') { const pName = data.playerName || 'Anon'; if (!playersSeen.has(pName.toLowerCase()) && uniqueEntries.length < maxDisplay) { uniqueEntries.push(`<li>${pName}: ${data.finalPawns} pawns</li>`); playersSeen.add(pName.toLowerCase()); } } else { console.warn("Skipping leaderboard doc with missing data:", doc.id); } }); } console.log("Unique entries found:", uniqueEntries.length); if (uniqueEntries.length === 0) { html = '<p>No scores yet. Be the first!</p>'; } else { html += uniqueEntries.join(''); html += '</ol>'; } if (globalRankingContentStart) globalRankingContentStart.innerHTML = html; if (globalRankingContentGame) globalRankingContentGame.innerHTML = html; })
    .catch((error) => { console.error("Error getting global leaderboard:", error); const errorMsg = "<p>Error loading leaderboard.</p>"; if (globalRankingContentStart) globalRankingContentStart.innerHTML = errorMsg; if (globalRankingContentGame) globalRankingContentGame.innerHTML = errorMsg; });
}
function addGlobalRecord(pName, finalPawns, finalYear) { /* ... no changes, retained debug logs ... */
    if (gameEnded) { return; } const pawnsToSave = Math.max(0, finalPawns); console.log(`Attempting to add global record: P: ${pName}, Pawns: ${pawnsToSave}, Year: ${finalYear}, V: ${version}`);
    db.collection(leaderboardCollection).add({ playerName: pName || "Anon", finalPawns: pawnsToSave, finalYear: finalYear, version: version, timestamp: firebase.firestore.FieldValue.serverTimestamp() })
    .then((docRef) => { console.log(`Global record added successfully with ID: ${docRef.id}`); updateGlobalLeaderboard(); })
    .catch((error) => { console.error("!!! Error adding global record:", error); });
}
function incrementGlobalGamesPlayed() { /* ... no changes ... */
    db.collection("globalStats").doc(statsDoc).set({ totalGamesPlayed: firebase.firestore.FieldValue.increment(1), gameTitle: gameTitle, version: version }, { merge: true })
    .then(() => { console.log("Total games incremented."); displayGlobalGamesPlayed(); }).catch(console.error);
}
function displayGlobalGamesPlayed() { /* ... no changes ... */
    db.collection("globalStats").doc(statsDoc).get().then((doc) => { const total = doc.exists ? (doc.data().totalGamesPlayed || 0) : 0; const text = `(Total games played worldwide: ${total})`; if (globalGamesPlayedStart) globalGamesPlayedStart.innerText = text; if (globalGamesPlayedGame) globalGamesPlayedGame.innerText = text; })
    .catch((error) => { console.error("Error reading total games:", error); const errorText = "(Total games played worldwide: Error)"; if (globalGamesPlayedStart) globalGamesPlayedStart.innerText = errorText; if (globalGamesPlayedGame) globalGamesPlayedGame.innerText = errorText; });
}

/***********************************************
 *      Local Ranking (Page Load Only)         *
 ***********************************************/
 function updateRankingBoard() { /* ... no changes ... */
    if (!rankingContentEl) return; const rankingsList = Object.values(localSessionRankings); const sortedRankings = rankingsList.sort((a, b) => b.pawns - a.pawns); let html = ''; if (sortedRankings.length === 0) { html = '<p>No games completed yet.</p>'; } else { html = '<ol>'; sortedRankings.slice(0, 10).forEach((entry) => { html += `<li>Game ${entry.round}: ${entry.pawns} pawns</li>`; }); html += '</ol>'; } rankingContentEl.innerHTML = html;
}
function saveLocalRecord(roundNum, finalPawns) { /* ... no changes ... */
     const pawnsToSave = Math.max(0, finalPawns); localSessionRankings[pawnsToSave] = { round: roundNum, pawns: pawnsToSave }; updateRankingBoard();
}

 /***********************************************
 *          Name Validation                 *
 ***********************************************/
 function isNameOffensive(name) { /* ... no changes ... */
     if (typeof offensiveWords === 'undefined') { console.warn("Offensive words list (blocklist.js) not loaded!"); return false; } if (!name) return false; const lowerCaseName = name.toLowerCase(); for (const word of offensiveWords) { if (lowerCaseName.includes(word)) { console.log(`Offensive substring found: ${word} in ${name}`); return true; } } return false;
 }

/***********************************************
 *         Game State & UI Updates             *
 ***********************************************/
function resetGameUIAndState(isRestart = false) { /* ... no changes ... */
    gameState = { year: 0, food: 1000, land: 100, pawns: 100, landPrice: Math.floor(Math.random()*11)+18 }; gameEnded = false;
    if(buyLandInput) buyLandInput.value=0; if(sellLandInput) sellLandInput.value=0; if(plantInput) plantInput.value=0; if(feedInput) feedInput.value=0; if(messageEl) messageEl.innerHTML= isRestart ? "Starting a new game." : "A new era begins. Rule wisely for 10 years!";
    if(nextTurnBtn) { nextTurnBtn.disabled=false; nextTurnBtn.textContent = "Confirm Decisions & End Year"; nextTurnBtn.classList.remove('game-over-button'); nextTurnBtn.removeEventListener('click', startNewGameHandler); nextTurnBtn.removeEventListener('click', processTurn); nextTurnBtn.addEventListener('click', processTurn); }
    updateUI();
}
function updateUI() {
    if(!gameStarted) return;
    // FIXED: Display should show X / 10 for years 0 through 9
    if(yearEl) yearEl.textContent=`${gameState.year} / ${maxYears}`; // Shows 0/10, 1/10 ... 9/10
    if(decisionYearEl) decisionYearEl.textContent=gameState.year;
    if(foodEl) foodEl.textContent=Math.floor(gameState.food); if(landEl) landEl.textContent=gameState.land; if(pawnsEl) pawnsEl.textContent=gameState.pawns; if(landPriceEl) landPriceEl.textContent=gameState.landPrice;
}

/***********************************************
 *    Start, Restart & Game Over Logic         *
 ***********************************************/
function startGameNow() { /* ... no changes ... */
    const nameInput = playerNameInput.value.trim(); if (nameInput === "") { alert("Please enter a player name."); return; } if (isNameOffensive(nameInput)) { alert("Please choose a more appropriate player name."); return; } playerName = nameInput.substring(0, 10); if(startScreen) startScreen.style.display="none"; if(gameContainer) gameContainer.style.display="flex"; gameStarted = true; currentSessionRoundNumber = 1; localSessionRankings = {}; resetGameUIAndState(false); updateRankingBoard(); updateGlobalLeaderboard(); displayGlobalGamesPlayed(); setupVolumeControl(); if (backgroundMusic) { backgroundMusic.play().catch(error => { console.log("Music autoplay prevented:", error); if(messageEl) messageEl.innerHTML += "<br><small>(Music autoplay blocked. Adjust volume.)</small>"; }); } else { console.error("Background music element not found!"); }
}

function handleGameOver(messagePrefix = "GAME OVER") { /* ... no changes ... */
    if (gameEnded) return; gameEnded = true; console.log("handleGameOver called"); const finalPawns = gameState.pawns; const finalYearReached = gameState.year; if (messageEl) { let endMessage = `${messagePrefix}<br>`; if (finalPawns <= 0) { endMessage += `Your civilization collapsed in year ${finalYearReached}! Final Pawn Count: 0.`; } else if (finalYearReached >= maxYears) { endMessage += `You completed ${maxYears} years! Final Pawn Count: ${finalPawns}.`; } else { endMessage += `Game ended unexpectedly in year ${finalYearReached}. Final Pawn Count: ${finalPawns}.`; } messageEl.innerHTML = endMessage; } saveLocalRecord(currentSessionRoundNumber, finalPawns); addGlobalRecord(playerName, finalPawns, finalYearReached); incrementGlobalGamesPlayed(); if(nextTurnBtn) { nextTurnBtn.textContent = "Start New Game"; nextTurnBtn.classList.add('game-over-button'); nextTurnBtn.removeEventListener('click', processTurn); nextTurnBtn.removeEventListener('click', startNewGameHandler); nextTurnBtn.addEventListener('click', startNewGameHandler); nextTurnBtn.disabled = false; }
}

function startNewGameHandler() { /* ... no changes ... */
    console.log("Starting new game..."); currentSessionRoundNumber++; resetGameUIAndState(true);
}


/***********************************************
 *          Hammurabi Game Turn Logic          *
 ***********************************************/
function processTurn() {
    // --- Check Game Over Conditions AT THE START ---
    // FIXED: Year check: Game runs years 0-9. If year is 10, it's over.
    if (gameState.year >= maxYears) {
        console.log(`ProcessTurn START: Year (${gameState.year}) is >= maxYears (${maxYears}). Ending game.`);
        // Ensure UI shows final state before ending if needed
        updateUI();
        handleGameOver(`You completed ${maxYears} years!`);
        return;
    }
    if (gameState.pawns <= 0) {
        console.log("ProcessTurn START: Pawns <= 0. Ending game.");
        // Ensure UI shows 0 pawns before ending
        updateUI();
        handleGameOver("Your civilization collapsed!");
        return;
    }
    if (gameEnded) { console.log("ProcessTurn START: Game ended flag is true. Stopping."); return; }

    // --- If game is active ---
    if (!gameStarted || !nextTurnBtn) return;
    console.log(`Processing decisions for year: ${gameState.year}`);

    const buyLand=parseInt(buyLandInput?.value??0)||0, sellLand=parseInt(sellLandInput?.value??0)||0, plant=parseInt(plantInput?.value??0)||0, feed=parseInt(feedInput?.value??0)||0;
    if(messageEl) messageEl.textContent=""; let turnMessages=[]; let validationFailed=false;
    function failValidation(msg) { if(messageEl) messageEl.innerHTML = `<span style="color: #ff6666;">${msg}</span>`; validationFailed=true; }

    // --- Input Validation --- (No changes)
    if(buyLand<0||sellLand<0||plant<0||feed<0){ failValidation("Non-negative values only."); } else if(buyLand>0&&sellLand>0){ failValidation("Cannot buy AND sell land."); } else if(buyLand*gameState.landPrice > gameState.food){ failValidation(`Not enough food to buy ${buyLand} acres.`); } else if(sellLand > gameState.land){ failValidation(`Not enough land to sell.`); } else { const foodAfterLandDeals = gameState.food - (buyLand*gameState.landPrice) + (sellLand*gameState.landPrice); const landAfterLandDeals = gameState.land + buyLand - sellLand; if (plant > foodAfterLandDeals) { failValidation(`Not enough food to plant.`); } else if (plant > landAfterLandDeals) { failValidation(`Not enough land to plant.`); } else if (plant > gameState.pawns * 10) { failValidation(`Not enough pawns to tend ${plant} acres.`); } else { const foodAfterPlanting = foodAfterLandDeals - plant; const foodFeedNeed = feed * gameState.pawns; if(foodFeedNeed > foodAfterPlanting){ failValidation(`Not enough food to feed.`); }}}
    if(validationFailed) return;

    // --- Process Turn ---
    nextTurnBtn.disabled=true;

    // Apply Costs/Changes, Harvest (No changes)
    if(buyLand>0){ gameState.food-=buyLand*gameState.landPrice; gameState.land+=buyLand; turnMessages.push(`Bought ${buyLand} acres.`); } else if(sellLand>0){ gameState.food+=sellLand*gameState.landPrice; gameState.land-=sellLand; turnMessages.push(`Sold ${sellLand} acres.`); } if(plant>0){ gameState.food-=plant; turnMessages.push(`Used ${plant} bushels for planting.`); } const totalFoodUsedForFeeding=feed*gameState.pawns; if(totalFoodUsedForFeeding>0) { gameState.food-=totalFoodUsedForFeeding; turnMessages.push(`Used ${totalFoodUsedForFeeding} bushels to feed.`); }
    const yieldPerAcre=Math.floor(Math.random()*5)+2; const foodHarvested=plant*yieldPerAcre; if(plant > 0) { gameState.food+=foodHarvested; turnMessages.push(`Harvested ${foodHarvested} bushels (${yieldPerAcre}/acre).`); } else { turnMessages.push("No crops planted."); }

    // --- Starvation Check (REVISED for potential 100% death) ---
    let pawnsStarved = 0;
    const requiredFoodPerPawn = 20; // Base survival need
    const criticalFeedThreshold = 5; // Below this, starvation is catastrophic (adjust as needed)

    if (feed <= 0 && gameState.pawns > 0) { // Fed zero or negative? Instant death.
        pawnsStarved = gameState.pawns;
        turnMessages.push(`<span style="color: red;">CATASTROPHE! ${pawnsStarved} pawns died instantly from zero feeding!</span>`);
    } else if (feed < criticalFeedThreshold && gameState.pawns > 0) { // Fed critically low amount
        // Calculate starvation based on how far below critical threshold they are fed
        // Example: If fed 2 (critical is 5), deficit ratio is (5-2)/5 = 0.6. Apply this ratio *aggressively*.
        const criticalDeficitRatio = (criticalFeedThreshold - feed) / criticalFeedThreshold;
        // Make it highly likely to wipe out (e.g., square the ratio, or use a steeper curve)
        const starvationFraction = Math.min(1, criticalDeficitRatio * criticalDeficitRatio * 2); // Example aggressive calculation
        pawnsStarved = Math.min(gameState.pawns, Math.ceil(gameState.pawns * starvationFraction)); // Ceil ensures at least 1 dies if fraction > 0
        if (pawnsStarved > 0) turnMessages.push(`<span style="color: red;">CRITICAL FEEDING! ${pawnsStarved} pawns died due to extreme shortage!</span>`);
    } else if (totalFoodUsedForFeeding < requiredFoodPerPawn * gameState.pawns && gameState.pawns > 0) { // Fed less than needed, but above critical
        const foodDeficit = (requiredFoodPerPawn * gameState.pawns) - totalFoodUsedForFeeding;
        const maxNormalStarvationFraction = 0.45; // Normal cap
        const starvationFraction = Math.min(maxNormalStarvationFraction, foodDeficit / (requiredFoodPerPawn * gameState.pawns));
        pawnsStarved = Math.min(gameState.pawns, Math.floor(gameState.pawns * starvationFraction));
        if (pawnsStarved > 0) turnMessages.push(`<span style="color: red;">STARVATION! ${pawnsStarved} pawns died from lack of food!</span>`);
    }

    // Apply starvation deaths
    if (pawnsStarved > 0) {
        gameState.pawns -= pawnsStarved;
    }

    // Check for negative food state (e.g., rats after spending) -> leads to more deaths if pawns remain
    if (gameState.food < 0 && gameState.pawns > 0) {
        const extraShortage = Math.abs(gameState.food);
        // Use a harsher divisor? If food is negative, it's really bad.
        const additionalStarved = Math.min(gameState.pawns, Math.ceil(extraShortage / (requiredFoodPerPawn / 2))); // Die faster if absolute shortage
        if (additionalStarved > 0) {
            gameState.pawns -= additionalStarved;
            turnMessages.push(`<span style="color: red;">FINANCIAL COLLAPSE! ${additionalStarved} more died from debt/shortage!</span>`);
        }
        gameState.food = 0; // Food cannot be negative
    }

    // Population Changes & Random Events (only if pawns > 0 AFTER starvation)
    if(gameState.pawns > 0){
        let pawnsGained=0, pawnsLeft=0;
        const immigrationChance = (feed / 30); // Based on planned feed, maybe change?
        if (Math.random() < immigrationChance) { pawnsGained = Math.min(50, Math.floor(Math.random() * (gameState.pawns * 0.1 + gameState.land * 0.01) + 1)); gameState.pawns += pawnsGained; if (pawnsGained > 0) turnMessages.push(`${pawnsGained} new pawns arrived.`); }
        // Emigration less likely now, starvation handles low feed better
        if (feed < requiredFoodPerPawn / 2 && Math.random() < 0.05) { /* Reduced chance */ pawnsLeft = Math.min(gameState.pawns, Math.floor(Math.random() * (gameState.pawns * 0.05) + 1)); gameState.pawns -= pawnsLeft; if (pawnsLeft > 0) turnMessages.push(`${pawnsLeft} pawns left.`); }
        // Random Events (no change)
        const eventChance=Math.random(); if(eventChance<0.15 && gameState.food>10){ const foodLost=Math.max(1,Math.floor(gameState.food*(Math.random()*0.2+0.1))); gameState.food-=foodLost; turnMessages.push(`<span style="color: orange;">Rats! Lost ${foodLost} bushels.</span>`); } else if(eventChance>=0.15&&eventChance<0.25 && foodHarvested>0){ const foodGained=Math.max(1,Math.floor(foodHarvested*(Math.random()*0.1+0.05))); gameState.food+=foodGained; turnMessages.push(`<span style="color: lightgreen;">Bonus harvest! +${foodGained} bushels.</span>`); } else if(eventChance>=0.30&&eventChance<0.40 && gameState.pawns>10){ let plagueVictims=Math.min(gameState.pawns,Math.max(1,Math.floor(gameState.pawns*(Math.random()*0.3+0.1)))); gameState.pawns-=plagueVictims; turnMessages.push(`<span style="color: red;">Plague! ${plagueVictims} died.</span>`); }
    }

    // --- Check for pawn death AFTER all calculations for the current year ---
    if (gameState.pawns <= 0) {
        console.log(`ProcessTurn END: Pawns died in year ${gameState.year}. Ending game.`);
        updateUI(); // Show 0 pawns
        handleGameOver("Your civilization collapsed!");
        return; // Stop
    }

    // --- If game continues: Advance year and prepare UI for the *next* year's decisions ---
    gameState.year++; // Year 0->1, 1->2, ..., 9->10
    gameState.landPrice = Math.floor(Math.random() * 11) + 18;

    // Update UI showing results of the year just passed, and the new year number/land price
    updateUI();
    if(messageEl) messageEl.innerHTML = turnMessages.join("<br>");

    // --- Final Check: Does the year increment mean the game just ended? ---
    // If the year is now >= maxYears (i.e., 10), it means year 9 just finished.
    if (gameState.year >= maxYears) {
        console.log(`ProcessTurn END: Year incremented to ${gameState.year}. Max years reached. Ending game.`);
        handleGameOver(`You completed ${maxYears} years!`);
    } else {
        // Game continues, reset inputs for the next turn (year gameState.year)
        if(buyLandInput) buyLandInput.value=0; if(sellLandInput) sellLandInput.value=0; if(plantInput) plantInput.value=0; if(feedInput) feedInput.value=0;
        nextTurnBtn.disabled = false; // Re-enable button
    }
}


/***********************************************
 *          Initialization & Listeners         *
 ***********************************************/
document.addEventListener('DOMContentLoaded', () => { /* ... no changes ... */
    currentSessionRoundNumber = 0; localSessionRankings = {}; setupVolumeControl(); updateGlobalLeaderboard(); displayGlobalGamesPlayed(); updateRankingBoard();
});
if (startGameBtn) { startGameBtn.addEventListener("click", startGameNow); } if (playerNameInput) { playerNameInput.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); startGameNow(); } }); }
// Initial 'processTurn' listener added in 'resetGameUIAndState'
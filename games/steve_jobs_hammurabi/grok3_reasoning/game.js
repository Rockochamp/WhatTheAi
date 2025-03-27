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
const maxYears = 10;
const leaderboardCollection = `leaderboard_${gameTitle}_${version}`;
const statsDoc = `stats_${gameTitle}_${version}`;
const volumeKey = `${gameTitle}_volume_v2`;

// --- Global State (Reset on Load) ---
let playerName = "";
let gameStarted = false;
let gameEnded = false;
let currentSessionRoundNumber = 0; // Tracks rounds *within this page load*
let localSessionRankings = {}; // Stores { pawns: { round: X, pawns: Y } } *within this page load* - Overwrites same pawn count

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
const rankingContentEl = document.getElementById('rankingContent');
const globalRankingContentStart = document.getElementById('globalRankingContentStart');
const globalRankingContentGame = document.getElementById('globalRankingContentGame');
const globalGamesPlayedStart = document.getElementById("globalGamesPlayedStart");
const globalGamesPlayedGame = document.getElementById("globalGamesPlayedGame");

let gameState = {};


/***********************************************
 *           Volume Control Logic              *
 ***********************************************/
 function setupVolumeControl() {
    if (!backgroundMusic || !volumeSlider) { console.warn("Volume elements not found."); return; }
    const savedVolume = localStorage.getItem(volumeKey); let currentVolume = 0.5; // Volume uses localStorage
    if (savedVolume !== null && !isNaN(parseFloat(savedVolume))) { currentVolume = parseFloat(savedVolume); }
    volumeSlider.value = currentVolume; backgroundMusic.volume = currentVolume;
    volumeSlider.addEventListener('input', () => { const newVolume = parseFloat(volumeSlider.value); backgroundMusic.volume = newVolume; try { localStorage.setItem(volumeKey, newVolume.toString()); } catch (e) { console.error("Failed to save volume:", e); } });
}

/***********************************************
 *       Firestore Leaderboard & Stats         *
 ***********************************************/
function updateGlobalLeaderboard() {
    db.collection(leaderboardCollection).orderBy("finalPawns", "desc").orderBy("timestamp", "desc").limit(50).get()
    .then((querySnapshot) => {
        let html = '<ol>'; const uniqueEntries = []; const playersSeen = new Set(); const maxDisplay = 10;
        if (!querySnapshot.empty) {
            querySnapshot.forEach((doc) => {
                const data = doc.data(); const pName = data.playerName || 'Anon';
                if (!playersSeen.has(pName.toLowerCase()) && uniqueEntries.length < maxDisplay) {
                    uniqueEntries.push(`<li>${pName}: ${data.finalPawns} pawns</li>`); playersSeen.add(pName.toLowerCase());
                }
            });
        }
        if (uniqueEntries.length === 0) { html = '<p>No scores yet. Be the first!</p>'; }
        else { html += uniqueEntries.join(''); html += '</ol>'; }
        if (globalRankingContentStart) globalRankingContentStart.innerHTML = html; if (globalRankingContentGame) globalRankingContentGame.innerHTML = html;
    })
    .catch((error) => { console.error("Error getting global leaderboard:", error); const errorMsg = "<p>Error loading leaderboard.</p>"; if (globalRankingContentStart) globalRankingContentStart.innerHTML = errorMsg; if (globalRankingContentGame) globalRankingContentGame.innerHTML = errorMsg; });
}

function addGlobalRecord(pName, finalPawns, finalYear) {
    if (gameEnded) { console.log("Score already submitted for this game."); return; } // Should be protected by triggerGameOver's flag too
    const pawnsToSave = Math.max(0, finalPawns);
    // gameEnded is set in triggerGameOver *before* calling this

    db.collection(leaderboardCollection).add({
        playerName: pName || "Anon", finalPawns: pawnsToSave, finalYear: finalYear, version: version, timestamp: firebase.firestore.FieldValue.serverTimestamp()
    })
    .then(() => { console.log(`Global record added: ${pName || 'Anon'}, Pawns ${pawnsToSave}, Year ${finalYear}`); updateGlobalLeaderboard(); })
    .catch((error) => { console.error("Error adding global record:", error); /* Maybe allow retry? gameEnded is still true */ });
}

// MOVED: Called only on game over
function incrementGlobalGamesPlayed() {
    db.collection("globalStats").doc(statsDoc).set({
        totalGamesPlayed: firebase.firestore.FieldValue.increment(1), gameTitle: gameTitle, version: version }, { merge: true })
        .then(() => { console.log("Total games incremented."); displayGlobalGamesPlayed(); }).catch(console.error);
}
function displayGlobalGamesPlayed() {
    db.collection("globalStats").doc(statsDoc).get().then((doc) => {
        const total = doc.exists ? (doc.data().totalGamesPlayed || 0) : 0; const text = `(Total games played worldwide: ${total})`;
        if (globalGamesPlayedStart) globalGamesPlayedStart.innerText = text; if (globalGamesPlayedGame) globalGamesPlayedGame.innerText = text; })
        .catch((error) => { console.error("Error reading total games:", error); const errorText = "(Total games played worldwide: Error)"; if (globalGamesPlayedStart) globalGamesPlayedStart.innerText = errorText; if (globalGamesPlayedGame) globalGamesPlayedGame.innerText = errorText; });
}

/***********************************************
 *      Local Ranking (Page Load Only)         *
 ***********************************************/
 function updateRankingBoard() {
    if (!rankingContentEl) return;
    // Read directly from the global variable object
    const rankingsList = Object.values(localSessionRankings);
    // Sort by pawns descending
    const sortedRankings = rankingsList.sort((a, b) => b.pawns - a.pawns);

    let html = '';
    if (sortedRankings.length === 0) { html = '<p>No games completed yet.</p>'; }
    else {
        html = '<ol>';
        sortedRankings.slice(0, 10).forEach((entry) => {
            html += `<li>Game ${entry.round}: ${entry.pawns} pawns</li>`;
        });
        html += '</ol>';
    }
    rankingContentEl.innerHTML = html;
}

function saveLocalRecord(roundNum, finalPawns) {
     // Save directly to the global variable object, using pawns as key
     const pawnsToSave = Math.max(0, finalPawns);
     // This overwrites any previous game in this session with the same pawn count
     localSessionRankings[pawnsToSave] = { round: roundNum, pawns: pawnsToSave };
     updateRankingBoard(); // Update display
}

 /***********************************************
 *          Name Validation (Improved)         *
 ***********************************************/
 function isNameOffensive(name) {
     // Uses blocklist.js
     if (typeof offensiveWords === 'undefined') { console.warn("Offensive words list (blocklist.js) not loaded!"); return false; }
     if (!name) return false; const lowerCaseName = name.toLowerCase();
     for (const word of offensiveWords) {
         // CHANGED: Use includes for substring matching as requested
         if (lowerCaseName.includes(word)) {
             console.log(`Offensive substring found: ${word} in ${name}`);
             return true;
         }
     }
     return false;
 }

/***********************************************
 *         Game State & UI Updates             *
 ***********************************************/
function resetGameUIAndState(isRestart = false) {
    // Start at year 0
    gameState = { year: 0, food: 1000, land: 100, pawns: 100, landPrice: Math.floor(Math.random()*11)+18 };
    gameEnded = false;
    if(buyLandInput) buyLandInput.value=0; if(sellLandInput) sellLandInput.value=0; if(plantInput) plantInput.value=0; if(feedInput) feedInput.value=0;
    if(messageEl) messageEl.innerHTML= isRestart ? "Starting a new game." : "A new era begins. Rule wisely for 10 years!";
    if(nextTurnBtn) {
        nextTurnBtn.disabled=false;
        nextTurnBtn.textContent = "Confirm Decisions & End Year"; // Reset button text
        // Remove potential 'startNewGameHandler' and ensure 'processTurn' is the listener
        nextTurnBtn.removeEventListener('click', startNewGameHandler);
        nextTurnBtn.removeEventListener('click', processTurn); // Remove first to avoid duplicates
        nextTurnBtn.addEventListener('click', processTurn);
    }
    updateUI();
}
function updateUI() {
    if(!gameStarted) return;
    // Update year display correctly for 0-10 range
    if(yearEl) yearEl.textContent=`${gameState.year} / ${maxYears}`;
    if(decisionYearEl) decisionYearEl.textContent=gameState.year; // Show current year for decisions
    if(foodEl) foodEl.textContent=Math.floor(gameState.food);
    if(landEl) landEl.textContent=gameState.land;
    if(pawnsEl) pawnsEl.textContent=gameState.pawns;
    if(landPriceEl) landPriceEl.textContent=gameState.landPrice;
}

/***********************************************
 *    Start, Restart & Game Over Logic         *
 ***********************************************/
function startGameNow() {
    const nameInput = playerNameInput.value.trim();
    if (nameInput === "") { alert("Please enter a player name."); return; }
    if (isNameOffensive(nameInput)) { alert("Please choose a more appropriate player name."); return; }
    playerName = nameInput.substring(0, 10);

    if(startScreen) startScreen.style.display="none";
    if(gameContainer) gameContainer.style.display="flex";

    gameStarted = true;
    currentSessionRoundNumber = 1; // Start round count for this session
    localSessionRankings = {}; // Clear local rankings for this session

    resetGameUIAndState(false); // Initial setup

    // Update displays (global count NOT incremented here)
    updateRankingBoard();
    updateGlobalLeaderboard();
    displayGlobalGamesPlayed();

    setupVolumeControl();
    if (backgroundMusic) { backgroundMusic.play().catch(error => { console.log("Music autoplay prevented:", error); if(messageEl) messageEl.innerHTML += "<br><small>(Music autoplay blocked. Adjust volume.)</small>"; });
    } else { console.error("Background music element not found!"); }
}

// Renamed from triggerGameOver for clarity
function handleGameOver(messagePrefix = "GAME OVER") {
    if (gameEnded) return; // Prevent double execution
    gameEnded = true; // Set flag immediately

    const finalPawns = gameState.pawns;
    // The game ends *after* year 10 is completed, so year would be 11. Let's record year 10.
    const finalYearCompleted = Math.min(maxYears, gameState.year);

    if (messageEl) {
        let endMessage = `${messagePrefix}<br>`;
        if (finalPawns <= 0) {
            endMessage += `Your civilization collapsed in year ${finalYearCompleted}! Final Pawn Count: 0.`;
        } else {
            endMessage += `You completed ${maxYears} years! Final Pawn Count: ${finalPawns}.`;
        }
        messageEl.innerHTML = endMessage;
    }

    saveLocalRecord(currentSessionRoundNumber, finalPawns);
    addGlobalRecord(playerName, finalPawns, finalYearCompleted); // Save final state
    incrementGlobalGamesPlayed(); // Count the completed game

    // Change button to 'Start New Game'
    if(nextTurnBtn) {
        nextTurnBtn.textContent = "Start New Game";
        nextTurnBtn.removeEventListener('click', processTurn); // Remove old listener
        nextTurnBtn.addEventListener('click', startNewGameHandler); // Add new listener
        nextTurnBtn.disabled = false; // Ensure it's clickable
    }
}

// Handles click on the "Start New Game" button
function startNewGameHandler() {
    console.log("Starting new game from handler...");
    currentSessionRoundNumber++; // Increment round for the new game
    resetGameUIAndState(true); // Reset state and UI, including button listener
}


/***********************************************
 *          Hammurabi Game Turn Logic          *
 ***********************************************/
function processTurn() {
    // Check for game over conditions FIRST (pawns <= 0)
     if (gameState.pawns <= 0) {
        handleGameOver("Your civilization collapsed!");
        return; // Stop processing if already over due to pawns
    }
    // Check if max years completed (game ends AFTER year 10 is done)
    // gameState.year is the year *about to start* or just completed.
    // If gameState.year is currently 10, this is the *last* turn to process.
    // If it becomes 11 *after* this turn, the game ends.

    if (!gameStarted || gameEnded || !nextTurnBtn) return;

    const buyLand=parseInt(buyLandInput?.value??0)||0, sellLand=parseInt(sellLandInput?.value??0)||0, plant=parseInt(plantInput?.value??0)||0, feed=parseInt(feedInput?.value??0)||0;
    if(messageEl) messageEl.textContent=""; let turnMessages=[]; let validationFailed=false;
    function failValidation(msg) { if(messageEl) messageEl.innerHTML = `<span style="color: #ff6666;">${msg}</span>`; validationFailed=true; }

    // --- Input Validation --- (No changes)
    if(buyLand<0||sellLand<0||plant<0||feed<0){ failValidation("Please enter non-negative values."); }
    else if(buyLand>0&&sellLand>0){ failValidation("Cannot buy AND sell land."); }
    else if(buyLand*gameState.landPrice > gameState.food){ failValidation(`Not enough food to buy ${buyLand} acres! Need ${buyLand * gameState.landPrice}, have ${Math.floor(gameState.food)}.`); }
    else if(sellLand > gameState.land){ failValidation(`Not enough land to sell! Own ${gameState.land} acres.`); }
    else { const foodAfterLandDeals = gameState.food - (buyLand*gameState.landPrice) + (sellLand*gameState.landPrice); const landAfterLandDeals = gameState.land + buyLand - sellLand; if (plant > foodAfterLandDeals) { failValidation(`Not enough food to plant! Need ${plant} bushels, have ${Math.floor(foodAfterLandDeals)}.`); } else if (plant > landAfterLandDeals) { failValidation(`Not enough land to plant! Own ${landAfterLandDeals} acres.`); } else if (plant > gameState.pawns * 10) { failValidation(`Not enough pawns to tend ${plant} acres! Need ${Math.ceil(plant / 10)}, have ${gameState.pawns}.`); } else { const foodAfterPlanting = foodAfterLandDeals - plant; const foodFeedNeed = feed * gameState.pawns; if(foodFeedNeed > foodAfterPlanting){ failValidation(`Not enough food to feed! Need ${foodFeedNeed}, have ${Math.floor(foodAfterPlanting)}.`); }}}
    if(validationFailed) return;

    // --- Process Turn ---
    nextTurnBtn.disabled=true;

    // Apply Costs/Changes
    if(buyLand>0){ gameState.food-=buyLand*gameState.landPrice; gameState.land+=buyLand; turnMessages.push(`Bought ${buyLand} acres.`); }
    else if(sellLand>0){ gameState.food+=sellLand*gameState.landPrice; gameState.land-=sellLand; turnMessages.push(`Sold ${sellLand} acres.`); }
    if(plant>0){ gameState.food-=plant; turnMessages.push(`Used ${plant} bushels for planting.`); }
    const totalFoodUsedForFeeding=feed*gameState.pawns; if(totalFoodUsedForFeeding>0) { gameState.food-=totalFoodUsedForFeeding; turnMessages.push(`Used ${totalFoodUsedForFeeding} bushels to feed ${gameState.pawns} pawns.`); }

    // Harvest
    const yieldPerAcre=Math.floor(Math.random()*5)+2; const foodHarvested=plant*yieldPerAcre; if(plant > 0) { gameState.food+=foodHarvested; turnMessages.push(`Harvested ${foodHarvested} bushels (${yieldPerAcre}/acre).`); } else { turnMessages.push("No crops planted."); }

    // Starvation
    let pawnsStarved = 0; const requiredFoodPerPawn = 20; const foodDeficit = (requiredFoodPerPawn * gameState.pawns) - totalFoodUsedForFeeding;
    if (foodDeficit > 0 && gameState.pawns > 0) { const maxStarvationFraction = 0.45; const starvationFraction = Math.min(maxStarvationFraction, foodDeficit / (requiredFoodPerPawn * gameState.pawns)); pawnsStarved = Math.min(gameState.pawns, Math.floor(gameState.pawns * starvationFraction)); if (pawnsStarved > 0) { gameState.pawns -= pawnsStarved; turnMessages.push(`<span style="color: red;">STARVATION! ${pawnsStarved} pawns died!</span>`); } }
    if (gameState.food < 0 && gameState.pawns > 0) { const extraShortage = Math.abs(gameState.food); const additionalStarved = Math.min(gameState.pawns, Math.ceil(extraShortage / requiredFoodPerPawn)); if (additionalStarved > 0) { gameState.pawns -= additionalStarved; turnMessages.push(`<span style="color: red;">SHORTAGE! ${additionalStarved} more died!</span>`); pawnsStarved += additionalStarved; } gameState.food = 0; }

    // Population Changes & Random Events
    if(gameState.pawns>0){ let pawnsGained=0, pawnsLeft=0; const immigrationChance = (feed / 30); if (Math.random() < immigrationChance) { pawnsGained = Math.min(50, Math.floor(Math.random() * (gameState.pawns * 0.1 + gameState.land * 0.01) + 1)); gameState.pawns += pawnsGained; if (pawnsGained > 0) turnMessages.push(`${pawnsGained} new pawns arrived.`); } if (feed < requiredFoodPerPawn / 2 && Math.random() < 0.1) { pawnsLeft = Math.min(gameState.pawns, Math.floor(Math.random() * (gameState.pawns * 0.05) + 1)); gameState.pawns -= pawnsLeft; if (pawnsLeft > 0) turnMessages.push(`${pawnsLeft} pawns left.`); }
        const eventChance=Math.random(); if(eventChance<0.15 && gameState.food>10){ const foodLost=Math.max(1,Math.floor(gameState.food*(Math.random()*0.2+0.1))); gameState.food-=foodLost; turnMessages.push(`<span style="color: orange;">Rats! Lost ${foodLost} bushels.</span>`); } else if(eventChance>=0.15&&eventChance<0.25 && foodHarvested>0){ const foodGained=Math.max(1,Math.floor(foodHarvested*(Math.random()*0.1+0.05))); gameState.food+=foodGained; turnMessages.push(`<span style="color: lightgreen;">Bonus harvest! +${foodGained} bushels.</span>`); } else if(eventChance>=0.30&&eventChance<0.40 && gameState.pawns>10){ let plagueVictims=Math.min(gameState.pawns,Math.max(1,Math.floor(gameState.pawns*(Math.random()*0.3+0.1)))); gameState.pawns-=plagueVictims; turnMessages.push(`<span style="color: red;">Plague! ${plagueVictims} pawns died.</span>`); }
    }

    // --- Check for Game Over AFTER calculations for the year ---
    if (gameState.pawns <= 0) {
        updateUI(); // Update UI one last time
        handleGameOver("Your civilization collapsed!");
        return; // Stop, game is over
    }

    // --- If game continues: Advance year and prepare for Next Turn ---
    gameState.year++;
    gameState.landPrice = Math.floor(Math.random() * 11) + 18;
    updateUI(); // Update UI for the upcoming year
    if(messageEl) messageEl.innerHTML = turnMessages.join("<br>");

    // Check if the game ends BECAUSE we just finished the last year
    if (gameState.year > maxYears) {
        handleGameOver(`You completed ${maxYears} years!`);
        // Button is handled within handleGameOver
    } else {
        // Reset inputs for the *next* year
        if(buyLandInput) buyLandInput.value=0; if(sellLandInput) sellLandInput.value=0; if(plantInput) plantInput.value=0; if(feedInput) feedInput.value=0;
        nextTurnBtn.disabled = false; // Re-enable for next decision
    }
}


/***********************************************
 *          Initialization & Listeners         *
 ***********************************************/
document.addEventListener('DOMContentLoaded', () => {
    // Initialize state variables that reset on load
    currentSessionRoundNumber = 0;
    localSessionRankings = {};

    setupVolumeControl();
    updateGlobalLeaderboard();
    displayGlobalGamesPlayed();
    updateRankingBoard(); // Show empty local ranking initially
});
if (startGameBtn) { startGameBtn.addEventListener("click", startGameNow); }
if (playerNameInput) { playerNameInput.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); startGameNow(); } }); }
// Initial listener is added in resetGameUIAndState called by startGameNow
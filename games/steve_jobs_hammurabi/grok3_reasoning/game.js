// ----- Start of game.js -----
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

const version = 'grok3_reasoning_half_hard_v6'; // Updated version identifier (iOS mute)
const gameTitle = 'steve_jobs_hammurabi';
const maxYears = 10;
const requiredFoodPerPawn = 20;
const pawnPlantingRatio = 10;
const minYield = 3;
const maxYield = 7;

// Starvation Risk Constants
const riskRecoveryRate = 0.35;
const riskIncreaseFactor = 0.4;
const deathThreshold = 0.85;
const deathRateFactor = 0.20;
const maxDeathFraction = 0.45;
const criticalRiskThreshold = 1.2;

const leaderboardCollection = `leaderboard_${gameTitle}_${version}`;
const statsDoc = `stats_${gameTitle}_${version}`;
const volumeKey = `${gameTitle}_volume_v2`;
const muteKey = `${gameTitle}_muted_v1`; // New key for mute state

let playerName = ""; let gameStarted = false; let gameEnded = false;
let currentSessionRoundNumber = 0; let localSessionRankings = {};
let gameState = {};

// --- ADDED: iOS Detection Function ---
function isIOS() {
    return [
        'iPad Simulator',
        'iPhone Simulator',
        'iPod Simulator',
        'iPad',
        'iPhone',
        'iPod'
    ].includes(navigator.platform)
    // Also consider newer iPad models that might report as MacIntel
    || (navigator.userAgent.includes("Mac") && "ontouchend" in document);
}
const runningOnIOS = isIOS(); // Check once on load
// --- END: iOS Detection Function ---

// DOM Elements
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
const starvationStatusEl = document.getElementById('starvationStatus');
const decisionYearEl = document.getElementById('decisionYear');
const buyLandInput = document.getElementById('buyLand');
const sellLandInput = document.getElementById('sellLand');
const plantInput = document.getElementById('plant');
const feedInput = document.getElementById('feed');
const maxPlantableInfoEl = document.getElementById('maxPlantableInfo');
const nextTurnBtn = document.getElementById('nextTurn');
const messageEl = document.getElementById('message');
const backgroundMusic = document.getElementById('backgroundMusic');
// Volume/Mute Controls
const volumeSlider = document.getElementById('volumeSlider');
const volumeSliderLabel = document.getElementById('volumeSliderLabel');
const muteControlDiv = document.getElementById('muteControl'); // The div containing mute checkbox+label
const muteToggle = document.getElementById('muteToggle'); // The checkbox itself
const muteToggleLabel = document.getElementById('muteToggleLabel'); // Label for mute

const rankingContentEl = document.getElementById('rankingContent');
const globalRankingContentStart = document.getElementById('globalRankingContentStart');
const globalRankingContentGame = document.getElementById('globalRankingContentGame');
const globalGamesPlayedStart = document.getElementById("globalGamesPlayedStart");
const globalGamesPlayedGame = document.getElementById("globalGamesPlayedGame");
const helpButton = document.getElementById('helpButton');
const helpModal = document.getElementById('helpModal');
const closeHelpButton = document.getElementById('closeHelp');

// Assumes blocklist.js is loaded

/***********************************************
 *           Volume/Mute Control Logic         *
 ***********************************************/

 // This function ONLY sets up the slider for non-iOS
 function setupVolumeSliderControl() {
    if (runningOnIOS) return; // Don't setup slider on iOS

    if (!backgroundMusic || !volumeSlider) {
        console.error("Volume slider elements not found!");
        return;
    }

    const savedVolume = localStorage.getItem(volumeKey);
    let currentVolume = 0.5;
    if (savedVolume !== null && !isNaN(parseFloat(savedVolume))) {
        currentVolume = parseFloat(savedVolume);
    }
    currentVolume = Math.max(0, Math.min(1, currentVolume));

    console.log(`Setting initial volume slider value: ${currentVolume}`);
    volumeSlider.value = currentVolume;
    // Note: Actual initial volume application happens in startGameNow

    const handleVolumeChange = () => {
        const newVolumeRaw = parseFloat(volumeSlider.value);
        const newVolume = isNaN(newVolumeRaw) ? 0.5 : Math.max(0, Math.min(1, newVolumeRaw));
        console.log(`Volume slider event. Target volume: ${newVolume}`);

        if (backgroundMusic) {
            backgroundMusic.volume = newVolume;
        }
        try {
            localStorage.setItem(volumeKey, newVolume.toString());
        } catch (e) { console.error("Failed to save volume:", e); }
    };

    volumeSlider.removeEventListener('input', handleVolumeChange);
    volumeSlider.removeEventListener('change', handleVolumeChange);
    volumeSlider.addEventListener('input', handleVolumeChange);
    volumeSlider.addEventListener('change', handleVolumeChange);
    console.log("Volume slider control event listeners attached.");
}

// --- ADDED: Mute Toggle Setup for iOS ---
function setupMuteToggleControl() {
    if (!runningOnIOS) return; // Only run on iOS

    if (!backgroundMusic || !muteToggle) {
        console.error("Mute toggle elements not found!");
        return;
    }

    // Get initial mute state
    let isMuted = localStorage.getItem(muteKey) === 'true';
    console.log(`Setting initial mute toggle state: ${isMuted}`);
    muteToggle.checked = isMuted;
    // Note: Actual initial mute application happens in startGameNow

    const handleMuteChange = () => {
        const shouldMute = muteToggle.checked;
        console.log(`Mute toggle event. Should mute: ${shouldMute}`);
        if (backgroundMusic) {
            backgroundMusic.muted = shouldMute;
        }
        try {
            localStorage.setItem(muteKey, shouldMute.toString());
        } catch (e) { console.error("Failed to save mute state:", e); }
    };

    muteToggle.removeEventListener('change', handleMuteChange);
    muteToggle.addEventListener('change', handleMuteChange);
    console.log("Mute toggle control event listener attached.");
}
// --- END: Mute Toggle Setup ---

/***********************************************
 *       Firestore Leaderboard & Stats         *
 ***********************************************/
// ... (No changes needed in these functions) ...
function updateGlobalLeaderboard() { console.log(`Fetching leaderboard from: ${leaderboardCollection}`); db.collection(leaderboardCollection).orderBy("finalPawns", "desc").orderBy("timestamp", "desc").limit(50).get().then((querySnapshot) => { let html = '<ol>'; const uniqueEntries = []; const pawnsSeen = new Set(); const maxDisplay = 10; if (!querySnapshot.empty) { querySnapshot.forEach((doc) => { const data = doc.data(); if (data && typeof data.finalPawns !== 'undefined') { const currentPawnCount = data.finalPawns; const pName = data.playerName || 'Anon'; if (!pawnsSeen.has(currentPawnCount) && uniqueEntries.length < maxDisplay) { uniqueEntries.push(`<li>${pName}: ${currentPawnCount} pawns</li>`); pawnsSeen.add(currentPawnCount); } } else { console.warn("Skipping leaderboard doc with missing data:", doc.id); } }); } if (uniqueEntries.length === 0) { html = '<p>No scores yet. Be the first!</p>'; } else { html += uniqueEntries.join(''); html += '</ol>'; } if (globalRankingContentStart) globalRankingContentStart.innerHTML = html; if (globalRankingContentGame) globalRankingContentGame.innerHTML = html; }).catch((error) => { console.error("Error getting global leaderboard:", error); const errorMsg = "<p>Error loading leaderboard.</p>"; if (globalRankingContentStart) globalRankingContentStart.innerHTML = errorMsg; if (globalRankingContentGame) globalRankingContentGame.innerHTML = errorMsg; }); }
function addGlobalRecord(pName, finalPawns, finalYear) { const pawnsToSave = Math.max(0, finalPawns); console.log(`Attempting to add global record: P: ${pName}, Pawns: ${pawnsToSave}, Year: ${finalYear}, V: ${version}`); db.collection(leaderboardCollection).add({ playerName: pName || "Anon", finalPawns: pawnsToSave, finalYear: finalYear, version: version, timestamp: firebase.firestore.FieldValue.serverTimestamp() }).then((docRef) => { console.log(`Global record added successfully with ID: ${docRef.id}`); updateGlobalLeaderboard(); }).catch((error) => { console.error("!!! Error adding global record:", error); }); }
function incrementGlobalGamesPlayed() { db.collection("globalStats").doc(statsDoc).set({ totalGamesPlayed: firebase.firestore.FieldValue.increment(1), gameTitle: gameTitle, version: version }, { merge: true }).then(() => { console.log("Total games incremented."); displayGlobalGamesPlayed(); }).catch(console.error); }
function displayGlobalGamesPlayed() { db.collection("globalStats").doc(statsDoc).get().then((doc) => { const total = doc.exists ? (doc.data().totalGamesPlayed || 0) : 0; const text = `(Total games played worldwide: ${total})`; if (globalGamesPlayedStart) globalGamesPlayedStart.innerText = text; if (globalGamesPlayedGame) globalGamesPlayedGame.innerText = text; }).catch((error) => { console.error("Error reading total games:", error); const errorText = "(Total games played worldwide: Error)"; if (globalGamesPlayedStart) globalGamesPlayedStart.innerText = errorText; if (globalGamesPlayedGame) globalGamesPlayedGame.innerText = errorText; }); }

/***********************************************
 *      Local Ranking (Page Load Only)         *
 ***********************************************/
// ... (No changes needed in these functions) ...
function updateRankingBoard() { if (!rankingContentEl) return; const rankingsList = Object.values(localSessionRankings); const sortedRankings = rankingsList.sort((a, b) => b.pawns - a.pawns); let html = ''; if (sortedRankings.length === 0) { html = '<p>No games completed yet.</p>'; } else { html = '<ol>'; sortedRankings.slice(0, 10).forEach((entry) => { html += `<li>Game ${entry.round}: ${entry.pawns} pawns</li>`; }); html += '</ol>'; } rankingContentEl.innerHTML = html; }
function saveLocalRecord(roundNum, finalPawns) { const pawnsToSave = Math.max(0, finalPawns); localSessionRankings[pawnsToSave] = { round: roundNum, pawns: pawnsToSave }; updateRankingBoard(); }

/***********************************************
 *          Name Validation                 *
 ***********************************************/
// ... (No changes needed in this function) ...
function isNameOffensive(name) { if (typeof offensiveWords === 'undefined' || !Array.isArray(offensiveWords)) { console.warn("Offensive words list (blocklist.js) not loaded or not an array!"); return false; } if (!name) return false; const lowerCaseName = name.toLowerCase(); for (const word of offensiveWords) { if (typeof word === 'string' && lowerCaseName.includes(word)) { console.log(`Offensive substring found: ${word} in ${name}`); return true; } } return false; }

/***********************************************
 *         Game State & UI Updates             *
 ***********************************************/
// ... (No changes needed in resetGameUIAndState or updateUI) ...
function resetGameUIAndState(isRestart = false) { gameState = { year: 0, food: 1000, land: 100, pawns: 100, landPrice: Math.floor(Math.random()*11)+18, starvationRisk: 0 }; gameEnded = false; if(buyLandInput) buyLandInput.value=0; if(sellLandInput) sellLandInput.value=0; if(plantInput) plantInput.value=0; if(feedInput) feedInput.value=0; if(messageEl) messageEl.innerHTML= isRestart ? "Starting a new game." : "A new era begins. Rule wisely for 10 years!"; if(nextTurnBtn) { nextTurnBtn.disabled=false; nextTurnBtn.textContent = "Confirm Decisions & End Year"; nextTurnBtn.classList.remove('game-over-button'); nextTurnBtn.removeEventListener('click', startNewGameHandler); nextTurnBtn.removeEventListener('click', processTurn); nextTurnBtn.addEventListener('click', processTurn); } updateUI(); }
function updateUI() { if(!gameStarted || !gameState) return; if(yearEl) yearEl.textContent=`${gameState.year} / ${maxYears}`; if(decisionYearEl) decisionYearEl.textContent=gameState.year; if(foodEl) foodEl.textContent=Math.floor(gameState.food); if(landEl) landEl.textContent=gameState.land; if(pawnsEl) pawnsEl.textContent=gameState.pawns; if(landPriceEl) landPriceEl.textContent=gameState.landPrice; const maxPlantable = gameState.pawns * pawnPlantingRatio; if(maxPlantableInfoEl) maxPlantableInfoEl.textContent = `(Max plantable: ${maxPlantable} acres)`; if (starvationStatusEl) { const risk = gameState.starvationRisk; let statusText = "Unknown"; let statusClass = "status-safe"; if (risk < 0.1) { statusText = "Well Fed"; statusClass = "status-safe"; } else if (risk < 0.5) { statusText = "Content"; statusClass = "status-ok"; } else if (risk < deathThreshold) { statusText = "Concerned"; statusClass = "status-warning"; } else if (risk < criticalRiskThreshold) { statusText = "High Risk!"; statusClass = "status-danger"; } else { statusText = "Critical!!"; statusClass = "status-critical"; } starvationStatusEl.textContent = statusText; starvationStatusEl.className = ''; starvationStatusEl.classList.add(statusClass); } }

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
    currentSessionRoundNumber = 1;
    localSessionRankings = {};

    resetGameUIAndState(false);
    updateRankingBoard();
    updateGlobalLeaderboard();
    displayGlobalGamesPlayed();
    // Note: Volume/Mute setup now happens in DOMContentLoaded

    // --- VOLUME/MUTE MODIFICATION: Apply initial state before play() ---
    if (backgroundMusic) {
        try {
            if (runningOnIOS) {
                // Apply initial mute state from checkbox (which was set from localStorage)
                if (muteToggle) {
                    backgroundMusic.muted = muteToggle.checked;
                    console.log(`Attempting to play music on iOS with initial muted state: ${backgroundMusic.muted}`);
                } else {
                     console.error("Mute toggle checkbox not found!");
                }
            } else {
                // Apply initial volume state from slider (which was set from localStorage)
                if (volumeSlider) {
                    let initialVolume = parseFloat(volumeSlider.value);
                    if (isNaN(initialVolume)) initialVolume = 0.5;
                    backgroundMusic.volume = Math.max(0, Math.min(1, initialVolume));
                    console.log(`Attempting to play music on non-iOS with initial volume: ${backgroundMusic.volume}`);
                } else {
                    console.error("Volume slider not found!");
                }
            }

            backgroundMusic.play()
                .then(() => { console.log("Background music playback started successfully."); })
                .catch(error => {
                    console.error("Music playback failed:", error);
                    if(messageEl) {
                         const currentMsg = messageEl.innerHTML;
                         if (!currentMsg.includes("Music playback issue")) {
                              messageEl.innerHTML += "<br><small>(Music playback issue. Please use device controls.)</small>";
                         }
                    }
                });
        } catch (err) {
             console.error("Error during music setup/play:", err);
              if(messageEl) messageEl.innerHTML += "<br><small>(Error starting music.)</small>";
        }
    } else {
        console.error("Background music element not found for playback!");
    }
    // --- END VOLUME/MUTE MODIFICATION ---
}

// ... (handleGameOver remains the same) ...
function handleGameOver(messagePrefix = "GAME OVER") { if (gameEnded) return; gameEnded = true; const finalPawns = gameState.pawns; const finalYearReached = gameState.year; if (messageEl) { let endMessage = `${messagePrefix}<br>`; if (finalPawns <= 0) { endMessage += `Your civilization collapsed in year ${finalYearReached}! Final Pawn Count: 0.`; } else if (finalYearReached >= maxYears) { endMessage += `You completed ${maxYears} years! Final Pawn Count: ${finalPawns}.`; } else { endMessage += `Game ended unexpectedly in year ${finalYearReached}. Final Pawn Count: ${finalPawns}.`; } messageEl.innerHTML = endMessage; } saveLocalRecord(currentSessionRoundNumber, finalPawns); addGlobalRecord(playerName, finalPawns, finalYearReached); incrementGlobalGamesPlayed(); if(nextTurnBtn) { nextTurnBtn.textContent = "Start New Game"; nextTurnBtn.classList.add('game-over-button'); nextTurnBtn.removeEventListener('click', processTurn); nextTurnBtn.removeEventListener('click', startNewGameHandler); nextTurnBtn.addEventListener('click', startNewGameHandler); nextTurnBtn.disabled = false; } }
// ... (startNewGameHandler remains the same) ...
function startNewGameHandler() { console.log("Starting new game..."); currentSessionRoundNumber++; resetGameUIAndState(true); }

/***********************************************
 *          Hammurabi Game Turn Logic          *
 ***********************************************/
// ... (processTurn remains the same) ...
function processTurn() { if (gameState.year >= maxYears) { updateUI(); handleGameOver(`You completed ${maxYears} years!`); return; } if (gameState.pawns <= 0) { updateUI(); handleGameOver("Your civilization collapsed!"); return; } if (gameEnded) { return; } if (!gameStarted || !nextTurnBtn) return; const buyLand = parseInt(buyLandInput?.value ?? 0) || 0; const sellLand = parseInt(sellLandInput?.value ?? 0) || 0; const plant = parseInt(plantInput?.value ?? 0) || 0; const feed = parseInt(feedInput?.value ?? 0) || 0; if(messageEl) messageEl.textContent = ""; let turnMessages = []; let validationFailed = false; function failValidation(msg) { if (messageEl) messageEl.innerHTML = `<span style="color: #ff6666;">${msg}</span>`; validationFailed = true; } if (buyLand < 0 || sellLand < 0 || plant < 0 || feed < 0) { failValidation("Non-negative values only."); } else if (buyLand > 0 && sellLand > 0) { failValidation("Cannot buy AND sell land in the same year."); } else if (buyLand * gameState.landPrice > gameState.food) { failValidation(`Not enough food to buy ${buyLand} acres. You need ${buyLand * gameState.landPrice} but only have ${Math.floor(gameState.food)}.`); } else if (sellLand > gameState.land) { failValidation(`Not enough land to sell. You only have ${gameState.land} acres.`); } else { const foodAfterLandDeals = gameState.food - (buyLand * gameState.landPrice) + (sellLand * gameState.landPrice); const landAfterLandDeals = gameState.land + buyLand - sellLand; const pawnsAvailable = gameState.pawns; const maxPlantableByPawns = pawnsAvailable * pawnPlantingRatio; if (plant > foodAfterLandDeals) { failValidation(`Not enough food to plant ${plant} acres (costs ${plant} bushels). You will only have ${Math.floor(foodAfterLandDeals)} after land deals.`); } else if (plant > landAfterLandDeals) { failValidation(`Not enough land to plant on. You will only have ${landAfterLandDeals} acres after land deals.`); } else if (plant > maxPlantableByPawns) { failValidation(`Not enough pawns to tend ${plant} acres. You need ${Math.ceil(plant / pawnPlantingRatio)} pawns (1 per ${pawnPlantingRatio} acres) but only have ${pawnsAvailable}. Max plantable is ${maxPlantableByPawns}.`); } else { const foodAfterPlanting = foodAfterLandDeals - plant; const totalFoodNeededForFeeding = feed * pawnsAvailable; if (totalFoodNeededForFeeding > foodAfterPlanting) { failValidation(`Not enough food to feed ${pawnsAvailable} pawns ${feed} bushels each. You need ${totalFoodNeededForFeeding} but will only have ${Math.floor(foodAfterPlanting)} after land deals and planting.`); } } } if (validationFailed) return; nextTurnBtn.disabled = true; if (buyLand > 0) { gameState.food -= buyLand * gameState.landPrice; gameState.land += buyLand; turnMessages.push(`Bought ${buyLand} acres.`); } else if (sellLand > 0) { gameState.food += sellLand * gameState.landPrice; gameState.land -= sellLand; turnMessages.push(`Sold ${sellLand} acres.`); } if (plant > 0) { gameState.food -= plant; turnMessages.push(`Used ${plant} bushels for planting on ${plant} acres.`); } const totalFoodUsedForFeeding = feed * gameState.pawns; if (totalFoodUsedForFeeding > 0) { gameState.food -= totalFoodUsedForFeeding; turnMessages.push(`Used ${totalFoodUsedForFeeding} bushels to feed ${gameState.pawns} pawns.`); } const yieldPerAcre = Math.floor(Math.random() * (maxYield - minYield + 1)) + minYield; const foodHarvested = plant * yieldPerAcre; if (plant > 0) { gameState.food += foodHarvested; turnMessages.push(`Harvested ${foodHarvested} bushels (${yieldPerAcre}/acre).`); } else { turnMessages.push("No crops planted."); } let pawnsStarved = 0; let foodDeficitPerPawn = 0; if (gameState.pawns > 0) { const actualFeedPerPawn = Math.max(0, feed); foodDeficitPerPawn = Math.max(0, requiredFoodPerPawn - actualFeedPerPawn); } if (foodDeficitPerPawn > 0) { const deficitFraction = foodDeficitPerPawn / requiredFoodPerPawn; gameState.starvationRisk += deficitFraction * riskIncreaseFactor; } else { gameState.starvationRisk = Math.max(0, gameState.starvationRisk - riskRecoveryRate); } if (gameState.starvationRisk > deathThreshold && gameState.pawns > 0) { const riskAboveThreshold = gameState.starvationRisk - deathThreshold; const starvationFraction = Math.min(maxDeathFraction, riskAboveThreshold * deathRateFactor); pawnsStarved = Math.min(gameState.pawns, Math.ceil(gameState.pawns * starvationFraction)); if (pawnsStarved > 0) { if (gameState.starvationRisk > criticalRiskThreshold + 0.3) { turnMessages.push(`<span style="color: red;">SEVERE STARVATION! ${pawnsStarved} pawns died due to lack of food!</span>`); } else { turnMessages.push(`<span style="color: red;">STARVATION! ${pawnsStarved} pawns died due to lack of food!</span>`); } } } if (pawnsStarved > 0) { gameState.pawns -= pawnsStarved; } if (gameState.food < 0 && gameState.pawns > 0) { const foodShortage = Math.abs(gameState.food); const additionalStarved = Math.min(gameState.pawns, Math.ceil(foodShortage / (requiredFoodPerPawn * 0.75))); if (additionalStarved > 0) { gameState.pawns -= additionalStarved; turnMessages.push(`<span style="color: red;">FINANCIAL COLLAPSE! Resources depleted, ${additionalStarved} more pawns perished!</span>`); } gameState.food = 0; } if (gameState.pawns > 0) { let pawnsGained = 0; const immigrationChance = (feed / (requiredFoodPerPawn * 1.5)); if (Math.random() < immigrationChance) { pawnsGained = Math.min(50, Math.floor(Math.random() * (gameState.pawns * 0.1 + gameState.land * 0.01) + 1)); gameState.pawns += pawnsGained; if (pawnsGained > 0) turnMessages.push(`${pawnsGained} new pawns arrived, attracted by your rule.`); } let pawnsLeft = 0; if (feed < requiredFoodPerPawn / 2 && Math.random() < 0.05) { pawnsLeft = Math.min(gameState.pawns, Math.floor(Math.random() * (gameState.pawns * 0.05) + 1)); gameState.pawns -= pawnsLeft; if (pawnsLeft > 0) turnMessages.push(`${pawnsLeft} pawns left due to harsh conditions.`); } const eventChance = Math.random(); if (eventChance < 0.15 && gameState.food > 10) { const foodLostPercent = Math.random() * 0.15 + 0.05; const foodLost = Math.max(1, Math.floor(gameState.food * foodLostPercent)); gameState.food -= foodLost; turnMessages.push(`<span style="color: orange;">Rats! Infestation destroyed ${foodLost} bushels of food.</span>`); } else if (eventChance >= 0.15 && eventChance < 0.25 && foodHarvested > 0) { const foodGainedPercent = Math.random() * 0.1 + 0.05; const foodGained = Math.max(1, Math.floor(foodHarvested * foodGainedPercent)); gameState.food += foodGained; turnMessages.push(`<span style="color: lightgreen;">Bonus harvest! Favorable weather brought an extra ${foodGained} bushels.</span>`); } else if (eventChance >= 0.30 && eventChance < 0.40 && gameState.pawns > 10) { const plaguePercent = Math.random() * 0.15 + 0.05; let plagueVictims = Math.min(gameState.pawns, Math.max(1, Math.floor(gameState.pawns * plaguePercent))); gameState.pawns -= plagueVictims; turnMessages.push(`<span style="color: red;">Plague! A deadly disease struck, ${plagueVictims} pawns died.</span>`); } } if (gameState.pawns <= 0) { gameState.pawns = 0; updateUI(); handleGameOver("Your civilization collapsed!"); return; } gameState.year++; gameState.landPrice = Math.floor(Math.random() * 11) + 18; updateUI(); if(messageEl) messageEl.innerHTML = turnMessages.join("<br>"); if (gameState.year >= maxYears) { handleGameOver(`You completed ${maxYears} years!`); } else { if(buyLandInput) buyLandInput.value = 0; if(sellLandInput) sellLandInput.value = 0; if(plantInput) plantInput.value = 0; if(feedInput) feedInput.value = 0; if (!gameEnded) { nextTurnBtn.disabled = false; } } }


/***********************************************
 *          Initialization & Listeners         *
 ***********************************************/
document.addEventListener('DOMContentLoaded', () => {
    console.log(`iOS detected: ${runningOnIOS}`); // Log detection result

    // --- Conditional UI Setup for Volume/Mute ---
    if (runningOnIOS) {
        // Hide slider elements, show mute elements
        if(volumeSlider) volumeSlider.style.display = 'none';
        if(volumeSliderLabel) volumeSliderLabel.style.display = 'none';
        if(muteControlDiv) muteControlDiv.style.display = 'block'; // Show the mute div
        setupMuteToggleControl(); // Setup mute checkbox listener
    } else {
        // Hide mute elements, show slider elements (default state in HTML)
        if(muteControlDiv) muteControlDiv.style.display = 'none'; // Ensure mute is hidden
        if(volumeSlider) volumeSlider.style.display = 'inline-block'; // Ensure slider is visible
        if(volumeSliderLabel) volumeSliderLabel.style.display = 'block'; // Ensure label is visible
        setupVolumeSliderControl(); // Setup volume slider listener
    }
    // --- End Conditional UI Setup ---

    // Standard Init
    currentSessionRoundNumber = 0;
    localSessionRankings = {};
    updateGlobalLeaderboard();
    displayGlobalGamesPlayed();
    updateRankingBoard();

    if(startScreen) startScreen.style.display="block";
    if(gameContainer) gameContainer.style.display="none";

    // Event Listeners
    if (startGameBtn) { startGameBtn.addEventListener("click", startGameNow); }
    if (playerNameInput) { playerNameInput.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); startGameNow(); } }); }
    if (helpButton && helpModal && closeHelpButton) {
        helpButton.addEventListener('click', () => { helpModal.style.display = 'block'; });
        closeHelpButton.addEventListener('click', () => { helpModal.style.display = 'none'; });
        window.addEventListener('click', (event) => { if (event.target == helpModal) { helpModal.style.display = 'none'; } });
    } else { console.error("Help modal elements not found!"); }
});
// ----- End of game.js -----
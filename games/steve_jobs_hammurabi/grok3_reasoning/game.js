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

// --- Game & Version Info ---
const version = 'grok3_reasoning';
const gameTitle = 'steve_jobs_hammurabi';
const maxYears = 10; // Define max years for the game

// --- Firebase Collection/Doc Names ---
const leaderboardCollection = `leaderboard_${gameTitle}_${version}`;
const statsDoc = `stats_${gameTitle}_${version}`;

// --- Local/Session Storage Keys ---
const volumeKey = `${gameTitle}_volume_v2`;
const sessionRankingsKey = `${gameTitle}_rankings_${version}`; // Add version to key
const sessionRoundNumberKey = `${gameTitle}_roundNumber_${version}`; // Add version to key

// --- Global State ---
let playerName = "";
let gameStarted = false;
let gameEnded = false;
let roundNumber = parseInt(sessionStorage.getItem(sessionRoundNumberKey) || '0');

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

// --- Initial Hammurabi Game State ---
let gameState = {};


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
    // Order by finalPawns descending, then timestamp descending
    db.collection(leaderboardCollection)
        .orderBy("finalPawns", "desc")
        .orderBy("timestamp", "desc") // Secondary sort: newest first for same pawn count
        .limit(50) // Fetch more candidates to find unique players
        .get()
    .then((querySnapshot) => {
        let html = '<ol>';
        const uniqueEntries = [];
        const playersSeen = new Set();
        const maxDisplay = 10; // How many unique player entries to show

        if (!querySnapshot.empty) {
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                const pName = data.playerName || 'Anon';
                // If we haven't seen this player yet and haven't reached max display count
                if (!playersSeen.has(pName.toLowerCase()) && uniqueEntries.length < maxDisplay) {
                    // Display focuses on pawns now
                    uniqueEntries.push(`<li>${pName}: ${data.finalPawns} pawns</li>`);
                    playersSeen.add(pName.toLowerCase());
                }
            });
        }

        if (uniqueEntries.length === 0) {
            html = '<p>No scores yet. Be the first!</p>';
        } else {
             html += uniqueEntries.join('');
             html += '</ol>';
        }
        if (globalRankingContentStart) globalRankingContentStart.innerHTML = html;
        if (globalRankingContentGame) globalRankingContentGame.innerHTML = html;
    })
    .catch((error) => {
        console.error("Error getting global leaderboard:", error);
        const errorMsg = "<p>Error loading leaderboard.</p>";
        if (globalRankingContentStart) globalRankingContentStart.innerHTML = errorMsg;
        if (globalRankingContentGame) globalRankingContentGame.innerHTML = errorMsg;
    });
}

// Takes final pawn count and the year the game ended (for context if needed later)
function addGlobalRecord(pName, finalPawns, finalYear) {
    if (gameEnded) { console.log("Score already submitted for this game."); return; }

    const pawnsToSave = Math.max(0, finalPawns);
    gameEnded = true;

    db.collection(leaderboardCollection).add({
        playerName: pName || "Anon",
        finalPawns: pawnsToSave, // Primary metric
        finalYear: finalYear,   // Contextual info
        version: version,
        timestamp: firebase.firestore.FieldValue.serverTimestamp() // Crucial for tie-breaking/uniqueness
    })
    .then(() => {
        console.log(`Global record added: ${pName || 'Anon'}, Pawns ${pawnsToSave}, Year ${finalYear}`);
        updateGlobalLeaderboard();
    })
    .catch((error) => {
        console.error("Error adding global record:", error);
        gameEnded = false; // Allow retry?
    });
}

function incrementGlobalGamesPlayed() {
    db.collection("globalStats").doc(statsDoc).set({
        totalGamesPlayed: firebase.firestore.FieldValue.increment(1),
        gameTitle: gameTitle, version: version }, { merge: true })
        .then(() => { console.log("Total games incremented."); displayGlobalGamesPlayed(); }).catch(console.error);
}
function displayGlobalGamesPlayed() {
    db.collection("globalStats").doc(statsDoc).get().then((doc) => {
        const total = doc.exists ? (doc.data().totalGamesPlayed || 0) : 0;
        const text = `(Total games played worldwide: ${total})`;
        if (globalGamesPlayedStart) globalGamesPlayedStart.innerText = text;
        if (globalGamesPlayedGame) globalGamesPlayedGame.innerText = text; })
        .catch((error) => {
        console.error("Error reading total games:", error);
        const errorText = "(Total games played worldwide: Error)";
        if (globalGamesPlayedStart) globalGamesPlayedStart.innerText = errorText;
        if (globalGamesPlayedGame) globalGamesPlayedGame.innerText = errorText; });
}

/***********************************************
 *            Local Ranking (Session)          *
 ***********************************************/
 function updateRankingBoard() {
    if (!rankingContentEl) return;
    // Use an array structure for local rankings, simpler to sort
    const currentRankings = JSON.parse(sessionStorage.getItem(sessionRankingsKey) || '[]');
    // Sort by pawns descending
    const sortedRankings = currentRankings.slice().sort((a, b) => b.pawns - a.pawns);

    let html = '';
    if (sortedRankings.length === 0) {
        html = '<p>No games completed this session.</p>';
    } else {
        html = '<ol>';
        // Show top 10 session scores
        sortedRankings.slice(0, 10).forEach((entry) => {
            // Display focuses on pawns
            html += `<li>Game ${entry.round}: ${entry.pawns} pawns</li>`;
        });
        html += '</ol>';
    }
    rankingContentEl.innerHTML = html;
}
// Takes final pawn count
function saveLocalRecord(currentRound, finalPawns) {
     let currentRankings = JSON.parse(sessionStorage.getItem(sessionRankingsKey) || '[]');
     currentRankings.push({ round: currentRound, pawns: Math.max(0, finalPawns) });
     // Optional: Limit the number of entries stored
     // currentRankings = currentRankings.slice(-10); // Keep last 10 games
     try {
        sessionStorage.setItem(sessionRankingsKey, JSON.stringify(currentRankings));
        updateRankingBoard(); // Update display immediately
     } catch (e) { console.error("Failed to save local ranking:", e); }
}

 /***********************************************
 *          Name Validation (Improved)         *
 ***********************************************/
 function isNameOffensive(name) {
     if (typeof offensiveWords === 'undefined') { console.warn("Offensive words list (blocklist.js) not loaded!"); return false; }
     if (!name) return false;
     const lowerCaseName = name.toLowerCase();
     for (const word of offensiveWords) { const regex = new RegExp(`\\b${word}\\b`, 'i'); if (regex.test(lowerCaseName)) { console.log(`Offensive word found: ${word} in ${name}`); return true; } }
     return false;
 }

/***********************************************
 *         Game State & UI Updates             *
 ***********************************************/
function resetGameUIAndState() {
    gameState = { year: 1, food: 1000, land: 100, pawns: 100, landPrice: Math.floor(Math.random()*11)+18 };
    gameEnded = false; // Reset ended flag for the new game
    if(buyLandInput) buyLandInput.value=0; if(sellLandInput) sellLandInput.value=0; if(plantInput) plantInput.value=0; if(feedInput) feedInput.value=0;
    if(messageEl) messageEl.innerHTML="A new era begins. Rule wisely for 10 years!";
    if(nextTurnBtn) nextTurnBtn.disabled=false;
    updateUI();
}
function updateUI() {
    if(!gameStarted) return;
    // Update year display to show progress towards maxYears
    if(yearEl) yearEl.textContent=`${gameState.year} / ${maxYears}`;
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
    resetGameUIAndState();

    roundNumber++;
    sessionStorage.setItem(sessionRoundNumberKey, roundNumber.toString());

    incrementGlobalGamesPlayed();

    updateRankingBoard();
    updateGlobalLeaderboard();
    displayGlobalGamesPlayed();

    setupVolumeControl();
    if (backgroundMusic) { backgroundMusic.play().catch(error => { console.log("Music autoplay prevented:", error); if(messageEl) messageEl.innerHTML += "<br><small>(Music autoplay blocked. Adjust volume.)</small>"; });
    } else { console.error("Background music element not found!"); }
}

/***********************************************
 *          Hammurabi Game Turn Logic          *
 ***********************************************/
function triggerGameOver(messagePrefix = "GAME OVER") {
    if (gameEnded) return; // Prevent double execution

    const finalPawns = gameState.pawns;
    const finalYear = gameState.year; // The year the game ended

    if (messageEl) {
        let endMessage = `${messagePrefix}<br>`;
        if (finalPawns <= 0) {
            endMessage += `Your civilization collapsed in year ${finalYear}! Final Pawn Count: 0.`;
        } else {
            endMessage += `You completed ${maxYears} years! Final Pawn Count: ${finalPawns}.`;
        }
        messageEl.innerHTML = endMessage;
    }

    saveLocalRecord(roundNumber, finalPawns); // Save pawn count
    addGlobalRecord(playerName, finalPawns, finalYear); // Save pawn count and year context

    if(nextTurnBtn) nextTurnBtn.disabled = true;
    // gameEnded is set within addGlobalRecord
}


function processTurn() {
    // Check for game over conditions FIRST (pawns <= 0)
     if (gameState.pawns <= 0) {
        triggerGameOver("Your civilization collapsed!");
        return; // Stop processing if already over due to pawns
    }
    // Check if max years completed (game ends AFTER year 10 calculations)
    if (gameState.year > maxYears) {
        triggerGameOver(`You completed ${maxYears} years!`);
        return; // Stop processing if game ended due to reaching max years
    }


    if (!gameStarted || gameEnded || !nextTurnBtn) return;

    const buyLand=parseInt(buyLandInput?.value??0)||0, sellLand=parseInt(sellLandInput?.value??0)||0, plant=parseInt(plantInput?.value??0)||0, feed=parseInt(feedInput?.value??0)||0;
    if(messageEl) messageEl.textContent=""; let turnMessages=[]; let validationFailed=false;
    function failValidation(msg) { if(messageEl) messageEl.innerHTML = `<span style="color: #ff6666;">${msg}</span>`; validationFailed=true; }

    // --- Input Validation --- (No changes needed here)
    if(buyLand<0||sellLand<0||plant<0||feed<0){ failValidation("Please enter non-negative values for decisions."); }
    else if(buyLand>0&&sellLand>0){ failValidation("Cannot buy AND sell land in the same year."); }
    else if(buyLand*gameState.landPrice > gameState.food){ failValidation(`Not enough food to buy ${buyLand} acres! Need ${buyLand * gameState.landPrice}, have ${Math.floor(gameState.food)}.`); }
    else if(sellLand > gameState.land){ failValidation(`Not enough land to sell! Own ${gameState.land} acres.`); }
    else { const foodAfterLandDeals = gameState.food - (buyLand*gameState.landPrice) + (sellLand*gameState.landPrice); const landAfterLandDeals = gameState.land + buyLand - sellLand; if (plant > foodAfterLandDeals) { failValidation(`Not enough food to plant! Need ${plant} bushels, have ${Math.floor(foodAfterLandDeals)} after land deals.`); } else if (plant > landAfterLandDeals) { failValidation(`Not enough land to plant! Will own ${landAfterLandDeals} acres after deals.`); } else if (plant > gameState.pawns * 10) { failValidation(`Not enough pawns to tend ${plant} acres! Need ${Math.ceil(plant / 10)} pawns, have ${gameState.pawns}.`); } else { const foodAfterPlanting = foodAfterLandDeals - plant; const foodFeedNeed = feed * gameState.pawns; if(foodFeedNeed > foodAfterPlanting){ failValidation(`Not enough food to feed! Need ${foodFeedNeed} bushels, have ${Math.floor(foodAfterPlanting)} left after planting.`); }}}
    if(validationFailed) return;

    // --- Process Turn ---
    nextTurnBtn.disabled=true; // Disable during processing

    // Apply Costs/Changes from Decisions
    if(buyLand>0){ gameState.food-=buyLand*gameState.landPrice; gameState.land+=buyLand; turnMessages.push(`Bought ${buyLand} acres.`); }
    else if(sellLand>0){ gameState.food+=sellLand*gameState.landPrice; gameState.land-=sellLand; turnMessages.push(`Sold ${sellLand} acres.`); }
    if(plant>0){ gameState.food-=plant; turnMessages.push(`Used ${plant} bushels for planting.`); }
    const totalFoodUsedForFeeding=feed*gameState.pawns; if(totalFoodUsedForFeeding>0) { gameState.food-=totalFoodUsedForFeeding; turnMessages.push(`Used ${totalFoodUsedForFeeding} bushels to feed ${gameState.pawns} pawns.`); }

    // Calculate Harvest
    const yieldPerAcre=Math.floor(Math.random()*5)+2; const foodHarvested=plant*yieldPerAcre; if(plant > 0) { gameState.food+=foodHarvested; turnMessages.push(`Harvested ${foodHarvested} bushels (${yieldPerAcre}/acre).`); } else { turnMessages.push("No crops were planted."); }

    // Starvation Check
    let pawnsStarved = 0; const requiredFoodPerPawn = 20; const foodDeficit = (requiredFoodPerPawn * gameState.pawns) - totalFoodUsedForFeeding;
    if (foodDeficit > 0 && gameState.pawns > 0) { const maxStarvationFraction = 0.45; const starvationFraction = Math.min(maxStarvationFraction, foodDeficit / (requiredFoodPerPawn * gameState.pawns)); pawnsStarved = Math.min(gameState.pawns, Math.floor(gameState.pawns * starvationFraction)); if (pawnsStarved > 0) { gameState.pawns -= pawnsStarved; turnMessages.push(`<span style="color: red;">STARVATION! ${pawnsStarved} pawns died from lack of food!</span>`); } }
    if (gameState.food < 0 && gameState.pawns > 0) { const extraShortage = Math.abs(gameState.food); const additionalStarved = Math.min(gameState.pawns, Math.ceil(extraShortage / requiredFoodPerPawn)); if (additionalStarved > 0) { gameState.pawns -= additionalStarved; turnMessages.push(`<span style="color: red;">CRITICAL SHORTAGE! ${additionalStarved} additional pawns died!</span>`); pawnsStarved += additionalStarved; } gameState.food = 0; }

    // Population Changes & Random Events
    if(gameState.pawns>0){ let pawnsGained=0, pawnsLeft=0; const immigrationChance = (feed / 30); if (Math.random() < immigrationChance) { pawnsGained = Math.min(50, Math.floor(Math.random() * (gameState.pawns * 0.1 + gameState.land * 0.01) + 1)); gameState.pawns += pawnsGained; if (pawnsGained > 0) turnMessages.push(`${pawnsGained} new pawns arrived.`); } if (feed < requiredFoodPerPawn / 2 && Math.random() < 0.1) { pawnsLeft = Math.min(gameState.pawns, Math.floor(Math.random() * (gameState.pawns * 0.05) + 1)); gameState.pawns -= pawnsLeft; if (pawnsLeft > 0) turnMessages.push(`${pawnsLeft} pawns left.`); }
        const eventChance=Math.random(); if(eventChance<0.15 && gameState.food>10){ const foodLost=Math.max(1,Math.floor(gameState.food*(Math.random()*0.2+0.1))); gameState.food-=foodLost; turnMessages.push(`<span style="color: orange;">Rats infested! Lost ${foodLost} bushels.</span>`); } else if(eventChance>=0.15&&eventChance<0.25 && foodHarvested>0){ const foodGained=Math.max(1,Math.floor(foodHarvested*(Math.random()*0.1+0.05))); gameState.food+=foodGained; turnMessages.push(`<span style="color: lightgreen;">Bountiful harvest! +${foodGained} bushels.</span>`); } else if(eventChance>=0.30&&eventChance<0.40 && gameState.pawns>10){ let plagueVictims=Math.min(gameState.pawns,Math.max(1,Math.floor(gameState.pawns*(Math.random()*0.3+0.1)))); gameState.pawns-=plagueVictims; turnMessages.push(`<span style="color: red;">Plague struck! ${plagueVictims} pawns died.</span>`); }
    }

    // --- Check for Game Over AFTER calculations for the year ---
    if (gameState.pawns <= 0) {
        // Pawns reached 0 during this year's calculations
        updateUI(); // Update UI to show 0 pawns
        triggerGameOver("Your civilization collapsed!");
        return; // Stop, game is over
    }

    // --- If game continues: Prepare for Next Turn ---
    gameState.year++;
    gameState.landPrice = Math.floor(Math.random() * 11) + 18;
    updateUI();
    if(messageEl) messageEl.innerHTML = turnMessages.join("<br>");

    // Check if the game ends AFTER this turn (i.e., after year 10 finishes)
    if (gameState.year > maxYears) {
        triggerGameOver(`You completed ${maxYears} years!`);
        // Button is already disabled within triggerGameOver
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
    roundNumber = parseInt(sessionStorage.getItem(sessionRoundNumberKey) || '0'); // Load round number
    setupVolumeControl();
    updateGlobalLeaderboard();
    displayGlobalGamesPlayed();
    updateRankingBoard(); // Show session rankings on load
});
if (startGameBtn) { startGameBtn.addEventListener("click", startGameNow); }
if (playerNameInput) { playerNameInput.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); startGameNow(); } }); }
if (nextTurnBtn) { nextTurnBtn.addEventListener('click', processTurn); }
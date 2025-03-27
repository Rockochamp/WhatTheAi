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

const version = 'grok3_reasoning_half_hard'; // Updated version identifier
const gameTitle = 'steve_jobs_hammurabi';
const maxYears = 10; // Game runs for 10 years (0-9)
const leaderboardCollection = `leaderboard_${gameTitle}_${version}`;
const statsDoc = `stats_${gameTitle}_${version}`;
const volumeKey = `${gameTitle}_volume_v2`;

let playerName = ""; let gameStarted = false; let gameEnded = false;
let currentSessionRoundNumber = 0; let localSessionRankings = {};
let gameState = {};

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

// Assumes blocklist.js is loaded in HTML, e.g., <script src="blocklist.js"></script>
// declare var offensiveWords: string[]; // For TypeScript, if used

/***********************************************
 *           Volume Control Logic              *
 ***********************************************/
 function setupVolumeControl() {
    if (!backgroundMusic || !volumeSlider) return; const savedVolume = localStorage.getItem(volumeKey); let currentVolume = 0.5; if (savedVolume !== null && !isNaN(parseFloat(savedVolume))) currentVolume = parseFloat(savedVolume); volumeSlider.value = currentVolume; backgroundMusic.volume = currentVolume; volumeSlider.addEventListener('input', () => { const newVolume = parseFloat(volumeSlider.value); backgroundMusic.volume = newVolume; try { localStorage.setItem(volumeKey, newVolume.toString()); } catch (e) { console.error("Failed to save volume:", e); } });
}

/***********************************************
 *       Firestore Leaderboard & Stats         *
 ***********************************************/
function updateGlobalLeaderboard() {
    console.log(`Fetching leaderboard from: ${leaderboardCollection}`); db.collection(leaderboardCollection).orderBy("finalPawns", "desc").orderBy("timestamp", "desc").limit(50).get()
    .then((querySnapshot) => { let html = '<ol>'; const uniqueEntries = []; const pawnsSeen = new Set(); const maxDisplay = 10; console.log(`Leaderboard snapshot size: ${querySnapshot.size}`); if (!querySnapshot.empty) { querySnapshot.forEach((doc) => { const data = doc.data(); console.log("Leaderboard Doc:", doc.id, JSON.stringify(data)); if (data && typeof data.finalPawns !== 'undefined') { const currentPawnCount = data.finalPawns; const pName = data.playerName || 'Anon'; if (!pawnsSeen.has(currentPawnCount) && uniqueEntries.length < maxDisplay) { uniqueEntries.push(`<li>${pName}: ${currentPawnCount} pawns</li>`); pawnsSeen.add(currentPawnCount); } } else { console.warn("Skipping leaderboard doc with missing data:", doc.id); } }); } console.log("Unique entries found (by pawn count):", uniqueEntries.length); if (uniqueEntries.length === 0) { html = '<p>No scores yet. Be the first!</p>'; } else { html += uniqueEntries.join(''); html += '</ol>'; } if (globalRankingContentStart) globalRankingContentStart.innerHTML = html; if (globalRankingContentGame) globalRankingContentGame.innerHTML = html; })
    .catch((error) => { console.error("Error getting global leaderboard:", error); const errorMsg = "<p>Error loading leaderboard.</p>"; if (globalRankingContentStart) globalRankingContentStart.innerHTML = errorMsg; if (globalRankingContentGame) globalRankingContentGame.innerHTML = errorMsg; });
}
function addGlobalRecord(pName, finalPawns, finalYear) {
    const pawnsToSave = Math.max(0, finalPawns); console.log(`Attempting to add global record: P: ${pName}, Pawns: ${pawnsToSave}, Year: ${finalYear}, V: ${version}`);
    db.collection(leaderboardCollection).add({ playerName: pName || "Anon", finalPawns: pawnsToSave, finalYear: finalYear, version: version, timestamp: firebase.firestore.FieldValue.serverTimestamp() })
    .then((docRef) => { console.log(`Global record added successfully with ID: ${docRef.id}`); updateGlobalLeaderboard(); })
    .catch((error) => { console.error("!!! Error adding global record:", error); });
}
function incrementGlobalGamesPlayed() {
    db.collection("globalStats").doc(statsDoc).set({ totalGamesPlayed: firebase.firestore.FieldValue.increment(1), gameTitle: gameTitle, version: version }, { merge: true })
    .then(() => { console.log("Total games incremented."); displayGlobalGamesPlayed(); }).catch(console.error);
}
function displayGlobalGamesPlayed() {
    db.collection("globalStats").doc(statsDoc).get().then((doc) => { const total = doc.exists ? (doc.data().totalGamesPlayed || 0) : 0; const text = `(Total games played worldwide: ${total})`; if (globalGamesPlayedStart) globalGamesPlayedStart.innerText = text; if (globalGamesPlayedGame) globalGamesPlayedGame.innerText = text; })
    .catch((error) => { console.error("Error reading total games:", error); const errorText = "(Total games played worldwide: Error)"; if (globalGamesPlayedStart) globalGamesPlayedStart.innerText = errorText; if (globalGamesPlayedGame) globalGamesPlayedGame.innerText = errorText; });
}

/***********************************************
 *      Local Ranking (Page Load Only)         *
 ***********************************************/
 function updateRankingBoard() {
    if (!rankingContentEl) return; const rankingsList = Object.values(localSessionRankings); const sortedRankings = rankingsList.sort((a, b) => b.pawns - a.pawns); let html = ''; if (sortedRankings.length === 0) { html = '<p>No games completed yet.</p>'; } else { html = '<ol>'; sortedRankings.slice(0, 10).forEach((entry) => { html += `<li>Game ${entry.round}: ${entry.pawns} pawns</li>`; }); html += '</ol>'; } rankingContentEl.innerHTML = html;
}
function saveLocalRecord(roundNum, finalPawns) {
     const pawnsToSave = Math.max(0, finalPawns); localSessionRankings[pawnsToSave] = { round: roundNum, pawns: pawnsToSave }; updateRankingBoard();
}

 /***********************************************
 *          Name Validation                 *
 ***********************************************/
 function isNameOffensive(name) {
     // Check if offensiveWords is defined and is an array
     if (typeof offensiveWords === 'undefined' || !Array.isArray(offensiveWords)) {
         console.warn("Offensive words list (blocklist.js) not loaded or not an array!");
         return false;
     }
     if (!name) return false;
     const lowerCaseName = name.toLowerCase();
     for (const word of offensiveWords) {
         // Ensure word is a string before calling includes
         if (typeof word === 'string' && lowerCaseName.includes(word)) {
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
    // Initial state
    gameState = {
        year: 0,
        food: 1000,
        land: 100,
        pawns: 100,
        landPrice: Math.floor(Math.random()*11)+18, // Price: 18-28
        starvationRisk: 0 // Reset risk accumulator
    };
    gameEnded = false;

    // Reset UI inputs
    if(buyLandInput) buyLandInput.value=0;
    if(sellLandInput) sellLandInput.value=0;
    if(plantInput) plantInput.value=0;
    if(feedInput) feedInput.value=0;
    if(messageEl) messageEl.innerHTML= isRestart ? "Starting a new game." : "A new era begins. Rule wisely for 10 years!";

    // Reset button state
    if(nextTurnBtn) {
        nextTurnBtn.disabled=false;
        nextTurnBtn.textContent = "Confirm Decisions & End Year";
        nextTurnBtn.classList.remove('game-over-button');
        // Remove specific listeners to prevent duplicates and ensure correct one is added
        nextTurnBtn.removeEventListener('click', startNewGameHandler);
        nextTurnBtn.removeEventListener('click', processTurn); // Remove existing turn processor if any
        nextTurnBtn.addEventListener('click', processTurn); // Add the correct turn processor
    }

    updateUI();
}
function updateUI() {
    if(!gameStarted) return; // Don't update if game hasn't started

    if(yearEl) yearEl.textContent=`${gameState.year} / ${maxYears}`;
    if(decisionYearEl) decisionYearEl.textContent=gameState.year;
    if(foodEl) foodEl.textContent=Math.floor(gameState.food); // Show whole numbers
    if(landEl) landEl.textContent=gameState.land;
    if(pawnsEl) pawnsEl.textContent=gameState.pawns;
    if(landPriceEl) landPriceEl.textContent=gameState.landPrice;
}

/***********************************************
 *    Start, Restart & Game Over Logic         *
 ***********************************************/
function startGameNow() {
    const nameInput = playerNameInput.value.trim();
    if (nameInput === "") {
        alert("Please enter a player name.");
        return;
    }
    if (isNameOffensive(nameInput)) {
        alert("Please choose a more appropriate player name.");
        return;
    }
    playerName = nameInput.substring(0, 10); // Limit name length

    if(startScreen) startScreen.style.display="none";
    if(gameContainer) gameContainer.style.display="flex"; // Use flex for layout
    gameStarted = true;
    currentSessionRoundNumber = 1;
    localSessionRankings = {}; // Clear local rankings for new player

    resetGameUIAndState(false); // Initialize game state and UI
    updateRankingBoard(); // Show empty local ranking
    updateGlobalLeaderboard(); // Fetch global leaderboard
    displayGlobalGamesPlayed(); // Fetch global play count
    setupVolumeControl(); // Set up volume slider

    if (backgroundMusic) {
        backgroundMusic.play().catch(error => {
            // Autoplay is often blocked, inform the user.
            console.log("Music autoplay prevented:", error);
            if(messageEl) messageEl.innerHTML += "<br><small>(Music autoplay blocked. Adjust volume.)</small>";
        });
    } else {
        console.error("Background music element not found!");
    }
}

function handleGameOver(messagePrefix = "GAME OVER") {
    if (gameEnded) return; // Prevent multiple calls
    gameEnded = true;
    console.log("handleGameOver called");

    const finalPawns = gameState.pawns;
    const finalYearReached = gameState.year;

    if (messageEl) {
        let endMessage = `${messagePrefix}<br>`;
        if (finalPawns <= 0) {
            endMessage += `Your civilization collapsed in year ${finalYearReached}! Final Pawn Count: 0.`;
        } else if (finalYearReached >= maxYears) {
            endMessage += `You completed ${maxYears} years! Final Pawn Count: ${finalPawns}.`;
        } else {
            // This case might happen if called unexpectedly, though less likely now
            endMessage += `Game ended unexpectedly in year ${finalYearReached}. Final Pawn Count: ${finalPawns}.`;
        }
        messageEl.innerHTML = endMessage;
    }

    // Save scores and update stats
    saveLocalRecord(currentSessionRoundNumber, finalPawns);
    addGlobalRecord(playerName, finalPawns, finalYearReached);
    incrementGlobalGamesPlayed(); // Increment AFTER game ends

    // Update Button for Restart
    if(nextTurnBtn) {
        nextTurnBtn.textContent = "Start New Game";
        nextTurnBtn.classList.add('game-over-button');
        // Make sure only the restart handler is attached
        nextTurnBtn.removeEventListener('click', processTurn);
        nextTurnBtn.removeEventListener('click', startNewGameHandler); // Remove if already exists
        nextTurnBtn.addEventListener('click', startNewGameHandler); // Add restart handler
        nextTurnBtn.disabled = false; // Re-enable button for restart
    }
}

function startNewGameHandler() {
    console.log("Starting new game...");
    currentSessionRoundNumber++;
    resetGameUIAndState(true); // Reset for a new round
    // No need to update leaderboards here, they stay the same until next game ends
}


/***********************************************
 *          Hammurabi Game Turn Logic          *
 ***********************************************/
function processTurn() {
    // --- Initial Checks ---
    // Check if game should end *before* processing this turn's actions
    if (gameState.year >= maxYears) {
        console.log(`ProcessTurn START: Year (${gameState.year}) is >= maxYears (${maxYears}). Ending game.`);
        updateUI(); // Ensure UI shows final state before game over message
        handleGameOver(`You completed ${maxYears} years!`);
        return;
    }
    if (gameState.pawns <= 0) {
        console.log("ProcessTurn START: Pawns <= 0. Ending game.");
        updateUI(); // Ensure UI shows 0 pawns
        handleGameOver("Your civilization collapsed!");
        return;
    }
    if (gameEnded) {
        console.log("ProcessTurn START: Game ended flag is true. Stopping.");
        return; // Stop if game over logic already running
    }
    if (!gameStarted || !nextTurnBtn) return; // Should not happen if UI is correct

    console.log(`Processing decisions for year: ${gameState.year}`);

    // --- Read Player Inputs ---
    const buyLand = parseInt(buyLandInput?.value ?? 0) || 0;
    const sellLand = parseInt(sellLandInput?.value ?? 0) || 0;
    const plant = parseInt(plantInput?.value ?? 0) || 0;
    const feed = parseInt(feedInput?.value ?? 0) || 0;

    if(messageEl) messageEl.textContent = ""; // Clear previous messages
    let turnMessages = []; // Store messages for this turn
    let validationFailed = false;

    function failValidation(msg) {
        if (messageEl) messageEl.innerHTML = `<span style="color: #ff6666;">${msg}</span>`;
        validationFailed = true;
    }

    // --- Input Validation ---
    // Basic checks
    if (buyLand < 0 || sellLand < 0 || plant < 0 || feed < 0) {
        failValidation("Non-negative values only.");
    }
    // Land deal checks
    else if (buyLand > 0 && sellLand > 0) {
        failValidation("Cannot buy AND sell land in the same year.");
    } else if (buyLand * gameState.landPrice > gameState.food) {
        failValidation(`Not enough food to buy ${buyLand} acres. You need ${buyLand * gameState.landPrice} but only have ${Math.floor(gameState.food)}.`);
    } else if (sellLand > gameState.land) {
        failValidation(`Not enough land to sell. You only have ${gameState.land} acres.`);
    }
    // Planting & Feeding checks (calculate intermediate values)
    else {
        const foodAfterLandDeals = gameState.food - (buyLand * gameState.landPrice) + (sellLand * gameState.landPrice);
        const landAfterLandDeals = gameState.land + buyLand - sellLand;
        const pawnsAvailable = gameState.pawns;

        if (plant > foodAfterLandDeals) {
            failValidation(`Not enough food to plant ${plant} bushels. You will only have ${Math.floor(foodAfterLandDeals)} after land deals.`);
        } else if (plant > landAfterLandDeals) {
            failValidation(`Not enough land to plant on. You will only have ${landAfterLandDeals} acres after land deals.`);
        } else if (plant > pawnsAvailable * 10) { // 1 pawn tends 10 acres
            failValidation(`Not enough pawns to tend ${plant} acres. You need ${Math.ceil(plant / 10)} pawns but only have ${pawnsAvailable}.`);
        } else {
            const foodAfterPlanting = foodAfterLandDeals - plant;
            const totalFoodNeededForFeeding = feed * pawnsAvailable; // Check total needed
             // Check if enough food *in total* after land deals and planting
            if (totalFoodNeededForFeeding > foodAfterPlanting) {
                 failValidation(`Not enough food to feed ${pawnsAvailable} pawns ${feed} bushels each. You need ${totalFoodNeededForFeeding} but will only have ${Math.floor(foodAfterPlanting)} after land deals and planting.`);
            }
            // If all checks pass, proceed
        }
    }

    // If any validation failed, stop processing the turn
    if (validationFailed) return;

    // Disable button during processing
    nextTurnBtn.disabled = true;

    // --- Apply Decisions ---
    // 1. Land Transactions
    if (buyLand > 0) {
        gameState.food -= buyLand * gameState.landPrice;
        gameState.land += buyLand;
        turnMessages.push(`Bought ${buyLand} acres.`);
    } else if (sellLand > 0) {
        gameState.food += sellLand * gameState.landPrice;
        gameState.land -= sellLand;
        turnMessages.push(`Sold ${sellLand} acres.`);
    }

    // 2. Planting
    if (plant > 0) {
        gameState.food -= plant; // Use food for seeds
        turnMessages.push(`Used ${plant} bushels for planting.`);
    }

    // 3. Feeding
    const totalFoodUsedForFeeding = feed * gameState.pawns;
    if (totalFoodUsedForFeeding > 0) {
        gameState.food -= totalFoodUsedForFeeding;
        turnMessages.push(`Used ${totalFoodUsedForFeeding} bushels to feed ${gameState.pawns} pawns.`);
    }

    // 4. Harvest
    // *** DIFFICULTY ADJUSTMENT: Increased minimum yield ***
    const yieldPerAcre = Math.floor(Math.random() * 5) + 3; // Yield: 3-7 bushels/acre
    const foodHarvested = plant * yieldPerAcre;
    if (plant > 0) {
        gameState.food += foodHarvested;
        turnMessages.push(`Harvested ${foodHarvested} bushels (${yieldPerAcre}/acre).`);
    } else {
        turnMessages.push("No crops planted.");
    }

    // --- Starvation Check ---
    let pawnsStarved = 0;
    const requiredFoodPerPawn = 20;

    // --- ADJUSTED PARAMETERS (Half Difficulty) ---
    const riskRecoveryRate = 0.35; // Increased recovery when fed well
    const riskIncreaseFactor = 0.4; // Decreased risk accumulation for *moderate* deficit
    const deathThreshold = 0.85; // Increased threshold before deaths start
    const deathRateFactor = 0.20; // Decreased death rate once threshold is crossed
    const maxDeathFraction = 0.45; // Reduced max death fraction slightly
    // --- END ADJUSTED PARAMETERS ---

    // Calculate deficit based on player's `feed` input
    let foodDeficitPerPawn = 0;
    if (gameState.pawns > 0) {
        const actualFeedPerPawn = Math.max(0, feed); // Use the input feed amount
        foodDeficitPerPawn = Math.max(0, requiredFoodPerPawn - actualFeedPerPawn);
    }

    // Update Starvation Risk based on deficit or surplus
    if (foodDeficitPerPawn > 0) {
        // Risk increases proportionally to the deficit
        const deficitFraction = foodDeficitPerPawn / requiredFoodPerPawn;
        gameState.starvationRisk += deficitFraction * riskIncreaseFactor;
        // Optional: Add message only if risk increases significantly?
        // turnMessages.push(`Starvation risk increased due to food deficit.`);
    } else {
        // Risk decreases if feeding is sufficient
        gameState.starvationRisk = Math.max(0, gameState.starvationRisk - riskRecoveryRate);
    }
    // Log risk for balancing/debugging if needed
    // console.log(`End of year ${gameState.year}, Starvation Risk: ${gameState.starvationRisk.toFixed(2)}`);

    // Calculate deaths based on accumulated risk
    if (gameState.starvationRisk > deathThreshold && gameState.pawns > 0) {
        const riskAboveThreshold = gameState.starvationRisk - deathThreshold;
        // Calculate fraction dying based on how far risk is above threshold
        const starvationFraction = Math.min(maxDeathFraction, riskAboveThreshold * deathRateFactor);
        pawnsStarved = Math.min(gameState.pawns, Math.ceil(gameState.pawns * starvationFraction)); // Ensure whole number, don't kill more than exist

        if (pawnsStarved > 0) {
             if (gameState.starvationRisk > 1.5) { // Adjusted message threshold for "severe"
                turnMessages.push(`<span style="color: red;">SEVERE STARVATION! ${pawnsStarved} pawns died due to lack of food!</span>`);
            } else {
                 turnMessages.push(`<span style="color: red;">STARVATION! ${pawnsStarved} pawns died due to lack of food!</span>`);
            }
        }
    }

    // Apply starvation deaths
    if (pawnsStarved > 0) {
        gameState.pawns -= pawnsStarved;
    }

    // --- Financial Collapse Check ---
    // Check for negative food state AFTER harvest/feeding but BEFORE population change/events
    // This represents running out of reserves entirely
    if (gameState.food < 0 && gameState.pawns > 0) {
        const foodShortage = Math.abs(gameState.food);
        // How many pawns would this shortage kill? (Less harsh than direct starvation)
        const additionalStarved = Math.min(gameState.pawns, Math.ceil(foodShortage / (requiredFoodPerPawn * 0.75))); // Die from absolute lack of resources

        if (additionalStarved > 0) {
            gameState.pawns -= additionalStarved;
            turnMessages.push(`<span style="color: red;">FINANCIAL COLLAPSE! Resources depleted, ${additionalStarved} more pawns perished!</span>`);
        }
        gameState.food = 0; // Cannot have negative food
    }

    // --- Population Changes & Random Events (Only if pawns > 0 AFTER starvation/collapse) ---
    if (gameState.pawns > 0) {
        // Immigration (more likely with better feeding)
        let pawnsGained = 0;
        const immigrationChance = (feed / 30); // Higher feed attracts more (cap feed effect if needed)
        if (Math.random() < immigrationChance) {
            // Gain based on current population and land availability
            pawnsGained = Math.min(50, Math.floor(Math.random() * (gameState.pawns * 0.1 + gameState.land * 0.01) + 1));
            gameState.pawns += pawnsGained;
            if (pawnsGained > 0) turnMessages.push(`${pawnsGained} new pawns arrived, attracted by your rule.`);
        }

        // Emigration (small chance if feeding is very poor)
        let pawnsLeft = 0;
        // Only trigger if significantly underfed AND random chance
        if (feed < requiredFoodPerPawn / 2 && Math.random() < 0.05) {
            pawnsLeft = Math.min(gameState.pawns, Math.floor(Math.random() * (gameState.pawns * 0.05) + 1));
            gameState.pawns -= pawnsLeft;
            if (pawnsLeft > 0) turnMessages.push(`${pawnsLeft} pawns left due to harsh conditions.`);
        }

        // Random Events
        const eventChance = Math.random();
        if (eventChance < 0.15 && gameState.food > 10) { // Rats (15% chance)
            // *** DIFFICULTY ADJUSTMENT: Reduced max rat impact ***
            const foodLostPercent = Math.random() * 0.15 + 0.05; // 5% to 20% loss
            const foodLost = Math.max(1, Math.floor(gameState.food * foodLostPercent));
            gameState.food -= foodLost;
            turnMessages.push(`<span style="color: orange;">Rats! Infestation destroyed ${foodLost} bushels of food.</span>`);
        } else if (eventChance >= 0.15 && eventChance < 0.25 && foodHarvested > 0) { // Bonus Harvest (10% chance)
            const foodGainedPercent = Math.random() * 0.1 + 0.05; // 5% to 15% bonus
            const foodGained = Math.max(1, Math.floor(foodHarvested * foodGainedPercent));
            gameState.food += foodGained;
            turnMessages.push(`<span style="color: lightgreen;">Bonus harvest! Favorable weather brought an extra ${foodGained} bushels.</span>`);
        } else if (eventChance >= 0.30 && eventChance < 0.40 && gameState.pawns > 10) { // Plague (10% chance)
            // *** DIFFICULTY ADJUSTMENT: Reduced max plague impact ***
            const plaguePercent = Math.random() * 0.15 + 0.05; // 5% to 20% loss
            let plagueVictims = Math.min(gameState.pawns, Math.max(1, Math.floor(gameState.pawns * plaguePercent)));
            gameState.pawns -= plagueVictims;
            turnMessages.push(`<span style="color: red;">Plague! A deadly disease struck, ${plagueVictims} pawns died.</span>`);
        }
    }

    // --- Final State Checks for Game Over (AFTER all calculations) ---
    if (gameState.pawns <= 0) {
        console.log(`ProcessTurn END: Pawns reached zero or below in year ${gameState.year}. Ending game.`);
        gameState.pawns = 0; // Ensure pawns don't go negative
        updateUI(); // Update UI to show 0 pawns
        handleGameOver("Your civilization collapsed!");
        return; // End turn processing immediately
    }

    // --- If game continues: Advance Year and Prepare for Next Turn ---
    gameState.year++; // Increment year *after* all current year events resolve
    gameState.landPrice = Math.floor(Math.random() * 11) + 18; // New land price for next year (18-28)

    updateUI(); // Update display with new state
    if(messageEl) messageEl.innerHTML = turnMessages.join("<br>"); // Show turn summary

    // --- Final Check: Game End condition for NEXT turn start ---
    // Check if the *incremented* year has reached the limit
    if (gameState.year >= maxYears) {
        console.log(`ProcessTurn END: Year incremented to ${gameState.year}. Max years reached. Ending game.`);
        // Call handleGameOver again here, specifically for the max year condition.
        // It handles the message and button state correctly. The gameEnded flag prevents duplicates.
        handleGameOver(`You completed ${maxYears} years!`);
    } else {
        // Reset inputs for the *next* turn
        if(buyLandInput) buyLandInput.value = 0;
        if(sellLandInput) sellLandInput.value = 0;
        if(plantInput) plantInput.value = 0;
        if(feedInput) feedInput.value = 0;
        // Re-enable button only if game is not over
        if (!gameEnded) {
             nextTurnBtn.disabled = false;
        }
    }
}


/***********************************************
 *          Initialization & Listeners         *
 ***********************************************/
document.addEventListener('DOMContentLoaded', () => {
    // Initial setup on page load
    currentSessionRoundNumber = 0;
    localSessionRankings = {}; // Reset local ranking on page load
    setupVolumeControl(); // Setup volume control early
    updateGlobalLeaderboard(); // Fetch global leaderboard on load
    displayGlobalGamesPlayed(); // Fetch global play count on load
    updateRankingBoard(); // Display initial (empty) local ranking

    // Show start screen, hide game initially
    if(startScreen) startScreen.style.display="block";
    if(gameContainer) gameContainer.style.display="none";
});

// Listener for the main start game button
if (startGameBtn) {
    startGameBtn.addEventListener("click", startGameNow);
}
// Listener for Enter key in player name input
if (playerNameInput) {
    playerNameInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault(); // Prevent potential form submission
            startGameNow();
        }
    });
}

// The initial listener for 'Next Turn' is added in resetGameUIAndState
// The listener for 'Start New Game' is added in handleGameOver
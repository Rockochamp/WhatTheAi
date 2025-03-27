/***********************************************
 *  Firebase Initialization & Global Vars      *
 ***********************************************/
const firebaseConfig = {
    apiKey: "AIzaSyBop7YMrZIO05yknhCm_mqjbtXP_Gl58sE",
    authDomain: "cosmicdodge-5ae20.firebaseapp.com",
    projectId: "cosmicdodge-5ae20",
    storageBucket: "cosmicdodge-5ae20.appspot.com",
    messagingSenderId: "940230809594",
    appId: "1:940230809594:web:0b3b1dabe1e5c2f5f47643"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// --- Game & Version Info ---
const version = 'grok3_reasoning_uncapped'; // Updated version identifier
const gameTitle = 'steve_jobs_hammurabi';
const leaderboardCollection = `leaderboard_${gameTitle}_${version}`;
const statsDoc = `stats_${gameTitle}_${version}`;

// --- Global State ---
let playerName = "";
let gameStarted = false;
let gameEnded = false; // Track if the current game has ended and score submitted

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
const globalRankingContentStart = document.getElementById('globalRankingContentStart');
const globalRankingContentGame = document.getElementById('globalRankingContentGame');
const globalGamesPlayedStart = document.getElementById("globalGamesPlayedStart");
const globalGamesPlayedGame = document.getElementById("globalGamesPlayedGame");

// --- Constants ---
const HAMMURABI_VOLUME_KEY = 'hammurabiVolume_v2'; // Use a new key if format changed

// --- Initial Hammurabi Game State ---
let gameState = {};


/***********************************************
 *  Volume Control Logic                       *
 ***********************************************/
function setupVolumeControl() {
    if (!backgroundMusic || !volumeSlider) {
        console.warn("Volume elements not found.");
        return;
    }
    const savedVolume = localStorage.getItem(HAMMURABI_VOLUME_KEY);
    let currentVolume = 0.5; // Default volume
    if (savedVolume !== null && !isNaN(parseFloat(savedVolume))) {
        currentVolume = parseFloat(savedVolume);
    }
    volumeSlider.value = currentVolume;
    backgroundMusic.volume = currentVolume;

    volumeSlider.addEventListener('input', () => {
        const newVolume = parseFloat(volumeSlider.value);
        backgroundMusic.volume = newVolume;
        try {
            localStorage.setItem(HAMMURABI_VOLUME_KEY, newVolume.toString());
        } catch (e) {
            console.error("Failed to save volume to localStorage:", e);
        }
    });
}

/***********************************************
 *  Firestore Leaderboard Functions            *
 ***********************************************/
function updateGlobalLeaderboard() {
    db.collection(leaderboardCollection)
        .orderBy("finalYear", "desc") // Order by year survived first
        .orderBy("finalPawns", "desc") // Then by pawns as tie-breaker
        .limit(20)
        .get()
        .then((querySnapshot) => {
            let html = '<ol>';
            if (querySnapshot.empty) {
                html = '<p>No scores yet. Be the first!</p>';
            } else {
                querySnapshot.forEach((doc) => {
                    const data = doc.data();
                    const pawnsDisplay = data.finalPawns > 0 ? `(${data.finalPawns} pawns remaining)` : '(all pawns lost)';
                    html += `<li>${data.playerName || 'Anon'}: ${data.finalYear} years ${pawnsDisplay}</li>`;
                });
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

function addGlobalRecord(pName, year, pawns) {
    if (gameEnded) return; // Prevent duplicate submissions

    const finalPawns = Math.max(0, pawns); // Ensure non-negative

    db.collection(leaderboardCollection).add({
        playerName: pName || "Anon",
        finalYear: year,
        finalPawns: finalPawns,
        version: version,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    })
    .then(() => {
        console.log(`Global record added: ${pName || 'Anon'}, Year ${year}, Pawns ${finalPawns}`);
        gameEnded = true; // Mark as ended
        updateGlobalLeaderboard(); // Refresh leaderboard display
    })
    .catch((error) => {
        console.error("Error adding global record:", error);
        // Optionally inform the user score submission failed
    });
}

/***********************************************
 *  Global "Total Games Played" Logic          *
 ***********************************************/
function incrementGlobalGamesPlayed() {
    const docRef = db.collection("globalStats").doc(statsDoc);
    docRef.set({
        totalGamesPlayed: firebase.firestore.FieldValue.increment(1),
        gameTitle: gameTitle,
        version: version
    }, { merge: true })
    .then(() => {
        console.log("Total games incremented");
        displayGlobalGamesPlayed();
    })
    .catch((error) => console.error("Error incrementing total games:", error));
}

function displayGlobalGamesPlayed() {
    const docRef = db.collection("globalStats").doc(statsDoc);
    docRef.get().then((doc) => {
        const total = doc.exists ? (doc.data().totalGamesPlayed || 0) : 0;
        const text = `(Total games played worldwide: ${total})`;
        if (globalGamesPlayedStart) globalGamesPlayedStart.innerText = text;
        if (globalGamesPlayedGame) globalGamesPlayedGame.innerText = text;
    }).catch((error) => {
        console.error("Error reading total games:", error);
        const errorText = "(Total games played worldwide: Error)";
        if (globalGamesPlayedStart) globalGamesPlayedStart.innerText = errorText;
        if (globalGamesPlayedGame) globalGamesPlayedGame.innerText = errorText;
    });
}

/***********************************************
 *  Game State & UI Updates                    *
 ***********************************************/
function resetGameUIAndState() {
    gameState = {
        year: 1,
        food: 1000,
        land: 100,
        pawns: 100,
        landPrice: Math.floor(Math.random() * 11) + 18 // Initial random price (18-28)
    };
    gameEnded = false;

    if (buyLandInput) buyLandInput.value = 0;
    if (sellLandInput) sellLandInput.value = 0;
    if (plantInput) plantInput.value = 0;
    if (feedInput) feedInput.value = 0;
    if (messageEl) messageEl.innerHTML = "A new era begins. Manage your resources wisely."; // Use innerHTML for potential breaks
    if (nextTurnBtn) nextTurnBtn.disabled = false;

    updateUI(); // Update display with initial state
}

function updateUI() {
    if (!gameStarted) return;

    if (yearEl) yearEl.textContent = gameState.year;
    if (decisionYearEl) decisionYearEl.textContent = gameState.year; // Update decision year label
    if (foodEl) foodEl.textContent = Math.floor(gameState.food);
    if (landEl) landEl.textContent = gameState.land;
    if (pawnsEl) pawnsEl.textContent = gameState.pawns;
    if (landPriceEl) landPriceEl.textContent = gameState.landPrice;
}


/***********************************************
 *  Start Game Function                       *
 ***********************************************/
function startGameNow() {
    const nameInput = playerNameInput.value.trim();
    playerName = nameInput.substring(0, 10) || "Anon"; // Default to Anon if empty

    if (startScreen) startScreen.style.display = "none";
    if (gameContainer) gameContainer.style.display = "flex";

    gameStarted = true;

    resetGameUIAndState();
    incrementGlobalGamesPlayed();

    // Load leaderboards/stats for game view
    updateGlobalLeaderboard();
    displayGlobalGamesPlayed();

    // --- Play Music ---
    setupVolumeControl(); // Ensure volume is set based on saved pref/default
    if (backgroundMusic) {
        backgroundMusic.play().catch(error => {
            console.log("Music autoplay was prevented:", error);
            // Optional: Add a button/message asking user to enable sound
            if(messageEl) messageEl.innerHTML += "<br><small>(Music autoplay blocked. Adjust volume or interact to enable.)</small>";
        });
    } else {
         console.error("Background music element not found!");
    }
}

/***********************************************
 *  Hammurabi Game Turn Logic                 *
 ***********************************************/
function processTurn() {
    if (!gameStarted || gameEnded || !nextTurnBtn) return;

    const buyLand = parseInt(buyLandInput?.value ?? 0) || 0;
    const sellLand = parseInt(sellLandInput?.value ?? 0) || 0;
    const plant = parseInt(plantInput?.value ?? 0) || 0;
    const feed = parseInt(feedInput?.value ?? 0) || 0;

    if (messageEl) messageEl.textContent = ""; // Clear previous outcome first
    let turnMessages = [];

    // --- Input Validation ---
    let validationFailed = false;
    function failValidation(msg) {
        if(messageEl) messageEl.textContent = msg;
        validationFailed = true;
    }

    if (buyLand < 0 || sellLand < 0 || plant < 0 || feed < 0) {
         failValidation("Please enter non-negative values for decisions.");
    } else if (buyLand > 0 && sellLand > 0) {
        failValidation("You cannot buy AND sell land in the same year.");
    } else if (buyLand * gameState.landPrice > gameState.food) {
        failValidation(`Not enough food to buy ${buyLand} acres! You only have ${Math.floor(gameState.food)} bushels.`);
    } else if (sellLand > gameState.land) {
        failValidation(`You don't have ${sellLand} acres to sell! You only own ${gameState.land} acres.`);
    } else if (plant > gameState.food - (buyLand * gameState.landPrice)) {
        failValidation(`Not enough food to plant ${plant} acres after land purchase! Need ${plant} bushels, have ${Math.floor(gameState.food - (buyLand * gameState.landPrice))} left.`);
    } else if (plant > gameState.land + buyLand - sellLand) {
        failValidation(`Not enough land to plant ${plant} acres! You will own ${gameState.land + buyLand - sellLand} acres.`);
    } else if (plant > gameState.pawns * 10) {
        failValidation(`Not enough pawns to plant ${plant} acres! Need ${Math.ceil(plant / 10)} pawns, have ${gameState.pawns}.`);
    } else {
        const foodAfterLandAndPlanting = gameState.food - (buyLand * gameState.landPrice) + (sellLand * gameState.landPrice) - plant;
        const totalFoodNeededForFeeding = feed * gameState.pawns;
        if (totalFoodNeededForFeeding > foodAfterLandAndPlanting) {
             failValidation(`Not enough food to feed pawns! Need ${totalFoodNeededForFeeding} bushels, only ${Math.floor(foodAfterLandAndPlanting)} left after planting/land deals.`);
        }
    }

    if (validationFailed) return; // Stop processing if validation failed

    // --- Disable button during processing ---
    nextTurnBtn.disabled = true;

    // --- Process Actions (Apply Costs) ---
    if (buyLand > 0) {
        gameState.food -= buyLand * gameState.landPrice;
        gameState.land += buyLand;
        turnMessages.push(`Bought ${buyLand} acres for ${buyLand * gameState.landPrice} bushels.`);
    } else if (sellLand > 0) {
        gameState.food += sellLand * gameState.landPrice;
        gameState.land -= sellLand;
        turnMessages.push(`Sold ${sellLand} acres for ${sellLand * gameState.landPrice} bushels.`);
    }

    gameState.food -= plant; // Planting cost
    if (plant > 0) turnMessages.push(`Used ${plant} bushels to plant ${plant} acres.`);

    const totalFoodUsedForFeeding = feed * gameState.pawns;
    gameState.food -= totalFoodUsedForFeeding; // Feeding cost
    if (totalFoodUsedForFeeding > 0) turnMessages.push(`Used ${totalFoodUsedForFeeding} bushels to feed ${gameState.pawns} pawns.`);

    // --- Calculate Outcomes ---
    // 1. Harvest
    const yieldPerAcre = Math.floor(Math.random() * 5) + 2; // 2-6
    const foodHarvested = plant * yieldPerAcre;
    gameState.food += foodHarvested;
    if (plant > 0) turnMessages.push(`Harvested ${foodHarvested} bushels (${yieldPerAcre}/acre).`);

    // 2. Starvation Check (Post-Harvest) - should be less likely with validation, but keep as failsafe
    // Note: This check might be redundant if feeding validation is solid.
    if (gameState.food < 0) { // If calculations resulted in negative food (extreme shortage)
        const foodShortage = Math.abs(gameState.food);
        // Assume minimum 1 bushel needed per pawn to survive if feed rate was 0
        const theoreticalMinFeed = Math.max(1, feed);
        const pawnsStarved = Math.min(gameState.pawns, Math.ceil(foodShortage / theoreticalMinFeed));
        gameState.pawns -= pawnsStarved;
        turnMessages.push(`!!! STARVATION !!! ${pawnsStarved} pawns died due to food shortage!`);
        gameState.food = 0; // Reset food to zero
    }

    // 3. Population Changes (if pawns > 0)
    let pawnsGained = 0;
    let pawnsLost = 0;
    if (gameState.pawns > 0) {
        if (feed >= 2) {
            pawnsGained = Math.floor(Math.random() * (gameState.pawns * 0.1) + 1);
            pawnsGained = Math.min(pawnsGained, 50); // Cap gain
            gameState.pawns += pawnsGained;
            if (pawnsGained > 0) turnMessages.push(`Well fed! ${pawnsGained} new pawns arrived.`);
        } else if (feed < 1) {
            pawnsLost = Math.floor(Math.random() * (gameState.pawns * 0.15) + 1);
            pawnsLost = Math.min(pawnsLost, gameState.pawns);
            gameState.pawns -= pawnsLost;
            if (pawnsLost > 0) turnMessages.push(`Poorly fed! ${pawnsLost} pawns left.`);
        }

         // 4. Random Events (check after population changes for the year)
        const eventChance = Math.random();
        if (eventChance < 0.15 && gameState.food > 10) { // Rats (need some food to attract them)
            const foodLost = Math.max(1, Math.floor(gameState.food * (Math.random() * 0.2 + 0.1))); // Lose 10-30%, at least 1
            gameState.food -= foodLost;
            turnMessages.push(`Disaster! Rats ate ${foodLost} bushels.`);
        } else if (eventChance >= 0.15 && eventChance < 0.30 && foodHarvested > 0) { // Good Harvest Bonus
            const foodGained = Math.max(1, Math.floor(foodHarvested * (Math.random() * 0.2 + 0.1))); // Gain 10-30% bonus, at least 1
            gameState.food += foodGained;
            turnMessages.push(`Good fortune! Excellent weather yielded an extra ${foodGained} bushels.`);
        } else if (eventChance >= 0.30 && eventChance < 0.40 && gameState.pawns > 0) { // Plague
            let plagueVictims = Math.max(1, Math.floor(gameState.pawns * (Math.random() * 0.3 + 0.1))); // Lose 10-40%, at least 1
            plagueVictims = Math.min(plagueVictims, gameState.pawns); // Cap loss
            gameState.pawns -= plagueVictims;
            turnMessages.push(`Disaster! A plague killed ${plagueVictims} pawns.`);
        }
    } // End if pawns > 0

    // --- Final Pawn Check & Game Over ---
    if (gameState.pawns <= 0) {
        gameState.pawns = 0; // Ensure exactly 0
        turnMessages.push("--- GAME OVER ---");
        turnMessages.push(`All your pawns have perished in year ${gameState.year}! Your rule ends in ruin.`);
        if(messageEl) messageEl.innerHTML = turnMessages.join("<br>");
        addGlobalRecord(playerName, gameState.year, 0); // Record final score
        updateUI(); // Final UI update for game over state
        // Button remains disabled
        return; // Stop further processing
    }

    // --- Prepare for Next Turn (If Game Continues) ---
    gameState.year++;
    gameState.landPrice = Math.floor(Math.random() * 11) + 18; // New land price (18-28)

    // --- Update UI for Next Turn ---
    updateUI();
    if (messageEl) messageEl.innerHTML = turnMessages.join("<br>");

    // --- Reset Inputs for Next Turn ---
    if(buyLandInput) buyLandInput.value = 0;
    if(sellLandInput) sellLandInput.value = 0;
    if(plantInput) plantInput.value = 0;
    if(feedInput) feedInput.value = 0;

    // --- Re-enable button for next turn ---
    nextTurnBtn.disabled = false;
}


/***********************************************
 *  Event Listeners                           *
 ***********************************************/
document.addEventListener('DOMContentLoaded', () => {
    setupVolumeControl(); // Setup volume slider visuals/saved state
    updateGlobalLeaderboard(); // Load initial leaderboard
    displayGlobalGamesPlayed(); // Load initial stats
    // Start screen is shown by default
});

if (startGameBtn) {
    startGameBtn.addEventListener("click", startGameNow);
}

if (playerNameInput) {
    playerNameInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            startGameNow();
        }
    });
}

if (nextTurnBtn) {
    nextTurnBtn.addEventListener('click', processTurn);
}
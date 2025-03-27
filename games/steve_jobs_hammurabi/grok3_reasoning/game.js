// === Add near the top with other DOM element references ===
const backgroundMusic = document.getElementById('backgroundMusic');
const volumeSlider = document.getElementById('volumeSlider');
const HAMMURABI_VOLUME_KEY = 'hammurabiVolume'; // localStorage key

/***********************************************
 *  Volume Control Logic                       *
 ***********************************************/
function setupVolumeControl() {
    if (!backgroundMusic || !volumeSlider) return;

    // 1. Load saved volume or use default
    const savedVolume = localStorage.getItem(HAMMURABI_VOLUME_KEY);
    let currentVolume = 0.5; // Default volume
    if (savedVolume !== null) {
        currentVolume = parseFloat(savedVolume);
    }

    // 2. Set initial slider value and audio volume
    volumeSlider.value = currentVolume;
    backgroundMusic.volume = currentVolume;

    // 3. Add event listener to slider
    volumeSlider.addEventListener('input', () => {
        const newVolume = parseFloat(volumeSlider.value);
        backgroundMusic.volume = newVolume;
        // Save the new volume setting
        localStorage.setItem(HAMMURABI_VOLUME_KEY, newVolume);
    });
}


// === Modify startGameNow function ===
function startGameNow() {
    const nameInput = document.getElementById("playerName").value.trim();
    // Allow empty names, default to "Anon" later
    playerName = nameInput.substring(0, 10);

    // Hide start screen, show game container
    document.getElementById("startScreen").style.display = "none";
    document.getElementById("gameContainer").style.display = "flex";

    gameStarted = true;

    // Reset the Hammurabi game state and UI elements
    resetGameUIAndState();

    // Increment global games played counter for this attempt
    incrementGlobalGamesPlayed();

    // Initial load of leaderboards for the game view
    updateGlobalLeaderboard();
    displayGlobalGamesPlayed();

    // --- Play Music ---
    if (backgroundMusic) {
        // Set initial volume based on slider/localStorage before playing
        setupVolumeControl(); // Ensure volume is set
        backgroundMusic.play().catch(error => {
            console.log("Music autoplay was prevented:", error);
            // Optional: Show a message or button to enable music if autoplay fails
        });
    } else {
         console.error("Background music element not found!");
    }
    // ------------------
}

// === Modify or Add near the end of the script ===
// Initial data load on page ready
document.addEventListener('DOMContentLoaded', () => {
    updateGlobalLeaderboard();
    displayGlobalGamesPlayed();
    // Setup volume control even before game starts so slider reflects saved value
    setupVolumeControl();
});

// ********* Keep ALL the existing Firebase and game logic below *********
// (Firebase Init, Leaderboard functions, Stats functions, Hammurabi logic, etc.)
// ***********************************************************************

/***********************************************
 *  Firebase Initialization & Global Vars      *
 ***********************************************/
const firebaseConfig = {
    // --- IMPORTANT: Use your actual Firebase config ---
    apiKey: "AIzaSyBop7YMrZIO05yknhCm_mqjbtXP_Gl58sE",
    authDomain: "cosmicdodge-5ae20.firebaseapp.com",
    projectId: "cosmicdodge-5ae20", // Your project ID
    storageBucket: "cosmicdodge-5ae20.appspot.com",
    messagingSenderId: "940230809594",
    appId: "1:940230809594:web:0b3b1dabe1e5c2f5f47643"
    // -------------------------------------------------
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Define version static value for this specific game version
const version = 'grok3_reasoning'; // <--- Unique identifier for this version
const gameTitle = 'steve_jobs_hammurabi'; // Base game title for collections

let playerName = "";
let gameStarted = false;
let gameEnded = false; // Track if the current game has ended and score submitted

/***********************************************
 *  Firestore Leaderboard Functions            *
 ***********************************************/
function updateGlobalLeaderboard() {
    // Collection name based on game title and version
    const leaderboardCollection = `leaderboard_${gameTitle}_${version}`;

    db.collection(leaderboardCollection)
        .orderBy("finalYear", "desc") // Order by year survived first
        .orderBy("finalPawns", "desc") // Then by pawns
        .limit(20)
        .get()
        .then((querySnapshot) => {
            let html = '<ol>';
            if (querySnapshot.empty) {
                html = '<p>No scores yet. Be the first!</p>';
            } else {
                querySnapshot.forEach((doc) => {
                    const data = doc.data();
                    // Handle cases where pawns might be 0 or negative if logic allows
                    const pawnsDisplay = data.finalPawns > 0 ? `${data.finalPawns} pawns` : 'all pawns lost';
                    html += `<li>${data.playerName || 'Anon'}: Yr ${data.finalYear}, ${pawnsDisplay}</li>`;
                });
                html += '</ol>';
            }
            const startEl = document.getElementById('globalRankingContentStart');
            const gameEl = document.getElementById('globalRankingContentGame');
            if (startEl) startEl.innerHTML = html;
            if (gameEl) gameEl.innerHTML = html;

        })
        .catch((error) => {
            console.error("Error getting global leaderboard:", error);
            const errorMsg = "Error loading leaderboard.";
            const startEl = document.getElementById('globalRankingContentStart');
            const gameEl = document.getElementById('globalRankingContentGame');
            if (startEl) startEl.innerHTML = errorMsg;
            if (gameEl) gameEl.innerHTML = errorMsg;
        });
}

// Add a record for the completed game
function addGlobalRecord(pName, year, pawns) {
    // Prevent adding score if game already ended and recorded
    if (gameEnded) return;

    // Collection name based on game title and version
    const leaderboardCollection = `leaderboard_${gameTitle}_${version}`;

    // Ensure pawns isn't negative if game logic could cause that before game over
    const finalPawns = Math.max(0, pawns);

    db.collection(leaderboardCollection).add({
        playerName: pName || "Anon",
        finalYear: year,
        finalPawns: finalPawns,
        version: version, // Store the version with the score
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    })
    .then(() => {
        console.log("Global record added for", pName);
        gameEnded = true; // Mark game as ended to prevent duplicate scores
        updateGlobalLeaderboard(); // Refresh leaderboard after adding
    })
    .catch((error) => {
        console.error("Error adding global record:", error);
    });
}

/***********************************************
 *  Global "Total Games Played" Logic          *
 ***********************************************/
function incrementGlobalGamesPlayed() {
    // Document name based on game title and version
    const statsDoc = `stats_${gameTitle}_${version}`;

    const docRef = db.collection("globalStats").doc(statsDoc); // Use a general collection for stats
    docRef.set({
        totalGamesPlayed: firebase.firestore.FieldValue.increment(1),
        gameTitle: gameTitle, // Optional: Store game title for reference
        version: version      // Optional: Store version for reference
    }, { merge: true }) // Use merge:true to create doc if not exists, or update if it does
    .then(() => {
        console.log("Total games incremented");
        displayGlobalGamesPlayed(); // Update display after incrementing
    })
    .catch((error) => {
        console.error("Error incrementing total games:", error);
    });
}

function displayGlobalGamesPlayed() {
    // Document name based on game title and version
    const statsDoc = `stats_${gameTitle}_${version}`;
    const docRef = db.collection("globalStats").doc(statsDoc);

    docRef.get().then((doc) => {
        const total = doc.exists ? (doc.data().totalGamesPlayed || 0) : 0;
        const text = `(Total games played worldwide: ${total})`;
        const startEl = document.getElementById("globalGamesPlayedStart");
        const gameEl = document.getElementById("globalGamesPlayedGame");
        if (startEl) startEl.innerText = text;
        if (gameEl) gameEl.innerText = text;
    }).catch((error) => {
        console.error("Error reading total games:", error);
        const errorText = "(Total games played worldwide: Error)";
         const startEl = document.getElementById("globalGamesPlayedStart");
        const gameEl = document.getElementById("globalGamesPlayedGame");
        if (startEl) startEl.innerText = errorText;
        if (gameEl) gameEl.innerText = errorText;
    });
}


/***********************************************
 *  Start Game / Session Management           *
 ***********************************************/
 function resetGameUIAndState() {
    // Reset Hammurabi game state
    gameState = {
        year: 1,
        food: 1000,
        land: 100,
        pawns: 100,
        landPrice: Math.floor(Math.random() * 11) + 18 // Start with random price
    };
    gameEnded = false; // Reset game end flag

    // Reset input fields
    if(buyLandInput) buyLandInput.value = 0;
    if(sellLandInput) sellLandInput.value = 0;
    if(plantInput) plantInput.value = 0;
    if(feedInput) feedInput.value = 0;

    // Reset outcome message
    if(messageEl) messageEl.textContent = "The fate of your pawns is in your hands...";

    // Re-enable the button
    if(nextTurnBtn) nextTurnBtn.disabled = false;

    // Update the UI with initial state
    updateUI();
}

// We already modified startGameNow above to include music


/***********************************************
 *  Original Hammurabi Game Logic (Adapted)    *
 ***********************************************/

// Initial game state (will be reset by startGameNow)
let gameState = {};

// DOM elements (ensure these IDs exist in the HTML)
const yearEl = document.getElementById('year');
const foodEl = document.getElementById('food');
const landEl = document.getElementById('land');
const pawnsEl = document.getElementById('pawns');
const landPriceEl = document.getElementById('landPrice');
const messageEl = document.getElementById('message');
const nextTurnBtn = document.getElementById('nextTurn');

// --- Input Fields --- (ensure IDs match HTML)
const buyLandInput = document.getElementById('buyLand');
const sellLandInput = document.getElementById('sellLand');
const plantInput = document.getElementById('plant');
const feedInput = document.getElementById('feed');


// Update UI with current game state
function updateUI() {
    if (!gameStarted) return; // Don't update if game hasn't started

    // Check if elements exist before updating
    if (yearEl) yearEl.textContent = gameState.year;
    if (foodEl) foodEl.textContent = Math.floor(gameState.food); // Ensure food is integer
    if (landEl) landEl.textContent = gameState.land;
    if (pawnsEl) pawnsEl.textContent = gameState.pawns;
    if (landPriceEl) landPriceEl.textContent = gameState.landPrice;
}

// Process a turn
function processTurn() {
    if (!gameStarted || gameEnded || !nextTurnBtn) return; // Don't process if not started or already ended

    // --- Get decisions ---
    // Use parseInt with fallback to 0 for invalid/empty input
    const buyLand = parseInt(buyLandInput?.value ?? 0) || 0;
    const sellLand = parseInt(sellLandInput?.value ?? 0) || 0;
    const plant = parseInt(plantInput?.value ?? 0) || 0;
    const feed = parseInt(feedInput?.value ?? 0) || 0; // Food units *per pawn*

    // --- Clear previous message ---
    if (messageEl) messageEl.textContent = "";
    let turnMessages = []; // Array to hold messages for the turn

    // --- Input Validation ---
    if (buyLand < 0 || sellLand < 0 || plant < 0 || feed < 0) {
         if(messageEl) messageEl.textContent = "Please enter non-negative values.";
         return;
    }
    if (buyLand > 0 && sellLand > 0) {
        if(messageEl) messageEl.textContent = "You cannot buy and sell land in the same year!";
        return;
    }
    if (buyLand * gameState.landPrice > gameState.food) {
        if(messageEl) messageEl.textContent = `Not enough food to buy ${buyLand} acres! You only have ${Math.floor(gameState.food)} bushels.`;
        return;
    }
    if (sellLand > gameState.land) {
        if(messageEl) messageEl.textContent = `You don't have ${sellLand} acres to sell! You only own ${gameState.land} acres.`;
        return;
    }
    // Planting validation: Need enough food (1 bushel/acre), enough land, enough pawns (1 pawn/10 acres)
    if (plant > gameState.food) {
        if(messageEl) messageEl.textContent = `Not enough food to plant ${plant} acres! You need ${plant} bushels, but only have ${Math.floor(gameState.food)}.`;
        return;
    }
     if (plant > gameState.land) {
        if(messageEl) messageEl.textContent = `You don't have enough land to plant ${plant} acres! You only own ${gameState.land} acres.`;
        return;
    }
    if (plant > gameState.pawns * 10) {
        if(messageEl) messageEl.textContent = `Not enough pawns to plant ${plant} acres! You need ${Math.ceil(plant / 10)} pawns, but only have ${gameState.pawns}.`;
        return;
    }
    // Feeding validation: Need enough food in total
    const totalFoodNeededForFeeding = feed * gameState.pawns;
    // Check against food *remaining* after buying land and planting
    const foodAfterLandAndPlanting = gameState.food - (buyLand * gameState.landPrice) - plant;
    if (totalFoodNeededForFeeding > foodAfterLandAndPlanting) {
        if(messageEl) messageEl.textContent = `Not enough food to feed your pawns ${feed} bushels each! You need ${totalFoodNeededForFeeding} bushels, but only have ${Math.floor(foodAfterLandAndPlanting)} left after other costs.`;
        return;
    }
    // --- End Validation ---


    // --- Process Actions (apply costs first) ---
    // 1. Land Transactions
    let landChange = 0;
    if (buyLand > 0) {
        gameState.food -= buyLand * gameState.landPrice;
        gameState.land += buyLand;
        landChange = buyLand;
        turnMessages.push(`Bought ${buyLand} acres.`);
    } else if (sellLand > 0) {
        gameState.food += sellLand * gameState.landPrice;
        gameState.land -= sellLand;
        landChange = -sellLand;
         turnMessages.push(`Sold ${sellLand} acres.`);
    }

    // 2. Planting Cost
    gameState.food -= plant;
    if (plant > 0) turnMessages.push(`Used ${plant} bushels for planting.`); // Only message if planting occurred

    // 3. Feeding Cost
    gameState.food -= totalFoodNeededForFeeding;
    if (totalFoodNeededForFeeding > 0) turnMessages.push(`Used ${totalFoodNeededForFeeding} bushels to feed ${gameState.pawns} pawns.`);

    // --- Calculate Outcomes ---
    // 1. Harvest (yield between 2 and 6 bushels per acre planted)
    const yieldPerAcre = Math.floor(Math.random() * 5) + 2; // 2, 3, 4, 5, 6
    const foodHarvested = plant * yieldPerAcre;
    gameState.food += foodHarvested;
    if (plant > 0) turnMessages.push(`Harvested ${foodHarvested} bushels (${yieldPerAcre}/acre).`); // Only message if planting occurred


    // 2. Pawn changes based on feeding level (only if pawns exist)
    let pawnsGained = 0;
    let pawnsLost = 0;
    if (gameState.pawns > 0) {
        if (feed >= 2) { // Well-fed encourages growth
            pawnsGained = Math.floor(Math.random() * (gameState.pawns * 0.1) + 1); // Gain up to 10% + 1
            pawnsGained = Math.min(pawnsGained, 50); // Cap max gain per year
            gameState.pawns += pawnsGained;
            turnMessages.push(`Well fed! ${pawnsGained} new pawns arrived.`);
        } else if (feed < 1) { // Poor feeding causes people to leave
            pawnsLost = Math.floor(Math.random() * (gameState.pawns * 0.15) + 1); // Lose up to 15% + 1
            pawnsLost = Math.min(pawnsLost, gameState.pawns); // Cannot lose more than you have
            gameState.pawns -= pawnsLost;
            turnMessages.push(`Poorly fed! ${pawnsLost} pawns left.`);
        } else {
            // Adequately fed - no message unless combined with others
        }
    }
     // Starvation check (as failsafe)
    if (totalFoodNeededForFeeding > foodAfterLandAndPlanting + foodHarvested && gameState.pawns > 0) {
         const foodShortage = totalFoodNeededForFeeding - (foodAfterLandAndPlanting + foodHarvested);
         const pawnsStarved = Math.min(gameState.pawns, Math.ceil(foodShortage / (feed > 0 ? feed : 1))); // Estimate starved, avoid division by zero
         gameState.pawns -= pawnsStarved;
         turnMessages.push(`STARVATION! ${pawnsStarved} pawns died from lack of food.`);
         gameState.food = 0; // Food depleted
    }


    // 3. Random Events
    const eventChance = Math.random();
    if (eventChance < 0.15 && gameState.food > 0) { // Rats (15% chance) - only if there's food
        const foodLost = Math.floor(gameState.food * (Math.random() * 0.2 + 0.1)); // Lose 10-30%
        gameState.food -= foodLost;
        turnMessages.push(`Disaster! Rats ate ${foodLost} bushels.`);
    } else if (eventChance >= 0.15 && eventChance < 0.30 && foodHarvested > 0) { // Good Harvest Bonus (15% chance) - only if harvest occurred
        const foodGained = Math.floor(foodHarvested * (Math.random() * 0.2 + 0.1)); // Gain 10-30% bonus on harvest
        gameState.food += foodGained;
        turnMessages.push(`Good fortune! Excellent weather yielded an extra ${foodGained} bushels.`);
    } else if (eventChance >= 0.30 && eventChance < 0.40 && gameState.pawns > 0) { // Plague (10% chance) - only if pawns exist
        const plagueVictims = Math.max(1, Math.floor(gameState.pawns * (Math.random() * 0.3 + 0.1))); // Lose 10-40%, at least 1
        plagueVictims = Math.min(plagueVictims, gameState.pawns); // Cannot lose more than exist
        gameState.pawns -= plagueVictims;
        turnMessages.push(`Disaster! A plague killed ${plagueVictims} pawns.`);
    }


    // --- Check Game Over Conditions ---
    if (gameState.pawns <= 0) {
        gameState.pawns = 0; // Ensure it's exactly 0
        turnMessages.push("All your pawns have perished! Your rule ends in ruin.");
        if(messageEl) messageEl.innerHTML = turnMessages.join("<br>"); // Show final messages
        if(nextTurnBtn) nextTurnBtn.disabled = true;
        addGlobalRecord(playerName, gameState.year, 0); // Record final score (0 pawns)
        updateUI(); // Final UI update
        return; // Stop further processing
    }

    // --- Prepare for Next Turn ---
    // Increment year
    gameState.year++;

    // Adjust land price (fluctuates between 18 and 28)
    gameState.landPrice = Math.floor(Math.random() * 11) + 18;

    // --- Check Win/End Condition ---
    if (gameState.year > 100) {
        turnMessages.push(`Year 100 is complete! You ended with ${gameState.pawns} pawns, ${Math.floor(gameState.food)} bushels, and ${gameState.land} acres.`);
        // Add a final rating
        let rating = "a decent ruler.";
        const acresPerPawn = gameState.land / gameState.pawns;
        if (acresPerPawn > 10 && gameState.pawns > 120) rating = "a wise and respected leader!";
        else if (acresPerPawn < 3 || gameState.pawns < 50) rating = "perhaps not cut out for leadership.";
        else if (acresPerPawn < 5 || gameState.pawns < 80) rating = "a struggling steward.";
        turnMessages.push(`History will remember you as ${rating}`);

        if(messageEl) messageEl.innerHTML = turnMessages.join("<br>");
        if(nextTurnBtn) nextTurnBtn.disabled = true;
        addGlobalRecord(playerName, 10, gameState.pawns); // Record final score at year 10
        updateUI(); // Final UI update
        return;
    }

    // --- Next Turn Preparation ---
    // Update UI for the *next* turn state
    updateUI();

     // Display messages for the completed turn
    if(messageEl) messageEl.innerHTML = turnMessages.join("<br>");

    // --- Reset inputs for next turn ---
    if(buyLandInput) buyLandInput.value = 0;
    if(sellLandInput) sellLandInput.value = 0;
    if(plantInput) plantInput.value = 0;
    if(feedInput) feedInput.value = 0;
}


// Event listener for next turn button
if(nextTurnBtn) nextTurnBtn.addEventListener('click', processTurn);

// Initial data load moved to DOMContentLoaded listener added earlier
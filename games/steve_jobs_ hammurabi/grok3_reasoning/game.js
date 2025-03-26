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
        landPrice: 24 // Or generate initial random price if desired
    };
    gameEnded = false; // Reset game end flag

    // Reset input fields
    document.getElementById('buyLand').value = 0;
    document.getElementById('sellLand').value = 0;
    document.getElementById('plant').value = 0;
    document.getElementById('feed').value = 0;

    // Reset outcome message
    messageEl.textContent = "The fate of your pawns is in your hands...";

    // Re-enable the button
    nextTurnBtn.disabled = false;

    // Update the UI with initial state
    updateUI();
}


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
}

// Event listeners for starting the game
document.getElementById("startGame").addEventListener("click", startGameNow);
document.getElementById("playerName").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        e.preventDefault(); // Prevent form submission if wrapped in form
        startGameNow();
    }
});


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

    yearEl.textContent = gameState.year;
    foodEl.textContent = Math.floor(gameState.food); // Ensure food is integer
    landEl.textContent = gameState.land;
    pawnsEl.textContent = gameState.pawns;
    landPriceEl.textContent = gameState.landPrice;
}

// Process a turn
function processTurn() {
    if (!gameStarted || gameEnded) return; // Don't process if not started or already ended

    // --- Get decisions ---
    // Use parseInt with fallback to 0 for invalid/empty input
    const buyLand = parseInt(buyLandInput.value) || 0;
    const sellLand = parseInt(sellLandInput.value) || 0;
    const plant = parseInt(plantInput.value) || 0;
    const feed = parseInt(feedInput.value) || 0; // Food units *per pawn*

    // --- Clear previous message ---
    messageEl.textContent = "";
    let turnMessages = []; // Array to hold messages for the turn

    // --- Input Validation ---
    if (buyLand < 0 || sellLand < 0 || plant < 0 || feed < 0) {
         messageEl.textContent = "Please enter non-negative values.";
         return;
    }
    if (buyLand > 0 && sellLand > 0) {
        messageEl.textContent = "You cannot buy and sell land in the same year!";
        return;
    }
    if (buyLand * gameState.landPrice > gameState.food) {
        messageEl.textContent = `Not enough food to buy ${buyLand} acres! You only have ${Math.floor(gameState.food)} bushels.`;
        return;
    }
    if (sellLand > gameState.land) {
        messageEl.textContent = `You don't have ${sellLand} acres to sell! You only own ${gameState.land} acres.`;
        return;
    }
    // Planting validation: Need enough food (1 bushel/acre), enough land, enough pawns (1 pawn/10 acres)
    if (plant > gameState.food) {
        messageEl.textContent = `Not enough food to plant ${plant} acres! You need ${plant} bushels, but only have ${Math.floor(gameState.food)}.`;
        return;
    }
     if (plant > gameState.land) {
        messageEl.textContent = `You don't have enough land to plant ${plant} acres! You only own ${gameState.land} acres.`;
        return;
    }
    if (plant > gameState.pawns * 10) {
        messageEl.textContent = `Not enough pawns to plant ${plant} acres! You need ${Math.ceil(plant / 10)} pawns, but only have ${gameState.pawns}.`;
        return;
    }
    // Feeding validation: Need enough food in total
    const totalFoodNeededForFeeding = feed * gameState.pawns;
    // Check against food *remaining* after buying land and planting
    const foodAfterLandAndPlanting = gameState.food - (buyLand * gameState.landPrice) - plant;
    if (totalFoodNeededForFeeding > foodAfterLandAndPlanting) {
        messageEl.textContent = `Not enough food to feed your pawns ${feed} bushels each! You need ${totalFoodNeededForFeeding} bushels, but only have ${Math.floor(foodAfterLandAndPlanting)} left after other costs.`;
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
    turnMessages.push(`Used ${plant} bushels for planting.`);

    // 3. Feeding Cost
    gameState.food -= totalFoodNeededForFeeding;
    turnMessages.push(`Used ${totalFoodNeededForFeeding} bushels to feed ${gameState.pawns} pawns.`);

    // --- Calculate Outcomes ---
    // 1. Harvest (yield between 2 and 6 bushels per acre planted)
    const yieldPerAcre = Math.floor(Math.random() * 5) + 2; // 2, 3, 4, 5, 6
    const foodHarvested = plant * yieldPerAcre;
    gameState.food += foodHarvested;
    turnMessages.push(`Harvested ${foodHarvested} bushels (${yieldPerAcre}/acre).`);

    // 2. Pawn changes based on feeding level
    let pawnsGained = 0;
    let pawnsLost = 0;
    if (feed >= 2) { // Well-fed encourages growth (more random chance)
        pawnsGained = Math.floor(Math.random() * (gameState.pawns * 0.1) + 1); // Gain up to 10% + 1
        pawnsGained = Math.min(pawnsGained, 50); // Cap max gain per year
        gameState.pawns += pawnsGained;
        turnMessages.push(`Well fed! ${pawnsGained} new pawns arrived.`);
    } else if (feed < 1) { // Poor feeding causes people to leave (more random chance)
        pawnsLost = Math.floor(Math.random() * (gameState.pawns * 0.15) + 1); // Lose up to 15% + 1
        pawnsLost = Math.min(pawnsLost, gameState.pawns); // Cannot lose more than you have
        gameState.pawns -= pawnsLost;
        turnMessages.push(`Poorly fed! ${pawnsLost} pawns left.`);
    }
    // Starvation check (should not happen with validation, but as failsafe)
    if (totalFoodNeededForFeeding > foodAfterLandAndPlanting + foodHarvested) {
         // This case should ideally be caught by validation
         const foodShortage = totalFoodNeededForFeeding - (foodAfterLandAndPlanting + foodHarvested);
         const pawnsStarved = Math.min(gameState.pawns, Math.ceil(foodShortage / feed)); // Estimate starved
         gameState.pawns -= pawnsStarved;
         turnMessages.push(`WARNING: Starvation occurred! ${pawnsStarved} pawns died.`);
         gameState.food = 0; // Food depleted
    }


    // 3. Random Events
    const eventChance = Math.random();
    if (eventChance < 0.15) { // Rats (15% chance) - lose some food
        const foodLost = Math.floor(gameState.food * (Math.random() * 0.2 + 0.1)); // Lose 10-30%
        gameState.food -= foodLost;
        turnMessages.push(`Disaster! Rats ate ${foodLost} bushels.`);
    } else if (eventChance < 0.3) { // Good Harvest Bonus (15% chance) - gain some food
        const foodGained = Math.floor(foodHarvested * (Math.random() * 0.2 + 0.1)); // Gain 10-30% bonus on harvest
        gameState.food += foodGained;
        turnMessages.push(`Good fortune! Excellent weather yielded an extra ${foodGained} bushels.`);
    } else if (eventChance < 0.4) { // Plague (10% chance) - lose pawns
        const plagueVictims = Math.floor(gameState.pawns * (Math.random() * 0.3 + 0.1)); // Lose 10-40%
        gameState.pawns -= plagueVictims;
        turnMessages.push(`Disaster! A plague killed ${plagueVictims} pawns.`);
    }


    // --- Check Game Over Conditions ---
    if (gameState.pawns <= 0) {
        turnMessages.push("All your pawns have perished! Your rule ends in ruin.");
        messageEl.innerHTML = turnMessages.join("<br>"); // Show final messages
        nextTurnBtn.disabled = true;
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
    if (gameState.year > 10) {
        turnMessages.push(`Year 10 is complete! You ended with ${gameState.pawns} pawns, ${Math.floor(gameState.food)} bushels, and ${gameState.land} acres.`);
        // Add a final rating? (Optional)
        let rating = "a decent ruler.";
        const acresPerPawn = gameState.pawns > 0 ? gameState.land / gameState.pawns : 0;
        if (acresPerPawn > 10 && gameState.pawns > 120) rating = "a wise and respected leader!";
        else if (acresPerPawn < 3 || gameState.pawns < 50) rating = "a struggling steward.";
        turnMessages.push(`History will remember you as ${rating}`);

        messageEl.innerHTML = turnMessages.join("<br>");
        nextTurnBtn.disabled = true;
        addGlobalRecord(playerName, 10, gameState.pawns); // Record final score at year 10
        updateUI(); // Final UI update
        return;
    }

    // Update UI for the *next* turn state
    updateUI();

     // Display messages for the completed turn
    messageEl.innerHTML = turnMessages.join("<br>");

    // --- Reset inputs for next turn ---
    buyLandInput.value = 0;
    sellLandInput.value = 0;
    plantInput.value = 0;
    feedInput.value = 0; // Reset feed input, player needs to decide each year
}


// Event listener for next turn button
nextTurnBtn.addEventListener('click', processTurn);

// Initial data load on page ready
document.addEventListener('DOMContentLoaded', () => {
    updateGlobalLeaderboard();
    displayGlobalGamesPlayed();
});
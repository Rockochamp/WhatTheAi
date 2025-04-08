document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const mainScreen = document.getElementById('main-screen');
    const chainView = document.getElementById('chain-view');
    const rankRecentBtn = document.getElementById('rank-recent-btn'); // Added
    const rankLoveBtn = document.getElementById('rank-love-btn');
    const rankHateBtn = document.getElementById('rank-hate-btn');
    const rankedListContainer = document.getElementById('ranked-list-container');
    const globalCommentTextarea = document.getElementById('global-comment-textarea');
    const submitGlobalCommentBtn = document.getElementById('submit-global-comment-btn');
    const backToMainBtn = document.getElementById('back-to-main-btn');
    const commentThreadContainer = document.getElementById('comment-thread-container'); // New container
    const audioElement = document.getElementById('background-music'); // Added for music
    const muteToggle = document.getElementById('muteToggle'); // Added for music

    // --- Firestore Reference (Initialized in HTML) ---
    // const db = firebase.firestore(); // Already available from HTML script tag
    const commentsCollection = db.collection('comments_yesisaidit'); // Use a specific collection name

    // --- State ---
    let currentRankMode = 'recent'; // Default to 'recent'
    let currentFocusedCommentId = null;
    let unsubscribeFocused = null; // Listener for focused comment
    let unsubscribeChildren = null; // Listener for children (re-added for real-time)
    let unsubscribeRankedList = null; // Firestore listener for ranked list

    // --- Local Storage Vote Management ---
    const VOTE_STORAGE_KEY = 'yesisaidit_votes';

    function getVotes() {
        try {
            const storedVotes = localStorage.getItem(VOTE_STORAGE_KEY);
            return storedVotes ? JSON.parse(storedVotes) : {};
        } catch (e) {
            console.error("Error reading votes from local storage:", e);
            return {};
        }
    }

    function getVoteForComment(commentId) {
        return getVotes()[commentId] || null; // Return null if no vote recorded
    }

    function setVoteForComment(commentId, voteType) { // voteType can be 'upvote', 'downvote', or null to clear
        const votes = getVotes();
        if (voteType) {
            votes[commentId] = voteType;
        } else {
            delete votes[commentId]; // Remove the key if vote is cleared
        }
        try {
            localStorage.setItem(VOTE_STORAGE_KEY, JSON.stringify(votes));
        } catch (e) {
            console.error("Error saving votes to local storage:", e);
        }
    }


    // --- Firestore Functions ---

    // Add a new comment
    async function addComment(text, parentId = null) {
        if (!text.trim()) return; // Don't add empty comments
        try {
            await commentsCollection.add({
                text: text.trim(),
                parentId: parentId,
                upvotes: 0,
                downvotes: 0,
                score: 0,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
            console.log('Comment added successfully');
            // Clear text area if it was the global one
            if (!parentId) {
                globalCommentTextarea.value = '';
            }
        } catch (error) {
            console.error("Error adding comment: ", error);
            alert("Failed to add comment.");
        }
    }

    // Update vote counts and score atomically, considering local storage state
    async function updateVote(commentId, newVoteType) { // newVoteType is 'upvote' or 'downvote'
        const commentRef = commentsCollection.doc(commentId);
        const currentVote = getVoteForComment(commentId);
        let finalVoteState = newVoteType; // Assume the new vote will stick initially

        try {
            const updatedData = await db.runTransaction(async (transaction) => {
                const doc = await transaction.get(commentRef);
                if (!doc.exists) {
                    throw "Document does not exist!";
                }

                let currentUpvotes = doc.data().upvotes;
                let currentDownvotes = doc.data().downvotes;
                let upvoteChange = 0;
                let downvoteChange = 0;

                if (currentVote === newVoteType) {
                    // --- Case 1: Cancelling the vote ---
                    if (newVoteType === 'upvote') {
                        upvoteChange = -1;
                    } else { // newVoteType === 'downvote'
                        downvoteChange = -1;
                    }
                    finalVoteState = null; // Clear the vote
                } else if (currentVote) {
                    // --- Case 2: Switching the vote ---
                    if (newVoteType === 'upvote') { // Switching from downvote to upvote
                        upvoteChange = 1;
                        downvoteChange = -1;
                    } else { // Switching from upvote to downvote
                        upvoteChange = -1;
                        downvoteChange = 1;
                    }
                    // finalVoteState remains newVoteType
                } else {
                    // --- Case 3: Casting a new vote ---
                    if (newVoteType === 'upvote') {
                        upvoteChange = 1;
                    } else { // newVoteType === 'downvote'
                        downvoteChange = 1;
                    }
                    // finalVoteState remains newVoteType
                }

                // Ensure votes don't go below zero (shouldn't happen with proper logic, but safe)
                const newUpvotes = Math.max(0, currentUpvotes + upvoteChange);
                const newDownvotes = Math.max(0, currentDownvotes + downvoteChange);
                const newScore = newUpvotes - newDownvotes;

                transaction.update(commentRef, {
                    upvotes: newUpvotes,
                    downvotes: newDownvotes,
                    score: newScore
                });

                // Return the updated data for UI update
                return { id: doc.id, ...doc.data(), upvotes: newUpvotes, downvotes: newDownvotes, score: newScore };
            });

            if (!updatedData) {
                 console.error("Transaction completed but returned no data.");
                 return;
            }

            // Update local storage AFTER the transaction succeeds
            setVoteForComment(commentId, finalVoteState);
            console.log(`Vote updated successfully. New state for ${commentId}: ${finalVoteState}`);

            // --- START: Instant UI Update (Scores & Button States) ---
            updateCommentUIAfterVote(commentId, updatedData, finalVoteState);
            // --- END: Instant UI Update ---

            // --- START: Force refresh of the chain view to ensure consistency ---
            // Check if we are currently in the chain view before refreshing
            // This ensures the UI accurately reflects the vote, even for ancestors,
            // by re-rendering the entire thread with the latest data.
            if (currentFocusedCommentId) {
                console.log(`[Vote Success] Triggering fetchCommentChain for ${currentFocusedCommentId} after vote on ${commentId}`);
                fetchCommentChain(currentFocusedCommentId); // Re-fetch the whole chain
            }
            // --- END: Force refresh ---

        } catch (error) {
            console.error("Vote transaction failed: ", error);
            alert("Failed to update vote.");
        }
    }

    // NEW: Helper to count branching points (1:n relations) recursively
    async function countBranchingPoints(commentId) {
        let branchingPointsCount = 0;
        const childrenSnapshot = await commentsCollection.where('parentId', '==', commentId).get();

        if (childrenSnapshot.size > 0) {
            const branchingChecksPromises = childrenSnapshot.docs.map(async (childDoc) => {
                let pointsFromThisChild = 0;
                // Check if this child is itself a branching point (has children)
                const grandchildSnapshot = await commentsCollection.where('parentId', '==', childDoc.id).limit(1).get();
                if (!grandchildSnapshot.empty) {
                    pointsFromThisChild += 1; // Count this child as a branching point
                }
                // Recursively count branching points further down this child's tree
                pointsFromThisChild += await countBranchingPoints(childDoc.id);
                return pointsFromThisChild;
            });
            const results = await Promise.all(branchingChecksPromises);
            branchingPointsCount = results.reduce((sum, points) => sum + points, 0); // Sum points from all children sub-trees
        }
        return branchingPointsCount;
    }


    // Fetch comments for the ranked list (Modified for real-time & 'recent' filter)
    function fetchRankedComments(mode) { // No longer needs async here, listener handles it
        // Unsubscribe from previous listener if exists
        if (unsubscribeRankedList) {
            unsubscribeRankedList();
            unsubscribeRankedList = null;
            console.log("Unsubscribed from previous ranked list listener.");
        }

        rankedListContainer.innerHTML = '<p>Loading comments...</p>'; // Show loading state

        let query;
        if (mode === 'recent') {
            query = commentsCollection.orderBy('timestamp', 'desc').limit(20); // Order by timestamp for recent
        } else {
            const sortDirection = mode === 'love' ? 'desc' : 'asc';
            query = commentsCollection.orderBy('score', sortDirection).limit(20); // Order by score for love/hate
        }

        console.log(`Setting up ranked list listener for mode: ${mode}`);
        unsubscribeRankedList = query.onSnapshot(async (snapshot) => { // Use onSnapshot
            console.log(`Ranked list snapshot received (${snapshot.docs.length} docs)`);
            if (snapshot.empty) {
                rankedListContainer.innerHTML = '<p>No comments yet. Be the first!</p>';
                return;
            }

            // Process comments asynchronously within the snapshot handler
            const commentsPromises = snapshot.docs.map(async (doc) => {
                const commentData = { id: doc.id, ...doc.data() };

                // --- Calculate Metadata (asynchronously) ---
                // 1. Chain Length (Depth starting from 1)
                const ancestors = await fetchAncestors(commentData.parentId);
                commentData.chainLength = ancestors.length + 1; // +1 to count self

                // 2. Replies (Direct Children Count)
                const childrenSnapshot = await commentsCollection.where('parentId', '==', doc.id).get();
                commentData.replies = childrenSnapshot.size;

                // 3. Dimensions (Count of branching points in the descendant tree)
                commentData.dimensions = await countBranchingPoints(doc.id); // Use new recursive branching function

                return commentData;
            });

            try {
                const commentsWithData = await Promise.all(commentsPromises);
                renderRankedList(commentsWithData); // Render the updated list
            } catch (error) {
                 console.error("Error processing ranked comments snapshot data: ", error);
                 // Avoid overwriting the list if processing fails, maybe show subtle error?
            }

        }, (error) => { // Handle listener errors
            console.error("Error fetching ranked comments snapshot: ", error);
            rankedListContainer.innerHTML = '<p>Error loading comments.</p>';
            if (unsubscribeRankedList) { // Attempt to clean up on error
                 unsubscribeRankedList();
                 unsubscribeRankedList = null;
            }
        });
    }

    // Helper to fetch all ancestors recursively
    async function fetchAncestors(commentId, ancestors = []) {
        if (!commentId) return ancestors; // Base case: no parentId

        try {
            const doc = await commentsCollection.doc(commentId).get();
            if (doc.exists) {
                const data = { id: doc.id, ...doc.data() };
                ancestors.unshift(data); // Add parent to the beginning of the array
                return await fetchAncestors(data.parentId, ancestors); // Recurse
            } else {
                console.warn("Ancestor not found:", commentId);
                return ancestors; // Stop if an ancestor is missing
            }
        } catch (error) {
            console.error("Error fetching ancestor:", commentId, error);
            return ancestors; // Stop on error
        }
    }


    // Fetch data for the chain view (Modified for real-time updates)
    function fetchCommentChain(commentId) {
        // Clear previous listeners FIRST
        if (unsubscribeFocused) unsubscribeFocused();
        if (unsubscribeChildren) unsubscribeChildren();
        unsubscribeFocused = null;
        unsubscribeChildren = null;

        clearChainView(); // Clear UI
        commentThreadContainer.innerHTML = '<p>Loading thread...</p>'; // Loading state

        let focusedCommentData = null;
        let ancestorsData = [];
        let childrenData = [];

        // Function to re-render the entire thread when data changes
        const updateAndRenderThread = async () => {
            if (!focusedCommentData) return; // Need focused comment at least

            // Combine current data
            let threadComments = [...ancestorsData, focusedCommentData, ...childrenData];

             // Calculate full metadata for EACH comment in the thread
            const threadCommentsWithMetadataPromises = threadComments.map(async (comment) => {
                // Avoid modifying original data from listeners directly, create copy
                const commentWithMeta = { ...comment };

                // Calculate Chain Length
                // Optimization: Use known ancestors length for focused/children if possible
                if (comment.id === focusedCommentData.id) {
                    commentWithMeta.chainLength = ancestorsData.length + 1;
                } else {
                    // Check if it's a known child
                    const childIndex = childrenData.findIndex(c => c.id === comment.id);
                    if (childIndex > -1) {
                         commentWithMeta.chainLength = ancestorsData.length + 2; // Parent (focused) + ancestors
                    } else {
                         // Must be an ancestor, recalculate (or pass depth if fetched that way)
                         const commentAncestors = await fetchAncestors(comment.parentId);
                         commentWithMeta.chainLength = commentAncestors.length + 1;
                    }
                }


                // Calculate Replies (Requires async query)
                const commentChildrenSnapshot = await commentsCollection.where('parentId', '==', comment.id).get();
                commentWithMeta.replies = commentChildrenSnapshot.size;

                // Calculate Dimensions (Requires async query)
                commentWithMeta.dimensions = await countBranchingPoints(comment.id); // Use new recursive branching function

                return commentWithMeta; // Return comment with added metadata
            });

             try {
                const threadCommentsWithMetadata = await Promise.all(threadCommentsWithMetadataPromises);
                renderCommentThread(threadCommentsWithMetadata, commentId); // Render using data with metadata
             } catch(error) {
                 console.error("Error calculating metadata during thread update:", error);
                 // Potentially render with partial data or show error
                 commentThreadContainer.innerHTML = '<p>Error updating thread metadata.</p>';
             }
        };

        // 1. Listen to the focused comment
        unsubscribeFocused = commentsCollection.doc(commentId).onSnapshot(async (doc) => {
            if (!doc.exists) {
                console.error("Focused comment not found or deleted:", commentId);
                commentThreadContainer.innerHTML = '<p>Comment not found.</p>';
                // Clean up other listeners if the focused comment disappears
                if (unsubscribeChildren) unsubscribeChildren();
                unsubscribeChildren = null;
                return;
            }
            focusedCommentData = { id: doc.id, ...doc.data() };
            console.log("Focused comment updated:", focusedCommentData.id);

            // Fetch ancestors whenever focused comment loads/updates (parentId might change - unlikely but possible)
            ancestorsData = await fetchAncestors(focusedCommentData.parentId);
            console.log(`Fetched ${ancestorsData.length} ancestors`);

            // Trigger re-render
            await updateAndRenderThread();

        }, (error) => {
            console.error("Error listening to focused comment:", error);
            commentThreadContainer.innerHTML = '<p>Error loading comment.</p>';
        });

        // 2. Listen to children comments
        const childrenQuery = commentsCollection.where('parentId', '==', commentId).orderBy('timestamp', 'desc');
        unsubscribeChildren = childrenQuery.onSnapshot(async (snapshot) => {
            childrenData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            console.log(`Children snapshot received: ${childrenData.length} children`);
            // Trigger re-render
            await updateAndRenderThread();
        }, (error) => {
            console.error("Error listening to children comments:", error);
            // Don't necessarily clear the whole view, maybe just show error for children section?
            // For simplicity now, we'll let updateAndRenderThread handle partial data.
        });
    }


    // --- UI Rendering Functions ---

    // Render the list of ranked comments (Passes new metadata)
    function renderRankedList(comments) {
        rankedListContainer.innerHTML = ''; // Clear previous list
        if (comments.length === 0) {
            rankedListContainer.innerHTML = '<p>No comments yet. Be the first!</p>';
            return;
        }
        comments.forEach(comment => {
            // Pass chainLength, replies, and dimensions; hide vote buttons
            const commentDiv = createCommentElement(comment, false, false, comment.chainLength, comment.replies, comment.dimensions);
            commentDiv.classList.add('comment-snippet');
            rankedListContainer.appendChild(commentDiv);
        });
    }

     // Creates a single comment element (Accepts replies and dimensions)
    function createCommentElement(commentData, isFocused, showVoteButtons = true, chainLength = null, replies = null, dimensions = null) { // Updated params
        const div = document.createElement('div');
        div.classList.add('comment-container');
        div.dataset.commentId = commentData.id;
        const userVote = getVoteForComment(commentData.id); // Get user's vote for this comment

        // Build meta string
        let metaHTML = `<span class="score-display">Score: <span class="score">${commentData.score}</span> (👍${commentData.upvotes} / 👎${commentData.downvotes})</span>`; // Added class to score span holder
        if (showVoteButtons) {
            // Add classes to buttons based on user's vote
            const upvoteClass = userVote === 'upvote' ? 'voted' : '';
            const downvoteClass = userVote === 'downvote' ? 'voted' : '';
            metaHTML += `
                <button class="vote-btn upvote ${upvoteClass}" data-action="upvote">👍</button>
                <button class="vote-btn downvote ${downvoteClass}" data-action="downvote">👎</button>
            `;
        }
        // Add chain length, replies, and dimensions if provided (for global list)
        if (chainLength !== null) {
             metaHTML += `<span class="chain-info">Chain Length: ${chainLength}</span>`;
        }
         if (replies !== null) {
             metaHTML += `<span class="chain-info">Replies: ${replies}</span>`;
        }
        if (dimensions !== null) {
             metaHTML += `<span class="chain-info">Dimensions: ${dimensions}</span>`; // Changed label and variable
        }
        metaHTML += `<span class="timestamp">${formatTimestamp(commentData.timestamp)}</span>`;


        if (isFocused) {
            div.classList.add('focused');
            // CORRECTED: Removed stray comment syntax, Restored Next Universe button
            div.innerHTML = `
                <p class="comment-text">${escapeHTML(commentData.text)}</p>
                <div class="comment-meta">
                    ${metaHTML}
                </div>
                <div class="reply-section">
                    <textarea class="reply-textarea" placeholder="Reply to this..."></textarea>
                    <button class="submit-reply-btn">Reply</button>
                </div>
                <button id="next-universe-btn" class="control-btn next-universe-btn" style="display: none; margin-top: 10px;">Next Universe</button>
            `;
        } else {
             // CORRECTED: Removed stray comment syntax
             div.innerHTML = `
                <p class="comment-text">${escapeHTML(commentData.text)}</p>
                <div class="comment-meta">
                     ${metaHTML}
                </div>
                 <!-- No reply section or next universe button for non-focused comments -->
            `;
        }
        return div;
    }

    // Creates a single comment element (Accepts replies and new universes) - THIS IS A DUPLICATE FUNCTION DEFINITION, REMOVING IT
    // REMOVED Next Universe Button logic
    /*
    function createCommentElement(commentData, isFocused, showVoteButtons = true, chainLength = null, replies = null, universes = null) {
        const div = document.createElement('div');
        div.classList.add('comment-container');
        if (isFocused) {
            div.classList.add('focused'); // Add focused class if needed
        }
        div.dataset.commentId = commentData.id;

        // Build meta string
        let metaHTML = `<span>Score: <span class="score">${commentData.score}</span> (👍${commentData.upvotes} / 👎${commentData.downvotes})</span>`;
        if (showVoteButtons) {
            metaHTML += `
                <button class="vote-btn upvote" data-action="upvote">👍</button>
                <button class="vote-btn downvote" data-action="downvote">👎</button>
            `;
        }
        // Add chain length, replies, and universes if provided
        // Use commentData properties directly if available (for thread view)
        const displayChainLength = chainLength ?? commentData.chainLength;
        const displayReplies = replies ?? commentData.replies;
        const displayDimensions = dimensions ?? commentData.dimensions; // Changed variable name

        if (displayChainLength !== null && displayChainLength !== undefined) {
             metaHTML += `<span class="chain-info">Chain Length: ${displayChainLength}</span>`;
        }
         if (displayReplies !== null && displayReplies !== undefined) {
             metaHTML += `<span class="chain-info">Replies: ${displayReplies}</span>`;
        }
        if (displayDimensions !== null && displayDimensions !== undefined) {
             metaHTML += `<span class="chain-info">Dimensions: ${displayDimensions}</span>`; // Changed label and variable
        }
        metaHTML += `<span class="timestamp">${formatTimestamp(commentData.timestamp)}</span>`;

        // Common structure
        div.innerHTML = `
            <p class="comment-text">${escapeHTML(commentData.text)}</p>
            <div class="comment-meta">
                ${metaHTML}
            </div>
        `;

        // Add reply section ONLY to the focused comment
        if (isFocused) {
            div.innerHTML += `
                <div class="reply-section">
                    <textarea class="reply-textarea" placeholder="Reply to this..."></textarea>
                    <button class="submit-reply-btn">Reply</button>
                </div>
            `;
            // Note: Next Universe button is removed
        }

        return div;
    }
    */ // End of removed duplicate function


    // NEW: Function to update a comment's UI after a vote change
    function updateCommentUIAfterVote(commentId, updatedData, finalVoteState) {
        const commentElement = document.querySelector(`.comment-container[data-comment-id="${commentId}"]`);
        if (!commentElement) return;

        // 1. Update Score Display
        const scoreDisplaySpan = commentElement.querySelector('.score-display'); // Use the new class
        if (scoreDisplaySpan) {
            scoreDisplaySpan.innerHTML = `Score: <span class="score">${updatedData.score}</span> (👍${updatedData.upvotes} / 👎${updatedData.downvotes})`;
        }

        // 2. Update Button States
        const upvoteBtn = commentElement.querySelector('.vote-btn.upvote');
        const downvoteBtn = commentElement.querySelector('.vote-btn.downvote');

        if (upvoteBtn) {
            upvoteBtn.classList.toggle('voted', finalVoteState === 'upvote');
        }
        if (downvoteBtn) {
            downvoteBtn.classList.toggle('voted', finalVoteState === 'downvote');
        }
    }


    // NEW: Render the entire comment thread into the single container
    function renderCommentThread(threadComments, focusedCommentId) {
        commentThreadContainer.innerHTML = ''; // Clear previous content or loading message

        if (threadComments.length === 0) {
            commentThreadContainer.innerHTML = '<p><i>Comment thread is empty.</i></p>'; // Should not happen if focused exists
            return;
        }

        let focusedElement = null; // Keep track of the focused element

        threadComments.forEach(commentDataWithMeta => { // Use data with metadata
            const isFocused = commentDataWithMeta.id === focusedCommentId;
            // Pass calculated metadata explicitly (or rely on properties added in fetchCommentChain)
            // Always show vote buttons in the thread view
            const commentDiv = createCommentElement(commentDataWithMeta, isFocused, true, commentDataWithMeta.chainLength, commentDataWithMeta.replies, commentDataWithMeta.dimensions); // Use dimensions
            commentThreadContainer.appendChild(commentDiv);
            if (isFocused) {
                focusedElement = commentDiv; // Store the focused element
            }
        });

        // Scroll the focused comment into view
        if (focusedElement) {
            // Use scrollIntoView with options for smoother scrolling if needed
            focusedElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
             // Fallback: scroll container to top if focused somehow not found
             commentThreadContainer.scrollTop = 0;
        }
    }


    // Clear the single chain view container
    function clearChainView() {
        commentThreadContainer.innerHTML = '';
        // No need to reset children state anymore
    }

    // --- View Switching ---
    function showMainScreen() {
        mainScreen.style.display = 'block';
        chainView.style.display = 'none';
        currentFocusedCommentId = null;

        // Unsubscribe from chain view listeners when going back
        if (unsubscribeFocused) unsubscribeFocused();
        if (unsubscribeChildren) unsubscribeChildren();
        unsubscribeFocused = null;
        unsubscribeChildren = null;
        console.log("Unsubscribed from focused/children listeners.");

        // Re-fetch/listen to ranked list
        fetchRankedComments(currentRankMode); // This will set up the ranked list listener
    }

    function showChainView(commentId) {
        // Ensure ranked list listener is stopped BEFORE starting chain listeners
        if (unsubscribeRankedList) {
            unsubscribeRankedList();
            unsubscribeRankedList = null;
            console.log("Unsubscribed from ranked list listener.");
        }

        mainScreen.style.display = 'none';
        chainView.style.display = 'block';
        currentFocusedCommentId = commentId; // Set the ID for context

        // Fetching and setting up listeners for the chain view
        fetchCommentChain(commentId); // This now sets up its own listeners
    }

    // --- Utility Functions ---
    function escapeHTML(str) {
        const div = document.createElement('div');
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
    }

     function formatTimestamp(timestamp) {
        if (!timestamp) return 'Just now';
        // Convert Firestore Timestamp to JavaScript Date object
        const date = timestamp.toDate();
        // Simple relative time or absolute date formatting
        const now = new Date();
        const diffSeconds = Math.round((now - date) / 1000);
        const diffMinutes = Math.round(diffSeconds / 60);
        const diffHours = Math.round(diffMinutes / 60);
        const diffDays = Math.round(diffHours / 24);

        if (diffSeconds < 60) return `${diffSeconds}s ago`;
        if (diffMinutes < 60) return `${diffMinutes}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString(); // Older than a week, show date
    }

    // REMOVED updateNextUniverseButtonVisibility function as it's no longer needed


    // --- Event Listeners ---

    // --- Helper Function for Rank Button UI ---
    function updateRankButtonUI() {
        rankRecentBtn.classList.toggle('active', currentRankMode === 'recent');
        rankLoveBtn.classList.toggle('active', currentRankMode === 'love');
        rankHateBtn.classList.toggle('active', currentRankMode === 'hate');
    }

    // --- Event Listeners ---

    // Rank Toggle Buttons
    rankRecentBtn.addEventListener('click', () => {
        if (currentRankMode !== 'recent') {
            currentRankMode = 'recent';
            updateRankButtonUI();
            fetchRankedComments(currentRankMode);
        }
    });

    rankLoveBtn.addEventListener('click', () => {
        if (currentRankMode !== 'love') {
            currentRankMode = 'love';
            updateRankButtonUI();
            fetchRankedComments(currentRankMode);
        }
    });

    rankHateBtn.addEventListener('click', () => {
        if (currentRankMode !== 'hate') {
            currentRankMode = 'hate';
            updateRankButtonUI();
            fetchRankedComments(currentRankMode);
        }
    });

    // Submit Global Comment Button
    submitGlobalCommentBtn.addEventListener('click', () => {
        addComment(globalCommentTextarea.value, null);
    });

    // Submit Global Comment with Enter Key
    globalCommentTextarea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { // Enter submits, Shift+Enter for newline
            e.preventDefault(); // Prevent default newline behavior
            addComment(globalCommentTextarea.value, null);
        }
    });


    // Navigate to Chain View (Event Delegation on ranked list)
    rankedListContainer.addEventListener('click', (e) => {
        const commentContainer = e.target.closest('.comment-container');
        if (commentContainer && commentContainer.dataset.commentId) {
             // Prevent triggering if a button inside the comment was clicked
            if (e.target.tagName === 'BUTTON') return;
            showChainView(commentContainer.dataset.commentId);
        }
    });

    // Back to Main Screen Button
    backToMainBtn.addEventListener('click', showMainScreen);

    // Voting and Replying (Event Delegation on Chain View)
    chainView.addEventListener('click', (e) => {
        const target = e.target;
        const commentContainer = target.closest('.comment-container');
        if (!commentContainer) return; // Clicked outside a comment

        const commentId = commentContainer.dataset.commentId;

        // Handle Voting
        if (target.classList.contains('vote-btn')) {
            const action = target.dataset.action; // 'upvote' or 'downvote'
            if (commentId && action) {
                updateVote(commentId, action);
            }
        }

        // Handle Submit Reply
        if (target.classList.contains('submit-reply-btn')) {
            const replyTextarea = commentContainer.querySelector('.reply-textarea');
            // Reply is always submitted to the *currently focused* comment's ID
            // The reply section only exists on the focused comment now
            if (currentFocusedCommentId && replyTextarea && replyTextarea.value.trim()) {
                addComment(replyTextarea.value, currentFocusedCommentId); // Use currentFocusedCommentId as parentId
                replyTextarea.value = ''; // Clear textarea after submission
                // Optionally, re-fetch the chain to show the new comment immediately
                // fetchCommentChain(currentFocusedCommentId); // This might be too disruptive, consider adding locally first
            }
        }

        // Submit Reply with Enter Key (within the delegated listener)
        if (target.classList.contains('reply-textarea')) {
            // Add keydown listener only once if it doesn't exist
            if (!target.dataset.keydownListenerAttached) {
                target.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        // Reply is always submitted to the *currently focused* comment's ID
                        if (currentFocusedCommentId && target.value.trim()) {
                            addComment(target.value, currentFocusedCommentId); // Use currentFocusedCommentId as parentId
                            target.value = ''; // Clear textarea
                            // Optionally re-fetch chain here too
                        }
                    }
                });
                target.dataset.keydownListenerAttached = 'true'; // Mark listener as attached
            }
        }


         // Handle clicking on ANY comment in the thread to focus it
        if (commentId && commentId !== currentFocusedCommentId) { // Check if it's not already focused
             // Prevent triggering if a button or textarea inside the comment was clicked
            if (target.tagName === 'BUTTON' || target.tagName === 'TEXTAREA' || target.classList.contains('vote-btn')) return;
            // Clicking any non-focused comment in the thread re-centers the view on it
            showChainView(commentId);
        }

        // REMOVED Next Universe Button Click handler
    });


    // --- Initial Load ---
    showMainScreen(); // Show main screen by default


    // --- Dark Mode Toggle (Pico.css compatible) ---
    const darkModeToggle = document.getElementById('darkModeToggle');
    const htmlElement = document.documentElement; // Target the <html> element for Pico

    // Function to apply dark mode based on localStorage and Pico's data-theme attribute
    function applyDarkModePreference() {
        // Check localStorage first
        const storedPreference = localStorage.getItem('theme_yesisaidit'); // Use a theme key
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        let useDarkMode;

        if (storedPreference) {
            useDarkMode = storedPreference === 'dark';
        } else {
            // If no preference stored, use system preference
            useDarkMode = prefersDark;
            localStorage.setItem('theme_yesisaidit', useDarkMode ? 'dark' : 'light'); // Store initial theme
        }

        // Apply the theme attribute to the <html> element
        htmlElement.setAttribute('data-theme', useDarkMode ? 'dark' : 'light');

        // Update the toggle button icon
        const icon = darkModeToggle.querySelector('i');
        icon.className = useDarkMode ? 'fas fa-sun' : 'fas fa-moon';
    }

    // Add event listener for the toggle button
    darkModeToggle.addEventListener('click', () => {
        // Check the current theme
        const currentTheme = htmlElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

        // Update the attribute and localStorage
        htmlElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme_yesisaidit', newTheme); // Store the new theme

        // Update icon based on the new theme
        const icon = darkModeToggle.querySelector('i');
        icon.className = newTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    });

    // Apply dark mode on initial load
    applyDarkModePreference();

    // Optional: Listen for system theme changes if no preference is set
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
        // Only change if no explicit preference is stored
        if (!localStorage.getItem('theme_yesisaidit')) {
            const newTheme = e.matches ? 'dark' : 'light';
            htmlElement.setAttribute('data-theme', newTheme);
            // Update icon if needed (though toggle button might not be visible/relevant here)
            // const icon = darkModeToggle.querySelector('i');
            // icon.className = newTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
        }
    });


    // --- Music and Mute Toggle ---
    let audioPlayAttempted = false; // Flag to track initial play attempt
    let interactionListenerAdded = false; // Flag to prevent adding multiple listeners

    function attemptAudioPlay() {
        if (!audioElement || audioElement.muted || audioElement.currentTime > 0) {
             // Don't play if muted, already playing, or element missing
            return;
        }
        audioPlayAttempted = true; // Mark that we tried
        console.log("Attempting to play audio...");
        audioElement.play().then(() => {
            console.log("Audio playback started successfully.");
        }).catch(error => {
            console.log("Audio autoplay prevented initially:", error);
            // If autoplay fails, wait for first user interaction
            if (!interactionListenerAdded) {
                const playOnClick = () => {
                    console.log("User interaction detected, trying to play audio again.");
                    // Re-check if muted before playing
                    if (!audioElement.muted) {
                         audioElement.play().then(() => {
                            console.log("Audio playback started after interaction.");
                         }).catch(err => console.error("Audio play failed even after interaction:", err));
                    }
                    // Remove the listener after the first interaction
                    document.removeEventListener('click', playOnClick, { capture: true });
                    document.removeEventListener('keydown', playOnClick, { capture: true });
                    interactionListenerAdded = false; // Reset flag
                };
                document.addEventListener('click', playOnClick, { capture: true, once: true }); // Use capture and once
                document.addEventListener('keydown', playOnClick, { capture: true, once: true }); // Also listen for keydown
                interactionListenerAdded = true;
                console.log("Added one-time interaction listener for audio playback.");
            }
        });
    }


    function applyMutePreference() {
        const muted = localStorage.getItem('musicMuted_yesisaidit') === 'true';
        if (!audioElement) return; // Guard against missing element

        audioElement.muted = muted; // Set mute state regardless

        if (muted) {
            muteToggle.querySelector('i').className = 'fas fa-volume-mute';
            audioElement.pause(); // Ensure it's paused if muted on load
        } else {
            muteToggle.querySelector('i').className = 'fas fa-volume-up';
            // Attempt to play only if unmuted
            attemptAudioPlay();
        }
    }

    if (muteToggle && audioElement) { // Check both exist
        muteToggle.addEventListener('click', () => {
            const isMuted = !audioElement.muted;
            audioElement.muted = isMuted;
            localStorage.setItem('musicMuted_yesisaidit', isMuted);
            if (isMuted) {
                muteToggle.querySelector('i').className = 'fas fa-volume-mute';
                audioElement.pause(); // Explicitly pause when muting via button
            } else {
                muteToggle.querySelector('i').className = 'fas fa-volume-up';
                // Explicitly play when unmuting if the element exists
                if (audioElement) {
                    audioElement.play().catch(error => console.error("Error resuming playback:", error));
                }
            }
        });

        // Apply mute preference on load
        applyMutePreference();
         // Ensure loop is set
         audioElement.loop = true;
    } else {
        console.error("Audio element or mute toggle not found");
    }

});

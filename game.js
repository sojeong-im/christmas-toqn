import { db, doc, getDoc, setDoc, updateDoc, onSnapshot, increment } from './firebase-config.js';

// Game State
let userTeam = null;
let currentCoins = 0;
let maxTierScore = 0; // 50, 100, 200, 400, 800
const BOARD_SIZE = 4;
let boardState = Array(16).fill(null); // stores scores: null or 50, 100, etc.

// DOM Elements
const introScreen = document.getElementById('intro-screen');
const appContainer = document.getElementById('app-container');
const loginForm = document.getElementById('login-form');
const teamSelect = document.getElementById('team-select');

// Game DOM
const gameGrid = document.getElementById('game-grid');
const spawnBtn = document.getElementById('spawn-btn');
const coinDisplay = document.getElementById('coin-amount');
const maxTierDisplay = document.getElementById('max-tier');
const headerTeamName = document.getElementById('team-name');
const toast = document.getElementById('toast');
const levelupModal = document.getElementById('levelup-modal');
const levelupText = document.getElementById('levelup-text');
const levelupConfirm = document.getElementById('levelup-confirm');
const goMissionBtn = document.getElementById('go-mission-btn');

// Dragging State
let draggedPiece = null;
let dragStartIndex = -1;

// === Login & Init ===
loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    userTeam = teamSelect.value;
    if (!userTeam) return;

    // UI Transition
    localStorage.setItem('userTeam', userTeam);
    introScreen.style.display = 'none';
    appContainer.classList.remove('hidden');
    headerTeamName.innerText = `${userTeam}팀`;

    // Connect DB & Start Game
    connectToFirebase(userTeam);
    initGameBoard();
});

// Auto-login check
const savedTeam = localStorage.getItem('userTeam');
if (savedTeam) {
    teamSelect.value = savedTeam;
    // userTeam = savedTeam;
    // don't auto-click for now to let user choose again if they want
}

// === Firebase ===
function connectToFirebase(teamId) {
    const teamDocId = `team_${teamId.padStart(2, '0')}`;
    const teamRef = doc(db, "teams", teamDocId);

    onSnapshot(teamRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            currentCoins = data.coins || 0;
            // Load saved board if needed (Optional feature, skipping for simplicity now)
            updateUI();
        } else {
            setDoc(teamRef, { coins: 0 }); // Init
        }
    });
}

function updateCoins(amount) {
    // Optimistic update
    currentCoins += amount;
    updateUI();

    if (userTeam) {
        const teamDocId = `team_${userTeam.padStart(2, '0')}`;
        const teamRef = doc(db, "teams", teamDocId);
        updateDoc(teamRef, { coins: increment(amount) }).catch(console.error);
    }
}

// === Game Logic ===
function initGameBoard() {
    renderGrid();

    // Spawn initial pieces (3 pieces of 50)
    spawnPiece(50);
    spawnPiece(50);
    spawnPiece(50);
}

function renderGrid() {
    gameGrid.innerHTML = '';
    boardState.forEach((score, index) => {
        const slot = document.createElement('div');
        slot.className = 'grid-slot';
        slot.dataset.index = index;

        // Add Piece if exists
        if (score) {
            const piece = document.createElement('div');
            piece.className = `game-piece piece-${score}`;
            piece.draggable = true;
            piece.innerText = score;

            // Drag Events (Desktop)
            piece.addEventListener('dragstart', handleDragStart);
            piece.addEventListener('dragend', handleDragEnd);

            // Touch Events (Mobile)
            piece.addEventListener('touchstart', handleTouchStart, { passive: false });
            piece.addEventListener('touchmove', handleTouchMove, { passive: false });
            piece.addEventListener('touchend', handleTouchEnd);

            slot.appendChild(piece);
        }

        // Drop Zone Events
        slot.addEventListener('dragover', handleDragOver);
        slot.addEventListener('drop', handleDrop);

        gameGrid.appendChild(slot);
    });
}

function spawnPiece(value = 50) {
    const emptyIndices = boardState.map((val, idx) => val === null ? idx : null).filter(val => val !== null);

    if (emptyIndices.length === 0) {
        showToast("게임 오버? 빈 칸이 없어요! 합쳐보세요!");
        return;
    }

    const randomIndex = emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
    boardState[randomIndex] = value;

    // Animate spawn via simple re-render
    renderGrid();

    // Optional: Add 'pop' animation class to new element
    const newSlot = gameGrid.children[randomIndex];
    if (newSlot && newSlot.firstChild) {
        newSlot.firstChild.style.animation = 'popIn 0.3s';
    }
}

spawnBtn.addEventListener('click', () => {
    spawnPiece(50);
});

// === Drag & Merge Logic ===
function handleDragStart(e) {
    draggedPiece = e.target;
    dragStartIndex = parseInt(e.target.parentElement.dataset.index);
    e.target.classList.add('dragging');
}

function handleDragEnd(e) {
    e.target.classList.remove('dragging');
    draggedPiece = null;
    dragStartIndex = -1;
}

function handleDragOver(e) {
    e.preventDefault(); // Necessary for 'drop' to fire
}

function handleDrop(e) {
    e.preventDefault();
    const targetSlot = e.target.closest('.grid-slot');
    if (!targetSlot) return;

    const targetIndex = parseInt(targetSlot.dataset.index);

    if (dragStartIndex !== -1 && targetIndex !== dragStartIndex) {
        attemptMergeOrMove(dragStartIndex, targetIndex);
    }
}

// === Mobile Touch Logic ===
let touchStartX, touchStartY;
let touchElement = null;

function handleTouchStart(e) {
    e.preventDefault(); // Prevent scroll
    const touch = e.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;

    touchElement = e.target;
    dragStartIndex = parseInt(touchElement.parentElement.dataset.index);

    touchElement.classList.add('dragging');
    // Move element to follow finger visually (simple transform)
}

function handleTouchMove(e) {
    e.preventDefault();
    if (!touchElement) return;

    const touch = e.touches[0];
    const diffX = touch.clientX - touchStartX;
    const diffY = touch.clientY - touchStartY;

    touchElement.style.transform = `translate(${diffX}px, ${diffY}px) scale(1.1)`;
    touchElement.style.zIndex = 1000;
}

function handleTouchEnd(e) {
    if (!touchElement) return;

    touchElement.classList.remove('dragging');
    touchElement.style.transform = '';
    touchElement.style.zIndex = '';

    // Detect drop target manually based on coordinates
    const touch = e.changedTouches[0];
    const targetElement = document.elementFromPoint(touch.clientX, touch.clientY);
    const targetSlot = targetElement ? targetElement.closest('.grid-slot') : null;

    if (targetSlot) {
        const targetIndex = parseInt(targetSlot.dataset.index);
        if (dragStartIndex !== -1 && targetIndex !== dragStartIndex) {
            attemptMergeOrMove(dragStartIndex, targetIndex);
        }
    }

    touchElement = null;
    dragStartIndex = -1;
}


// === Core Merge Logic ===
function attemptMergeOrMove(fromIndex, toIndex) {
    const fromValue = boardState[fromIndex];
    const toValue = boardState[toIndex];

    if (toValue === null) {
        // Just Move
        boardState[toIndex] = fromValue;
        boardState[fromIndex] = null;
        renderGrid();
    } else if (toValue === fromValue) {
        // Merge!
        const newValue = fromValue * 2;

        // Max Tier check
        if (newValue > 800) {
            showToast("최고 레벨 도달! 새로운 트리가 생겼습니다 🎄");
            // Just stay at 800 or reset? Let's cap at 800
            // Or allow clearing it?
            // For now, cap at 800
            boardState[toIndex] = 800;
        } else {
            boardState[toIndex] = newValue;
        }

        boardState[fromIndex] = null;

        // Reward
        const reward = newValue / 10; // e.g. 100 -> 10 coins
        updateCoins(reward);
        showToast(`✨ 합체 성공! +${reward}코인`);

        // Check Max Score Record for UI
        if (newValue > maxTierScore) {
            maxTierScore = newValue;
            maxTierDisplay.innerText = getTierEmoji(maxTierScore) + " " + maxTierScore;
            // Modal celebration
            showLevelUpModal(newValue);
        }

        renderGrid();
    } else {
        // Swap or Bounce back?
        // Usually merge games swap if not mergeable, or do nothing.
        // Let's Swap for fun, or just do nothing. 
        // 2048 logic doesn't allow swap, but merge games usually allow 'organizing'
        // Let's allow SWAP
        boardState[toIndex] = fromValue;
        boardState[fromIndex] = toValue;
        renderGrid();
    }
}

function getTierEmoji(score) {
    if (score >= 800) return '🎄';
    if (score >= 400) return '🦌';
    if (score >= 200) return '🔔';
    if (score >= 100) return '❄️';
    return '🍭';
}

function showLevelUpModal(score) {
    levelupText.innerHTML = `대단해요! <strong>${score}점</strong> 아이템을 만드셨어요!<br>코인을 획득했습니다.`;
    levelupModal.classList.remove('hidden');
}

levelupConfirm.addEventListener('click', () => {
    levelupModal.classList.add('hidden');
});

function updateUI() {
    coinDisplay.innerText = currentCoins.toLocaleString();
}

// Toast
function showToast(msg) {
    toast.querySelector('.toast-content').innerText = msg;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 2000);
}

// Footer Nav
goMissionBtn.addEventListener('click', () => {
    window.location.href = 'mission.html';
});

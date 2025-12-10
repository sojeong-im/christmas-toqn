import { db, doc, getDoc, setDoc, updateDoc, onSnapshot, increment } from './firebase-config.js';

// === Global State ===
let userTeam = null;
let userZone = null;
let currentCoins = 0;
let userMissionStatus = {}; // { missionId: boolean } - Local check status
const BOARD_SIZE = 4;
let boardState = Array(16).fill(null);

// === Mission Data ===
const missionCategories = [
    {
        title: "✔ 10점 미션 (기본)",
        points: 10,
        items: [
            { id: "m10_1", text: "기도문 작성 1회" },
            { id: "m10_2", text: "말걸기 10회" },
            { id: "m10_3", text: "DM/메시지 10회 보내기" },
            { id: "m10_4", text: "거점 방문 1회" },
            { id: "m10_5", text: "지인 안부 연락 1회" },
            { id: "m10_6", text: "티엠 1회 (생티엠·소모임·노방 등)" },
            { id: "m10_7", text: "연말 감사 메시지 카드 1개" },
            { id: "m10_8", text: "팀원 칭찬 3회" },
            { id: "m10_9", text: "스탑 1회" },
            { id: "m10_10", text: "연말 버킷 3개 작성 및 공유" }
        ]
    },
    {
        title: "✔ 30점 미션 (도전)",
        points: 30,
        items: [
            { id: "m30_1", text: "신찾 1개" },
            { id: "m30_2", text: "섬김 모임 후 거점 재방문" },
            { id: "m30_3", text: "크리스마스 분위기 사진 3장" },
            { id: "m30_4", text: "팀원 1명에게 선물 전달" },
            { id: "m30_5", text: "잎사귀 1회" },
            { id: "m30_6", text: "연말 감사 편지 1통" }
        ]
    },
    {
        title: "✔️ 스페셜 미션",
        points: 50,
        items: [
            { id: "m50_1", text: "컨펌된 타찾 (50점)" }
        ]
    },
    {
        title: "🌟 보너스 미션 (30점)",
        points: 30,
        items: [
            { id: "mb_1", text: "빨간색 아이템 5개 찾기" },
            { id: "mb_2", text: "트리 모양 만들고 사진 찍기" },
            { id: "mb_3", text: "새부기 포즈로 팀 사진 찍기" },
            { id: "mb_4", text: "캐롤 제목 맞히기 퀴즈" }
        ]
    }
];

// === DOM Elements ===
const introScreen = document.getElementById('intro-screen');
const appContainer = document.getElementById('app-container');
const loginForm = document.getElementById('login-form');
const teamSelect = document.getElementById('team-select');
const zoneSelect = document.getElementById('zone-select');

// Header
const headerTeam = document.getElementById('header-team');
const headerZone = document.getElementById('header-zone');
const teamScoreEl = document.getElementById('team-score');

// Tabs
const tabBtns = document.querySelectorAll('.nav-btn');
const tabContents = document.querySelectorAll('.tab-content');
const missionListEl = document.getElementById('mission-list');

// Game
const spawnBtn = document.getElementById('spawn-btn');
const gameGrid = document.getElementById('game-grid');

// === 1. Init & Login ===
teamSelect.addEventListener('change', () => {
    const team = teamSelect.value;
    updateZoneOptions(team);
});

function updateZoneOptions(team) {
    zoneSelect.innerHTML = '<option value="" disabled selected>구역 선택</option>';
    zoneSelect.disabled = false;
    let maxZones = 5;
    if (team === '1') maxZones = 6;

    for (let i = 1; i <= maxZones; i++) {
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = `${i}구역`;
        zoneSelect.appendChild(opt);
    }
}

loginForm.addEventListener('submit', (evt) => {
    evt.preventDefault();
    userTeam = teamSelect.value;
    userZone = zoneSelect.value;

    if (!userTeam || !userZone) return;

    enterApp();
});

function enterApp() {
    introScreen.style.display = 'none';
    appContainer.classList.remove('hidden');

    headerTeam.innerText = `${userTeam}팀`;
    headerZone.innerText = `${userZone}구역`;

    renderMissionList();
    connectToFirebase(userTeam);
    initGameBoard(); // Initialize grid (empty)
}

// === 2. Firebase Connection ===
function connectToFirebase(teamId) {
    const docId = `team_${teamId.padStart(2, '0')}`;
    const docRef = doc(db, "teams", docId);

    onSnapshot(docRef, (snap) => {
        if (snap.exists()) {
            const data = snap.data();
            currentCoins = data.coins || 0;
            updateScoreUI();

            // Sync Mission Status (if global, but usually missions are local per user session)
            // But let's load 'completedMissions' if we want shared state.
            // For now, we keep missions local check, but score global.
            if (data.missions) {
                userMissionStatus = data.missions;
                updateMissionUI();
            }
        } else {
            setDoc(docRef, { coins: 0, missions: {} });
        }
    });
}

function updateScore(amount, missionId = null) {
    // Optimistic
    currentCoins += amount;
    updateScoreUI();

    const docId = `team_${userTeam.padStart(2, '0')}`;
    const docRef = doc(db, "teams", docId);

    const updates = {
        coins: increment(amount)
    };

    if (missionId) {
        // Mark mission as done
        updates[`missions.${missionId}`] = true;
    }

    updateDoc(docRef, updates).catch(console.error);
}

function updateScoreUI() {
    teamScoreEl.innerText = currentCoins.toLocaleString();

    // Enable/Disable Game Button
    if (currentCoins >= 50) {
        spawnBtn.disabled = false;
        spawnBtn.innerHTML = `<span class="icon">🎁</span><span class="text">선물 열기 (-50점)</span>`;
    } else {
        spawnBtn.disabled = true;
        spawnBtn.innerHTML = `<span class="icon">🔒</span><span class="text">50점 필요</span>`;
    }
}

// === 3. Mission Tab Logic ===
function renderMissionList() {
    missionListEl.innerHTML = '';

    missionCategories.forEach(cat => {
        const section = document.createElement('div');
        section.innerHTML = `<div class="section-title">${cat.title}</div>`;

        cat.items.forEach(item => {
            const count = (userMissionStatus[item.id] || 0);

            const el = document.createElement('div');
            el.className = 'mission-item';
            el.innerHTML = `
                <div class="mission-status">
                    <button class="mission-btn-repeat" data-id="${item.id}" data-text="${item.text}">완료하기</button>
                    <span class="mission-count-badge" id="count-${item.id}">${count}회</span>
                </div>
                <div class="mission-detail">
                    <div class="mission-text">${item.text}</div>
                    <span class="mission-points">+${cat.points}점</span>
                </div>
            `;

            // Event
            const btn = el.querySelector('.mission-btn-repeat');
            btn.addEventListener('click', () => {
                // Confirm dialog optional for repeated actions, but good for safety
                // Or make it smoother without confirm if user wants speed? 
                // Let's keep confirm to prevent accidental clicks
                const confirmDone = confirm(`"${item.text}" 미션을 1회 완료하셨나요?`);
                if (confirmDone) {
                    // Update Score & Count
                    updateScore(cat.points, item.id);
                    // Optimistic update UI
                    const badge = document.getElementById(`count-${item.id}`);
                    const current = parseInt(badge.innerText);
                    badge.innerText = `${current + 1}회`;
                    badge.classList.add('updated-flash');
                    setTimeout(() => badge.classList.remove('updated-flash'), 500);

                    showToast(`✅ 인증 완료! +${cat.points}점`);
                }
            });

            section.appendChild(el);
        });

        missionListEl.appendChild(section);
    });
}

function updateMissionUI() {
    // Check boxes based on loaded data
    Object.keys(userMissionStatus).forEach(mid => {
        const badge = document.getElementById(`count-${mid}`);
        if (badge) {
            badge.innerText = `${userMissionStatus[mid]}회`;
        }
    });
}

// === 4. Game Tab Logic (Merge) ===
spawnBtn.addEventListener('click', () => {
    if (currentCoins < 50) return;

    // Check space
    const emptyCount = boardState.filter(v => v === null).length;
    if (emptyCount === 0) {
        showToast("공간이 부족해요!");
        return;
    }

    updateScore(-50); // Deduct Cost
    spawnPiece(50);
});

function initGameBoard() {
    renderGrid();
}

function renderGrid() {
    gameGrid.innerHTML = '';
    boardState.forEach((val, idx) => {
        const slot = document.createElement('div');
        slot.className = 'grid-slot';
        slot.dataset.index = idx;

        if (val) {
            const piece = document.createElement('div');
            piece.className = `game-piece p-${val}`;
            piece.draggable = true;
            // piece.innerText = val; // Optional: Show number

            // Events
            addDragEvents(piece);

            slot.appendChild(piece);
        }

        // Drop
        slot.addEventListener('dragover', e => e.preventDefault());
        slot.addEventListener('drop', handleDrop);

        gameGrid.appendChild(slot);
    });
}

function spawnPiece(val) {
    const empties = boardState.map((v, i) => v === null ? i : null).filter(v => v !== null);
    if (empties.length === 0) return;

    const idx = empties[Math.floor(Math.random() * empties.length)];
    boardState[idx] = val;
    renderGrid();
}

// Drag & Drop
let dragSrcIndex = -1;

function addDragEvents(el) {
    el.addEventListener('dragstart', e => {
        dragSrcIndex = parseInt(e.target.parentElement.dataset.index);
        e.target.classList.add('dragging');
    });
    el.addEventListener('dragend', e => {
        e.target.classList.remove('dragging');
        dragSrcIndex = -1;
    });

    // Touch
    el.addEventListener('touchstart', handleTouchStart, { passive: false });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd);
}

function handleDrop(e) {
    e.preventDefault();
    const targetSlot = e.target.closest('.grid-slot');
    if (!targetSlot) return;

    const targetIdx = parseInt(targetSlot.dataset.index);
    if (dragSrcIndex !== -1 && dragSrcIndex !== targetIdx) {
        mergeOrMove(dragSrcIndex, targetIdx);
    }
}

// --- Mobile Touch Logic (Simplified) ---
let touchEl = null;
let touchStartX = 0, touchStartY = 0;

function handleTouchStart(e) {
    e.preventDefault();
    touchEl = e.target;
    const t = e.touches[0];
    touchStartX = t.clientX;
    touchStartY = t.clientY;

    dragSrcIndex = parseInt(touchEl.parentElement.dataset.index);
    touchEl.classList.add('dragging');
}

function handleTouchMove(e) {
    e.preventDefault();
    if (!touchEl) return;
    const t = e.touches[0];
    const dx = t.clientX - touchStartX;
    const dy = t.clientY - touchStartY;
    touchEl.style.transform = `translate(${dx}px, ${dy}px) scale(1.1)`;
    touchEl.style.zIndex = 1000;
}

function handleTouchEnd(e) {
    if (!touchEl) return;
    touchEl.classList.remove('dragging');
    touchEl.style.transform = '';
    touchEl.style.zIndex = '';

    const t = e.changedTouches[0];
    const targetEl = document.elementFromPoint(t.clientX, t.clientY);
    const targetSlot = targetEl ? targetEl.closest('.grid-slot') : null;

    if (targetSlot) {
        const targetIdx = parseInt(targetSlot.dataset.index);
        if (targetIdx !== dragSrcIndex) {
            mergeOrMove(dragSrcIndex, targetIdx);
        }
    }

    touchEl = null;
    dragSrcIndex = -1;
}

function mergeOrMove(from, to) {
    const vFrom = boardState[from];
    const vTo = boardState[to];

    if (vTo === null) {
        // Move
        boardState[to] = vFrom;
        boardState[from] = null;
    } else if (vTo === vFrom) {
        // Merge
        if (vTo >= 800) {
            showToast("🎄 이미 완성된 트리입니다!");
            return;
        }
        const newVal = vFrom * 2;
        boardState[to] = newVal;
        boardState[from] = null;
        showToast(`✨ 합체 성공!`);
    } else {
        // Swap (Optional)
        boardState[to] = vFrom;
        boardState[from] = vTo;
    }
    renderGrid();
}

// === 5. Tab Navigation ===
tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        tabContents.forEach(c => c.classList.add('hidden'));
        document.getElementById(btn.dataset.target).classList.remove('hidden');
    });
});

// Toast
const toast = document.getElementById('toast');
function showToast(msg) {
    toast.innerText = msg;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 2000);
}

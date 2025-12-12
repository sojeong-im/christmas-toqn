import { db, doc, setDoc, updateDoc, onSnapshot, increment } from './firebase-config.js';

// === Global State ===
let userTeam = null;
let userZone = null;
let currentCoins = 0;
let userMissionStatus = {};
const BOARD_SIZE = 4;
let boardState = Array(16).fill(null);
let unlockedCollection = []; // [50, 100, 200, ...]

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

// Game & Collection
const spawnBtn = document.getElementById('spawn-btn');
const gameGrid = document.getElementById('game-grid');
const collectionBar = document.getElementById('collection-bar');

// === Mission Data ===
const missionCategories = [
    {
        title: "✔ 5점 미션",
        points: 5,
        items: [
            { id: "m5_1", text: "기도문 작성 1회<br><span style='font-size:11px; color:#888'>(1인 최대 1회)</span>" },
            { id: "m5_2", text: "팀원 칭찬 3회<br><span style='font-size:11px; color:#888'>(1인 최대 3회)</span>" },
            { id: "m5_3", text: "연말 감사 편지 1회(5줄 이상)<br><span style='font-size:11px; color:#888'>영가족/윗사명자(최대 1명)</span>" }
        ]
    },
    {
        title: "✔ 10점 미션",
        points: 10,
        items: [
            { id: "m10_1", text: "말걸기 20회" },
            { id: "m10_2", text: "스탑 3회" },
            { id: "m10_3", text: "DM노방 10회 보내기" },
            { id: "m10_4", text: "거점 방문 10명" },
            { id: "m10_5", text: "섬김 모임 후 거점 다시 방문" },
            { id: "m10_6", text: "지인 안부 연락 10회" },
            { id: "m10_7", text: "티엠 5회 시도<br><span style='font-size:11px; color:#888'>(생티엠·소모임·노방·메리트 포함)</span>" }
        ]
    },
    {
        title: "✔ 30점 미션",
        points: 30,
        items: [
            { id: "m30_1", text: "신찾 1개" },
            { id: "m30_2", text: "잎사귀 1회(금일만남 한정)" }
        ]
    },
    {
        title: "✔ 스페셜 미션",
        points: 50,
        items: [
            { id: "m50_1", text: "컨펌된 타찾 (50점)" }
        ]
    },
    {
        title: "🌟 보너스 미션 (30점/1회한정)",
        points: 30,
        items: [
            {
                id: "mb_1",
                text: "새부기 포즈로 구역별 사진 찍기<br><span style='font-size:11px; color:#888'>주제: 이심전심 (1등 +200점)</span>",
                unlockTime: "17:00", // 5 PM
                maxCount: 1
            },
            {
                id: "mb_2",
                text: "캐롤 제목 맞히기 퀴즈<br><span style='font-size:11px; color:#888'>전주듣고 맞추기(동메 인증)</span>",
                unlockTime: "16:00", // 4 PM
                maxCount: 1
            },
            {
                id: "mb_3",
                text: "빨간색 아이템 5개 찾기",
                unlockTime: "17:00", // 5 PM
                maxCount: 1
            },
            {
                id: "mb_4",
                text: "트리와 함께 사진 찍기<br><span style='font-size:11px; color:#888'>가장 큰 트리팀 +50점</span>",
                // unlocking now or default
                maxCount: 1
            }
        ]
    }
];

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
}

// === 2. Firebase Connection (REALTIME SYNC) ===
function connectToFirebase(teamId) {
    const docId = `team_${teamId.padStart(2, '0')}`;
    const docRef = doc(db, "teams", docId);

    onSnapshot(docRef, (snap) => {
        if (snap.exists()) {
            const data = snap.data();

            // 1. Coins
            currentCoins = data.coins || 0;
            updateScoreUI();

            // 2. Missions
            if (data.missions) {
                userMissionStatus = data.missions;
                updateMissionUI();
            }

            // 3. Game Board (Synced!)
            if (data.board) {
                boardState = data.board;
            } else {
                boardState = Array(16).fill(null); // Init if empty
            }
            renderGrid();

            // 4. Collection (Shared!)
            if (data.collection) {
                unlockedCollection = data.collection;
            } else {
                unlockedCollection = [];
            }
            updateCollectionUI();

        } else {
            // Initialize Team Doc
            setDoc(docRef, {
                coins: 0,
                missions: {},
                board: Array(16).fill(null),
                collection: []
            });
        }
    });
}

// === UI Updates ===
function updateScoreUI() {
    teamScoreEl.innerText = currentCoins.toLocaleString();

    if (currentCoins >= 50) {
        spawnBtn.disabled = false;
        spawnBtn.innerHTML = `<span class="icon">🥣</span><span class="text">쿠키 굽기 (-50P)</span>`;
    } else {
        spawnBtn.disabled = true;
        spawnBtn.innerHTML = `<span class="icon">🔒</span><span class="text">50P 필요</span>`;
    }
}

function updateMissionUI() {
    Object.keys(userMissionStatus).forEach(mid => {
        const badge = document.getElementById(`count-${mid}`);
        if (badge) {
            badge.innerText = `${userMissionStatus[mid]}회`;
        }
    });
}

function updateCollectionUI() {
    const items = collectionBar.querySelectorAll('.col-item');
    items.forEach(el => {
        const val = parseInt(el.dataset.val);
        if (unlockedCollection.includes(val)) {
            if (el.classList.contains('locked')) { // New unlock
                el.classList.remove('locked');
                el.classList.add('unlocked');
                el.innerText = "";
            }
        }
    });
}

// === 3. Mission Actions ===
function renderMissionList() {
    missionListEl.innerHTML = '';

    // Get Current Time (HH:MM string comparison is enough for same day)
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const currentTimeStr = `${hours}:${minutes}`;

    missionCategories.forEach(cat => {
        const section = document.createElement('div');
        section.innerHTML = `<div class="section-title">${cat.title}</div>`;

        cat.items.forEach(item => {
            const count = (userMissionStatus[item.id] || 0);

            // 1. Check Lock Status
            let isLocked = false;
            let lockText = "";
            if (item.unlockTime && currentTimeStr < item.unlockTime) {
                isLocked = true;
                lockText = `🔒 ${item.unlockTime} 공개 예정`;
            }

            // 2. Check Max Count Status (For Bonus Missions)
            let isMaxed = false;
            if (item.maxCount && count >= item.maxCount) {
                isMaxed = true;
            }

            const el = document.createElement('div');
            el.className = 'mission-item';

            // Render Content
            if (isLocked) {
                // Locked View
                el.classList.add('locked-mission');
                el.innerHTML = `
                    <div style="flex:1; text-align:center; color:#aaa; font-size:14px; font-weight:700;">
                        ${lockText}
                    </div>
                `;
            } else {
                // Normal View
                const btnState = isMaxed ? 'disabled' : '';
                const btnText = isMaxed ? '완료됨' : '완료하기';
                const btnClass = isMaxed ? 'mission-btn-done' : 'mission-btn-repeat';

                el.innerHTML = `
                    <div class="mission-status">
                        <button class="${btnClass}" data-id="${item.id}" ${btnState}>${btnText}</button>
                        <span class="mission-count-badge" id="count-${item.id}">${count}회${item.maxCount ? '/1' : ''}</span>
                    </div>
                    <div class="mission-detail">
                        <div class="mission-text">${item.text}</div>
                        <span class="mission-points">+${cat.points}점</span>
                    </div>
                `;

                // Add Event Listener if active
                if (!isMaxed) {
                    const btn = el.querySelector('.mission-btn-repeat');
                    btn.addEventListener('click', () => {
                        if (confirm(`"${item.text.replace(/<[^>]*>?/gm, '')}" 미션을 완료하셨나요?`)) {
                            performMissionAction(cat.points, item.id);
                            showToast(`✅ 재료 획득! +${cat.points}P`);
                        }
                    });
                }
            }
            section.appendChild(el);
        });
        missionListEl.appendChild(section);
    });
}

async function performMissionAction(points, missionId) {
    const docId = `team_${userTeam.padStart(2, '0')}`;
    const updates = {
        coins: increment(points)
    };
    if (missionId) {
        updates[`missions.${missionId}`] = increment(1);
    }
    await updateDoc(doc(db, "teams", docId), updates);
}

// === 4. Game Logic (Server-side focused) ===
spawnBtn.addEventListener('click', async () => {
    if (currentCoins < 50) return;

    // Find empty spot locally first to check
    const empties = boardState.map((v, i) => v === null ? i : null).filter(v => v !== null);
    if (empties.length === 0) {
        showToast("오븐(격자판)이 꽉 찼어요!");
        return;
    }

    // Pick random spot
    const idx = empties[Math.floor(Math.random() * empties.length)];

    // Optimistic Update (Prevent lag feeling)
    boardState[idx] = 50;
    renderGrid();

    // Sync to DB
    const docId = `team_${userTeam.padStart(2, '0')}`;
    const newBoard = [...boardState];
    newBoard[idx] = 50; // Ensure logic consistency

    // Add to collection if not present
    let newCollection = [...unlockedCollection];
    if (!newCollection.includes(50)) newCollection.push(50);

    const updates = {
        coins: increment(-50),
        board: newBoard,
        collection: newCollection
    };

    await updateDoc(doc(db, "teams", docId), updates);
});

function renderGrid() {
    gameGrid.innerHTML = '';
    boardState.forEach((val, idx) => {
        const slot = document.createElement('div');
        slot.className = 'grid-slot';
        slot.dataset.index = idx; // Important for drop

        if (val) {
            const piece = document.createElement('div');
            piece.className = `game-piece p-${val}`;
            piece.draggable = true;

            // Only unlock view if collected? Or always show?
            // User request: "깨기 전에는 물음표로 안보이고" -> "격자판 위에 보였으면 좋겠어"
            // Usually merge games show pieces even if not 'collected' widely.
            // But let's assume if it exists on board, you can see it. 
            // The collection bar handles the "Global Unlock" status.

            addDragEvents(piece);
            slot.appendChild(piece);
        }

        slot.addEventListener('dragover', e => e.preventDefault());
        slot.addEventListener('drop', handleDrop);
        gameGrid.appendChild(slot);
    });
}

// --- Drag & Drop Sync Logic ---
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
    // Touch support hooks
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
        performMove(dragSrcIndex, targetIdx);
    }
}

// Touch Handling (Optimized)
let touchEl = null; let tX = 0, tY = 0;
function handleTouchStart(e) { e.preventDefault(); touchEl = e.target; tX = e.touches[0].clientX; tY = e.touches[0].clientY; dragSrcIndex = parseInt(touchEl.parentElement.dataset.index); touchEl.classList.add('dragging'); }
function handleTouchMove(e) {
    // Use requestAnimationFrame if possible, but for now use translate3d for GPU
    e.preventDefault();
    if (!touchEl) return;
    const t = e.touches[0];
    const dx = t.clientX - tX;
    const dy = t.clientY - tY;
    touchEl.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(1.15)`;
}
function handleTouchEnd(e) {
    if (!touchEl) return;
    touchEl.classList.remove('dragging'); touchEl.style.transform = '';
    const t = e.changedTouches[0]; const target = document.elementFromPoint(t.clientX, t.clientY);
    const slot = target ? target.closest('.grid-slot') : null;
    if (slot) {
        const idx = parseInt(slot.dataset.index);
        if (idx !== dragSrcIndex) performMove(dragSrcIndex, idx);
    }
    touchEl = null; dragSrcIndex = -1;
}

// === Critical: Sync Move to DB (Optimistic) ===
async function performMove(from, to) {
    const vFrom = boardState[from];
    const vTo = boardState[to];

    if (vFrom === null) return; // Ghost drag check

    let newBoard = [...boardState];
    let newCollection = [...unlockedCollection];
    let msg = "";
    let success = true;

    if (vTo === null) {
        // Move
        newBoard[to] = vFrom;
        newBoard[from] = null;
    } else if (vTo === vFrom) {
        // Merge
        if (vTo >= 800) {
            showToast("🎄 전설의 쿠키는 더 이상 합칠 수 없어요!");
            return;
        }
        const newVal = vFrom * 2;
        newBoard[to] = newVal;
        newBoard[from] = null;

        // Update Collection
        if (!newCollection.includes(newVal)) newCollection.push(newVal);

        msg = "✨ 따끈따끈! 쿠키가 구워졌어요!";
        if (newVal === 800) msg = "🎄 전설의 트리가 완성되었습니다!!";
        showToast(msg);
    } else {
        // Swap
        newBoard[to] = vFrom;
        newBoard[from] = vTo;
    }

    // 1. Optimistic Local Update (Instant Feedback)
    boardState = newBoard;
    unlockedCollection = newCollection;
    renderGrid();
    updateCollectionUI();

    // 2. Server Update (Background)
    const docId = `team_${userTeam.padStart(2, '0')}`;
    try {
        await updateDoc(doc(db, "teams", docId), {
            board: newBoard,
            collection: newCollection
        });
    } catch (err) {
        console.error("Sync failed:", err);
        // Rollback could go here if strict, but for game feel we stick to optimistic
        // onSnapshot will eventually correct it
    }
}

// === Tab Nav ===
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
let toastTimer = null;

function showToast(m) {
    if (toastTimer) clearTimeout(toastTimer); // Clear existing timer

    toast.innerText = m;
    toast.classList.remove('hidden');

    toastTimer = setTimeout(() => {
        toast.classList.add('hidden');
        toastTimer = null;
    }, 2000);
}

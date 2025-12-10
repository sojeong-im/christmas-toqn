import { db, doc, getDoc, setDoc, updateDoc, onSnapshot, increment } from './firebase-config.js';

// Global State
let userTeam = null; // '1', '2', '3', '4'
let userZone = null;
let userMission = null;
let currentCoins = 0;
let currentTab = 'basic';
const inventory = {}; // { itemId: count }

// Mock Items Data
const items = [
    // Basic Items (5-10 coins)
    { id: 'b1', name: '작은 사랑 볼', price: 5, tier: 'basic', image: 'assets/images/small_love_ball.png' },
    { id: 'b2', name: '미니 지팡이', price: 7, tier: 'basic', image: 'assets/images/small_love_ball.png' },
    { id: 'b3', name: '반짝 리본', price: 10, tier: 'basic', image: 'assets/images/small_love_ball.png' },

    // Core Items (15-25 coins)
    { id: 'c1', name: '왕별 장식', price: 15, tier: 'core', image: 'assets/images/star_ornament.png' },
    { id: 'c2', name: '금빛 종', price: 20, tier: 'core', image: 'assets/images/star_ornament.png' },
    { id: 'c3', name: '루돌프 인형', price: 25, tier: 'core', image: 'assets/images/star_ornament.png' },

    // Highlight Items (40-80 coins)
    { id: 'h1', name: '새부기 스페셜', price: 50, tier: 'highlight', image: 'assets/images/saebugi_hug.png' },
    { id: 'h2', name: '황금 트리 팁', price: 80, tier: 'highlight', image: 'assets/images/saebugi_hug.png' },

    // Secret Items
    { id: 's1', name: '새부기 포옹 장식', price: 100, tier: 'secret', image: 'assets/images/saebugi_hug.png' }
];

// DOM Elements
const introScreen = document.getElementById('intro-screen');
const appContainer = document.getElementById('app-container');
const loginForm = document.getElementById('login-form');
const teamSelect = document.getElementById('team-select');
const zoneSelect = document.getElementById('zone-select');
const missionSelect = document.getElementById('mission-select');

const headerTeamName = document.getElementById('team-name');
const headerZoneInfo = document.getElementById('zone-info');
const coinDisplay = document.getElementById('coin-amount');
const itemGrid = document.getElementById('item-grid');
const secretGrid = document.getElementById('secret-grid');
const secretSection = document.getElementById('secret-section');
const tabButtons = document.querySelectorAll('.tab-btn');
const toast = document.getElementById('toast');
const toastMessage = document.getElementById('toast-message');

const modalOverlay = document.getElementById('modal-overlay');
const modalText = document.getElementById('modal-text');
const modalConfirmBtn = document.getElementById('modal-confirm');
const modalCancelBtn = document.getElementById('modal-cancel');

let pendingPurchaseId = null;

// === Intro Logic: Team & Zone Handling ===
teamSelect.addEventListener('change', () => {
    const team = teamSelect.value;
    updateZoneOptions(team);
});

function updateZoneOptions(team) {
    zoneSelect.innerHTML = '<option value="" disabled selected>구역 선택</option>';
    zoneSelect.disabled = false;

    let maxZones = 5;
    if (team === '1') {
        maxZones = 6;
    }

    for (let i = 1; i <= maxZones; i++) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = `${i}구역`;
        zoneSelect.appendChild(option);
    }
}

// === Login / Enter Shop Logic ===
loginForm.addEventListener('submit', (e) => {
    e.preventDefault();

    userTeam = teamSelect.value;
    userZone = zoneSelect.value;
    userMission = missionSelect.value;

    if (!userTeam || !userZone || !userMission) {
        alert("모든 항목을 선택해주세요!");
        return;
    }

    // Save Context & Transition
    enterShop();
});

function enterShop() {
    // Save to LocalStorage for other pages
    localStorage.setItem('userTeam', userTeam);
    localStorage.setItem('userZone', userZone);

    // UI Transition
    introScreen.style.display = 'none';
    appContainer.classList.remove('hidden');

    // Update Header
    headerTeamName.innerText = `${userTeam}팀`;
    headerZoneInfo.innerText = `${userZone}구역`;

    // Connect to Firebase for this specific team
    connectToFirebase(userTeam);
}

// === Connection Logic ===
async function connectToFirebase(teamId) {
    const teamDocId = `team_${teamId.padStart(2, '0')}`; // e.g., team_01

    try {
        const teamRef = doc(db, "teams", teamDocId);

        // Listen for changes
        onSnapshot(teamRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                currentCoins = data.coins || 0;

                // Sync Inventory
                if (data.inventory) {
                    Object.assign(inventory, data.inventory);
                }

                updateAppUI();
            } else {
                // Create if not exists (First login for this team)
                setDoc(teamRef, {
                    coins: 1000, // Initial Bonus
                    inventory: {}
                });
            }
        });
    } catch (e) {
        console.warn("Firebase Error (Local Mode):", e);
        // Fallback for local testing wo/ Firebase
        currentCoins = 1250;
        updateAppUI();
    }
}

function updateAppUI() {
    updateCoinDisplay();
    renderItems(currentTab);
    if (currentTab === 'secret') renderSecretItems();
    checkSecretUnlock();
}

// === Core Shop Logic ===
function updateCoinDisplay() {
    coinDisplay.innerText = currentCoins.toLocaleString();
    updateButtonStates();
}

function updateButtonStates() {
    document.querySelectorAll('.buy-btn').forEach(btn => {
        const cost = parseInt(btn.dataset.cost);
        if (currentCoins < cost) {
            btn.disabled = true;
            btn.innerText = "코인 부족";
        } else {
            btn.disabled = false;
            btn.innerText = "구매";
        }
    });
}

function checkSecretUnlock() {
    const totalItems = Object.values(inventory).reduce((a, b) => a + b, 0);
    // Demo condition: 2 or more items bought
    if (totalItems >= 2 && secretSection.classList.contains('hidden')) {
        secretSection.classList.remove('hidden');
        renderSecretItems();
        showToast("😮 새부기의 비밀 창고가 열렸습니다!");
    }
}

function renderItems(tier) {
    itemGrid.innerHTML = '';
    const filteredItems = items.filter(i => i.tier === tier);

    filteredItems.forEach(item => {
        const count = inventory[item.id] || 0;
        const card = document.createElement('div');
        card.className = 'item-card';
        card.innerHTML = `
            <img src="${item.image}" alt="${item.name}" class="item-image" onerror="this.src='https://placehold.co/100/FFC107/white?text=Item'">
            <div class="item-name">${item.name}</div>
            <div class="item-price">
                <span>🪙 ${item.price}</span>
            </div>
            ${count > 0 ? `<div class="item-count">${count}개 구매 완료</div>` : ''}
            <button class="buy-btn" data-id="${item.id}" data-cost="${item.price}" data-name="${item.name}">
                구매
            </button>
        `;

        card.querySelector('.buy-btn').addEventListener('click', (e) => {
            initiateBuy(e.target.dataset.id);
        });

        itemGrid.appendChild(card);
    });
    updateButtonStates();
}

function renderSecretItems() {
    secretGrid.innerHTML = '';
    const secretItems = items.filter(i => i.tier === 'secret');
    secretItems.forEach(item => {
        const count = inventory[item.id] || 0;
        const card = document.createElement('div');
        card.className = 'item-card';
        card.style.border = "2px solid var(--color-gold)";
        card.innerHTML = `
            <img src="${item.image}" alt="${item.name}" class="item-image">
            <div class="item-name">${item.name}</div>
            <div class="item-price">
                <span>🪙 ${item.price}</span>
            </div>
             ${count > 0 ? `<div class="item-count">${count}개 구매 완료</div>` : ''}
            <button class="buy-btn" data-id="${item.id}" data-cost="${item.price}" data-name="${item.name}">
                구매
            </button>
        `;
        card.querySelector('.buy-btn').addEventListener('click', (e) => {
            initiateBuy(e.target.dataset.id);
        });
        secretGrid.appendChild(card);
    });
    updateButtonStates();
}

// Tab Switching
tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        tabButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentTab = btn.dataset.tier;
        renderItems(currentTab);
    });
});

// Buying Logic
function initiateBuy(id) {
    const item = items.find(i => i.id === id);
    if (!item) return;

    if (currentCoins < item.price) {
        showToast("코인이 부족합니다! 😅");
        return;
    }

    pendingPurchaseId = id;
    modalText.innerHTML = `정말 <strong>${item.name}</strong>을(를) <strong>${item.price} 새코인</strong>에 구매하시겠습니까?<br><span style="font-size:12px; color:#888;">팀 코인이 차감됩니다.</span>`;
    modalOverlay.classList.remove('hidden');
}

modalCancelBtn.addEventListener('click', () => {
    modalOverlay.classList.add('hidden');
    pendingPurchaseId = null;
});

modalConfirmBtn.addEventListener('click', async () => {
    if (pendingPurchaseId) {
        const item = items.find(i => i.id === pendingPurchaseId);
        if (item) {

            // Firebase Update
            try {
                const teamDocId = `team_${userTeam.padStart(2, '0')}`;
                const teamRef = doc(db, "teams", teamDocId);

                await updateDoc(teamRef, {
                    coins: increment(-item.price),
                    [`inventory.${item.id}`]: increment(1)
                });

                showToast(`${item.name} 구매 완료! 우리 팀의 트리를 꾸며주세요. 🎉`);

            } catch (e) {
                console.error("Purchase failed", e);
                // Fallback for local
                if (!db._databaseId) { // simple check if db is basically empty/mocked
                    currentCoins -= item.price;
                    inventory[item.id] = (inventory[item.id] || 0) + 1;
                    updateAppUI();
                    showToast(`${item.name} 구매 완료! (로컬 모드)`);
                } else {
                    showToast("구매 실패! 인터넷 연결이나 설정을 확인하세요.");
                }
            }

            modalOverlay.classList.add('hidden');
            pendingPurchaseId = null;
        }
    }
});

// Toast
function showToast(msg) {
    toastMessage.innerText = msg;
    toast.classList.remove('hidden');
    toast.style.animation = 'none';
    toast.offsetHeight;
    toast.style.animation = 'fadeInOut 3s forwards';
}

// Footer Events
document.querySelector('.btn-tree').addEventListener('click', () => {
    showToast("🎄 트리 꾸미기 화면으로 이동합니다 (데모)");
});

document.querySelector('.btn-mission').addEventListener('click', () => {
    showToast("🎯 미션 목록으로 이동합니다 (데모)");
});

// Init is handled by Login now, but we can set default render for background
renderItems('basic');

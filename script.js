import { db, doc, getDoc, setDoc, updateDoc, onSnapshot, increment } from './firebase-config.js';

// Initial State (Will be overwritten by Firebase)
let currentCoins = 1250;
let currentTab = 'basic';
const teamName = "1팀";
const TEAM_ID = "team_01"; // ID for database

// Mock Data for Items
const inventory = {}; // { itemId: count }

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

// Initialize
async function init() {
    renderItems('basic');

    // Firebase Realtime Listener
    try {
        const teamRef = doc(db, "teams", TEAM_ID);

        // Listen for changes
        onSnapshot(teamRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                currentCoins = data.coins || 0;
                // Merge remote inventory with local logic if needed, or just use remote
                // For simplicity, let's just use the count from DB if we stored it properly.
                // But structure might be: { coins: 1000, inventory: { b1: 2, c1: 1 } }
                if (data.inventory) {
                    Object.assign(inventory, data.inventory);
                }
                updateCoinDisplay();
                renderItems(currentTab);
                if (currentTab === 'secret') renderSecretItems(); // Refresh current view
                checkSecretUnlock();
            } else {
                // Initialize if not exists
                setDoc(teamRef, {
                    coins: 1250,
                    inventory: {}
                });
            }
        });
    } catch (e) {
        console.warn("Firebase config not set or invalid. Using local mode.", e);
        // Fallback or "Local Mode" indicator
        updateCoinDisplay();
    }
}

// Core Logic
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

    // Check local coins first for instant feedback (optional, but safer to check DB)
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
                const teamRef = doc(db, "teams", TEAM_ID);
                await updateDoc(teamRef, {
                    coins: increment(-item.price),
                    [`inventory.${item.id}`]: increment(1)
                });

                // Success UI
                showToast(`${item.name} 구매 완료! 우리 팀의 트리를 꾸며주세요. 🎉`);

            } catch (e) {
                console.error("Purchase failed", e);
                showToast("구매 실패! 인터넷 연결이나 설정을 확인하세요.");
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

// Run
init();

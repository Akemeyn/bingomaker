import { initializeApp } from "https://www.gstatic.com/firebasejs/9.17.1/firebase-app.js";
import { getDatabase, ref, set, get, onValue, onDisconnect, update } from "https://www.gstatic.com/firebasejs/9.17.1/firebase-database.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/9.17.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDUFrvnDFeVXFgZaTW_E92QAbkLgig2NcY",
  authDomain: "bingo-maker-93399.firebaseapp.com",
  databaseURL: "https://bingo-maker-93399-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "bingo-maker-93399",
  storageBucket: "bingo-maker-93399.firebasestorage.app",
  messagingSenderId: "708430590580",
  appId: "1:708430590580:web:60847d689b67ca5a569721",
  measurementId: "G-2QTPD8F3CE"
};

let app, db, auth;
try {
    app = initializeApp(firebaseConfig);
    db = getDatabase(app);
    auth = getAuth(app);
} catch (e) {
    alert("Firebase başlatılamadı: " + e.message);
}

const colorPalette = ["#E38B23", "#A17CE9", "#F374CF", "#7AF0BD", "#77BEDE", "#DA4B49"];
let currentUser = { uid: null, name: "", color: "" };
let mySelections = [12];
let bingoItems = [];


function showScreen(id) {
    const screens = document.querySelectorAll('.screen');
    screens.forEach(s => s.classList.add('hidden'));
    const target = document.getElementById(id);
    if (target) {
        target.classList.remove('hidden');
    } else {
        console.error("HATA: '" + id + "' ID'li ekran bulunamadı!");
    }
}

window.onload = function() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const data = urlParams.get('items');
        if (data) {
            showScreen('login-screen');
        } else {
            showScreen('setup-screen');
        }
    } catch (e) {
        alert("Sayfa yükleme hatası (undefined kontrolü): " + e.message);
    }
};


window.loginUser = async function() {
    const nick = document.getElementById('nickname-input').value.trim();
    const pass = document.getElementById('password-input').value.trim();
    
    if (!nick || !pass) return alert("Lütfen kullanıcı adı ve şifre girin!");

    const email = `${nick.toLowerCase()}@bingo.com`;

    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, pass);
        currentUser.uid = userCredential.user.uid;
        
        const snapshot = await get(ref(db, 'users/' + currentUser.uid));
        
        if (snapshot.exists()) {
            await loadPersistentProfile();
        } else {
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('items')) {
                await initPersistentProfile(nick);
            } else {
                alert("Hoş geldiniz! Henüz bir bingo kartınız yok. Lütfen bir liste oluşturun.");
                showScreen('setup-screen');
            }
        }
    } catch (error) {
        if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
        } else {
            alert("Giriş başarısız: " + error.code);
        }
    }
};

async function loadPersistentProfile() {
    try {
        const snapshot = await get(ref(db, 'users/' + currentUser.uid));
        if (snapshot.exists()) {
            const data = snapshot.val();
            currentUser.name = data.name;
            currentUser.color = data.color;
            bingoItems = data.bingoItems;
            showScreen('game-screen');
            startLiveSession();
        } else {
            alert("Profil verisi veritabanında bulunamadı.");
        }
    } catch (e) {
        alert("Profil yükleme hatası: " + e.message);
    }
}

async function initPersistentProfile(nick) {
    const urlParams = new URLSearchParams(window.location.search);
    const encodedData = urlParams.get('items');
    if (!encodedData) return alert("Hata: URL'de bingo listesi yok!");

    const decoded = decodeURIComponent(escape(atob(encodedData)));
    const shuffledItems = decoded.split('|').sort(() => Math.random() - 0.5);

    const usersSnapshot = await get(ref(db, 'users'));
    let usedColors = [];
    if (usersSnapshot.exists()) {
        usedColors = Object.values(usersSnapshot.val()).map(u => u.color);
    }
    const available = colorPalette.filter(c => !usedColors.includes(c));
    const finalColor = available.length > 0 ? available[0] : colorPalette[0];

    await set(ref(db, 'users/' + currentUser.uid), {
        name: nick,
        color: finalColor,
        bingoItems: shuffledItems
    });
    await loadPersistentProfile();
}

function startLiveSession() {
    const liveRef = ref(db, 'players/' + currentUser.uid);
    set(liveRef, {
        name: currentUser.name,
        color: currentUser.color,
        selections: mySelections,
        isOnline: true
    });
    onDisconnect(liveRef).update({ isOnline: false });
    document.addEventListener("visibilitychange", () => {
        if (currentUser.uid) {
            update(ref(db, 'players/' + currentUser.uid), { isOnline: document.visibilityState === 'visible' });
        }
    });
    renderBoard();
    listenOnlinePlayers();
}

function renderBoard() {
    const board = document.getElementById('bingo-board');
    if (!board) return;
    board.innerHTML = '';
    for (let i = 0; i < 25; i++) {
        const cell = document.createElement('div');
        cell.className = 'cell' + (i === 12 ? ' free selected' : '');
        if (mySelections.includes(i)) cell.style.backgroundColor = currentUser.color;
        if (i === 12) cell.innerText = "⭐ JOKER";
        else {
            const idx = i > 12 ? i - 1 : i;
            cell.innerText = bingoItems[idx] || "";
            cell.onclick = () => toggleCell(i);
        }
        board.appendChild(cell);
    }
}

function toggleCell(i) {
    if (i === 12) return;
    if (mySelections.includes(i)) mySelections = mySelections.filter(item => item !== i);
    else mySelections.push(i);
    update(ref(db, 'players/' + currentUser.uid), { selections: mySelections });
    renderBoard();
}

function listenOnlinePlayers() {
    onValue(ref(db, 'players'), (snapshot) => {
        const players = snapshot.val();
        const container = document.getElementById('others-container');
        if (!container) return;
        container.innerHTML = '';
        if (!players) return;
        for (let id in players) {
            if (id === currentUser.uid) continue;
            const player = players[id];
            const card = document.createElement('div');
            card.className = 'mini-player-card' + (player.isOnline ? '' : ' offline');
            card.innerHTML = `<span class="mini-name">${player.isOnline ? '🟢' : '⚪'} ${player.name}</span>`;
            const grid = document.createElement('div');
            grid.className = 'mini-grid';
            for (let i = 0; i < 25; i++) {
                const mc = document.createElement('div');
                mc.className = 'mini-cell';
                if (player.selections && player.selections.includes(i)) mc.style.backgroundColor = player.color;
                grid.appendChild(mc);
            }
            card.appendChild(grid);
            card.onclick = () => viewOther(player);
            container.appendChild(card);
        }
    });
}

window.updateEditor = function() {
    const input = document.getElementById('list-input');
    const counter = document.getElementById('counter');
    if (!input || !counter) return;
    const lines = input.value.split('\n').filter(l => l.trim() !== "");
    counter.innerText = `Madde Sayısı: ${lines.length} / 24`;
    counter.style.color = lines.length >= 24 ? "#27ae60" : "#e67e22";
};

window.generateLink = function() {
    const text = document.getElementById('list-input').value.trim();
    const items = text.split('\n').filter(i => i.trim() !== "");
    if (items.length < 24) return alert("En az 24 madde yazmalısınız!");
    const encoded = btoa(unescape(encodeURIComponent(items.join('|'))));
    const url = window.location.origin + window.location.pathname + "?items=" + encoded;
    document.getElementById('share-url').value = url;
    document.getElementById('link-result').classList.remove('hidden');
};

window.copyLink = function() {
    const el = document.getElementById('share-url');
    if (el) { el.select(); document.execCommand('copy'); alert("Link kopyalandı!"); }
};

window.closeModal = function() { document.getElementById('overlay').classList.add('hidden'); };

function viewOther(player) {
    const body = document.getElementById('modal-body');
    if (!body) return;
    body.innerHTML = `<h3>${player.name} Kartı</h3><div class="board" id="mini-board-modal"></div>`;
    const miniBoard = document.getElementById('mini-board-modal');
    for (let i = 0; i < 25; i++) {
        const cell = document.createElement('div');
        cell.className = 'cell' + (player.selections.includes(i) ? ' selected' : '');
        if (player.selections.includes(i)) cell.style.backgroundColor = player.color;
        if (i === 12) cell.innerText = "⭐";
        else {
            const idx = i > 12 ? i - 1 : i;
            cell.innerText = player.items[idx] || "";
        }
        miniBoard.appendChild(cell);
    }
    document.getElementById('overlay').classList.remove('hidden');
}
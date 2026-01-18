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

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

const colorPalette = ["#E38B23", "#A17CE9", "#F374CF", "#7AF0BD", "#77BEDE", "#DA4B49"];
let currentUser = { uid: null, name: "", color: "" };
let mySelections = [12];
let bingoItems = [];

window.onload = function () {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('items')) showScreen('login-screen');
    else showScreen('setup-screen');
};

window.loginUser = async function () {
    const nick = document.getElementById('nickname-input').value.trim();
    const pass = document.getElementById('password-input').value.trim();
    if (!nick || !pass) return alert("Lütfen kullanıcı adı ve şifre girin!");
    if (pass.length < 6) return alert("Şifre en az 6 karakter olmalıdır!");
    const email = `${nick.toLowerCase()}@bingo.com`;
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, pass);
        currentUser.uid = userCredential.user.uid;
        const snapshot = await get(ref(db, 'users/' + currentUser.uid));
        if (snapshot.exists()) {
            await loadPersistentProfile();
        } else {
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('items')) await initPersistentProfile(nick);
            else {
                alert("Hoş geldiniz! Lütfen bir liste linkiyle giriş yapın.");
                showScreen('setup-screen');
            }
        }
    } catch (error) {
        if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
            try {
                const newUser = await createUserWithEmailAndPassword(auth, email, pass);
                currentUser.uid = newUser.user.uid;
                await initPersistentProfile(nick);
            } catch (err) { alert("Kayıt hatası: " + (err.message || err.code)); }
        } else { alert("Giriş Hatası: " + (error.message || error.code)); }
    }
};

async function initPersistentProfile(nick) {
    const urlParams = new URLSearchParams(window.location.search);
    const encodedData = urlParams.get('items');
    if (!encodedData) return;
    try {
        const decoded = decodeURIComponent(escape(atob(encodedData)));
        const shuffledItems = decoded.split('|').sort(() => Math.random() - 0.5);
        const usersSnapshot = await get(ref(db, 'users'));
        let usedColors = [];
        if (usersSnapshot.exists()) usedColors = Object.values(usersSnapshot.val()).map(u => u.color);
        const available = colorPalette.filter(c => !usedColors.includes(c));
        const finalColor = available.length > 0 ? available[0] : colorPalette[0];
        await set(ref(db, 'users/' + currentUser.uid), {
            name: nick,
            color: finalColor,
            bingoItems: shuffledItems
        });
        await loadPersistentProfile();
    } catch (e) { alert("Profil oluşturma hatası: " + e.message); }
}

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
        }
    } catch (e) { alert("Hata: " + e.message); }
}

function startLiveSession() {
    const liveRef = ref(db, 'players/' + currentUser.uid);
    set(liveRef, {
        name: currentUser.name,
        color: currentUser.color,
        selections: mySelections,
        items: bingoItems,
        isOnline: true
    });
    onDisconnect(liveRef).update({ isOnline: false });
    document.addEventListener("visibilitychange", () => {
        if (currentUser.uid) update(ref(db, 'players/' + currentUser.uid), { isOnline: document.visibilityState === 'visible' });
    });
    renderBoard();
    listenOnlinePlayers();
}

function showScreen(id) { document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden')); const target = document.getElementById(id); if (target) target.classList.remove('hidden'); }

function renderBoard() {
    const board = document.getElementById('bingo-board');
    if (!board) return;
    board.innerHTML = '';
    for (let i = 0; i < 25; i++) {
        const cell = document.createElement('div');
        cell.className = 'cell' + (mySelections.includes(i) ? ' selected' : '');
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
    checkWin();
}

function checkWin() {
    const winCombos = [
        [0, 1, 2, 3, 4], [5, 6, 7, 8, 9], [10, 11, 12, 13, 14], [15, 16, 17, 18, 19], [20, 21, 22, 23, 24],
        [0, 5, 10, 15, 20], [1, 6, 11, 16, 21], [2, 7, 12, 17, 22], [3, 8, 13, 18, 23], [4, 9, 14, 19, 24],
        [0, 6, 12, 18, 24], [4, 8, 12, 16, 20]
    ];

    for (let combo of winCombos) {
        if (combo.every(idx => mySelections.includes(idx))) {
            const modalBody = document.getElementById('modal-body');
            modalBody.innerHTML = `
                <img src="Bingologo.png" style="max-height:80px; margin-bottom:15px;">
                <p>Tebrikler <b>${currentUser.name}</b>, kazandın!</p>
                <button onclick="closeModal()" class="main-btn">Harika!</button>
            `;
            document.getElementById('overlay').classList.remove('hidden');
            return;
        }
    }
}

function listenOnlinePlayers() {
    onValue(ref(db, 'players'), (snapshot) => {
        const players = snapshot.val();
        const container = document.getElementById('others-container');
        if (!container || !players) return;
        container.innerHTML = '';
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

function viewOther(player) {
    const body = document.getElementById('modal-body');
    if (!body) return;
    body.innerHTML = `
        <h3 style="color:${player.color}">${player.name} Kartı</h3>
        <div class="board" id="mini-board-modal" style="max-width:350px; margin:0 auto;"></div>
    `;
    const miniBoard = document.getElementById('mini-board-modal');
    for (let i = 0; i < 25; i++) {
        const cell = document.createElement('div');
        const isSelected = player.selections && player.selections.includes(i);
        cell.className = 'cell' + (isSelected ? ' selected' : '');
        if (isSelected) cell.style.backgroundColor = player.color;
        if (i === 12) cell.innerText = "⭐";
        else {
            const idx = i > 12 ? i - 1 : i;
            cell.innerText = (player.items && player.items[idx]) ? player.items[idx] : "";
        }
        miniBoard.appendChild(cell);
    }
    document.getElementById('overlay').classList.remove('hidden');
}

window.closeModal = function () { document.getElementById('overlay').classList.add('hidden'); };
window.updateEditor = function () { 
    const input = document.getElementById('list-input');
    const counter = document.getElementById('counter');
    const lines = input.value.split('\n').filter(l => l.trim() !== "");
    counter.innerText = `Madde Sayısı: ${lines.length} / 24`;
    counter.style.color = lines.length >= 24 ? "#27ae60" : "#e67e22";
};
window.generateLink = function () {
    const text = document.getElementById('list-input').value.trim();
    const items = text.split('\n').filter(i => i.trim() !== "");
    if (items.length < 24) return alert("En az 24 madde!");
    const encoded = btoa(unescape(encodeURIComponent(items.join('|'))));
    const url = window.location.origin + window.location.pathname + "?items=" + encoded;
    document.getElementById('share-url').value = url;
    document.getElementById('link-result').classList.remove('hidden');
};
window.copyLink = function () { const el = document.getElementById('share-url'); el.select(); document.execCommand('copy'); alert("Kopyalandı!"); };
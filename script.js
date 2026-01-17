import { initializeApp } from "https://www.gstatic.com/firebasejs/9.17.1/firebase-app.js";
import { getDatabase, ref, set, onValue, onDisconnect } from "https://www.gstatic.com/firebasejs/9.17.1/firebase-database.js";

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

let currentUser = { id: null, name: "" };
let mySelections = [12];
let bingoItems = [];

window.onload = function() {
    const urlParams = new URLSearchParams(window.location.search);
    const data = urlParams.get('items');
    if (data) {
        showScreen('login-screen');
    } else {
        showScreen('setup-screen');
    }
};

window.loginUser = function() {
    const nick = document.getElementById('nickname-input').value.trim();
    if (!nick) return alert("Lütfen bir isim girin!");
    currentUser.name = nick;
    currentUser.id = "user_" + Math.random().toString(36).substr(2, 9);
    const urlParams = new URLSearchParams(window.location.search);
    const data = urlParams.get('items');
    showScreen('game-screen');
    setupBingo(data);
};

window.addEventListener('beforeunload', function (e) {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('items')) {
        e.preventDefault();
        e.returnValue = '';
    }
});

function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
}

window.updateEditor = function() {
    const input = document.getElementById('list-input');
    const lines = input.value.split('\n').filter(l => l.trim() !== "");
    const counter = document.getElementById('counter');
    counter.innerText = `Madde Sayısı: ${lines.length} / 24`;
    counter.style.color = lines.length >= 24 ? "#27ae60" : "#e67e22";
};

window.generateLink = function() {
    const text = document.getElementById('list-input').value.trim();
    const items = text.split('\n').filter(i => i.trim() !== "");
    if (items.length < 24) { alert("En az 24 madde yazmalısınız!"); return; }
    const encoded = btoa(unescape(encodeURIComponent(items.join('|'))));
    const url = window.location.origin + window.location.pathname + "?items=" + encoded;
    document.getElementById('share-url').value = url;
    document.getElementById('link-result').classList.remove('hidden');
};

function setupBingo(encodedData) {
    const decoded = decodeURIComponent(escape(atob(encodedData)));
    bingoItems = decoded.split('|').sort(() => Math.random() - 0.5);
    const userRef = ref(db, 'players/' + currentUser.id);
    set(userRef, { name: currentUser.name, selections: mySelections, items: bingoItems });
    onDisconnect(userRef).remove();
    renderBoard();
    listenOnlinePlayers();
}

function renderBoard() {
    const board = document.getElementById('bingo-board');
    board.innerHTML = '';
    for (let i = 0; i < 25; i++) {
        const cell = document.createElement('div');
        cell.className = 'cell' + (mySelections.includes(i) ? ' selected' : '') + (i === 12 ? ' free' : '');
        if (i === 12) {
            cell.innerText = "⭐ JOKER";
        } else {
            const idx = i > 12 ? i - 1 : i;
            cell.innerText = bingoItems[idx] || "";
            cell.onclick = () => toggleCell(i);
        }
        board.appendChild(cell);
    }
}

function toggleCell(i) {
    if (mySelections.includes(i)) {
        mySelections = mySelections.filter(item => item !== i);
    } else {
        mySelections.push(i);
    }
    set(ref(db, `players/${currentUser.id}/selections`), mySelections);
    renderBoard();
    checkWin();
}

function listenOnlinePlayers() {
    onValue(ref(db, 'players'), (snapshot) => {
        const players = snapshot.val();
        const list = document.getElementById('online-list');
        list.innerHTML = '';
        for (let id in players) {
            if (id === currentUser.id) continue;
            const li = document.createElement('li');
            li.innerHTML = `🟢 ${players[id].name}`;
            li.onclick = () => viewOther(players[id]);
            list.appendChild(li);
        }
    });
}

function viewOther(player) {
    const body = document.getElementById('modal-body');
    body.innerHTML = `<h3>${player.name} Kartı</h3><div class="board" id="mini-board"></div>`;
    const miniBoard = document.getElementById('mini-board');
    for (let i = 0; i < 25; i++) {
        const cell = document.createElement('div');
        cell.className = 'cell' + (player.selections.includes(i) ? ' selected' : '');
        if (i === 12) cell.innerText = "⭐";
        else {
            const idx = i > 12 ? i - 1 : i;
            cell.innerText = player.items[idx] || "";
        }
        miniBoard.appendChild(cell);
    }
    document.getElementById('overlay').classList.remove('hidden');
}

function checkWin() {
    const winCombos = [
        [0,1,2,3,4], [5,6,7,8,9], [10,11,12,13,14], [15,16,17,18,19], [20,21,22,23,24],
        [0,5,10,15,20], [1,6,11,16,21], [2,7,12,17,22], [3,8,13,18,23], [4,9,14,19,24],
        [0,6,12,18,24], [4,8,12,16,20]
    ];
    for (let combo of winCombos) {
        if (combo.every(idx => mySelections.includes(idx))) {
            document.getElementById('modal-body').innerHTML = "<h2>🎉 BİNGO! 🎉</h2><p>Tebrikler, kazandınız!</p>";
            document.getElementById('overlay').classList.remove('hidden');
            break;
        }
    }
}

window.closeModal = function() { document.getElementById('overlay').classList.add('hidden'); };
window.copyLink = function() {
    const el = document.getElementById('share-url');
    el.select(); document.execCommand('copy');
    alert("Link kopyalandı!");
};
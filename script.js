window.onload = function() {
    const urlParams = new URLSearchParams(window.location.search);
    const data = urlParams.get('items');
    if (data) {
        showScreen('game-screen');
        setupBingo(data);
    }
};

function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
}

function updateEditor() {
    const input = document.getElementById('list-input');
    const lines = input.value.split('\n').filter(l => l.trim() !== "");
    const counter = document.getElementById('counter');
    counter.innerText = `Madde Sayısı: ${lines.length} / 24`;
    counter.style.color = lines.length >= 24 ? "#27ae60" : "#e67e22";
}

function generateLink() {
    const text = document.getElementById('list-input').value.trim();
    const items = text.split('\n').filter(i => i.trim() !== "");
    if (items.length < 24) { alert("En az 24 madde yazmalısınız!"); return; }
    const encoded = btoa(unescape(encodeURIComponent(items.join('|'))));
    const url = window.location.origin + window.location.pathname + "?items=" + encoded;
    document.getElementById('share-url').value = url;
    document.getElementById('link-result').classList.remove('hidden');
}

function setupBingo(encodedData) {
    const decoded = decodeURIComponent(escape(atob(encodedData)));
    let items = decoded.split('|').sort(() => Math.random() - 0.5);
    const board = document.getElementById('bingo-board');
    board.innerHTML = '';

    for (let i = 0; i < 25; i++) {
        const cell = document.createElement('div');
        cell.classList.add('cell');
        if (i === 12) {
            cell.innerText = "JOKER";
            cell.classList.add('free', 'selected');
        } else {
            const idx = i > 12 ? i - 1 : i;
            cell.innerText = items[idx] || "";
            cell.onclick = function() {
                this.classList.toggle('selected');
                checkWin();
            };
        }
        board.appendChild(cell);
    }
}

function checkWin() {
    const cells = document.querySelectorAll('.cell');
    const winningCombos = [
        [0,1,2,3,4], [5,6,7,8,9], [10,11,12,13,14], [15,16,17,18,19], [20,21,22,23,24],
        [0,5,10,15,20], [1,6,11,16,21], [2,7,12,17,22], [3,8,13,18,23], [4,9,14,19,24],
        [0,6,12,18,24], [4,8,12,16,20]
    ];

    for (let combo of winningCombos) {
        if (combo.every(index => cells[index].classList.contains('selected'))) {
            document.getElementById('win-overlay').classList.remove('hidden');
            break;
        }
    }
}

function closeWinMessage() { document.getElementById('win-overlay').classList.add('hidden'); }
function copyLink() {
    const el = document.getElementById('share-url');
    el.select(); document.execCommand('copy');
    alert("Link kopyalandı!");
}
// PeerJS P2P Remote Control Logic (Controller Side)
let peer = null;
let conn = null;

const elements = {
    setupScreen: document.getElementById('setup-screen'),
    controlPanel: document.getElementById('control-panel'),
    peerIdInput: document.getElementById('peer-id-input'),
    connectBtn: document.getElementById('connect-btn'),
    disconnectBtn: document.getElementById('disconnect-btn'),
    connectionStatus: document.getElementById('connection-status'),
    
    // Controls
    testAthanBtn: document.getElementById('remote-test-btn'),
    muteBtn: document.getElementById('remote-mute-btn'),
    surahSelect: document.getElementById('remote-surah-select'),
    quranPlay: document.getElementById('remote-quran-play'),
    quranStop: document.getElementById('remote-quran-stop'),
    methodSelect: document.getElementById('remote-method-select'),
    schoolSelect: document.getElementById('remote-school-select'),
    voiceBtn: document.getElementById('remote-voice-btn'),
    swatches: document.querySelectorAll('.swatch')
};

// Auto-fill and connect if ID is provided in query string
window.addEventListener('DOMContentLoaded', () => {
    fetchSurahsList();
    
    const urlParams = new URLSearchParams(window.location.search);
    const peerIdParam = urlParams.get('id');
    if (peerIdParam) {
        elements.peerIdInput.value = peerIdParam;
        // Small delay to allow PeerJS resources to load
        setTimeout(connectToSpeaker, 500);
    }
});

// Setup Listeners
elements.connectBtn.addEventListener('click', connectToSpeaker);
elements.disconnectBtn.addEventListener('click', disconnectFromSpeaker);

function fetchSurahsList() {
    fetch('https://api.alquran.cloud/v1/surah')
        .then(response => response.json())
        .then(data => {
            if (data.code === 200) {
                let optionsHtml = '<option value="">Select Surah...</option>';
                data.data.forEach(surah => {
                    optionsHtml += `<option value="${surah.number}">${surah.number}. ${surah.englishName} (${surah.name})</option>`;
                });
                elements.surahSelect.innerHTML = optionsHtml;
            }
        })
        .catch(err => console.error("Failed to load surahs for remote dropdown", err));
}

function connectToSpeaker() {
    const rawId = elements.peerIdInput.value.trim();
    if (!rawId) {
        alert("Please enter a valid 5-digit Speaker ID.");
        return;
    }

    const speakerPeerId = 'athan-' + rawId;
    updateStatus("Connecting...", "orange");
    
    // Generate a random ID for the remote controller itself
    const controllerId = 'remote-' + Math.floor(Math.random() * 100000);
    peer = new Peer(controllerId, { debug: 1 });

    peer.on('open', () => {
        conn = peer.connect(speakerPeerId);

        conn.on('open', () => {
            updateStatus("Connected", "green");
            showControlPanel(true);
            setupRemoteControlActions();
        });

        conn.on('error', (err) => {
            console.error("Data channel error:", err);
            handleDisconnect("Connection Failed");
        });

        conn.on('close', () => {
            handleDisconnect("Disconnected");
        });
    });

    peer.on('error', (err) => {
        console.error("Remote Peer error:", err);
        handleDisconnect("Failed to connect");
    });
}

function disconnectFromSpeaker() {
    if (conn) {
        conn.close();
    }
    handleDisconnect("Disconnected");
}

function handleDisconnect(reason) {
    conn = null;
    if (peer) {
        peer.destroy();
        peer = null;
    }
    updateStatus(reason || "Disconnected", "red");
    showControlPanel(false);
}

function updateStatus(text, colorClass) {
    let color = "#ef4444"; // red
    if (colorClass === "green") color = "#22c55e";
    if (colorClass === "orange") color = "#f97316";

    elements.connectionStatus.textContent = text;
    elements.connectionStatus.style.background = `rgba(${colorClass === "green" ? "34, 197, 94" : colorClass === "orange" ? "249, 115, 22" : "239, 68, 68"}, 0.15)`;
    elements.connectionStatus.style.color = color;
}

function showControlPanel(show) {
    if (show) {
        elements.setupScreen.style.display = "none";
        elements.controlPanel.style.display = "flex";
        document.getElementById('sub-header').textContent = "Speaker Connected";
    } else {
        elements.setupScreen.style.display = "flex";
        elements.controlPanel.style.display = "none";
        document.getElementById('sub-header').textContent = "Speaker Setup";
    }
}

function sendCommand(payload) {
    if (conn && conn.open) {
        conn.send(payload);
    } else {
        handleDisconnect("Connection Lost");
    }
}

function setupRemoteControlActions() {
    // Athan buttons
    elements.testAthanBtn.onclick = () => sendCommand({ action: 'test_athan' });
    elements.muteBtn.onclick = () => sendCommand({ action: 'toggle_mute' });
    
    // Quran buttons
    elements.quranPlay.onclick = () => {
        const surah = elements.surahSelect.value;
        if (surah) {
            sendCommand({ action: 'play_quran', surah: parseInt(surah) });
        } else {
            alert("Please select a Surah first.");
        }
    };
    elements.quranStop.onclick = () => sendCommand({ action: 'stop_quran' });
    
    // Settings dropdowns
    elements.methodSelect.onchange = (e) => sendCommand({ action: 'change_method', method: e.target.value });
    elements.schoolSelect.onchange = (e) => sendCommand({ action: 'change_school', school: e.target.value });
    
    // Voice command trigger
    elements.voiceBtn.onclick = () => sendCommand({ action: 'trigger_voice' });

    // Theme swatches
    elements.swatches.forEach(swatch => {
        swatch.onclick = (e) => {
            elements.swatches.forEach(s => s.classList.remove('active'));
            e.target.classList.add('active');
            sendCommand({ action: 'change_theme', theme: e.target.dataset.theme });
        };
    });
}

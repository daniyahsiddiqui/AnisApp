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
    voiceBtns: document.querySelectorAll('.remote-voice-btn'),
    swatches: document.querySelectorAll('.swatch'),
    
    // Quran Player settings selectors
    reciterSelect: document.getElementById('remote-reciter-select'),
    ayahFromSelect: document.getElementById('remote-ayah-from'),
    ayahToSelect: document.getElementById('remote-ayah-to'),
    ayahRepeatSelect: document.getElementById('remote-ayah-repeat'),
    rangeRepeatSelect: document.getElementById('remote-range-repeat')
};

// Auto-fill and connect if ID is provided in query string
window.addEventListener('DOMContentLoaded', () => {
    fetchSurahsList();
    
    // Tab switching setup
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tabId = e.currentTarget.dataset.tab;
            
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            document.querySelectorAll('.tab-btn').forEach(tBtn => {
                tBtn.classList.remove('active');
            });
            
            document.getElementById(tabId).classList.add('active');
            e.currentTarget.classList.add('active');
        });
    });

    // Dynamic Ayah population
    if (elements.surahSelect) {
        elements.surahSelect.addEventListener('change', (e) => {
            populateAyahOptions(e.target.value);
        });
    }
    
    const urlParams = new URLSearchParams(window.location.search);
    const peerIdParam = urlParams.get('id');
    if (peerIdParam) {
        elements.peerIdInput.value = peerIdParam;
        // Small delay to allow PeerJS resources to load
        setTimeout(connectToSpeaker, 500);
    }
});

async function populateAyahOptions(surahNum) {
    if (!surahNum || !elements.ayahFromSelect || !elements.ayahToSelect) {
        if (elements.ayahFromSelect) elements.ayahFromSelect.innerHTML = '<option value="1">Ayah 1</option>';
        if (elements.ayahToSelect) elements.ayahToSelect.innerHTML = '<option value="1">Ayah 1</option>';
        return;
    }

    try {
        const response = await fetch(`https://api.alquran.cloud/v1/surah/${surahNum}`);
        const data = await response.json();
        if (data.code === 200) {
            const totalAyahs = data.data.numberOfAyahs;
            let optionsHtml = '';
            for (let i = 1; i <= totalAyahs; i++) {
                optionsHtml += `<option value="${i}">Ayah ${i}</option>`;
            }
            elements.ayahFromSelect.innerHTML = optionsHtml;
            elements.ayahToSelect.innerHTML = optionsHtml;
            
            // Set default values
            elements.ayahFromSelect.value = "1";
            elements.ayahToSelect.value = String(totalAyahs);
        }
    } catch (e) {
        console.error("Failed to load ayahs on remote", e);
    }
}

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

let mqttClient = null;
let pingInterval = null;
let speakerId = '';

function connectToSpeaker() {
    const rawId = elements.peerIdInput.value.trim();
    if (!rawId) {
        alert("Please enter a valid 5-digit Speaker ID.");
        return;
    }

    speakerId = rawId;
    console.log("Connecting to MQTT Broker (broker.emqx.io)...");
    updateStatus("Connecting...", "orange");

    if (mqttClient) {
        try { mqttClient.end(); } catch(e){}
    }

    const clientId = 'remote_' + Math.floor(Math.random() * 100000);
    mqttClient = mqtt.connect('wss://broker.emqx.io:8084/mqtt', {
        clientId: clientId,
        clean: true,
        connectTimeout: 4000,
        reconnectPeriod: 2000
    });

    mqttClient.on('connect', () => {
        console.log("MQTT Connected! Subscribing to Speaker status...");
        
        // Subscribe to Speaker status topic
        mqttClient.subscribe(`anisapp/athan/${speakerId}/status`);

        // Start pinging the Speaker
        if (pingInterval) clearInterval(pingInterval);
        pingInterval = setInterval(() => {
            if (mqttClient && mqttClient.connected) {
                mqttClient.publish(`anisapp/athan/${speakerId}/ping`, JSON.stringify({ client: 'phone' }));
            }
        }, 2000);
    });

    mqttClient.on('message', (topic, message) => {
        let payload;
        try {
            payload = JSON.parse(message.toString());
        } catch (e) {
            return;
        }

        if (topic.endsWith('/status')) {
            if (payload.state === 'connected') {
                updateStatus("Connected", "green");
                showControlPanel(true);
                setupRemoteControlActions();
                updateSpeakerStatusUI(payload.speakerState, payload.detail);
            } else {
                updateStatus("Connecting to Speaker...", "orange");
                showControlPanel(false);
            }
        }
    });

    mqttClient.on('error', (err) => {
        console.error("MQTT Error:", err);
        handleDisconnect("Failed to connect");
    });

    mqttClient.on('close', () => {
        console.log("MQTT Connection Closed");
        handleDisconnect("Disconnected");
    });
}

function disconnectFromSpeaker() {
    handleDisconnect("Disconnected");
}

function handleDisconnect(reason) {
    if (pingInterval) {
        clearInterval(pingInterval);
        pingInterval = null;
    }
    if (mqttClient) {
        try { mqttClient.end(); } catch(e){}
        mqttClient = null;
    }
    updateStatus(reason || "Disconnected", "red");
    showControlPanel(false);
    updateSpeakerStatusUI('idle', 'Speaker is Idle');
}

function updateSpeakerStatusUI(speakerState, detail) {
    const dot = document.getElementById('speaker-status-dot');
    const text = document.getElementById('speaker-status-text');
    if (!dot || !text) return;
    
    // Clear existing classes on dot
    dot.className = 'status-dot';
    
    if (speakerState) {
        dot.classList.add(speakerState);
    }
    
    text.textContent = detail || 'Speaker is Idle';
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
    if (mqttClient && mqttClient.connected && speakerId) {
        mqttClient.publish(`anisapp/athan/${speakerId}/command`, JSON.stringify(payload));
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
            sendCommand({
                action: 'play_quran',
                surah: parseInt(surah),
                reciter: elements.reciterSelect.value,
                fromAyah: elements.ayahFromSelect.value,
                toAyah: elements.ayahToSelect.value,
                ayahRepeat: elements.ayahRepeatSelect.value,
                rangeRepeat: elements.rangeRepeatSelect.value
            });
        } else {
            alert("Please select a Surah first.");
        }
    };
    elements.quranStop.onclick = () => sendCommand({ action: 'stop_quran' });
    
    // Settings dropdowns
    elements.methodSelect.onchange = (e) => sendCommand({ action: 'change_method', method: e.target.value });
    elements.schoolSelect.onchange = (e) => sendCommand({ action: 'change_school', school: e.target.value });
    
    // Voice command trigger
    elements.voiceBtns.forEach(btn => {
        btn.onclick = () => sendCommand({ action: 'trigger_voice' });
    });

    // Theme swatches
    elements.swatches.forEach(swatch => {
        swatch.onclick = (e) => {
            elements.swatches.forEach(s => s.classList.remove('active'));
            e.target.classList.add('active');
            sendCommand({ action: 'change_theme', theme: e.target.dataset.theme });
        };
    });
}

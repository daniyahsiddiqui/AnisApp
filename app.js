// App Configuration
let config = {
    lat: 51.508515, 
    lng: -0.125487,
    method: parseInt(localStorage.getItem('athanMethod')) || 2, 
    school: parseInt(localStorage.getItem('athanSchool')) || 0,
    locationName: "London, UK",
    theme: localStorage.getItem('theme') || 'gold',
    athanReciter: localStorage.getItem('athanReciter') || 'al-afasy',
    quranReciter: localStorage.getItem('quranReciter') || 'ar.alafasy',
    isMuted: localStorage.getItem('isMuted') === 'true',
    manualAddress: localStorage.getItem('manualAddress') || ''
};

// State
let prayerTimes = {};
let nextPrayer = null;
let countdownInterval = null;

let surahsData = [];          
let currentSurahData = null;  
let isQuranPlaying = false;
let audioQueue = [];
let currentQueueIndex = 0;
let currentAthanAudioType = 'none'; // 'athan', 'dua', or 'none'
let wakeLock = null;

// Voice State
let recognition = null;
let isListening = false;

// DOM Elements & UI Helper
const UI = {
    setText: (selector, text) => document.querySelectorAll(selector).forEach(el => el.textContent = text),
    addClass: (selector, cls) => document.querySelectorAll(selector).forEach(el => el.classList.add(cls)),
    removeClass: (selector, cls) => document.querySelectorAll(selector).forEach(el => el.classList.remove(cls)),
    on: (selector, event, handler) => document.querySelectorAll(selector).forEach(el => el.addEventListener(event, handler))
};

const elements = {
    audio: document.getElementById('athan-audio'),
    settingsModal: document.getElementById('settings-modal'),
    
    // Quran Player elements
    quranAudio: document.getElementById('quran-audio'),
    quranReciterSelect: document.getElementById('quran-reciter-select'),
    quranSurahSelect: document.getElementById('quran-surah-select'),
    quranAyahFrom: document.getElementById('quran-ayah-from'),
    quranAyahTo: document.getElementById('quran-ayah-to'),
    quranAyahRepeat: document.getElementById('quran-ayah-repeat'),
    quranRangeRepeat: document.getElementById('quran-range-repeat'),
    quranPlayPause: document.getElementById('quran-play-pause'),
    quranStop: document.getElementById('quran-stop'),
    quranStatus: document.getElementById('quran-status'),
    
    // Full Screen Quran Elements
    fsView: document.getElementById('fullscreen-quran-view'),
    fsCloseBtn: document.getElementById('fs-close-btn'),
    fsSurahInfo: document.getElementById('fs-surah-info'),
    fsArabicText: document.getElementById('fs-arabic-text'),
    fsPlayPauseBtn: document.getElementById('fs-play-pause-btn'),
    fsStatusText: document.getElementById('fs-status-text'),
    
    unlockOverlay: document.getElementById('unlock-overlay'),
    testAthanBtn: document.getElementById('test-athan-btn'),
    themeSwatches: document.querySelectorAll('.theme-swatch'),
    athanSelect: document.getElementById('athan-reciter-select'),
    quranModal: document.getElementById('quran-modal'),
    
    manualLocationInput: document.getElementById('manual-location-input'),
    saveLocationBtn: document.getElementById('save-location-btn'),
    athanMethodSelect: document.getElementById('athan-method-select'),
    athanSchoolSelect: document.getElementById('athan-school-select'),
    
    remoteModal: document.getElementById('remote-modal'),
    remotePeerId: document.getElementById('remote-peer-id'),
    remoteStatus: document.getElementById('remote-connection-status'),
    remoteLink: document.getElementById('remote-control-link'),
    
    hadithModal: document.getElementById('hadith-modal'),
    closeHadithBtn: document.getElementById('close-hadith-modal'),
    hadithText: document.getElementById('hadith-text'),
    hadithReference: document.getElementById('hadith-reference')
};

// Initialize App
async function init() {
    applyTheme(config.theme);
    updateMuteUI();
    elements.athanSelect.value = config.athanReciter;
    elements.quranReciterSelect.value = config.quranReciter;
    if (elements.athanMethodSelect) elements.athanMethodSelect.value = config.method;
    if (elements.athanSchoolSelect) elements.athanSchoolSelect.value = config.school;
    if (elements.manualLocationInput) elements.manualLocationInput.value = config.manualAddress;
    
    setupEventListeners();
    setupVoiceRecognition();
    
    UI.setText('.location-text', "Detecting Location...");
    updateClock();
    setInterval(updateClock, 1000);
    
    // Do location detection and timing fetch asynchronously without blocking UI or PeerJS registration
    detectLocation()
        .then(() => fetchPrayerTimes())
        .catch(err => console.error("Initial location/time load failed:", err))
        .finally(() => {
            fetchSurahsList();
        });
    
    // Refresh prayer times from API every 12 hours
    setInterval(fetchPrayerTimes, 12 * 60 * 60 * 1000);

    // Request wake lock on startup
    requestWakeLock();
}

function setupEventListeners() {
    UI.on('.settings-btn', 'click', () => elements.settingsModal.classList.add('open'));
    UI.on('#close-settings', 'click', () => elements.settingsModal.classList.remove('open'));
    
    UI.on('.open-quran-btn', 'click', () => elements.quranModal.classList.add('open'));
    UI.on('#close-quran', 'click', () => elements.quranModal.classList.remove('open'));

    UI.on('.remote-btn', 'click', () => {
        if (elements.remoteModal) elements.remoteModal.classList.add('open');
        initPeerServer();
    });
    UI.on('#close-remote', 'click', () => {
        if (elements.remoteModal) elements.remoteModal.classList.remove('open');
    });

    // Hadith Logic
    UI.on('.open-hadith-btn', 'click', () => {
        elements.hadithModal.classList.add('open');
        fetchDailyHadith();
    });
    
    if (elements.closeHadithBtn) {
        elements.closeHadithBtn.addEventListener('click', () => {
            elements.hadithModal.classList.remove('open');
        });
    }

    elements.themeSwatches.forEach(swatch => {
        swatch.addEventListener('click', (e) => {
            applyTheme(e.target.dataset.theme);
        });
    });

    elements.athanSelect.addEventListener('change', (e) => {
        config.athanReciter = e.target.value;
        localStorage.setItem('athanReciter', config.athanReciter);
    });

    if (elements.athanMethodSelect) {
        elements.athanMethodSelect.addEventListener('change', (e) => {
            config.method = parseInt(e.target.value);
            localStorage.setItem('athanMethod', config.method);
            fetchPrayerTimes();
        });
    }

    if (elements.athanSchoolSelect) {
        elements.athanSchoolSelect.addEventListener('change', (e) => {
            config.school = parseInt(e.target.value);
            localStorage.setItem('athanSchool', config.school);
            fetchPrayerTimes();
        });
    }

    // Test Athan Button Logic
    if (elements.testAthanBtn) {
        elements.testAthanBtn.addEventListener('click', () => {
            if (!elements.audio.paused) {
                elements.audio.pause();
                elements.audio.currentTime = 0;
                elements.testAthanBtn.innerHTML = '🔊 Test';
                currentAthanAudioType = 'none';
            } else {
                triggerAthan('Test');
                elements.testAthanBtn.innerHTML = '⏹ Stop';
            }
        });
        elements.audio.addEventListener('ended', () => {
            if (currentAthanAudioType === 'athan') {
                console.log("Adhan finished. Playing Dua after Adhan...");
                currentAthanAudioType = 'dua';
                elements.audio.src = 'https://archive.org/download/adhan.notifications/Dua_after_Adhan.mp3';
                try {
                    const playPromise = elements.audio.play();
                    if (playPromise !== undefined && typeof playPromise.catch === 'function') {
                        playPromise.catch(e => console.error("Dua play blocked by browser", e));
                    }
                } catch (e) {
                    console.error("Dua play blocked by browser", e);
                }
            } else {
                currentAthanAudioType = 'none';
                elements.testAthanBtn.innerHTML = '🔊 Test';
            }
        });
    }
    
    if (elements.saveLocationBtn) {
        elements.saveLocationBtn.addEventListener('click', () => {
            const val = elements.manualLocationInput.value.trim();
            config.manualAddress = val;
            if (val) {
                localStorage.setItem('manualAddress', val);
                UI.setText('.location-text', val);
            } else {
                localStorage.removeItem('manualAddress');
                detectLocation();
            }
            fetchPrayerTimes();
            elements.saveLocationBtn.innerHTML = 'Saved!';
            setTimeout(() => elements.saveLocationBtn.innerHTML = 'Save', 2000);
        });
    }

    elements.quranReciterSelect.addEventListener('change', (e) => {
        config.quranReciter = e.target.value;
        localStorage.setItem('quranReciter', config.quranReciter);
        if(elements.quranSurahSelect.value) {
            loadSurahAudioData(elements.quranSurahSelect.value);
        }
    });

    elements.quranSurahSelect.addEventListener('change', (e) => {
        stopQuran();
        loadSurahAudioData(e.target.value);
    });

    elements.quranAyahFrom.addEventListener('change', () => validateRange());
    elements.quranAyahTo.addEventListener('change', () => validateRange());

    elements.quranPlayPause.addEventListener('click', () => {
        if (isQuranPlaying) pauseQuran();
        else startOrResumeQuran();
    });

    elements.quranStop.addEventListener('click', () => stopQuran());
    elements.quranAudio.addEventListener('ended', playNextInQueue);
    
    UI.on('.voice-cmd-btn', 'click', toggleVoiceRecognition);

    // Full Screen Controls
    elements.fsPlayPauseBtn.addEventListener('click', () => {
        if (isQuranPlaying) pauseQuran();
        else startOrResumeQuran();
    });
    
    elements.fsCloseBtn.addEventListener('click', () => stopQuran());

    // Autoplay Unlocker
    if (elements.unlockOverlay) {
        elements.unlockOverlay.addEventListener('click', () => {
            try {
                const playPromise = elements.audio.play();
                if (playPromise !== undefined && typeof playPromise.then === 'function') {
                    playPromise.then(() => elements.audio.pause()).catch(e => console.log("Unlock athan failed", e));
                } else {
                    elements.audio.pause();
                }
            } catch (e) {
                console.log("Athan play unlock failed:", e);
            }

            try {
                const quranPromise = elements.quranAudio.play();
                if (quranPromise !== undefined && typeof quranPromise.then === 'function') {
                    quranPromise.then(() => elements.quranAudio.pause()).catch(e => console.log("Unlock quran failed", e));
                } else {
                    elements.quranAudio.pause();
                }
            } catch (e) {
                console.log("Quran play unlock failed:", e);
            }

            try {
                requestWakeLock();
            } catch (e) {
                console.log("Wake lock request failed during unlock:", e);
            }

            elements.unlockOverlay.style.opacity = '0';
            setTimeout(() => elements.unlockOverlay.style.display = 'none', 500);
        });
    }
    
    // Mute Logic
    UI.on('.mute-btn', 'click', () => {
        config.isMuted = !config.isMuted;
        localStorage.setItem('isMuted', config.isMuted);
        updateMuteUI();
        
        // If athan is currently playing, pause it
        if (config.isMuted && !elements.audio.paused) {
            elements.audio.pause();
            elements.audio.currentTime = 0;
            currentAthanAudioType = 'none';
            if (elements.testAthanBtn) elements.testAthanBtn.innerHTML = '🔊 Test';
        }
    });
}

function updateMuteUI() {
    const icon = config.isMuted ? '🔇' : '🔊';
    UI.setText('.mute-btn', icon);
}

// --- Voice Recognition Logic ---
function setupVoiceRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        document.querySelectorAll('.voice-cmd-btn').forEach(btn => btn.style.display = 'none');
        return;
    }
    
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.lang = 'en-US';
    recognition.interimResults = false;

    recognition.onstart = function() {
        isListening = true;
        UI.addClass('.voice-cmd-btn', 'listening');
        UI.setText('.voice-status', "Listening...");
    };

    recognition.onresult = async function(event) {
        const transcript = event.results[0][0].transcript.toLowerCase().trim();
        UI.setText('.voice-status', `Heard: "${transcript}"`);
        handleVoiceCommand(transcript);
    };

    recognition.onerror = function(event) {
        UI.setText('.voice-status', `Voice Error: ${event.error}`);
        stopListening();
    };

    recognition.onend = function() {
        stopListening();
    };
}

function toggleVoiceRecognition() {
    if (isListening) stopListening();
    else recognition.start();
}

function stopListening() {
    isListening = false;
    UI.removeClass('.voice-cmd-btn', 'listening');
    if(recognition) recognition.stop();
    setTimeout(() => {
        if(!isListening) UI.setText('.voice-status', "");
    }, 3000);
}

const wordToNum = {
    "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
    "eleven": 11, "twelve": 12, "thirteen": 13, "fourteen": 14, "fifteen": 15, "sixteen": 16, "seventeen": 17, "eighteen": 18, "nineteen": 19, "twenty": 20,
    "thirty": 30, "forty": 40, "fifty": 50, "sixty": 60, "seventy": 70, "eighty": 80, "ninety": 90, "hundred": 100
};

function parseNumber(str) {
    const digitMatch = str.match(/\d+/);
    if (digitMatch) return parseInt(digitMatch[0]);

    let sum = 0;
    const words = str.split(' ');
    for (let word of words) {
        if (wordToNum[word]) sum += wordToNum[word];
    }
    return sum > 0 ? sum : null;
}

async function handleVoiceCommand(cmd) {
    if (cmd.includes("play") && cmd.includes("surah")) {
        let surahNumber = parseNumber(cmd);
        let surahMatch = null;

        if (surahNumber && surahNumber >= 1 && surahNumber <= 114) {
            surahMatch = surahsData.find(s => s.number === surahNumber);
        } else {
            surahMatch = surahsData.find(s => cmd.includes(s.englishName.toLowerCase()) || cmd.includes(s.englishNameTranslation.toLowerCase()));
        }

        if (surahMatch) {
            UI.setText('.voice-status', `Playing Surah ${surahMatch.englishName}`);
            elements.quranSurahSelect.value = surahMatch.number;
            await loadSurahAudioData(surahMatch.number);
            startOrResumeQuran();
        } else {
            UI.setText('.voice-status', `Surah not recognized.`);
        }
    } 
    else if (cmd === "play" || cmd === "play quran" || cmd === "resume") {
        startOrResumeQuran();
    }
    else if (cmd === "pause") {
        pauseQuran();
    }
    else if (cmd === "stop") {
        stopQuran();
    }
    else if (cmd === "next" || cmd === "next ayah") {
        if(isQuranPlaying) playNextInQueue(true);
    }
}

// --- App Logic ---
function applyTheme(themeName) {
    document.body.className = ''; 
    document.body.classList.add(`theme-${themeName}`);
    
    elements.themeSwatches.forEach(swatch => swatch.classList.remove('active'));
    const activeSwatch = document.querySelector(`.theme-swatch[data-theme="${themeName}"]`);
    if(activeSwatch) activeSwatch.classList.add('active');
    
    config.theme = themeName;
    localStorage.setItem('theme', themeName);
}

// --- Daily Hadith Logic ---
async function fetchDailyHadith() {
    const today = new Date().toISOString().split('T')[0];
    const cachedDate = localStorage.getItem('hadithDate');
    const cachedHadith = localStorage.getItem('hadithText');
    const cachedRef = localStorage.getItem('hadithRef');

    if (cachedDate === today && cachedHadith) {
        elements.hadithText.innerText = cachedHadith;
        elements.hadithReference.innerText = cachedRef;
        return;
    }

    elements.hadithText.innerText = "Loading today's Hadith...";
    elements.hadithReference.innerText = "Sahih al-Bukhari";

    try {
        const randomNum = Math.floor(Math.random() * 7000) + 1;
        const response = await fetch(`https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/eng-bukhari/${randomNum}.json`);
        const data = await response.json();

        if (data && data.hadiths && data.hadiths.length > 0) {
            const hadith = data.hadiths[0];
            elements.hadithText.innerText = hadith.text;
            const refText = `Sahih al-Bukhari ${hadith.hadithnumber}`;
            elements.hadithReference.innerText = refText;

            localStorage.setItem('hadithDate', today);
            localStorage.setItem('hadithText', hadith.text);
            localStorage.setItem('hadithRef', refText);
        } else {
            elements.hadithText.innerText = "Could not fetch Hadith. Please try again later.";
        }
    } catch (e) {
        console.error("Failed to fetch hadith", e);
        elements.hadithText.innerText = "Could not connect to the Hadith database. Please check your internet connection.";
    }
}

async function detectLocation() {
    if (config.manualAddress) {
        UI.setText('.location-text', config.manualAddress);
        return;
    }
    
    // Attempt 1: ipapi.co
    try {
        console.log("Trying geolocation via ipapi.co...");
        const response = await fetch('https://ipapi.co/json/');
        if (response.ok) {
            const data = await response.json();
            if (data && data.latitude && data.longitude) {
                config.lat = data.latitude;
                config.lng = data.longitude;
                config.locationName = `${data.city}, ${data.country_name}`;
                UI.setText('.location-text', config.locationName);
                console.log("Geolocation succeeded via ipapi.co:", config.locationName);
                return;
            }
        }
    } catch (error) {
        console.warn("ipapi.co failed, trying fallback...", error);
    }
    
    // Attempt 2: ip-api.com
    try {
        console.log("Trying geolocation via ip-api.com...");
        const response = await fetch('https://ip-api.com/json/');
        if (response.ok) {
            const data = await response.json();
            if (data && data.lat && data.lon) {
                config.lat = data.lat;
                config.lng = data.lon;
                config.locationName = `${data.city}, ${data.country}`;
                UI.setText('.location-text', config.locationName);
                console.log("Geolocation succeeded via ip-api.com:", config.locationName);
                return;
            }
        }
    } catch (error) {
        console.warn("ip-api.com failed, trying fallback...", error);
    }

    // Attempt 3: ipinfo.io
    try {
        console.log("Trying geolocation via ipinfo.io...");
        const response = await fetch('https://ipinfo.io/json');
        if (response.ok) {
            const data = await response.json();
            if (data && data.loc) {
                const parts = data.loc.split(',');
                config.lat = parseFloat(parts[0]);
                config.lng = parseFloat(parts[1]);
                config.locationName = `${data.city}, ${data.country}`;
                UI.setText('.location-text', config.locationName);
                console.log("Geolocation succeeded via ipinfo.io:", config.locationName);
                return;
            }
        }
    } catch (error) {
        console.warn("ipinfo.io failed.", error);
    }

    // Default fallback
    console.warn("All geolocation APIs failed. Using default location.");
    UI.setText('.location-text', config.locationName);
}

function updateClock() {
    const now = new Date();
    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    
    hours = hours % 12;
    hours = hours ? hours : 12; 
    
    UI.setText('.current-time', `${hours}:${minutes}`);
    UI.setText('.current-seconds', seconds);
    UI.setText('.am-pm', ampm);
}

async function fetchPrayerTimes() {
    const date = new Date();
    const timestamp = Math.floor(date.getTime() / 1000);
    
    let apiUrl = '';
    if (config.manualAddress) {
        apiUrl = `https://api.aladhan.com/v1/timingsByAddress/${timestamp}?address=${encodeURIComponent(config.manualAddress)}&method=${config.method}&school=${config.school}`;
    } else {
        apiUrl = `https://api.aladhan.com/v1/timings/${timestamp}?latitude=${config.lat}&longitude=${config.lng}&method=${config.method}&school=${config.school}`;
    }
    
    try {
        const response = await fetch(apiUrl);
        const data = await response.json();
        
        if (data.code === 200) {
            prayerTimes = data.data.timings;
            UI.setText('.gregorian-date', data.data.date.readable);
            UI.setText('.hijri-date', `${data.data.date.hijri.day} ${data.data.date.hijri.month.en} ${data.data.date.hijri.year}`);
            updatePrayerTimesUI();
            calculateNextPrayer();
        }
    } catch (error) {
        console.error("Failed to fetch prayer times", error);
        UI.setText('.location-text', "Error loading data");
    }
}

function formatTime(timeStr) {
    const [h, m] = timeStr.split(':');
    let hours = parseInt(h);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${hours}:${m} ${ampm}`;
}

function updatePrayerTimesUI() {
    const targetPrayers = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
    targetPrayers.forEach(prayer => {
        if (prayerTimes[prayer]) {
            UI.setText(`.time-${prayer.toLowerCase()}`, formatTime(prayerTimes[prayer]));
        }
    });
}

function calculateNextPrayer() {
    const now = new Date();
    const targetPrayers = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
    
    let upcomingPrayer = null;
    let upcomingTime = null;

    for (const prayer of targetPrayers) {
        const [hours, minutes] = prayerTimes[prayer].split(':');
        const prayerDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0);
        
        if (prayerDate > now) {
            upcomingPrayer = prayer;
            upcomingTime = prayerDate;
            break;
        }
    }

    if (!upcomingPrayer) {
        upcomingPrayer = 'Fajr';
        const [hours, minutes] = prayerTimes['Fajr'].split(':');
        upcomingTime = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, hours, minutes, 0);
    }

    nextPrayer = { name: upcomingPrayer, time: upcomingTime };
    UI.setText('.next-prayer-name', upcomingPrayer);
    
    UI.removeClass('.prayer-card', 'active');
    UI.removeClass('.joy-prayer-item', 'active');
    UI.addClass(`.card-${upcomingPrayer.toLowerCase()}`, 'active');

    startCountdown();
}

function startCountdown() {
    if (countdownInterval) clearInterval(countdownInterval);
    
    countdownInterval = setInterval(() => {
        const now = new Date();
        const diff = nextPrayer.time - now;
        
        if (diff <= 0) {
            clearInterval(countdownInterval);
            UI.setText('.countdown-timer', "00:00:00");
            triggerAthan(nextPrayer.name);
            
            setTimeout(calculateNextPrayer, 2000); 
            return;
        }
        
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        
        UI.setText('.countdown-timer', `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);
            
    }, 1000);
}

const adhanUrls = {
    'al-afasy': 'https://raw.githubusercontent.com/abodehq/Athan-MP3/master/Sounds/Athan%20Mishary%20Alafasi.mp3',
    'makkah': 'https://raw.githubusercontent.com/abodehq/Athan-MP3/master/Sounds/Athan%20Makkah.mp3',
    'abdul-basit': 'https://raw.githubusercontent.com/abodehq/Athan-MP3/master/Sounds/Athan%20Abdul-Basit.mp3',
    'al-qatami': 'https://raw.githubusercontent.com/abodehq/Athan-MP3/master/Sounds/Athan%20Nasser%20Alqatami.mp3'
};

const fajrAdhanUrls = {
    'al-afasy': 'https://archive.org/download/adhan.notifications/Mishary_Rashid_al_Afasy_Fajr_Adhan.mp3',
    'makkah': 'https://raw.githubusercontent.com/abodehq/Athan-MP3/master/Sounds/Athan%20Al-fajer%20-%20Malek%20chebae.mp3',
    'abdul-basit': 'https://raw.githubusercontent.com/abodehq/Athan-MP3/master/Sounds/Athan%20Al-fajer%20-%20Malek%20chebae.mp3',
    'al-qatami': 'https://raw.githubusercontent.com/abodehq/Athan-MP3/master/Sounds/Athan%20Al-fajer%20-%20Malek%20chebae.mp3'
};

function triggerAthan(prayerName) {
    if (prayerName !== 'Sunrise') {
        if (!config.isMuted || prayerName === 'Test') {
            let url;
            if (prayerName === 'Fajr') {
                url = fajrAdhanUrls[config.athanReciter] || fajrAdhanUrls['al-afasy'];
            } else {
                url = adhanUrls[config.athanReciter] || adhanUrls['al-afasy'];
            }
            elements.audio.src = url;
            currentAthanAudioType = 'athan';
            try {
                const playPromise = elements.audio.play();
                if (playPromise !== undefined && typeof playPromise.catch === 'function') {
                    playPromise.catch(e => console.error("Audio play blocked by browser. User must tap the screen to unlock autoplay first.", e));
                }
            } catch (e) {
                console.error("Audio play blocked by browser. User must tap the screen to unlock autoplay first.", e);
            }
        }
    }
}

// --- Quran Player Logic ---
async function fetchSurahsList() {
    try {
        const response = await fetch('https://api.alquran.cloud/v1/surah');
        const data = await response.json();
        if (data.code === 200) {
            surahsData = data.data;
            let optionsHtml = '<option value="">Select a Surah...</option>';
            surahsData.forEach(surah => {
                optionsHtml += `<option value="${surah.number}">${surah.number}. ${surah.englishName} (${surah.name})</option>`;
            });
            elements.quranSurahSelect.innerHTML = optionsHtml;
        }
    } catch (e) {
        console.error("Failed to load surahs list", e);
    }
}

async function loadSurahAudioData(surahNumber) {
    if (!surahNumber) {
        disableQuranUI();
        return;
    }

    elements.quranStatus.textContent = "Fetching audio data...";
    disableQuranUI();

    try {
        const response = await fetch(`https://api.alquran.cloud/v1/surah/${surahNumber}/${config.quranReciter}`);
        const data = await response.json();
        
        if (data.code === 200) {
            currentSurahData = data.data;
            populateAyahDropdowns(currentSurahData.numberOfAyahs);
            elements.quranStatus.textContent = "Ready";
            elements.quranPlayPause.disabled = false;
            elements.quranAyahFrom.disabled = false;
            elements.quranAyahTo.disabled = false;
        } else {
            elements.quranStatus.textContent = "Audio unavailable for this reciter.";
        }
    } catch (e) {
        console.error("Failed to load full surah", e);
        elements.quranStatus.textContent = "Error loading audio.";
    }
}

function disableQuranUI() {
    elements.quranAyahFrom.disabled = true;
    elements.quranAyahTo.disabled = true;
    elements.quranPlayPause.disabled = true;
}

function populateAyahDropdowns(totalAyahs) {
    let optionsHtml = '';
    for (let i = 1; i <= totalAyahs; i++) {
        optionsHtml += `<option value="${i}">Ayah ${i}</option>`;
    }
    
    elements.quranAyahFrom.innerHTML = optionsHtml;
    elements.quranAyahTo.innerHTML = optionsHtml;
    
    elements.quranAyahFrom.value = 1;
    elements.quranAyahTo.value = totalAyahs;
}

function validateRange() {
    let from = parseInt(elements.quranAyahFrom.value);
    let to = parseInt(elements.quranAyahTo.value);
    if (from > to) elements.quranAyahTo.value = from; 
}

function buildAudioQueue() {
    if (!currentSurahData) return [];
    
    let from = parseInt(elements.quranAyahFrom.value) || 1;
    let to = parseInt(elements.quranAyahTo.value) || currentSurahData.numberOfAyahs;
    let ayahRep = parseInt(elements.quranAyahRepeat.value) || 1;
    let rangeRep = parseInt(elements.quranRangeRepeat.value) || 1;
    
    let queue = [];
    if(ayahRep > 100) ayahRep = 100;
    if(rangeRep > 100) rangeRep = 100;
    
    for (let r = 0; r < rangeRep; r++) {
        if (from === 1 && currentSurahData.number !== 1 && currentSurahData.number !== 9) {
            const sampleAudio = currentSurahData.ayahs[0].audio;
            const bismillahUrl = sampleAudio.substring(0, sampleAudio.lastIndexOf('/') + 1) + '1.mp3';

            queue.push({
                url: bismillahUrl,
                text: 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ', 
                ayahNum: 'Bismillah',
                ayahRepIdx: 1,
                ayahRepTotal: 1,
                rangeRepIdx: r + 1,
                rangeRepTotal: rangeRep
            });
        }

        for (let i = from; i <= to; i++) {
            for (let a = 0; a < ayahRep; a++) {
                let ayahText = currentSurahData.ayahs[i - 1].text;
                
                if (i === 1 && currentSurahData.number !== 1 && currentSurahData.number !== 9) {
                    let parts = ayahText.split(' ');
                    if (parts.length >= 5 && parts[0].indexOf('س') !== -1 && parts[1].indexOf('لل') !== -1) {
                        ayahText = parts.slice(4).join(' ');
                    }
                }

                queue.push({
                    url: currentSurahData.ayahs[i - 1].audio,
                    text: ayahText, 
                    ayahNum: i,
                    ayahRepIdx: a + 1,
                    ayahRepTotal: ayahRep,
                    rangeRepIdx: r + 1,
                    rangeRepTotal: rangeRep
                });
            }
        }
    }
    return queue;
}

function startOrResumeQuran() {
    if (!elements.quranSurahSelect.value) return;

    if (audioQueue.length === 0 || currentQueueIndex === 0) {
        audioQueue = buildAudioQueue();
        currentQueueIndex = 0;
    }
    
    if (audioQueue.length === 0) return;

    elements.quranModal.classList.remove('open');
    elements.fsView.classList.add('active');

    isQuranPlaying = true;
    elements.quranPlayPause.innerHTML = '⏸ Pause';
    elements.fsPlayPauseBtn.innerHTML = '⏸';
    
    if (elements.quranAudio.src && elements.quranAudio.paused && elements.quranAudio.currentTime > 0 && currentQueueIndex < audioQueue.length) {
        try {
            elements.quranAudio.play();
        } catch (e) {
            console.error("Resume play failed:", e);
        }
        updateStatusText();
    } else {
        playNextInQueue(false); 
    }
}

function playNextInQueue(increment = true) {
    if (increment && isQuranPlaying) {
        currentQueueIndex++;
    }

    if (currentQueueIndex >= audioQueue.length) {
        stopQuran();
        return;
    }

    const currentItem = audioQueue[currentQueueIndex];
    elements.quranAudio.src = currentItem.url;
    
    try {
        const playPromise = elements.quranAudio.play();
        const handleSuccess = () => {
            updateStatusText();
            elements.fsArabicText.textContent = currentItem.text;
            elements.fsSurahInfo.textContent = `${currentSurahData.englishName} - Ayah ${currentItem.ayahNum}`;
        };
        const handleFailure = (e) => {
            console.error("Playback failed", e);
            elements.fsStatusText.textContent = "Playback error";
            elements.quranStatus.textContent = "Playback error";
            stopQuran();
        };

        if (playPromise !== undefined && typeof playPromise.then === 'function') {
            playPromise.then(handleSuccess).catch(handleFailure);
        } else {
            handleSuccess();
        }
    } catch (e) {
        console.error("Synchronous playback error:", e);
        elements.fsStatusText.textContent = "Playback error";
        elements.quranStatus.textContent = "Playback error";
        stopQuran();
    }
}

function updateStatusText() {
    if (currentQueueIndex >= audioQueue.length) return;
    const item = audioQueue[currentQueueIndex];
    
    let status = `Ayah ${item.ayahNum}`;
    if (item.ayahRepTotal > 1) {
        status += ` (Repeat ${item.ayahRepIdx}/${item.ayahRepTotal})`;
    }
    if (item.rangeRepTotal > 1) {
        status += ` - Range Loop: ${item.rangeRepIdx}/${item.rangeRepTotal}`;
    }
    
    elements.quranStatus.textContent = status;
    elements.fsStatusText.textContent = status;
}

function pauseQuran() {
    elements.quranAudio.pause();
    isQuranPlaying = false;
    elements.quranPlayPause.innerHTML = '▶️ Play';
    elements.fsPlayPauseBtn.innerHTML = '▶️';
    elements.quranStatus.textContent = "Paused";
    elements.fsStatusText.textContent = "Paused";
}

function stopQuran() {
    elements.quranAudio.pause();
    elements.quranAudio.currentTime = 0;
    isQuranPlaying = false;
    audioQueue = [];
    currentQueueIndex = 0;
    elements.quranPlayPause.innerHTML = '▶️ Play';
    elements.fsPlayPauseBtn.innerHTML = '▶️';
    
    elements.fsArabicText.textContent = ''; 
    elements.fsView.classList.remove('active');

    if(currentSurahData) {
        elements.quranStatus.textContent = "Ready";
    }
}

// --- MQTT Remote Control Logic (Speaker Side) ---
let mqttClient = null;
let lastPingTime = 0;
let pingCheckInterval = null;

function initPeerServer() {
    if (mqttClient) return; // Already initialized

    // Generate a simple 5-digit number to make it easy to type on mobile
    const randCode = Math.floor(10000 + Math.random() * 90000);
    const shortId = String(randCode);
    
    if (elements.remotePeerId) elements.remotePeerId.textContent = "Connecting...";

    console.log("Connecting to MQTT Broker (broker.emqx.io)...");
    mqttClient = mqtt.connect('wss://broker.emqx.io:8084/mqtt', {
        clientId: 'athan_speaker_' + shortId,
        clean: true,
        connectTimeout: 4000,
        reconnectPeriod: 2000
    });

    mqttClient.on('connect', () => {
        console.log("MQTT Connected! Listening on ID: " + shortId);
        if (elements.remotePeerId) elements.remotePeerId.textContent = shortId;
        
        // Generate remote control link dynamically
        const currentUrl = window.location.href.split('?')[0].split('#')[0];
        const baseUrl = currentUrl.endsWith('index.html') ? currentUrl.replace('index.html', '') : currentUrl;
        const remoteUrl = `${baseUrl}remote.html?id=${shortId}`;
        
        if (elements.remoteLink) {
            elements.remoteLink.href = remoteUrl;
        }

        // Subscribe to commands and ping topics
        mqttClient.subscribe(`anisapp/athan/${shortId}/command`);
        mqttClient.subscribe(`anisapp/athan/${shortId}/ping`);

        // Send waiting status
        mqttClient.publish(`anisapp/athan/${shortId}/status`, JSON.stringify({ state: 'waiting' }), { retain: true });
        updateRemoteStatus(false);
    });

    mqttClient.on('message', (topic, message) => {
        let payload;
        try {
            payload = JSON.parse(message.toString());
        } catch (e) {
            console.error("Failed to parse MQTT message:", e);
            return;
        }

        if (topic.endsWith('/ping')) {
            if (Date.now() - lastPingTime > 4000) {
                console.log("Remote phone connected via MQTT.");
            }
            lastPingTime = Date.now();
            updateRemoteStatus(true);
            mqttClient.publish(`anisapp/athan/${shortId}/status`, JSON.stringify({ state: 'connected' }));
        } else if (topic.endsWith('/command')) {
            console.log("Received remote command:", payload);
            handleRemoteCommand(payload);
        }
    });

    mqttClient.on('error', (err) => {
        console.error("MQTT Broker Error:", err);
        if (elements.remotePeerId) elements.remotePeerId.textContent = "Failed (Retry)";
    });

    mqttClient.on('close', () => {
        console.log("MQTT Connection Closed");
        updateRemoteStatus(false);
    });

    // Periodically check if we still receive pings from the phone
    if (pingCheckInterval) clearInterval(pingCheckInterval);
    pingCheckInterval = setInterval(() => {
        if (Date.now() - lastPingTime > 6000) {
            if (lastPingTime !== 0) {
                console.log("Remote phone disconnected.");
                lastPingTime = 0;
            }
            updateRemoteStatus(false);
        }
    }, 2000);
}

function updateRemoteStatus(connected) {
    if (elements.remoteStatus) {
        if (connected) {
            elements.remoteStatus.innerHTML = "🟢 Connected to Phone";
            elements.remoteStatus.style.color = "#22c55e";
        } else {
            elements.remoteStatus.innerHTML = "🔴 Not Connected";
            elements.remoteStatus.style.color = "#ef4444";
        }
    }
}

function handleRemoteCommand(data) {
    if (!data || !data.action) return;
    
    switch (data.action) {
        case 'test_athan':
            if (elements.testAthanBtn) {
                elements.testAthanBtn.click();
            }
            break;
            
        case 'toggle_mute':
            // Toggle config.isMuted
            config.isMuted = !config.isMuted;
            localStorage.setItem('isMuted', config.isMuted);
            updateMuteUI();
            
            // Apply immediately to playing audio
            if (config.isMuted && !elements.audio.paused) {
                elements.audio.pause();
                elements.audio.currentTime = 0;
                if (elements.testAthanBtn) elements.testAthanBtn.innerHTML = '🔊 Test';
            }
            break;
            
        case 'play_quran':
            if (data.surah) {
                stopQuran();
                
                if (data.reciter) {
                    config.quranReciter = data.reciter;
                    localStorage.setItem('quranReciter', config.quranReciter);
                    if (elements.quranReciterSelect) {
                        elements.quranReciterSelect.value = data.reciter;
                    }
                }
                
                elements.quranSurahSelect.value = data.surah;
                elements.quranStatus.textContent = "Loading remote surah...";
                
                loadSurahAudioData(data.surah).then(() => {
                    if (data.fromAyah && elements.quranAyahFrom) {
                        elements.quranAyahFrom.value = data.fromAyah;
                    }
                    if (data.toAyah && elements.quranAyahTo) {
                        elements.quranAyahTo.value = data.toAyah;
                    }
                    if (data.ayahRepeat && elements.quranAyahRepeat) {
                        elements.quranAyahRepeat.value = data.ayahRepeat;
                    }
                    if (data.rangeRepeat && elements.quranRangeRepeat) {
                        elements.quranRangeRepeat.value = data.rangeRepeat;
                    }
                    
                    startOrResumeQuran();
                }).catch(e => {
                    console.error("Failed to play remote Quran", e);
                    elements.quranStatus.textContent = "Failed to load audio";
                });
            }
            break;
            
        case 'stop_quran':
            stopQuran();
            break;
            
        case 'change_theme':
            if (data.theme) {
                applyTheme(data.theme);
            }
            break;
            
        case 'trigger_voice':
            const micBtn = document.querySelector('.voice-cmd-btn');
            if (micBtn) {
                micBtn.click();
            }
            break;
            
        case 'change_method':
            if (data.method) {
                config.method = parseInt(data.method);
                localStorage.setItem('athanMethod', config.method);
                if (elements.athanMethodSelect) elements.athanMethodSelect.value = config.method;
                fetchPrayerTimes();
            }
            break;
            
        case 'change_school':
            if (data.school !== undefined) {
                config.school = parseInt(data.school);
                localStorage.setItem('athanSchool', config.school);
                if (elements.athanSchoolSelect) elements.athanSchoolSelect.value = config.school;
                fetchPrayerTimes();
            }
            break;
            
        default:
            console.warn('Unknown remote action:', data.action);
    }
}

// --- Screen Wake Lock Helper ---
async function requestWakeLock() {
    if (!('wakeLock' in navigator)) {
        console.log('Screen Wake Lock API is not supported in this browser.');
        return;
    }
    try {
        wakeLock = await navigator.wakeLock.request('screen');
        console.log('Wake Lock acquired successfully.');
        wakeLock.addEventListener('release', () => {
            console.log('Wake Lock was released.');
        });
    } catch (err) {
        console.error(`Failed to acquire Wake Lock: ${err.name}, ${err.message}`);
    }
}

// Re-request wake lock when page becomes visible
document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible') {
        await requestWakeLock();
    }
});

// Start app
init();

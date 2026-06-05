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
    manualAddress: localStorage.getItem('manualAddress') || '',
    takbeeratDuration: localStorage.getItem('takbeeratDuration') || '5',
    autoMorningAzkar: localStorage.getItem('autoMorningAzkar') === 'true',
    morningAzkarTime: localStorage.getItem('morningAzkarTime') || '07:00',
    autoEveningAzkar: localStorage.getItem('autoEveningAzkar') === 'true',
    eveningAzkarMode: localStorage.getItem('eveningAzkarMode') || 'asr_offset',
    eveningAzkarTime: localStorage.getItem('eveningAzkarTime') || '18:00',
    buttonLayout: (localStorage.getItem('buttonLayout') === 'pill_dock' ? 'pill-dock' : (localStorage.getItem('buttonLayout') || 'categorized')),
    weatherUnit: localStorage.getItem('weatherUnit') || 'fahrenheit',
    volumeAthan: parseInt(localStorage.getItem('volumeAthan')) !== undefined && localStorage.getItem('volumeAthan') !== null ? parseInt(localStorage.getItem('volumeAthan')) : 80,
    volumeMedia: parseInt(localStorage.getItem('volumeMedia')) !== undefined && localStorage.getItem('volumeMedia') !== null ? parseInt(localStorage.getItem('volumeMedia')) : 80,
    iqamahOffsets: JSON.parse(localStorage.getItem('iqamahOffsets')) || { Fajr: 15, Dhuhr: 10, Asr: 10, Maghrib: 5, Isha: 10 }
};

// Iqamah countdown state
let activeIqamahCountdown = null;
let activeIqamahTimer = null;

// State
let prayerTimes = {};
let nextPrayer = null;
let countdownInterval = null;

let surahsData = [];          
let currentSurahData = null;  
let isQuranPlaying = false;
let audioQueue = [];
let currentQueueIndex = 0;
let currentAthanAudioType = 'none'; // 'none', 'athan', 'dua', or 'takbeerat'
let wakeLock = null;
let hijriDateInfo = null;

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
    remoteQrCode: document.getElementById('remote-qr-code'),
    remoteQrLoading: document.getElementById('remote-qr-loading'),
    remoteLocalhostWarning: document.getElementById('remote-localhost-warning'),
    
    weatherWidget: document.getElementById('weather-widget'),
    weatherIcon: document.getElementById('weather-icon'),
    weatherTemp: document.getElementById('weather-temp'),
    joyWeatherWidget: document.getElementById('joy-weather-widget'),
    joyWeatherIcon: document.getElementById('joy-weather-icon'),
    joyWeatherTemp: document.getElementById('joy-weather-temp'),
    weatherUnitSelect: document.getElementById('weather-unit-select'),
    
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
    
    const takbeeratDurationSelect = document.getElementById('takbeerat-duration-select');
    if (takbeeratDurationSelect) takbeeratDurationSelect.value = config.takbeeratDuration;

    // Initialize Azkar Auto-Play UI elements
    const autoMorningAzkarCheckbox = document.getElementById('auto-morning-azkar');
    const morningAzkarTimeInput = document.getElementById('morning-azkar-time');
    const autoEveningAzkarCheckbox = document.getElementById('auto-evening-azkar');
    const eveningAzkarModeAsrRadio = document.getElementById('evening-azkar-mode-asr');
    const eveningAzkarModeCustomRadio = document.getElementById('evening-azkar-mode-custom');
    const eveningAzkarTimeInput = document.getElementById('evening-azkar-time');

    if (autoMorningAzkarCheckbox) autoMorningAzkarCheckbox.checked = config.autoMorningAzkar;
    if (morningAzkarTimeInput) morningAzkarTimeInput.value = config.morningAzkarTime;
    if (autoEveningAzkarCheckbox) autoEveningAzkarCheckbox.checked = config.autoEveningAzkar;
    if (config.eveningAzkarMode === 'asr_offset') {
        if (eveningAzkarModeAsrRadio) eveningAzkarModeAsrRadio.checked = true;
        if (eveningAzkarTimeInput) eveningAzkarTimeInput.disabled = true;
    } else {
        if (eveningAzkarModeCustomRadio) eveningAzkarModeCustomRadio.checked = true;
        if (eveningAzkarTimeInput) eveningAzkarTimeInput.disabled = false;
    }
    if (eveningAzkarTimeInput) eveningAzkarTimeInput.value = config.eveningAzkarTime;
    
    const buttonLayoutSelect = document.getElementById('button-layout-select');
    if (buttonLayoutSelect) buttonLayoutSelect.value = config.buttonLayout;
    applyButtonLayoutTheme(config.buttonLayout);

    if (elements.weatherUnitSelect) elements.weatherUnitSelect.value = config.weatherUnit;
    setInterval(fetchWeather, 30 * 60 * 1000);
    
    // Initialize volume values
    const athanVolSlider = document.getElementById('volume-athan-slider');
    const athanVolVal = document.getElementById('volume-athan-value');
    const mediaVolSlider = document.getElementById('volume-media-slider');
    const mediaVolVal = document.getElementById('volume-media-value');
    if (athanVolSlider && athanVolVal) {
        athanVolSlider.value = config.volumeAthan;
        athanVolVal.textContent = `${config.volumeAthan}%`;
        elements.audio.volume = config.volumeAthan / 100;
    }
    if (mediaVolSlider && mediaVolVal) {
        mediaVolSlider.value = config.volumeMedia;
        mediaVolVal.textContent = `${config.volumeMedia}%`;
        elements.quranAudio.volume = config.volumeMedia / 100;
    }

    // Initialize Iqamah offsets dropdown values
    ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'].forEach(p => {
        const select = document.getElementById(`iqamah-offset-${p}`);
        if (select) {
            const key = p.charAt(0).toUpperCase() + p.slice(1);
            select.value = config.iqamahOffsets[key] || (key === 'Fajr' ? 15 : (key === 'Maghrib' ? 5 : 10));
        }
    });

    setupEventListeners();
    setupVoiceRecognition();
    
    UI.setText('.location-text', "Detecting Location...");
    updateClock();
    setInterval(updateClock, 1000);
    
    // Display Daily Reminder Board content on card
    updateDailyRemindersCard();

    // Check banners
    checkFridayReminders();
    
    // Load quick stats counters
    updateQuickStatsUI();

    // Do location detection and timing fetch asynchronously without blocking UI or PeerJS registration
    detectLocation()
        .then(() => fetchPrayerTimes())
        .catch(err => console.error("Initial location/time load failed:", err))
        .finally(() => {
            fetchSurahsList();
            checkHolidayCountdown();
        });
    
    // Refresh prayer times from API every 12 hours
    setInterval(fetchPrayerTimes, 12 * 60 * 60 * 1000);

    // Request wake lock on startup
    requestWakeLock();
}

function setupEventListeners() {
    UI.on('.settings-btn', 'click', () => elements.settingsModal.classList.add('open'));
    UI.on('#close-settings', 'click', () => elements.settingsModal.classList.remove('open'));
    
    UI.on('.quran-trigger-btn', 'click', () => elements.quranModal.classList.add('open'));
    UI.on('#close-quran', 'click', () => elements.quranModal.classList.remove('open'));

    UI.on('.remote-btn', 'click', () => {
        if (elements.remoteModal) elements.remoteModal.classList.add('open');
        initPeerServer();
    });
    UI.on('#close-remote', 'click', () => {
        if (elements.remoteModal) elements.remoteModal.classList.remove('open');
    });

    // Azkar Play/Stop Click Listeners
    const handleMorningAzkarClick = () => {
        if (currentAthanAudioType === 'morning_azkar') {
            stopAzkar();
        } else {
            playAzkar('morning');
        }
    };
    UI.on('.azkar-morning-trigger-btn', 'click', handleMorningAzkarClick);

    const handleEveningAzkarClick = () => {
        if (currentAthanAudioType === 'evening_azkar') {
            stopAzkar();
        } else {
            playAzkar('evening');
        }
    };
    UI.on('.azkar-evening-trigger-btn', 'click', handleEveningAzkarClick);

    // Azkar Setting change listeners
    const autoMorningAzkarCheckbox = document.getElementById('auto-morning-azkar');
    if (autoMorningAzkarCheckbox) {
        autoMorningAzkarCheckbox.addEventListener('change', (e) => {
            config.autoMorningAzkar = e.target.checked;
            localStorage.setItem('autoMorningAzkar', config.autoMorningAzkar);
        });
    }

    const morningAzkarTimeInput = document.getElementById('morning-azkar-time');
    if (morningAzkarTimeInput) {
        morningAzkarTimeInput.addEventListener('change', (e) => {
            config.morningAzkarTime = e.target.value;
            localStorage.setItem('morningAzkarTime', config.morningAzkarTime);
        });
    }

    const autoEveningAzkarCheckbox = document.getElementById('auto-evening-azkar');
    if (autoEveningAzkarCheckbox) {
        autoEveningAzkarCheckbox.addEventListener('change', (e) => {
            config.autoEveningAzkar = e.target.checked;
            localStorage.setItem('autoEveningAzkar', config.autoEveningAzkar);
        });
    }

    const eveningAzkarModeAsrRadio = document.getElementById('evening-azkar-mode-asr');
    const eveningAzkarModeCustomRadio = document.getElementById('evening-azkar-mode-custom');
    const eveningAzkarTimeInput = document.getElementById('evening-azkar-time');

    if (eveningAzkarModeAsrRadio && eveningAzkarModeCustomRadio && eveningAzkarTimeInput) {
        eveningAzkarModeAsrRadio.addEventListener('change', () => {
            if (eveningAzkarModeAsrRadio.checked) {
                config.eveningAzkarMode = 'asr_offset';
                localStorage.setItem('eveningAzkarMode', config.eveningAzkarMode);
                eveningAzkarTimeInput.disabled = true;
            }
        });
        eveningAzkarModeCustomRadio.addEventListener('change', () => {
            if (eveningAzkarModeCustomRadio.checked) {
                config.eveningAzkarMode = 'custom';
                localStorage.setItem('eveningAzkarMode', config.eveningAzkarMode);
                eveningAzkarTimeInput.disabled = false;
            }
        });
        eveningAzkarTimeInput.addEventListener('change', (e) => {
            config.eveningAzkarTime = e.target.value;
            localStorage.setItem('eveningAzkarTime', config.eveningAzkarTime);
        });
    }

    // Takbeerat Logic
    const handleTakbeeratClick = () => {
        if (currentAthanAudioType === 'takbeerat') {
            stopTakbeerat();
        } else {
            playTakbeerat();
        }
    };
    UI.on('.takbeerat-trigger-btn', 'click', handleTakbeeratClick);

    const takbeeratDurationSelect = document.getElementById('takbeerat-duration-select');
    if (takbeeratDurationSelect) {
        takbeeratDurationSelect.addEventListener('change', (e) => {
            config.takbeeratDuration = e.target.value;
            localStorage.setItem('takbeeratDuration', config.takbeeratDuration);
        });
    }

    // Hadith Logic
    UI.on('.hadith-trigger-btn', 'click', () => {
        elements.hadithModal.classList.add('open');
        fetchDailyHadith();
    });
    
    // play-kahf-btn Friday Surah Al-Kahf triggers
    UI.on('.play-kahf-btn', 'click', async () => {
        elements.quranSurahSelect.value = "18"; // Set dropdown value to 18
        elements.quranSurahSelect.dispatchEvent(new Event('change')); // Trigger change listener
        audioQueue = []; // Clear current queue to force rebuild
        currentQueueIndex = 0; // Reset index
        await loadSurahAudioData(18);
        startOrResumeQuran();
    });

    if (elements.closeHadithBtn) {
        elements.closeHadithBtn.addEventListener('click', () => {
            elements.hadithModal.classList.remove('open');
        });
    }

    // Qibla Modal Triggers
    UI.on('.qibla-btn', 'click', () => {
        const modal = document.getElementById('qibla-modal');
        if (modal) {
            modal.classList.add('open');
            updateQiblaCompass();
        }
    });
    
    const closeQiblaBtn = document.getElementById('close-qibla-modal');
    if (closeQiblaBtn) {
        closeQiblaBtn.addEventListener('click', () => {
            const modal = document.getElementById('qibla-modal');
            if (modal) modal.classList.remove('open');
        });
    }

    // Audio Volume Sliders listeners
    const athanVolSlider = document.getElementById('volume-athan-slider');
    const athanVolVal = document.getElementById('volume-athan-value');
    if (athanVolSlider && athanVolVal) {
        athanVolSlider.addEventListener('input', (e) => {
            const val = e.target.value;
            config.volumeAthan = parseInt(val);
            localStorage.setItem('volumeAthan', config.volumeAthan);
            athanVolVal.textContent = `${val}%`;
            elements.audio.volume = val / 100;
        });
    }

    const mediaVolSlider = document.getElementById('volume-media-slider');
    const mediaVolVal = document.getElementById('volume-media-value');
    if (mediaVolSlider && mediaVolVal) {
        mediaVolSlider.addEventListener('input', (e) => {
            const val = e.target.value;
            config.volumeMedia = parseInt(val);
            localStorage.setItem('volumeMedia', config.volumeMedia);
            mediaVolVal.textContent = `${val}%`;
            elements.quranAudio.volume = val / 100;
        });
    }

    // Iqamah offsets listeners
    ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'].forEach(p => {
        const select = document.getElementById(`iqamah-offset-${p}`);
        if (select) {
            select.addEventListener('change', (e) => {
                const key = p.charAt(0).toUpperCase() + p.slice(1);
                config.iqamahOffsets[key] = parseInt(e.target.value);
                localStorage.setItem('iqamahOffsets', JSON.stringify(config.iqamahOffsets));
            });
        }
    });

    elements.themeSwatches.forEach(swatch => {
        swatch.addEventListener('click', () => {
            applyTheme(swatch.dataset.theme);
        });
    });

    const buttonLayoutSelect = document.getElementById('button-layout-select');
    if (buttonLayoutSelect) {
        buttonLayoutSelect.addEventListener('change', (e) => {
            applyButtonLayoutTheme(e.target.value);
            publishSpeakerStatus('idle', `Layout theme changed to ${e.target.value}`);
        });
    }

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

    if (elements.weatherUnitSelect) {
        elements.weatherUnitSelect.addEventListener('change', (e) => {
            config.weatherUnit = e.target.value;
            localStorage.setItem('weatherUnit', config.weatherUnit);
            fetchWeather();
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
                publishSpeakerStatus('idle', 'Speaker is Idle');
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
                publishSpeakerStatus('playing_athan', 'Playing Dua after Adhan...');
                
                const overlayTitle = document.getElementById('athan-overlay-title');
                if (overlayTitle) overlayTitle.textContent = "Dua after Athan";

                try {
                    const playPromise = elements.audio.play();
                    if (playPromise !== undefined && typeof playPromise.catch === 'function') {
                        playPromise.catch(e => {
                            console.error("Dua play blocked by browser", e);
                            hideAthanOverlay();
                        });
                    }
                } catch (e) {
                    console.error("Dua play blocked by browser", e);
                    hideAthanOverlay();
                }
            } else if (currentAthanAudioType === 'takbeerat') {
                stopTakbeerat();
            } else if (currentAthanAudioType === 'morning_azkar' || currentAthanAudioType === 'evening_azkar') {
                stopAzkar();
            } else {
                currentAthanAudioType = 'none';
                elements.testAthanBtn.innerHTML = '🔊 Test';
                publishSpeakerStatus('idle', 'Speaker is Idle');
                updateTakbeeratButtonUI();
                updateAzkarButtonUI();
                hideAthanOverlay();
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
    
    UI.on('.voice-trigger-btn', 'click', toggleVoiceRecognition);

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
            publishSpeakerStatus('idle', 'Speaker is Idle');
        }
    });

    // Stop button on Athan Overlay
    const overlayStopBtn = document.getElementById('athan-overlay-stop-btn');
    if (overlayStopBtn) {
        overlayStopBtn.addEventListener('click', () => {
            elements.audio.pause();
            elements.audio.currentTime = 0;
            currentAthanAudioType = 'none';
            if (elements.testAthanBtn) elements.testAthanBtn.innerHTML = '🔊 Test';
            publishSpeakerStatus('idle', 'Speaker is Idle');
            hideAthanOverlay();
        });
    }

    // Automatically hide overlay if audio is paused/stopped
    elements.audio.addEventListener('pause', () => {
        if (currentAthanAudioType === 'athan' || currentAthanAudioType === 'dua' || currentAthanAudioType === 'none') {
            hideAthanOverlay();
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
        document.querySelectorAll('.voice-trigger-btn').forEach(btn => btn.style.display = 'none');
        return;
    }
    
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.lang = 'en-US';
    recognition.interimResults = false;

    recognition.onstart = function() {
        isListening = true;
        UI.addClass('.voice-trigger-btn', 'listening');
        UI.setText('.voice-status', "Listening...");
        publishSpeakerStatus('listening', 'Listening for voice command...');
        incrementQuickStat('stats_voice_count');
    };

    recognition.onresult = async function(event) {
        const transcript = event.results[0][0].transcript.toLowerCase().trim();
        UI.setText('.voice-status', `Heard: "${transcript}"`);
        publishSpeakerStatus('listening', `Heard: "${transcript}"`);
        handleVoiceCommand(transcript);
    };

    recognition.onerror = function(event) {
        UI.setText('.voice-status', `Voice Error: ${event.error}`);
        publishSpeakerStatus('error', `Voice Error: ${event.error}`);
        setTimeout(() => {
            if (currentSpeakerState === 'error') {
                publishSpeakerStatus('idle', 'Speaker is Idle');
            }
        }, 3000);
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
    UI.removeClass('.voice-trigger-btn', 'listening');
    if(recognition) recognition.stop();
    if (currentSpeakerState === 'listening') {
        publishSpeakerStatus('idle', 'Speaker is Idle');
    }
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
            publishSpeakerStatus('error', 'Surah not recognized.');
            setTimeout(() => {
                if (currentSpeakerState === 'error') {
                    publishSpeakerStatus('idle', 'Speaker is Idle');
                }
            }, 3000);
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
    const classesToRemove = [];
    document.body.classList.forEach(cls => {
        if (cls.startsWith('theme-')) {
            classesToRemove.push(cls);
        }
    });
    classesToRemove.forEach(cls => document.body.classList.remove(cls));
    
    document.body.classList.add(`theme-${themeName}`);
    
    elements.themeSwatches.forEach(swatch => swatch.classList.remove('active'));
    const activeSwatch = document.querySelector(`.theme-swatch[data-theme="${themeName}"]`);
    if(activeSwatch) activeSwatch.classList.add('active');
    
    config.theme = themeName;
    localStorage.setItem('theme', themeName);
}

function applyButtonLayoutTheme(layoutName) {
    const classesToRemove = [];
    document.body.classList.forEach(cls => {
        if (cls.startsWith('layout-')) {
            classesToRemove.push(cls);
        }
    });
    classesToRemove.forEach(cls => document.body.classList.remove(cls));
    
    document.body.classList.add(`layout-${layoutName}`);
    
    config.buttonLayout = layoutName;
    localStorage.setItem('buttonLayout', layoutName);
    
    const buttonLayoutSelect = document.getElementById('button-layout-select');
    if (buttonLayoutSelect) buttonLayoutSelect.value = layoutName;
}

function toggleTakbeeratButtons(show) {
    const displayValue = show ? 'flex' : 'none';
    const selectors = [
        '.takbeerat-card-container',
        '.takbeerat-pill-container',
        '.takbeerat-bubble-container'
    ];
    selectors.forEach(selector => {
        document.querySelectorAll(selector).forEach(el => {
            el.style.display = displayValue;
        });
    });
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

// --- Takbeerat Logic ---
let takbeeratTimeout = null;

function updateTakbeeratButtonUI() {
    const isPlaying = (currentAthanAudioType === 'takbeerat');
    
    document.querySelectorAll('.takbeerat-trigger-btn').forEach(btn => {
        if (btn.classList.contains('pill-btn')) {
            if (isPlaying) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
            return;
        }
        
        if (isPlaying) {
            btn.innerHTML = '⏹ Stop Takbeerat';
            btn.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
        } else {
            if (btn.classList.contains('bubble-btn') || btn.querySelector('.bubble-text')) {
                btn.innerHTML = '<span class="bubble-icon">🕋</span><span class="bubble-text">Takbeerat</span>';
                btn.style.background = '';
            } else {
                btn.innerHTML = '🕋 Play Takbeerat';
                btn.style.background = '';
            }
        }
    });
}

function playTakbeerat() {
    stopQuran();
    
    // Stop any active athan/dua
    elements.audio.pause();
    elements.audio.currentTime = 0;
    if (takbeeratTimeout) {
        clearTimeout(takbeeratTimeout);
        takbeeratTimeout = null;
    }
    
    elements.audio.src = 'https://archive.org/download/EidTakbirBySheikhAliMullah/EidTakbirBySheikhAliMullah.mp3';
    currentAthanAudioType = 'takbeerat';
    
    // Set loop based on duration
    const duration = config.takbeeratDuration;
    if (duration === 'once') {
        elements.audio.loop = false;
    } else {
        elements.audio.loop = true;
    }
    
    // Set timer if timed duration (1, 3, 5 min)
    if (duration !== 'once' && duration !== 'continuous') {
        const minutes = parseInt(duration) || 5;
        console.log(`Takbeerat will stop automatically in ${minutes} minutes.`);
        takbeeratTimeout = setTimeout(() => {
            console.log(`Takbeerat auto-stopped after ${minutes} minutes.`);
            stopTakbeerat();
        }, minutes * 60 * 1000);
    }
    
    updateTakbeeratButtonUI();
    
    if (elements.testAthanBtn) elements.testAthanBtn.innerHTML = '⏹ Stop';
    
    publishSpeakerStatus('playing_athan', 'Playing Takbeerat...');
    
    try {
        const playPromise = elements.audio.play();
        if (playPromise !== undefined && typeof playPromise.catch === 'function') {
            playPromise.catch(e => {
                console.error("Takbeerat play blocked", e);
                publishSpeakerStatus('error', 'Autoplay blocked. Tap screen.');
            });
        }
    } catch (e) {
        console.error("Takbeerat play blocked", e);
        publishSpeakerStatus('error', 'Autoplay blocked. Tap screen.');
    }
}

function stopTakbeerat() {
    if (currentAthanAudioType === 'takbeerat') {
        elements.audio.pause();
        elements.audio.currentTime = 0;
        elements.audio.loop = false;
        currentAthanAudioType = 'none';
        if (takbeeratTimeout) {
            clearTimeout(takbeeratTimeout);
            takbeeratTimeout = null;
        }
        updateTakbeeratButtonUI();
        if (elements.testAthanBtn) elements.testAthanBtn.innerHTML = '🔊 Test';
        publishSpeakerStatus('idle', 'Speaker is Idle');
    }
}

function playAzkar(type) {
    stopQuran();
    
    // Stop any active athan/dua/takbeerat
    elements.audio.pause();
    elements.audio.currentTime = 0;
    elements.audio.loop = false;
    
    if (takbeeratTimeout) {
        clearTimeout(takbeeratTimeout);
        takbeeratTimeout = null;
    }
    updateTakbeeratButtonUI();

    if (type === 'morning') {
        elements.audio.src = 'https://archive.org/download/adkar_sabah_masae_safar/adkar_affassi_assaba7.mp3';
        currentAthanAudioType = 'morning_azkar';
    } else {
        elements.audio.src = 'https://archive.org/download/adkar_sabah_masae_safar/adkar_affassi_lmasae.mp3';
        currentAthanAudioType = 'evening_azkar';
    }
    
    updateAzkarButtonUI();
    
    if (elements.testAthanBtn) elements.testAthanBtn.innerHTML = '⏹ Stop';
    
    publishSpeakerStatus('playing_athan', `Playing ${type === 'morning' ? 'Morning' : 'Evening'} Azkar...`);
    incrementQuickStat('stats_azkar_count');
    
    try {
        const playPromise = elements.audio.play();
        if (playPromise !== undefined && typeof playPromise.catch === 'function') {
            playPromise.catch(e => {
                console.error("Azkar play blocked", e);
                publishSpeakerStatus('error', 'Autoplay blocked. Tap screen.');
            });
        }
    } catch (e) {
        console.error("Azkar play blocked", e);
        publishSpeakerStatus('error', 'Autoplay blocked. Tap screen.');
    }
}

function stopAzkar() {
    if (currentAthanAudioType === 'morning_azkar' || currentAthanAudioType === 'evening_azkar') {
        elements.audio.pause();
        elements.audio.currentTime = 0;
        currentAthanAudioType = 'none';
        updateAzkarButtonUI();
        if (elements.testAthanBtn) elements.testAthanBtn.innerHTML = '🔊 Test';
        publishSpeakerStatus('idle', 'Speaker is Idle');
    }
}

function updateAzkarButtonUI() {
    const isMorningPlaying = (currentAthanAudioType === 'morning_azkar');
    const isEveningPlaying = (currentAthanAudioType === 'evening_azkar');
    
    // 1. Morning Azkar buttons
    document.querySelectorAll('.azkar-morning-trigger-btn').forEach(btn => {
        if (btn.classList.contains('pill-btn')) {
            if (isMorningPlaying) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
            return;
        }
        
        if (isMorningPlaying) {
            btn.innerHTML = '⏹ Stop Azkar';
            btn.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
        } else {
            if (btn.classList.contains('bubble-btn') || btn.querySelector('.bubble-text')) {
                btn.innerHTML = '<span class="bubble-icon">☀️</span><span class="bubble-text">Morning</span>';
                btn.style.background = '';
            } else {
                btn.innerHTML = '☀️ Morning';
                btn.style.background = '';
            }
        }
    });
    
    // 2. Evening Azkar buttons
    document.querySelectorAll('.azkar-evening-trigger-btn').forEach(btn => {
        if (btn.classList.contains('pill-btn')) {
            if (isEveningPlaying) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
            return;
        }
        
        if (isEveningPlaying) {
            btn.innerHTML = '⏹ Stop Azkar';
            btn.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
        } else {
            if (btn.classList.contains('bubble-btn') || btn.querySelector('.bubble-text')) {
                btn.innerHTML = '<span class="bubble-icon">🌙</span><span class="bubble-text">Evening</span>';
                btn.style.background = '';
            } else {
                btn.innerHTML = '🌙 Evening';
                btn.style.background = '';
            }
        }
    });
}

function getEveningAzkarTime() {
    if (config.eveningAzkarMode === 'asr_offset' && prayerTimes && prayerTimes['Asr']) {
        const [h, m] = prayerTimes['Asr'].split(':');
        let hours = parseInt(h);
        hours = (hours + 1) % 24;
        const formattedH = String(hours).padStart(2, '0');
        return `${formattedH}:${m}`;
    }
    return config.eveningAzkarTime || '18:00';
}

let lastTriggeredAzkarTime = '';

function checkAzkarTrigger(timeStr) {
    if (timeStr === lastTriggeredAzkarTime) return;
    
    if (config.autoMorningAzkar && config.morningAzkarTime === timeStr) {
        lastTriggeredAzkarTime = timeStr;
        console.log(`Auto-playing Morning Azkar at ${timeStr}`);
        playAzkar('morning');
    } else if (config.autoEveningAzkar && getEveningAzkarTime() === timeStr) {
        lastTriggeredAzkarTime = timeStr;
        console.log(`Auto-playing Evening Azkar at ${timeStr}`);
        playAzkar('evening');
    }
}

function checkAndToggleTakbeeratButton() {
    const urlParams = new URLSearchParams(window.location.search);
    const forceShow = urlParams.has('testTakbeerat') || urlParams.get('test') === 'takbeerat';
    
    if (forceShow) {
        const btn = document.getElementById('takbeerat-btn');
        const joyfulBtn = document.getElementById('joyful-takbeerat-btn');
        if (btn) btn.style.display = 'inline-flex';
        if (joyfulBtn) joyfulBtn.style.display = 'inline-flex';
        return;
    }

    if (!hijriDateInfo) return;
    
    const day = parseInt(hijriDateInfo.day);
    const month = parseInt(hijriDateInfo.month.number);
    
    // 1st to 13th days of Dhul Hijjah (month 12)
    // 1st day of Shawwal (month 10)
    const isDhulHijjahTakbeer = (month === 12 && day >= 1 && day <= 13);
    const isEidFitrTakbeer = (month === 10 && day === 1);
    
    const showTakbeer = isDhulHijjahTakbeer || isEidFitrTakbeer;
    
    const btn = document.getElementById('takbeerat-btn');
    const joyfulBtn = document.getElementById('joyful-takbeerat-btn');
    
    if (btn) btn.style.display = showTakbeer ? 'inline-flex' : 'none';
    if (joyfulBtn) joyfulBtn.style.display = showTakbeer ? 'inline-flex' : 'none';
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

    // Check sleep/dim mode status
    checkSleepMode();

    // Dynamic Azkar check (check once a minute when seconds === '00')
    if (seconds === '00') {
        const hh = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        checkAzkarTrigger(`${hh}:${mm}`);
    }
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
            hijriDateInfo = data.data.date.hijri;
            
            if (data.data.meta) {
                config.lat = data.data.meta.latitude;
                config.lng = data.data.meta.longitude;
            }
            
            UI.setText('.gregorian-date', data.data.date.readable);
            UI.setText('.hijri-date', `${data.data.date.hijri.day} ${data.data.date.hijri.month.en} ${data.data.date.hijri.year}`);
            updatePrayerTimesUI();
            calculateNextPrayer();
            checkAndToggleTakbeeratButton();
            fetchWeather(); // Fetch weather whenever prayer times/location is loaded
        }
    } catch (error) {
        console.error("Failed to fetch prayer times", error);
        UI.setText('.location-text', "Error loading data");
    }
}

function getWeatherEmoji(code) {
    if (code === 0) return '☀️';
    if (code >= 1 && code <= 3) return '🌤️';
    if (code === 45 || code === 48) return '🌫️';
    if (code >= 51 && code <= 55) return '🌧️';
    if (code >= 61 && code <= 65) return '🌧️';
    if (code >= 71 && code <= 77) return '❄️';
    if (code >= 80 && code <= 82) return '🌦️';
    if (code >= 95 && code <= 99) return '⛈️';
    return '☀️';
}

async function fetchWeather() {
    if (!config.lat || !config.lng) return;
    
    try {
        const unitParam = config.weatherUnit === 'fahrenheit' ? 'fahrenheit' : 'celsius';
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${config.lat}&longitude=${config.lng}&current_weather=true&temperature_unit=${unitParam}`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data && data.current_weather) {
            const temp = Math.round(data.current_weather.temperature);
            const code = data.current_weather.weathercode;
            const emoji = getWeatherEmoji(code);
            const unitLabel = config.weatherUnit === 'fahrenheit' ? '°F' : '°C';
            
            // Update classic widget
            if (elements.weatherWidget) {
                if (elements.weatherTemp) elements.weatherTemp.textContent = `${temp}${unitLabel}`;
                if (elements.weatherIcon) elements.weatherIcon.textContent = emoji;
                elements.weatherWidget.style.display = 'flex';
            }
            
            // Update joyful widget
            if (elements.joyWeatherWidget) {
                if (elements.joyWeatherTemp) elements.joyWeatherTemp.textContent = `${temp}${unitLabel}`;
                if (elements.joyWeatherIcon) elements.joyWeatherIcon.textContent = emoji;
                elements.joyWeatherWidget.style.display = 'flex';
            }
        }
    } catch (e) {
        console.error("Failed to fetch weather:", e);
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

const mosques = [
    { name: "Sheikh Zayed Grand Mosque", location: "Abu Dhabi, UAE", url: "images/sheikh_zayed.jpg" },
    { name: "Sultan Ahmed Mosque (Blue Mosque)", location: "Istanbul, Turkey", url: "images/blue_mosque.jpg" },
    { name: "Al-Haram Mosque", location: "Makkah, Saudi Arabia", url: "images/al_haram.jpg" },
    { name: "Al-Masjid an-Nabawi", location: "Medina, Saudi Arabia", url: "images/nabawi.png" },
    { name: "Putra Mosque", location: "Putrajaya, Malaysia", url: "images/putra.png" },
    { name: "Faisal Mosque", location: "Islamabad, Pakistan", url: "images/faisal.png" },
    { name: "Hassan II Mosque", location: "Casablanca, Morocco", url: "images/hassan2.png" }
];

function showAthanOverlay(salahName) {
    const overlay = document.getElementById('athan-overlay');
    const overlayBg = document.getElementById('athan-overlay-bg');
    const overlaySalah = document.getElementById('athan-overlay-salah');
    const overlayMosque = document.getElementById('athan-overlay-mosque');
    const overlayLocation = document.getElementById('athan-overlay-location');
    const overlayTitle = document.getElementById('athan-overlay-title');

    if (!overlay || !overlayBg) return;

    // Pick random mosque
    const mosque = mosques[Math.floor(Math.random() * mosques.length)];
    
    overlayBg.style.backgroundImage = `url('${mosque.url}')`;
    overlaySalah.textContent = `${salahName} Athan`;
    overlayMosque.textContent = mosque.name;
    overlayLocation.textContent = mosque.location;
    if (overlayTitle) overlayTitle.textContent = "Now Playing";

    overlay.style.display = 'block';
}

function hideAthanOverlay() {
    const overlay = document.getElementById('athan-overlay');
    if (overlay) overlay.style.display = 'none';
}

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
            publishSpeakerStatus('playing_athan', `Playing ${prayerName === 'Test' ? 'Test' : prayerName} Athan...`);
            
            showAthanOverlay(prayerName === 'Test' ? 'Test' : prayerName);
            
            // Set up a listener for Athan audio ended to trigger the Iqamah countdown
            const playIqamahOnEnd = () => {
                elements.audio.removeEventListener('ended', playIqamahOnEnd);
                if (prayerName !== 'Test') {
                    startIqamahCountdown(prayerName);
                }
            };
            elements.audio.addEventListener('ended', playIqamahOnEnd);

            try {
                const playPromise = elements.audio.play();
                if (playPromise !== undefined && typeof playPromise.catch === 'function') {
                    playPromise.catch(e => {
                        console.error("Audio play blocked by browser. User must tap the screen to unlock autoplay first.", e);
                        publishSpeakerStatus('error', 'Autoplay blocked. Tap speaker screen.');
                    });
                }
            } catch (e) {
                console.error("Audio play blocked by browser. User must tap the screen to unlock autoplay first.", e);
                publishSpeakerStatus('error', 'Autoplay blocked. Tap speaker screen.');
            }
        }
    }
}

// --- Iqamah Countdown & Chime Reminders ---
function startIqamahCountdown(prayerName) {
    if (activeIqamahTimer) clearInterval(activeIqamahTimer);
    
    const offsetMinutes = config.iqamahOffsets[prayerName] || 10;
    let secondsRemaining = offsetMinutes * 60;
    
    // Create or update a DOM element to display the Iqamah countdown
    let iqamahDisplay = document.getElementById('iqamah-countdown-display');
    if (!iqamahDisplay) {
        iqamahDisplay = document.createElement('div');
        iqamahDisplay.id = 'iqamah-countdown-display';
        iqamahDisplay.style.cssText = "background: rgba(16, 185, 129, 0.15); border: 2.5px solid #10b981; border-radius: 12px; padding: 12px; margin: 1rem auto 0; text-align: center; max-width: 400px; color: var(--text-primary); font-weight: 700; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.2); animation: pulse 2s infinite alternate;";
        
        // Insert into classic/joyful main layouts dynamically
        const mainContent = document.querySelector('.main-content');
        if (mainContent) mainContent.appendChild(iqamahDisplay);
    }
    iqamahDisplay.style.display = 'block';

    activeIqamahTimer = setInterval(() => {
        if (secondsRemaining <= 0) {
            clearInterval(activeIqamahTimer);
            iqamahDisplay.innerHTML = `<div>🕌 Iqamah time for ${prayerName}!</div>`;
            playIqamahChime();
            setTimeout(() => { iqamahDisplay.style.display = 'none'; }, 8000);
            return;
        }
        
        const m = Math.floor(secondsRemaining / 60);
        const s = secondsRemaining % 60;
        iqamahDisplay.innerHTML = `<div>🕌 Iqamah for ${prayerName} in <span style="color: #10b981;">${m}:${String(s).padStart(2, '0')}</span></div>`;
        secondsRemaining--;
    }, 1000);
}

function playIqamahChime() {
    // Play a short sweet chime to remind user that Iqamah is finishing
    // We can use a standard notification chime audio file link
    elements.audio.src = 'https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg';
    currentAthanAudioType = 'dua'; // Temporary type to not trigger loop
    try {
        elements.audio.play();
    } catch (e) {
        console.error("Failed to play Iqamah chime:", e);
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
    publishSpeakerStatus('playing_quran', 'Fetching Quran audio data...');
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
            publishSpeakerStatus('idle', 'Quran ready to play');
        } else {
            elements.quranStatus.textContent = "Audio unavailable for this reciter.";
            publishSpeakerStatus('error', 'Audio unavailable for this reciter.');
        }
    } catch (e) {
        console.error("Failed to load full surah", e);
        elements.quranStatus.textContent = "Error loading audio.";
        publishSpeakerStatus('error', 'Error loading Quran audio.');
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

    if (currentAthanAudioType === 'takbeerat') {
        stopTakbeerat();
    }
    // Also stop regular Athan if playing
    if (currentAthanAudioType === 'athan' || currentAthanAudioType === 'dua') {
        elements.audio.pause();
        elements.audio.currentTime = 0;
        currentAthanAudioType = 'none';
        if (elements.testAthanBtn) elements.testAthanBtn.innerHTML = '🔊 Test';
        updateTakbeeratButtonUI();
    }

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
    incrementQuickStat('stats_quran_count');
    
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
            publishSpeakerStatus('error', 'Quran playback failed');
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
        publishSpeakerStatus('error', 'Quran playback failed');
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

    // Publish speaker status
    const detail = `${currentSurahData.englishName} - ${status}`;
    publishSpeakerStatus('playing_quran', detail);
}

function pauseQuran() {
    elements.quranAudio.pause();
    isQuranPlaying = false;
    elements.quranPlayPause.innerHTML = '▶️ Play';
    elements.fsPlayPauseBtn.innerHTML = '▶️';
    elements.quranStatus.textContent = "Paused";
    elements.fsStatusText.textContent = "Paused";
    publishSpeakerStatus('idle', 'Quran playback paused');
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
    publishSpeakerStatus('idle', 'Speaker is Idle');
}

// --- MQTT Remote Control Logic (Speaker Side) ---
let mqttClient = null;
let lastPingTime = 0;
let pingCheckInterval = null;
let currentShortId = null;
let currentSpeakerState = 'idle';
let currentSpeakerStateDetail = 'Speaker is Idle';

function publishSpeakerStatus(speakerState, detail) {
    currentSpeakerState = speakerState;
    currentSpeakerStateDetail = detail;
    if (mqttClient && mqttClient.connected && currentShortId) {
        mqttClient.publish(`anisapp/athan/${currentShortId}/status`, JSON.stringify({
            state: 'connected',
            speakerState: currentSpeakerState,
            detail: currentSpeakerStateDetail,
            takbeeratDuration: config.takbeeratDuration,
            autoMorningAzkar: config.autoMorningAzkar,
            morningAzkarTime: config.morningAzkarTime,
            autoEveningAzkar: config.autoEveningAzkar,
            eveningAzkarMode: config.eveningAzkarMode,
            eveningAzkarTime: config.eveningAzkarTime,
            buttonLayout: config.buttonLayout
        }));
    }
}

function initPeerServer() {
    if (mqttClient) return; // Already initialized

    // Reset QR code UI
    if (elements.remoteQrCode) {
        elements.remoteQrCode.style.display = 'none';
        elements.remoteQrCode.src = '';
    }
    if (elements.remoteQrLoading) {
        elements.remoteQrLoading.style.display = 'inline-block';
    }
    if (elements.remoteLocalhostWarning) {
        elements.remoteLocalhostWarning.style.display = 'none';
    }

    // Generate a simple 5-digit number to make it easy to type on mobile
    const randCode = Math.floor(10000 + Math.random() * 90000);
    const shortId = String(randCode);
    currentShortId = shortId;
    
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

        if (elements.remoteQrCode) {
            elements.remoteQrCode.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(remoteUrl)}`;
            elements.remoteQrCode.onload = () => {
                if (elements.remoteQrLoading) elements.remoteQrLoading.style.display = 'none';
                elements.remoteQrCode.style.display = 'block';
            };
        }

        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        if (isLocalhost && elements.remoteLocalhostWarning) {
            elements.remoteLocalhostWarning.style.display = 'block';
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
            publishSpeakerStatus(currentSpeakerState, currentSpeakerStateDetail);
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

        case 'play_takbeerat':
            if (data.duration) {
                config.takbeeratDuration = data.duration;
                localStorage.setItem('takbeeratDuration', config.takbeeratDuration);
                const select = document.getElementById('takbeerat-duration-select');
                if (select) select.value = data.duration;
            }
            playTakbeerat();
            break;

        case 'stop_takbeerat':
            stopTakbeerat();
            break;

        case 'change_takbeerat_duration':
            if (data.duration) {
                config.takbeeratDuration = data.duration;
                localStorage.setItem('takbeeratDuration', config.takbeeratDuration);
                const select = document.getElementById('takbeerat-duration-select');
                if (select) select.value = data.duration;
            }
            break;
            
        case 'play_azkar':
            if (data.type) {
                playAzkar(data.type);
            }
            break;

        case 'stop_azkar':
            stopAzkar();
            break;

        case 'change_azkar_settings':
            if (data.autoMorningAzkar !== undefined) {
                config.autoMorningAzkar = data.autoMorningAzkar === true || data.autoMorningAzkar === 'true';
                localStorage.setItem('autoMorningAzkar', config.autoMorningAzkar);
                const cb = document.getElementById('auto-morning-azkar');
                if (cb) cb.checked = config.autoMorningAzkar;
            }
            if (data.morningAzkarTime) {
                config.morningAzkarTime = data.morningAzkarTime;
                localStorage.setItem('morningAzkarTime', config.morningAzkarTime);
                const input = document.getElementById('morning-azkar-time');
                if (input) input.value = config.morningAzkarTime;
            }
            if (data.autoEveningAzkar !== undefined) {
                config.autoEveningAzkar = data.autoEveningAzkar === true || data.autoEveningAzkar === 'true';
                localStorage.setItem('autoEveningAzkar', config.autoEveningAzkar);
                const cb = document.getElementById('auto-evening-azkar');
                if (cb) cb.checked = config.autoEveningAzkar;
            }
            if (data.eveningAzkarMode) {
                config.eveningAzkarMode = data.eveningAzkarMode;
                localStorage.setItem('eveningAzkarMode', config.eveningAzkarMode);
                const rAsr = document.getElementById('evening-azkar-mode-asr');
                const rCustom = document.getElementById('evening-azkar-mode-custom');
                const input = document.getElementById('evening-azkar-time');
                if (config.eveningAzkarMode === 'asr_offset') {
                    if (rAsr) rAsr.checked = true;
                    if (input) input.disabled = true;
                } else {
                    if (rCustom) rCustom.checked = true;
                    if (input) input.disabled = false;
                }
            }
            if (data.eveningAzkarTime) {
                config.eveningAzkarTime = data.eveningAzkarTime;
                localStorage.setItem('eveningAzkarTime', config.eveningAzkarTime);
                const input = document.getElementById('evening-azkar-time');
                if (input) input.value = config.eveningAzkarTime;
            }
            break;
            
        case 'change_theme':
            if (data.theme) {
                applyTheme(data.theme);
            }
            break;
            
        case 'change_button_layout':
            if (data.layout) {
                applyButtonLayoutTheme(data.layout);
            }
            break;
            
        case 'trigger_voice':
            const micBtn = document.querySelector('.voice-trigger-btn');
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

// --- Qibla Compass Angle Calculation ---
function updateQiblaCompass() {
    const userLat = config.lat;
    const userLng = config.lng;
    
    // Kaaba coordinates
    const kaabaLat = 21.4225;
    const kaabaLng = 39.8262;

    const lat1 = userLat * Math.PI / 180;
    const lat2 = kaabaLat * Math.PI / 180;
    const lon1 = userLng * Math.PI / 180;
    const lon2 = kaabaLng * Math.PI / 180;

    const dLon = lon2 - lon1;

    const y = Math.sin(dLon) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);

    let bearing = Math.atan2(y, x) * 180 / Math.PI;
    bearing = (bearing + 360) % 360;

    const roundedAngle = Math.round(bearing);
    
    // Update pointer rotation and display text
    const pointer = document.getElementById('qibla-pointer');
    const display = document.getElementById('qibla-angle-display');
    if (pointer) pointer.style.transform = `rotate(${roundedAngle}deg)`;
    if (display) display.textContent = `${roundedAngle}°`;
}

// --- Friday Kahf Banner Logic ---
function checkFridayReminders() {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 5 is Friday
    const classicBanner = document.getElementById('friday-kahf-banner');
    const joyfulBanner = document.getElementById('joy-friday-kahf-banner');
    
    if (dayOfWeek === 5) {
        if (classicBanner) classicBanner.style.display = 'flex';
        if (joyfulBanner) joyfulBanner.style.display = 'flex';
    } else {
        if (classicBanner) classicBanner.style.display = 'none';
        if (joyfulBanner) joyfulBanner.style.display = 'none';
    }
}

// --- Islamic Holidays Countdown Logic ---
function checkHolidayCountdown() {
    // Basic Hijri to Gregorian estimate approximations for Ramadan and Eids
    // Note: Since Aladhan API returns Hijri calendar date, we compute next occurrences dynamically
    if (!hijriDateInfo) return;
    
    const hYear = parseInt(hijriDateInfo.year);
    
    // Define estimated holiday dates for current Hijri Year
    // Ramadan start is 1st Ramadan, Eid Fitr is 1st Shawwal, Eid Adha is 10th Dhu al-Hijjah
    // Let's call Aladhan API calendar utility or approximate based on standard shift of -11 days/year.
    // However, since we can't query future APIs reliably without heavy requests, we calculate using a static known point
    // or fetch from an API. Let's use simple estimate matching the current Hijri date:
    // Standard approach: if current month is Sha'ban, Ramadan is next.
    // If month is Ramadan, Eid-ul-Fitr is next.
    // Let's compute days remaining:
    const monthNo = parseInt(hijriDateInfo.month.number);
    const dayNo = parseInt(hijriDateInfo.day);
    
    let holidayName = "";
    let daysLeft = 999;
    
    // Approximate length of Hijri month = 29.5 days
    // Ramadan (Month 9), Shawwal (Month 10 - Eid al-Fitr), Dhu al-Hijjah (Month 12 - Eid al-Adha)
    if (monthNo === 8) { // Sha'ban
        holidayName = "Ramadan";
        daysLeft = (29 - dayNo) + 1; 
    } else if (monthNo === 9) { // Ramadan
        holidayName = "Eid al-Fitr";
        daysLeft = (30 - dayNo) + 1;
    } else if (monthNo === 11) { // Dhu al-Qi'dah
        holidayName = "Eid al-Adha";
        daysLeft = (30 - dayNo) + 10;
    } else if (monthNo === 12 && dayNo < 10) { // Dhu al-Hijjah before 10th
        holidayName = "Eid al-Adha";
        daysLeft = 10 - dayNo;
    }
    
    const classicBanner = document.getElementById('holiday-banner');
    const classicText = document.getElementById('holiday-banner-text');
    const joyfulBanner = document.getElementById('joy-holiday-banner');
    const joyfulText = document.getElementById('joy-holiday-banner-text');

    if (daysLeft <= 30 && holidayName) {
        const text = `${holidayName} is in ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'}!`;
        if (classicBanner && classicText) {
            classicText.textContent = text;
            classicBanner.style.display = 'flex';
        }
        if (joyfulBanner && joyfulText) {
            joyfulText.textContent = text;
            joyfulBanner.style.display = 'flex';
        }
    } else {
        if (classicBanner) classicBanner.style.display = 'none';
        if (joyfulBanner) joyfulBanner.style.display = 'none';
    }
}

// --- Daily Reminder Board content fetcher ---
function updateDailyRemindersCard() {
    const today = new Date().toISOString().split('T')[0];
    const cachedDate = localStorage.getItem('hadithDate');
    const cachedHadith = localStorage.getItem('hadithText');
    const cachedRef = localStorage.getItem('hadithRef');

    const updateUI = (text, ref) => {
        const boardText = document.getElementById('reminder-board-text');
        const boardRef = document.getElementById('reminder-board-ref');
        const joyBoardText = document.getElementById('joy-reminder-board-text');
        const joyBoardRef = document.getElementById('joy-reminder-board-ref');

        if (boardText) boardText.textContent = text;
        if (boardRef) boardRef.textContent = ref;
        if (joyBoardText) joyBoardText.textContent = text;
        if (joyBoardRef) joyBoardRef.textContent = ref;
    };

    if (cachedDate === today && cachedHadith) {
        updateUI(`"${cachedHadith}"`, cachedRef);
        return;
    }

    // Default placeholder
    updateUI('"Actions are judged by intentions..."', "Sahih al-Bukhari");

    // Fetch asynchronously
    fetchDailyHadith().then(() => {
        const freshHadith = localStorage.getItem('hadithText');
        const freshRef = localStorage.getItem('hadithRef');
        if (freshHadith) {
            updateUI(`"${freshHadith}"`, freshRef);
        }
    }).catch(err => console.error("Async daily reminder board load failed:", err));
}

// --- Sleep / Night Mode Check (Isha to Fajr) ---
let sleepModeWakeTime = 0; // timestamp when temporary wake-up ends

function checkSleepMode() {
    if (!prayerTimes.Isha || !prayerTimes.Fajr) return;

    const now = new Date();
    const [ishaH, ishaM] = prayerTimes.Isha.split(':').map(Number);
    const [fajrH, fajrM] = prayerTimes.Fajr.split(':').map(Number);

    // Sleep mode starts 1 hour (60 minutes) after Isha Salah
    const ishaDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), ishaH + 1, ishaM, 0);
    const fajrDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), fajrH, fajrM, 0);
    
    let isSleepTime = false;

    // Sleep mode active if:
    // 1) Time is past 1 hour after Isha tonight
    // 2) Time is before Fajr in the morning
    if (now >= ishaDate || now < fajrDate) {
        isSleepTime = true;
    }

    // Temporary wake override
    if (isSleepTime && Date.now() < sleepModeWakeTime) {
        isSleepTime = false;
    }

    if (isSleepTime) {
        document.body.classList.add('sleep-mode-active');
    } else {
        document.body.classList.remove('sleep-mode-active');
    }
}

// Add global listener to wake up screen on touch
document.addEventListener('pointerdown', (e) => {
    // If sleep mode is active and we touch the screen, temporarily wake it up
    if (document.body.classList.contains('sleep-mode-active')) {
        sleepModeWakeTime = Date.now() + 10000; // Keep awake for 10 seconds
        checkSleepMode();
        e.stopPropagation();
    }
});

// --- Premium Quick Statistics Tracker ---
function updateQuickStatsUI() {
    const qCount = localStorage.getItem('stats_quran_count') || 0;
    const aCount = localStorage.getItem('stats_azkar_count') || 0;
    const vCount = localStorage.getItem('stats_voice_count') || 0;

    const elQ = document.getElementById('stats-quran-count');
    const elA = document.getElementById('stats-azkar-count');
    const elV = document.getElementById('stats-voice-count');
    const elQJoy = document.getElementById('joy-stats-quran-count');
    const elAJoy = document.getElementById('joy-stats-azkar-count');
    const elVJoy = document.getElementById('joy-stats-voice-count');

    if (elQ) elQ.textContent = qCount;
    if (elA) elA.textContent = aCount;
    if (elV) elV.textContent = vCount;
    if (elQJoy) elQJoy.textContent = qCount;
    if (elAJoy) elAJoy.textContent = aCount;
    if (elVJoy) elVJoy.textContent = vCount;
}

function incrementQuickStat(key) {
    let current = parseInt(localStorage.getItem(key)) || 0;
    localStorage.setItem(key, current + 1);
    updateQuickStatsUI();
}

// Start app
init();

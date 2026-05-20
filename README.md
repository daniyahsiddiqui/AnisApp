# AnisApp - Smart Athan Clock & Quran Player

AnisApp is a premium, real-time synchronized Islamic Athan Clock and Quran Player designed for home displays (like tablets, old phones, or smart screens) and controllable from any mobile device.

## Live Demo & Testing

You can test the hosted version directly in your browser:

1. **Set up the Clock (Speaker Display):**
   * 👉 Open the Clock: [https://daniyahsiddiqui.github.io/AnisApp/](https://daniyahsiddiqui.github.io/AnisApp/)
   * *Note: Tap anywhere on the screen once when it loads to unlock audio autoplay and keep the screen visible.*
   * Copy the **Device ID** displayed on the screen.

2. **Open the Remote Control (on your phone):**
   * 👉 Open the Remote: [https://daniyahsiddiqui.github.io/AnisApp/remote.html](https://daniyahsiddiqui.github.io/AnisApp/remote.html)
   * Enter the **Device ID** from the Clock screen to pair them.
   * Toggle settings, trigger test Athans, or head to the **"Play Quran"** tab to stream specific surahs/ayahs directly to the clock display.

---

## Key Features

* **Vibrant Glassmorphic UI**: Beautiful dark-mode dashboard tailored for permanent home dashboard displays.
* **Automatic Geolocation Fallback**: Uses a multi-tiered lookup fallback (`ipapi.co` -> `ip-api.com` -> `ipinfo.io` -> London, UK) to calculate accurate local prayer times even behind VPNs.
* **Smart Screen Wake Lock**: Utilizes the modern Web Wake Lock API to prevent the screen from going to sleep while active.
* **Athan Customization & Rules**:
  * Select from multiple world-class muezzins.
  * Fajr-specific Adhan containing the extra line *"Assalatu khayrun minan-nawm"* (Prayer is better than sleep).
  * Automatically plays the authentic **Dua after Adhan** supplication when the call to prayer finishes.
* **Advanced Remote Controls**:
  * **Settings Tab**: Mute controls, calculation methods, school preferences, and voice recognition triggers.
  * **Play Quran Tab**: Stream specific surahs/ayahs with dynamic dropdowns, playback range selectors, and range repetition modes.
* **Firewall-Resilient Connectivity**: Built on secure WebSockets MQTT communication (`wss://broker.emqx.io:8084/mqtt`) bypassing local UDP firewalls and VPN blocks with sub-50ms pairing latency.

---

## Tech Stack

* **Frontend**: HTML5, Vanilla CSS3 (Glassmorphism), Vanilla ES6 JavaScript.
* **Communication Protocol**: MQTT over secure WebSockets.
* **Native Wrap**: Capacitor (configured for Android integration).

---

## Local Development & Installation

Ensure you have Node.js installed, then:

```bash
# Clone the repository
git clone git@github.com:daniyahsiddiqui/AnisApp.git
cd AnisApp

# Install dependencies
npm install

# Build static assets
npm run build

# Synchronize with Capacitor (for native Android builds)
npx cap sync
```

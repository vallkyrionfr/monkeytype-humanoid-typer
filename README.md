# Humanoid Auto-Typer for Monkeytype & Keybr

A realistic, humanoid auto-typing Chrome/Brave Extension (Manifest V3) supporting both **[Monkeytype](https://monkeytype.com)** and **[Keybr](https://www.keybr.com)**.

Engineered with biological neuromuscular cadence, word-length burst velocity, macro-drift waves (consistency anti-bot evasion), key dwell/flight times, adjacent QWERTY typos, and cognitive backspace corrections.

---

## 🚀 Quick Setup (Load into Browser)

Compatible with **Brave**, **Google Chrome**, **Microsoft Edge**, and any Chromium-based browser.

1. Open your browser and navigate to:
   ```text
   brave://extensions   (or chrome://extensions)
   ```
2. Enable **Developer mode** (toggle switch in the top-right corner).
3. Click **Load unpacked** (top-left) and select this folder:
   ```text
   /mnt/hdd2/Projects/monkeytype-humanoid-typer
   ```
4. Open [https://monkeytype.com](https://monkeytype.com) or [https://www.keybr.com](https://www.keybr.com) and the **Humanoid Typer** HUD widget will appear!

---

## ⚡ Features

### 1. Dual Control: Toolbar Popup GUI + In-Page Floating HUD
- **Toolbar Popup**: Click the extension icon in the browser toolbar to view live tab status, start/stop tests, change WPM, and switch presets.
- **In-Page Floating HUD**: An inlined Shadow DOM pill widget on the page with draggable header, mini-mode, sliders, and hotkeys.

### 2. Anti-Bot Consistency Engine
- **Why Monkeytype flags bots**: A flat speed line (e.g. 155 WPM every single second) creates an artificial 90%+ consistency score, triggering Monkeytype's Kogasa bot detection.
- **How we evade bot detection**:
  - **Word Burst Velocity**: Short words ($\le 3$ chars) are typed ~35% faster, while longer words ($\ge 7$ chars) are typed ~22% slower.
  - **Macro-Drift Waves**: Creates smooth rolling speed hills and valleys across the test replay graph.
  - **Closed-Loop Pacing Compensator**: Continually adjusts pace so your overall test average lands within $\pm 1.5$ WPM of your chosen target, while consistency lands in the authentic human pro range (68%–78%).

### 3. Keybr.com Support
- Automatically extracts practice letters and words.
- Translates Keybr's `\uE000` private unicode space glyph to spacebar strokes.
- Dispatches hardware-level trusted events (`isTrusted: true`) via Chrome DevTools Protocol streaming to satisfy Keybr's input verification.

### 4. Keyboard Shortcuts
| Shortcut | Action |
|---|---|
| <kbd>Alt</kbd> + <kbd>T</kbd> | Toggle Auto-Typer ON / OFF |
| <kbd>Alt</kbd> + <kbd>↑</kbd> | Increase speed by +10 WPM |
| <kbd>Alt</kbd> + <kbd>↓</kbd> | Decrease speed by -10 WPM |
| <kbd>Alt</kbd> + <kbd>P</kbd> | Pause / Resume typing mid-test |
| <kbd>Esc</kbd> | Emergency Stop |

---

## 📂 Project Structure

```text
monkeytype-humanoid-typer/
├── manifest.json              # Manifest V3 extension configuration
├── README.md                  # Documentation and setup
├── background/
│   └── service-worker.js      # Background worker with CDP typing-stream
├── content/
│   ├── adapters/
│   │   ├── base-adapter.js    # Abstract site adapter interface
│   │   ├── monkeytype-adapter.js # Monkeytype DOM & event adapter
│   │   └── keybr-adapter.js   # Keybr DOM & trusted CDP adapter
│   ├── content-main.js        # Multi-site coordinator & auto-takeover
│   ├── words-tracker.js       # Monkeytype DOM word tracker
│   ├── humanoid-engine.js     # Neuromuscular cadence, waves, bursts & typos
│   ├── hud.js                 # In-page Shadow DOM widget controller
│   └── hud.css                # Encapsulated dark theme stylesheet
├── popup/
│   ├── popup.html             # Toolbar popup GUI
│   ├── popup.css              # Popup styling
│   └── popup.js               # Multi-site tab detection & settings sync
└── tests/
    ├── test-consistency.js    # Monkeytype Kogasa consistency benchmark
    ├── test-timing.js         # Gaussian interval & typo tests
    └── test-extension-live.js # Headless Brave live verification test
```

---

## 🧪 Testing

Run consistency benchmark:
```bash
node tests/test-consistency.js
```

Run live browser test in Brave:
```bash
node tests/test-extension-live.js
```

// Main Content Script Coordinator
// Detects active site (Monkeytype vs Keybr), attaches matching adapter,
// and coordinates HumanoidTypingEngine and MonkeytypeHUD.

(async function initMultiSiteAutoTyper() {
  console.log('[Humanoid Typer] Initializing multi-site content script on:', window.location.hostname);

  const hostname = window.location.hostname;
  let adapter = null;

  if (hostname.includes('monkeytype.com')) {
    adapter = new window.MonkeytypeAdapter().init();
  } else if (hostname.includes('keybr.com')) {
    adapter = new window.KeybrAdapter().init();
  }

  if (!adapter) {
    console.warn('[Humanoid Typer] Unsupported domain:', hostname);
    return;
  }

  // Load saved settings from chrome.storage
  let savedSettings = {
    enabled: true,
    wpm: 100,
    accuracy: 98,
    autoTakeover: true,
    burstVariance: 0.30,
    simulateTypoCorrections: true
  };

  try {
    if (chrome?.storage?.local) {
      const res = await chrome.storage.local.get(null);
      savedSettings = Object.assign(savedSettings, res);
    }
  } catch (err) {
    console.warn('[Humanoid Typer] Could not read storage:', err);
  }

  // 1. Initialize Humanoid Typing Engine with site adapter
  const engine = new window.HumanoidTypingEngine(adapter);
  engine.updateSettings(savedSettings);

  async function startTypingSession(options = {}) {
    if (engine.isRunning) return;

    hud.setStatus('typing');
    hud.showToast('🚀 Typing Started');
    await engine.start(options);
    hud.setStatus('idle');
  }

  // 2. Initialize In-Page HUD
  const hud = new window.MonkeytypeHUD({
    wpm: savedSettings.wpm,
    accuracy: savedSettings.accuracy,
    enabled: savedSettings.enabled,
    autoTakeover: savedSettings.autoTakeover,
    onSettingsChange: (newSettings) => {
      engine.updateSettings(newSettings);
    },
    onEmergencyStop: () => {
      engine.stop();
      hud.setStatus('idle');
    },
    onTogglePause: () => {
      return engine.togglePause();
    },
    onStartTyping: () => {
      startTypingSession({ isTakeover: false });
    }
  });

  await hud.init();
  hud.updateStatusDot();

  // 3. Auto-Takeover Listener on User Keystrokes
  let takeoverDebounce = false;

  async function handleUserStart(event) {
    if (!hud.options.enabled || !hud.options.autoTakeover) return;
    if (engine.isRunning) return;

    // Ignore modifier keys, tab, escape, function keys
    if (['Alt', 'Control', 'Shift', 'Meta', 'Escape', 'Tab', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'].includes(event.key)) {
      return;
    }

    // Ignore if typing inside our own HUD inputs
    if (event.target?.closest?.('#mttyper-host') || event.target?.tagName === 'INPUT') {
      return;
    }

    if (takeoverDebounce) return;
    takeoverDebounce = true;
    setTimeout(() => { takeoverDebounce = false; }, 300);

    setTimeout(async () => {
      if (adapter.isTestActive() && !engine.isRunning) {
        await startTypingSession({ isTakeover: true });
      }
    }, 45);
  }

  window.addEventListener('keydown', handleUserStart, true);

  // 4. Messages from Extension Toolbar Popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === 'TRIGGER_START') {
      startTypingSession();
      sendResponse({ status: 'started' });
      return true;
    }

    if (message?.type === 'TRIGGER_STOP') {
      engine.stop();
      hud.setStatus('idle');
      hud.showToast('🛑 Stopped');
      sendResponse({ status: 'stopped' });
      return true;
    }

    if (message?.type === 'SETTINGS_UPDATED') {
      const s = message.settings || {};
      if (typeof s.wpm === 'number') hud.setSpeed(s.wpm);
      if (typeof s.enabled === 'boolean') {
        hud.options.enabled = s.enabled;
        const toggle = hud.shadow.querySelector('#mttyper-toggle-enabled');
        if (toggle) toggle.checked = s.enabled;
        hud.updateStatusDot();
      }
      if (typeof s.autoTakeover === 'boolean') {
        hud.options.autoTakeover = s.autoTakeover;
        const check = hud.shadow.querySelector('#mttyper-check-takeover');
        if (check) check.checked = s.autoTakeover;
      }
      if (typeof s.accuracy === 'number') {
        hud.options.accuracy = s.accuracy;
        const range = hud.shadow.querySelector('#mttyper-range-acc');
        const badge = hud.shadow.querySelector('#mttyper-val-acc');
        if (range) range.value = s.accuracy;
        if (badge) badge.textContent = `${s.accuracy}%`;
      }
      engine.updateSettings(s);
      sendResponse({ status: 'updated' });
      return true;
    }
  });

  // 5. Test State Transitions
  adapter.onStateChange((newStatus, prevStatus) => {
    console.log(`[Humanoid Typer] State transition: ${prevStatus} -> ${newStatus}`);
    if (newStatus === 'finished' || newStatus === 'idle') {
      engine.stop();
      hud.setStatus('idle');
    }
  });

  console.log('[Humanoid Typer] Ready on', hostname);
})();

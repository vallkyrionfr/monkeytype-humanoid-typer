// Popup Script: Handles UI interactions, multi-site settings synchronization, and commands

document.addEventListener('DOMContentLoaded', async () => {
  const toggleEnabled = document.getElementById('toggle-enabled');
  const sliderWpm = document.getElementById('slider-wpm');
  const inputWpm = document.getElementById('input-wpm');
  const sliderAccuracy = document.getElementById('slider-accuracy');
  const valAccuracy = document.getElementById('val-accuracy');
  const toggleTakeover = document.getElementById('toggle-takeover');
  const presetPills = document.querySelectorAll('.preset-pill');
  const btnStart = document.getElementById('btn-start-test');
  const btnStop = document.getElementById('btn-stop-test');
  const tabStatusCard = document.getElementById('tab-status-card');
  const tabStatusText = document.getElementById('tab-status-text');
  const statusDot = document.getElementById('status-dot');

  // Load current settings
  const settings = await chrome.storage.local.get({
    enabled: true,
    wpm: 100,
    accuracy: 98,
    autoTakeover: true
  });

  // Apply to UI
  toggleEnabled.checked = settings.enabled;
  sliderWpm.value = settings.wpm;
  inputWpm.value = settings.wpm;
  sliderAccuracy.value = settings.accuracy;
  valAccuracy.textContent = `${settings.accuracy}%`;
  toggleTakeover.checked = settings.autoTakeover;
  updateStatusDot(settings.enabled);
  updatePresetActive(settings.wpm);

  // Check active and background tabs for Monkeytype and Keybr
  let targetTab = null;
  let siteName = '';

  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (activeTab?.url?.includes('monkeytype.com')) {
    targetTab = activeTab;
    siteName = 'Monkeytype';
    tabStatusCard.className = 'tab-status-card success';
    tabStatusText.textContent = '🟢 Connected to Monkeytype tab';
  } else if (activeTab?.url?.includes('keybr.com')) {
    targetTab = activeTab;
    siteName = 'Keybr';
    tabStatusCard.className = 'tab-status-card success';
    tabStatusText.textContent = '🟢 Connected to Keybr tab';
  } else {
    // Search open background tabs
    const mtTabs = await chrome.tabs.query({ url: '*://*.monkeytype.com/*' });
    const kbTabs = await chrome.tabs.query({ url: '*://*.keybr.com/*' });

    if (mtTabs.length > 0) {
      targetTab = mtTabs[0];
      siteName = 'Monkeytype';
      tabStatusCard.className = 'tab-status-card success';
      tabStatusText.textContent = '🟢 Found Monkeytype tab (Switch tab available)';
    } else if (kbTabs.length > 0) {
      targetTab = kbTabs[0];
      siteName = 'Keybr';
      tabStatusCard.className = 'tab-status-card success';
      tabStatusText.textContent = '🟢 Found Keybr tab (Switch tab available)';
    } else {
      tabStatusCard.className = 'tab-status-card warning';
      tabStatusText.textContent = '⚠️ Open monkeytype.com or keybr.com';
    }
  }

  // Event Listeners
  toggleEnabled.addEventListener('change', async () => {
    const isEnabled = toggleEnabled.checked;
    await saveSettings({ enabled: isEnabled });
    updateStatusDot(isEnabled);
  });

  sliderWpm.addEventListener('input', async () => {
    const wpm = parseInt(sliderWpm.value, 10);
    inputWpm.value = wpm;
    updatePresetActive(wpm);
    await saveSettings({ wpm });
  });

  inputWpm.addEventListener('change', async () => {
    let wpm = parseInt(inputWpm.value, 10);
    wpm = Math.max(30, Math.min(500, isNaN(wpm) ? 100 : wpm));
    inputWpm.value = wpm;
    sliderWpm.value = wpm;
    updatePresetActive(wpm);
    await saveSettings({ wpm });
  });

  presetPills.forEach(pill => {
    pill.addEventListener('click', async () => {
      const wpm = parseInt(pill.dataset.wpm, 10);
      sliderWpm.value = wpm;
      inputWpm.value = wpm;
      updatePresetActive(wpm);
      await saveSettings({ wpm });
    });
  });

  sliderAccuracy.addEventListener('input', async () => {
    const acc = parseInt(sliderAccuracy.value, 10);
    valAccuracy.textContent = `${acc}%`;
    await saveSettings({ accuracy: acc });
  });

  toggleTakeover.addEventListener('change', async () => {
    await saveSettings({ autoTakeover: toggleTakeover.checked });
  });

  // Start Typing Test Button
  btnStart.addEventListener('click', async () => {
    if (!targetTab) {
      // Open monkeytype if none open
      await chrome.tabs.create({ url: 'https://monkeytype.com' });
      return;
    }

    // Switch to target tab
    await chrome.tabs.update(targetTab.id, { active: true });

    // Send TRIGGER_START message to content script
    try {
      await chrome.tabs.sendMessage(targetTab.id, { type: 'TRIGGER_START' });
      statusDot.className = 'status-indicator typing';
      tabStatusText.textContent = `⚡ Typing on ${siteName} in progress...`;
    } catch (err) {
      console.warn('Could not message tab directly:', err);
    }
  });

  // Stop Test Button
  btnStop.addEventListener('click', async () => {
    if (targetTab) {
      try {
        await chrome.tabs.sendMessage(targetTab.id, { type: 'TRIGGER_STOP' });
      } catch (err) {}
    }
    updateStatusDot(toggleEnabled.checked);
    tabStatusText.textContent = '🛑 Typing stopped';
  });

  function updatePresetActive(currentWpm) {
    presetPills.forEach(p => {
      if (parseInt(p.dataset.wpm, 10) === currentWpm) {
        p.classList.add('active');
      } else {
        p.classList.remove('active');
      }
    });
  }

  function updateStatusDot(isEnabled) {
    statusDot.className = isEnabled ? 'status-indicator' : 'status-indicator disabled';
  }

  async function saveSettings(partial) {
    await chrome.storage.local.set(partial);
    // Broadcast update to all Monkeytype and Keybr tabs
    const mtTabs = await chrome.tabs.query({ url: '*://*.monkeytype.com/*' });
    const kbTabs = await chrome.tabs.query({ url: '*://*.keybr.com/*' });
    const allTabs = [...mtTabs, ...kbTabs];
    for (const t of allTabs) {
      chrome.tabs.sendMessage(t.id, { type: 'SETTINGS_UPDATED', settings: partial }).catch(() => {});
    }
  }
});

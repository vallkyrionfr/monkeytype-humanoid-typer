// HUD Controller: Manages the in-page Shadow DOM widget, draggable pill,
// real-time WPM/accuracy sliders, presets, toasts, and keyboard shortcuts.

class MonkeytypeHUD {
  constructor(options = {}) {
    this.options = Object.assign({
      wpm: 100,
      accuracy: 98,
      enabled: true,
      autoTakeover: true,
      onSettingsChange: () => {},
      onEmergencyStop: () => {},
      onTogglePause: () => {},
      onStartTyping: () => {}
    }, options);

    this.hostEl = null;
    this.shadow = null;
    this.isMinimized = false;
    this.toastTimeout = null;
  }

  async init() {
    if (document.querySelector('#mttyper-host')) {
      document.querySelector('#mttyper-host').remove();
    }

    this.hostEl = document.createElement('div');
    this.hostEl.id = 'mttyper-host';
    this.hostEl.style.cssText = 'position: fixed; top: 0; left: 0; width: 0; height: 0; z-index: 2147483647; pointer-events: none;';
    this.shadow = this.hostEl.attachShadow({ mode: 'open' });

    // Inject styles directly via <style> tag to ensure zero CSP / network blocking
    const styleEl = document.createElement('style');
    styleEl.textContent = this.getStyles();
    this.shadow.appendChild(styleEl);

    // Build DOM structure
    this.render();
    document.documentElement.appendChild(this.hostEl);

    // Bind event listeners
    this.setupEventListeners();
    this.setupKeyboardShortcuts();
    this.setupDraggable();

    return this;
  }

  getStyles() {
    return `
      :host {
        all: initial;
        font-family: 'Roboto Mono', 'SF Pro Text', monospace;
        font-size: 13px;
        color: #d1d0c5;
        user-select: none;
      }
      .mttyper-container {
        position: fixed;
        top: 20px;
        right: 24px;
        background: rgba(36, 38, 41, 0.96);
        backdrop-filter: blur(12px);
        border: 1px solid rgba(226, 183, 20, 0.35);
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.65);
        border-radius: 12px;
        width: 300px;
        padding: 14px 16px;
        box-sizing: border-box;
        transition: width 0.25s, padding 0.25s, background 0.25s;
        display: flex;
        flex-direction: column;
        gap: 12px;
        pointer-events: auto;
        z-index: 2147483647;
      }
      .mttyper-container.minimized {
        width: auto;
        padding: 8px 14px;
        border-radius: 20px;
        cursor: pointer;
        background: rgba(36, 38, 41, 0.92);
      }
      .mttyper-container.minimized .mttyper-body,
      .mttyper-container.minimized .mttyper-presets,
      .mttyper-container.minimized .mttyper-footer,
      .mttyper-container.minimized .mttyper-btn-start {
        display: none;
      }
      .mttyper-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        cursor: grab;
      }
      .mttyper-header:active {
        cursor: grabbing;
      }
      .mttyper-title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-weight: 700;
        color: #e2b714;
        font-size: 13px;
      }
      .mttyper-status-dot {
        width: 9px;
        height: 9px;
        border-radius: 50%;
        background-color: #646669;
        transition: background-color 0.2s ease;
      }
      .mttyper-status-dot.active {
        background-color: #4cd964;
        box-shadow: 0 0 8px #4cd964;
      }
      .mttyper-status-dot.typing {
        background-color: #e2b714;
        box-shadow: 0 0 10px #e2b714;
        animation: pulse 1s infinite alternate;
      }
      @keyframes pulse {
        from { opacity: 0.6; }
        to { opacity: 1.0; }
      }
      .mttyper-header-actions {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .mttyper-btn-icon {
        background: transparent;
        border: none;
        color: #888;
        font-size: 14px;
        cursor: pointer;
        padding: 2px 6px;
        border-radius: 4px;
        transition: all 0.15s;
      }
      .mttyper-btn-icon:hover {
        color: #fff;
        background: rgba(255, 255, 255, 0.1);
      }
      .mttyper-switch {
        position: relative;
        display: inline-block;
        width: 34px;
        height: 18px;
      }
      .mttyper-switch input {
        opacity: 0;
        width: 0;
        height: 0;
      }
      .mttyper-slider-round {
        position: absolute;
        cursor: pointer;
        top: 0; left: 0; right: 0; bottom: 0;
        background-color: #555;
        transition: 0.25s;
        border-radius: 18px;
      }
      .mttyper-slider-round:before {
        position: absolute;
        content: "";
        height: 14px;
        width: 14px;
        left: 2px;
        bottom: 2px;
        background-color: white;
        transition: 0.25s;
        border-radius: 50%;
      }
      input:checked + .mttyper-slider-round {
        background-color: #e2b714;
      }
      input:checked + .mttyper-slider-round:before {
        transform: translateX(16px);
      }
      .mttyper-btn-start {
        background: #e2b714;
        color: #191b1d;
        border: none;
        border-radius: 6px;
        padding: 8px 12px;
        font-weight: 700;
        font-size: 11px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        transition: all 0.2s;
        font-family: inherit;
        box-shadow: 0 2px 8px rgba(226, 183, 20, 0.3);
      }
      .mttyper-btn-start:hover {
        background: #f1c728;
        transform: translateY(-1px);
      }
      .mttyper-btn-start:active {
        transform: translateY(1px);
      }
      .mttyper-body {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .mttyper-row {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .mttyper-label-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 11px;
        color: #a0a09e;
      }
      .mttyper-val-badge {
        color: #e2b714;
        font-weight: 700;
        font-size: 12px;
      }
      .mttyper-range {
        -webkit-appearance: none;
        appearance: none;
        width: 100%;
        height: 4px;
        background: #474b50;
        border-radius: 2px;
        outline: none;
      }
      .mttyper-range::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: #e2b714;
        cursor: pointer;
        box-shadow: 0 0 6px rgba(226, 183, 20, 0.4);
      }
      .mttyper-presets {
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        gap: 4px;
      }
      .mttyper-preset-btn {
        background: #2b2e32;
        border: 1px solid #44474c;
        color: #d1d0c5;
        padding: 5px 1px;
        border-radius: 6px;
        font-size: 9.5px;
        font-weight: 600;
        text-align: center;
        cursor: pointer;
        transition: all 0.15s ease;
        font-family: inherit;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .mttyper-preset-btn:hover {
        background: #e2b714;
        color: #2c2e31;
        border-color: #e2b714;
      }
      .mttyper-preset-btn.active {
        background: #e2b714;
        color: #191b1d;
        border-color: #e2b714;
      }
      .mttyper-footer {
        border-top: 1px solid rgba(255, 255, 255, 0.08);
        padding-top: 8px;
        display: flex;
        flex-direction: column;
        gap: 4px;
        font-size: 10px;
        color: #7e8287;
      }
      .mttyper-shortcut-line {
        display: flex;
        justify-content: space-between;
      }
      .mttyper-kbd {
        background: #2b2e32;
        color: #e2b714;
        padding: 1px 4px;
        border-radius: 3px;
        font-size: 9px;
        border: 1px solid rgba(255, 255, 255, 0.05);
      }
      .mttyper-toast {
        position: fixed;
        top: 30px;
        left: 50%;
        transform: translateX(-50%) translateY(-20px);
        background: rgba(26, 28, 30, 0.96);
        border: 1px solid #e2b714;
        color: #e2b714;
        padding: 8px 18px;
        border-radius: 20px;
        font-size: 13px;
        font-weight: 600;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.6);
        opacity: 0;
        pointer-events: none;
        transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        z-index: 2147483647;
      }
      .mttyper-toast.visible {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }
    `;
  }

  render() {
    const wrapper = document.createElement('div');
    wrapper.className = 'mttyper-container';
    wrapper.id = 'mttyper-panel';

    wrapper.innerHTML = `
      <div class="mttyper-header" id="mttyper-header">
        <div class="mttyper-title">
          <div class="mttyper-status-dot active" id="mttyper-status"></div>
          <span>Humanoid Typer</span>
        </div>
        <div class="mttyper-header-actions">
          <label class="mttyper-switch" title="Enable / Disable Auto-Typer">
            <input type="checkbox" id="mttyper-toggle-enabled" ${this.options.enabled ? 'checked' : ''}>
            <span class="mttyper-slider-round"></span>
          </label>
          <button class="mttyper-btn-icon" id="mttyper-btn-minimize" title="Minimize">–</button>
        </div>
      </div>

      <button class="mttyper-btn-start" id="mttyper-btn-start-now">
        <span>🚀</span> Start Typing Test Now
      </button>

      <div class="mttyper-body">
        <div class="mttyper-row">
          <div class="mttyper-label-row">
            <span>Speed</span>
            <span class="mttyper-val-badge" id="mttyper-val-wpm">${this.options.wpm} WPM</span>
          </div>
          <input type="range" class="mttyper-range" id="mttyper-range-wpm" min="30" max="500" step="5" value="${this.options.wpm}">
        </div>

        <div class="mttyper-presets">
          <button class="mttyper-preset-btn ${this.options.wpm === 60 ? 'active' : ''}" data-wpm="60">Casual</button>
          <button class="mttyper-preset-btn ${this.options.wpm === 100 ? 'active' : ''}" data-wpm="100">Fast</button>
          <button class="mttyper-preset-btn ${this.options.wpm === 160 ? 'active' : ''}" data-wpm="160">Pro</button>
          <button class="mttyper-preset-btn ${this.options.wpm === 250 ? 'active' : ''}" data-wpm="250">God</button>
          <button class="mttyper-preset-btn ${this.options.wpm === 500 ? 'active' : ''}" data-wpm="500">Hyper</button>
        </div>

        <div class="mttyper-row">
          <div class="mttyper-label-row">
            <span>Accuracy</span>
            <span class="mttyper-val-badge" id="mttyper-val-acc">${this.options.accuracy}%</span>
          </div>
          <input type="range" class="mttyper-range" id="mttyper-range-acc" min="90" max="100" step="1" value="${this.options.accuracy}">
        </div>

        <div class="mttyper-row" style="flex-direction: row; justify-content: space-between; align-items: center; margin-top: 2px;">
          <span style="font-size: 11px; color: #a0a09e;">Auto-Takeover</span>
          <input type="checkbox" id="mttyper-check-takeover" ${this.options.autoTakeover ? 'checked' : ''} style="cursor: pointer; accent-color: #e2b714;">
        </div>
      </div>

      <div class="mttyper-footer">
        <div class="mttyper-shortcut-line">
          <span>Toggle ON/OFF</span>
          <span class="mttyper-kbd">Alt + T</span>
        </div>
        <div class="mttyper-shortcut-line">
          <span>Speed ±10 WPM</span>
          <span class="mttyper-kbd">Alt + ↑ / ↓</span>
        </div>
        <div class="mttyper-shortcut-line">
          <span>Pause / Resume</span>
          <span class="mttyper-kbd">Alt + P</span>
        </div>
        <div class="mttyper-shortcut-line">
          <span>Emergency Stop</span>
          <span class="mttyper-kbd">Esc</span>
        </div>
      </div>

      <div class="mttyper-toast" id="mttyper-toast"></div>
    `;

    this.shadow.appendChild(wrapper);
  }

  setupEventListeners() {
    const $ = (sel) => this.shadow.querySelector(sel);

    // Direct Start button
    $('#mttyper-btn-start-now').addEventListener('click', () => {
      this.options.onStartTyping();
      this.showToast('🚀 Bot Engaged');
    });

    // Toggle Enabled switch
    $('#mttyper-toggle-enabled').addEventListener('change', (e) => {
      this.options.enabled = e.target.checked;
      this.updateStatusDot();
      this.notifyChange();
      this.showToast(this.options.enabled ? 'Auto-Typer: ON' : 'Auto-Typer: OFF');
    });

    // WPM Slider
    const rangeWpm = $('#mttyper-range-wpm');
    const valWpm = $('#mttyper-val-wpm');
    rangeWpm.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      this.options.wpm = val;
      valWpm.textContent = `${val} WPM`;
      this.updatePresetButtons(val);
      this.notifyChange();
    });

    // Accuracy Slider
    const rangeAcc = $('#mttyper-range-acc');
    const valAcc = $('#mttyper-val-acc');
    rangeAcc.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      this.options.accuracy = val;
      valAcc.textContent = `${val}%`;
      this.notifyChange();
    });

    // Auto-Takeover checkbox
    $('#mttyper-check-takeover').addEventListener('change', (e) => {
      this.options.autoTakeover = e.target.checked;
      this.notifyChange();
      this.showToast(this.options.autoTakeover ? 'Auto-Takeover: ON' : 'Auto-Takeover: OFF');
    });

    // Presets
    const presetBtns = this.shadow.querySelectorAll('.mttyper-preset-btn');
    presetBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const wpm = parseInt(btn.dataset.wpm, 10);
        this.options.wpm = wpm;
        rangeWpm.value = wpm;
        valWpm.textContent = `${wpm} WPM`;
        this.updatePresetButtons(wpm);
        this.notifyChange();
        this.showToast(`Preset: ${btn.textContent} (${wpm} WPM)`);
      });
    });

    // Minimize button
    const minBtn = $('#mttyper-btn-minimize');
    const panel = $('#mttyper-panel');
    minBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleMinimize();
    });

    panel.addEventListener('click', (e) => {
      if (this.isMinimized && e.target !== $('#mttyper-toggle-enabled')) {
        this.toggleMinimize();
      }
    });
  }

  toggleMinimize() {
    this.isMinimized = !this.isMinimized;
    const panel = this.shadow.querySelector('#mttyper-panel');
    const minBtn = this.shadow.querySelector('#mttyper-btn-minimize');
    if (this.isMinimized) {
      panel.classList.add('minimized');
      minBtn.textContent = '+';
      minBtn.title = 'Expand';
    } else {
      panel.classList.remove('minimized');
      minBtn.textContent = '–';
      minBtn.title = 'Minimize';
    }
  }

  updatePresetButtons(currentWpm) {
    const presetBtns = this.shadow.querySelectorAll('.mttyper-preset-btn');
    presetBtns.forEach((btn) => {
      if (parseInt(btn.dataset.wpm, 10) === currentWpm) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  setStatus(state) {
    const dot = this.shadow.querySelector('#mttyper-status');
    if (!dot) return;

    dot.classList.remove('active', 'typing');
    if (state === 'typing') {
      dot.classList.add('typing');
    } else if (state === 'idle' && this.options.enabled) {
      dot.classList.add('active');
    }
  }

  updateStatusDot() {
    this.setStatus(this.options.enabled ? 'idle' : 'disabled');
  }

  showToast(message) {
    const toast = this.shadow.querySelector('#mttyper-toast');
    if (!toast) return;

    toast.textContent = message;
    toast.classList.add('visible');

    if (this.toastTimeout) clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => {
      toast.classList.remove('visible');
    }, 1600);
  }

  notifyChange() {
    if (typeof this.options.onSettingsChange === 'function') {
      this.options.onSettingsChange({
        enabled: this.options.enabled,
        wpm: this.options.wpm,
        accuracy: this.options.accuracy,
        autoTakeover: this.options.autoTakeover
      });
    }

    if (chrome?.storage?.local) {
      chrome.storage.local.set({
        enabled: this.options.enabled,
        wpm: this.options.wpm,
        accuracy: this.options.accuracy,
        autoTakeover: this.options.autoTakeover
      });
    }
  }

  setupKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.options.onEmergencyStop();
        this.showToast('🛑 Stopped');
        return;
      }

      if (e.altKey && (e.key === 't' || e.key === 'T')) {
        e.preventDefault();
        const toggle = this.shadow.querySelector('#mttyper-toggle-enabled');
        if (toggle) {
          toggle.checked = !toggle.checked;
          toggle.dispatchEvent(new Event('change'));
        }
        return;
      }

      if (e.altKey && e.key === 'ArrowUp') {
        e.preventDefault();
        const newWpm = Math.min(500, this.options.wpm + 10);
        this.setSpeed(newWpm);
        return;
      }

      if (e.altKey && e.key === 'ArrowDown') {
        e.preventDefault();
        const newWpm = Math.max(30, this.options.wpm - 10);
        this.setSpeed(newWpm);
        return;
      }

      if (e.altKey && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        const isPaused = this.options.onTogglePause();
        this.showToast(isPaused ? '⏸️ Paused' : '▶️ Resumed');
        return;
      }
    }, true);
  }

  setSpeed(wpm) {
    this.options.wpm = wpm;
    const range = this.shadow.querySelector('#mttyper-range-wpm');
    const badge = this.shadow.querySelector('#mttyper-val-wpm');
    if (range) range.value = wpm;
    if (badge) badge.textContent = `${wpm} WPM`;
    this.updatePresetButtons(wpm);
    this.notifyChange();
    this.showToast(`Speed: ${wpm} WPM`);
  }

  setupDraggable() {
    const header = this.shadow.querySelector('#mttyper-header');
    const panel = this.shadow.querySelector('#mttyper-panel');

    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let initialLeft = 0;
    let initialTop = 0;

    header.addEventListener('mousedown', (e) => {
      if (e.target.closest('button') || e.target.closest('label')) return;

      isDragging = true;
      const rect = panel.getBoundingClientRect();
      startX = e.clientX;
      startY = e.clientY;
      initialLeft = rect.left;
      initialTop = rect.top;

      panel.style.transition = 'none';

      const onMouseMove = (ev) => {
        if (!isDragging) return;
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        panel.style.left = `${Math.max(10, Math.min(window.innerWidth - rect.width - 10, initialLeft + dx))}px`;
        panel.style.top = `${Math.max(10, Math.min(window.innerHeight - rect.height - 10, initialTop + dy))}px`;
        panel.style.right = 'auto';
      };

      const onMouseUp = () => {
        isDragging = false;
        panel.style.transition = '';
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    });
  }
}

window.MonkeytypeHUD = MonkeytypeHUD;

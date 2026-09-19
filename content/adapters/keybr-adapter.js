// Keybr.com Site Adapter
// Extracts active practice target, tracks untyped characters across words,
// and dispatches trusted hardware-level keystrokes via background CDP typing stream with full acknowledgment.

class KeybrAdapter extends BaseSiteAdapter {
  constructor() {
    super();
    this.port = null;
    this.container = null;
    this.textarea = null;
    this.pendingRequests = new Map();
    this.reqIdCounter = 0;
    this.supportsRollover = false; // Keybr uses CDP sequential trusted stream
  }

  init() {
    this.connectCdpPort();
    return this;
  }

  connectCdpPort() {
    if (this.port) return;
    try {
      this.port = chrome.runtime.connect({ name: 'typing-stream' });
      this.port.postMessage({ action: 'ATTACH' });

      this.port.onMessage.addListener((msg) => {
        if (!msg) return;

        if (msg.id && this.pendingRequests.has(msg.id)) {
          const req = this.pendingRequests.get(msg.id);
          this.pendingRequests.delete(msg.id);
          if (req.timeoutId) clearTimeout(req.timeoutId);

          if (msg.type?.includes('ERROR')) {
            req.reject(new Error(msg.error || 'CDP dispatch failed'));
          } else {
            req.resolve(msg);
          }
        }
      });

      this.port.onDisconnect.addListener(() => {
        this.port = null;
        for (const [id, req] of this.pendingRequests.entries()) {
          if (req.timeoutId) clearTimeout(req.timeoutId);
          req.reject(new Error('CDP port disconnected'));
        }
        this.pendingRequests.clear();
      });
    } catch (err) {
      console.warn('[Keybr Adapter] Could not connect to background typing-stream:', err);
    }
  }

  findContainer() {
    const direct = document.querySelector('.VWtF2mmR6I, .TextInput');
    if (direct && direct.children.length > 0) return direct;

    const sample = Array.from(document.querySelectorAll('span')).find(s => s.textContent.includes('\ue000'));
    if (!sample) return null;
    let p = sample.parentElement;
    while (p && p.children.length < 5) {
      p = p.parentElement;
    }
    return p;
  }

  isTestActive() {
    const c = this.findContainer();
    return Boolean(c && c.children.length > 0 && !this.isResultVisible());
  }

  isResultVisible() {
    const modal = document.querySelector('[class*="modal"], [class*="dialog"]');
    return Boolean(modal && modal.offsetHeight > 0);
  }

  focusInput() {
    if (!this.textarea || !document.contains(this.textarea)) {
      this.textarea = document.querySelector('textarea');
    }
    if (this.textarea) {
      this.textarea.focus();
    }
  }

  /**
   * Find the current active cursor element in Keybr
   */
  findCursor() {
    // 1. Direct class check (Keybr's minified cursor class)
    const active = document.querySelector('.nc1oZcWRbC');
    if (active && document.contains(active)) return active;

    // 2. Structural scan: find first span that is not already marked as hit
    const container = this.findContainer();
    if (!container) return null;

    const words = Array.from(container.children);
    for (const w of words) {
      const spans = Array.from(w.querySelectorAll('span'));
      for (const s of spans) {
        const style = s.getAttribute('style') || '';
        // Skip hits
        if (style.includes('hit__color')) continue;
        if (s.textContent.length > 0) {
          return s;
        }
      }
    }

    return null;
  }

  /**
   * Get target character or word to type on Keybr.
   * Returns { fullWord, remainingText, isWordBoundary } or null
   */
  getRemainingTarget() {
    const cursor = this.findCursor();
    if (!cursor) return null;

    const wordEl = cursor.closest('span[style*="inline-block"]') || cursor.parentElement;
    const fullWord = (wordEl ? wordEl.textContent : '').replace(/\ue000/g, ' ');

    const rawCursorText = cursor.textContent;
    const isSpaceGlyph = rawCursorText === '\ue000';

    if (isSpaceGlyph) {
      return {
        fullWord,
        remainingText: '',
        isWordBoundary: true
      };
    }

    // Extract untyped characters from cursor onwards (excluding the trailing space glyph)
    let remainingText = '';
    if (wordEl) {
      const spans = Array.from(wordEl.querySelectorAll('span'));
      const idx = spans.indexOf(cursor);
      if (idx !== -1) {
        for (let i = idx; i < spans.length; i++) {
          const t = spans[i].textContent;
          if (t !== '\ue000') {
            remainingText += t;
          }
        }
      } else {
        remainingText = rawCursorText;
      }
    } else {
      remainingText = rawCursorText;
    }

    return {
      fullWord,
      remainingText,
      isWordBoundary: remainingText.length === 0
    };
  }

  async sendCdpCommand(action, payload, timeoutMs = 2500) {
    this.focusInput();
    if (!this.port) {
      this.connectCdpPort();
      await new Promise(r => setTimeout(r, 60));
    }

    if (!this.port) {
      throw new Error('CDP port unavailable');
    }

    const id = ++this.reqIdCounter;
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(id);
        resolve({ timedOut: true });
      }, timeoutMs);

      this.pendingRequests.set(id, { resolve, reject, timeoutId });
      this.port.postMessage(Object.assign({ action, id }, payload));
    });
  }

  async dispatchKeystroke(char, dwellTime) {
    const oldCursor = this.findCursor();
    const isSpace = (char === ' ');

    await this.sendCdpCommand('KEY', { char, dwellTime: dwellTime || 28 });

    if (isSpace) {
      // If we just typed Space to complete a word, wait for Keybr to transition to the next word
      const startWait = performance.now();
      while (performance.now() - startWait < 300) {
        const cur = this.findCursor();
        if (cur && cur !== oldCursor && cur.textContent !== '\ue000') {
          break;
        }
        await new Promise(r => setTimeout(r, 10));
      }
    } else {
      // For character keystrokes, wait until cursor advances
      const startWait = performance.now();
      while (performance.now() - startWait < 150) {
        const cur = this.findCursor();
        if (cur && cur !== oldCursor) {
          break;
        }
        await new Promise(r => setTimeout(r, 8));
      }
    }
  }

  async dispatchBackspace(dwellTime) {
    await this.sendCdpCommand('BACKSPACE', { dwellTime: dwellTime || 28 });
  }

  destroy() {
    super.destroy();
    if (this.port) {
      try {
        this.port.postMessage({ action: 'DETACH' });
        this.port.disconnect();
      } catch (err) {}
      this.port = null;
    }
  }
}

window.KeybrAdapter = KeybrAdapter;

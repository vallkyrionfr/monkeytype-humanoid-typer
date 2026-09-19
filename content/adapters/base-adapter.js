// Base Site Adapter Interface for Typing Sites

class BaseSiteAdapter {
  constructor() {
    this.stateListeners = [];
    this.currentStatus = 'idle';
    this.supportsRollover = false;
  }

  init() {
    return this;
  }

  isTestActive() {
    return false;
  }

  isResultVisible() {
    return false;
  }

  focusInput() {}

  /**
   * Get target character or word to type.
   * Return: { fullWord, remainingText, isWordBoundary } or null
   */
  getRemainingTarget() {
    return null;
  }

  pressKey(char) {
    return null;
  }

  releaseKey(char) {}

  releaseAllKeys(keys = []) {}

  async dispatchKeystroke(char, dwellTime) {}

  async dispatchBackspace(dwellTime) {}

  onStateChange(callback) {
    this.stateListeners.push(callback);
  }

  notifyState(newStatus, prevStatus) {
    for (const cb of this.stateListeners) {
      try {
        cb(newStatus, prevStatus);
      } catch (err) {
        console.error('[Typer Adapter] State error:', err);
      }
    }
  }

  destroy() {
    this.stateListeners = [];
  }
}

window.BaseSiteAdapter = BaseSiteAdapter;

// Monkeytype Site Adapter
// Implements DOM extraction and the verified beforeinput/input event pipeline

class MonkeytypeAdapter extends BaseSiteAdapter {
  constructor() {
    super();
    this.wordsTracker = null;
    this.inputEl = null;
    this.supportsRollover = true;
  }

  init() {
    this.wordsTracker = new MonkeytypeWordsTracker().init();
    this.wordsTracker.onStateChange((newStatus, prevStatus) => {
      this.notifyState(newStatus, prevStatus);
    });
    return this;
  }

  isTestActive() {
    return this.wordsTracker ? this.wordsTracker.isTestActive() : false;
  }

  isResultVisible() {
    return this.wordsTracker ? this.wordsTracker.isResultVisible() : false;
  }

  focusInput() {
    const input = this.wordsTracker?.getInputElement();
    if (input) {
      input.focus();
    }
  }

  getRemainingTarget() {
    const info = this.wordsTracker?.getRemainingForActiveWord();
    if (!info) return null;

    return {
      fullWord: info.fullWord,
      remainingText: info.remainingText,
      isWordBoundary: info.remainingText.length === 0
    };
  }

  getKeyCode(char) {
    if (char === ' ') return 'Space';
    if (char === '\n') return 'Enter';
    if (char === '\t') return 'Tab';
    if (char >= '0' && char <= '9') return `Digit${char}`;
    if (char.toLowerCase() >= 'a' && char.toLowerCase() <= 'z') return `Key${char.toUpperCase()}`;
    if (char === ',') return 'Comma';
    if (char === '.') return 'Period';
    if (char === ';') return 'Semicolon';
    if (char === '\'') return 'Quote';
    if (char === '-') return 'Minus';
    if (char === '/') return 'Slash';
    return 'Unidentified';
  }

  pressKey(char) {
    const inputEl = this.wordsTracker?.getInputElement();
    if (!inputEl) return null;

    const code = this.getKeyCode(char);
    const isUpper = char !== ' ' && char === char.toUpperCase() && char.toLowerCase() !== char.toUpperCase();

    // 1. Keydown event (logged in Monkeytype eventLog)
    inputEl.dispatchEvent(new KeyboardEvent('keydown', {
      key: char,
      code,
      bubbles: true,
      shiftKey: isUpper
    }));

    // 2. Beforeinput event
    inputEl.dispatchEvent(new InputEvent('beforeinput', {
      inputType: 'insertText',
      data: char,
      bubbles: true,
      cancelable: true
    }));

    // 3. Update textarea content value
    inputEl.value += char;

    // 4. Input event (triggers Monkeytype's onInsertText handler)
    inputEl.dispatchEvent(new InputEvent('input', {
      inputType: 'insertText',
      data: char,
      bubbles: true
    }));

    return { char, code, isUpper };
  }

  releaseKey(char) {
    const inputEl = this.wordsTracker?.getInputElement();
    if (!inputEl) return;

    const code = this.getKeyCode(char);
    const isUpper = char !== ' ' && char === char.toUpperCase() && char.toLowerCase() !== char.toUpperCase();

    // Keyup event (logged in Monkeytype eventLog to compute keypress duration & keyOverlap)
    inputEl.dispatchEvent(new KeyboardEvent('keyup', {
      key: char,
      code,
      bubbles: true,
      shiftKey: isUpper
    }));
  }

  releaseAllKeys(keys = []) {
    for (const key of keys) {
      if (typeof key === 'string') {
        this.releaseKey(key);
      } else if (key?.char) {
        this.releaseKey(key.char);
      }
    }
  }

  async dispatchKeystroke(char, dwellTime) {
    const keyInfo = this.pressKey(char);
    if (!keyInfo) return;

    if (dwellTime > 0) {
      await new Promise(r => setTimeout(r, dwellTime));
    }

    this.releaseKey(char);
  }

  async dispatchBackspace(dwellTime) {
    const inputEl = this.wordsTracker?.getInputElement();
    if (!inputEl) return;

    // 1. Keydown Backspace
    inputEl.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Backspace',
      code: 'Backspace',
      bubbles: true
    }));

    // 2. Beforeinput deleteContentBackward
    inputEl.dispatchEvent(new InputEvent('beforeinput', {
      inputType: 'deleteContentBackward',
      bubbles: true,
      cancelable: true
    }));

    // 3. Update value (preserving the initial leading space)
    if (inputEl.value.length > 1) {
      inputEl.value = inputEl.value.slice(0, -1);
    }

    // 4. Input event deleteContentBackward
    inputEl.dispatchEvent(new InputEvent('input', {
      inputType: 'deleteContentBackward',
      bubbles: true
    }));

    if (dwellTime > 0) {
      await new Promise(r => setTimeout(r, dwellTime));
    }

    // 5. Keyup Backspace
    inputEl.dispatchEvent(new KeyboardEvent('keyup', {
      key: 'Backspace',
      code: 'Backspace',
      bubbles: true
    }));
  }
}

window.MonkeytypeAdapter = MonkeytypeAdapter;

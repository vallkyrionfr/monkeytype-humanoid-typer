// WordsTracker: High-precision DOM extractor and state observer for Monkeytype
// Handles active words, dynamic word streaming, timed test scrolling, and test lifecycle events.

class MonkeytypeWordsTracker {
  constructor() {
    this.wordsInput = null;
    this.wordsContainer = null;
    this.stateListeners = [];
    this.isObserving = false;
    this.currentStatus = 'idle'; // 'idle' | 'running' | 'finished'
    this.observer = null;
  }

  init() {
    this.findDOMElements();
    this.setupObserver();
    return this;
  }

  findDOMElements() {
    this.wordsInput = document.querySelector('#wordsInput');
    this.wordsContainer = document.querySelector('#words');
    return Boolean(this.wordsInput && this.wordsContainer);
  }

  getInputElement() {
    if (!this.wordsInput || !document.contains(this.wordsInput)) {
      this.wordsInput = document.querySelector('#wordsInput');
    }
    return this.wordsInput;
  }

  getWordsContainer() {
    if (!this.wordsContainer || !document.contains(this.wordsContainer)) {
      this.wordsContainer = document.querySelector('#words');
    }
    return this.wordsContainer;
  }

  /**
   * Check if a test is currently underway (words are visible, input is ready, results not showing)
   */
  isTestActive() {
    const input = this.getInputElement();
    const words = this.getWordsContainer();
    const result = document.querySelector('#result');

    if (!input || !words) return false;

    // If result screen is displayed and not hidden
    if (result && !result.classList.contains('hidden') && result.offsetHeight > 0) {
      return false;
    }

    // Check if words wrapper is visible
    if (words.classList.contains('hidden') || words.offsetHeight === 0) {
      return false;
    }

    const activeWord = words.querySelector('.word.active');
    return Boolean(activeWord);
  }

  isResultVisible() {
    const result = document.querySelector('#result');
    return Boolean(result && !result.classList.contains('hidden') && result.offsetHeight > 0);
  }

  /**
   * Get the active word element (.word.active)
   */
  getActiveWordElement() {
    const container = this.getWordsContainer();
    if (!container) return null;
    return container.querySelector('.word.active');
  }

  /**
   * Extract full target text for a word element from its child <letter> tags
   */
  getWordText(wordEl) {
    if (!wordEl) return '';
    const letters = wordEl.querySelectorAll('letter');
    if (letters.length > 0) {
      let text = '';
      for (const letter of letters) {
        text += letter.textContent;
      }
      return text;
    }
    return wordEl.textContent.trim();
  }

  /**
   * Calculate what characters remain to be typed for the active word.
   * Takes into account any characters already entered by the user.
   */
  getRemainingForActiveWord() {
    const activeWordEl = this.getActiveWordElement();
    if (!activeWordEl) return null;

    const fullWord = this.getWordText(activeWordEl);
    const letters = activeWordEl.querySelectorAll('letter');

    if (letters.length === 0) {
      return {
        fullWord,
        remainingText: fullWord,
        typedCount: 0
      };
    }

    let typedCount = 0;
    for (let i = 0; i < letters.length; i++) {
      const l = letters[i];
      // Check if this letter is already marked correct, incorrect, or extra
      if (l.classList.contains('correct') || l.classList.contains('incorrect')) {
        typedCount = i + 1;
      } else {
        break;
      }
    }

    const remainingText = fullWord.slice(typedCount);

    return {
      fullWord,
      remainingText,
      typedCount
    };
  }

  /**
   * Get upcoming words in sequence from the DOM
   */
  getUpcomingWords(limit = 50) {
    const container = this.getWordsContainer();
    if (!container) return [];

    const activeWordEl = this.getActiveWordElement();
    if (!activeWordEl) return [];

    const allWords = Array.from(container.querySelectorAll('.word'));
    const activeIndex = allWords.indexOf(activeWordEl);

    if (activeIndex === -1) return [];

    const upcoming = [];
    for (let i = activeIndex + 1; i < allWords.length && upcoming.length < limit; i++) {
      const text = this.getWordText(allWords[i]);
      if (text) {
        upcoming.push(text);
      }
    }

    return upcoming;
  }

  /**
   * Set up mutation observer to monitor DOM state transitions (test start, reset, finish)
   */
  setupObserver() {
    if (this.observer) {
      this.observer.disconnect();
    }

    this.observer = new MutationObserver(() => {
      this.checkStateTransition();
    });

    const target = document.querySelector('#testWrapper') || document.body;
    this.observer.observe(target, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style']
    });

    this.isObserving = true;
  }

  checkStateTransition() {
    const isNowActive = this.isTestActive();
    const isResult = this.isResultVisible();

    let newStatus = 'idle';
    if (isResult) {
      newStatus = 'finished';
    } else if (isNowActive) {
      newStatus = 'running';
    }

    if (newStatus !== this.currentStatus) {
      const prevStatus = this.currentStatus;
      this.currentStatus = newStatus;
      this.notifyStateListeners(newStatus, prevStatus);
    }
  }

  onStateChange(callback) {
    this.stateListeners.push(callback);
  }

  notifyStateListeners(newStatus, prevStatus) {
    for (const cb of this.stateListeners) {
      try {
        cb(newStatus, prevStatus);
      } catch (err) {
        console.error('[Monkeytype Typer] State listener error:', err);
      }
    }
  }

  destroy() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    this.stateListeners = [];
  }
}

// Attach to window so it is accessible across scripts
window.MonkeytypeWordsTracker = MonkeytypeWordsTracker;

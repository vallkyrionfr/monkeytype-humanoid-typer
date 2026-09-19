// Humanoid Typing Engine
// Emulates authentic neuromuscular cadence: key rollover overlap (bypassing validateKeys anticheat),
// biomechanical dwell time variance, word-level velocity bursts, macro-drift pacing waves,
// gentle closed-loop compensation, adjacent QWERTY typos, and cognitive backspace corrections.

class HumanoidTypingEngine {
  constructor(siteAdapter) {
    this.adapter = siteAdapter;
    this.isRunning = false;
    this.isPaused = false;
    this.cancelRequested = false;

    // Configurable parameters
    this.wpm = 100;
    this.accuracy = 98; // percentage (85 - 100)
    this.variance = 0.26; // std dev for authentic 65-76% consistency
    this.simulateTypos = true;

    // Pacing & consistency tracking
    this.startTime = 0;
    this.totalCharsTyped = 0;
    this.wavePhase = Math.random() * Math.PI * 2;

    // Active held key for authentic key rollover overlap
    this.activeHeldKey = null;

    // Common fluent English digraphs
    this.fluentBigrams = new Set([
      'th', 'he', 'in', 'er', 'an', 're', 'on', 'at', 'en', 'nd',
      'ti', 'es', 'or', 'te', 'of', 'ed', 'is', 'it', 'al', 'ar',
      'st', 'to', 'nt', 'ng', 'se', 'ha', 'as', 'ou', 'io', 'le'
    ]);

    // QWERTY physical keyboard neighbor layout for realistic typos
    this.keyboardNeighbors = {
      q: ['w', 'a', '1', '2'],
      w: ['q', 'e', 's', 'a', '3'],
      e: ['w', 'r', 'd', 's', '4'],
      r: ['e', 't', 'f', 'd', '5'],
      t: ['r', 'y', 'g', 'f', '6'],
      y: ['t', 'u', 'h', 'g', '7'],
      u: ['y', 'i', 'j', 'h', '8'],
      i: ['u', 'o', 'k', 'j', '9'],
      o: ['i', 'p', 'l', 'k', '0'],
      p: ['o', '[', ';', 'l', '-'],
      a: ['q', 'w', 's', 'z'],
      s: ['a', 'w', 'e', 'd', 'x', 'z'],
      d: ['s', 'e', 'r', 'f', 'c', 'x'],
      f: ['d', 'r', 't', 'g', 'v', 'c'],
      g: ['f', 't', 'y', 'h', 'b', 'v'],
      h: ['g', 'y', 'u', 'j', 'n', 'b'],
      j: ['h', 'u', 'i', 'k', 'm', 'n'],
      k: ['j', 'i', 'o', 'l', ',', 'm'],
      l: ['k', 'o', 'p', ';', '.', ','],
      z: ['a', 's', 'x'],
      x: ['z', 's', 'd', 'c'],
      c: ['x', 'd', 'f', 'v'],
      v: ['c', 'f', 'g', 'b'],
      b: ['v', 'g', 'h', 'n'],
      n: ['b', 'h', 'j', 'm'],
      m: ['n', 'j', 'k', ','],
      '1': ['2', 'q'],
      '2': ['1', '3', 'w', 'q'],
      '3': ['2', '4', 'e', 'w'],
      '4': ['3', '5', 'r', 'e'],
      '5': ['4', '6', 't', 'r'],
      '6': ['5', '7', 'y', 't'],
      '7': ['6', '8', 'u', 'y'],
      '8': ['7', '9', 'i', 'u'],
      '9': ['8', '0', 'o', 'i'],
      '0': ['9', '-', 'p', 'o']
    };
  }

  setAdapter(adapter) {
    this.adapter = adapter;
  }

  updateSettings(settings) {
    if (typeof settings.wpm === 'number') this.wpm = Math.max(20, Math.min(500, settings.wpm));
    if (typeof settings.accuracy === 'number') this.accuracy = Math.max(85, Math.min(100, settings.accuracy));
    if (typeof settings.burstVariance === 'number') this.variance = settings.burstVariance;
    if (typeof settings.simulateTypoCorrections === 'boolean') this.simulateTypos = settings.simulateTypoCorrections;
  }

  gaussianRandom(mean, stdDev) {
    const u1 = Math.max(1e-6, Math.random());
    const u2 = Math.random();
    const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    return Math.max(4, mean + z * stdDev);
  }

  /**
   * Biomechanical dwell time calculation (spacebar vs home-row vs outer keys)
   * Produces realistic keyDurationStats.sd to satisfy anticheat at standard speeds,
   * while scaling gracefully up to 500 WPM.
   */
  calculateDwellTime(char = 'e') {
    const speedFactor = Math.max(0.22, Math.min(1.25, 110 / this.wpm));
    let mean = 46 * speedFactor;
    let sd = 13 * speedFactor;

    if (char === ' ') {
      // Spacebar thumb press: longer dwell
      mean = 68 * speedFactor;
      sd = 17 * speedFactor;
    } else if ('etaoinshrdlu'.includes(char.toLowerCase())) {
      // Common letters: fast and agile
      mean = 44 * speedFactor;
      sd = 11 * speedFactor;
    } else {
      // Outer pinky keys, punctuation, numbers
      mean = 56 * speedFactor;
      sd = 15 * speedFactor;
    }

    return Math.round(this.gaussianRandom(mean, sd));
  }

  /**
   * Calculates realistic human delay with word-burst velocity, macro-waves,
   * and gentle closed-loop compensation without flat horizontal plateaus.
   */
  calculateKeystrokeDelay(char, prevChar, currentWordLength = 5) {
    const baseInterval = 60000.0 / (this.wpm * 5.0);
    let multiplier = 1.0;

    // 1. Word-Length Burst Modulation
    if (currentWordLength <= 3) {
      multiplier *= 0.82; // burst +18%
    } else if (currentWordLength === 4 || currentWordLength === 5) {
      multiplier *= 0.98;
    } else if (currentWordLength >= 7) {
      multiplier *= 1.18; // deceleration on complex words
    }

    // 2. Fluent bigram transition acceleration
    if (prevChar && this.fluentBigrams.has((prevChar + char).toLowerCase())) {
      multiplier *= 0.82;
    }

    // 3. Space / word boundary hesitation (visual scan to next word)
    if (char === ' ') {
      multiplier *= 1.25;
      if (Math.random() < 0.12) {
        multiplier *= 1.30;
      }
    }

    // 4. Capital letter or punctuation delay
    if (char !== ' ' && char === char.toUpperCase() && char.toLowerCase() !== char.toUpperCase()) {
      multiplier *= 1.35;
    } else if (/[.,!?;:'"()/\-]/.test(char)) {
      multiplier *= 1.28;
    }

    // 5. Macro-Wave Pacing Drift (generates natural rolling waves on consistency graph)
    const wave = Math.sin((this.totalCharsTyped / 28.0) + this.wavePhase) * 0.16;
    multiplier *= (1.0 + wave);

    // 6. Adaptive Closed-Loop Pacing Compensator:
    // Tracks real-time elapsed time against target speed, gently accelerating or decelerating
    // to maintain precise average WPM even up to 500 WPM.
    if (this.totalCharsTyped > 4 && this.startTime > 0) {
      const elapsedMs = performance.now() - this.startTime;
      const expectedElapsedMs = (this.totalCharsTyped / 5.0) * (60000.0 / this.wpm);
      const deltaMs = expectedElapsedMs - elapsedMs; // positive if running behind, negative if running ahead
      const windowMs = Math.max(400, (60000.0 / this.wpm) * 12.0);
      const feedback = Math.max(0.40, Math.min(1.80, 1.0 + (deltaMs / windowMs)));
      multiplier *= feedback;
    }

    // Apply Gaussian motor variance
    const stdDev = baseInterval * this.variance;
    const finalDelay = this.gaussianRandom(baseInterval * multiplier, stdDev);

    return Math.max(2, Math.round(finalDelay));
  }

  shouldMakeTypo(char) {
    if (!this.simulateTypos || this.accuracy >= 100) return false;
    if (char === ' ' || char === '\n' || char === '\t') return false;

    // Generates mistakes proportional to (100 - accuracy)%
    const errorThreshold = (100 - this.accuracy) / 100;
    return Math.random() < errorThreshold;
  }

  getNeighborKey(char) {
    const lower = char.toLowerCase();
    const neighbors = this.keyboardNeighbors[lower];
    if (!neighbors || neighbors.length === 0) return 'e';
    const pick = neighbors[Math.floor(Math.random() * neighbors.length)];
    return char === char.toUpperCase() ? pick.toUpperCase() : pick;
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
  }

  stop() {
    this.cancelRequested = true;
    this.isRunning = false;
    this.isPaused = false;
    this.releaseHeldKeys();
  }

  pause() {
    this.isPaused = true;
    this.releaseHeldKeys();
  }

  resume() {
    this.isPaused = false;
  }

  togglePause() {
    this.isPaused = !this.isPaused;
    if (this.isPaused) {
      this.releaseHeldKeys();
    }
    return this.isPaused;
  }

  releaseHeldKeys() {
    if (this.activeHeldKey && this.adapter) {
      try {
        this.adapter.releaseKey(this.activeHeldKey.char);
      } catch (err) {}
      this.activeHeldKey = null;
    }
  }

  /**
   * Dispatch keystroke with authentic key rollover when supported (Monkeytype),
   * or sequential CDP dispatch when using driver streams (Keybr).
   */
  async dispatchKeystrokeWithRollover(char, dwellTime) {
    if (this.adapter.supportsRollover && typeof this.adapter.pressKey === 'function') {
      const isSpace = (char === ' ');
      const isSameKey = this.activeHeldKey && this.activeHeldKey.char.toLowerCase() === char.toLowerCase();

      if (this.activeHeldKey) {
        if (isSameKey || isSpace || this.activeHeldKey.isSpace) {
          // Release immediately before pressing if same key or space transition
          try { this.adapter.releaseKey(this.activeHeldKey.char); } catch (e) {}
          this.activeHeldKey = null;
        } else {
          // Authentic rollover: previous key stays held while new key is pressed,
          // then releases 18-35ms later!
          const prevKey = this.activeHeldKey.char;
          const overlapMean = Math.min(24, Math.max(6, (60000.0 / (this.wpm * 5.0)) * 0.4));
          const overlap = Math.round(this.gaussianRandom(overlapMean, Math.max(1.5, overlapMean * 0.2)));
          setTimeout(() => {
            try { this.adapter.releaseKey(prevKey); } catch (e) {}
          }, overlap);
          this.activeHeldKey = null;
        }
      }

      // Press new key (keydown + beforeinput + input)
      this.adapter.pressKey(char);

      if (isSpace) {
        // Spacebar thumb dwell release
        setTimeout(() => {
          try { this.adapter.releaseKey(' '); } catch (e) {}
        }, dwellTime);
        this.activeHeldKey = null;
      } else {
        this.activeHeldKey = { char, isSpace: false };
      }
    } else {
      // Sequential dispatch (e.g. Keybr CDP trusted stream)
      await this.adapter.dispatchKeystroke(char, dwellTime);
    }
  }

  async start(options = {}) {
    if (this.isRunning) return;
    if (!this.adapter) {
      console.error('[Humanoid Typer] No site adapter attached.');
      return;
    }

    this.isRunning = true;
    this.isPaused = false;
    this.cancelRequested = false;
    this.startTime = performance.now();
    this.totalCharsTyped = 0;
    this.wavePhase = Math.random() * Math.PI * 2;
    this.activeHeldKey = null;

    this.adapter.focusInput();

    console.log(`[Humanoid Typer] Session started at ${this.wpm} WPM (Rollover engine active, ${this.accuracy}% acc)`);

    // Only add initial reaction delay on cold start (not on user keystroke takeover)
    if (!options.isTakeover) {
      const speedScale = Math.max(0.3, Math.min(1.0, 120 / this.wpm));
      const initialDelay = Math.round(this.gaussianRandom(280 * speedScale, 30 * speedScale));
      await this.sleep(initialDelay);
    }

    let prevChar = '';

    try {
      while (this.isRunning && !this.cancelRequested) {
        while (this.isPaused && !this.cancelRequested) {
          await this.sleep(100);
        }
        if (this.cancelRequested) break;

        // Check if test ended or results screen visible
        if (this.adapter.isResultVisible()) {
          console.log('[Humanoid Typer] Test complete! Results detected.');
          break;
        }

        const targetInfo = this.adapter.getRemainingTarget();
        if (!targetInfo) {
          await this.sleep(20);
          if (!this.adapter.isTestActive()) {
            break;
          }
          continue;
        }

        const { fullWord, remainingText } = targetInfo;
        const wordLength = fullWord ? fullWord.length : 5;

        // If active word is already completed (or cursor directly on word boundary), type Space to advance
        if (targetInfo.isWordBoundary || remainingText.length === 0) {
          const delay = this.calculateKeystrokeDelay(' ', prevChar, wordLength);
          const dwell = this.calculateDwellTime(' ');
          await this.sleep(delay);

          if (this.cancelRequested) break;
          await this.dispatchKeystrokeWithRollover(' ', dwell);
          this.totalCharsTyped++;
          prevChar = ' ';

          // Wait for word transition
          const curFull = fullWord;
          const startW = performance.now();
          const maxWordWait = Math.max(30, Math.min(200, (60000.0 / (this.wpm * 5.0)) * 2.5));
          while (performance.now() - startW < maxWordWait) {
            const next = this.adapter.getRemainingTarget();
            if (next && next.fullWord !== curFull && !next.isWordBoundary) {
              break;
            }
            await this.sleep(2);
          }
          continue;
        }

        // Stream all remaining characters of active word with exact humanoid motor intervals
        for (let i = 0; i < remainingText.length; i++) {
          if (this.cancelRequested || !this.isRunning) break;
          while (this.isPaused && !this.cancelRequested) {
            await this.sleep(100);
          }
          if (this.cancelRequested) break;

          const targetChar = remainingText[i];

          // 1. Check for intentional realistic typo
          if (this.shouldMakeTypo(targetChar)) {
            const typoChar = this.getNeighborKey(targetChar);
            const typoDelay = this.calculateKeystrokeDelay(typoChar, prevChar, wordLength);
            const typoDwell = this.calculateDwellTime(typoChar);

            await this.sleep(typoDelay);
            if (this.cancelRequested) break;

            // Dispatch wrong character
            await this.dispatchKeystrokeWithRollover(typoChar, typoDwell);

            // Human cognitive reaction time before realizing the mistake
            const reactionDelay = Math.round(this.gaussianRandom(135, 20));
            await this.sleep(reactionDelay);

            if (this.cancelRequested) break;

            // Release any held key before backspacing
            this.releaseHeldKeys();

            // Dispatch backspace
            const backspaceDwell = this.calculateDwellTime('b');
            await this.adapter.dispatchBackspace(backspaceDwell);

            // Brief recovery hesitation before typing the correct key
            const recoveryDelay = Math.round(this.gaussianRandom(55, 12));
            await this.sleep(recoveryDelay);
          }

          // 2. Dispatch correct character
          const delay = this.calculateKeystrokeDelay(targetChar, prevChar, wordLength);
          const dwell = this.calculateDwellTime(targetChar);

          await this.sleep(delay);
          if (this.cancelRequested) break;

          await this.dispatchKeystrokeWithRollover(targetChar, dwell);
          this.totalCharsTyped++;
          prevChar = targetChar;
        }

        if (this.cancelRequested || !this.isRunning) break;

        // 3. Complete word with spacebar
        const spaceDelay = this.calculateKeystrokeDelay(' ', prevChar, wordLength);
        const spaceDwell = this.calculateDwellTime(' ');
        await this.sleep(spaceDelay);

        if (this.cancelRequested) break;
        await this.dispatchKeystrokeWithRollover(' ', spaceDwell);
        this.totalCharsTyped++;
        prevChar = ' ';

        // 4. Wait for word transition in DOM
        const curFull = fullWord;
        const startW = performance.now();
        const maxWordWait = Math.max(30, Math.min(200, (60000.0 / (this.wpm * 5.0)) * 2.5));
        while (performance.now() - startW < maxWordWait) {
          const next = this.adapter.getRemainingTarget();
          if (next && next.fullWord !== curFull && !next.isWordBoundary) {
            break;
          }
          await this.sleep(2);
        }
      }
    } catch (err) {
      console.error('[Humanoid Typer] Error in typing loop:', err);
    } finally {
      this.releaseHeldKeys();
      this.isRunning = false;
      console.log(`[Humanoid Typer] Finished. Total characters typed: ${this.totalCharsTyped}`);
    }
  }
}

window.HumanoidTypingEngine = HumanoidTypingEngine;

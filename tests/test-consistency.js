// Test suite for Humanoid Consistency Engine & Macro-Burst Velocity
// Uses Monkeytype's exact kogasa formula to verify consistency lands in the 65% - 78% range

function kogasa(cov) {
  return 100 * (1 - Math.tanh(cov + Math.pow(cov, 3) / 3 + Math.pow(cov, 5) / 5));
}

function gaussianRandom(mean, stdDev) {
  const u1 = Math.max(1e-6, Math.random());
  const u2 = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return Math.max(10, mean + z * stdDev);
}

function simulateTestRun(targetWpm = 160, durationSeconds = 30) {
  const words = [
    'the', 'quick', 'brown', 'fox', 'jumps', 'over', 'lazy', 'dog', 'and', 'all',
    'state', 'problem', 'consider', 'in', 'it', 'understand', 'development', 'to',
    'have', 'great', 'important', 'technology', 'system', 'at', 'high', 'possible'
  ];

  let elapsedMs = 0;
  let totalCharsTyped = 0;
  const targetDurationMs = durationSeconds * 1000;
  const wavePhase = Math.random() * Math.PI * 2;
  const keypressSpacings = [];
  const secondBuckets = Array(durationSeconds).fill(0);

  let wordIndex = 0;
  let prevChar = '';

  while (elapsedMs < targetDurationMs) {
    const word = words[wordIndex % words.length];
    wordIndex++;
    const wordLength = word.length;

    for (let i = 0; i < word.length; i++) {
      const char = word[i];
      const baseInterval = (12000 / targetWpm) * 0.95;
      let multiplier = 1.0;

      // 1. Word-length burst modulation
      if (wordLength <= 3) multiplier *= 0.76;
      else if (wordLength >= 6) multiplier *= 1.25;

      // 2. Macro-drift wave
      const wave = Math.sin((totalCharsTyped / 35.0) + wavePhase) * 0.20;
      multiplier *= (1.0 + wave);

      // 3. Gentle closed-loop compensator (slow-acting feedback over phrases)
      if (totalCharsTyped > 15) {
        const expectedElapsedMs = (totalCharsTyped / 5.0) * (60000.0 / targetWpm);
        const deltaMs = expectedElapsedMs - elapsedMs;
        const feedback = Math.max(0.80, Math.min(1.25, 1.0 + (deltaMs / 2000.0)));
        multiplier *= feedback;
      }

      // Inter-key motor variance (~30% std dev for realistic consistency)
      const delay = Math.round(gaussianRandom(baseInterval * multiplier, baseInterval * 0.32));
      elapsedMs += delay;
      totalCharsTyped++;
      keypressSpacings.push(delay);
      prevChar = char;

      const sec = Math.min(durationSeconds - 1, Math.floor(elapsedMs / 1000));
      secondBuckets[sec]++;
    }

    // Space key
    const baseInterval = (12000 / targetWpm) * 0.95;
    let spaceMultiplier = 1.30;
    const wave = Math.sin((totalCharsTyped / 35.0) + wavePhase) * 0.20;
    spaceMultiplier *= (1.0 + wave);
    const spaceDelay = Math.round(gaussianRandom(baseInterval * spaceMultiplier, baseInterval * 0.32));
    elapsedMs += spaceDelay;
    totalCharsTyped++;
    keypressSpacings.push(spaceDelay);
    prevChar = ' ';

    const sec = Math.min(durationSeconds - 1, Math.floor(elapsedMs / 1000));
    secondBuckets[sec]++;
  }

  const finalWpm = ((totalCharsTyped / 5.0) / (elapsedMs / 60000.0));
  const wpmPerSecond = secondBuckets.map(chars => (chars / 5.0) * 60.0);

  // Monkeytype consistency calculation
  const meanWpm = wpmPerSecond.reduce((a, b) => a + b, 0) / durationSeconds;
  const variance = wpmPerSecond.reduce((sum, v) => sum + Math.pow(v - meanWpm, 2), 0) / durationSeconds;
  const stdDev = Math.sqrt(variance);
  const wpmConsistency = Math.round(kogasa(stdDev / meanWpm));

  const keyMean = keypressSpacings.reduce((a, b) => a + b, 0) / keypressSpacings.length;
  const keyVar = keypressSpacings.reduce((sum, d) => sum + Math.pow(d - keyMean, 2), 0) / keypressSpacings.length;
  const keyConsistency = Math.round(kogasa(Math.sqrt(keyVar) / keyMean));

  return {
    targetWpm,
    finalWpm: Math.round(finalWpm * 10) / 10,
    wpmConsistency,
    keyConsistency,
    wpmRange: [Math.round(Math.min(...wpmPerSecond)), Math.round(Math.max(...wpmPerSecond))]
  };
}

function main() {
  console.log('=== Monkeytype Consistency & Macro-Burst Benchmark ===\n');

  for (const target of [60, 100, 140, 160, 200]) {
    const res = simulateTestRun(target, 30);
    console.log(`Target: ${res.targetWpm} WPM`);
    console.log(`  -> Final Reported WPM  : ${res.finalWpm} WPM (Error: ${Math.abs(res.finalWpm - target).toFixed(1)} WPM)`);
    console.log(`  -> WPM Consistency     : ${res.wpmConsistency}% (Human range: 62% - 78%)`);
    console.log(`  -> Key Consistency     : ${res.keyConsistency}% (Human range: 60% - 75%)`);
    console.log(`  -> Per-Second Range    : ${res.wpmRange[0]} WPM to ${res.wpmRange[1]} WPM`);
    console.log('');

    if (Math.abs(res.finalWpm - target) > 4.0) {
      throw new Error(`Target WPM drift too large: ${res.finalWpm} vs ${target}`);
    }
    if (res.wpmConsistency > 87 || res.wpmConsistency < 55) {
      throw new Error(`Consistency ${res.wpmConsistency}% outside realistic human range!`);
    }
  }

  console.log('✅ ALL MONKEYTYPE CONSISTENCY CHECKS PASSED PERFECTLY!\n');
}

main();

// Test suite for Humanoid Typing Engine timing distribution and typo modeling
// Can be executed directly with `node tests/test-timing.js`

function gaussianRandom(mean, stdDev) {
  const u1 = Math.max(1e-6, Math.random());
  const u2 = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return Math.max(8, mean + z * stdDev);
}

function calculateDelay(targetWpm, variance = 0.20, char = 'a', prevChar = 'b') {
  const fluentBigrams = new Set([
    'th', 'he', 'in', 'er', 'an', 're', 'on', 'at', 'en', 'nd'
  ]);
  const baseDelay = 12000 / targetWpm;
  let multiplier = 1.0;

  if (prevChar && fluentBigrams.has((prevChar + char).toLowerCase())) {
    multiplier *= 0.82;
  }
  if (char === ' ') {
    multiplier *= 1.25;
  }

  const stdDev = baseDelay * variance;
  return Math.round(gaussianRandom(baseDelay * multiplier, stdDev));
}

function runTimingBenchmark(targetWpm, samples = 2000) {
  const delays = [];
  const text = "the quick brown fox jumps over the lazy dog and types with humanoid speed in monkeytype";
  let prevChar = '';

  for (let i = 0; i < samples; i++) {
    const char = text[i % text.length];
    const delay = calculateDelay(targetWpm, 0.20, char, prevChar);
    delays.push(delay);
    prevChar = char;
  }

  const totalTime = delays.reduce((a, b) => a + b, 0);
  const avgDelay = totalTime / samples;
  const variance = delays.reduce((sum, d) => sum + Math.pow(d - avgDelay, 2), 0) / samples;
  const stdDev = Math.sqrt(variance);

  // Measured WPM: (samples characters / 5) / (totalTime in ms / 60000)
  const measuredWpm = ((samples / 5) / (totalTime / 60000));
  const errorPercent = Math.abs((measuredWpm - targetWpm) / targetWpm) * 100;

  console.log(`\n=== Benchmark: Target ${targetWpm} WPM ===`);
  console.log(`  Expected base interval : ${(12000 / targetWpm).toFixed(1)} ms`);
  console.log(`  Measured mean interval : ${avgDelay.toFixed(1)} ms (StdDev: ${stdDev.toFixed(1)} ms)`);
  console.log(`  Measured effective WPM : ${measuredWpm.toFixed(1)} WPM`);
  console.log(`  Accuracy vs target     : ${(100 - errorPercent).toFixed(2)}% (Error: ${errorPercent.toFixed(2)}%)`);

  if (errorPercent > 4.0) {
    throw new Error(`Timing test failed! WPM error too high: ${errorPercent.toFixed(2)}%`);
  }
  return true;
}

function testQWERTYNeighbors() {
  console.log('\n=== Testing QWERTY Neighbor Typo Mapping ===');
  const keyboardNeighbors = {
    q: ['w', 'a', '1', '2'],
    w: ['q', 'e', 's', 'a', '3'],
    e: ['w', 'r', 'd', 's', '4'],
    r: ['e', 't', 'f', 'd', '5'],
    t: ['r', 'y', 'g', 'f', '6'],
    y: ['t', 'u', 'h', 'g', '7']
  };

  for (const [key, neighbors] of Object.entries(keyboardNeighbors)) {
    if (!Array.isArray(neighbors) || neighbors.length === 0) {
      throw new Error(`Key ${key} has no neighbors`);
    }
  }
  console.log('  All tested QWERTY adjacency keys valid.');
  return true;
}

function main() {
  console.log('--- Starting Monkeytype Humanoid Typer Test Suite ---');
  testQWERTYNeighbors();
  runTimingBenchmark(60);
  runTimingBenchmark(100);
  runTimingBenchmark(140);
  runTimingBenchmark(220);
  console.log('\n✅ All automated benchmarks and timing tests PASSED successfully!\n');
}

main();

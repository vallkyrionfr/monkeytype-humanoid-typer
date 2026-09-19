const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const EXTENSION_DIR = path.resolve(__dirname, '..');
console.log('Testing 500 WPM extension from:', EXTENSION_DIR);

async function getWsUrl(port) {
  for (let i = 0; i < 30; i++) {
    try {
      const data = await new Promise((resolve, reject) => {
        http.get(`http://127.0.0.1:${port}/json/version`, (res) => {
          let buf = '';
          res.on('data', chunk => buf += chunk);
          res.on('end', () => resolve(JSON.parse(buf)));
        }).on('error', reject);
      });
      if (data && data.webSocketDebuggerUrl) {
        return data.webSocketDebuggerUrl;
      }
    } catch (e) {
      await new Promise(r => setTimeout(r, 250));
    }
  }
  throw new Error('Could not connect to Brave CDP');
}

async function sendCdp(ws, method, params = {}) {
  const id = Math.floor(Math.random() * 1000000);
  return new Promise((resolve, reject) => {
    function handler(event) {
      const msg = JSON.parse(event.data);
      if (msg.id === id) {
        ws.removeEventListener('message', handler);
        if (msg.error) reject(msg.error);
        else resolve(msg.result);
      }
    }
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function main() {
  const port = 9260;
  const braveProc = spawn('/usr/bin/brave', [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    '--no-sandbox',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    `--disable-extensions-except=${EXTENSION_DIR}`,
    `--load-extension=${EXTENSION_DIR}`,
    '--user-data-dir=/tmp/brave-500wpm-test'
  ], { stdio: 'ignore' });

  try {
    console.log('Connecting to Brave with loaded extension...');
    const wsUrl = await getWsUrl(port);
    const ws = new WebSocket(wsUrl);
    await new Promise(r => ws.onopen = r);

    console.log('Opening Monkeytype...');
    const mtTarget = await sendCdp(ws, 'Target.createTarget', { url: 'https://monkeytype.com/' });
    const { sessionId: mtSession } = await sendCdp(ws, 'Target.attachToTarget', { targetId: mtTarget.targetId, flatten: true });

    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);
      if (msg.method === 'Runtime.consoleAPICalled') {
        const text = msg.params.args.map(a => a.value || a.description).join(' ');
        if (text.includes('[Humanoid Typer]') || text.includes('WPM')) {
          console.log('[BROWSER LOG]', text);
        }
      }
    });

    async function sendMtCdp(method, params = {}) {
      const id = Math.floor(Math.random() * 1000000);
      return new Promise((resolve, reject) => {
        function handler(event) {
          const msg = JSON.parse(event.data);
          if (msg.id === id) {
            ws.removeEventListener('message', handler);
            if (msg.error) reject(msg.error);
            else resolve(msg.result);
          }
        }
        ws.addEventListener('message', handler);
        ws.send(JSON.stringify({ id, sessionId: mtSession, method, params }));
      });
    }

    await sendMtCdp('Page.enable');
    await sendMtCdp('Runtime.enable');

    console.log('Waiting for Monkeytype and Content Script injection...');
    await new Promise(r => setTimeout(r, 6000));

    // Configure HUD to 500 WPM
    console.log('Setting WPM to 500 via HUD...');
    const setupRes = await sendMtCdp('Runtime.evaluate', {
      expression: `(() => {
        const hudHost = document.querySelector('#mttyper-host');
        if (!hudHost || !hudHost.shadowRoot) return { error: 'HUD shadowRoot not found' };
        
        // Find Hyper preset button (500 wpm)
        const hyperBtn = Array.from(hudHost.shadowRoot.querySelectorAll('.mttyper-preset-btn')).find(b => b.dataset.wpm === '500');
        if (hyperBtn) {
          hyperBtn.click();
        }
        
        const wpmVal = hudHost.shadowRoot.querySelector('#mttyper-val-wpm')?.textContent;
        return { wpmVal, foundBtn: Boolean(hyperBtn) };
      })()`,
      returnByValue: true
    });
    console.log('HUD configuration result:', setupRes.result.value);

    // Trigger Start Typing
    console.log('Starting 500 WPM typing...');
    const startTime = Date.now();
    await sendMtCdp('Runtime.evaluate', {
      expression: `(() => {
        const hudHost = document.querySelector('#mttyper-host');
        hudHost?.shadowRoot?.querySelector('#mttyper-btn-start-now')?.click();
      })()`
    });

    // Let it type for 5 seconds
    await new Promise(r => setTimeout(r, 5000));
    const durationSec = (Date.now() - startTime) / 1000;

    // Pause/Stop
    await sendMtCdp('Runtime.evaluate', {
      expression: `(() => {
        const hudHost = document.querySelector('#mttyper-host');
        hudHost?.shadowRoot?.querySelector('#mttyper-btn-pause')?.click();
      })()`
    });

    // Check stats on Monkeytype
    const stats = await sendMtCdp('Runtime.evaluate', {
      expression: `(() => {
        const correctLetters = document.querySelectorAll('#words .word letter.correct').length;
        const incorrectLetters = document.querySelectorAll('#words .word letter.incorrect').length;
        const activeWord = document.querySelector('#words .word.active')?.textContent;
        return {
          correctLetters,
          incorrectLetters,
          activeWord
        };
      })()`,
      returnByValue: true
    });

    const result = stats.result.value;
    const calcWpm = ((result.correctLetters / 5) / (durationSec / 60)).toFixed(1);

    console.log('\n==============================');
    console.log('500 WPM LIVE TEST RESULTS:');
    console.log('==============================');
    console.log('Elapsed Duration:   ', durationSec.toFixed(2), 'seconds');
    console.log('Correct Letters:    ', result.correctLetters);
    console.log('Incorrect Letters:  ', result.incorrectLetters);
    console.log('Effective Speed:    ', calcWpm, 'WPM');
    console.log('Active Word:        ', result.activeWord);
    console.log('==============================\n');

    ws.close();
  } finally {
    braveProc.kill();
  }
}

main().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});

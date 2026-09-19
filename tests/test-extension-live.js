const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const EXTENSION_DIR = path.resolve(__dirname, '..');
console.log('Testing extension from:', EXTENSION_DIR);

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
  const port = 9255;
  const braveProc = spawn('/usr/bin/brave', [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    '--no-sandbox',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    `--disable-extensions-except=${EXTENSION_DIR}`,
    `--load-extension=${EXTENSION_DIR}`,
    '--user-data-dir=/tmp/brave-extension-test'
  ], { stdio: 'ignore' });

  try {
    console.log('Connecting to Brave with loaded extension...');
    const wsUrl = await getWsUrl(port);
    const ws = new WebSocket(wsUrl);
    await new Promise(r => ws.onopen = r);

    // ==========================================
    // TEST 1: MONKEYTYPE
    // ==========================================
    console.log('\n--- [TEST 1] Testing on Monkeytype ---');
    const mtTarget = await sendCdp(ws, 'Target.createTarget', { url: 'https://monkeytype.com/' });
    const { sessionId: mtSession } = await sendCdp(ws, 'Target.attachToTarget', { targetId: mtTarget.targetId, flatten: true });

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

    // Verify HUD exists
    const hudCheck = await sendMtCdp('Runtime.evaluate', {
      expression: `Boolean(document.querySelector('#mttyper-host'))`,
      returnByValue: true
    });
    console.log('Monkeytype HUD injected:', hudCheck.result.value);

    // Start typing on Monkeytype via extension message
    console.log('Triggering typing start on Monkeytype...');
    const startRes = await sendMtCdp('Runtime.evaluate', {
      expression: `(() => {
        const words = document.querySelector('#words');
        if (!words) return { error: 'No #words found' };
        
        // Trigger start typing
        const hudHost = document.querySelector('#mttyper-host');
        const startBtn = hudHost?.shadowRoot?.querySelector('#mttyper-btn-start-now');
        if (startBtn) {
          startBtn.click();
          return { clicked: true };
        }
        return { clicked: false };
      })()`,
      returnByValue: true
    });
    console.log('Start button clicked:', startRes.result.value);

    // Let it type for 4 seconds
    await new Promise(r => setTimeout(r, 4000));

    // Check typed words
    const mtProgress = await sendMtCdp('Runtime.evaluate', {
      expression: `(() => {
        const correctLetters = document.querySelectorAll('#words .word letter.correct').length;
        const activeWord = document.querySelector('#words .word.active')?.textContent;
        return {
          correctLetters,
          activeWord
        };
      })()`,
      returnByValue: true
    });
    console.log('Monkeytype progress after 4s:\n', JSON.stringify(mtProgress.result.value, null, 2));

    // Stop typing
    await sendMtCdp('Runtime.evaluate', {
      expression: `(() => {
        const hudHost = document.querySelector('#mttyper-host');
        hudHost?.shadowRoot?.querySelector('#mttyper-btn-pause')?.click();
      })()`
    });

    // ==========================================
    // TEST 2: KEYBR
    // ==========================================
    console.log('\n--- [TEST 2] Testing on Keybr ---');
    const kbTarget = await sendCdp(ws, 'Target.createTarget', { url: 'https://www.keybr.com/' });
    const { sessionId: kbSession } = await sendCdp(ws, 'Target.attachToTarget', { targetId: kbTarget.targetId, flatten: true });

    async function sendKbCdp(method, params = {}) {
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
        ws.send(JSON.stringify({ id, sessionId: kbSession, method, params }));
      });
    }

    await sendKbCdp('Page.enable');
    await sendKbCdp('Runtime.enable');

    console.log('Waiting for Keybr and Content Script injection...');
    await new Promise(r => setTimeout(r, 6000));

    const kbHudCheck = await sendKbCdp('Runtime.evaluate', {
      expression: `Boolean(document.querySelector('#mttyper-host'))`,
      returnByValue: true
    });
    console.log('Keybr HUD injected:', kbHudCheck.result.value);

    // Click Start button on Keybr HUD
    console.log('Triggering typing start on Keybr HUD...');
    const kbStartRes = await sendKbCdp('Runtime.evaluate', {
      expression: `(() => {
        const hudHost = document.querySelector('#mttyper-host');
        const startBtn = hudHost?.shadowRoot?.querySelector('#mttyper-btn-start-now');
        if (startBtn) {
          startBtn.click();
          return { clicked: true };
        }
        return { clicked: false };
      })()`,
      returnByValue: true
    });
    console.log('Keybr Start button clicked:', kbStartRes.result.value);

    // Let it type for 4 seconds
    await new Promise(r => setTimeout(r, 4000));

    // Check Keybr progress
    const kbProgress = await sendKbCdp('Runtime.evaluate', {
      expression: `(() => {
        const hitSpans = Array.from(document.querySelectorAll('span')).filter(s => (s.getAttribute('style') || '').includes('hit__color')).length;
        const cursorText = document.querySelector('.nc1oZcWRbC')?.textContent;
        return {
          hitSpans,
          cursorText
        };
      })()`,
      returnByValue: true
    });
    console.log('Keybr progress after 4s:\n', JSON.stringify(kbProgress.result.value, null, 2));

    console.log('\n✅ ALL LIVE EXTENSION TESTS COMPLETED!');

  } catch (err) {
    console.error('Error during test:', err);
  } finally {
    braveProc.kill('SIGKILL');
  }
}

main();

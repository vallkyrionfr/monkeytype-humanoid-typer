const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const EXTENSION_DIR = path.resolve(__dirname, '..');

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
      if (data && data.webSocketDebuggerUrl) return data.webSocketDebuggerUrl;
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
  const port = 9277;
  const braveProc = spawn('/usr/bin/brave', [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    '--no-sandbox',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    `--disable-extensions-except=${EXTENSION_DIR}`,
    `--load-extension=${EXTENSION_DIR}`,
    '--user-data-dir=/tmp/brave-15s-test'
  ], { stdio: 'ignore' });

  try {
    const wsUrl = await getWsUrl(port);
    const ws = new WebSocket(wsUrl);
    await new Promise(r => ws.onopen = r);

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
    await new Promise(r => setTimeout(r, 6000));

    // Select 15s test mode on Monkeytype if available (button with time="15")
    await sendMtCdp('Runtime.evaluate', {
      expression: `(() => {
        const btn15 = document.querySelector('.timeConfig button[time="15"]') || Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === '15');
        btn15?.click();
        
        // Configure 500 WPM on HUD
        const hudHost = document.querySelector('#mttyper-host');
        const hyperBtn = Array.from(hudHost.shadowRoot.querySelectorAll('.mttyper-preset-btn')).find(b => b.dataset.wpm === '500');
        hyperBtn?.click();
      })()`
    });

    await new Promise(r => setTimeout(r, 1000));

    console.log('Starting 15s test at 500 WPM...');
    await sendMtCdp('Runtime.evaluate', {
      expression: `(() => {
        const hudHost = document.querySelector('#mttyper-host');
        hudHost?.shadowRoot?.querySelector('#mttyper-btn-start-now')?.click();
      })()`
    });

    // Wait 17 seconds for 15s test to complete
    console.log('Waiting for test completion...');
    await new Promise(r => setTimeout(r, 17000));

    // Extract official Monkeytype result screen values
    const results = await sendMtCdp('Runtime.evaluate', {
      expression: `(() => {
        const resultEl = document.querySelector('#result');
        const isVisible = resultEl && !resultEl.classList.contains('hidden') && resultEl.offsetHeight > 0;
        
        const wpmEl = resultEl?.querySelector('.stats .wpm .bottom');
        const accEl = resultEl?.querySelector('.stats .acc .bottom');
        const consistencyEl = resultEl?.querySelector('.stats .consistency .bottom');
        const rawEl = resultEl?.querySelector('.stats .raw .bottom');
        
        return {
          isVisible,
          wpm: wpmEl?.textContent,
          raw: rawEl?.textContent,
          acc: accEl?.textContent,
          consistency: consistencyEl?.textContent
        };
      })()`,
      returnByValue: true
    });

    console.log('\n=============================================');
    console.log('OFFICIAL MONKEYTYPE 15s TEST RESULT AT 500 WPM:');
    console.log('=============================================');
    console.log(JSON.stringify(results.result.value, null, 2));
    console.log('=============================================\n');

    ws.close();
  } finally {
    braveProc.kill();
  }
}

main().catch(console.error);

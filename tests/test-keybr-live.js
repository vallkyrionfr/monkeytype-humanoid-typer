const { spawn } = require('child_process');
const http = require('http');

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

async function main() {
  const port = 9258;
  const braveProc = spawn('/usr/bin/brave', [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    '--no-sandbox',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--user-data-dir=/tmp/brave-test-keybr-inspect-3'
  ], { stdio: 'ignore' });

  try {
    const wsUrl = await getWsUrl(port);
    const ws = new WebSocket(wsUrl);
    await new Promise(r => ws.onopen = r);

    async function sendCdp(method, params = {}) {
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

    const { targetId } = await sendCdp('Target.createTarget', { url: 'https://www.keybr.com/' });
    const { sessionId } = await sendCdp('Target.attachToTarget', { targetId, flatten: true });

    async function sendSessionCdp(method, params = {}) {
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
        ws.send(JSON.stringify({ id, sessionId, method, params }));
      });
    }

    await sendSessionCdp('Page.enable');
    await sendSessionCdp('Runtime.enable');

    await new Promise(r => setTimeout(r, 4500));

    // Search for model with appendChar across fibers
    const searchRes = await sendSessionCdp('Runtime.evaluate', {
      expression: `(() => {
        const root = document.querySelector('.VWtF2mmR6I');
        const key = Object.keys(root).find(k => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$'));
        let cur = root[key];

        let model = null;
        while (cur) {
          // Check memoizedState hooks
          let state = cur.memoizedState;
          while (state) {
            if (state.memoizedState) {
              const val = state.memoizedState;
              if (val && typeof val === 'object') {
                if (typeof val.appendChar === 'function') {
                  model = val;
                  break;
                }
                if (Array.isArray(val)) {
                  for (const item of val) {
                    if (item && typeof item.appendChar === 'function') {
                      model = item;
                      break;
                    }
                  }
                }
              }
            }
            state = state.next;
          }
          if (model) break;

          // Check props
          if (cur.memoizedProps) {
            for (const p of Object.values(cur.memoizedProps)) {
              if (p && typeof p.appendChar === 'function') {
                model = p;
                break;
              }
            }
          }
          if (model) break;

          cur = cur.return;
        }

        if (model) {
          return {
            foundModel: true,
            modelKeys: Object.keys(model),
            pos: model.pos,
            length: model.length,
            completed: model.completed
          };
        }

        return { foundModel: false };
      })()`,
      returnByValue: true
    });

    console.log('Model search result:\n', JSON.stringify(searchRes.result.value, null, 2));

  } catch (err) {
    console.error('Error:', err);
  } finally {
    braveProc.kill('SIGKILL');
  }
}

main();

// Background Service Worker for Monkeytype Humanoid Auto-Typer
// Handles preferences, extension popup lifecycle, and Chrome Debugger Protocol (CDP)
// for sending 100% genuine hardware-level (isTrusted: true) keystrokes into Monkeytype.

const DEFAULT_SETTINGS = {
  enabled: true,
  wpm: 100,
  accuracy: 98,
  autoTakeover: true,
  burstVariance: 0.20,
  naturalHesitations: true,
  simulateTypoCorrections: true
};

const attachedTabs = new Set();

chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('[Monkeytype Typer] Installed / Updated with reason:', details.reason);
  const existing = await chrome.storage.local.get(null);
  const toStore = {};

  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    if (existing[key] === undefined) {
      toStore[key] = value;
    }
  }

  if (Object.keys(toStore).length > 0) {
    await chrome.storage.local.set(toStore);
  }
});

// Clean up detached debugger tabs
chrome.debugger.onDetach.addListener((source, reason) => {
  if (source?.tabId) {
    attachedTabs.delete(source.tabId);
    console.log(`[Monkeytype Typer] Debugger detached from tab ${source.tabId} (${reason})`);
  }
});

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}

function getKeyCode(char) {
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

function getVirtualKeyCode(char) {
  if (char === ' ') return 32;
  if (char === '\n') return 13;
  if (char === '\t') return 9;
  if (char >= '0' && char <= '9') return char.charCodeAt(0);
  if (char.toLowerCase() >= 'a' && char.toLowerCase() <= 'z') return char.toUpperCase().charCodeAt(0);
  if (char === ',') return 188;
  if (char === '.') return 190;
  if (char === '/') return 191;
  if (char === ';') return 186;
  if (char === '\'') return 222;
  if (char === '-') return 189;
  return char.charCodeAt(0);
}

async function ensureAttached(tabId) {
  if (attachedTabs.has(tabId)) return true;
  try {
    await chrome.debugger.attach({ tabId }, '1.3');
    attachedTabs.add(tabId);
    console.log(`[Monkeytype Typer] Attached debugger to tab ${tabId}`);
    return true;
  } catch (err) {
    if (err.message?.includes('Already attached')) {
      attachedTabs.add(tabId);
      return true;
    }
    console.error(`[Monkeytype Typer] Failed to attach debugger to tab ${tabId}:`, err);
    return false;
  }
}

async function detachDebugger(tabId) {
  if (!attachedTabs.has(tabId)) return;
  try {
    await chrome.debugger.detach({ tabId });
    attachedTabs.delete(tabId);
    console.log(`[Monkeytype Typer] Detached debugger from tab ${tabId}`);
  } catch (err) {
    attachedTabs.delete(tabId);
  }
}

// Long-lived communication port for zero-latency keystroke streaming
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'typing-stream') return;

  const tabId = port.sender?.tab?.id;
  if (!tabId) return;

  port.onMessage.addListener(async (msg) => {
    if (msg.action === 'ATTACH') {
      const ok = await ensureAttached(tabId);
      port.postMessage({ type: 'ATTACHED', success: ok });
      return;
    }

    if (msg.action === 'DETACH') {
      await detachDebugger(tabId);
      port.postMessage({ type: 'DETACHED' });
      return;
    }

    if (msg.action === 'KEY') {
      await ensureAttached(tabId);
      const char = msg.char;
      const dwellTime = msg.dwellTime || 30;
      const code = getKeyCode(char);
      const vk = getVirtualKeyCode(char);
      const isUpper = char !== ' ' && char === char.toUpperCase() && char.toLowerCase() !== char.toUpperCase();

      try {
        // 1. RawKeyDown
        await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchKeyEvent', {
          type: 'rawKeyDown',
          key: char,
          code: code,
          windowsVirtualKeyCode: vk,
          nativeVirtualKeyCode: vk,
          modifiers: isUpper ? 8 : 0
        });

        // 2. InsertText (generates genuine trusted beforeinput + input)
        await chrome.debugger.sendCommand({ tabId }, 'Input.insertText', {
          text: char
        });

        if (dwellTime > 0) {
          await sleep(dwellTime);
        }

        // 3. KeyUp
        await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchKeyEvent', {
          type: 'keyUp',
          key: char,
          code: code,
          windowsVirtualKeyCode: vk,
          nativeVirtualKeyCode: vk,
          modifiers: isUpper ? 8 : 0
        });

        port.postMessage({ type: 'KEY_DISPATCHED', id: msg.id, char });
      } catch (err) {
        console.error('[Monkeytype Typer] Error dispatching key via CDP:', err);
        port.postMessage({ type: 'KEY_ERROR', id: msg.id, error: err.message });
      }
      return;
    }

    if (msg.action === 'BACKSPACE') {
      await ensureAttached(tabId);
      const dwellTime = msg.dwellTime || 30;

      try {
        await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchKeyEvent', {
          type: 'keyDown',
          key: 'Backspace',
          code: 'Backspace',
          windowsVirtualKeyCode: 8,
          nativeVirtualKeyCode: 8
        });

        if (dwellTime > 0) {
          await sleep(dwellTime);
        }

        await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchKeyEvent', {
          type: 'keyUp',
          key: 'Backspace',
          code: 'Backspace',
          windowsVirtualKeyCode: 8,
          nativeVirtualKeyCode: 8
        });

        port.postMessage({ type: 'BACKSPACE_DISPATCHED', id: msg.id });
      } catch (err) {
        console.error('[Monkeytype Typer] Error dispatching backspace via CDP:', err);
        port.postMessage({ type: 'BACKSPACE_ERROR', id: msg.id, error: err.message });
      }
      return;
    }
  });

  port.onDisconnect.addListener(() => {
    // When port disconnects, detach debugger to dismiss any infobar
    detachDebugger(tabId);
  });
});

// Listen for one-off runtime messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'GET_SETTINGS') {
    chrome.storage.local.get(null).then((settings) => {
      sendResponse({ status: 'ok', settings });
    });
    return true;
  }
});

import { spawn } from 'node:child_process';
import { writeFile, mkdir, copyFile } from 'node:fs/promises';
import { join } from 'node:path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DEBUG_PORT = 9444;
const TARGET_PORT = 3600;
const TARGET_URL = `http://127.0.0.1:${TARGET_PORT}`;
const SCREENSHOT_DIR = join(process.cwd(), 'apps', 'meta-os', 'docs', 'screenshots');
const ARTIFACT_DIR = 'C:\\Users\\Ras Ali Labs\\.gemini\\antigravity-ide\\brain\\261d9ebb-32cd-44f8-969a-a96670cf9016';

async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getDebuggerUrl(port) {
  for (let i = 0; i < 25; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/list`);
      if (res.ok) {
        const list = await res.json();
        const page = list.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
        if (page) return page.webSocketDebuggerUrl;
        if (list.length > 0 && list[0].webSocketDebuggerUrl) {
          return list[0].webSocketDebuggerUrl;
        }
      }
    } catch {}
    await wait(300);
  }
  throw new Error('Failed to connect to Chrome remote debugging port');
}

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.id = 1;
    this.pending = new Map();
  }

  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });

    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      }
    };
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.id++;
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    if (res.exceptionDetails) {
      throw new Error('Evaluation failed: ' + JSON.stringify(res.exceptionDetails));
    }
    return res.result?.value;
  }

  async captureScreenshot(filename) {
    const data = await this.send('Page.captureScreenshot', { format: 'png' });
    const fullPath = join(SCREENSHOT_DIR, filename);
    await writeFile(fullPath, Buffer.from(data.data, 'base64'));
    try {
      await copyFile(fullPath, join(ARTIFACT_DIR, filename));
    } catch (e) {
      console.warn('Artifact copy warning:', e.message);
    }
    console.log(`[Screenshot Captured] ${filename} -> ${fullPath}`);
    return fullPath;
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

async function runCapture() {
  await mkdir(SCREENSHOT_DIR, { recursive: true });

  const chromeArgs = [
    `--remote-debugging-port=${DEBUG_PORT}`,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--disable-sync',
    '--window-size=1440,900',
    'about:blank'
  ];

  console.log('Launching headless Chrome on port', DEBUG_PORT);
  const chromeProcess = spawn(CHROME_PATH, chromeArgs, { stdio: 'ignore' });

  const cleanup = () => {
    try { chromeProcess.kill('SIGKILL'); } catch {}
  };
  process.on('exit', cleanup);
  process.on('SIGINT', cleanup);

  try {
    const wsUrl = await getDebuggerUrl(DEBUG_PORT);
    const client = new CDPClient(wsUrl);
    await client.connect();
    await client.send('Page.enable');
    await client.send('Runtime.enable');
    await client.send('DOM.enable');

    console.log('Navigating to', TARGET_URL);
    await client.send('Page.navigate', { url: TARGET_URL });
    await wait(2500);

    const goToWorkspace = async (name) => {
      await client.evaluate(`(() => {
        const btn = Array.from(document.querySelectorAll('.nav-item')).find(b => b.innerText.toLowerCase().includes(${JSON.stringify(name.toLowerCase())}));
        if (btn) btn.click();
      })()`);
      await wait(800);
    };

    const fillAndSubmit = async (name, industry, website, objective) => {
      await client.evaluate(`(() => {
        const setVal = (el, val) => {
          if (!el) return;
          if (el._valueTracker) el._valueTracker.setValue('');
          const proto = el instanceof HTMLInputElement ? window.HTMLInputElement.prototype : window.HTMLTextAreaElement.prototype;
          const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
          setter.call(el, val);
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        };

        const nameInput = document.querySelector('input[placeholder="Business name"]');
        const indInput = document.querySelector('input[placeholder="Industry"]');
        const webInput = document.querySelector('input[placeholder="https://example.org"]');
        const objInput = document.querySelector('textarea');

        setVal(nameInput, ${JSON.stringify(name)});
        setVal(indInput, ${JSON.stringify(industry)});
        setVal(webInput, ${JSON.stringify(website)});
        setVal(objInput, ${JSON.stringify(objective)});

        const form = document.querySelector('form');
        const subBtn = form ? form.querySelector('button[type="submit"]') : null;
        if (subBtn) subBtn.click();
      })()`);
    };

    // --- State 1: Ingesting https://rasalilabs.com (Rendered Fallback) ---
    console.log('\n--- State 1: Ingesting https://rasalilabs.com (Rendered Fallback) ---');
    await goToWorkspace('Business');
    await fillAndSubmit(
      'Ras Ali Labs',
      'Software & Film Production',
      'https://rasalilabs.com',
      'Grow digital platform adoption in Botswana'
    );

    // Submission auto-navigates to MARI once finished
    console.log('Waiting for MARI view with rendered evidence...');
    for (let i = 0; i < 50; i++) {
      await wait(500);
      const isMari = await client.evaluate(`Boolean(document.querySelector('.page-head h1')?.innerText.includes('MARI'))`);
      if (isMari) {
        const cardText = await client.evaluate(`(() => {
          const card = Array.from(document.querySelectorAll('.card')).find(c => c.querySelector('h3')?.innerText.includes('Verified evidence'));
          return card?.innerText || '';
        })()`);
        if (cardText.includes('RETRIEVED RENDERED')) break;
      }
    }

    // Capture MARI Rendered Evidence (Desktop 1440)
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });
    await wait(400);
    await client.captureScreenshot('evidence-rendered-1440.png');

    // Capture MARI Rendered Evidence (Mobile true-390)
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 3,
      mobile: true
    });
    await wait(400);
    await client.captureScreenshot('evidence-rendered-390.png');

    // Switch to Business workspace to capture the Business Evidence Card with banner
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });
    await wait(400);
    await goToWorkspace('Business');
    await wait(600);
    await client.captureScreenshot('evidence-rendered-business-1440.png');

    // --- State 2: Ingesting https://example.org (Static Direct) ---
    console.log('\n--- State 2: Ingesting https://example.org (Static Direct) ---');
    await fillAndSubmit(
      'Example Business',
      'Technology & Research',
      'https://example.org',
      'Demonstrate fast static evidence retrieval'
    );

    console.log('Waiting for MARI view with static evidence...');
    for (let i = 0; i < 50; i++) {
      await wait(500);
      const isMari = await client.evaluate(`Boolean(document.querySelector('.page-head h1')?.innerText.includes('MARI'))`);
      if (isMari) {
        const cardText = await client.evaluate(`(() => {
          const card = Array.from(document.querySelectorAll('.card')).find(c => c.querySelector('h3')?.innerText.includes('Verified evidence'));
          return card?.innerText || '';
        })()`);
        if (cardText.includes('RETRIEVED') && !cardText.includes('RENDERED')) break;
      }
    }

    // Capture MARI Static Evidence (Desktop 1440)
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });
    await wait(400);
    await client.captureScreenshot('evidence-static-1440.png');

    // Capture MARI Static Evidence (Mobile true-390)
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 3,
      mobile: true
    });
    await wait(400);
    await client.captureScreenshot('evidence-static-390.png');

    // Switch to Business workspace to capture Business Static Evidence Card
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });
    await wait(400);
    await goToWorkspace('Business');
    await wait(600);
    await client.captureScreenshot('evidence-static-business-1440.png');

    console.log('\n[SUCCESS] Successfully captured all evidence state screenshots.');
    client.close();
  } finally {
    cleanup();
  }
}

runCapture().catch(e => {
  console.error('Capture script error:', e);
  process.exit(1);
});

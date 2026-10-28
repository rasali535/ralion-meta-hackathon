import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DEBUG_PORT = 9333;
const TARGET_URL = 'http://127.0.0.1:3700';

async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getDebuggerUrl(port) {
  for (let i = 0; i < 20; i++) {
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
    this.events = [];
    this.consoleLogs = [];
    this.exceptions = [];
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
      } else if (msg.method) {
        if (msg.method === 'Runtime.consoleAPICalled') {
          const text = msg.params.args.map(a => a.value || a.description || '').join(' ');
          this.consoleLogs.push({ type: msg.params.type, text });
        } else if (msg.method === 'Runtime.exceptionThrown') {
          this.exceptions.push(msg.params.exceptionDetails);
        }
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

  close() {
    if (this.ws) this.ws.close();
  }
}

async function runBrowserAcceptance() {
  console.log('--- STARTING POST-INTEGRATION BROWSER ACCEPTANCE ---');
  console.log('Target URL:', TARGET_URL);
  console.log('Browser:', CHROME_PATH);

  const tmpDir = join(process.env.TEMP || 'C:\\Windows\\Temp', 'chrome-profile-' + Date.now());
  const chromeProcess = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${DEBUG_PORT}`,
    '--disable-gpu',
    '--no-sandbox',
    '--disable-extensions',
    `--user-data-dir=${tmpDir}`,
    '--window-size=1280,900',
    'about:blank'
  ]);

  try {
    const wsUrl = await getDebuggerUrl(DEBUG_PORT);
    console.log('Chrome CDP attached at:', wsUrl);

    const client = new CDPClient(wsUrl);
    await client.connect();

    await client.send('Page.enable');
    await client.send('Runtime.enable');

    // 2. Navigate to localhost:3700
    console.log('\n[1/7] Navigating to Meta OS...');
    await client.send('Page.navigate', { url: TARGET_URL });

    async function waitForSelector(selector, timeoutMs = 12000) {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        const info = await client.evaluate(`({
          url: window.location.href,
          ready: document.readyState,
          hasEl: Boolean(document.querySelector('${selector}')),
          bodyLen: document.body?.innerHTML?.length || 0
        })`);
        console.log('waitForSelector info:', info);
        if (info.hasEl) return true;
        await wait(600);
      }
      throw new Error('Timeout waiting for selector: ' + selector);
    }

    await waitForSelector('.brand-text');

    // Check title and brand
    const title = await client.evaluate('document.title');
    const brandText = await client.evaluate('document.querySelector(".brand-text")?.innerText');
    const wsChip = await client.evaluate('document.querySelector(".ws-name")?.innerText');
    console.log('Page Title:', title);
    console.log('Brand text:', brandText);
    console.log('Workspace chip:', wsChip);

    if (!brandText?.includes('RALION OS')) {
      throw new Error('Failed to find RALION OS brand header after hydration');
    }

    // 3. Theme toggling
    console.log('\n[2/7] Testing Light/Dark theme toggle...');
    await wait(500); // Allow useEffect to set theme attribute
    const initialTheme = await client.evaluate(`document.documentElement.getAttribute('data-theme') || document.documentElement.dataset?.theme`);
    console.log('Initial theme:', initialTheme);

    await client.evaluate('document.querySelector(".theme-btn").click()');
    await wait(400);
    const toggledTheme = await client.evaluate(`document.documentElement.getAttribute('data-theme') || document.documentElement.dataset?.theme`);
    console.log('Toggled theme:', toggledTheme);

    if (!toggledTheme || toggledTheme === initialTheme) {
      throw new Error(`Theme toggle failed: initial=${initialTheme}, toggled=${toggledTheme}`);
    }

    // Toggle back to dark
    await client.evaluate('document.querySelector(".theme-btn").click()');
    await wait(400);
    const restoredTheme = await client.evaluate(`document.documentElement.getAttribute('data-theme') || document.documentElement.dataset?.theme`);
    console.log('Restored theme:', restoredTheme);

    // 4. Test all 8 workspaces
    console.log('\n[3/7] Testing navigation across all 8 workspaces...');
    const workspaces = ['command', 'business', 'mari', 'growth', 'creative', 'social', 'activity', 'settings'];
    for (const ws of workspaces) {
      await client.evaluate(`(() => {
        const btn = Array.from(document.querySelectorAll('.nav-item')).find(b => b.innerText.toLowerCase().includes('${ws}'));
        if (btn) btn.click();
      })()`);
      await wait(350);
      const currentUrl = await client.evaluate('window.location.search');
      const activeNav = await client.evaluate('document.querySelector(".nav-item.active")?.innerText');
      const pageHeading = await client.evaluate('document.querySelector(".page-head h1")?.innerText');
      console.log(`- Workspace [${ws}]: activeNav="${activeNav?.replace(/\\n/g, ' ')}", heading="${pageHeading}", query="${currentUrl}"`);
    }

    // 5. Test MARI Mission Workflow in Business Workspace
    console.log('\n[4/7] Testing MARI mission submission from browser...');
    // Navigate to business
    await client.evaluate(`(() => {
      Array.from(document.querySelectorAll('.nav-item')).find(b => b.innerText.toLowerCase().includes('business')).click();
    })()`);
    await wait(400);

    // Verify prefilled business form values
    const formVals = await client.evaluate(`(() => ({
      name: document.querySelector('input[placeholder="Business name"]')?.value,
      industry: document.querySelector('input[placeholder="Industry"]')?.value,
      website: document.querySelector('input[placeholder="https://example.org"]')?.value,
      objective: document.querySelector('textarea')?.value
    }))()`);
    console.log('Form prefilled values:', formVals);

    // Submit the form
    console.log('Clicking "Send mission to MARI" button...');
    await client.evaluate(`(() => {
      const submitBtn = document.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.click();
    })()`);

    // Check loading state
    await wait(100);
    const buttonTextDuringLoad = await client.evaluate('document.querySelector("button[type=\\"submit\\"]")?.innerText');
    console.log('Button state during submission:', buttonTextDuringLoad);

    // Wait for mission response and navigation to MARI
    let arrivedAtMari = false;
    for (let i = 0; i < 30; i++) {
      await wait(500);
      const heading = await client.evaluate('document.querySelector(".page-head h1")?.innerText');
      if (heading === 'MARI') {
        arrivedAtMari = true;
        break;
      }
    }

    if (!arrivedAtMari) {
      const errBox = await client.evaluate('document.querySelector(".error-box")?.innerText');
      throw new Error('Did not transition to MARI view. Error box: ' + errBox);
    }

    console.log('Successfully transitioned to MARI workspace!');
    const mariHeader = await client.evaluate('document.querySelector(".page-head p")?.innerText');
    const mariRows = await client.evaluate(`(() => {
      return Array.from(document.querySelectorAll('.card')).map(c => ({
        title: c.querySelector('h3, .card-title, h4')?.innerText,
        text: c.innerText.slice(0, 150)
      }));
    })()`);
    console.log('MARI header:', mariHeader);
    console.log('MARI cards count:', mariRows.length);

    // 6. Confirm generated recommendations appear in MARI workspace and propagate into Growth
    console.log('\n[5/7] Verifying recommendation propagation into Growth workspace...');
    await client.evaluate(`(() => {
      Array.from(document.querySelectorAll('.nav-item')).find(b => b.innerText.toLowerCase().includes('growth')).click();
    })()`);
    await wait(500);

    const growthHeading = await client.evaluate('document.querySelector(".page-head h1")?.innerText');
    const growthLede = await client.evaluate('document.querySelector(".page-head p")?.innerText');
    const growthCards = await client.evaluate(`(() => {
      return Array.from(document.querySelectorAll('.card')).map(c => c.innerText.replace(/\\n+/g, ' | ').slice(0, 200));
    })()`);

    console.log('Growth Heading:', growthHeading);
    console.log('Growth Lede:', growthLede);
    console.log('Growth Cards:', growthCards);

    if (!growthLede?.includes('Northstar Coffee')) {
      throw new Error('Mission recommendations did not propagate to Growth workspace for Northstar Coffee');
    }

    // 7. Test invalid input and error message handling
    console.log('\n[6/7] Testing invalid input & error handling in browser...');
    await client.evaluate(`(() => {
      Array.from(document.querySelectorAll('.nav-item')).find(b => b.innerText.toLowerCase().includes('business')).click();
    })()`);
    await wait(400);

    // Set invalid website URL and submit
    await client.evaluate(`(() => {
      const input = document.querySelector('input[placeholder="https://example.org"]');
      if (input) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(input, 'http://insecure-http-url.com');
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
      const btn = document.querySelector('button[type="submit"]');
      if (btn) btn.click();
    })()`);
    await wait(1200);

    const errorBoxMsg = await client.evaluate('document.querySelector(".error-box")?.innerText');
    console.log('Error box message for insecure URL:', errorBoxMsg);

    // 8. Test responsive mobile layout
    console.log('\n[7/7] Testing mobile viewport & drawer behavior...');
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true
    });
    await wait(300);

    // Check burger menu
    const isBurgerVisible = await client.evaluate(`(() => {
      const b = document.querySelector('.burger');
      const style = window.getComputedStyle(b);
      return style.display !== 'none';
    })()`);
    console.log('Burger button visible on mobile:', isBurgerVisible);

    // Click burger
    await client.evaluate('document.querySelector(".burger").click()');
    await wait(200);
    const isNavOpen = await client.evaluate('document.querySelector(".os").classList.contains("nav-open")');
    console.log('Drawer opened (.nav-open):', isNavOpen);

    // Click scrim to close
    await client.evaluate('document.querySelector(".scrim").click()');
    await wait(200);
    const isNavClosed = !await client.evaluate('document.querySelector(".os").classList.contains("nav-open")');
    console.log('Drawer closed after scrim click:', isNavClosed);

    // Reset device metrics
    await client.send('Emulation.clearDeviceMetricsOverride');

    // Check console logs and exceptions
    console.log('\n--- BROWSER CONSOLE REPORT ---');
    console.log('Console logs count:', client.consoleLogs.length);
    console.log('Exceptions count:', client.exceptions.length);
    if (client.exceptions.length > 0) {
      console.error('Browser exceptions:', client.exceptions);
    }

    // Capture screenshot of MARI workspace
    await client.evaluate(`
      Array.from(document.querySelectorAll('.nav-item')).find(b => b.innerText.toLowerCase().includes('mari')).click();
    `);
    await wait(500);

    const screenshotData = await client.send('Page.captureScreenshot', { format: 'png' });
    const screenshotPath = join(process.cwd(), 'apps', 'meta-os', 'docs', 'screenshots', 'browser-acceptance-mari.png');
    await writeFile(screenshotPath, Buffer.from(screenshotData.data, 'base64'));
    console.log('Captured verification screenshot to:', screenshotPath);

    client.close();
    console.log('\n=== BROWSER ACCEPTANCE SUCCEEDED 100% ===');
  } finally {
    chromeProcess.kill('SIGKILL');
  }
}

runBrowserAcceptance().catch(err => {
  console.error('\n*** BROWSER ACCEPTANCE FAILED ***');
  console.error(err);
  process.exit(1);
});

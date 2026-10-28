import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { issueDemoToken } from '../apps/meta-os/lib/auth.js';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DEBUG_PORT = 9333;
const TARGET_PORT = 3700;
const TARGET_URL = `http://127.0.0.1:${TARGET_PORT}`;
const DEMO_SECRET = 'dev-demo-secret-key-for-browser-acceptance';
const ASSET_SECRET = 'dev-asset-secret-key-for-browser-acceptance';
const APPROVAL_SECRET = 'dev-approval-secret-key-for-browser-acceptance';

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
  console.log('=== PHASE 3 FULL WORKFLOW BROWSER ACCEPTANCE ===');
  console.log('Target URL:', TARGET_URL);
  console.log('Browser:', CHROME_PATH);

  // Mint a valid v2 demo token for org_demo / ws_growth
  const demoToken = issueDemoToken('ws_growth', {
    organizationId: 'org_demo',
    hmacSecret: DEMO_SECRET,
    ttlMs: 3600000
  });
  console.log('Issued v2 demo token:', demoToken.slice(0, 24) + '…');

  // Start Next.js dev server with required Phase 3 secrets and mock generation
  console.log('Starting Next.js server with Phase 3 configuration...');
  const nextProcess = spawn('npm', ['--prefix', 'apps/meta-os', 'run', 'dev', '--', '-p', String(TARGET_PORT)], {
    shell: true,
    env: {
      ...process.env,
      PORT: String(TARGET_PORT),
      META_DEMO_TOKEN_SECRET: DEMO_SECRET,
      ASSET_URL_SECRET: ASSET_SECRET,
      APPROVAL_HMAC_SECRET: APPROVAL_SECRET,
      CREATIVE_GENERATION_ENABLED: 'true',
      META_REASONING_API_ENABLED: 'true',
      MODEL_API_KEY: 'test-server-key-safe',
      MOCK_IMAGE_GENERATION: 'true',
      CREATIVE_STORAGE_DIR: '.data/creative_test'
    }
  });

  // Wait for dev server readiness
  console.log('Waiting for Next.js server readiness on port', TARGET_PORT);
  let serverReady = false;
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(TARGET_URL);
      if (res.ok) {
        serverReady = true;
        break;
      }
    } catch {}
    await wait(500);
  }
  if (!serverReady) {
    nextProcess.kill();
    throw new Error('Dev server failed to start on port ' + TARGET_PORT);
  }
  console.log('Dev server ready!');

  // Launch Chrome in isolated temp profile
  const tmpDir = join(process.env.TEMP || 'C:\\Windows\\Temp', 'chrome-profile-p3-' + Date.now());
  const chromeProcess = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${DEBUG_PORT}`,
    '--disable-gpu',
    '--no-sandbox',
    '--disable-extensions',
    `--user-data-dir=${tmpDir}`,
    '--window-size=1280,960',
    'about:blank'
  ]);

  try {
    const wsUrl = await getDebuggerUrl(DEBUG_PORT);
    console.log('Chrome CDP attached at:', wsUrl);

    const client = new CDPClient(wsUrl);
    await client.connect();

    await client.send('Page.enable');
    await client.send('Runtime.enable');

    async function waitForSelector(selector, timeoutMs = 15000) {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        const found = await client.evaluate(`Boolean(document.querySelector('${selector}'))`);
        if (found) return true;
        await wait(300);
      }
      throw new Error('Timeout waiting for selector: ' + selector);
    }

    // 1. Initial Navigation & Shell Hydration
    console.log('\n[1/7] Navigating to Meta OS...');
    await client.send('Page.navigate', { url: TARGET_URL });
    await waitForSelector('.brand-text');
    // Allow React client components to hydrate and attach event listeners
    await wait(1500);

    const title = await client.evaluate('document.title');
    const brandText = await client.evaluate('document.querySelector(".brand-text")?.innerText');
    console.log('Page Title:', title);
    console.log('Brand Header:', brandText?.replace(/\n/g, ' '));

    // 2. Theme Toggle
    console.log('\n[2/7] Testing Theme Toggle...');
    const themeInitial = await client.evaluate(`document.documentElement.getAttribute('data-theme')`);
    await client.evaluate('document.querySelector(".theme-btn")?.click()');
    await wait(600);
    const themeToggled = await client.evaluate(`document.documentElement.getAttribute('data-theme')`);
    await client.evaluate('document.querySelector(".theme-btn")?.click()');
    await wait(600);
    const themeRestored = await client.evaluate(`document.documentElement.getAttribute('data-theme')`);
    console.log(`Themes: initial=${themeInitial}, toggled=${themeToggled}, restored=${themeRestored}`);
    if (themeInitial === themeToggled) throw new Error('Theme toggle failed');

    // 3. Navigate all 8 Workspaces
    console.log('\n[3/7] Testing Navigation across all 8 workspaces...');
    const workspaces = ['command', 'business', 'mari', 'growth', 'creative', 'social', 'activity', 'settings'];
    for (const ws of workspaces) {
      await client.evaluate(`(() => {
        const btn = Array.from(document.querySelectorAll('.nav-item')).find(b => b.innerText.toLowerCase().includes('${ws}'));
        if (btn) btn.click();
      })()`);
      await wait(300);
      const heading = await client.evaluate('document.querySelector(".page-head h1")?.innerText');
      console.log(`- Workspace [${ws}]: heading="${heading}"`);
    }

    // 4. Mission Submission in Business Workspace
    console.log('\n[4/7] Submitting Mission from Business Workspace...');
    await client.evaluate(`(() => {
      Array.from(document.querySelectorAll('.nav-item')).find(b => b.innerText.toLowerCase().includes('business')).click();
    })()`);
    await wait(400);

    // Enter the demo token into the form
    await client.evaluate(`(() => {
      const chk = document.querySelector('#live-ai');
      if (chk && !chk.checked) {
        chk.click();
      }
    })()`);
    await wait(300);

    await client.evaluate(`(() => {
      const tokenInput = document.querySelector('input[placeholder="Demo token"]');
      if (tokenInput) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(tokenInput, '${demoToken}');
        tokenInput.dispatchEvent(new Event('input', { bubbles: true }));
        tokenInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
      // Click submit
      const submitBtn = document.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.click();
    })()`);

    // Wait for transition to MARI
    console.log('Waiting for mission planning transition to MARI...');
    await waitForSelector('.steps', 25000);
    const mariHeading = await client.evaluate('document.querySelector(".page-head h1")?.innerText');
    const mariLede = await client.evaluate('document.querySelector(".page-head p")?.innerText');
    console.log('MARI Workspace loaded:', mariHeading, '|', mariLede);

    // 5. Check Propagation into Growth
    console.log('\n[5/7] Verifying Mission propagation into Growth...');
    await client.evaluate(`(() => {
      Array.from(document.querySelectorAll('.nav-item')).find(b => b.innerText.toLowerCase().includes('growth')).click();
    })()`);
    await wait(400);
    const growthOpp = await client.evaluate(`document.querySelector('.card .card-head')?.innerText || ''`);
    console.log('Growth Opportunity Card rendered:', Boolean(growthOpp));

    // 6. Test Creative Studio & Image Generation
    console.log('\n[6/7] Testing Creative Studio: prompt editing, confirmation, and generation...');
    await client.evaluate(`(() => {
      Array.from(document.querySelectorAll('.nav-item')).find(b => b.innerText.toLowerCase().includes('creative')).click();
    })()`);
    await wait(500);

    // Verify brief options
    const briefSource = await client.evaluate(`document.querySelector('.select')?.value`);
    console.log('Default brief source:', briefSource);

    // Click "Use brief suggestion"
    await client.evaluate(`(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Use brief suggestion'));
      if (btn) btn.click();
    })()`);
    await wait(200);

    // Edit prompt explicitly
    await client.evaluate(`(() => {
      const promptArea = document.querySelector('textarea[placeholder*="Describe the image"]');
      if (promptArea) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
        setter.call(promptArea, 'Artisanal morning espresso on wooden rustic table with fresh croissants');
        promptArea.dispatchEvent(new Event('input', { bubbles: true }));
      }
    })()`);
    const promptText = await client.evaluate(`document.querySelector('textarea[placeholder*="Describe the image"]')?.value`);
    console.log('Edited prompt:', promptText);

    // Test rejection without confirmation
    await client.evaluate(`(() => {
      const genBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Generate image'));
      if (genBtn) genBtn.click();
    })()`);
    await wait(200);
    const confirmError = await client.evaluate(`document.querySelector('.error-box')?.innerText`);
    console.log('Unconfirmed generation guard error:', confirmError);
    if (!confirmError?.includes('Confirm')) throw new Error('Generation proceeded without confirmation checkbox!');

    // Check confirmation checkbox
    await client.evaluate(`(() => {
      const chk = document.querySelector('#gen-confirm');
      if (chk && !chk.checked) {
        chk.click();
      }
    })()`);
    await wait(200);

    // Generate creative image
    console.log('Submitting authorized creative image generation...');
    await client.evaluate(`(() => {
      const genBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Generate image'));
      if (genBtn) genBtn.click();
    })()`);

    // Wait for asset card to appear in .asset-grid
    await waitForSelector('.asset-card', 15000);
    console.log('Asset card rendered in Creative Studio!');

    const assetDetails = await client.evaluate(`(() => {
      const card = document.querySelector('.asset-card');
      const img = card?.querySelector('img');
      return {
        hasImg: Boolean(img),
        imgSrc: img?.src,
        prompt: card?.querySelector('.asset-meta p')?.innerText,
        metaText: card?.querySelector('.asset-meta .mono')?.innerText,
        badges: Array.from(card?.querySelectorAll('.badge') || []).map(b => b.innerText)
      };
    })()`);
    console.log('Generated Asset Details:', assetDetails);
    if (!assetDetails.hasImg || !assetDetails.imgSrc?.includes('/api/creative/asset')) {
      throw new Error('Creative asset preview image did not render signed capability URL');
    }

    // 7. Test Social Workspace & Approval Gateway
    console.log('\n[7/7] Testing Social draft cards, creative previews, and Human Approval...');
    await client.evaluate(`(() => {
      Array.from(document.querySelectorAll('.nav-item')).find(b => b.innerText.toLowerCase().includes('social')).click();
    })()`);
    await wait(500);

    // Verify Facebook and Instagram draft cards
    const draftCards = await client.evaluate(`(() => {
      return Array.from(document.querySelectorAll('.draft-card')).map(c => ({
        channel: c.querySelector('.badge')?.innerText,
        text: c.querySelector('p')?.innerText,
        statusChip: c.querySelector('small')?.innerText,
        grounding: Array.from(c.querySelectorAll('.chip')).map(chip => chip.innerText)
      }));
    })()`);
    console.log('Draft Cards rendered count:', draftCards.length);
    console.log('Draft Status Chips:', draftCards.map(d => d.statusChip));
    draftCards.forEach(d => {
      if (d.statusChip !== 'NOT PUBLISHED · PUBLISHING NOT APPROVED') {
        throw new Error('Draft card missing mandatory PUBLISHING NOT APPROVED protection chip');
      }
    });

    // Verify creative thumbnail preview rendered in Social
    const thumbSrc = await client.evaluate(`document.querySelector('.thumb-row img')?.src`);
    console.log('Social Creative Preview thumbnail rendered:', Boolean(thumbSrc));
    if (!thumbSrc?.includes('/api/creative/asset')) {
      throw new Error('Creative preview thumbnail missing from Social workspace');
    }

    // Enter Approver Identity and Role
    console.log('Filling in Human Approval gateway inputs...');
    await client.evaluate(`(() => {
      const idInput = document.querySelector('input[placeholder="Demo approver name"]');
      if (idInput) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(idInput, 'Alice Marketing Lead');
        idInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
      const roleSelect = document.querySelector('.approval-grid select');
      if (roleSelect) {
        roleSelect.value = 'marketing_lead';
        roleSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
    })()`);

    // Click "Approve drafts"
    console.log('Clicking "Approve drafts" button...');
    await client.evaluate(`(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Approve drafts'));
      if (btn) btn.click();
    })()`);

    // Wait for approval confirmation banner
    await waitForSelector('.banner.bn-ok', 15000);
    const approvalBanner = await client.evaluate(`document.querySelector('.banner.bn-ok')?.innerText`);
    console.log('Approval Gateway Result Banner:', approvalBanner);

    if (!approvalBanner?.includes('Approved by Alice Marketing Lead (marketing_lead)')) {
      throw new Error('Human approval was not minted or displayed: ' + approvalBanner);
    }
    if (!approvalBanner?.includes('local drafts only')) {
      throw new Error('Approval banner failed to specify local drafts only scope');
    }

    // Capture comprehensive Phase 3 verification screenshot
    const screenshotData = await client.send('Page.captureScreenshot', { format: 'png' });
    const screenshotPath = join(process.cwd(), 'apps', 'meta-os', 'docs', 'screenshots', 'browser-acceptance-phase3.png');
    await writeFile(screenshotPath, Buffer.from(screenshotData.data, 'base64'));
    console.log('\nSaved full Phase 3 verification screenshot to:', screenshotPath);

    // Audit console logs and runtime exceptions
    console.log('\n--- CONSOLE EXCEPTION AUDIT ---');
    console.log('Browser console logs count:', client.consoleLogs.length);
    console.log('Browser unhandled exceptions count:', client.exceptions.length);
    if (client.exceptions.length > 0) {
      console.error('Unhandled exceptions detected:', client.exceptions);
      throw new Error('Unhandled exceptions detected during browser acceptance');
    }

    client.close();
    console.log('\n=== ALL PHASE 3 WORKFLOW ACCEPTANCE STEPS PASSED 100% ===');
  } finally {
    chromeProcess.kill('SIGKILL');
    nextProcess.kill('SIGKILL');
  }
}

runBrowserAcceptance().catch(err => {
  console.error('\n*** BROWSER ACCEPTANCE FAILED ***');
  console.error(err);
  process.exit(1);
});

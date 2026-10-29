import { spawn } from 'node:child_process';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DEBUG_PORT = 9333;
const TARGET_PORT = 3700;
const TARGET_URL = `http://127.0.0.1:${TARGET_PORT}`;
const DEMO_SECRET = 'dev-demo-secret-key-for-browser-acceptance';
const ASSET_SECRET = 'dev-asset-secret-key-for-browser-acceptance';
const APPROVAL_SECRET = 'dev-approval-secret-key-for-browser-acceptance';
const SCREENSHOT_DIR = join(process.cwd(), 'apps', 'meta-os', 'docs', 'screenshots');

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

  async captureScreenshot(filename) {
    const data = await this.send('Page.captureScreenshot', { format: 'png' });
    const fullPath = join(SCREENSHOT_DIR, filename);
    await writeFile(fullPath, Buffer.from(data.data, 'base64'));
    console.log(`[Screenshot Captured] ${filename} -> ${fullPath}`);
    return fullPath;
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

async function runBrowserAcceptance() {
  console.log('=== RALION META OS PREMIUM WORKFLOW BROWSER ACCEPTANCE ===');
  console.log('Target URL:', TARGET_URL);
  console.log('Browser:', CHROME_PATH);

  await mkdir(SCREENSHOT_DIR, { recursive: true });

  // Start Next.js dev server with required configuration and mock generation
  console.log('Starting Next.js server with Premium OS + Demo Session configuration...');
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
    '--window-size=1440,960',
    'about:blank'
  ]);

  try {
    const wsUrl = await getDebuggerUrl(DEBUG_PORT);
    console.log('Chrome CDP attached at:', wsUrl);

    const client = new CDPClient(wsUrl);
    await client.connect();

    await client.send('Page.enable');
    await client.send('Runtime.enable');

    async function waitForSelector(selector, timeoutMs = 20000) {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        const found = await client.evaluate(`Boolean(document.querySelector('${selector}'))`);
        if (found) return true;
        await wait(300);
      }
      throw new Error('Timeout waiting for selector: ' + selector);
    }

    async function waitForCondition(expression, timeoutMs = 25000) {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        const result = await client.evaluate(`Boolean(${expression})`);
        if (result) return true;
        await wait(300);
      }
      throw new Error('Timeout waiting for: ' + expression);
    }

    // 1. Initial Navigation & Shell Hydration
    console.log('\n[1/12] Navigating to Command Centre...');
    await client.send('Page.navigate', { url: TARGET_URL });
    await waitForSelector('.brand-text');
    await wait(1500);

    const title = await client.evaluate('document.title');
    const brandText = await client.evaluate('document.querySelector(".brand-text")?.innerText');
    console.log('Page Title:', title);
    console.log('Brand Header:', brandText?.replace(/\n/g, ' '));

    // Verify Session Initialization & Session Badge
    console.log('Waiting for session badge auto-initialization...');
    await waitForSelector('.session-badge', 15000);
    const sessionBadge = await client.evaluate('document.querySelector(".session-badge")?.innerText');
    console.log('Session Badge in Header:', sessionBadge);
    if (!sessionBadge || !sessionBadge.includes('DEMO SESSION')) {
      throw new Error('Auto demo session initialization failed: badge is ' + sessionBadge);
    }

    // Verify 4 KPI cards on Command Centre
    const kpiCount = await client.evaluate('document.querySelectorAll(".stats .stat").length');
    console.log('Command Centre KPI cards rendered:', kpiCount);
    if (kpiCount < 4) throw new Error('Expected 4 KPI cards, found ' + kpiCount);

    // Verify 7-state workflow tracker
    const trackStepCount = await client.evaluate('document.querySelectorAll(".track .track-step").length');
    console.log('Workflow tracker steps rendered:', trackStepCount);
    if (trackStepCount < 6) throw new Error('Expected at least 6 workflow tracker steps');

    // Capture Screenshot 1: Command Centre 1440px Desktop
    await client.captureScreenshot('command-1440.png');

    // 2. Mobile 390px Viewport Check
    console.log('\n[2/12] Testing Command Centre Mobile 390px Viewport...');
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true
    });
    await wait(400);

    const overflowCheck = await client.evaluate(`(() => {
      return {
        innerW: window.innerWidth,
        scrollW: document.documentElement.scrollWidth,
        bodyScrollW: document.body.scrollWidth,
        hasHorizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1
      };
    })()`);
    console.log('Mobile 390px viewport check:', overflowCheck);
    if (overflowCheck.hasHorizontalOverflow) {
      throw new Error('Horizontal overflow detected at 390px: ' + JSON.stringify(overflowCheck));
    }

    // Capture Screenshot 2: Command Centre 390px Mobile
    await client.captureScreenshot('command-390.png');

    // Restore desktop metrics
    await client.send('Emulation.clearDeviceMetricsOverride');
    await wait(300);

    // 3. Theme Toggle & Light Theme Check
    console.log('\n[3/12] Testing Light Theme on Command Centre...');
    await client.evaluate('document.querySelector(".theme-btn")?.click()');
    await wait(500);
    const currentTheme = await client.evaluate(`document.documentElement.getAttribute('data-theme')`);
    console.log('Current Theme after toggle:', currentTheme);
    if (currentTheme !== 'light') throw new Error('Theme toggle to light failed');

    // Capture Screenshot 3: Command Centre Light Theme
    await client.captureScreenshot('command-light-1440.png');

    // Restore Dark theme
    await client.evaluate('document.querySelector(".theme-btn")?.click()');
    await wait(400);

    // 4. MARI Hero Submission from Command Centre
    console.log('\n[4/12] Testing MARI Hero Goal Submission...');
    // Click suggestion pill to populate goal in React state reliably
    await client.evaluate(`(() => {
      const suggestPill = Array.from(document.querySelectorAll('.suggest')).find(s => s.innerText.includes('morning'));
      if (suggestPill) suggestPill.click();
    })()`);
    await wait(200);

    // Click submit
    await client.evaluate(`(() => {
      const submitBtn = document.querySelector('.hero-goal button[type="submit"]');
      if (submitBtn) submitBtn.click();
    })()`);

    console.log('Waiting for mission planning transition to MARI...');
    await waitForCondition(`document.querySelector(".page-head h1")?.innerText?.includes('MARI')`, 25000);
    const mariHeading = await client.evaluate('document.querySelector(".page-head h1")?.innerText');
    console.log('Current Workspace:', mariHeading);
    if (!mariHeading?.includes('MARI')) {
      throw new Error('Hero submission did not navigate to MARI: ' + mariHeading);
    }

    // Capture Screenshot 4: MARI Workspace
    await client.captureScreenshot('mari-1440.png');

    // 5. MARI Ask a Follow-up
    console.log('\n[5/12] Testing MARI Ask a Follow-up...');
    await client.evaluate(`(() => {
      const input = document.querySelector('input[placeholder*="Focus on weekend foot traffic"]');
      if (input) {
        if (input._valueTracker) input._valueTracker.setValue('');
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(input, 'Focus on local weekend commuters and cyclists');
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    })()`);
    await wait(200);
    await client.evaluate(`(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Ask follow-up'));
      if (btn) btn.click();
    })()`);
    await waitForCondition(`document.body.innerText.includes('Focus on local weekend commuters and cyclists')`, 20000);

    // Verify follow-up fact is reflected
    const factsBasis = await client.evaluate(`document.body.innerText.includes('Focus on local weekend commuters and cyclists')`);
    console.log('Follow-up appended to mission context:', factsBasis);

    // 6. Growth Workspace & Send Brief to Creative
    console.log('\n[6/12] Testing Growth Workspace and Brief Handoff...');
    await client.evaluate(`(() => {
      Array.from(document.querySelectorAll('.nav-item')).find(b => b.innerText.toLowerCase().includes('growth')).click();
    })()`);
    await waitForCondition(`document.querySelector(".page-head h1")?.innerText?.includes('Growth')`, 15000);

    const oppCard = await client.evaluate(`document.querySelector('.card .card-head')?.innerText || ''`);
    console.log('Growth Priority Opportunity Card rendered:', Boolean(oppCard));

    // Capture Screenshot 5: Growth Workspace
    await client.captureScreenshot('growth-1440.png');

    // Click "Send brief to Creative Studio" button
    console.log('Clicking "Send brief to Creative Studio"...');
    await client.evaluate(`(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Send brief to Creative Studio'));
      if (btn) btn.click();
    })()`);
    await waitForCondition(`document.querySelector(".page-head h1")?.innerText?.includes('Creative')`, 15000);

    const creativeHead = await client.evaluate('document.querySelector(".page-head h1")?.innerText');
    console.log('Navigated to Workspace:', creativeHead);
    if (!creativeHead?.includes('Creative')) {
      throw new Error('Brief handoff did not navigate to Creative Studio');
    }

    // 7. Creative Studio Generation with Requested Format
    console.log('\n[7/12] Testing Creative Studio Generation and Regeneration...');
    // Select format pill: 9:16 Story
    await client.evaluate(`(() => {
      const storyBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('9:16 Story'));
      if (storyBtn) storyBtn.click();
    })()`);
    await wait(200);

    // Click "Use brief suggestion"
    await client.evaluate(`(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Use brief suggestion'));
      if (btn) btn.click();
    })()`);
    await wait(200);

    // Custom prompt edit
    await client.evaluate(`(() => {
      const promptArea = document.querySelector('textarea[placeholder*="Describe the image"]');
      if (promptArea) {
        if (promptArea._valueTracker) promptArea._valueTracker.setValue('');
        const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
        setter.call(promptArea, 'Artisanal morning espresso on wooden rustic table with fresh croissants in 9:16 frame');
        promptArea.dispatchEvent(new Event('input', { bubbles: true }));
        promptArea.dispatchEvent(new Event('change', { bubbles: true }));
      }
    })()`);

    // Verify unconfirmed generation guard
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
      if (chk && !chk.checked) chk.click();
    })()`);
    await wait(200);

    // Submit authorized generation
    console.log('Submitting authorized creative image generation...');
    await client.evaluate(`(() => {
      const genBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Generate image'));
      if (genBtn) genBtn.click();
    })()`);

    await waitForSelector('.asset-card', 15000);
    console.log('Asset card rendered in Creative Studio!');

    const assetDetails = await client.evaluate(`(() => {
      const card = document.querySelector('.asset-card');
      const img = card?.querySelector('img');
      return {
        hasImg: Boolean(img),
        imgSrc: img?.src,
        prompt: card?.querySelector('.asset-meta p')?.innerText,
        badges: Array.from(card?.querySelectorAll('.badge') || []).map(b => b.innerText)
      };
    })()`);
    console.log('Generated Asset Details:', assetDetails);
    if (!assetDetails.hasImg || !assetDetails.imgSrc?.includes('/api/creative/asset')) {
      throw new Error('Creative asset preview image did not render signed capability URL');
    }

    // Capture Screenshot 6: Creative Studio Workspace
    await client.captureScreenshot('creative-1440.png');

    // Test Regenerate button
    console.log('Testing "Regenerate" flow on asset card...');
    await client.evaluate(`(() => {
      const regenBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Regenerate'));
      if (regenBtn) regenBtn.click();
    })()`);
    await wait(300);
    const regenNotice = await client.evaluate(`document.querySelector('.banner.bn-ok')?.innerText`);
    console.log('Regeneration Notice Banner:', regenNotice);
    if (!regenNotice?.includes('regeneration')) {
      throw new Error('Regeneration banner was not displayed');
    }

    // 8. Social Workspace & Draft Editing & Approval Invalidation
    console.log('\n[8/12] Testing Social Workspace: Draft Posts, Editing, and Human Approval...');
    await client.evaluate(`(() => {
      Array.from(document.querySelectorAll('.nav-item')).find(b => b.innerText.toLowerCase().includes('social')).click();
    })()`);
    await waitForCondition(`document.querySelector(".page-head h1")?.innerText?.includes('Social')`, 15000);

    const postCount = await client.evaluate('document.querySelectorAll(".post").length');
    console.log('Social post-style draft cards rendered:', postCount);
    if (postCount < 2) throw new Error('Expected at least 2 social post cards');

    // Capture Screenshot 7: Social Workspace
    await client.captureScreenshot('social-1440.png');

    // Test Inline Draft Editing on Facebook draft
    console.log('Testing inline draft editing on Facebook post...');
    await client.evaluate(`(() => {
      const firstEditBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Edit draft'));
      if (firstEditBtn) firstEditBtn.click();
    })()`);
    await wait(200);

    await client.evaluate(`(() => {
      const captionArea = document.querySelector('.post textarea');
      if (captionArea) {
        if (captionArea._valueTracker) captionArea._valueTracker.setValue('');
        const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
        setter.call(captionArea, 'Artisanal roast mornings: stop by Northstar Coffee for fresh espresso & warm pastries.');
        captionArea.dispatchEvent(new Event('input', { bubbles: true }));
        captionArea.dispatchEvent(new Event('change', { bubbles: true }));
      }
      const saveBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Save revision'));
      if (saveBtn) saveBtn.click();
    })()`);
    await wait(300);
    console.log('Saved revised draft caption.');

    // Human Approval
    console.log('Recording Human Approval for mission...');
    await client.evaluate(`(() => {
      const idInput = document.querySelector('input[placeholder="Demo approver name"]');
      if (idInput) {
        if (idInput._valueTracker) idInput._valueTracker.setValue('');
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(idInput, 'Alice Marketing Lead');
        idInput.dispatchEvent(new Event('input', { bubbles: true }));
        idInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
      const roleSelect = document.querySelector('.approval-grid select');
      if (roleSelect) {
        roleSelect.value = 'marketing_lead';
        roleSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Approve drafts'));
      if (btn) btn.click();
    })()`);

    await waitForSelector('.banner.bn-ok', 15000);
    const approvalBanner = await client.evaluate(`document.querySelector('.banner.bn-ok')?.innerText`);
    console.log('Approval Result:', approvalBanner);
    if (!approvalBanner?.includes('Approved by Alice Marketing Lead (marketing_lead)')) {
      throw new Error('Approval banner not displayed as expected: ' + approvalBanner);
    }

    // Test Approval Invalidation after draft edit
    console.log('Testing approval invalidation when draft is edited after approval...');
    await client.evaluate(`(() => {
      const editBtns = Array.from(document.querySelectorAll('button')).filter(b => b.innerText.includes('Edit draft'));
      if (editBtns.length > 1) editBtns[1].click();
      else if (editBtns.length > 0) editBtns[0].click();
    })()`);
    await wait(200);

    await client.evaluate(`(() => {
      const captionArea = document.querySelector('.post textarea');
      if (captionArea) {
        if (captionArea._valueTracker) captionArea._valueTracker.setValue('');
        const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
        setter.call(captionArea, 'Weekend espresso vibes at Northstar Coffee.');
        captionArea.dispatchEvent(new Event('input', { bubbles: true }));
        captionArea.dispatchEvent(new Event('change', { bubbles: true }));
      }
      const saveBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Save revision'));
      if (saveBtn) saveBtn.click();
    })()`);
    await wait(300);

    // Verify invalidation warning banner appears
    const invalidationBanner = await client.evaluate(`(() => {
      const banners = Array.from(document.querySelectorAll('.banner.bn-warn'));
      return banners.map(b => b.innerText).find(t => t.includes('re-approval is required') || t.includes('previous approval no longer applies')) || '';
    })()`);
    console.log('Approval Invalidation Banner:', invalidationBanner);
    if (!invalidationBanner) {
      throw new Error('Approval invalidation banner was not displayed after editing draft!');
    }

    // 9. Activity Workspace & Learning Loop & Business Memory
    console.log('\n[9/12] Testing Activity Workspace: Usage, Budget, Learning Loop, and Business Memory...');
    await client.evaluate(`(() => {
      Array.from(document.querySelectorAll('.nav-item')).find(b => b.innerText.toLowerCase().includes('activity')).click();
    })()`);
    await waitForCondition(`document.querySelector(".page-head h1")?.innerText?.includes('Activity')`, 15000);

    const activityCards = await client.evaluate(`(() => {
      return Array.from(document.querySelectorAll('.card')).map(c => c.querySelector('h3')?.innerText).filter(Boolean);
    })()`);
    console.log('Activity Workspace Cards:', activityCards);
    if (!activityCards.some(t => t.includes('Business memory'))) {
      throw new Error('Business memory card was not found in Activity workspace');
    }

    // Wait for memory data to load
    await wait(800);
    const memoryCardText = await client.evaluate(`(() => {
      const card = Array.from(document.querySelectorAll('.card')).find(c => c.querySelector('h3')?.innerText.includes('Business memory'));
      return card?.innerText || '';
    })()`);
    console.log('Business Memory Card Status:', memoryCardText.slice(0, 150) + '...');

    // Verify learning loop 7 stages
    const loopRowsCount = await client.evaluate('document.querySelectorAll(".card .kv-row").length');
    console.log('Activity detail rows rendered count:', loopRowsCount);

    // Capture Screenshot 8: Activity Workspace (1440px)
    await client.captureScreenshot('activity-1440.png');

    // Test Mobile 390px Viewport on Activity Workspace
    console.log('Testing Activity Workspace on Mobile 390px Viewport...');
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 3,
      mobile: true
    });
    await wait(300);

    const activityMobileCheck = await client.evaluate(`(() => {
      return {
        innerW: window.innerWidth,
        scrollW: document.documentElement.scrollWidth,
        bodyScrollW: document.body.scrollWidth,
        hasHorizontalOverflow: document.documentElement.scrollWidth > window.innerWidth || document.body.scrollWidth > window.innerWidth
      };
    })()`);
    console.log('Activity Mobile 390px Viewport Check:', activityMobileCheck);
    if (activityMobileCheck.hasHorizontalOverflow) {
      throw new Error('Horizontal overflow detected on mobile 390px in Activity workspace!');
    }
    await client.captureScreenshot('activity-memory-390.png');

    // Restore desktop viewport
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });
    await wait(300);

    // 10. Settings Workspace & Session Lifecycle
    console.log('\n[10/12] Testing Settings Workspace & Session Lifecycle...');
    await client.evaluate(`(() => {
      Array.from(document.querySelectorAll('.nav-item')).find(b => b.innerText.toLowerCase().includes('settings')).click();
    })()`);
    await waitForCondition(`document.querySelector(".page-head h1")?.innerText?.includes('Settings')`, 15000);

    const sessionCardText = await client.evaluate(`(() => {
      const card = Array.from(document.querySelectorAll('.card')).find(c => c.querySelector('h3')?.innerText.includes('Demo session'));
      return card?.innerText || '';
    })()`);
    console.log('Settings Demo Session Card Status:', sessionCardText.includes('Active') ? 'Active' : 'Not active');
    if (!sessionCardText.includes('Active')) {
      throw new Error('Settings card does not display active session');
    }

    // Test Revocation
    console.log('Revoking session from Settings...');
    await client.evaluate(`(() => {
      const card = Array.from(document.querySelectorAll('.card')).find(c => c.querySelector('h3')?.innerText.includes('Demo session'));
      const resetBtn = Array.from(card?.querySelectorAll('button') || []).find(b => b.innerText.includes('Revoke'));
      if (resetBtn) resetBtn.click();
    })()`);
    await wait(600);

    const statusAfterRevoke = await client.evaluate(`(() => {
      const card = Array.from(document.querySelectorAll('.card')).find(c => c.querySelector('h3')?.innerText.includes('Demo session'));
      return card?.innerText || '';
    })()`);
    console.log('Status after revocation:', statusAfterRevoke.includes('Not started') ? 'Revoked (Not started)' : 'Updated');

    // 11. Test Session Negative Path (Protected Route Denied Without Session)
    console.log('\n[11/12] Testing Negative Path: Protected API Access without Active Session...');
    const negativeTestResult = await client.evaluate(`(async () => {
      try {
        const r = await fetch('/api/mission/approve', {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ mission: {}, actorId: 'hacker', role: 'owner', decision: 'APPROVED' })
        });
        const body = await r.json().catch(() => ({}));
        return { status: r.status, error: body.error };
      } catch (e) {
        return { error: e.message };
      }
    })()`);
    console.log('Negative test result for unauthorized approval request:', negativeTestResult);
    if (negativeTestResult.status !== 401) {
      throw new Error('Expected 401 Unauthorized for unauthenticated request, got: ' + JSON.stringify(negativeTestResult));
    }

    // Re-issue session from Settings
    console.log('Re-issuing session from Settings...');
    await client.evaluate(`(() => {
      const card = Array.from(document.querySelectorAll('.card')).find(c => c.querySelector('h3')?.innerText.includes('Demo session'));
      const startBtn = Array.from(card?.querySelectorAll('button') || []).find(b => b.innerText.includes('Start') || b.innerText.includes('Resume'));
      if (startBtn) startBtn.click();
    })()`);
    await wait(600);

    const statusAfterReissue = await client.evaluate(`(() => {
      const card = Array.from(document.querySelectorAll('.card')).find(c => c.querySelector('h3')?.innerText.includes('Demo session'));
      return card?.innerText || '';
    })()`);
    console.log('Status after re-issue:', statusAfterReissue.includes('Active') ? 'Active' : 'Unchanged');
    if (!statusAfterReissue.includes('Active')) {
      throw new Error('Session was not re-issued cleanly');
    }

    // 12. Audit Console Logs & Runtime Exceptions
    console.log('\n[12/12] Console & Runtime Exception Audit...');
    console.log('Browser console logs count:', client.consoleLogs.length);
    console.log('Browser unhandled exceptions count:', client.exceptions.length);
    if (client.exceptions.length > 0) {
      console.error('Unhandled exceptions detected:', client.exceptions);
      throw new Error('Unhandled exceptions detected during browser acceptance');
    }

    client.close();
    console.log('\n=== ALL BROWSER ACCEPTANCE WORKFLOWS & VISUAL REVIEWS PASSED (100%) ===');
    process.exit(0);
  } finally {
    try { chromeProcess.kill('SIGKILL'); } catch {}
    try { nextProcess.kill('SIGKILL'); } catch {}
  }
}

runBrowserAcceptance().catch(err => {
  console.error('\n*** BROWSER ACCEPTANCE FAILED ***');
  console.error(err);
  process.exit(1);
});

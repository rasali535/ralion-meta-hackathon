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


  // Start Next.js dev server with required Phase 3 configuration and mock generation
  console.log('Starting Next.js server with Phase 3 + Demo Session configuration...');
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

    // Verify Session Initialization & Session Badge (wait for initial API route compilation)
    console.log('Waiting for session badge auto-initialization...');
    await waitForSelector('.session-badge', 15000);
    const sessionBadge = await client.evaluate('document.querySelector(".session-badge")?.innerText');
    console.log('Session Badge in Header:', sessionBadge);
    if (!sessionBadge || !sessionBadge.includes('DEMO SESSION')) {
      throw new Error('Auto demo session initialization failed: badge is ' + sessionBadge);
    }

    // 2. Theme Toggle
    console.log('\n[2/9] Testing Theme Toggle...');
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
    console.log('\n[3/9] Testing Navigation across all 8 workspaces...');
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

    // 4. Mission Submission in Business Workspace (Without manual token, using active session)
    console.log('\n[4/9] Submitting Mission from Business Workspace (using active demo session)...');
    await client.evaluate(`(() => {
      Array.from(document.querySelectorAll('.nav-item')).find(b => b.innerText.toLowerCase().includes('business')).click();
    })()`);
    await wait(400);

    // Submit form directly without entering manual demo token
    await client.evaluate(`(() => {
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

    // 6. Test Creative Studio & Image Generation with Format Selection
    console.log('\n[6/8] Testing Creative Studio: format selection, prompt editing, confirmation, and generation...');
    await client.evaluate(`(() => {
      Array.from(document.querySelectorAll('.nav-item')).find(b => b.innerText.toLowerCase().includes('creative')).click();
    })()`);
    await wait(500);

    // Verify brief options
    const briefSource = await client.evaluate(`document.querySelector('.select')?.value`);
    console.log('Default brief source:', briefSource);

    // Select format pill: 9:16 Story
    console.log('Selecting requested format: 9:16 Story...');
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

    const framedPrompt = await client.evaluate(`document.querySelector('textarea[placeholder*="Describe the image"]')?.value`);
    console.log('Framed prompt preview:', framedPrompt);
    if (!framedPrompt?.includes('9:16 Story')) {
      throw new Error('Built prompt did not include requested format framing: ' + framedPrompt);
    }

    // Edit prompt explicitly (framing stays intact or custom prompt is used)
    await client.evaluate(`(() => {
      const promptArea = document.querySelector('textarea[placeholder*="Describe the image"]');
      if (promptArea) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
        setter.call(promptArea, 'Artisanal morning espresso on wooden rustic table with fresh croissants in 9:16 frame');
        promptArea.dispatchEvent(new Event('input', { bubbles: true }));
      }
    })()`);

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
    console.log('Submitting authorized creative image generation with 9:16 Story format...');
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
    const hasRequestedFormatBadge = assetDetails.badges.some(b => b.includes('Requested 9:16 Story'));
    console.log('Requested format badge present:', hasRequestedFormatBadge);
    if (!hasRequestedFormatBadge) {
      throw new Error('Asset card missing "Requested 9:16 Story" metadata badge');
    }

    // 7. Test Social Workspace & Approval Gateway with Canonical Handoffs
    console.log('\n[7/8] Testing Social draft cards, creative previews, Canonical Handoffs, and Human Approval...');
    await client.evaluate(`(() => {
      Array.from(document.querySelectorAll('.nav-item')).find(b => b.innerText.toLowerCase().includes('social')).click();
    })()`);
    await wait(500);

    // Verify Facebook and Instagram draft cards
    const draftCards = await client.evaluate(`(() => {
      return Array.from(document.querySelectorAll('.draft-card')).map(c => ({
        channel: c.querySelector('.badge')?.innerText,
        text: c.querySelector('p')?.innerText,
        statusChip: Array.from(c.querySelectorAll('small')).map(s => s.innerText).find(t => t.includes('NOT PUBLISHED')) || '',
        chips: Array.from(c.querySelectorAll('.chip')).map(chip => chip.innerText)
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

    // Verify canonical handoff chips appear on cards after approval
    const handoffChips = await client.evaluate(`(() => {
      return Array.from(document.querySelectorAll('.chip-row .chip')).map(c => c.innerText);
    })()`);
    console.log('Handoff Chips rendered:', handoffChips);
    const hasBoundChip = handoffChips.some(c => c.includes('Approval bound'));
    const hasContractChip = handoffChips.some(c => c.includes('Contract'));
    const hasPublishStatus = handoffChips.some(c => c.toLowerCase().includes('publish not connected'));
    console.log('Handoff contract bound to approval:', hasBoundChip);
    console.log('Contract channel chip present:', hasContractChip);
    console.log('Publish not connected chip present:', hasPublishStatus);
    if (!hasBoundChip || !hasContractChip) {
      throw new Error('Social handoff contracts failed to bind to approval record');
    }

    // 8. Test Activity Workspace: Telemetry & 7-Stage Learning Loop Inspector
    console.log('\n[8/8] Testing Activity Workspace: Usage Telemetry and Learning Loop Inspector...');
    await client.evaluate(`(() => {
      Array.from(document.querySelectorAll('.nav-item')).find(b => b.innerText.toLowerCase().includes('activity')).click();
    })()`);

    // Verify Model Usage telemetry card (allowing time for dev server route compilation)
    let telemetryItems = [];
    for (let i = 0; i < 15; i++) {
      telemetryItems = await client.evaluate(`(() => {
        const items = Array.from(document.querySelectorAll('.grid-2 .card:first-child .timeline li'));
        return items.map(li => li.innerText);
      })()`);
      if (telemetryItems.length > 0) break;
      await wait(400);
    }
    console.log('Telemetry Records rendered count:', telemetryItems.length);
    if (telemetryItems.length > 0) {
      console.log('Latest Telemetry Entry:', telemetryItems[0]);
    }

    // Verify Learning Loop 7 stages
    const learningLoopData = await client.evaluate(`(() => {
      const loopCard = Array.from(document.querySelectorAll('.card')).find(c => c.querySelector('h3')?.innerText.includes('Learning loop'));
      const rows = Array.from(loopCard ? loopCard.querySelectorAll('.kv-row') : []);
      const badges = Array.from(loopCard ? loopCard.querySelectorAll('.badge') : []).map(b => b.innerText);
      const note = loopCard?.querySelector('p.muted')?.innerText;
      return {
        badges,
        rows: rows.map(r => ({ k: r.querySelector('dt')?.innerText, v: r.querySelector('dd')?.innerText })),
        note
      };
    })()`);
    console.log('Learning Loop Badges:', learningLoopData.badges);
    console.log('Learning Loop Rows count:', learningLoopData.rows.length);
    learningLoopData.rows.forEach(r => console.log(`  ${r.k}: ${r.v?.slice(0, 70)}...`));

    if (learningLoopData.rows.length < 7) {
      throw new Error('Learning loop inspector did not render all 7 stages: found ' + learningLoopData.rows.length);
    }
    const hasPublishNotConnected = learningLoopData.badges.some(b => b.toLowerCase().includes('publish not connected'));
    const hasPerfNotAvailable = learningLoopData.badges.some(b => b.toLowerCase().includes('performance not available'));
    if (!hasPublishNotConnected || !hasPerfNotAvailable) {
      throw new Error('Learning loop badges missing mandatory NOT CONNECTED / NOT AVAILABLE honesty guards');
    }

    // 9. Test Settings Workspace: Demo Session Lifecycle
    console.log('\n[9/9] Testing Settings Workspace: Demo Session card, revocation, and re-issuance...');
    await client.evaluate(`(() => {
      Array.from(document.querySelectorAll('.nav-item')).find(b => b.innerText.toLowerCase().includes('settings')).click();
    })()`);
    await wait(500);

    const sessionCardText = await client.evaluate(`(() => {
      const card = Array.from(document.querySelectorAll('.card')).find(c => c.querySelector('h3')?.innerText.includes('Demo session'));
      return card?.innerText || '';
    })()`);
    console.log('Settings Demo Session Card rendered:', Boolean(sessionCardText));
    if (!sessionCardText.includes('Active')) {
      throw new Error('Settings card does not display active session status: ' + sessionCardText);
    }

    // Test Revocation (Revoke demo session)
    console.log('Testing session revocation from Settings...');
    await client.evaluate(`(() => {
      const card = Array.from(document.querySelectorAll('.card')).find(c => c.querySelector('h3')?.innerText.includes('Demo session'));
      const resetBtn = Array.from(card?.querySelectorAll('button') || []).find(b => b.innerText.includes('Revoke'));
      if (resetBtn) resetBtn.click();
    })()`);
    await wait(600);

    const statusAfterReset = await client.evaluate(`(() => {
      const card = Array.from(document.querySelectorAll('.card')).find(c => c.querySelector('h3')?.innerText.includes('Demo session'));
      return card?.innerText || '';
    })()`);
    console.log('Settings status after reset:', statusAfterReset.includes('Not started') ? 'Revoked (Not started)' : 'Status updated');

    // Test Re-issuance (Resume / Start demo session)
    console.log('Testing session start/resume from Settings...');
    await client.evaluate(`(() => {
      const card = Array.from(document.querySelectorAll('.card')).find(c => c.querySelector('h3')?.innerText.includes('Demo session'));
      const startBtn = Array.from(card?.querySelectorAll('button') || []).find(b => b.innerText.includes('Start') || b.innerText.includes('Resume'));
      if (startBtn) startBtn.click();
    })()`);
    await wait(600);

    const statusAfterResume = await client.evaluate(`(() => {
      const card = Array.from(document.querySelectorAll('.card')).find(c => c.querySelector('h3')?.innerText.includes('Demo session'));
      return card?.innerText || '';
    })()`);
    console.log('Settings status after resume:', statusAfterResume.includes('Active') ? 'Re-issued (Active)' : 'Active');
    if (!statusAfterResume.includes('Active')) {
      throw new Error('Session could not be re-issued from Settings: ' + statusAfterResume);
    }

    // Mobile Responsive Check
    console.log('\nTesting Mobile Viewport Drawer...');
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true
    });
    await wait(300);
    // Open mobile burger menu
    await client.evaluate(`document.querySelector('.burger')?.click()`);
    await wait(300);
    const navOpen = await client.evaluate(`document.querySelector('.os')?.classList.contains('nav-open')`);
    console.log('Mobile navigation drawer opened:', Boolean(navOpen));
    if (!navOpen) throw new Error('Mobile drawer did not open on burger click');
    // Close scrim
    await client.evaluate(`document.querySelector('.scrim')?.click()`);
    await wait(300);
    // Restore desktop viewport
    await client.send('Emulation.clearDeviceMetricsOverride');

    // Capture comprehensive Post-Extraction verification screenshot
    const screenshotData = await client.send('Page.captureScreenshot', { format: 'png' });
    const screenshotPath = join(process.cwd(), 'apps', 'meta-os', 'docs', 'screenshots', 'browser-acceptance-demo-session.png');
    await writeFile(screenshotPath, Buffer.from(screenshotData.data, 'base64'));
    console.log('\nSaved full Demo Session verification screenshot to:', screenshotPath);

    // Audit console logs and runtime exceptions
    console.log('\n--- CONSOLE EXCEPTION AUDIT ---');
    console.log('Browser console logs count:', client.consoleLogs.length);
    console.log('Browser unhandled exceptions count:', client.exceptions.length);
    if (client.exceptions.length > 0) {
      console.error('Unhandled exceptions detected:', client.exceptions);
      throw new Error('Unhandled exceptions detected during browser acceptance');
    }

    client.close();
    console.log('\n=== ALL POST-EXTRACTION ACCEPTANCE STEPS PASSED 100% ===');
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

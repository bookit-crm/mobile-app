#!/usr/bin/env node
/**
 * telegram-report.js — Mobile App
 *
 * Reads a Playwright JSON results file and sends a formatted message
 * to a Telegram chat via the Bot API.
 *
 * Usage:
 *   node e2e/telegram-report.js \
 *     --results /tmp/playwright-results.json \
 *     --bot-token "xxx" \
 *     --chat-id "yyy" \
 *     --run-number "42" \
 *     --branch "main" \
 *     --commit "abc1234" \
 *     --report-url "http://1.2.3.4/mobile-run-42/index.html" \
 *     --actor "github-user"
 */

const https = require('https');
const fs    = require('fs');

// ── Parse CLI args ────────────────────────────────────────────────────────────
const args = {};
process.argv.slice(2).forEach((arg, i, arr) => {
  if (arg.startsWith('--')) {
    const key = arg.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    args[key] = arr[i + 1] ?? '';
  }
});

const {
  results:   resultsPath  = '/tmp/playwright-results.json',
  botToken:  BOT_TOKEN    = process.env.TELEGRAM_BOT_TOKEN ?? '',
  chatId:    CHAT_ID      = process.env.TELEGRAM_CHAT_ID   ?? '',
  runNumber: RUN_NUMBER   = '?',
  branch:    BRANCH       = 'unknown',
  commit:    COMMIT       = '',
  reportUrl: REPORT_URL   = '',
  actor:     ACTOR        = '',
} = args;

if (!BOT_TOKEN || !CHAT_ID) {
  console.error('Missing --bot-token or --chat-id');
  process.exit(1);
}

// ── Parse Playwright JSON output ─────────────────────────────────────────────

let data = { stats: { expected: 0, unexpected: 0, skipped: 0, flaky: 0 }, suites: [] };
try {
  data = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
} catch (e) {
  console.warn(`Warning: cannot read ${resultsPath}:`, e.message);
}

const stats = data.stats ?? {};
const passed   = stats.expected   ?? 0;
const failed   = stats.unexpected ?? 0;
const skipped  = stats.skipped    ?? 0;
const flaky    = stats.flaky      ?? 0;
const total    = passed + failed + skipped + flaky;
const duration = Math.round((stats.duration ?? 0) / 1000);
const durationStr = duration > 60
  ? `${Math.floor(duration / 60)}m ${duration % 60}s`
  : `${duration}s`;

// ── Collect failed test names ─────────────────────────────────────────────────

function collectFailed(suites = []) {
  const out = [];
  for (const suite of suites) {
    for (const spec of (suite.specs ?? [])) {
      for (const test of (spec.tests ?? [])) {
        if (test.status === 'unexpected') {
          out.push({ title: spec.title, error: test.results?.[0]?.error?.message ?? '' });
        }
      }
    }
    out.push(...collectFailed(suite.suites ?? []));
  }
  return out;
}

const failedTests = collectFailed(data.suites ?? []);

// ── Build message ─────────────────────────────────────────────────────────────

function escMd(str) {
  return String(str).replace(/[_*[\]()~`>#+=|{}.!\\-]/g, c => `\\${c}`);
}

const statusIcon = failed === 0 ? '🟢' : '🔴';
const statusText = failed === 0 ? 'PASSED' : 'FAILED';
const shortSha   = COMMIT.slice(0, 7);
const branchStr  = BRANCH.replace('refs/heads/', '');

let msg = `${statusIcon} *Mobile E2E — ${statusText}*\n`;
msg += `\n`;
msg += `📱 *mobile\\-app* \\| Run \\#${RUN_NUMBER}\n`;
msg += `🌿 Branch: \`${escMd(branchStr)}\`\n`;
if (shortSha) msg += `🔖 Commit: \`${shortSha}\`\n`;
if (ACTOR)    msg += `👤 By: ${escMd(ACTOR)}\n`;
msg += `\n`;
msg += `━━━━━━━━━━━━━━━━━━━\n`;
msg += `✅ Passed:  *${passed}*\n`;
msg += `❌ Failed:  *${failed}*\n`;
if (skipped) msg += `⏭️ Skipped: *${skipped}*\n`;
if (flaky)   msg += `⚠️ Flaky:   *${flaky}*\n`;
msg += `📊 Total:   *${total}*\n`;
msg += `⏱️ Time:    *${durationStr}*\n`;

if (failedTests.length > 0) {
  msg += `\n*Failed tests:*\n`;
  const limit = Math.min(failedTests.length, 10);
  for (let i = 0; i < limit; i++) {
    const t = failedTests[i];
    msg += `• ${escMd(t.title)}\n`;
    if (t.error) {
      const shortErr = t.error.split('\n')[0].slice(0, 80);
      msg += `  _${escMd(shortErr)}_\n`;
    }
  }
  if (failedTests.length > 10) {
    msg += `  …and ${failedTests.length - 10} more\n`;
  }
}

if (REPORT_URL) {
  msg += `\n[📋 View Full Report](${REPORT_URL})\n`;
}

// ── Send to Telegram ──────────────────────────────────────────────────────────

function sendTelegram(text) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      chat_id:    CHAT_ID,
      text,
      parse_mode: 'MarkdownV2',
      disable_web_page_preview: true,
    });
    const opts = {
      hostname: 'api.telegram.org',
      path:     `/bot${BOT_TOKEN}/sendMessage`,
      method:   'POST',
      headers:  { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    };
    const req = https.request(opts, res => {
      let data = '';
      res.on('data', c => (data += c));
      res.on('end', () => {
        const json = JSON.parse(data);
        if (json.ok) resolve(json);
        else reject(new Error(JSON.stringify(json)));
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────

(async () => {
  try {
    console.log(`[telegram] Sending mobile report to chat ${CHAT_ID}...`);
    console.log(`[telegram] Stats: ${passed} passed, ${failed} failed, ${skipped} skipped`);
    await sendTelegram(msg);
    console.log(`[telegram] ✅ Message sent!`);
  } catch (err) {
    console.error('[telegram] ❌ Failed to send:', err.message);
    process.exit(0);
  }
})();

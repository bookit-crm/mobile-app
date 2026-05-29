#!/usr/bin/env node
/**
 * generate-summary.js
 *
 * Reads Playwright JSON results and writes a single human-readable summary file.
 * Usage: node e2e/generate-summary.js [results.json] [output.txt]
 */
'use strict';

const fs   = require('fs');
const path = require('path');

const resultsPath = process.argv[2] || path.join(__dirname, '../e2e-report/results.json');
const outputPath  = process.argv[3] || path.join(__dirname, '../e2e-summary.txt');

if (!fs.existsSync(resultsPath)) {
  console.error(`Results file not found: ${resultsPath}`);
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
const { stats } = data;

const dur  = stats.duration ? `${Math.round(stats.duration / 1000)}s` : '?';
const pass = stats.expected   ?? 0;
const fail = stats.unexpected ?? 0;
const skip = stats.skipped    ?? 0;

/** Recursively collect failed test info */
function collectFailed(suites, failed = [], suitePath = '') {
  for (const suite of (suites || [])) {
    const name = suitePath ? `${suitePath} › ${suite.title}` : suite.title;
    for (const spec of (suite.specs || [])) {
      for (const test of (spec.tests || [])) {
        const failing = test.results.find(r => r.status === 'failed' || r.status === 'timedOut');
        if (failing) {
          const msg  = failing.error?.message ?? '';
          const line = msg.split('\n').find(l => l.trim()) ?? 'no message';
          failed.push({ suite: name, title: spec.title, error: line.trim().substring(0, 200) });
        }
      }
    }
    collectFailed(suite.suites, failed, name);
  }
  return failed;
}

const failed = collectFailed(data.suites);

const lines = [
  '═══════════════════════════════════════',
  '  Mobile E2E Test Summary',
  '═══════════════════════════════════════',
  `  ✅ Passed : ${pass}`,
  `  ❌ Failed : ${fail}`,
  `  ⏭️  Skipped: ${skip}`,
  `  ⏱️  Time   : ${dur}`,
  '───────────────────────────────────────',
];

if (failed.length === 0) {
  lines.push('  🎉 All tests passed!');
} else {
  lines.push(`  Failed tests (${failed.length}):`);
  lines.push('');
  let lastSuite = '';
  for (const f of failed) {
    if (f.suite !== lastSuite) {
      lines.push(`  [${f.suite}]`);
      lastSuite = f.suite;
    }
    lines.push(`    ✗ ${f.title}`);
    lines.push(`      → ${f.error}`);
  }
}

lines.push('═══════════════════════════════════════');

const output = lines.join('\n') + '\n';
fs.writeFileSync(outputPath, output, 'utf8');

console.log(output);
console.log(`Summary written to: ${outputPath}`);

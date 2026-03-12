#!/usr/bin/env node

'use strict';

const fs = require('fs').promises;
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..');

const REQUIRED_ENTRIES = [
  { relativePath: 'package.json', type: 'file', label: 'package manifest' },
  { relativePath: 'README.md', type: 'file', label: 'project readme' },
  { relativePath: 'bin', type: 'directory', label: 'CLI binaries' },
  { relativePath: 'docs', type: 'directory', label: 'public documentation' },
  { relativePath: 'tests', type: 'directory', label: 'test suites' },
  { relativePath: '.aios-core', type: 'directory', label: 'framework root' },
  { relativePath: '.aios-core/cli', type: 'directory', label: 'framework CLI layer' },
  { relativePath: '.aios-core/core', type: 'directory', label: 'framework core layer' },
  { relativePath: '.aios-core/data', type: 'directory', label: 'shared data assets' },
  { relativePath: '.aios-core/development', type: 'directory', label: 'development assets' },
  { relativePath: '.aios-core/docs', type: 'directory', label: 'internal framework docs' },
  { relativePath: '.aios-core/elicitation', type: 'directory', label: 'elicitation engines' },
  { relativePath: '.aios-core/infrastructure', type: 'directory', label: 'infrastructure layer' },
  { relativePath: '.aios-core/manifests', type: 'directory', label: 'manifest definitions' },
  { relativePath: '.aios-core/product', type: 'directory', label: 'product assets' },
  { relativePath: '.aios-core/quality', type: 'directory', label: 'quality schemas' },
  { relativePath: '.aios-core/schemas', type: 'directory', label: 'shared schemas' },
  { relativePath: '.aios-core/scripts', type: 'directory', label: 'framework scripts' },
  { relativePath: '.aios-core/utils', type: 'directory', label: 'framework utilities' },
  { relativePath: '.aios-core/core-config.yaml', type: 'file', label: 'framework config' },
  { relativePath: '.aios-core/install-manifest.yaml', type: 'file', label: 'install manifest' },
];

const OPTIONAL_ENTRIES = [
  { relativePath: '.claude', type: 'directory', label: 'Claude Code integration' },
  { relativePath: '.github', type: 'directory', label: 'GitHub workflows' },
];

async function inspectEntry(entry) {
  const absolutePath = path.join(REPO_ROOT, ...entry.relativePath.split('/'));

  try {
    const stats = await fs.stat(absolutePath);
    const matchesType = entry.type === 'directory' ? stats.isDirectory() : stats.isFile();

    return {
      ...entry,
      absolutePath,
      status: matchesType ? 'ok' : 'wrong-type',
      actualType: stats.isDirectory() ? 'directory' : stats.isFile() ? 'file' : 'other',
    };
  } catch (error) {
    if (error.code === 'ENOENT') {
      return {
        ...entry,
        absolutePath,
        status: 'missing',
      };
    }

    throw error;
  }
}

function summarize(results) {
  return {
    ok: results.filter((result) => result.status === 'ok'),
    missing: results.filter((result) => result.status === 'missing'),
    wrongType: results.filter((result) => result.status === 'wrong-type'),
  };
}

function formatIssue(result) {
  if (result.status === 'wrong-type') {
    return `  - ${result.relativePath} (${result.label}) expected ${result.type}, found ${result.actualType}`;
  }

  return `  - ${result.relativePath} (${result.label})`;
}

function printHumanReport(requiredResults, optionalResults) {
  const requiredSummary = summarize(requiredResults);
  const optionalSummary = summarize(optionalResults);
  const passed = requiredSummary.missing.length === 0 && requiredSummary.wrongType.length === 0;

  console.log('============================================================');
  console.log('AIOX Structure Validation Report');
  console.log('============================================================');
  console.log(`Repository root: ${REPO_ROOT}`);
  console.log('');
  console.log(`Required checks: ${requiredResults.length}`);
  console.log(`Optional checks: ${optionalResults.length}`);
  console.log(`Passed checks: ${requiredSummary.ok.length}`);
  console.log('');

  if (requiredSummary.missing.length > 0) {
    console.log('Missing required paths:');
    requiredSummary.missing.forEach((result) => console.log(formatIssue(result)));
    console.log('');
  }

  if (requiredSummary.wrongType.length > 0) {
    console.log('Paths with unexpected type:');
    requiredSummary.wrongType.forEach((result) => console.log(formatIssue(result)));
    console.log('');
  }

  if (optionalSummary.missing.length > 0) {
    console.log('Optional paths not found:');
    optionalSummary.missing.forEach((result) => console.log(formatIssue(result)));
    console.log('');
  }

  console.log(passed ? '✅ Structure is valid' : '❌ Structure validation failed');
}

async function validateStructure(options = {}) {
  const requiredResults = [];
  for (const entry of REQUIRED_ENTRIES) {
    requiredResults.push(await inspectEntry(entry));
  }

  const optionalResults = [];
  for (const entry of OPTIONAL_ENTRIES) {
    optionalResults.push(await inspectEntry(entry));
  }

  const requiredSummary = summarize(requiredResults);
  const success = requiredSummary.missing.length === 0 && requiredSummary.wrongType.length === 0;

  const report = {
    success,
    root: REPO_ROOT,
    required: requiredResults,
    optional: optionalResults,
    stats: {
      requiredChecks: requiredResults.length,
      optionalChecks: optionalResults.length,
      passed: requiredSummary.ok.length,
      missing: requiredSummary.missing.length,
      wrongType: requiredSummary.wrongType.length,
    },
  };

  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printHumanReport(requiredResults, optionalResults);
  }

  return report;
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const options = {
    json: args.has('--json'),
  };

  try {
    const report = await validateStructure(options);
    process.exit(report.success ? 0 : 1);
  } catch (error) {
    if (options.json) {
      console.log(
        JSON.stringify(
          {
            success: false,
            error: error.message,
          },
          null,
          2
        )
      );
    } else {
      console.error(`Structure validation error: ${error.message}`);
    }

    process.exit(2);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  validateStructure,
};

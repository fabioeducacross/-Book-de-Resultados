const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Detects the current repository context and installation mode
 *
 * @returns {Object|null} Repository context object or null if detection fails
 * @property {string} repositoryUrl - Git remote URL
 * @property {string} mode - 'framework-development' or 'project-development'
 * @property {string} projectRoot - Current working directory
 * @property {string} frameworkLocation - Path to framework files
 * @property {string} packageName - Name from package.json
 * @property {string} packageVersion - Version from package.json
 */
function detectRepositoryContext() {
  const cwd = process.cwd();

  // Detect git remote URL
  let remoteUrl = null;
  try {
    remoteUrl = execSync('git config --get remote.origin.url', { cwd })
      .toString()
      .trim();
  } catch (_error) {
    console.warn('⚠️  No git repository detected');
    return null;
  }

  // Read package.json
  const packageJsonPath = path.join(cwd, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    console.warn('⚠️  No package.json found');
    return null;
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

  // Detect if we're in the framework repo itself, accepting both legacy AIOS and new AIOX names.
  const frameworkPackageNames = new Set([
    '@aios/fullstack',
    '@aiox/fullstack',
    '@synkra/aios-core',
    '@synkra/aiox-core',
    'aios-core',
    'aiox-core',
  ]);
  const frameworkRemoteMarkers = [
    '@synkra/aios-core',
    '@synkra/aiox-core',
    'SynkraAI/aios-core',
    'SynkraAI/aiox-core',
  ];
  const isFrameworkRepo =
    frameworkPackageNames.has(packageJson.name) ||
    frameworkRemoteMarkers.some((marker) => remoteUrl.includes(marker));

  // Load installation config if exists
  let installConfig = null;
  const configPath = path.join(cwd, '.aios-installation-config.yaml');
  if (fs.existsSync(configPath)) {
    const yaml = require('js-yaml');
    installConfig = yaml.load(fs.readFileSync(configPath, 'utf8'));
  }

  return {
    repositoryUrl: remoteUrl,
    mode: installConfig?.installation?.mode ||
          (isFrameworkRepo ? 'framework-development' : 'project-development'),
    projectRoot: cwd,
    frameworkLocation: isFrameworkRepo ? cwd : findFrameworkLocation(cwd),
    packageName: packageJson.name,
    packageVersion: packageJson.version,
  };
}

function findFrameworkLocation(projectRoot) {
  const candidates = [
    path.join(projectRoot, 'node_modules', '@synkra', 'aiox-core'),
    path.join(projectRoot, 'node_modules', '@synkra', 'aios-core'),
    path.join(projectRoot, 'node_modules', '@aiox', 'fullstack'),
    path.join(projectRoot, 'node_modules', '@aios', 'fullstack'),
  ];

  return candidates.find((candidate) => fs.existsSync(candidate)) || candidates[0];
}

module.exports = { detectRepositoryContext };

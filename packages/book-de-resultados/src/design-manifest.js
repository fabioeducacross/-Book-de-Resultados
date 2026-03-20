'use strict';

const fs = require('fs');
const path = require('path');

const DEFAULT_DESIGN_MANIFEST_PATH = path.join(__dirname, '..', 'config', 'design-manifest.json');

function loadDesignManifest(manifestPath = DEFAULT_DESIGN_MANIFEST_PATH) {
  const raw = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(`Design manifest inválido em "${manifestPath}"`);
  }

  if (!raw.id || !raw.manifestVersion) {
    throw new Error(`Design manifest incompleto em "${manifestPath}"`);
  }

  const manifestDir = path.dirname(manifestPath);
  const theme = raw.theme && typeof raw.theme === 'object' ? raw.theme : {};
  const editorial = raw.editorial && typeof raw.editorial === 'object' ? raw.editorial : {};
  const componentsFile = typeof raw.componentsFile === 'string' ? raw.componentsFile : null;
  const components = componentsFile
    ? loadDesignComponents(path.resolve(manifestDir, componentsFile), manifestDir)
    : createEmptyDesignComponents();

  return {
    ...raw,
    manifestPath,
    componentsFile,
    componentsFilePath: componentsFile ? path.resolve(manifestDir, componentsFile) : null,
    theme: {
      ...theme,
      tokensFile: theme.tokensFile || null,
      tokensFilePath: theme.tokensFile ? path.resolve(manifestDir, theme.tokensFile) : null,
      overrides:
                theme.overrides && typeof theme.overrides === 'object' && !Array.isArray(theme.overrides)
                  ? theme.overrides
                  : {},
    },
    assets: resolveManifestAssetValue(
      raw.assets && typeof raw.assets === 'object' && !Array.isArray(raw.assets) ? raw.assets : {},
      manifestDir,
    ),
    editorial: {
      ...editorial,
      baselineFile: editorial.baselineFile || null,
      baselineFilePath: editorial.baselineFile ? path.resolve(manifestDir, editorial.baselineFile) : null,
      sourceOfTruth: editorial.sourceOfTruth || 'html-paginado',
    },
    components,
  };
}

function loadDefaultDesignManifest() {
  return loadDesignManifest(DEFAULT_DESIGN_MANIFEST_PATH);
}

function resolveManifestAssetValue(value, manifestDir, key = '') {
  if (typeof value === 'string') {
    if (!value) {
      return value;
    }

    if (!/(url|path)$/i.test(String(key))) {
      return value;
    }

    if (/^(https?:\/\/|file:\/\/|data:)/i.test(value) || path.isAbsolute(value)) {
      return value;
    }

    return path.resolve(manifestDir, value);
  }

  if (Array.isArray(value)) {
    return value.map((entry) => resolveManifestAssetValue(entry, manifestDir, key));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entry]) => [entryKey, resolveManifestAssetValue(entry, manifestDir, entryKey)]),
    );
  }

  return value;
}

function resolveManifestSectionLayout(section, designManifest) {
  if (!section || !designManifest || typeof designManifest !== 'object') {
    return null;
  }

  const sectionSpec = designManifest.sections && designManifest.sections[section];
  if (!sectionSpec || typeof sectionSpec !== 'object') {
    return null;
  }

  const templateId = typeof sectionSpec.template === 'string' ? sectionSpec.template : null;
  if (!templateId) {
    return null;
  }

  const templateSpec = designManifest.templates && designManifest.templates[templateId];
  if (!templateSpec || typeof templateSpec !== 'object') {
    return null;
  }

  return {
    templateId,
    styleRef: templateSpec.styleRef || null,
    shellRef: templateSpec.shellRef || null,
    frameId: templateSpec.frameId || null,
    chromeMode: templateSpec.chromeMode || null,
    layoutSource: 'manifest',
  };
}

function loadDesignComponents(componentsPath, manifestDir) {
  const raw = JSON.parse(fs.readFileSync(componentsPath, 'utf-8'));

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(`Design components invalido em "${componentsPath}"`);
  }

  return {
    ...raw,
    componentsPath,
    assetSets: resolveManifestAssetValue(
      raw.assetSets && typeof raw.assetSets === 'object' && !Array.isArray(raw.assetSets) ? raw.assetSets : {},
      manifestDir,
    ),
    components: raw.components && typeof raw.components === 'object' && !Array.isArray(raw.components) ? raw.components : {},
    sectionComponents: raw.sectionComponents && typeof raw.sectionComponents === 'object' && !Array.isArray(raw.sectionComponents) ? raw.sectionComponents : {},
    chapterComponents: raw.chapterComponents && typeof raw.chapterComponents === 'object' && !Array.isArray(raw.chapterComponents) ? raw.chapterComponents : {},
  };
}

function createEmptyDesignComponents() {
  return {
    version: '0.0.0',
    id: 'empty-design-components',
    label: 'Empty Design Components',
    assetSets: {},
    components: {},
    sectionComponents: {},
    chapterComponents: {},
  };
}

function resolveSectionComponent(section, designManifest) {
  if (!section || !designManifest || !designManifest.components) {
    return null;
  }

  const componentId = designManifest.components.sectionComponents
    ? designManifest.components.sectionComponents[section]
    : null;
  return resolveComponentById(componentId, designManifest);
}

function resolveChapterComponent(chapterKey, designManifest) {
  if (!chapterKey || !designManifest || !designManifest.components) {
    return null;
  }

  const componentId = designManifest.components.chapterComponents
    ? designManifest.components.chapterComponents[chapterKey]
    : null;
  return resolveComponentById(componentId, designManifest);
}

function resolveComponentById(componentId, designManifest) {
  if (!componentId || !designManifest || !designManifest.components) {
    return null;
  }

  const component = designManifest.components.components
    ? designManifest.components.components[componentId]
    : null;

  if (!component || typeof component !== 'object') {
    return null;
  }

  const assetSetId = typeof component.assetSet === 'string' ? component.assetSet : null;
  const assets = assetSetId && designManifest.components.assetSets
    ? designManifest.components.assetSets[assetSetId] || {}
    : {};

  return {
    id: componentId,
    ...component,
    assets,
  };
}

function resolveSubcomponent(section, subcomponentId, designManifest) {
  const component = resolveSectionComponent(section, designManifest);
  if (!component || !component.subcomponents) {
    return null;
  }
  const sub = component.subcomponents[subcomponentId];
  return sub && typeof sub === 'object' ? { id: subcomponentId, ...sub } : null;
}

function buildShellClasses(shellRef, componentId, extra = []) {
  const tokens = [];
  if (shellRef) tokens.push(`shell-${shellRef}`);
  if (componentId) tokens.push(`component-${componentId}`);
  tokens.push(...extra.filter(Boolean));
  return tokens.join(' ');
}

function buildShellDataAttributes(shellRef, componentId) {
  const attrs = [];
  if (shellRef) attrs.push(`data-shell="${shellRef}"`);
  if (componentId) attrs.push(`data-component-id="${componentId}"`);
  return attrs.join(' ');
}

module.exports = {
  DEFAULT_DESIGN_MANIFEST_PATH,
  loadDesignManifest,
  loadDefaultDesignManifest,
  resolveManifestSectionLayout,
  resolveSectionComponent,
  resolveChapterComponent,
  resolveSubcomponent,
  buildShellClasses,
  buildShellDataAttributes,
};
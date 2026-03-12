'use strict';

const fs = require('fs');
const path = require('path');

const EDITORIAL_BASELINE_PATH = path.join(__dirname, '..', 'config', 'editorial-review-baseline.json');

function loadEditorialReviewBaseline(baselinePath = EDITORIAL_BASELINE_PATH) {
  return JSON.parse(fs.readFileSync(baselinePath, 'utf-8'));
}

function buildReviewManifestPath(htmlPath) {
  if (String(htmlPath || '').endsWith('.print.html')) {
    return String(htmlPath).replace(/\.print\.html$/i, '.print.review.json');
  }

  return `${htmlPath}.review.json`;
}

function summarizePageForReview(page = {}) {
  const data = page.data || {};
  const layout = page.layout || {};

  return {
    pageNumber: Number.isFinite(page.pageNumber) ? page.pageNumber : null,
    section: page.section || 'desconhecida',
    title: page.title || '',
    chapterKey: data.chapterKey || null,
    chapterTitle: data.chapterTitle || null,
    layoutHeading: data.layoutHeading || null,
    layoutSubheading: data.layoutSubheading || null,
    disciplina: data.disciplina || null,
    ano: data.ano || null,
    escola: data.nome_escola || null,
    layout: {
      templateId: layout.templateId || null,
      variant: layout.variant || null,
      styleRef: layout.styleRef || null,
      layoutSource: layout.layoutSource || null,
      sectionGroup: layout.sectionGroup || null,
      density: layout.density || null,
      breakPolicy: layout.breakPolicy || null,
      reviewPriority: layout.reviewPriority || null,
    },
  };
}

function buildEditorialReviewManifest({ pages, metadata, version, htmlPath, pdfPath, outputFile, designManifest }) {
  const baselinePath = designManifest && designManifest.editorial && designManifest.editorial.baselineFilePath
    ? designManifest.editorial.baselineFilePath
    : EDITORIAL_BASELINE_PATH;
  const baseline = loadEditorialReviewBaseline(baselinePath);
  const reviewManifestPath = buildReviewManifestPath(htmlPath);
  const pageSummaries = (pages || []).map((page) => summarizePageForReview(page));
  const prioritySections = Array.isArray(baseline.prioritySections) ? baseline.prioritySections : [];
  const primaryOutputFile = outputFile || pdfPath || null;

  return {
    manifestVersion: '1.0.0',
    generatedAt: new Date().toISOString(),
    sourceOfTruth: 'html-paginado',
    designManifest: designManifest
      ? {
        id: designManifest.id || null,
        label: designManifest.label || null,
        manifestVersion: designManifest.manifestVersion || null,
        themeRef: designManifest.themeRef || null,
        themeTokensFile: designManifest.theme && designManifest.theme.tokensFile ? designManifest.theme.tokensFile : null,
      }
      : null,
    baseline: {
      id: baseline.id,
      version: baseline.version,
      sourceArtifact: baseline.sourceArtifact,
      comparisonTarget: baseline.comparisonTarget,
      description: baseline.description,
      referenceArtifacts: baseline.referenceArtifacts || [],
      nonNegotiables: baseline.nonNegotiables || [],
      prioritySections,
    },
    document: {
      municipio: metadata && metadata.municipio ? metadata.municipio : '',
      ano: metadata && metadata.ano ? metadata.ano : '',
      ciclo: metadata && metadata.ciclo ? metadata.ciclo : '',
      version: version || 'v1',
      pageCount: pageSummaries.length,
      outputFile: primaryOutputFile,
      outputFilename: primaryOutputFile ? path.basename(primaryOutputFile) : null,
    },
    artifacts: {
      htmlPath: htmlPath || null,
      pdfPath: pdfPath || null,
      reviewManifestPath,
      editorialBaselinePath: baselinePath,
    },
    reviewMode: {
      checklist: baseline.reviewChecklist || {},
      recommendedWorkflow: [
        'Abrir o .print.html no navegador.',
        'Comparar as seções prioritárias com o book atual.',
        'Ajustar o HTML/CSS antes de revisar o PDF final.',
      ],
    },
    priorityPages: pageSummaries.filter((page) => prioritySections.includes(page.section)),
    pages: pageSummaries,
  };
}

function writeEditorialReviewManifest(args) {
  const manifest = buildEditorialReviewManifest(args);
  fs.writeFileSync(manifest.artifacts.reviewManifestPath, JSON.stringify(manifest, null, 2), 'utf-8');

  return {
    manifest,
    reviewPath: manifest.artifacts.reviewManifestPath,
    baselinePath: manifest.artifacts.editorialBaselinePath,
  };
}

module.exports = {
  EDITORIAL_BASELINE_PATH,
  loadEditorialReviewBaseline,
  buildReviewManifestPath,
  summarizePageForReview,
  buildEditorialReviewManifest,
  writeEditorialReviewManifest,
};

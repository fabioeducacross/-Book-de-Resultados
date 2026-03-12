'use strict';

const path = require('path');

const {
    DEFAULT_DESIGN_MANIFEST_PATH,
    loadDefaultDesignManifest,
    resolveManifestSectionLayout,
    resolveSectionComponent,
    resolveChapterComponent,
} = require('../../packages/book-de-resultados/src/design-manifest');

describe('design manifest loader', () => {
    test('loads the default manifest and resolves theme and baseline paths', () => {
        const manifest = loadDefaultDesignManifest();

        expect(DEFAULT_DESIGN_MANIFEST_PATH).toMatch(/design-manifest\.json$/);
        expect(manifest.id).toBe('educacross-book-editorial');
        expect(manifest.manifestVersion).toBe('1.0.0');
        expect(manifest.theme.tokensFile).toBe('theme.tokens.yaml');
        expect(manifest.theme.tokensFilePath).toBe(path.join(path.dirname(DEFAULT_DESIGN_MANIFEST_PATH), 'theme.tokens.yaml'));
        expect(manifest.editorial.baselineFile).toBe('editorial-review-baseline.json');
        expect(manifest.editorial.baselineFilePath).toBe(
            path.join(path.dirname(DEFAULT_DESIGN_MANIFEST_PATH), 'editorial-review-baseline.json'),
        );
        expect(manifest.assets.editorialAssets).toMatchObject({
            participacaoImageAlt: 'Estudantes usando tablet',
            chapterResultadosImageAlt: 'Abertura editorial do capítulo Resultados',
        });
        expect(manifest.assets.editorialAssets.participacaoImageUrl).toBe(
            path.join(path.dirname(DEFAULT_DESIGN_MANIFEST_PATH), 'assets', 'editorial', 'canoas-2025', 'medium-shot-kids-with-tablet.jpg'),
        );
        expect(manifest.sections.ranking.template).toBe('ranking-table');
        expect(manifest.sections.participacao_rede.template).toBe('editorial-body');
        expect(manifest.sections.participacao_rede_tabela.template).toBe('editorial-table');
        expect(manifest.templates['school-overview'].shellRef).toBe('school-summary-shell');
    });

    test('resolves a section layout from template metadata', () => {
        const manifest = loadDefaultDesignManifest();

        expect(resolveManifestSectionLayout('ranking', manifest)).toEqual({
            templateId: 'ranking-table',
            styleRef: 'dense-table',
            shellRef: 'dense-table-shell',
            frameId: 'ranking-frame',
            chromeMode: 'framed',
            layoutSource: 'manifest',
        });
        expect(resolveManifestSectionLayout('participacao_rede', manifest)).toEqual({
            templateId: 'editorial-body',
            styleRef: 'editorial-split',
            shellRef: 'editorial-split-shell',
            frameId: null,
            chromeMode: 'none',
            layoutSource: 'manifest',
        });
        expect(resolveManifestSectionLayout('sumario', manifest)).toBeNull();
    });
});

describe('resolveSectionComponent', () => {
    let manifest;

    beforeEach(() => {
        manifest = loadDefaultDesignManifest();
    });

    test('resolves capa section to cover-page component with assets', () => {
        const component = resolveSectionComponent('capa', manifest);

        expect(component).not.toBeNull();
        expect(component.id).toBe('cover-page');
        expect(component.kind).toBe('page-cover');
        expect(component.assets).toBeDefined();
        expect(component.assets.logoUrl).toBeTruthy();
    });

    test('resolves participacao_rede section to editorial-opening component', () => {
        const component = resolveSectionComponent('participacao_rede', manifest);

        expect(component).not.toBeNull();
        expect(component.id).toBe('participacao-rede-opening');
        expect(component.kind).toBe('editorial-opening');
        expect(component.assets.imageUrl).toBeTruthy();
        expect(component.assets.imageAlt).toBe('Estudantes usando tablet');
    });

    test('resolves escola section to school-summary component with mascot assets', () => {
        const component = resolveSectionComponent('escola', manifest);

        expect(component).not.toBeNull();
        expect(component.id).toBe('school-summary');
        expect(component.kind).toBe('school-summary');
        expect(component.assets.mascotImageUrl).toBeTruthy();
        expect(component.assets.mascotAlt).toBe('Mascote institucional');
        expect(component.assets.eyebrowPrefix).toBe('SME');
        expect(component.subcomponents).toBeDefined();
        expect(component.subcomponents['school-summary-header'].kind).toBe('eyebrow');
        expect(component.subcomponents['school-summary-mascot'].kind).toBe('mascot');
        expect(component.subcomponents['school-summary-kpis'].kind).toBe('kpi-cards');
        expect(component.subcomponents['school-summary-operational-table'].kind).toBe('operational-table');
        expect(component.subcomponents['school-summary-participation-callout'].kind).toBe('participation-callout');
        expect(component.subcomponents['school-summary-proficiency-callouts'].kind).toBe('proficiency-callouts');
    });

    test('resolves escola_disciplinas section to escola-disciplinas component', () => {
        const component = resolveSectionComponent('escola_disciplinas', manifest);

        expect(component).not.toBeNull();
        expect(component.id).toBe('escola-disciplinas');
        expect(component.kind).toBe('school-comparison');
        expect(component.subcomponents).toBeDefined();
        expect(component.subcomponents['escola-disciplinas-comparativos'].kind).toBe('discipline-comparison-blocks');
    });

    test('resolves participacao_rede_tabela section to editorial-table component', () => {
        const component = resolveSectionComponent('participacao_rede_tabela', manifest);

        expect(component).not.toBeNull();
        expect(component.id).toBe('participacao-rede-tabela');
        expect(component.kind).toBe('editorial-table');
    });

    test('returns null for unknown section', () => {
        expect(resolveSectionComponent('unknown_section', manifest)).toBeNull();
    });

    test('returns null when section is null or empty', () => {
        expect(resolveSectionComponent(null, manifest)).toBeNull();
        expect(resolveSectionComponent('', manifest)).toBeNull();
    });

    test('returns null when manifest is null', () => {
        expect(resolveSectionComponent('capa', null)).toBeNull();
    });

    test('returns null when manifest has no components', () => {
        expect(resolveSectionComponent('capa', {})).toBeNull();
    });
});

describe('resolveChapterComponent', () => {
    let manifest;

    beforeEach(() => {
        manifest = loadDefaultDesignManifest();
    });

    test('resolves resultados chapter to chapter-opener component with assets', () => {
        const component = resolveChapterComponent('resultados', manifest);

        expect(component).not.toBeNull();
        expect(component.id).toBe('chapter-resultados');
        expect(component.kind).toBe('chapter-opener');
        expect(component.assets.imageUrl).toBeTruthy();
        expect(component.assets.overlayImageUrl).toBeTruthy();
        expect(component.assets.imageAlt).toBe('Abertura editorial do capitulo Resultados');
    });

    test('returns null for unknown chapter key', () => {
        expect(resolveChapterComponent('participacao', manifest)).toBeNull();
    });

    test('returns null when chapter key is null or empty', () => {
        expect(resolveChapterComponent(null, manifest)).toBeNull();
        expect(resolveChapterComponent('', manifest)).toBeNull();
    });

    test('returns null when manifest is null', () => {
        expect(resolveChapterComponent('resultados', null)).toBeNull();
    });

    test('returns null when manifest has no components', () => {
        expect(resolveChapterComponent('resultados', {})).toBeNull();
    });
});
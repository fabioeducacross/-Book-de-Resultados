'use strict';

const path = require('path');

const {
    DEFAULT_DESIGN_MANIFEST_PATH,
    loadDefaultDesignManifest,
    resolveManifestSectionLayout,
    resolveSectionComponent,
    resolveChapterComponent,
    resolveSubcomponent,
    buildShellClasses,
    buildShellDataAttributes,
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

describe('analytical section components (Sprint 5)', () => {
    let manifest;

    beforeEach(() => {
        manifest = loadDefaultDesignManifest();
    });

    test('resolves visao_geral to network-overview component', () => {
        const component = resolveSectionComponent('visao_geral', manifest);
        expect(component).not.toBeNull();
        expect(component.id).toBe('network-overview');
        expect(component.kind).toBe('analytical-overview');
        expect(component.subcomponents['overview-hero'].kind).toBe('hero-panel');
        expect(component.subcomponents['overview-distribution'].kind).toBe('distribution-chart');
        expect(component.subcomponents['overview-indicators'].kind).toBe('indicator-grid');
    });

    test('resolves resultados_disciplina to discipline-results component', () => {
        const component = resolveSectionComponent('resultados_disciplina', manifest);
        expect(component).not.toBeNull();
        expect(component.id).toBe('discipline-results');
        expect(component.kind).toBe('analytical-discipline');
        expect(component.subcomponents['discipline-hero'].kind).toBe('hero-panel');
        expect(component.subcomponents['discipline-distribution'].kind).toBe('distribution-chart');
    });

    test('resolves ranking to ranking-table component', () => {
        const component = resolveSectionComponent('ranking', manifest);
        expect(component).not.toBeNull();
        expect(component.id).toBe('ranking-table');
        expect(component.kind).toBe('analytical-ranking');
        expect(component.subcomponents['ranking-header'].kind).toBe('section-header');
        expect(component.subcomponents['ranking-data-table'].kind).toBe('data-table');
    });

    test('resolves habilidades_disciplina to skills-table component', () => {
        const component = resolveSectionComponent('habilidades_disciplina', manifest);
        expect(component).not.toBeNull();
        expect(component.id).toBe('skills-table');
        expect(component.kind).toBe('analytical-skills');
        expect(component.subcomponents['skills-context-strip'].kind).toBe('context-strip');
        expect(component.subcomponents['skills-data-table'].kind).toBe('data-table');
    });

    test('resolves resultados_ano to year-results component', () => {
        const component = resolveSectionComponent('resultados_ano', manifest);
        expect(component).not.toBeNull();
        expect(component.id).toBe('year-results');
        expect(component.kind).toBe('analytical-year');
        expect(component.subcomponents['year-hero'].kind).toBe('hero-panel');
        expect(component.subcomponents['year-ranking'].kind).toBe('data-table');
    });

    test('all 10 sectionComponents are mapped', () => {
        const components = manifest.components.sectionComponents;
        expect(Object.keys(components)).toHaveLength(10);
        expect(components).toMatchObject({
            capa: 'cover-page',
            participacao_rede: 'participacao-rede-opening',
            participacao_rede_tabela: 'participacao-rede-tabela',
            escola: 'school-summary',
            escola_disciplinas: 'escola-disciplinas',
            visao_geral: 'network-overview',
            resultados_disciplina: 'discipline-results',
            ranking: 'ranking-table',
            habilidades_disciplina: 'skills-table',
            resultados_ano: 'year-results',
        });
    });
});

describe('resolveSubcomponent', () => {
    let manifest;

    beforeEach(() => {
        manifest = loadDefaultDesignManifest();
    });

    test('resolves a known subcomponent from escola section', () => {
        const sub = resolveSubcomponent('escola', 'school-summary-mascot', manifest);
        expect(sub).not.toBeNull();
        expect(sub.id).toBe('school-summary-mascot');
        expect(sub.kind).toBe('mascot');
    });

    test('returns null for unknown subcomponent', () => {
        const sub = resolveSubcomponent('escola', 'nonexistent', manifest);
        expect(sub).toBeNull();
    });

    test('returns null for unknown section', () => {
        const sub = resolveSubcomponent('unknown', 'any', manifest);
        expect(sub).toBeNull();
    });

    test('returns null when manifest is null', () => {
        const sub = resolveSubcomponent('escola', 'school-summary-mascot', null);
        expect(sub).toBeNull();
    });
});

describe('buildShellClasses', () => {
    test('builds combined class string from shell and component', () => {
        expect(buildShellClasses('school-summary-shell', 'school-summary'))
            .toBe('shell-school-summary-shell component-school-summary');
    });

    test('handles missing shellRef', () => {
        expect(buildShellClasses(null, 'school-summary'))
            .toBe('component-school-summary');
    });

    test('handles missing componentId', () => {
        expect(buildShellClasses('my-shell', null))
            .toBe('shell-my-shell');
    });

    test('appends extra classes', () => {
        expect(buildShellClasses('s', 'c', ['extra-1', 'extra-2']))
            .toBe('shell-s component-c extra-1 extra-2');
    });

    test('returns empty string when all inputs are falsy', () => {
        expect(buildShellClasses(null, null)).toBe('');
    });
});

describe('buildShellDataAttributes', () => {
    test('builds both data attributes', () => {
        expect(buildShellDataAttributes('my-shell', 'my-component'))
            .toBe('data-shell="my-shell" data-component-id="my-component"');
    });

    test('handles missing shellRef', () => {
        expect(buildShellDataAttributes(null, 'my-component'))
            .toBe('data-component-id="my-component"');
    });

    test('handles missing componentId', () => {
        expect(buildShellDataAttributes('my-shell', null))
            .toBe('data-shell="my-shell"');
    });

    test('returns empty string when both are falsy', () => {
        expect(buildShellDataAttributes(null, null)).toBe('');
    });
});
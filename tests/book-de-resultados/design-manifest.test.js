'use strict';

const path = require('path');

const {
    DEFAULT_DESIGN_MANIFEST_PATH,
    loadDefaultDesignManifest,
    resolveManifestSectionLayout,
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
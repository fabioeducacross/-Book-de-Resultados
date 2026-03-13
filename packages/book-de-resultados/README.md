# @synkra/book-de-resultados

Geração automática do **Book de Resultados de Avaliação Educacional** a partir de planilhas XLSX.

---

## Visão Geral

Este pacote implementa o pipeline completo de geração do relatório institucional:

```
Planilha XLSX
  ↓ parser       — leitura do layout legado de 4 abas ou do layout real de Avaliação Digital
  ↓ validator    — validação do contrato de dados
  ↓ normalizer   — cálculo de métricas e rankings
  ↓ renderer     — construção das páginas do book
  ↓ charts       — descritores de gráficos por página
  ↓ exporter     — exportação para PPTX / PDF / JSON
```

---

## Diagnóstico de Layout

O pacote já possui exportação PDF baseada em HTML paginado. O fluxo real para `format: 'pdf'` é HTML → navegador headless → PDF.

O diagnóstico atual é que o principal gargalo para reproduzir o book institucional não está na conversão para PDF, mas na fidelidade visual do HTML/CSS de impressão.

Documento técnico completo:

- `docs/pt/specifications/book-de-resultados-diagnostico-html-pdf.md`

---

## Instalação

```bash
npm install @synkra/book-de-resultados
```

---

## Uso Rápido

```js
const { generateBook } = require('@synkra/book-de-resultados');

const result = await generateBook({
  inputFile: '/caminho/para/resultados.xlsx',
  outputDir: '/caminho/para/saida',
  format: 'pptx',    // 'pptx' | 'pdf' | 'json'
  version: 'v1',
});

console.log(`Relatório gerado: ${result.outputFile}`);
console.log(`Páginas: ${result.pageCount}`);
console.log(`Tempo: ${result.durationMs}ms`);
```

### Exemplo de integração UI + backend

O pacote inclui um servidor HTTP mínimo para conectar o wireframe de upload/listagem/auditoria ao backend real de geração:

```bash
npm run dev:audit-ui --workspace packages/book-de-resultados
```

Depois, abra http://127.0.0.1:3210 para testar a listagem de execuções, a auditoria detalhada e o upload de uma planilha XLSX.

O histórico de execuções do exemplo é persistido localmente em `packages/book-de-resultados/examples/.runtime/audit-runs.json`, e a tela já envia filtros de data, operação, status, responsável e registro para a API.

---

## Contrato de Dados da Planilha

O parser suporta dois formatos de entrada:

### Formato 1 — layout legado de 4 abas

A planilha XLSX pode conter **4 abas**:

### Aba `metadata`

Pares chave-valor (coluna A = chave, coluna B = valor):

| Chave     | Obrigatório | Exemplo       |
| --------- | ----------- | ------------- |
| municipio | ✅          | Canoas        |
| ano       | ✅          | 2025          |
| ciclo     | ✅          | 2025-sem1     |
| data      | ✅          | 2025-06-01    |

### Aba `escolas`

| Coluna      | Obrigatório | Descrição                     |
| ----------- | ----------- | ----------------------------- |
| id_escola   | ✅          | Identificador único da escola  |
| nome_escola | ✅          | Nome completo da escola        |

### Aba `resultados`

| Coluna       | Obrigatório | Descrição                           |
| ------------ | ----------- | ----------------------------------- |
| id_escola    | ✅          | Referência ao id da escola           |
| ano          | ✅          | Ano/série (ex: `5`, `9`)            |
| disciplina   | ✅          | Nome da disciplina                  |
| media        | ✅          | Média de proficiência (≥ 0)         |
| participacao | ✅          | Percentual de participação (0–100)  |

### Aba `distribuicao`

| Coluna    | Obrigatório | Valores aceitos                                        |
| --------- | ----------- | ------------------------------------------------------ |
| id_escola | ✅          | Referência ao id da escola                              |
| nivel     | ✅          | `abaixo_do_basico`, `basico`, `adequado`, `avancado`   |
| alunos    | ✅          | Número de alunos no nível (inteiro ≥ 0)                |

### Formato 2 — layout real de Avaliação Digital

Também é suportado o layout observado no caso real de Canoas 2025.2, com as abas:

- `Proficiências`
- `Habilidades`

Nesse modo, o parser detecta automaticamente a estrutura da planilha e a projeta para o contrato canônico do pipeline.

---

## Estrutura do Book Gerado

```
1  Capa
2  Apresentação
3  Sumário (gerado automaticamente)
4  Antes da Avaliação          (abertura editorial)
5  Contexto da Avaliação
6  Durante a Aplicação         (capítulo editorial)
7  Participação durante a aplicação
8  Metodologia
9  Resultados                  (capítulo editorial)
10 Visão Geral da Rede
11 Resultados por Disciplina   (uma página por disciplina)
12 Resultados por Ano/Série
13 Ranking de Escolas          (paginado se > 20 escolas)
14 Habilidades por Disciplina  (quando disponível — paginado a cada 20 linhas)
15 Resultados por Escola       (panorama + comparativo por área para cada escola)
16 Próximos Passos             (capítulo e encerramento editorial)
```

---

## Regras de Paginação

| Condição                | Comportamento                         |
| ----------------------- | ------------------------------------- |
| escolas > 20            | Múltiplas páginas de resultados       |
| ranking > 25 registros  | Top 25 por página, com continuação    |

---

## API

### `generateBook(options)`

| Parâmetro             | Tipo              | Obrigatório | Padrão   | Descrição                             |
| --------------------- | ----------------- | ----------- | -------- | ------------------------------------- |
| `inputFile`           | string            | ✅          | —        | Caminho absoluto para o arquivo XLSX  |
| `outputDir`           | string            | ✅          | —        | Diretório de saída                    |
| `format`              | `'pptx'`\|`'pdf'`\|`'json'`| —           | `'pptx'` | Formato de exportação                 |
| `version`             | string            | —           | `'v1'`   | Versão do relatório                   |
| `logoUrl`             | string            | —           | —        | Caminho ou URL do logo para a capa    |
| `imagemInstitucional` | string            | —           | —        | Imagem institucional para a capa      |
| `theme`               | object            | —           | —        | Overrides de tema visual (ver abaixo) |
| `pdfBrowserPath`      | string            | —           | —        | Caminho explícito para Edge/Chrome no modo PDF |
| `keepHtml`            | boolean           | —           | `false`  | Preserva o `.print.html` gerado ao exportar PDF |
| `reviewHtml`          | boolean           | —           | `false`  | Preserva o `.print.html` e gera um `.print.review.json` com checklist e baseline editorial |
| `strict`              | boolean           | —           | `false`  | Se `true`, falha em avisos também     |

**Retorno:**

```ts
{
  success: boolean;
  outputFile: string;       // Caminho completo do arquivo gerado
  filename: string;         // Nome do arquivo gerado
  pageCount: number;        // Número de páginas
  durationMs: number;       // Tempo de geração em ms
  warnings: string[];       // Avisos de validação
  log: object[];            // Log detalhado de cada etapa
  artifacts?: {
    pdfFile?: string;
    printHtmlFile?: string;
    reviewManifestFile?: string;
    editorialBaselineFile?: string;
  }
}
```

**Exceções:**

- `Error` — se `inputFile` ou `outputDir` não forem fornecidos
- `ValidationError` — se a planilha não passar na validação
- `Error` — se o arquivo XLSX não puder ser lido

### Exportação PDF

Ao usar `format: 'pdf'`, o pacote renderiza um HTML paginado e o imprime com um navegador Chromium/Edge em modo headless. O caminho do navegador pode ser:

- detectado automaticamente em instalações comuns de Edge/Chrome
- informado explicitamente em `pdfBrowserPath`
- definido pela variável de ambiente `BOOK_DE_RESULTADOS_PDF_BROWSER`

```js
await generateBook({
  inputFile,
  outputDir,
  format: 'pdf',
  pdfBrowserPath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
});
```

### Revisão HTML contra o book atual

Quando o objetivo é revisar fidelidade visual antes do PDF final, ative `reviewHtml`.

```js
const result = await generateBook({
  inputFile,
  outputDir,
  format: 'pdf',
  pdfBrowserPath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  reviewHtml: true,
});

console.log(result.artifacts.printHtmlFile);
console.log(result.artifacts.reviewManifestFile);
```

Nesse modo, o pacote:

- preserva o `.print.html` gerado
- cria um `.print.review.json` com sequência de páginas, seções prioritárias e checklist de revisão
- referencia o baseline editorial versionado em `packages/book-de-resultados/config/editorial-review-baseline.json`
- aponta para o PDF institucional real versionado em `tests\book-de-resultados\fixtures\canoas-2025-sem2\RelatórioDigitaldeAvaliação_Canoas_2025_SegundoSemestre.pdf`

O baseline inicial assume uma regra simples: o HTML precisa seguir a diagramação e a identidade visual do **book atual**. O PDF continua sendo a materialização final de impressão.

---

## Tema Visual (Theme)

O Book de Resultados possui um sistema de tema parametrizável. Todas as cores, tipografia e espaçamentos têm valores padrão sensatos que podem ser sobrescritos pontualmente via `createTheme()` ou via a opção `theme` do `generateBook`.

O preset padrão agora fica versionado em `packages/book-de-resultados/config/theme.tokens.yaml`, o que facilita revisar e evoluir a identidade visual sem espalhar tokens mutáveis pelo código.

Acima desse preset, o pacote também suporta um manifesto editorial versionado em `packages/book-de-resultados/config/design-manifest.json`. Esse arquivo referencia o arquivo de tokens, centraliza assets padrão e registra metadados editoriais usados no HTML paginado e no review manifest.

### Uso rápido

```js
const { generateBook, createTheme } = require('@synkra/book-de-resultados');

// Tema padrão (sem alterações)
await generateBook({ inputFile, outputDir });

// Tema personalizado — altera apenas o que for passado; o restante herda o padrão
await generateBook({
  inputFile,
  outputDir,
  theme: {
    colors: {
      primary: '#0D47A1',                   // cor principal (títulos, cabeçalhos)
      proficiency: {
        adequado: '#1B5E20',                // cor do nível Adequado
      },
    },
    typography: {
      fontFace: 'Arial',                    // fonte global
    },
  },
});
```

### Estrutura do tema padrão

```js
{
  colors: {
    primary:         '#1A237E',   // títulos e headings
    secondary:       '#3949AB',   // bordas e acentos
    accent:          '#5C6BC0',   // elementos secundários
    background:      '#FFFFFF',
    surface:         '#F5F5F5',
    textPrimary:     '#212121',
    textSecondary:   '#424242',
    textMuted:       '#757575',
    proficiency: {
      abaixo_do_basico: '#D32F2F',
      basico:           '#F57C00',
      adequado:         '#388E3C',
      avancado:         '#1565C0',
    },
    deltaPositive:   '#2E7D32',   // delta positivo (verde)
    deltaNegative:   '#C62828',   // delta negativo (vermelho)
    deltaNeutral:    '#757575',   // delta neutro / sem dados
    cardBackground:  '#E8EAF6',
    cardBorder:      '#3949AB',
    tableBorder:     '#BDBDBD',
    tableSurface:    '#FAFAFA',
    tableHeader:     '#E8EAF6',
  },
  typography: {
    fontFace: 'Calibri',
    sizes: { pageTitle: 20, heading: 16, subheading: 13, body: 12, small: 10, tiny: 9 },
  },
  spacing: {
    pageMarginX: 0.3, pageMarginY: 0.85,
    cardWidth: 2.2, cardHeight: 1.0, cardGap: 0.2, tableWidth: 9.0,
  },
}
```

---

## Componentes Visuais

Além dos descritores de gráfico (`charts.js`), o pipeline gera **descritores de componentes** ricos, usados pelo exporter ao montar os slides.

| Componente              | Seções que o usam                                     | Descrição                                                    |
| ----------------------- | ----------------------------------------------------- | ------------------------------------------------------------ |
| `proficiencia`          | `escola`, `visao_geral`, `resultados_disciplina`      | Tabela colorida por nível com alunos e % por faixa           |
| `comparativo`           | `escola_disciplinas`                                  | Tabela lado a lado escola vs. rede com delta colorido (+/−)  |
| `habilidades_table`     | `habilidades_disciplina`                              | Tabela de habilidades paginada, com coloração por desempenho |

### Habilidades por Disciplina

Quando a planilha contém dados de habilidades (aba `Habilidades`), o book gera automaticamente páginas de tipo `habilidades_disciplina`, uma por disciplina, paginadas a cada 20 linhas. Cada linha é colorida pela faixa de proficiência do `% Acerto`.

---

## Convenção de Nomenclatura dos Arquivos

```
relatorio_{municipio}_{ano}_{ciclo}_{versao}.{ext}
```

Exemplo:

```
relatorio_canoas_2025_2025_sem2_v1.pptx
```

---

## Testes

```bash
# Run all book-de-resultados tests (unit + regression)
npm test -- --testPathPattern="tests/book-de-resultados"

# Run only the Canoas regression suite
npm test -- --testPathPattern="regression-canoas"

# Run all tests
npm test
```

---

## Suíte de Regressão — Caso Canoas

A suíte `tests/book-de-resultados/regression-canoas.test.js` valida o pipeline
completo (**parse → validate → normalize → render → charts → export**) usando
uma planilha sanitizada / anônima definida em `tests/book-de-resultados/canoas-fixture.js`.

### Estrutura dos arquivos de regressão

| Arquivo | Propósito |
|---|---|
| `tests/book-de-resultados/canoas-fixture.js` | Planilha ExcelJS em memória com 3 escolas anônimas + 6 habilidades |
| `tests/book-de-resultados/canoas-baseline.json` | Baseline estrutural: valores esperados para cada etapa do pipeline |
| `tests/book-de-resultados/regression-canoas.test.js` | Suíte completa — 8 estágios + helper de atualização |

### CI-safety

O `exportPdf()` usa `child_process.execFile` para chamar um browser headless.
Nos testes de regressão esse módulo é substituído por um mock Jest que escreve
um PDF mínimo `%PDF-1.4\n% mocked` — nenhum Chromium/Edge instalado é necessário.

### Atualizando o Baseline com Segurança

Ao **alterar intencionalmente** o comportamento do pipeline (novo campo,
mudança de paginação, novo tipo de página etc.) o baseline deve ser
regenerado:

```bash
# 1. Execute a suíte com a flag UPDATE_BASELINE=1
UPDATE_BASELINE=1 npx jest tests/book-de-resultados/regression-canoas.test.js

# No Windows (PowerShell)
$env:UPDATE_BASELINE=1; npx jest tests/book-de-resultados/regression-canoas.test.js

# No Windows (cmd)
set UPDATE_BASELINE=1 && npx jest tests/book-de-resultados/regression-canoas.test.js
```

O script re-executa o pipeline com a fixture anônima, captura as propriedades
estruturais reais e sobrescreve `tests/book-de-resultados/canoas-baseline.json`.

```bash
# 2. Verifique o diff antes de commitar
git diff tests/book-de-resultados/canoas-baseline.json

# 3. Confira que a suíte passa sem UPDATE_BASELINE
npx jest tests/book-de-resultados/regression-canoas.test.js

# 4. Commite o baseline atualizado junto com a mudança de código
git add tests/book-de-resultados/canoas-baseline.json
git commit -m "test(regression): update Canoas baseline after <descrição da mudança>"
```

> **Nunca** atualize o baseline para cobrir uma regressão involuntária.
> O baseline deve ser atualizado **somente** quando a mudança de comportamento
> é deliberada e revisada.

---

## Módulos

| Módulo                 | Responsabilidade                                       |
| ---------------------- | ------------------------------------------------------ |
| `src/parser.js`        | Leitura e parsing do XLSX                             |
| `src/validator.js`     | Validação do contrato de dados                        |
| `src/normalizer.js`    | Cálculo de métricas e rankings                        |
| `src/renderer.js`      | Construção das páginas do book                        |
| `src/charts.js`        | Descritores de gráficos por página                    |
| `src/components.js`    | Descritores de componentes visuais (proficiência, habilidades, comparativo) |
| `src/design-manifest.js`| Carregamento e resolução do contrato declarativo de componentes |
| `src/html-renderer.js` | Renderização HTML paginada com CSS de impressão       |
| `src/chrome.js`        | Chrome (cabeçalho/rodapé) por página                  |
| `src/theme.js`         | Sistema de tema visual parametrizável                 |
| `src/exporter.js`      | Exportação para PPTX/PDF/JSON (usa tema e componentes) |
| `src/index.js`         | Orquestração do pipeline completo                     |

---

## Arquitetura Declarativa: Manifest + Tokens + Components

O Book de Resultados utiliza uma arquitetura declarativa de três camadas que separa decisões editoriais do código de renderização:

### 1. Design Manifest (`config/design-manifest.json`)

Ponto de entrada do contrato editorial. Define:
- **Seções** → templates visuais (mapeamento `section` → `template`)
- **Templates** → regras de shell, frame e chrome
- **Assets editoriais** referenciados por caminho relativo
- Referência ao arquivo de tokens e ao catálogo de componentes

### 2. Theme Tokens (`config/theme.tokens.yaml`)

Arquivo YAML com valores de design (cores, tipografia, espaçamentos). Consumido por `createTheme()` e sobrescrevível via opção `theme` na API.

### 3. Design Components (`config/design-components.json`)

Catálogo declarativo de componentes (v1.2.0). Cada seção do book é mapeada a um componente com:
- **kind** — tipo semântico (ex: `analytical-overview`, `school-summary`)
- **assetSet** — referência opcional a um conjunto de assets (logos, mascotes, imagens)
- **subcomponents** — decomposição granular do componente

**Seções mapeadas (10):**

| Seção | Componente | Kind |
|---|---|---|
| `capa` | `cover-page` | `page-cover` |
| `participacao_rede` | `participacao-rede-opening` | `editorial-opening` |
| `participacao_rede_tabela` | `participacao-rede-tabela` | `editorial-table` |
| `escola` | `school-summary` | `school-summary` |
| `escola_disciplinas` | `escola-disciplinas` | `school-comparison` |
| `visao_geral` | `network-overview` | `analytical-overview` |
| `resultados_disciplina` | `discipline-results` | `analytical-discipline` |
| `ranking` | `ranking-table` | `analytical-ranking` |
| `habilidades_disciplina` | `skills-table` | `analytical-skills` |
| `resultados_ano` | `year-results` | `analytical-year` |

### Fluxo de resolução

```
renderer.js                    design-manifest.js
─────────                      ──────────────────
buildVisaoGeral(...)     →     resolveSectionComponent('visao_geral', manifest)
                                  ↓
                               sectionComponents['visao_geral'] → 'network-overview'
                                  ↓
                               components['network-overview'] → { kind, subcomponents }
                                  ↓
                               assetSets[component.assetSet] → {} (merged)
                                  ↓
                               returns { id, kind, assets, subcomponents }
```

O `html-renderer.js` emite `data-component-id` nos wrappers HTML, permitindo isolamento de estilos por componente via CSS `[data-component-id]`.

### Helpers disponíveis

| Helper | Descrição |
|---|---|
| `resolveSectionComponent(section, manifest)` | Resolve seção → componente completo |
| `resolveChapterComponent(chapterKey, manifest)` | Resolve capítulo → componente |
| `resolveSubcomponent(section, subId, manifest)` | Resolve subcomponente específico |
| `buildShellClasses(shellRef, componentId, extra)` | Gera classes CSS de shell |
| `buildShellDataAttributes(shellRef, componentId)` | Gera data-attributes de shell |

### Adicionando novos componentes editoriais

1. Declare o asset set em `config/design-components.json` → `assetSets`
2. Declare o componente em `components` com `kind`, `assetSet` (opcional) e `subcomponents`
3. Mapeie a seção em `sectionComponents` (ex: `"minha_secao": "meu-componente"`)
4. No builder (`renderer.js`), chame `resolveSectionComponent('minha_secao', designManifest)`
5. Passe `componentId` no objeto `data` da página
6. No `html-renderer.js`, emita `data-component-id` no wrapper HTML
7. Adicione testes em `design-manifest.test.js` para o novo componente
8. Valide com `npx jest --testPathPatterns="tests/book-de-resultados"`

---

## Experimento de Clone Visual — Visão Geral da Rede

O package inclui uma camada lateral de avaliação visual para o experimento de clone incremental da página **Visão Geral da Rede**. Esta camada não altera o pipeline HTML-first existente: ela mede o quanto o HTML renderizado se aproxima do PDF institucional de referência.

### Arquitetura

```
PDF institucional          HTML renderizado
      ↓                          ↓
 extract-reference.py      capture-page.js
 (PyMuPDF → PNG)           (Playwright → PNG)
      ↓                          ↓
      └─────────── evaluate-visual.js ───────────┘
                         ↓
              S = 0,35 × S_pixel
                + 0,30 × S_ssim
                + 0,35 × S_layout
                         ↓
              experiment-manifest.js
                  (JSON + history)
```

### Módulos

| Arquivo | Propósito |
|---|---|
| `src/visual-clone/regions.js` | Define as 8 regiões-alvo da página e pesos editoriais |
| `src/visual-clone/evaluate-visual.js` | Algoritmo de avaliação visual (pixel, SSIM, layout) |
| `src/visual-clone/experiment-manifest.js` | Gera e persiste o manifesto de experimento em JSON |
| `src/visual-clone/capture-page.js` | Captura screenshot determinística da página HTML com Playwright |
| `src/visual-clone/extract-reference.py` | Rasteriza página do PDF de referência com PyMuPDF |
| `src/visual-clone/run-experiment.js` | Orquestrador completo do pipeline do experimento |

### Pré-requisitos

- Node.js ≥ 18 com Playwright instalado no workspace raiz
- Python 3 com PyMuPDF: `pip install PyMuPDF`

### Execução

```bash
# Rodar o experimento completo
npm run visual-clone:run -- \
  --html path/to/book.print.html \
  --pdf tests/book-de-resultados/fixtures/canoas-2025-sem2/RelatórioDigitaldeAvaliação_Canoas_2025_SegundoSemestre.pdf \
  --pdf-page 4 \
  --baseline

# Apenas capturar o HTML (requer Playwright)
npm run visual-clone:capture -- --html path/to/book.print.html --out examples/.runtime/visual-clone-experiment/current

# Apenas extrair referência do PDF (requer PyMuPDF)
npm run visual-clone:extract-ref -- --pdf path/to/ref.pdf --page 4 --out examples/.runtime/visual-clone-experiment/current
```

### Artefatos de saída

Os artefatos são salvos em `examples/.runtime/visual-clone-experiment/` (gitignored):

```
visual-clone-experiment/
  baseline/         — PNG e manifesto do baseline oficial
  current/          — PNGs da execução atual (referência + render)
  diff/             — Imagem diff global por iteração
  metrics/          — JSON de métricas por iteração
  history/          — Histórico JSONL de scores por iteração
  manifest-*.json   — Manifesto completo de cada iteração
```

### Critérios de aceite

| Métrica | Threshold |
|---|---|
| Score global | ≥ 0,90 |
| Score de layout | ≥ 0,92 |
| Pixel drift global | < 12% |
| Menor região crítica | ≥ 0,85 |

---

## Schema JSON

O contrato de dados está formalizado em:

```
schemas/data-contract.json       — contrato de dados da planilha
schemas/design-components.json   — schema do catálogo de componentes (draft-07)
```

---

## Licença

MIT

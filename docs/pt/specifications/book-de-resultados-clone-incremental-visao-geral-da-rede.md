# Clone Incremental — Visão Geral da Rede

**Versão:** 1.0.0
**Data:** 2026-03-13
**Status:** Aprovado

---

## 1. Contexto

O Book de Resultados possui uma página central chamada **Visão Geral da Rede**, responsável por apresentar os indicadores macro da avaliação: total de escolas, total de alunos, participação média, média geral e distribuição de proficiência.

Essa página é a porta de entrada analítica do book e deve refletir fielmente o layout institucional do PDF de referência.

O pipeline atual gera essa página via `html-renderer.js`, mas não existe um mecanismo sistemático para medir a distância visual entre o HTML renderizado e o PDF institucional de referência.

---

## 2. Objetivo

Implementar uma camada lateral de avaliação visual chamada **clone incremental** para a página Visão Geral da Rede.

Essa camada:

- mede objetivamente o grau de semelhança entre o HTML renderizado e o PDF de referência
- não altera o pipeline principal de geração do book
- permite rastrear evolução da fidelidade visual a cada iteração de melhoria de layout
- produz um manifesto de experimento com pontuação, histórico e sugestões de correção priorizadas

---

## 3. Escopo

### Incluído

- captura determinística do HTML renderizado como imagem (PNG)
- extração da página de referência do PDF institucional como imagem (PNG)
- cálculo de pontuação visual composta por três dimensões: pixel, SSIM e layout
- definição de 8 regiões editoriais com pesos individuais
- geração de manifesto de experimento em JSON
- histórico de experimentos em JSONL
- ranqueamento de correções por impacto visual

### Não incluído

- modificação do pipeline principal (`renderer.js`, `html-renderer.js`, `exporter.js`)
- correção automática do layout
- comparação de outras páginas do book
- interface visual para revisão

---

## 4. Regiões Editoriais

A página Visão Geral da Rede é dividida em 8 regiões com pesos individuais para composição da pontuação.

| Região            | Identificador         | Peso |
| ----------------- | --------------------- | ---- |
| Cabeçalho         | `header`              | 0.10 |
| Hero / destaque   | `hero`                | 0.15 |
| Grade de cards    | `indicator_grid`      | 0.20 |
| Distribuição      | `distribution`        | 0.20 |
| Callout           | `callout`             | 0.10 |
| Proficiência      | `proficiency`         | 0.10 |
| Resumo disciplina | `discipline_summary`  | 0.10 |
| Rodapé            | `footer`              | 0.05 |

A soma dos pesos é 1,00.

---

## 5. Pontuação Visual

### Fórmula composta

```
S = 0.35 × S_pixel + 0.30 × S_ssim + 0.35 × S_layout
```

Onde:

- `S_pixel` — similaridade pixel a pixel (normalizada 0–1)
- `S_ssim` — índice de similaridade estrutural (SSIM, 0–1)
- `S_layout` — fidelidade de layout baseada em bounding boxes de blocos DOM vs regiões do PDF

### Pontuação por região

Cada uma das 8 regiões recebe uma pontuação composta individual.

A pontuação global é a média ponderada das regiões pelo peso definido na tabela acima.

---

## 6. Limiares de Aceitação

| Critério                   | Limiar     |
| -------------------------- | ---------- |
| Pontuação global           | ≥ 0,90     |
| Pontuação de layout        | ≥ 0,92     |
| Variação máxima entre runs | < 12%      |
| Pontuação mínima por região| ≥ 0,85     |

Um experimento é considerado **aceito** quando todos os critérios acima são satisfeitos simultaneamente.

---

## 7. Arquitetura do Módulo

O módulo reside em `packages/book-de-resultados/src/visual-clone/`.

### Arquivos

| Arquivo                  | Responsabilidade                                                                 |
| ------------------------ | -------------------------------------------------------------------------------- |
| `regions.js`             | Definição das 8 regiões editoriais com identificadores e pesos                   |
| `evaluate-visual.js`     | Cálculo da pontuação composta; classificação de divergência; ranqueamento de correções |
| `experiment-manifest.js` | Construção e leitura do manifesto JSON; histórico JSONL; flags de aceitação       |
| `capture-page.js`        | Captura determinística do HTML via Playwright: viewport fixo, animações congeladas, fontes aguardadas, bounding boxes coletados |
| `extract-reference.py`   | Rasterização da página PDF de referência para PNG com metadados via PyMuPDF       |
| `run-experiment.js`      | Pipeline completo: extração → captura → normalização → avaliação → manifesto → histórico → resumo de correções |

---

## 8. Pipeline de Execução

```
PDF de referência              HTML renderizado
        ↓                              ↓
extract-reference.py          capture-page.js
(PyMuPDF → PNG)               (Playwright → PNG)
        ↓                              ↓
        └──────── evaluate-visual.js ──────────┘
                           ↓
          S = 0.35×S_pixel + 0.30×S_ssim + 0.35×S_layout
                           ↓
          experiment-manifest.js  +  history.jsonl
                           ↓
              Resumo de correções priorizadas
```

---

## 9. Artefatos Gerados

Os artefatos de cada experimento são gravados em:

```
examples/.runtime/visual-clone-experiment/
  baseline/     — imagem PNG extraída do PDF de referência
  current/      — imagem PNG capturada do HTML renderizado
  diff/         — imagem diff pixel a pixel
  metrics/      — manifesto JSON do experimento
  history/      — arquivo JSONL com histórico de execuções
```

Esse diretório é adicionado ao `.gitignore` e não é versionado.

---

## 10. Manifesto de Experimento

O manifesto JSON gerado por cada execução contém:

```json
{
  "version": "1.0.0",
  "runAt": "<ISO timestamp>",
  "page": "visao_geral",
  "scores": {
    "global": 0.0,
    "pixel": 0.0,
    "ssim": 0.0,
    "layout": 0.0,
    "byRegion": {}
  },
  "accepted": false,
  "drift": null,
  "corrections": []
}
```

O campo `corrections` contém a lista de regiões ordenadas por impacto visual decrescente, com o delta de pontuação de cada região em relação ao limiar mínimo.

---

## 11. Histórico de Experimentos

Cada execução appenda uma linha no arquivo `history.jsonl` no seguinte formato:

```json
{"runAt":"<ISO>","global":0.0,"layout":0.0,"accepted":false}
```

Esse histórico permite rastrear a evolução da fidelidade visual ao longo das iterações de melhoria do layout.

---

## 12. Dependências

| Dependência   | Versão  | Tipo         | Uso                                         |
| ------------- | ------- | ------------ | ------------------------------------------- |
| `pngjs`       | ^7.0.0  | devDependency | Leitura e decodificação de imagens PNG      |
| `pixelmatch`  | ^5.3.0  | devDependency | Cálculo de pontuação pixel a pixel          |
| `playwright`  | existente | devDependency | Captura determinística do HTML              |
| `PyMuPDF`     | externo | opcional     | Rasterização do PDF de referência           |

A dependência `PyMuPDF` é opcional e necessária apenas quando o arquivo de referência não estiver pré-gerado como PNG.

---

## 13. Critérios de Aceite

O módulo será considerado pronto quando:

- a execução de `run-experiment.js` gerar manifesto JSON sem erros
- os três subescores forem calculados para as 8 regiões
- o manifesto incluir flag `accepted` baseada nos limiares definidos
- o histórico JSONL for atualizado a cada execução
- as correções forem ranqueadas por impacto visual decrescente
- o pipeline principal do book não for modificado

---

## 14. Uso

```js
// Executar o experimento completo
node packages/book-de-resultados/src/visual-clone/run-experiment.js \
  --reference examples/reference/visao-geral.png \
  --html examples/.runtime/book.print.html \
  --page visao_geral \
  --output examples/.runtime/visual-clone-experiment
```

Saída esperada:

```
[visual-clone] Capturando HTML...
[visual-clone] Avaliando regiões...
[visual-clone] Pontuação global: 0.87
[visual-clone] Layout: 0.91
[visual-clone] Aceito: false
[visual-clone] Correções priorizadas:
  1. indicator_grid  — delta: -0.08
  2. distribution    — delta: -0.05
[visual-clone] Manifesto gravado em: .../metrics/experiment-<timestamp>.json
```

---

## 15. Relação com o Pipeline Principal

Este módulo é uma **camada lateral de avaliação** e não integra o pipeline de geração do book.

```
pipeline principal
  parser → validator → normalizer → renderer → html-renderer → exporter
                                                     ↓
                                           (artefato HTML)
                                                     ↓
                                          [visual-clone]  ← lateral, opcional
                                          capture-page.js
                                          evaluate-visual.js
                                          experiment-manifest.js
```

O módulo consome o artefato HTML gerado pelo pipeline principal, mas não o altera.

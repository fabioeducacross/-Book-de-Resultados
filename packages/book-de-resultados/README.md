# @synkra/book-de-resultados

Geração automática do **Book de Resultados de Avaliação Educacional** a partir de planilhas XLSX.

---

## Visão Geral

Este pacote implementa o pipeline completo de geração do relatório institucional:

```
Planilha XLSX
  ↓ parser       — leitura das 4 abas (metadata, escolas, resultados, distribuicao)
  ↓ validator    — validação do contrato de dados
  ↓ normalizer   — cálculo de métricas e rankings
  ↓ renderer     — construção das páginas do book
  ↓ charts       — descritores de gráficos por página
  ↓ exporter     — exportação para PPTX / JSON
```

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
  format: 'pptx',    // 'pptx' | 'json'
  version: 'v1',
});

console.log(`Relatório gerado: ${result.outputFile}`);
console.log(`Páginas: ${result.pageCount}`);
console.log(`Tempo: ${result.durationMs}ms`);
```

---

## Contrato de Dados da Planilha

A planilha XLSX deve conter **4 abas**:

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

---

## Estrutura do Book Gerado

```
1  Capa
2  Apresentação
3  Sumário (gerado automaticamente)
4  Visão Geral da Rede
5  Resultados por Disciplina   (uma página por disciplina)
6  Ranking de Escolas           (paginado se > 20 escolas)
7  Resultados por Escola        (uma página por escola)
8  Resultados por Ano/Série
9  Metodologia
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
| `format`              | `'pptx'`\|`'json'`| —           | `'pptx'` | Formato de exportação                 |
| `version`             | string            | —           | `'v1'`   | Versão do relatório                   |
| `logoUrl`             | string            | —           | —        | Caminho ou URL do logo para a capa    |
| `imagemInstitucional` | string            | —           | —        | Imagem institucional para a capa      |
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
}
```

**Exceções:**

- `Error` — se `inputFile` ou `outputDir` não forem fornecidos
- `ValidationError` — se a planilha não passar na validação
- `Error` — se o arquivo XLSX não puder ser lido

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
npm test
```

---

## Módulos

| Módulo          | Responsabilidade                          |
| --------------- | ----------------------------------------- |
| `src/parser.js`    | Leitura e parsing do XLSX                |
| `src/validator.js` | Validação do contrato de dados           |
| `src/normalizer.js`| Cálculo de métricas e rankings           |
| `src/charts.js`    | Descritores de gráficos por página       |
| `src/renderer.js`  | Construção das páginas do book           |
| `src/exporter.js`  | Exportação para PPTX/JSON                |
| `src/index.js`     | Orquestração do pipeline completo        |

---

## Schema JSON

O contrato de dados está formalizado em:

```
schemas/data-contract.json
```

---

## Licença

MIT

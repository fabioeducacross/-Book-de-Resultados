# PRD — Automação do Book de Resultados de Avaliação

**Versão:** 1.0.0
**Data:** 2026-03-06
**Status:** Aprovado

---

## 1. Contexto

O book de resultados de avaliação educacional é atualmente produzido de forma manual a partir de planilhas de resultados.

O processo envolve:

- consolidação manual de dados
- criação manual de gráficos
- montagem manual do relatório
- ajustes de layout
- validação manual de números

Esse processo gera:

- alto esforço operacional
- risco de inconsistência entre planilha e relatório
- dificuldade de escala para novos ciclos de avaliação
- baixa padronização

O relatório final é um **book institucional impresso**, entregue ao cliente como **ativo de valor**, portanto o redesign **não pode alterar a identidade visual existente**.

---

## 2. Objetivo do Projeto

Redesenhar a estrutura do book e implementar um sistema que permita **geração automática do relatório a partir de planilhas de resultados**, mantendo a identidade visual institucional.

---

## 3. Problema

A automação mantendo o layout atual mostrou-se difícil devido a:

- layout não estruturado
- elementos posicionados manualmente
- gráficos não padronizados
- ausência de componentes reutilizáveis

Isso impede a criação de um pipeline confiável de geração automática.

---

## 4. Objetivos

### Objetivos de Produto

- reduzir o esforço manual de geração do relatório
- garantir consistência entre dados e relatório
- permitir geração automática a cada ciclo de avaliação
- manter valor editorial do material

### Objetivos Operacionais

Reduzir tempo de produção de:

```
6–10 horas
↓
< 5 minutos
```

---

## 5. Escopo

### Incluído

- redesign estrutural do book
- preservação da identidade visual
- criação de componentes reutilizáveis
- definição do contrato de dados
- geração automática do relatório
- geração automática de gráficos
- exportação do book final

### Não incluído

- edição manual dentro do sistema
- dashboard interativo
- portal público de visualização

---

## 6. Usuários

### Usuário Primário

Analistas de avaliação educacional

Responsáveis por:

- gerar relatórios
- validar resultados
- compartilhar com gestores

---

### Usuário Secundário

Gestores educacionais que recebem o relatório final.

---

## 7. Princípios de Design

O redesign do book deve seguir os seguintes princípios.

### 1 — Preservar identidade visual

Manter:

- tipografia
- paleta de cores
- grid visual
- estilo editorial
- estilo de gráficos

---

### 2 — Design orientado à automação

Layouts devem ser:

- estruturados
- previsíveis
- baseados em componentes
- baseados em slots de dados

---

### 3 — Layout editorial para impressão

O relatório deve manter características de:

- documento institucional
- material editorial
- relatório de alto valor para clientes

---

## 8. Estrutura do Novo Book

Estrutura proposta:

```
1  Capa
2  Apresentação
3  Sumário
4  Visão Geral da Rede
5  Resultados por Disciplina
6  Ranking de Escolas
7  Resultados por Escola
8  Resultados por Ano/Série
9  Metodologia
10 Rodapé Institucional
```

---

## 9. Arquitetura Visual (Page-by-Page)

### Capa

Campos dinâmicos:

- município
- ano
- ciclo de avaliação
- data

Estrutura:

```
Logo

Relatório de Resultados da Avaliação

Município
Ano | Ciclo

Imagem institucional
```

---

### Página de Apresentação

Texto institucional padrão.

Campos dinâmicos:

- município
- ciclo
- número de escolas
- número de estudantes

---

### Sumário

Gerado automaticamente com base nas páginas do relatório.

---

### Visão Geral da Rede

Página com indicadores macro.

Componentes:

Cards de indicadores:

- número de escolas
- número de estudantes
- participação
- média geral

Gráfico:

- distribuição de proficiência

---

### Resultados por Disciplina

Uma seção para cada disciplina.

Componentes:

- média da rede
- distribuição de níveis
- evolução histórica (se disponível)

---

### Ranking de Escolas

Tabela automatizada.

Estrutura:

```
Posição
Escola
Participação
Média
```

Paginação automática se necessário.

---

### Resultados por Escola

Cada escola gera automaticamente uma página.

Componentes:

Cabeçalho:

- nome da escola
- alunos avaliados
- participação

Indicadores:

- média da escola
- ranking na rede

Gráfico:

- distribuição de proficiência

Tabela:

- resultados por ano/série

---

### Resultados por Ano/Série

Seções para:

- 5º ano
- 9º ano
- outros anos avaliados

Componentes:

- média da rede
- distribuição de níveis
- ranking de escolas

---

### Metodologia

Texto fixo com descrição da avaliação.

Campos dinâmicos:

- número de estudantes
- disciplinas avaliadas

---

## 10. Biblioteca de Componentes

O book será construído a partir de componentes reutilizáveis.

### Card de Indicador

Estrutura:

```
Título
Valor
Descrição opcional
```

---

### Tabela Padrão

Colunas fixas e linhas dinâmicas.

---

### Gráfico de Distribuição

Categorias:

- Abaixo do básico
- Básico
- Adequado
- Avançado

---

### Gráfico de Ranking

Barras horizontais com ordenação automática.

---

## 11. Regras de Paginação

Para evitar quebra de layout.

### Regra 1

Se:

```
escolas > 20
```

Então:

```
criar múltiplas páginas
```

---

### Regra 2

Se:

```
ranking > 25
```

Então:

```
exibir top 25 + continuação
```

---

## 12. Contrato de Dados da Planilha

A automação dependerá de uma planilha padronizada.

### Aba `metadata`

| Campo     | Tipo   | Obrigatório | Descrição            |
| --------- | ------ | ----------- | -------------------- |
| municipio | string | ✅          | Nome do município    |
| ano       | número | ✅          | Ano da avaliação     |
| ciclo     | string | ✅          | Ciclo da avaliação   |
| data      | string | ✅          | Data da avaliação    |

---

### Aba `escolas`

| Campo       | Tipo   | Obrigatório | Descrição                    |
| ----------- | ------ | ----------- | ---------------------------- |
| id_escola   | string | ✅          | Identificador único da escola |
| nome_escola | string | ✅          | Nome da escola               |

---

### Aba `resultados`

| Campo        | Tipo   | Obrigatório | Descrição                          |
| ------------ | ------ | ----------- | ---------------------------------- |
| id_escola    | string | ✅          | Referência ao id da escola          |
| ano          | string | ✅          | Ano/série avaliado(a)              |
| disciplina   | string | ✅          | Nome da disciplina                 |
| media        | número | ✅          | Média de proficiência (≥ 0)        |
| participacao | número | ✅          | Percentual de participação (0–100) |

---

### Aba `distribuicao`

| Campo     | Tipo    | Obrigatório | Valores aceitos                                          |
| --------- | ------- | ----------- | -------------------------------------------------------- |
| id_escola | string  | ✅          | Referência ao id da escola                               |
| nivel     | enum    | ✅          | `abaixo_do_basico`, `basico`, `adequado`, `avancado`    |
| alunos    | inteiro | ✅          | Número de alunos no nível (≥ 0)                         |

---

## 13. Arquitetura da Automação

Pipeline de geração do relatório:

```
Planilha XLSX
↓
Parser de dados        (packages/book-de-resultados/src/parser.js)
↓
Validação              (packages/book-de-resultados/src/validator.js)
↓
Normalização           (packages/book-de-resultados/src/normalizer.js)
↓
Cálculo de métricas    (packages/book-de-resultados/src/normalizer.js)
↓
Geração de gráficos    (packages/book-de-resultados/src/charts.js)
↓
Preenchimento do template (packages/book-de-resultados/src/renderer.js)
↓
Renderização do book   (packages/book-de-resultados/src/renderer.js)
↓
Exportação PDF/PPTX    (packages/book-de-resultados/src/exporter.js)
```

---

## 14. Formato de Saída

Arquivos gerados automaticamente.

Formatos suportados:

- PPTX
- JSON (para debug e renderização downstream)

---

## 15. Versionamento

Cada relatório deve registrar:

- ciclo de avaliação
- data de geração
- versão da planilha

Exemplo:

```
relatorio_canoas_2025_sem2_v1.pptx
```

---

## 16. Validações Automáticas

O sistema verifica:

- colunas obrigatórias
- totais
- percentuais (participacao entre 0–100)
- dados faltantes
- ids de escola não encontrados nas abas de referência
- número máximo de escolas (alerta acima de 500)

---

## 17. Requisitos Não Funcionais

### Performance

Geração do relatório em até:

```
30 segundos
```

---

### Escala

Suportar:

- até 500 escolas
- múltiplas disciplinas

---

### Confiabilidade

- logs de geração por etapa
- logs de validação com erros e avisos

---

## 18. Métricas de Sucesso

| Métrica          | Meta       |
| ---------------- | ---------- |
| Tempo de geração | < 1 minuto |
| Erros de dados   | 0          |
| Esforço manual   | -90%       |
| Adoção           | 100%       |

---

## 19. Roadmap de Implementação

### Fase 1 ✅

Redesign estrutural do layout.

---

### Fase 2 ✅

Definição do contrato de dados da planilha.

---

### Fase 3 ✅

Parser de dados e validação.

---

### Fase 4 ✅

Motor de geração de gráficos.

---

### Fase 5 ✅

Template automatizável do book.

---

### Fase 6 ✅

Exportação PPTX/JSON.

---

## 20. Critérios de Aceite

A funcionalidade será considerada pronta quando:

- o usuário subir uma planilha padrão
- o sistema gerar automaticamente o relatório completo
- todos os gráficos e tabelas forem preenchidos corretamente
- o layout respeitar a identidade visual institucional
- o relatório puder ser exportado para PPTX

---

## Implementação

O sistema está implementado em `packages/book-de-resultados/`.

Uso:

```js
const { generateBook } = require('@synkra/book-de-resultados');

const result = await generateBook({
  inputFile: '/path/to/resultados.xlsx',
  outputDir: '/path/to/output',
  format: 'pptx',
  version: 'v1',
});

console.log(`Relatório gerado: ${result.outputFile}`);
console.log(`Páginas: ${result.pageCount}`);
console.log(`Tempo: ${result.durationMs}ms`);
```

---

✅ **Resultado esperado**

Um pipeline onde:

```
planilha oficial
↓
upload
↓
geração automática
↓
book institucional pronto
```

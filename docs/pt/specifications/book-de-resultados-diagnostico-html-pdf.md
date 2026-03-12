# Diagnóstico Técnico — Layout do Book de Resultados via HTML para PDF

Data da avaliação: 2026-03-10

## Resumo executivo

O diagnóstico atual é que o projeto não está bloqueado por falta de uma estratégia HTML para geração do PDF. Essa estratégia já existe na implementação real.

O gargalo está em outro ponto: o HTML atual ainda não foi tratado como fonte de verdade da diagramação institucional. Hoje ele funciona como um renderer de impressão com base semântica correta, mas com linguagem visual ainda genérica em várias partes do book.

Em termos práticos:

- o pipeline PDF já é HTML → navegador headless → PDF
- o problema principal não é conversão para PDF
- o problema principal é fidelidade visual do HTML/CSS em relação ao book institucional de referência

## Conclusão principal

A mudança de abordagem recomendada é promover o HTML paginado ao papel de artefato central de layout.

Isso significa sair da lógica implícita de tentar aproximar o book pelo exporter final e passar para uma lógica explícita em que:

1. o renderer HTML passa a ser a fonte de verdade visual
2. o PDF vira apenas a etapa final de impressão
3. a validação do projeto passa a comparar o HTML renderizado com o PDF de referência página a página

## Evidências no código

### 1. O pipeline PDF já existe e já passa por HTML

O fluxo público chama exportação PDF no ponto de entrada do pacote.

Evidência:

- `packages/book-de-resultados/src/index.js` seleciona `format: 'pdf'`
- `packages/book-de-resultados/src/exporter.js` monta um arquivo `.print.html`
- `packages/book-de-resultados/src/exporter.js` envia esse HTML para Edge/Chrome headless com `--print-to-pdf`

Implicação técnica:

Não é necessário reinventar a estratégia de geração do PDF. A infraestrutura central para HTML → PDF já está implementada.

### 2. Já existe um renderer HTML dedicado

O pacote possui um renderer específico para HTML paginado de impressão.

Evidência:

- `packages/book-de-resultados/src/html-renderer.js` monta o documento HTML completo
- o mesmo arquivo define as regras de impressão via `@page`, tamanhos A4, paginação, cabeçalhos visuais, blocos analíticos e componentes de página

Implicação técnica:

O lugar correto para perseguir fidelidade visual não é o exporter PDF em si, mas o `html-renderer.js`.

### 3. O renderer semântico já organiza o book por seções

As páginas do book já são montadas como estrutura editorial semântica antes da exportação.

Evidência:

- `packages/book-de-resultados/src/renderer.js` constrói páginas por seção
- o fluxo já separa capa, apresentação, sumário, capítulos, visão geral, resultados por disciplina, ranking, páginas por escola, habilidades e próximos passos

Implicação técnica:

Não é necessário redesenhar o pipeline conceitual do book. O que falta é materializar melhor visualmente cada seção no HTML.

### 4. O tema visual padrão ainda é genérico

O tema base atual ainda não demonstra aderência forte ao material institucional do PDF de referência.

Evidência:

- `packages/book-de-resultados/src/theme.js` define uma paleta padrão genérica
- a tipografia padrão e vários tokens visuais ainda são utilitários e não equivalem a um template editorial institucional fechado

Implicação técnica:

Mesmo com pipeline correto, o resultado final tende a parecer um relatório automatizado bem organizado, mas não necessariamente o mesmo book institucional.

## Diagnóstico detalhado

### O que está funcionando

- parsing, validação, normalização e renderização semântica do book
- exportação PDF real usando navegador headless
- geração de HTML paginado próprio para impressão
- estrutura editorial do documento já dividida em seções coerentes

### O que não está resolvido

- correspondência visual fina com o PDF institucional de referência
- diagramação com o mesmo grid editorial do book original
- tipografia, hierarquia, fundos, faixas, cromia e respiros equivalentes ao material oficial
- processo sistemático de revisão visual do HTML antes da impressão final

### Causa raiz mais provável

A implementação atual resolveu primeiro a automação estrutural do relatório e só parcialmente a camada editorial.

Com isso, o HTML existente cumpre bem a função de suporte à exportação, mas ainda não foi tratado como um layout editorial de alta fidelidade.

## Decisão recomendada

Adotar formalmente o seguinte princípio:

> No Book de Resultados, o HTML paginado é a fonte de verdade visual. O PDF é somente a materialização final de impressão.

Essa decisão reduz ambiguidade técnica porque concentra toda a discussão de layout em um único artefato controlável: HTML + CSS de impressão.

## Impacto arquitetural

### O que deve ser preservado

- parser atual
- validator atual
- normalizer atual
- renderer semântico de páginas
- exporter PDF baseado em navegador headless

### O que deve mudar

- o HTML intermediário deve deixar de ser um artefato temporário e passar a ser inspecionável por padrão durante a fase de desenvolvimento visual
- o `html-renderer.js` deve ser tratado como camada editorial principal
- cada seção do book deve ganhar composição visual orientada pelo PDF de referência, e não apenas por conveniência de exportação

### O que não deve ser feito

- não vale recomeçar o pipeline do zero
- não vale recentrar a estratégia em PPTX para perseguir fidelidade de PDF
- não vale atacar primeiro o exporter PDF, porque ele já executa a função correta de impressão

## Estratégia recomendada de evolução

### Fase 1 — Tornar o HTML o artefato oficial de revisão

Objetivo:

Permitir inspeção visual contínua do `.print.html` gerado para cada execução relevante.

Ações:

- manter o HTML intermediário durante o ciclo de desenvolvimento visual
- abrir o HTML diretamente no navegador para inspeção de grid, espaçamento, fontes e paginação
- validar quebra de página antes de validar o PDF fechado

### Fase 2 — Refatorar o layout por templates editoriais de seção

Objetivo:

Parar de pensar o book como um conjunto de páginas “genéricas” e passar a tratá-lo como uma coleção de templates editoriais específicos.

Ações:

- definir composição própria para capa
- definir composição própria para páginas de abertura de capítulo
- definir composição própria para visão geral e páginas analíticas
- definir composição própria para páginas por escola
- definir composição própria para tabelas de habilidades

### Fase 3 — Validar contra o PDF de referência

Objetivo:

Substituir avaliação subjetiva difusa por comparação objetiva guiada.

Ações:

- usar o PDF institucional real como referência visual principal
- comparar ordem visual, hierarquia, densidade e ocupação de página
- medir divergências por seção, não apenas pelo documento inteiro

## Critério de sucesso recomendado

Considerar a abordagem bem-sucedida quando:

- o HTML impresso reproduzir a estrutura editorial esperada sem ajustes manuais externos
- o PDF final for consequência direta do HTML, sem remendos específicos no exporter
- a equipe conseguir revisar layout no HTML antes de discutir o PDF final
- a maior parte do trabalho de fidelidade visual estiver concentrada no `html-renderer.js` e no tema visual, e não dispersa pelo pipeline

## Síntese final

O projeto já está tecnicamente no caminho HTML → PDF. Portanto, a mudança necessária não é trocar de tecnologia, e sim formalizar a centralidade do HTML no processo editorial.

Diagnóstico final:

- a abordagem HTML → PDF é correta
- ela já existe no repositório
- o próximo passo correto é redesenhar a camada HTML/CSS com foco em fidelidade ao book PDF de referência
- o problema atual é de diagramação e linguagem visual, não de mecanismo de exportação
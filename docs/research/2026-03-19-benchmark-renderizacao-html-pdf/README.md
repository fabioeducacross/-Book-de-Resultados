# Benchmark de Arquitetura para Renderizacao HTML/PDF

Data: 2026-03-19

## Objetivo

Identificar benchmarks publicos, repositorios e referencias de comunidade semelhantes ao Book de Resultados para orientar a decisao entre:

- manter um renderer final em HTML/CSS paginado, com componentizacao e contrato declarativo
- migrar a autoria ou o engine para React

## Contexto do projeto

Pipeline atual:

1. dados canonicos
2. normalizacao
3. renderer semantico
4. html-renderer
5. exportacao PDF via navegador headless

Pergunta central:

Para relatorios multipagina com exigencia editorial e pixel-perfect, qual benchmark de mercado/comunidade mais se aproxima do projeto e qual direcao arquitetural faz mais sentido?

## Benchmarks pesquisados

### 1. Paged.js

- Tipo: biblioteca open source de paged media no navegador
- Relevancia: benchmark open source mais proximo do pipeline atual
- Abordagem: HTML/CSS no browser com suporte a CSS paged media por polyfill e hooks
- Pontos fortes:
  - alinhamento direto com HTML/CSS como artefato final
  - boa conversa com Chromium headless
  - preserva debug por DOM/CSS e preview visual
- Limitacoes:
  - arestas conhecidas em fragmentacao/paginacao
  - nem todo comportamento editorial avancado fica estavel em cenarios complexos
- Fontes:
  - https://github.com/pagedjs/pagedjs
  - https://pagedjs.org/
  - https://github.com/pagedjs/pagedjs/issues/124
  - https://github.com/pagedjs/pagedjs/issues/153

### 2. PrinceXML

- Tipo: engine comercial de HTML/CSS para PDF
- Relevancia: benchmark mais forte de qualidade editorial de mercado
- Abordagem: motor especializado em CSS paged media com recursos de publicacao profissional
- Pontos fortes:
  - suporte maduro a named pages, footnotes, page floats e controle fino de impressao
  - excelente referencia de teto de qualidade
- Limitacoes:
  - licenciamento comercial
  - menor aderencia ao stack Chromium puro
- Fonte:
  - https://www.princexml.com/doc/paged/

### 3. WeasyPrint

- Tipo: engine open source de HTML/CSS para PDF em Python
- Relevancia: benchmark serio de renderer voltado a impressao fora do browser
- Abordagem: motor proprio de layout para PDF e print
- Pontos fortes:
  - foco claro em documentos paginados
  - boa documentacao para uso em relatorios e documentos formais
- Limitacoes:
  - nao reaproveita o runtime Chromium
  - ha relatos publicos de memoria/performance em servicos long-lived
- Fontes:
  - https://doc.courtbouillon.org/weasyprint/stable/
  - https://github.com/Kozea/WeasyPrint/issues/1496

### 4. Vivliostyle

- Tipo: ecossistema open source de publicacao paginada com CSS
- Relevancia: benchmark forte para publicacao/book-like em HTML/CSS
- Abordagem: viewer/core/build voltados a typesetting e publicacoes
- Pontos fortes:
  - orientacao editorial forte
  - modelo mental proximo de publicacao paginada na web
- Limitacoes:
  - ecossistema menos direto para relatorio corporativo customizado
- Fonte:
  - https://vivliostyle.org/

### 5. Playwright page.pdf / Chromium

- Tipo: exportacao oficial de PDF via browser headless
- Relevancia: benchmark mais proximo da etapa final ja usada no projeto
- Abordagem: HTML/CSS renderizado no Chromium com exportacao PDF
- Pontos fortes:
  - alinhamento com browser real
  - integra preview, screenshot, regressao visual e PDF no mesmo stack
- Limitacoes:
  - nao e um motor editorial especializado como Prince
  - exige cuidado fino com print media e color-adjust
- Fonte:
  - https://playwright.dev/docs/api/class-page#page-pdf

### 6. react-pdf

- Tipo: renderer de PDF baseado em componentes React
- Relevancia: principal referencia quando a equipe quer autoria em React e nao HTML final
- Abordagem: DSL propria com componentes Document/Page/View/Text e sistema proprio de quebra
- Pontos fortes:
  - DX boa para times React
  - composicao declarativa forte
- Limitacoes:
  - nao usa DOM/CSS real como saida final
  - modelo de layout proprio e subconjunto de estilo
  - historico de atrito em wrapping e page breaks em layouts complexos
- Fontes:
  - https://react-pdf.org/advanced
  - https://react-pdf.org/styling
  - https://github.com/diegomura/react-pdf
  - https://github.com/diegomura/react-pdf/issues/1544

### 7. PrintCSS.rocks

- Tipo: benchmark/tutorial comparativo de engines de CSS paged media
- Relevancia: melhor referencia publica comparativa encontrada para qualidade funcional entre engines
- Abordagem: corpus de exemplos gerado em varios motores
- Pontos fortes:
  - ajuda a comparar capacidade real de print CSS
  - util para orientar escolhas de engine e recursos necessarios
- Limitacoes:
  - benchmark funcional/qualitativo, nao numerico de throughput
  - projeto em modo legado
- Fontes:
  - https://print-css.rocks/
  - https://github.com/zopyx/print-css-rocks

## Padrao arquitetural recorrente observado

As referencias convergem para um desenho em camadas:

1. dados canonicos
2. modelo intermediario do documento/page model
3. templates ou renderer semantico
4. saida HTML/CSS paginada
5. engine de layout/paginacao
6. PDF final

Esse padrao e praticamente o que o projeto ja faz.

## Leitura comparativa: React vs HTML/CSS paginado

### Quando HTML/CSS paginado vence

- quando a prioridade e fidelidade editorial/print
- quando o PDF e a saida principal
- quando preview, DOM, CSS e captura visual precisam usar o mesmo stack
- quando se quer manter opcao de trocar o engine de exportacao sem reescrever a autoria

### Quando React ajuda

- quando a principal dor e ergonomia de composicao da equipe
- quando existe um design system React dominante
- quando React e usado como camada de autoria para gerar HTML/CSS final, e nao como engine PDF propria

### Quando React piora o cenario

- quando o time tenta usar um renderer PDF proprio como substituto do CSS paged media
- quando a exigencia principal e previsibilidade de quebra, tipografia e pagina de impressao

## Benchmark principal recomendado

Paged.js como benchmark de arquitetura, combinado conceitualmente com Playwright/Chromium como benchmark de execucao.

Motivo:

- e o espelho mais proximo do modelo atual do projeto
- reforca HTML/CSS como contrato final de layout
- preserva o mesmo stack de preview, inspeção e regressao visual

## Benchmark secundario recomendado

PrinceXML como benchmark de teto de qualidade editorial.

Motivo:

- e a melhor referencia de mercado para paginação e publicacao profissional
- ajuda a orientar quais capacidades de print CSS merecem ser buscadas mesmo sem adotar Prince

## Recomendacao arquitetural para o Book de Resultados

Manter renderer final em HTML/CSS paginado e reforcar a componentizacao interna.

Direcao sugerida:

1. dados canonicos
2. normalizacao/enriquecimento
3. page model explicito
4. contrato declarativo de componentes de impressao
5. html-renderer compondo blocos pequenos
6. adapter de exportacao Chromium hoje
7. possibilidade de adapter alternativo no futuro

## Veredito

Manter vanilla HTML/CSS componentizado.

Nao migrar o engine principal para react-pdf.

Se React entrar, a recomendacao e usa-lo apenas como camada de autoria que ainda produza HTML/CSS final, e somente se:

1. o time realmente ganhar velocidade com isso
2. a regressao visual provar que nao houve perda de previsibilidade
3. a paginação continuar controlada no HTML/CSS final e nao num motor proprietario de layout React

## O que ficou nao verificado

Nao foi encontrado benchmark publico numerico realmente forte comparando throughput, memoria e latencia entre Prince, Paged.js, WeasyPrint, Vivliostyle e Chromium sobre o mesmo corpus de relatorios. As melhores evidencias encontradas foram funcionais e qualitativas, nao um microbenchmark uniforme de performance.
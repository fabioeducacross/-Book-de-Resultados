# Especificação Técnica — Experimento de Clone Incremental da Página Visão Geral da Rede

Data: 2026-03-13

## 1. Contexto

O package Book de Resultados já possui um pipeline real de geração em HTML paginado com posterior impressão para PDF. O fluxo vigente não está bloqueado por ausência de mecanismo de exportação, e sim pela distância visual entre o HTML renderizado e o PDF institucional de referência.

A hipótese de trabalho deste experimento é direta:

> É possível atingir clone visual material da página Visão Geral da Rede sem reescrever toda a arquitetura do package, desde que a evolução seja guiada por referência visual objetiva, com avaliação automatizada de layout e iteração incremental sobre o HTML-first existente.

A antítese que queremos provar é a seguinte:

- não é necessário reconstruir parser, normalizer, renderer semântico e exporter
- não é necessário trocar o pipeline por PPTX-first ou PDF-first
- não é necessário redesenhar o package inteiro para obter aderência visual alta em uma página crítica

O experimento deve operar sobre a arquitetura atual, com mudanças localizadas no renderer semântico, no HTML renderer, no fluxo manual de revisão e em uma camada nova de avaliação visual guiada por referência.

## 2. Objetivo

Construir e validar um experimento técnico capaz de aproximar a página Visão Geral da Rede do PDF institucional de referência por meio de um algoritmo guiado por layout visual, preservando a arquitetura HTML-first existente e limitando mudanças a uma camada incremental de composição, captura e avaliação.

## 3. Escopo

O experimento cobre:

- a página Visão Geral da Rede como recorte inicial e único alvo obrigatório
- o fluxo atual de geração semântica em packages/book-de-resultados/src/renderer.js
- a materialização visual HTML em packages/book-de-resultados/src/html-renderer.js
- a exportação HTML para PDF em packages/book-de-resultados/src/exporter.js
- o fluxo manual já usado para gerar HTML, servir artefatos e comparar páginas com o PDF institucional
- captura raster da referência em PDF com PyMuPDF
- captura raster do HTML renderizado com Playwright
- orquestração de comparação e scoring com Node
- métricas combinadas de pixel, similaridade estrutural e aderência de layout

## 4. Fora de Escopo

Este experimento não cobre:

- reescrita completa do renderer de todas as seções
- redesign global do design system do package
- clone integral do book completo nesta fase
- alteração do parser XLSX, validator ou normalizer, salvo ajustes mínimos para expor dados já existentes
- substituição do exporter atual por outra tecnologia de impressão
- otimização final de performance do livro inteiro
- automação de aprovação para todas as páginas antes de validar a tese na página-alvo
- uso de visão computacional generativa, OCR avançado ou otimização por IA fora do escopo de regras determinísticas

## 5. Estado Atual Relevante

O experimento parte dos seguintes fatos do código atual:

- o renderer semântico já produz a seção visao_geral com título, indicadores, distribuição, médias por disciplina e componente de proficiência
- o HTML renderer já trata visao_geral como página analítica prioritária e já possui shell analítico específico
- o exporter já gera um arquivo .print.html, imprime com navegador headless e, opcionalmente, preserva HTML e review manifest
- o review manifest atual já assume o HTML paginado como artefato oficial de revisão
- o baseline editorial versionado já marca visao_geral como seção prioritária
- o repositório já usa Node no pipeline principal, Playwright na suíte E2E do workspace e PyMuPDF no fluxo manual de extração de referência

Conclusão arquitetural: a base necessária para um clone incremental já existe. O que falta é uma camada disciplinada de avaliação visual e um loop de ajuste orientado por referência.

## 6. Objetivo Técnico do Experimento

Ao final do experimento, a equipe deve conseguir responder com evidência objetiva:

1. O HTML-first atual suporta clone visual alto para uma página analítica complexa sem reescrita arquitetural ampla?
2. A combinação de métricas pixel, SSIM e layout consegue orientar correções de forma prática?
3. O fluxo HTML renderizado, capturado e comparado é reproduzível o suficiente para virar padrão de evolução visual do package?

## 7. Arquitetura Proposta

### 7.1 Princípio arquitetural

O experimento mantém a arquitetura principal intacta e adiciona uma camada lateral de avaliação visual.

Princípio central:

> O HTML paginado continua sendo a fonte de verdade visual; a camada de avaliação apenas mede o quanto ele se aproxima da referência institucional.

### 7.2 Componentes da solução

1. Camada semântica existente

- parser
- validator
- normalizer
- renderer
- charts

2. Camada editorial existente

- html-renderer com shell analítico da seção visao_geral
- chrome visual de página
- manifesto editorial e baseline de revisão

3. Nova camada de avaliação visual

- extração de página de referência com PyMuPDF
- captura do HTML renderizado com Playwright
- normalização geométrica das imagens para a mesma área útil
- cálculo de métricas combinadas em Node
- emissão de relatório por página e por região

4. Nova camada de iteração guiada por layout

- definição de regiões-alvo da página
- pesos por região
- diagnóstico de divergência por bloco
- ranking de correções com maior impacto visual esperado

### 7.3 Fluxo arquitetural proposto

1. Gerar o modelo semântico da seção com renderer.js
2. Materializar o HTML paginado com html-renderer.js
3. Preservar o HTML no modo de revisão
4. Capturar a página de referência do PDF com PyMuPDF
5. Abrir o HTML com Playwright e capturar screenshot da página-alvo
6. Normalizar resolução, bounding box e margem segura
7. Rodar o algoritmo de avaliação visual
8. Produzir score global, score por região e diagnóstico de layout
9. Aplicar ajustes incrementais somente na camada visual necessária
10. Repetir até atingir os critérios de aceite

## 8. Pipeline HTML-First do Experimento

O pipeline proposto deve ser explicitamente HTML-first.

### 8.1 Etapas

1. Node gera o .print.html a partir do fluxo existente do package
2. O HTML vira artefato permanente de análise durante o experimento
3. Playwright abre o HTML localmente e captura a página Visão Geral da Rede em modo determinístico
4. PyMuPDF extrai a página correspondente do PDF institucional para PNG
5. Node executa a comparação e produz JSON de métricas e imagens auxiliares
6. O PDF final permanece apenas como consequência do HTML, não como alvo primário de manipulação

### 8.2 Motivo para manter HTML-first

- concentra decisões de fidelidade em um único ponto controlável
- evita duplicação de lógica entre HTML e PDF
- preserva o exporter atual
- reduz risco de regressão ampla
- torna a revisão visual replicável em desenvolvimento local e CI futura

## 9. Algoritmo de Avaliação Visual Guiada por Layout

## 9.1 Visão geral

O algoritmo deve combinar comparação visual global com avaliação estrutural por regiões da página. A meta não é apenas dizer se duas imagens são diferentes, e sim apontar onde o layout diverge e qual correção tende a gerar maior ganho visual.

## 9.2 Entradas

- imagem da página de referência extraída do PDF
- imagem da página renderizada em HTML
- metadados da página semântica visao_geral
- definição de regiões-alvo e pesos
- tolerâncias por tipo de componente

## 9.3 Regiões-alvo mínimas

Para a página Visão Geral da Rede, as regiões mínimas devem ser:

1. faixa superior e cabeçalho institucional
2. hero analítico da seção
3. grade de indicadores
4. painel de distribuição
5. callout de leitura institucional
6. painel de proficiência
7. painel de resumo por disciplina
8. rodapé e badge de paginação

## 9.4 Normalização antes da comparação

Antes de comparar, o algoritmo deve:

1. rasterizar as duas fontes na mesma escala base
2. alinhar largura e altura finais
3. aplicar crop seguro removendo ruídos externos não relevantes, se necessário
4. registrar a viewport usada pelo Playwright
5. registrar o DPI usado pelo PyMuPDF
6. garantir consistência de cores e transparência

## 9.5 Etapas do algoritmo

1. Comparação global de imagem

- calcular pixelmatch global
- calcular SSIM global
- calcular diferença percentual por canal ou por luminância consolidada

2. Segmentação por regiões

- usar regiões declaradas em coordenadas relativas, não absolutas fixas em pixels
- recortar cada região nas duas imagens
- recalcular pixelmatch e SSIM por região

3. Avaliação de layout

- detectar bounding boxes esperadas dos blocos principais a partir do DOM ou de metadados do renderer
- comparar posição, largura, altura e espaçamento relativo dos blocos-chave
- calcular penalidade para drift de alinhamento, overflow, colisão e densidade incorreta

4. Consolidação de score

- gerar score global ponderado
- gerar score por região
- ordenar divergências por severidade e impacto visual

5. Diagnóstico acionável

- classificar divergência como tipografia, espaçamento, grid, cromia, bloco ausente, bloco com excesso visual ou paginação
- emitir recomendações para a próxima iteração manual

## 9.6 Fórmula de score sugerida

Score final ponderado da página:

S = 0,35 x S_pixel + 0,30 x S_ssim + 0,35 x S_layout

Onde:

- S_pixel representa a similaridade invertida do pixelmatch
- S_ssim representa a similaridade estrutural global e regional
- S_layout representa aderência de geometria, alinhamento e ocupação dos blocos

Observação prática: o peso de layout deve permanecer alto porque o objetivo é clone editorial, não apenas aproximação cromática.

## 9.7 Política de priorização de correções

O algoritmo deve produzir uma lista de correções sugeridas ordenada por:

1. severidade da divergência
2. peso editorial da região
3. efeito dominó na composição da página
4. custo estimado de ajuste

Exemplo de heurística:

- corrigir primeiro drift estrutural do hero e da grade de indicadores
- corrigir depois ritmo vertical e relação entre painéis
- corrigir por último refinamentos de cromia e micro espaçamento

## 10. Métricas

## 10.1 Pixelmatch

Uso proposto:

- medir divergência visual bruta entre referência e render
- destacar áreas com excesso de diferença
- servir como métrica simples e rápida para regressão

Leituras esperadas:

- taxa de pixels divergentes global
- taxa por região
- heatmap de diferença

Limitação:

- penaliza pequenas variações de anti-aliasing e rasterização
- não deve ser usado isoladamente para aprovação final

## 10.2 SSIM

Uso proposto:

- medir proximidade estrutural de composição, contraste e forma
- reduzir falsos negativos gerados por pequenas diferenças de rasterização

Leituras esperadas:

- SSIM global
- SSIM por região
- tendência de convergência entre iterações

Limitação:

- pode aceitar diferenças de layout que ainda sejam visualmente incorretas se a estrutura geral parecer semelhante

## 10.3 Métrica de Layout

Uso proposto:

- validar explicitamente posição, largura, altura, proporção, alinhamento e ritmo entre blocos

Sinais mínimos:

- delta de posição horizontal e vertical por bloco
- delta de largura e altura relativa
- gap entre blocos adjacentes
- ocupação total da área útil
- presença ou ausência dos componentes obrigatórios

Limitação:

- depende de mapear blocos de maneira confiável

## 10.4 Conjunto mínimo de métricas para aceite do experimento

- pixelmatch global e regional
- SSIM global e regional
- layout score por bloco e consolidado
- número de iterações até convergência
- estabilidade da captura entre duas execuções consecutivas sem mudança de código

## 11. Artefatos Esperados

O experimento deve produzir artefatos versionáveis e auditáveis.

## 11.1 Artefatos obrigatórios

1. HTML renderizado da execução

- .print.html preservado

2. Referência rasterizada

- PNG da página do PDF institucional correspondente à Visão Geral da Rede

3. Captura do HTML

- screenshot PNG em resolução padronizada da página-alvo

4. Artefatos de comparação

- imagem diff global
- diffs por região quando aplicável
- JSON de métricas

5. Manifesto de experimento

- identificação da referência usada
- viewport e escala empregadas
- versão do algoritmo
- score final e score por região
- lista de divergências priorizadas

6. Evidência de evolução

- histórico simples por iteração com antes, depois e scores

## 11.2 Estrutura sugerida de saídas

- examples/.runtime/manual-layout-test
- examples/.runtime/reference-renders/final
- examples/.runtime/visual-clone-experiment

Dentro de visual-clone-experiment, a sugestão é manter:

- baseline
- current
- diff
- metrics
- history

## 12. Critérios de Aceite

O experimento será considerado bem-sucedido se cumprir simultaneamente os critérios abaixo.

## 12.1 Critérios funcionais

- a página Visão Geral da Rede continua sendo gerada pelo fluxo atual do package
- o exporter PDF atual continua operacional sem reescrita estrutural
- o HTML renderizado pode ser capturado de forma determinística com Playwright
- a referência em PDF pode ser rasterizada de forma determinística com PyMuPDF

## 12.2 Critérios visuais

- a página atinge score global mínimo de 0,90
- nenhuma região crítica fica abaixo de 0,85
- o score de layout consolidado fica em 0,92 ou acima
- o pixel drift global permanece abaixo de 12 por cento
- a revisão humana confirma que a página não parece um dashboard genérico e preserva leitura institucional

## 12.3 Critérios arquiteturais

- não há reescrita de parser, normalizer ou exporter como pré-condição para o experimento
- as mudanças permanecem concentradas na camada visual e de avaliação
- o pipeline HTML-first continua sendo a fonte de verdade
- o experimento gera evidência suficiente para decidir expansão para outras páginas

## 12.4 Critério de prova da tese

A tese será considerada provada quando a equipe conseguir mostrar, com métrica e inspeção visual, que a página Visão Geral da Rede atingiu clone editorial alto usando evolução incremental sobre a arquitetura existente, sem reescrever o package inteiro.

## 13. Riscos e Mitigações

## 13.1 Risco de falso positivo por rasterização

Descrição:

- diferenças de anti-aliasing, fonte local ou engine de render podem afetar pixelmatch

Mitigação:

- usar SSIM e layout score como contrapeso
- fixar ambiente de captura, viewport e escala

## 13.2 Risco de acoplamento excessivo à página específica

Descrição:

- o experimento pode resolver Visão Geral da Rede com hacks não reutilizáveis

Mitigação:

- exigir que ajustes sejam justificáveis como evolução da shell analítica existente
- documentar o que é regra reutilizável e o que é exceção da página

## 13.3 Risco de regressão em outras páginas

Descrição:

- ajustes no html-renderer podem afetar resultados_disciplina, escola ou ranking

Mitigação:

- manter smoke visual das páginas analíticas vizinhas
- limitar alterações a classes e shells com escopo controlado

## 13.4 Risco de instabilidade de captura

Descrição:

- screenshots mudam entre execuções mesmo sem alteração real

Mitigação:

- bloquear animações
- fixar tamanho de viewport
- esperar carregamento completo e fontes prontas
- registrar hashes das imagens geradas

## 13.5 Risco de custo manual elevado por iteração

Descrição:

- o loop pode ficar subjetivo e lento

Mitigação:

- produzir relatório de divergência por região
- priorizar correções com maior ganho estrutural
- limitar cada sprint a metas objetivas

## 13.6 Risco de segurança operacional

Descrição:

- abrir HTML local e processar arquivos externos sempre aumenta superfície de automação

Mitigação:

- manter execução apenas em arquivos locais controlados do repositório
- não buscar recursos remotos na captura
- isolar artefatos em diretório runtime

## 14. Plano de Execução por Sprint

O experimento deve ser executado em no máximo 3 sprints curtas, com entregáveis fechados e checkpoint de decisão ao final de cada fase.

## Sprint 1 — Baseline Executável e Métrica Confiável

Objetivo:

Estabelecer um baseline reproduzível da página Visão Geral da Rede e validar a cadeia completa de referência PDF, render HTML, captura e scoring inicial.

Entregáveis:

- baseline oficial da página de referência rasterizada
- captura Playwright determinística da página HTML-alvo
- relatório inicial com pixelmatch, SSIM e layout score
- manifesto de experimento com parâmetros de captura e regiões-alvo

Tasks:

1. Mapear formalmente a página de referência no PDF institucional e registrar o número da página correspondente à Visão Geral da Rede.
2. Definir a fixture oficial de entrada e congelar o cenário de geração usado no experimento.
3. Formalizar o fluxo manual atual como baseline operacional do experimento, incluindo geração do HTML, servidor local e rasterização do PDF.
4. Especificar viewport, escala, DPI e regras de normalização entre Playwright e PyMuPDF.
5. Definir as regiões-alvo da página e seus pesos editoriais.
6. Desenhar o formato do JSON de métricas e do manifesto do experimento.
7. Executar uma primeira comparação bruta e registrar score inicial, limitações e ruídos observados.
8. Validar estabilidade da captura repetindo a execução sem alteração de código e comparando os resultados.

Dependências principais:

- fluxo atual de geração do .print.html funcional
- PDF institucional de referência disponível no repositório
- Playwright disponível no workspace raiz
- PyMuPDF disponível no ambiente Python local

## Sprint 2 — Loop de Clone Incremental Guiado por Layout

Objetivo:

Usar o relatório de métricas para orientar ajustes incrementais na composição visual da página Visão Geral da Rede sem romper a arquitetura atual.

Entregáveis:

- versão refinada da shell analítica da página
- relatório comparativo por iteração com melhoria mensurável
- matriz de divergências por região e por tipo de problema
- evidência de que os ganhos vieram de ajustes localizados, não de reescrita arquitetural

Tasks:

1. Traduzir o diagnóstico do Sprint 1 em backlog de correções priorizadas por impacto visual.
2. Separar divergências em categorias: grid, hierarquia tipográfica, espaçamento, cromia, proporção de painéis e ruído visual.
3. Ajustar primeiro a estrutura macro da página: hero, grade de indicadores, split principal e rodapé.
4. Ajustar depois a distribuição relativa entre painel de proficiência, callout institucional e resumo por disciplina.
5. Refinar micro layout apenas após estabilizar a geometria macro da página.
6. Reexecutar a avaliação a cada iteração e registrar curva de convergência.
7. Verificar a cada ciclo se o ajuste feito é reutilizável para outras páginas analíticas ou se é uma exceção local.
8. Rodar checagem de impacto visual mínima em resultados_disciplina para evitar regressão grosseira do shell analítico compartilhado.

Dependências principais:

- baseline e scoring confiáveis do Sprint 1
- clareza sobre quais blocos do html-renderer compõem a seção visao_geral
- capacidade de repetir o fluxo local rapidamente

## Sprint 3 — Consolidação, Aceite e Go/No-Go de Escala

Objetivo:

Fechar o experimento com critérios de aceite objetivos, documentar a prova da tese e decidir se o método deve escalar para outras seções.

Entregáveis:

- relatório final de aceite da página Visão Geral da Rede
- comparação final com scores por região e score global
- documentação do método replicável para outras páginas
- decisão arquitetural explícita de expansão, ajuste ou descarte da abordagem

Tasks:

1. Executar a rodada final de comparação com baseline congelado.
2. Validar o cumprimento dos thresholds visuais definidos nesta especificação.
3. Consolidar evidências de que o exporter e o pipeline principal permaneceram intactos.
4. Documentar quais mudanças foram específicas da página e quais viram padrão reutilizável.
5. Registrar riscos remanescentes para escalar a abordagem a resultados_disciplina, ranking e páginas por escola.
6. Produzir uma recomendação de Go, Go com restrições ou No-Go para expansão do método.
7. Atualizar o fluxo oficial de revisão HTML-first para incorporar a avaliação visual guiada por layout.

Dependências principais:

- convergência visual suficiente no Sprint 2
- estabilidade do score em execuções consecutivas
- revisão humana final da página-alvo

## 15. Decisões Arquiteturais Recomendadas

As seguintes decisões são recomendadas para conduzir o experimento com baixo risco:

1. Preservar o renderer semântico atual e atacar apenas a camada de materialização visual.
2. Tratar Playwright como ferramenta de captura do HTML e não como substituto do exporter.
3. Tratar PyMuPDF como ferramenta de extração da referência e não como parte do pipeline de geração.
4. Tratar Node como orquestrador principal do scoring e do manifesto do experimento.
5. Evitar heurísticas opacas; a primeira versão do algoritmo deve ser determinística e auditável.

## 16. Decisão Esperada ao Final do Experimento

Ao final das 3 sprints, a equipe deve sair com uma decisão objetiva:

- Expandir: a abordagem provou a tese e pode ser aplicada a outras páginas prioritárias.
- Restringir: a abordagem funciona, mas apenas para páginas com shell semelhante e custo controlado.
- Encerrar: a abordagem não provou custo-benefício suficiente, exigindo reavaliação arquitetural maior.

## 17. Síntese Final

Esta especificação propõe um experimento deliberadamente pragmático: provar a capacidade de clone visual alto em uma página crítica sem reescrever toda a arquitetura do Book de Resultados.

O valor do experimento não está apenas em melhorar a Visão Geral da Rede, mas em responder se o package já possui a espinha dorsal correta e só precisa de um método melhor de aproximação visual.

Se os critérios desta spec forem atendidos, a conclusão arquitetural será forte: o HTML-first existente é suficiente como base para clone incremental guiado por referência visual, e a reescrita ampla deixa de ser premissa técnica obrigatória.
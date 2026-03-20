# Plano de Experimento - PDF Template Overlay

Data: 2026-03-19
Branch de trabalho: experiment/pdf-template-overlay

## Objetivo

Validar se o Book de Resultados pode usar o PDF institucional como template base e aplicar apenas overlay de campos dinamicos, reduzindo ou eliminando a necessidade de reconstruir certas paginas em HTML/CSS.

## Hipotese

Para paginas com layout congelado e variacao limitada a logo, numeros e poucos textos curtos, um pipeline de overlay em PDF pode entregar:

- fidelidade visual superior ao renderer HTML
- previsibilidade maior de impressao
- menor custo de ajuste pixel-perfect

Sem comprometer o pipeline geral do produto.

## Condicao de validade da hipotese

Essa abordagem so pode ser adotada em paginas onde:

1. o layout ja esteja fechado e aprovado
2. os campos dinamicos caibam em bounding boxes fixas
3. nao exista reflow relevante de texto
4. a pagina nao dependa de quebra dinamica, tabelas variaveis ou narrativa longa
5. a identidade visual permaneça ancorada no PDF institucional de referencia

## Nao-objetivos

Este experimento nao deve, nesta fase:

1. substituir o pipeline inteiro do book
2. apagar o renderer HTML atual
3. migrar a arquitetura para PDF overlay em todas as secoes
4. reorganizar o repositorio sem inventario e criterios claros

## Artefatos de referencia

Base institucional ja presente:

1. packages/book-de-resultados/reference/RelatóriodeAvaliação_Canoas_2025.indd
2. packages/book-de-resultados/reference/RelatóriodeAvaliação_Canoas_2025.idml
3. PDF institucional fornecido pelo usuario

Artefatos tecnicos atuais que precisam continuar como baseline:

1. packages/book-de-resultados/src/renderer.js
2. packages/book-de-resultados/src/html-renderer.js
3. packages/book-de-resultados/src/exporter.js
4. packages/book-de-resultados/pixel-perfect.js
5. packages/book-de-resultados/IMPLEMENTATION_PLAN.md

## Perguntas que o experimento precisa responder

1. Quais paginas do book sao estaticas o suficiente para usar template PDF?
2. Quais campos realmente variam nessas paginas?
3. O overlay consegue manter fidelidade sem hacks de coordenadas excessivos?
4. O custo de manter mapas de campos por pagina e menor do que continuar perseguindo pixel-perfect em HTML?
5. O resultado final pode coexistir com o renderer HTML num modelo hibrido?

## Estrategia recomendada

Adotar arquitetura hibrida por secao:

1. Paginas editoriais ou quase fixas -> PDF template + overlay
2. Paginas analiticas com estrutura variavel -> HTML/CSS paginado
3. Exporter final escolhe a estrategia por section/template id

## Fases do trabalho

## Fase 0 - Inventario e congelamento de escopo

### Meta

Definir exatamente o que muda e em quais paginas.

### Tarefas

1. Inventariar o PDF institucional pagina a pagina
2. Marcar quais paginas mudam so numeros, logo e labels curtos
3. Marcar quais paginas exigem texto corrido, tabelas ou blocos que crescem
4. Produzir uma matriz pagina -> modo de renderizacao sugerido

### Saida esperada

Uma tabela com colunas:

- pagina
- secao
- variaveis dinamicas
- grau de variacao
- overlay viavel? sim/nao

## Fase 1 - Prova de conceito minima

### Meta

Provar a tecnica na pagina mais promissora antes de tocar no pipeline inteiro.

### Tarefas

1. Escolher uma pagina piloto da secao escola ou abertura com baixa variacao
2. Extrair o numero da pagina no PDF institucional
3. Definir bounding boxes para:
   - logo da rede
   - 2 a 6 numeros principais
   - no maximo 1 ou 2 labels curtos
4. Implementar script isolado de overlay sem integrar no exporter principal
5. Gerar PDF de saida e comparar visualmente com o original

### Criterio de aprovacao

1. diferenca visual minima ao olho e por sobreposicao
2. campos entram sem quebrar alinhamento
3. o codigo do PoC continua pequeno e compreensivel

## Fase 2 - Mapeamento formal de campos

### Meta

Transformar o PoC em contrato rastreavel.

### Tarefas

1. Criar um schema simples para field maps por pagina
2. Mapear coordenadas, fonte, tamanho, cor, alinhamento e mascara de cada campo
3. Separar campos em:
   - texto curto
   - numero
   - imagem/logo
   - cobertura de fundo, quando necessario
4. Versionar isso em um diretorio dedicado de templates

### Saida esperada

Estrutura sugerida:

1. packages/book-de-resultados/templates/pdf-overlay/
2. packages/book-de-resultados/templates/pdf-overlay/maps/
3. packages/book-de-resultados/templates/pdf-overlay/assets/

## Fase 3 - Integracao controlada no pipeline

### Meta

Adicionar o novo modo sem quebrar o fluxo atual.

### Tarefas

1. Introduzir um adapter de overlay no exporter
2. Escolher a estrategia por pagina/section/template id
3. Manter HTML renderer como fallback oficial
4. Tornar o modo experimental explicitamente opt-in por flag

### Regra de seguranca

Nenhuma pagina entra no modo overlay por padrao antes de passar pela fase 4.

## Fase 4 - Validacao comparativa

### Meta

Decidir com evidencia se overlay vale a pena.

### Tarefas

1. Comparar HTML atual vs PDF overlay para a mesma pagina
2. Medir:
   - fidelidade visual
   - previsibilidade de impressao
   - custo de manutencao
   - esforco de ajuste fino
3. Validar em ao menos 3 exemplos de dados reais

### Decisao

Se overlay ganhar claramente nas paginas piloto, expandir apenas para as secoes elegiveis.

Se nao ganhar claramente, encerrar experimento e manter apenas o HTML renderer.

## Fase 5 - Adocao hibrida ou descarte

### Se aprovado

1. Consolidar lista de secoes overlay-first
2. Manter secoes dinamicas em HTML
3. Documentar estrategia hibrida no README da package

### Se reprovado

1. Manter branch como registro do experimento
2. Arquivar utilitarios em scripts/experiments
3. Nao contaminar o pipeline principal com codigo parcial

## Riscos principais

1. Campos que parecem estaveis mas sofrem overflow com dados reais
2. Nome de escola ou label maior do que o bounding box previsto
3. Custo alto para manter coordenadas por pagina
4. Dependencia de fontes embutidas/nao embutidas no PDF original
5. Dificuldade de versionar alteracoes se o PDF institucional mudar

## Mitigacoes

1. Escolher pagina piloto extremamente estavel
2. Priorizar campos numericos antes de campos textuais
3. Criar bounding boxes com validacao automatica quando possivel
4. Nunca apagar o HTML renderer durante o experimento
5. Manter fallback por pagina

## Sinal verde para overlay

Adotar overlay somente quando a pagina tiver:

1. layout fixo
2. poucos campos
3. texto curto
4. nenhum crescimento estrutural
5. ganho visual obvio sobre HTML

## Sinal vermelho para overlay

Continuar em HTML quando a pagina tiver:

1. tabela com numero variavel de linhas
2. narrativa ou sintese longa
3. cards que se reorganizam
4. blocos comparativos dependentes do payload
5. dependencia forte de reflow tipografico

## Reorganizacao do repositorio

O repositorio esta com excesso de artefatos soltos na raiz e duplicacao de saídas de preview. A reorganizacao deve ser feita, mas de modo conservador.

### Principios

1. nao deletar nada sem classificar antes
2. mover gerados e experimentos para locais previsiveis
3. separar referencia institucional, gerados, experimentos e docs
4. preservar historico util de investigacao

### Candidatos claros a reorganizacao

Artefatos soltos na raiz que deveriam sair da raiz:

1. compare.html
2. compare-v2.html
3. compare-new.html
4. relatorio_canoas_2025_2025_sem2_v1.print.html
5. relatorio_canoas_2025_2025_sem2_manual.print.html
6. view-result.html
7. view-summary.png
8. view-disciplinas.png
9. escola-summary-*.png
10. escola-disciplinas-*.png
11. preview-server.js
12. gen-compare.js
13. replace.js
14. replace2.js

### Estrutura alvo sugerida

1. docs/research/
   - pesquisas e benchmarks
2. packages/book-de-resultados/reference/
   - PDF, INDD, IDML e baselines oficiais
3. packages/book-de-resultados/prototype-output/
   - HTML/PDF gerados e capturas temporarias
4. packages/book-de-resultados/scripts/experiments/
   - scripts de PoC, compare e utilitarios de investigacao
5. packages/book-de-resultados/templates/pdf-overlay/
   - mapas e contratos do experimento de template PDF

### Regra de delecao segura

So deletar quando o arquivo for:

1. artefato gerado
2. duplicado de outro local canônico
3. sem referencia em script, teste ou doc
4. reprodutivel por comando conhecido

## Ordem recomendada de execucao

1. inventario das paginas do PDF institucional
2. escolha de 1 pagina piloto
3. PoC de overlay fora do pipeline principal
4. validacao visual comparativa
5. criacao do schema/mapa de campos
6. integracao opt-in no exporter
7. reorganizacao segura dos artefatos do repositorio

## Definicao de pronto do experimento

O experimento so pode ser considerado concluido quando:

1. existir ao menos 1 pagina piloto funcional
2. houver comparacao visual objetiva com o PDF institucional
3. a estrategia de fallback estiver clara
4. a equipe souber exatamente quais secoes ficam em overlay e quais ficam em HTML
5. a reorganizacao minima dos artefatos de experimento estiver concluida

## Decisao recomendada hoje

Nao reorganizar nem deletar em massa antes do PoC.

Primeiro provar a tecnica. Depois reorganizar o repositorio em torno do que realmente permanecer como estrategia do produto.
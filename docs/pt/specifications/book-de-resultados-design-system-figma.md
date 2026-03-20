# Book de Resultados: Design System Baseado em Figma

## Objetivo

Este documento define a primeira versão do design system operacional do Book de Resultados usando duas fontes de verdade complementares:

1. o sistema visual já materializado no código do pacote
2. o frame exportado para o Figma no arquivo `_Arquivo Padrão (copiar) - Copy`, node `7402:67886`

O propósito é reduzir inferência visual nas próximas iterações do clone e dar um contrato claro para tokens, superfícies, hierarquia tipográfica, componentes editoriais e regras de implementação.

## Fontes de Verdade

### Código atual

- [packages/book-de-resultados/config/theme.tokens.yaml](packages/book-de-resultados/config/theme.tokens.yaml)
- [packages/book-de-resultados/config/design-manifest.json](packages/book-de-resultados/config/design-manifest.json)
- [packages/book-de-resultados/config/design-components.json](packages/book-de-resultados/config/design-components.json)
- [packages/book-de-resultados/src/html-renderer.js](packages/book-de-resultados/src/html-renderer.js)

### Referência Figma

- Arquivo: https://www.figma.com/design/W9u3AT6ECBKYSROI3l8F7t/_Arquivo-Padr%C3%A3o--copiar---Copy-
- Node principal: `7402:67886`
- Conteúdo observado: spread institucional com duas páginas do book, incluindo página de escola com coluna lateral editorial, cards numéricos, callouts percentuais, distribuição por disciplina e rodapé institucional.

## Princípios

### 1. Figma como referência visual primária

Quando existir conflito entre PDF rasterizado e node exportado para o Figma, a interpretação visual deve priorizar o Figma para:

- cor
- hierarquia tipográfica
- espaçamento
- peso de superfícies
- relação entre blocos

### 2. Código atual como contrato técnico

O design system não substitui o pipeline existente. Ele orienta como o HTML renderer deve expressar a linguagem visual com o menor desvio possível.

### 3. Tokens antes de exceções

Toda correção nova deve preferir token, variante de componente ou styleRef antes de CSS pontual hardcoded.

### 4. Editorial, não dashboard

O book deve parecer publicação institucional impressa. Isso implica:

- menos profundidade visual
- menos gradientes chamativos
- menos sombras de interface de produto
- maior consistência tipográfica
- contraste mais controlado
- separação clara entre dado, comentário editorial e navegação

## Estrutura Atual do Sistema

### Tema

O manifesto já aponta para o tema `canoas-publication-export` em [packages/book-de-resultados/config/design-manifest.json](packages/book-de-resultados/config/design-manifest.json).

O arquivo [packages/book-de-resultados/config/theme.tokens.yaml](packages/book-de-resultados/config/theme.tokens.yaml) já contém a base correta para o design system:

- primário institucional: `#133C58`
- secundário institucional: `#00A39E`
- acento dourado: `#FFB545`
- roxo institucional: `#7D6BC2`
- laranja: `#ED6300`
- verde: `#8DBF34`
- vermelho: `#FE5153`
- fundo editorial: `#EDECE6`
- superfície branca: `#FFFFFF`
- papel: `#F4F1E8`
- texto forte: `#133C58`
- texto base: `#676C6E`
- texto secundário: `#485156`
- texto apagado: `#ACAFB2`

### Tipografia

O token file já define:

- família principal: Montserrat
- família display: Montserrat
- família serif auxiliar: Minion Pro

Escala atual:

- coverTitle: 44
- chapterTitle: 34
- pageTitle: 26
- heading: 14
- subheading: 11
- body: 9
- small: 8
- tiny: 7.5

### Templates e shells

O design manifest já organiza a linguagem visual por template:

- `cover-page`
- `chapter-opener`
- `editorial-body`
- `editorial-table`
- `network-overview`
- `discipline-results`
- `ranking-table`
- `school-overview`
- `school-comparison`
- `skills-table`

Isso deve ser mantido como camada principal de composição visual.

## Extração Visual do Node do Figma

O frame `7402:67886` mostra elementos importantes que devem virar regras do design system.

### Paleta observada no node

Além do token file, o node confirma o uso explícito de:

- vermelho de legenda e distribuição: `#FF5052`
- amarelo de legenda e distribuição: `#FFB637`
- teal de destaque: `#00A59F`
- roxo de destaque: `#856BC6`
- neutro de apoio: `#ABAFB2`

Regra:

- usar os tokens do YAML como base do sistema
- aceitar estes valores do Figma como refinamentos finais quando houver diferença de poucos pontos hexadecimais entre export e código

### Linguagem de superfície

O node exportado indica:

- áreas de papel muito claras
- grandes massas limpas
- pouca sombra
- contornos suaves
- destaque por cor e composição, não por elevação

Regra:

- evitar box-shadow como instrumento principal de hierarquia
- preferir campo tonal, linha, barra e contraste tipográfico

### Hierarquia tipográfica real

O node mostra um uso consistente de Montserrat com estes comportamentos:

- títulos institucionais em bold ou extrabold
- legendas pequenas em pesos fortes e tamanhos baixos
- número como protagonista visual
- texto corrido compacto, porém legível
- uso frequente de caixa alta apenas em rótulos pequenos e controlados

Regra:

- evitar uppercase como padrão para labels de card
- usar uppercase apenas em chips, eyebrows, legenda muito curta e context strip
- reduzir tracking aberto em labels analíticos, pois isso puxa o visual para interface web e afasta do editorial

## Sistema de Tokens

### Tokens canônicos

O projeto deve usar estes grupos como contrato:

#### Cor

- `brandPrimary`
- `brandSecondary`
- `brandPurple`
- `brandYellow`
- `brandOrange`
- `brandGreen`
- `brandRed`
- `background`
- `paper`
- `surface`
- `textPrimary`
- `textSecondary`
- `textMuted`
- `textStrong`

#### Proficiência

- `proficiency.abaixo_do_basico`
- `proficiency.basico`
- `proficiency.adequado`
- `proficiency.avancado`

#### Tipografia

- `coverTitle`
- `chapterTitle`
- `pageTitle`
- `heading`
- `subheading`
- `body`
- `small`
- `tiny`

#### Espaçamento

- `pageMarginX`
- `pageMarginY`
- `cardGap`
- `rhythm`
- `openerBandHeight`

### Tokens faltantes a institucionalizar

O Figma evidencia a necessidade de formalizar tokens que hoje ainda aparecem implicitamente no CSS:

- `surfaceLavender`
- `surfaceEditorialSoft`
- `ruleTealStrong`
- `ruleLavenderSoft`
- `legendRed`
- `legendYellow`
- `legendTeal`
- `legendPurple`
- `shadowNone`
- `radiusEditorialSm`
- `radiusEditorialMd`

Recomendação:

- adicionar esses tokens em uma próxima revisão do arquivo de tema
- não hardcodar novos hexadecimais no renderer sem antes passar por token

## Biblioteca de Componentes

### Componentes já formalizados

Em [packages/book-de-resultados/config/design-components.json](packages/book-de-resultados/config/design-components.json), os contratos existentes já são suficientes para suportar o design system base.

Componentes principais:

- `network-overview`
- `discipline-results`
- `school-summary`
- `escola-disciplinas`
- `ranking-table`
- `skills-table`

### Subcomponentes estratégicos

Os subcomponentes mais relevantes para a fidelidade visual são:

- `overview-hero`
- `overview-distribution`
- `overview-indicators`
- `school-summary-header`
- `school-summary-kpis`
- `school-summary-operational-table`
- `school-summary-participation-callout`
- `school-summary-proficiency-callouts`

## Regras de Implementação

### 1. Escopo por template

Toda correção derivada do Figma deve ser escopada por template e seção, preferencialmente usando combinações como:

- `.layout-style-analytic-overview.section-visao_geral`
- `.layout-style-school-summary.section-escola` quando existir styleRef correspondente
- `.layout-template-network-overview.section-visao_geral`

### 2. Separação entre geometria e acabamento

Existem dois tipos de ajuste:

- geometria: altura, largura, y, x, distribuição de espaço
- acabamento: cor, sombra, tipografia, borda, barra, contraste, densidade visual

Toda iteração deve declarar explicitamente qual dos dois está sendo atacado.

### 3. Superfícies editoriais

Use esta hierarquia:

- página: fundo papel ou off-white
- bloco de dado: superfície clara, pouco relevo
- bloco editorial: superfície muito suave, contraste mais baixo
- bloco hero: pode ter maior identidade visual, mas sem parecer card de dashboard

### 4. Cards numéricos

Cards de indicadores devem seguir estas regras:

- sem sombra forte
- sem gradiente evidente
- barra superior fina e sólida
- labels preferencialmente em sentence case
- valores com protagonismo, mas sem visual de widget
- quatro cards com baseline consistente

### 5. Comentário institucional

Callout de leitura institucional deve seguir estas regras:

- parecer texto editorial interpretativo
- evitar moldura dupla
- evitar fundo branco duro dentro de card escuro
- evitar faixa de alerta quando a função é explicativa e não crítica
- funcionar como comentário subordinado ao bloco de dado acima

### 6. Distribuição de proficiência

O bloco de distribuição deve seguir estas regras:

- eixo pequeno e discreto
- barra como protagonista
- estatísticas coloridas subordinadas à barra
- mesma paleta de legenda do Figma
- sem reintroduzir conteúdo redundante apenas para aumentar altura

## Mapeamento Figma → Sistema Atual

### Padrões confirmados

- Montserrat continua correta como fonte principal
- teal, dourado, roxo e vermelho continuam corretos como paleta funcional
- contraste baixo e editorial funciona melhor que gradientes fortes
- rodapé institucional com linha e texto pequeno está mais próximo da referência do que pill footer

### Ajustes já validados nas iterações recentes

- redução do visual dashboard na visão geral
- institucional-summary mais leve e mais próximo do comentário editorial do book
- distribution alinhada em altura com a referência
- indicators com ganho de aderência após redução de sombra, uppercase e heterogeneidade entre cards

## Diretrizes para Próximas Iterações

### Prioridade 1

Criar tokens adicionais para superfícies editoriais observadas no Figma.

### Prioridade 2

Adicionar variantes explícitas de componente para:

- indicator cards editoriais
- summary editorial suave
- distribution reference block

### Prioridade 3

Usar nodes do Figma como fonte de comparação por componente, e não apenas por página rasterizada.

## Proposta de Evolução Imediata

### Curto prazo

- documentar tokens faltantes no tema
- continuar ajustes locais em [packages/book-de-resultados/src/html-renderer.js](packages/book-de-resultados/src/html-renderer.js)
- manter o experimento visual da visão geral como baseline de regressão

### Médio prazo

- extrair um design system operacional para `school-summary` usando o frame exportado no Figma
- formalizar variantes de componente no manifesto e no arquivo de componentes
- reduzir CSS hardcoded com migração progressiva para tokens e variantes

## Critérios de Aceite para Uso do Figma via MCP

Uma iteração derivada do Figma deve ser considerada válida quando:

- houver node de referência explícito
- o ajuste for traduzido para token, variante ou regra escopada
- o patch não contaminar outras seções
- a mudança puder ser medida no experimento visual existente

## Resumo Executivo

O projeto já possui base técnica suficiente para um design system real.

O que faltava era uma fonte de verdade visual mais precisa do que o PDF rasterizado. Com o node do Figma exportado, agora existe uma referência forte para:

- paleta real
- pesos tipográficos
- relação entre superfícies
- sobriedade editorial
- organização de componentes

Este documento estabelece a primeira camada desse design system e serve como contrato para as próximas iterações de fidelidade visual.
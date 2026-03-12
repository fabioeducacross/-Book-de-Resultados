# Plano de Implementacao Editorial

## Objetivo

Organizar a convergencia do Book de Resultados para o book institucional de referencia usando uma fonte declarativa de componentes, assets e regras de composicao, reduzindo CSS espalhado e evitando ajustes ad hoc.

## Resultado Esperado

- Todos os assets editoriais mapeados em JSON
- Todos os shells principais descritos como componentes reutilizaveis
- HTML renderer consumindo contrato declarativo em vez de regras espalhadas
- Preview HTML aderente ao book de referencia
- Regressao coberta por testes focados

## Estado Atual

- Existe manifesto editorial em `config/design-manifest.json`
- Existe token set em `config/theme.tokens.yaml`
- Existe contrato inicial de componentes em `config/design-components.json`
- Capa, abertura de Resultados, abertura de Participacao e pagina de escola ja comecaram a consumir esse contrato
- A maior lacuna atual ainda esta em `escola` e `escola_disciplinas`, seguida por `visao_geral`, `resultados_disciplina`, `ranking` e `habilidades_disciplina`

## Regras de Execucao

- Toda decisao visual deve apontar para uma referencia concreta do PDF institucional
- Todo asset novo deve entrar no JSON de componentes antes de ser consumido no renderer
- Todo shell novo deve ter nome, responsabilidade e mapping por secao
- Toda mudanca visual relevante deve ser validada em preview HTML e em teste focado

## Sprint 1 — Fundacao do Contrato Editorial

### Meta

Fechar a base estrutural para que assets e componentes parem de ficar dispersos no codigo.

### Tasks

- [x] Criar `config/design-components.json`
- [x] Referenciar o arquivo no manifesto editorial
- [x] Carregar o contrato no `src/design-manifest.js`
- [x] Criar resolucao por secao e por capitulo
- [x] Plugar os primeiros consumidores no renderer
- [x] Documentar formalmente o schema minimo do contrato de componentes
- [x] Adicionar testes unitarios especificos para `resolveSectionComponent()` e `resolveChapterComponent()`

### Arquivos Principais

- `config/design-manifest.json`
- `config/design-components.json`
- `src/design-manifest.js`
- `src/renderer.js`

## Sprint 2 — Asset Mapping Completo

### Meta

Mapear todos os assets do book como contratos reutilizaveis para cada shell e componente.

### Tasks

- [x] Inventariar todos os assets reais usados no book institucional
- [x] Separar asset sets por grupo: cover, chapter, editorial, school, comparison, tables
- [x] Incluir mascotes, logos, overlays, imagens de abertura e recortes de referencia no JSON
- [x] Eliminar paths soltos de assets dentro de `src/renderer.js`
- [x] Eliminar fallbacks hardcoded no `src/html-renderer.js` quando houver componente declarado
- [x] Criar naming padrao para asset sets e component ids

### Saida Esperada

- Um catalogo declarativo de asset sets reutilizaveis por secao e por shell

## Sprint 3 — Pagina Escola

### Meta

Fechar a aderencia da secao `escola` usando contrato declarativo de componentes e CSS orientado por shell.

### Tasks

- [x] Mapear a pagina `escola` em subcomponentes declarativos
- [x] Definir no JSON: eyebrow, mascote, title block, KPI cards, tabela operacional, destaque de participacao
- [x] Remover detalhes visuais inventados que nao existam no book de referencia
- [x] Alinhar o recorte do mascote com a referencia institucional final
- [x] Validar no preview HTML contra a pagina equivalente do PDF
- [x] Cobrir no teste de HTML fidelity a estrutura final da pagina

### Subcomponentes Alvo

- `school-summary-header`
- `school-summary-mascot`
- `school-summary-kpis`
- `school-summary-operational-table`
- `school-summary-participation-callout`
- `school-summary-proficiency-callouts`

## Sprint 4 — Pagina Escola Disciplinas

### Meta

Fechar a aderencia da secao `escola_disciplinas` usando o mesmo modelo declarativo.

### Tasks

- [x] Quebrar `escola_disciplinas` em shells e subcomponentes
- [x] Mapear comparativos, blocos por disciplina, legenda e areas de referencia
- [x] Migrar qualquer asset ou ornamento visual ainda embutido no CSS para o JSON
- [x] Ajustar HTML renderer para consumir component ids da secao
- [x] Validar contra a referencia institucional da pagina correspondente
- [x] Atualizar testes focados da secao

## Sprint 5 — Analitico Central

### Meta

Aplicar o mesmo padrao declarativo nas secoes analiticas principais.

### Tasks

- [x] Mapear `visao_geral`
- [x] Mapear `resultados_disciplina`
- [x] Mapear `ranking`
- [x] Mapear `habilidades_disciplina`
- [x] Revisar `resultados_ano`
- [x] Consolidar nomenclatura de shells, frames e context strips

## Sprint 6 — Refatoracao do HTML Renderer

### Meta

Reduzir a dependencia de CSS por secao e mover o renderer para um modelo orientado por contrato.

### Tasks

- [x] Criar helpers para leitura de componente por secao e subcomponente
- [x] Criar helpers para classes e data attributes por shell e component id
- [x] Substituir branches literais por resolucao declarativa quando possivel
- [x] Isolar estilos por shell em vez de acumular regras por secao
- [x] Revisar fallbacks para compatibilidade com dados antigos

## Sprint 7 — Validacao e Fechamento

### Meta

Garantir que o book esteja rastreavel, reproduzivel e seguro para evolucao.

### Tasks

- [x] Criar checklist de validacao visual por secao
- [x] Expandir testes de regressao HTML/PDF para os novos componentes declarativos
- [x] Revisar cobertura de assets relativos no HTML review
- [x] Atualizar README com a arquitetura `manifest + tokens + components`
- [x] Registrar fluxo oficial para adicionar novos componentes editoriais

## Backlog de Risco

- [ ] Remover scripts manuais que geram HTML sem `htmlOutputPath`
- [ ] Evitar dependencia de crops temporarios sem asset final versionado
- [ ] Revisar se algum componente visual ainda depende de copy literal no teste
- [ ] Decidir se o schema de componentes deve virar JSON Schema em `schemas/`

## Sequencia Recomendada de Execucao

1. Fechar schema minimo do `design-components.json`
2. Concluir asset mapping completo
3. Fechar `escola`
4. Fechar `escola_disciplinas`
5. Avancar para secoes analiticas restantes
6. Refatorar o HTML renderer para consumo declarativo
7. Consolidar testes e documentacao

## Definicao de Pronto

Uma sprint so pode ser considerada concluida quando:

- o contrato JSON estiver versionado
- o renderer estiver consumindo o contrato
- o preview HTML estiver regenerado
- os testes focados estiverem verdes
- a comparacao visual com o PDF institucional estiver aceita
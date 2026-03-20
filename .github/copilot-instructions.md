# GitHub Copilot Instructions - Synkra AIOX

Este arquivo configura o comportamento do GitHub Copilot ao trabalhar neste repositório.
Responda sempre em **português do Brasil**.

---

## Constitution

O AIOX possui uma **Constitution formal** com princípios inegociáveis.

**Princípios fundamentais:**

| Artigo | Princípio | Severidade |
|--------|-----------|------------|
| I | CLI First | NON-NEGOTIABLE |
| II | Agent Authority | NON-NEGOTIABLE |
| III | Story-Driven Development | MUST |
| IV | No Invention | MUST |
| V | Quality First | MUST |
| VI | Absolute Imports | SHOULD |

---

## Premissa Arquitetural: CLI First

O Synkra AIOX segue uma hierarquia clara de prioridades que deve guiar **TODAS** as decisões:

```
CLI First → Observability Second → UI Third
```

| Camada | Prioridade | Descrição |
|--------|------------|-----------|
| **CLI** | Máxima | Onde a inteligência vive. Toda execução, decisões e automação. |
| **Observability** | Secundária | Observar e monitorar o que acontece no CLI em tempo real. |
| **UI** | Terciária | Gestão pontual e visualizações quando necessário. |

### Princípios Derivados

1. **A CLI é a fonte da verdade** — Dashboards apenas observam, nunca controlam
2. **Funcionalidades novas devem funcionar 100% via CLI** antes de ter qualquer UI
3. **A UI nunca deve ser requisito** para operação do sistema
4. **Ao decidir onde implementar algo**, sempre prefira CLI > Observability > UI

---

## Estrutura do Projeto

```
aiox-core/
├── .aiox-core/              # Core do framework
│   ├── core/                # Módulos principais (orchestration, memory, etc.)
│   ├── data/                # Knowledge base, entity registry
│   ├── development/         # Agents, tasks, templates, checklists, scripts
│   └── infrastructure/      # CI/CD templates, scripts
├── bin/                     # CLI executables (aiox-init.js, aiox.js)
├── docs/                    # Documentação
│   └── stories/             # Development stories (active/, completed/)
├── packages/                # Shared packages
├── pro/                     # Pro submodule (proprietary)
├── squads/                  # Squad expansions
└── tests/                   # Testes
```

---

## Framework vs Project Boundary

O AIOX usa um modelo de 4 camadas (L1-L4) para separar artefatos do framework e do projeto.

| Camada | Mutabilidade | Paths | Notas |
|--------|-------------|-------|-------|
| **L1** Framework Core | NEVER modify | `.aiox-core/core/`, `.aiox-core/constitution.md`, `bin/aiox.js`, `bin/aiox-init.js` | Protegido |
| **L2** Framework Templates | NEVER modify | `.aiox-core/development/tasks/`, `.aiox-core/development/templates/`, `.aiox-core/development/checklists/`, `.aiox-core/development/workflows/`, `.aiox-core/infrastructure/` | Extend-only |
| **L3** Project Config | Mutable (exceptions) | `.aiox-core/data/`, `agents/*/MEMORY.md`, `core-config.yaml` | Com cuidado |
| **L4** Project Runtime | ALWAYS modify | `docs/stories/`, `packages/`, `squads/`, `tests/` | Trabalho do projeto |

---

## Sistema de Agentes AIOX

O projeto usa o sistema de agentes AIOX. Cada agente tem escopo exclusivo:

| Agente | Persona | Escopo Principal |
|--------|---------|------------------|
| `@aiox-dev` | Dex | Implementação de código |
| `@aiox-qa` | Quinn | Testes e qualidade |
| `@aiox-architect` | Aria | Arquitetura e design técnico |
| `@aiox-pm` | Morgan | Product Management |
| `@aiox-po` | Pax | Product Owner, stories/epics |
| `@aiox-sm` | River | Scrum Master |
| `@aiox-analyst` | Alex | Pesquisa e análise |
| `@aiox-data-engineer` | Dara | Database design |
| `@aiox-ux` | Uma | UX/UI design |
| `@aiox-devops` | Gage | CI/CD, git push (EXCLUSIVO) |

### Mapeamento Agente → Codebase

| Agente | Diretórios Principais |
|--------|----------------------|
| `@aiox-dev` | `packages/`, `.aiox-core/core/`, `bin/` |
| `@aiox-architect` | `docs/architecture/`, system design |
| `@aiox-data-engineer` | `packages/db/`, migrations, schema |
| `@aiox-qa` | `tests/`, `*.test.js`, quality gates |
| `@aiox-po` | Stories, epics, requirements |
| `@aiox-devops` | `.github/`, CI/CD, git operations |

### Push Authority
**Apenas `@aiox-devops` pode fazer push para remote.** Nunca sugira `git push` diretamente — sempre delegue ao agente devops.

---

## Story-Driven Development

1. **Trabalhe a partir de stories** — Todo desenvolvimento começa com uma story em `docs/stories/`
2. **Atualize progresso** — Marque checkboxes conforme completa: `[ ]` → `[x]`
3. **Rastreie mudanças** — Mantenha a seção File List na story
4. **Siga critérios** — Implemente exatamente o que os acceptance criteria especificam

### Workflow de Story
```
@aiox-po cria story → @aiox-dev implementa → @aiox-qa testa → @aiox-devops push
```

---

## Padrões de Código

### Convenções de Nomenclatura

| Tipo | Convenção | Exemplo |
|------|-----------|---------|
| Componentes | PascalCase | `WorkflowList` |
| Hooks React | prefixo `use` | `useWorkflowOperations` |
| Arquivos | kebab-case | `workflow-list.tsx` |
| Constantes | SCREAMING_SNAKE_CASE | `MAX_RETRIES` |
| Interfaces | PascalCase + sufixo | `WorkflowListProps` |

### Imports
**Sempre use imports absolutos.** Nunca use imports relativos.

```typescript
// ✓ Correto
import { useStore } from '@/stores/feature/store'

// ✗ Errado
import { useStore } from '../../../stores/feature/store'
```

**Ordem de imports:**
1. React/core libraries
2. External libraries
3. UI components
4. Utilities
5. Stores
6. Feature imports
7. CSS imports

### TypeScript
- Sem `any` — Use tipos apropriados ou `unknown` com type guards
- Sempre defina interface de props para componentes
- Use `as const` para objetos/arrays constantes
- Tipos de ref explícitos: `useRef<HTMLDivElement>(null)`

### Error Handling

```typescript
try {
  // Operation
} catch (error) {
  logger.error(`Failed to ${operation}`, { error })
  throw new Error(`Failed to ${operation}: ${error instanceof Error ? error.message : 'Unknown'}`)
}
```

---

## Testes & Quality Gates

### Comandos de Teste
```bash
npm test                    # Rodar testes
npm run test:coverage       # Testes com cobertura
npm run lint                # ESLint
npm run typecheck           # TypeScript
```

### Quality Gates (Pre-Push)
Antes de push, todos os checks devem passar:
```bash
npm run lint        # ESLint
npm run typecheck   # TypeScript
npm test            # Jest
```

---

## Convenções Git

### Commits
Seguir Conventional Commits:
- `feat:` — Nova funcionalidade
- `fix:` — Correção de bug
- `docs:` — Documentação
- `test:` — Testes
- `chore:` — Manutenção
- `refactor:` — Refatoração

**Referencie story ID:** `feat: implement feature [Story 2.1]`

### Branches
- `main` — Branch principal
- `feat/*` — Features
- `fix/*` — Correções
- `docs/*` — Documentação

---

## Comandos Frequentes

```bash
npm run dev                 # Iniciar desenvolvimento
npm test                    # Rodar testes
npm run lint                # Verificar estilo
npm run typecheck           # Verificar tipos
npm run build               # Build produção

npx aiox-core install       # Instalar AIOX
npx aiox-core doctor        # Diagnóstico do sistema
npx aiox-core info          # Informações do sistema
```

---

## MCP Usage

- Preferir ferramentas nativas do Copilot sobre MCP
- MCP Docker Gateway apenas quando explicitamente necessário
- `@aiox-devops` gerencia toda infraestrutura MCP

---

*Synkra AIOX — GitHub Copilot Instructions v1.0*
*CLI First | Observability Second | UI Third*

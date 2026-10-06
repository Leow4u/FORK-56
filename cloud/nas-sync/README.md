# NAS sync (Etapa 2)

Canonical copies of `work4you-account-service` provision files.

## Automático (depois de configurar uma vez)

1. **Uma vez:** criar fine-grained PAT com write em `Leow4u/work4you-account-service` e guardar no FORK-56:
   ```bash
   gh secret set NAS_REPO_TOKEN --repo Leow4u/FORK-56
   ```
2. **Merge** do PR com estes ficheiros em `main`.

A partir daí o sync corre **sozinho** quando:

- merge/push em `cloud/nas-sync/**` ou no workflow de sync;
- cada deploy da golden image (`fly-cloud-runtime.yml`) termina com sucesso (job `sync-nas`).

Não precisas de PowerShell, GitHub Desktop, nem clicar "Run workflow" no dia a dia.

## Manual (só debug)

Actions → **Sync NAS Cloud (Etapa 2)** → Run workflow.

## Portal agents-first (rotas no NAS)

O sync copia `AgentHomePage`, `AgentSessionsPage`, `portal-nav.ts` e `PortalShell`.
No **work4you-account-service**, confirme no router SPA (ficheiro que monta
`/orgs/:orgId/*`) que existem:

- `index` → `AgentHomePage` (CTA **Abrir chat** via `/api/agents`)
- `login-sessions` → `AgentSessionsPage` (tabela OAuth; antes estava na home)

O login continua a redirecionar para `/orgs/{personalOrgId}` — agora é a superfície
do agente, não a tabela de sessões.

**Abrir chat:** `OpenCloudChatButton` + `open-cloud-chat.ts` — abre `/chat` e,
se a instância estiver `stopped`, dispara `POST …/start` em paralelo (sem copy
de infra na UI). Regras em `portal-cloud-lifecycle.ts`.

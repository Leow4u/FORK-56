# Etapa 2 — NAS OAuth / bootstrap (work4you-account-service)

## Status

| Etapa | Estado | Notas |
|-------|--------|-------|
| 1 Golden image | ✅ | `registry.fly.io/work4you-cloud-runtime:deployment-01M0QG8FXP8V4J48RPR92KPQ2B` (Release v2) |
| 2 NAS OAuth/bootstrap | 🔧 | Já em `main` do NAS; falta deploy + pin imagem + `init.cmd` |
| 3 Pin imagem | 🔧 | Incluído no branch `cursor/nas-oauth-bootstrap-6b2c` |
| 4 Nova instância | ⏳ | Após Vercel deploy |

## O que o NAS já faz (`main` do work4you-account-service)

Em `createAndProvisionAgent()` (`src/lib/agents.ts`):

- `WORK4YOU_DASHBOARD_OAUTH_CLIENT_ID=agent:{instance_id}`
- `WORK4YOU_DASHBOARD_PUBLIC_URL` / `WORK4YOU_DASHBOARD_PORTAL_URL`
- `WORK4YOU_AUTH_JSON_BOOTSTRAP` (client `work4you-cli-vps` via `agent-bootstrap.ts`)
- `bootstrapSessionId` persistido no Postgres

Contrato: `work4you-account-service/docs/agent-dashboard-oauth-contract.md`

## Forma automatizada (recomendada)

### Uma vez (2 minutos)

1. GitHub → **Settings** → **Developer settings** → **Fine-grained tokens** → **Generate**
   - Repository: `Leow4u/work4you-account-service`
   - Permissions: **Contents** → Read and write
2. No terminal (ou GitHub → FORK-56 → Settings → Secrets → Actions):
   ```bash
   gh secret set NAS_REPO_TOKEN --repo Leow4u/FORK-56
   ```
   (cola o PAT quando pedido)

3. **Merge** do PR com o workflow de sync em `main` do FORK-56.

### Depois disso — zero cliques

| Evento | O que acontece |
|--------|----------------|
| Merge em `cloud/nas-sync/**` | Sync automático para NAS `main` → Vercel redeploy |
| Deploy golden image (GHA) | Sync automático com a tag nova da imagem |

**Não** uses PowerShell nem copies ficheiros à mão.

Ficheiros fonte: `cloud/nas-sync/src/lib/` neste repo.

## Forma manual (só se o workflow falhar)

Branch local: `cursor/nas-oauth-bootstrap-6b2c` (commit `90257a3`)

Alterações:

1. **`src/lib/fly-machines.ts`** — pin Release v2 + `init.cmd` dashboard (golden image tem CMD vazio; Fly não é PID 1)
2. **`README.md`** — rollout order atualizado

### Aplicar no teu checkout NAS

```powershell
cd C:\DEV\work4you-account-service   # ou onde tens o NAS
git fetch origin
git checkout main
git pull origin main
git checkout -b cursor/nas-oauth-bootstrap-6b2c
```

Copiar os ficheiros do patch ou aplicar manualmente:

```diff
# fly-machines.ts — agentImage() default:
'registry.fly.io/work4you-cloud-runtime:deployment-01M0QG8FXP8V4J48RPR92KPQ2B'

# fly-machines.ts — createMachine config.init:
init: {
  cmd: ['dashboard', '--host', '0.0.0.0', '--port', String(args.internalPort), '--no-open'],
},
```

```powershell
git add src/lib/fly-machines.ts README.md
git commit -m "feat(cloud): wire golden image + dashboard CMD for agent VMs"
git push -u origin cursor/nas-oauth-bootstrap-6b2c
```

Merge → Vercel redeploy automático do Portal.

### Vercel (opcional)

```
WORK4YOU_AGENT_IMAGE=registry.fly.io/work4you-cloud-runtime:deployment-01M0QG8FXP8V4J48RPR92KPQ2B
```

Se omitido, o default no código (após merge) já aponta para Release v2.

## Etapa 4 — validar

1. Portal → Cloud → **criar novo agente** (não reutilizar VM stub)
2. Abrir `https://w4y-agent-<slug>.fly.dev` → login OAuth Portal
3. Confirmar dashboard carrega com sessão

Apagar instâncias antigas criadas com imagem stub (`deployment-01M0JY209NVKM1C5Z8DKBQ0YW0`).

| 6 Drain antes de stop (Fase D) | ✅ | PR #42 — drain antes de stopMachine |
| 7 Model UX (Fase E) | 🔧 | CloudPage + config seed + bootstrap JWT |

## Etapa 7 — model UX (Fase E)

Alinha create Cloud, provision e runtime com contratos existentes:

- **CloudPage** → `GET /api/keys/models?org=` (catálogo live + `locked` por plano)
- **POST /api/agents** → `resolveProvisionModel()` (recusa modelo bloqueado server-side)
- **`WORK4YOU_DEFAULT_MODEL`** → `scripts/docker_seed_default_model.py` + `stage2-hook.sh`
- **Bootstrap JWT** → `paidAccess` + `subscriptionTier` (paridade com `/oauth/token`)
- **`recommended-models`** → remove slug stale `qwen/qwen3-32b:free`

Golden image redeploy necessário para o seed de `config.yaml`. Portal: merge NAS + Vercel.

## Etapa 6 — drain antes de stop (Fase D)

Contrato existente no Fork (`gateway/run.py` + `POST /api/gateway/drain`):

1. NAS envia `POST {dashboardUrl}/api/gateway/drain` com bearer `dashboardDrainSecret`
   e `{"action":"drain","suppress_notification":true}`.
2. Poll público `GET {dashboardUrl}/api/status` até `active_agents === 0` (budget ≤ 100s,
   alinhado ao `maxDuration=120` da rota Vercel).
3. Só então chama `stopMachine` / `destroyMachine`.

Implementação: `cloud/nas-sync/src/lib/agent-gateway-drain.ts` + hook em
`stopAgent()` / `deleteAgent()` em `agents.ts`.

Verificação manual:

1. Instância **online** com gateway Running → iniciar um turno longo no Chat.
2. Portal → Cloud → **Parar** a instância enquanto o turno corre.
3. Confirmar que o turno termina antes da VM parar (sem corte abrupto mid-stream).
4. Repetir com instância **idle** — stop deve ser quase imediato.

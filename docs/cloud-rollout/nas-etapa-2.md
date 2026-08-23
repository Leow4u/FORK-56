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

## Patch pendente (imagem + dashboard CMD)

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

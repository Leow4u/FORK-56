---
sidebar_position: 15
title: "Modelos de Automação"
description: "Modelos prontos para uso de automação — tarefas agendadas, gatilhos de eventos do GitHub, webhooks de API e fluxos de trabalho com múltiplas Skills"
---

# Modelos de Automação

Modelos prontos para copiar e colar de padrões comuns de automação. Cada modelo usa o [agendador cron](/user-guide/features/cron) integrado do Work4You para gatilhos baseados em tempo e a [plataforma de webhooks](/user-guide/messaging/webhooks) para gatilhos orientados a eventos.

Todo modelo funciona com **qualquer modelo de IA** — não fica preso a um único provedor.

Para modelos parametrizados com formulários em vez de sintaxe cron, veja o [Catálogo de Modelos de Automação](/reference/automation-blueprints-catalog).

:::tip Três tipos de gatilho
| Gatilho | Como | Ferramenta |
|---------|-----|------|
| **Agendamento** | Roda em uma cadência (a cada hora, todas as noites, semanalmente) | Ferramenta `cronjob` ou comando de barra `/cron` |
| **Evento do GitHub** | Dispara em aberturas de PR, pushes, issues, resultados de CI | Plataforma de webhooks (`work4you webhook subscribe`) |
| **Chamada de API** | Serviço externo faz POST de JSON para o seu endpoint | Plataforma de webhooks (rotas do config.yaml ou `work4you webhook subscribe`) |

Todos os três suportam entrega para Telegram, Discord, Slack, SMS, e-mail, comentários no GitHub ou arquivos locais.
:::

---

## Fluxo de Trabalho de Desenvolvimento

### Triagem Noturna do Backlog

Rotula, prioriza e resume novas issues todas as noites. Entrega um resumo no canal da sua equipe.

**Gatilho:** Agendamento (noturno)

```bash
work4you cron create "0 2 * * *" \
  "You are a project manager triaging the Leow4u/FORK-56 GitHub repo.

1. Run: gh issue list --repo Leow4u/FORK-56 --state open --json number,title,labels,author,createdAt --limit 30
2. Identify issues opened in the last 24 hours
3. For each new issue:
   - Suggest a priority label (P0-critical, P1-high, P2-medium, P3-low)
   - Suggest a category label (bug, feature, docs, security)
   - Write a one-line triage note
4. Summarize: total open issues, new today, breakdown by priority

Format as a clean digest. If no new issues, respond with [SILENT]." \
  --name "Nightly backlog triage" \
  --deliver telegram
```

### Revisão Automática de Código em PR

Revisa automaticamente cada pull request quando ele é aberto. Publica um comentário de revisão diretamente no PR.

**Gatilho:** Webhook do GitHub

**Opção A — Assinatura dinâmica (CLI):**

```bash
work4you webhook subscribe github-pr-review \
  --events "pull_request" \
  --prompt "Review this pull request:
Repository: {repository.full_name}
PR #{pull_request.number}: {pull_request.title}
Author: {pull_request.user.login}
Action: {action}
Diff URL: {pull_request.diff_url}

Fetch the diff with: curl -sL {pull_request.diff_url}

Review for:
- Security issues (injection, auth bypass, secrets in code)
- Performance concerns (N+1 queries, unbounded loops, memory leaks)
- Code quality (naming, duplication, error handling)
- Missing tests for new behavior

Post a concise review. If the PR is a trivial docs/typo change, say so briefly." \
  --skills github-code-review \
  --deliver github_comment
```

**Opção B — Rota estática (config.yaml):**

```yaml
platforms:
  webhook:
    enabled: true
    extra:
      port: 8644
      secret: "your-global-secret"
      routes:
        github-pr-review:
          events: ["pull_request"]
          secret: "github-webhook-secret"
          prompt: |
            Review PR #{pull_request.number}: {pull_request.title}
            Repository: {repository.full_name}
            Author: {pull_request.user.login}
            Diff URL: {pull_request.diff_url}
            Review for security, performance, and code quality.
          skills: ["github-code-review"]
          deliver: "github_comment"
          deliver_extra:
            repo: "{repository.full_name}"
            pr_number: "{pull_request.number}"
```

Depois, no GitHub: **Settings → Webhooks → Add webhook** → Payload URL: `http://your-server:8644/webhooks/github-pr-review`, Content type: `application/json`, Secret: `github-webhook-secret`, Events: **Pull requests**.

### Detecção de Desatualização da Documentação

Varredura semanal de PRs mesclados para encontrar mudanças de API que precisam de atualizações na documentação.

**Gatilho:** Agendamento (semanal)

```bash
work4you cron create "0 9 * * 1" \
  "Scan the Leow4u/FORK-56 repo for documentation drift.

1. Run: gh pr list --repo Leow4u/FORK-56 --state merged --json number,title,files,mergedAt --limit 30
2. Filter to PRs merged in the last 7 days
3. For each merged PR, check if it modified:
   - Tool schemas (tools/*.py) — may need docs/reference/tools-reference.md update
   - CLI commands (work4you_cli/commands.py, work4you_cli/main.py) — may need docs/reference/cli-commands.md update
   - Config options (work4you_cli/config.py) — may need docs/user-guide/configuration.md update
   - Environment variables — may need docs/reference/environment-variables.md update
4. Cross-reference: for each code change, check if the corresponding docs page was also updated in the same PR

Report any gaps where code changed but docs didn't. If everything is in sync, respond with [SILENT]." \
  --name "Docs drift detection" \
  --deliver telegram
```

### Auditoria de Segurança de Dependências

Varredura diária em busca de vulnerabilidades conhecidas nas dependências do projeto.

**Gatilho:** Agendamento (diário)

```bash
work4you cron create "0 6 * * *" \
  "Run a dependency security audit on the work4you project.

1. cd ~/.work4you/work4you && source .venv/bin/activate
2. Run: pip audit --format json 2>/dev/null || pip audit 2>&1
3. Run: npm audit --json 2>/dev/null (in website/ directory if it exists)
4. Check for any CVEs with CVSS score >= 7.0

If vulnerabilities found:
- List each one with package name, version, CVE ID, severity
- Check if an upgrade is available
- Note if it's a direct dependency or transitive

If no vulnerabilities, respond with [SILENT]." \
  --name "Dependency audit" \
  --deliver telegram
```

---

## DevOps e Monitoramento

### Verificação de Deploy

Dispara testes de fumaça após cada deploy. Seu pipeline de CI/CD faz POST para o webhook quando um deploy é concluído.

**Gatilho:** Chamada de API (webhook)

```bash
work4you webhook subscribe deploy-verify \
  --events "deployment" \
  --prompt "A deployment just completed:
Service: {service}
Environment: {environment}
Version: {version}
Deployed by: {deployer}

Run these verification steps:
1. Check if the service is responding: curl -s -o /dev/null -w '%{http_code}' {health_url}
2. Search recent logs for errors: check the deployment payload for any error indicators
3. Verify the version matches: curl -s {health_url}/version

Report: deployment status (healthy/degraded/failed), response time, any errors found.
If healthy, keep it brief. If degraded or failed, provide detailed diagnostics." \
  --deliver telegram
```

Seu pipeline de CI/CD o dispara:

```bash
curl -X POST http://your-server:8644/webhooks/deploy-verify \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: sha256=$(echo -n '{"service":"api","environment":"prod","version":"2.1.0","deployer":"ci","health_url":"https://api.example.com/health"}' | openssl dgst -sha256 -hmac 'your-secret' | cut -d' ' -f2)" \
  -d '{"service":"api","environment":"prod","version":"2.1.0","deployer":"ci","health_url":"https://api.example.com/health"}'
```

### Triagem de Alertas

Correlaciona alertas de monitoramento com mudanças recentes para elaborar uma resposta. Funciona com Datadog, PagerDuty, Grafana ou qualquer sistema de alertas que consiga fazer POST de JSON.

**Gatilho:** Chamada de API (webhook)

```bash
work4you webhook subscribe alert-triage \
  --prompt "Monitoring alert received:
Alert: {alert.name}
Severity: {alert.severity}
Service: {alert.service}
Message: {alert.message}
Timestamp: {alert.timestamp}

Investigate:
1. Search the web for known issues with this error pattern
2. Check if this correlates with any recent deployments or config changes
3. Draft a triage summary with:
   - Likely root cause
   - Suggested first response steps
   - Escalation recommendation (P1-P4)

Be concise. This goes to the on-call channel." \
  --deliver slack
```

### Monitor de Disponibilidade

Verifica endpoints a cada 30 minutos. Só notifica quando algo está fora do ar.

**Gatilho:** Agendamento (a cada 30 min)

```python title="~/.work4you/scripts/check-uptime.py"
import urllib.request, json, time

ENDPOINTS = [
    {"name": "API", "url": "https://api.example.com/health"},
    {"name": "Web", "url": "https://www.example.com"},
    {"name": "Docs", "url": "https://docs.example.com"},
]

results = []
for ep in ENDPOINTS:
    try:
        start = time.time()
        req = urllib.request.Request(ep["url"], headers={"User-Agent": "Work4You-Monitor/1.0"})
        resp = urllib.request.urlopen(req, timeout=10)
        elapsed = round((time.time() - start) * 1000)
        results.append({"name": ep["name"], "status": resp.getcode(), "ms": elapsed})
    except Exception as e:
        results.append({"name": ep["name"], "status": "DOWN", "error": str(e)})

down = [r for r in results if r.get("status") == "DOWN" or (isinstance(r.get("status"), int) and r["status"] >= 500)]
if down:
    print("OUTAGE DETECTED")
    for r in down:
        print(f"  {r['name']}: {r.get('error', f'HTTP {r[\"status\"]}')} ")
    print(f"\nAll results: {json.dumps(results, indent=2)}")
else:
    print("NO_ISSUES")
```

```bash
work4you cron create "every 30m" \
  "If the script reports OUTAGE DETECTED, summarize which services are down and suggest likely causes. If NO_ISSUES, respond with [SILENT]." \
  --script ~/.work4you/scripts/check-uptime.py \
  --name "Uptime monitor" \
  --deliver telegram
```

---

## Pesquisa e Inteligência

### Vigia de Repositórios Concorrentes

Monitora repositórios concorrentes em busca de PRs interessantes, funcionalidades e decisões arquiteturais.

**Gatilho:** Agendamento (diário)

```bash
work4you cron create "0 8 * * *" \
  "Scout these AI agent repositories for notable activity in the last 24 hours:

Repos to check:
- anthropics/claude-code
- openai/codex
- All-Hands-AI/OpenHands
- Aider-AI/aider

For each repo:
1. gh pr list --repo <repo> --state all --json number,title,author,createdAt,mergedAt --limit 15
2. gh issue list --repo <repo> --state open --json number,title,labels,createdAt --limit 10

Focus on:
- New features being developed
- Architectural changes
- Integration patterns we could learn from
- Security fixes that might affect us too

Skip routine dependency bumps and CI fixes. If nothing notable, respond with [SILENT].
If there are findings, organize by repo with brief analysis of each item." \
  --skill competitive-pr-scout \
  --name "Competitor scout" \
  --deliver telegram
```

### Resumo de Notícias de IA

Resumo semanal de novidades em IA/ML.

**Gatilho:** Agendamento (semanal)

```bash
work4you cron create "0 9 * * 1" \
  "Generate a weekly AI news digest covering the past 7 days:

1. Search the web for major AI announcements, model releases, and research breakthroughs
2. Search for trending ML repositories on GitHub
3. Check arXiv for highly-cited papers on language models and agents

Structure:
## Headlines (3-5 major stories)
## Notable Papers (2-3 papers with one-sentence summaries)
## Open Source (interesting new repos or major releases)
## Industry Moves (funding, acquisitions, launches)

Keep each item to 1-2 sentences. Include links. Total under 600 words." \
  --name "Weekly AI digest" \
  --deliver telegram
```

### Resumo de Artigos com Notas

Varredura diária no arXiv que salva resumos no seu sistema de anotações.

**Gatilho:** Agendamento (diário)

```bash
work4you cron create "0 8 * * *" \
  "Search arXiv for the 3 most interesting papers on 'language model reasoning' OR 'tool-use agents' from the past day. For each paper, create an Obsidian note with the title, authors, abstract summary, key contribution, and potential relevance to Work4You development." \
  --skill arxiv --skill obsidian \
  --name "Paper digest" \
  --deliver local
```

---

## Automações de Eventos do GitHub

### Rotulagem Automática de Issues

Rotula e responde automaticamente a novas issues.

**Gatilho:** Webhook do GitHub

```bash
work4you webhook subscribe github-issues \
  --events "issues" \
  --prompt "New GitHub issue received:
Repository: {repository.full_name}
Issue #{issue.number}: {issue.title}
Author: {issue.user.login}
Action: {action}
Body: {issue.body}
Labels: {issue.labels}

If this is a new issue (action=opened):
1. Read the issue title and body carefully
2. Suggest appropriate labels (bug, feature, docs, security, question)
3. If it's a bug report, check if you can identify the affected component from the description
4. Post a helpful initial response acknowledging the issue

If this is a label or assignment change, respond with [SILENT]." \
  --deliver github_comment
```

### Análise de Falhas de CI

Analisa falhas de CI e publica diagnósticos no PR.

**Gatilho:** Webhook do GitHub

```yaml
# rota do config.yaml
platforms:
  webhook:
    enabled: true
    extra:
      routes:
        ci-failure:
          events: ["check_run"]
          secret: "ci-secret"
          prompt: |
            CI check failed:
            Repository: {repository.full_name}
            Check: {check_run.name}
            Status: {check_run.conclusion}
            PR: #{check_run.pull_requests.0.number}
            Details URL: {check_run.details_url}

            If conclusion is "failure":
            1. Fetch the log from the details URL if accessible
            2. Identify the likely cause of failure
            3. Suggest a fix
            If conclusion is "success", respond with [SILENT].
          deliver: "github_comment"
          deliver_extra:
            repo: "{repository.full_name}"
            pr_number: "{check_run.pull_requests.0.number}"
```

### Portar Mudanças Automaticamente Entre Repositórios

Quando um PR é mesclado em um repositório, porta automaticamente a mudança equivalente para outro.

**Gatilho:** Webhook do GitHub

```bash
work4you webhook subscribe auto-port \
  --events "pull_request" \
  --prompt "PR merged in the source repository:
Repository: {repository.full_name}
PR #{pull_request.number}: {pull_request.title}
Author: {pull_request.user.login}
Action: {action}
Merge commit: {pull_request.merge_commit_sha}

If action is 'closed' and pull_request.merged is true:
1. Fetch the diff: curl -sL {pull_request.diff_url}
2. Analyze what changed
3. Determine if this change needs to be ported to the Go SDK equivalent
4. If yes, create a branch, apply the equivalent changes, and open a PR on the target repo
5. Reference the original PR in the new PR description

If action is not 'closed' or not merged, respond with [SILENT]." \
  --skills github-pr-workflow \
  --deliver log
```

---

## Operações de Negócio

### Monitoramento de Pagamentos Stripe

Acompanha eventos de pagamento e recebe resumos de falhas.

**Gatilho:** Chamada de API (webhook)

```bash
work4you webhook subscribe stripe-payments \
  --events "payment_intent.succeeded,payment_intent.payment_failed,charge.dispute.created" \
  --prompt "Stripe event received:
Event type: {type}
Amount: {data.object.amount} cents ({data.object.currency})
Customer: {data.object.customer}
Status: {data.object.status}

For payment_intent.payment_failed:
- Identify the failure reason from {data.object.last_payment_error}
- Suggest whether this is a transient issue (retry) or permanent (contact customer)

For charge.dispute.created:
- Flag as urgent
- Summarize the dispute details

For payment_intent.succeeded:
- Brief confirmation only

Keep responses concise for the ops channel." \
  --deliver slack
```

### Resumo Diário de Receita

Compila métricas de negócio importantes toda manhã.

**Gatilho:** Agendamento (diário)

```bash
work4you cron create "0 8 * * *" \
  "Generate a morning business metrics summary.

Search the web for:
1. Current Bitcoin and Ethereum prices
2. S&P 500 status (pre-market or previous close)
3. Any major tech/AI industry news from the last 12 hours

Format as a brief morning briefing, 3-4 bullet points max.
Deliver as a clean, scannable message." \
  --name "Morning briefing" \
  --deliver telegram
```

---

## Fluxos de Trabalho com Múltiplas Skills

### Pipeline de Auditoria de Segurança

Combina várias Skills para uma revisão de segurança semanal abrangente.

**Gatilho:** Agendamento (semanal)

```bash
work4you cron create "0 3 * * 0" \
  "Run a comprehensive security audit of the work4you codebase.

1. Check for dependency vulnerabilities (pip audit, npm audit)
2. Search the codebase for common security anti-patterns:
   - Hardcoded secrets or API keys
   - SQL injection vectors (string formatting in queries)
   - Path traversal risks (user input in file paths without validation)
   - Unsafe deserialization (pickle.loads, yaml.load without SafeLoader)
3. Review recent commits (last 7 days) for security-relevant changes
4. Check if any new environment variables were added without being documented

Write a security report with findings categorized by severity (Critical, High, Medium, Low).
If nothing found, report a clean bill of health." \
  --skill codebase-security-audit \
  --name "Weekly security audit" \
  --deliver telegram
```

### Pipeline de Conteúdo

Pesquisa, rascunha e prepara conteúdo em um cronograma.

**Gatilho:** Agendamento (semanal)

```bash
work4you cron create "0 10 * * 3" \
  "Research and draft a technical blog post outline about a trending topic in AI agents.

1. Search the web for the most discussed AI agent topics this week
2. Pick the most interesting one that's relevant to open-source AI agents
3. Create an outline with:
   - Hook/intro angle
   - 3-4 key sections
   - Technical depth appropriate for developers
   - Conclusion with actionable takeaway
4. Save the outline to ~/drafts/blog-$(date +%Y%m%d).md

Keep the outline to ~300 words. This is a starting point, not a finished post." \
  --name "Blog outline" \
  --deliver local
```

---

## Referência Rápida

### Sintaxe de Agendamento Cron

| Expressão | Significado |
|-----------|---------|
| `every 30m` | A cada 30 minutos |
| `every 2h` | A cada 2 horas |
| `0 2 * * *` | Diariamente às 2h |
| `0 9 * * 1` | Toda segunda-feira às 9h |
| `0 9 * * 1-5` | Dias úteis às 9h |
| `0 3 * * 0` | Todo domingo às 3h |
| `0 */6 * * *` | A cada 6 horas |

### Destinos de Entrega

| Destino | Flag | Notas |
|--------|------|-------|
| Mesma conversa | `--deliver origin` | Padrão — entrega onde a tarefa foi criada |
| Arquivo local | `--deliver local` | Salva a saída, sem notificação |
| Telegram | `--deliver telegram` | Canal principal, ou `telegram:CHAT_ID` para um específico |
| Discord | `--deliver discord` | Canal principal, ou `discord:CHANNEL_ID` |
| Slack | `--deliver slack` | Canal principal |
| SMS | `--deliver sms:+15551234567` | Direto para um número de telefone |
| Thread específica | `--deliver telegram:-100123:456` | Tópico de fórum do Telegram |

### Variáveis de Template do Webhook

| Variável | Descrição |
|----------|-------------|
| `{pull_request.title}` | Título do PR |
| `{issue.number}` | Número da issue |
| `{repository.full_name}` | `owner/repo` |
| `{action}` | Ação do evento (opened, closed, etc.) |
| `{__raw__}` | Payload JSON completo (truncado em 4000 caracteres) |
| `{sender.login}` | Usuário do GitHub que disparou o evento |

### O padrão [SILENT]

Quando a resposta de uma tarefa cron contém `[SILENT]`, a entrega é suprimida. Use isso para evitar spam de notificações em execuções tranquilas:

```
If nothing noteworthy happened, respond with [SILENT].
```

Isso significa que você só é notificado quando o agente tem algo a relatar.

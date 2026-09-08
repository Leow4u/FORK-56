---
sidebar_position: 12
title: "Solução de Problemas do Cron"
description: "Diagnostique e corrija problemas comuns do cron do Work4You — tarefas que não disparam, falhas de entrega, erros de carregamento de skill e problemas de desempenho"
---

# Solução de Problemas do Cron

Quando uma tarefa cron não se comporta como esperado, siga estas verificações em ordem. A maioria dos problemas se enquadra em uma de quatro categorias: temporização, entrega, permissões ou carregamento de skill.

---

## Tarefas Não Disparam

### Verificação 1: Confirme que a tarefa existe e está ativa

```bash
work4you cron list
```

Procure a tarefa e confirme que seu estado é `[active]` (não `[paused]` ou `[completed]`). Se aparecer `[completed]`, o número de repetições pode estar esgotado — edite a tarefa para redefini-lo.

### Verificação 2: Confirme que o agendamento está correto

Um agendamento mal formatado assume silenciosamente o padrão de execução única ou é rejeitado completamente. Teste sua expressão:

| Sua expressão | Deve avaliar para |
|----------------|-------------------|
| `0 9 * * *` | 9h todos os dias |
| `0 9 * * 1` | 9h toda segunda-feira |
| `every 2h` | A cada 2 horas a partir de agora |
| `30m` | 30 minutos a partir de agora |
| `2025-06-01T09:00:00` | 1º de junho de 2025 às 9h UTC |

Se a tarefa dispara uma vez e depois desaparece da lista, é um agendamento de execução única (`30m`, `1d`, ou um timestamp ISO) — comportamento esperado.

### Verificação 3: O gateway está rodando?

As tarefas cron são disparadas pela thread de ticker em segundo plano do gateway, que faz um tick a cada 60 segundos. Uma sessão de chat regular via CLI **não** dispara tarefas cron automaticamente.

Se você espera que as tarefas disparem automaticamente, precisa de um gateway em execução (`work4you gateway` em primeiro plano, ou `work4you gateway start` para o serviço instalado). Para depuração pontual, você pode disparar manualmente um tick com `work4you cron tick`.

### Verificação 4: Verifique o relógio do sistema e o fuso horário

As tarefas usam o fuso horário local. Se o relógio da sua máquina estiver errado ou em um fuso horário diferente do esperado, as tarefas dispararão nos horários errados. Verifique:

```bash
date
work4you cron list   # Compare next_run times with local time
```

---

## Falhas de Entrega

### Verificação 1: Confirme que o alvo de entrega está correto

Os alvos de entrega diferenciam maiúsculas de minúsculas e exigem que a plataforma correta esteja configurada. Um alvo mal configurado descarta a resposta silenciosamente.

| Alvo | Requer |
|--------|----------|
| `telegram` | `TELEGRAM_BOT_TOKEN` em `~/.work4you/.env` |
| `discord` | `DISCORD_BOT_TOKEN` em `~/.work4you/.env` |
| `slack` | `SLACK_BOT_TOKEN` em `~/.work4you/.env` |
| `whatsapp` | Gateway do WhatsApp configurado |
| `signal` | Gateway do Signal configurado |
| `matrix` | Homeserver do Matrix configurado |
| `email` | SMTP configurado em `config.yaml` |
| `sms` | Provedor de SMS configurado |
| `local` | Acesso de escrita a `~/.work4you/cron/output/` |
| `origin` | Entrega no chat onde a tarefa foi criada |

Outras plataformas suportadas incluem `mattermost`, `homeassistant`, `dingtalk`, `feishu`, `wecom`, `weixin`, `bluebubbles`, `qqbot` e `webhook`. Você também pode direcionar para um chat específico com a sintaxe `platform:chat_id` (por exemplo, `telegram:-1001234567890`).

Se a entrega falhar, a tarefa ainda roda — ela simplesmente não enviará para lugar nenhum. Verifique `work4you cron list` para o campo `last_error` atualizado (se disponível).

### Verificação 2: Verifique o uso de `[SILENT]`

Se sua tarefa cron não produz saída, a entrega é suprimida. Se a resposta do agente incluir o marcador de silêncio do cron `[SILENT]`, a entrega também é suprimida. Isso é intencional para tarefas de monitoramento — mas certifique-se de que seu prompt não esteja suprimindo tudo por acidente.

Use prompts como "responda apenas com [SILENT] se nada mudou". Evite pedir ao agente para incluir `[SILENT]` dentro de uma explicação mais longa, porque o cron trata esse marcador como um sinal de supressão.

### Verificação 3: Permissões do token da plataforma

Cada bot de plataforma de mensagens precisa de permissões específicas para receber mensagens. Se a entrega falha silenciosamente:

- **Telegram**: o bot deve ser administrador no grupo/canal de destino
- **Discord**: o bot deve ter permissão para enviar mensagens no canal de destino
- **Slack**: o bot deve estar adicionado ao workspace e ter o escopo `chat:write`

### Verificação 4: Encapsulamento de resposta

Por padrão, as respostas do cron são encapsuladas com um cabeçalho e um rodapé (`cron.wrap_response: true` em `config.yaml`). Algumas plataformas ou integrações podem não lidar bem com isso. Para desativar:

```yaml
cron:
  wrap_response: false
```

---

## Falhas no Carregamento de Skills

### Verificação 1: Confirme que as skills estão instaladas

```bash
work4you skills list
```

As skills devem ser instaladas antes de poderem ser anexadas a tarefas cron. Se uma skill estiver faltando, instale-a primeiro com `work4you skills install <skill-name>` ou via `/skills` na CLI.

### Verificação 2: Verifique o nome da skill versus o nome da pasta da skill

Os nomes das skills diferenciam maiúsculas de minúsculas e devem corresponder ao nome da pasta da skill instalada. Se sua tarefa especifica `ai-funding-report`, mas a pasta da skill é `ai-funding-daily-report`, confirme o nome exato em `work4you skills list`.

### Verificação 3: Skills que exigem ferramentas interativas

As tarefas cron rodam com os conjuntos de ferramentas `cronjob`, `messaging` e `clarify` desativados. Isso evita a criação recursiva de cron, o envio direto de mensagens (a entrega é tratada pelo agendador) e prompts interativos. Se uma skill depende desses conjuntos de ferramentas, ela não funcionará em um contexto de cron.

Verifique a documentação da skill para confirmar que ela funciona em modo não interativo (headless).

### Verificação 4: Ordenação de múltiplas skills

Ao usar múltiplas skills, elas carregam em ordem. Se a Skill A depende de contexto da Skill B, certifique-se de que B carregue primeiro:

```bash
/cron add "0 9 * * *" "..." --skill context-skill --skill target-skill
```

Neste exemplo, `context-skill` carrega antes de `target-skill`.

---

## Erros e Falhas de Tarefas

### Verificação 1: Revise a saída recente da tarefa

Se uma tarefa rodou e falhou, você pode ver o contexto do erro em:

1. O chat onde a tarefa entrega (se a entrega foi bem-sucedida)
2. `~/.work4you/logs/agent.log` para mensagens do agendador (ou `errors.log` para avisos)
3. Os metadados `last_run` da tarefa via `work4you cron list`

### Verificação 2: Padrões de erro comuns

**"No such file or directory" para scripts**
O caminho `script` deve ser um caminho absoluto (ou relativo ao diretório de configuração do Work4You). Verifique:
```bash
ls ~/.work4you/scripts/your-script.py   # Must exist
work4you cron edit <job_id> --script ~/.work4you/scripts/your-script.py
```

**"Skill not found" na execução da tarefa**
A skill deve estar instalada na máquina que executa o agendador. Se você alterna entre máquinas, as skills não sincronizam automaticamente — reinstale-as com `work4you skills install <skill-name>`.

**A tarefa roda mas não entrega nada**
Provavelmente é um problema no alvo de entrega (veja Falhas de Entrega acima), ausência de saída, ou uma resposta contendo o marcador de silêncio do cron `[SILENT]`.

**A tarefa trava ou expira**
O agendador usa um timeout baseado em inatividade (padrão de 600s, configurável via variável de ambiente `WORK4YOU_CRON_TIMEOUT`, `0` para ilimitado). O agente pode rodar o tempo que quiser enquanto estiver chamando ferramentas ativamente — o cronômetro só dispara após inatividade sustentada. Tarefas de longa duração devem usar scripts para lidar com a coleta de dados e entregar apenas o resultado.

### Verificação 3: Disputa de lock

O agendador usa bloqueio baseado em arquivo para evitar ticks sobrepostos. Se duas instâncias do gateway estiverem rodando (ou uma sessão de CLI entrar em conflito com um gateway), as tarefas podem ser atrasadas ou puladas.

Encerre processos de gateway duplicados:
```bash
ps aux | grep work4you
# Kill duplicate processes, keep only one
```

### Verificação 4: Permissões em jobs.json

As tarefas são armazenadas em `~/.work4you/cron/jobs.json`. Se este arquivo não puder ser lido/escrito pelo seu usuário, o agendador falhará silenciosamente:

```bash
ls -la ~/.work4you/cron/jobs.json
chmod 600 ~/.work4you/cron/jobs.json   # Your user should own it
```

---

## Problemas de Desempenho

### Inicialização lenta da tarefa

Cada tarefa cron cria uma nova sessão do AIAgent, o que pode envolver autenticação do provedor e carregamento do modelo. Para agendamentos sensíveis ao tempo, adicione um tempo de folga (por exemplo, `0 8 * * *` em vez de `0 9 * * *`).

### Excesso de tarefas sobrepostas

O agendador executa as tarefas sequencialmente dentro de cada tick. Se múltiplas tarefas vencem ao mesmo tempo, elas rodam uma após a outra. Considere escalonar os agendamentos (por exemplo, `0 9 * * *` e `5 9 * * *` em vez de ambos em `0 9 * * *`) para evitar atrasos.

### Saída grande de script

Scripts que despejam megabytes de saída vão deixar o agente lento e podem atingir limites de tokens. Filtre/resuma no nível do script — emita apenas o que o agente precisa para raciocinar.

---

## Comandos de Diagnóstico

```bash
work4you cron list                    # Show all jobs, states, next_run times
work4you cron run <job_id>            # Schedule for next tick (for testing)
work4you cron edit <job_id>           # Fix configuration issues
work4you logs                         # View recent Work4You logs
work4you skills list                  # Verify installed skills
```

---

## Obtendo Mais Ajuda

Se você seguiu este guia e o problema persiste:

1. Rode a tarefa com `work4you cron run <job_id>` (dispara no próximo tick do gateway) e observe erros na saída do chat
2. Verifique `~/.work4you/logs/agent.log` para mensagens do agendador e `~/.work4you/logs/errors.log` para avisos
3. Abra uma issue em [github.com/Leow4u/FORK-56](https://github.com/Leow4u/FORK-56) com:
   - O ID da tarefa e o agendamento
   - O alvo de entrega
   - O que você esperava versus o que aconteceu
   - Mensagens de erro relevantes dos logs

---

*Para a referência completa do cron, veja [Automatize Qualquer Coisa com Cron](/guides/automate-with-cron) e [Tarefas Agendadas (Cron)](/user-guide/features/cron).*

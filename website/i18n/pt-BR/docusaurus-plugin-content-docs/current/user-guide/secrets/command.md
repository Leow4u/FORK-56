# Fonte de Segredos via Command Helper

Resolva credenciais executando seu próprio comando auxiliar na inicialização — qualquer cofre de segredos com uma CLI funciona: `keepassxc-cli`, `secret-tool` (GNOME Keyring), `pass`, `gpg`, a CLI do Vaultwarden, ou um script que faz `cat` em um arquivo de ambiente em tmpfs. O helper imprime linhas `KEY=VALUE` na stdout; o Work4You as aplica através do mesmo orquestrador usado pelo [Bitwarden](./bitwarden) e [1Password](./onepassword), então você pode habilitar qualquer combinação de fontes simultaneamente.

## Como funciona

1. Você configura um comando auxiliar em `config.yaml` (nunca em `.env` — o comando é configuração, `.env` contém valores).
2. Na inicialização, depois que `.env` é carregado, o Work4You executa o helper UMA VEZ via `/bin/sh -c` e interpreta sua stdout como um blob dotenv.
3. As chaves interpretadas seguem a escada de precedência padrão: `.env`/shell vencem a menos que `override_existing: true` esteja definido; fontes mapeadas vencem essa fonte em massa em variáveis disputadas; a primeira reivindicação vence.

```yaml
secrets:
  command:
    enabled: true
    command: "cat /run/user/1000/work4you-secrets.env"
    # or any vault CLI that dumps KEY=VALUE lines:
    # command: "pass show work4you/env"
    # command: "secret-tool lookup service work4you-env"
```

## Configuração

| Chave | Padrão | O que faz |
|---|---|---|
| `enabled` | `false` | Chave geral. |
| `command` | `""` | Helper executado via `/bin/sh -c`; deve imprimir linhas `KEY=VALUE` na stdout. |
| `helper_timeout_seconds` | `3` | Tempo limite rígido para uma execução do helper. Deliberadamente apertado — o helper precisa ser rápido e NÃO interativo (sem prompts de desbloqueio, sem toque/PIN). |
| `override_existing` | `false` | Valores do helper sobrescrevem valores de `.env`/shell. Desativado por padrão (ao contrário do Bitwarden/1Password), já que um helper local não é uma autoridade central de rotação. |

## Modelo de segurança

- A string do comando helper é SUA configuração — mesmo nível de confiança do arquivo `.env` que você controla.
- A saída tem um limite rígido de 1 MiB; um helper descontrolado não consegue travar a inicialização (o grupo de processos é encerrado ao atingir o tempo limite).
- O **stderr do helper é descartado** — diagnósticos de CLIs de cofre podem carregar material secreto, então eles nunca chegam à saída do Work4You. As falhas registram apenas campos estruturados (código de saída / sinal / errno), nunca a string do comando.
- Valores contendo apenas espaços em branco são tratados como "sem valor" — uma entrada de placeholder nunca chega a um cabeçalho Authorization.
- Somente POSIX (precisa de `/bin/sh`). No Windows, a fonte se reporta como não configurada e a inicialização continua.

## Modos de falha

A inicialização nunca é bloqueada. Os erros imprimem uma linha mais uma dica de correção com `→`:

| Sintoma | Causa | Correção |
|---|---|---|
| `secrets.command.command is empty` | Habilitado sem um comando | Defina `secrets.command.command` em config.yaml |
| `helper command failed` | Saída diferente de zero, timeout, falha ao iniciar | Execute o helper manualmente em um shell para ver o erro real (o Work4You descarta seu stderr propositalmente) |
| `helper output was not a KEY=VALUE map` | O helper imprimiu um valor solto ou lixo | Faça o helper emitir linhas no formato dotenv |

## Quando usar isso em vez de um plugin

A fonte de comando é a válvula de escape para cofres sem uma integração empacotada. Se você se pegar encapsulando uma dança complexa de CLI em um script longo, considere em vez disso um [plugin de fonte de segredos](/developer-guide/secret-source-plugin) propriamente dito — plugins ganham cache, rótulos de proveniência e configuração tipada.

# Segredos

O Work4You pode buscar chaves de API em gerenciadores de segredos externos no momento de inicialização do processo, em vez de armazená-las em `~/.work4you/.env`. O token de bootstrap do gerenciador de segredos fica em `.env`; toda outra chave de provedor (OpenAI, Anthropic, OpenRouter, etc.) pode ficar no gerenciador e rotacionar de forma centralizada.

Suportados:

- [Bitwarden Secrets Manager](./bitwarden) — CLI `bws`, instalada sob demanda, o plano gratuito funciona.
- [1Password](./onepassword) — referências `op://` via a CLI oficial `op`; autenticação por conta de serviço ou sessão de desktop.
- [Command helper](./command) — qualquer CLI de cofre (`keepassxc-cli`, `secret-tool`, `pass`, scripts personalizados) via um helper configurado pelo usuário que imprime linhas `KEY=VALUE`.

## Múltiplas fontes ao mesmo tempo

Você pode habilitar mais de uma fonte de segredos ao mesmo tempo — por exemplo, um projeto Bitwarden de equipe junto com um plugin de cofre pessoal. As fontes se combinam por variável de ambiente com uma escada de precedência determinística:

1. **Seu `.env` / shell vence por padrão.** Uma fonte só substitui um valor pré-existente quando seu próprio `override_existing: true` está definido (o Bitwarden usa true por padrão, para que a rotação centralizada funcione).
2. **Fontes mapeadas vencem fontes em massa.** Uma fonte em que você vincula explicitamente variáveis de ambiente a referências (um mapa `env:`) tem prioridade sobre uma fonte que injeta implicitamente um projeto inteiro de segredos, independentemente da ordem.
3. **A primeira fonte vence.** Dentro do mesmo formato, a ordem da lista opcional `secrets.sources` (ou a ordem de registro) decide. Reivindicações posteriores sobre uma variável já reivindicada são ignoradas — com um aviso na inicialização, nunca silenciosamente.

`override_existing` nunca permite que uma fonte sobrescreva uma variável que outra fonte já reivindicou, e nenhuma fonte pode jamais sobrescrever o token de bootstrap de outra fonte (por exemplo, `BWS_ACCESS_TOKEN`).

```yaml
secrets:
  sources: [bitwarden]     # optional explicit ordering
  bitwarden:
    enabled: true
    project_id: "..."
```

Toda credencial injetada por uma fonte é rotulada com sua origem — os fluxos de configuração e `work4you model` mostram `(from Bitwarden)` ao lado das chaves detectadas, para que você sempre saiba de onde veio um valor.

## Perfis e cofres compartilhados

Dois controles no nível do orquestrador tornam um cofre compartilhado seguro entre [perfis](../profiles):

- **`secrets.preserve_existing`** — uma lista de nomes de variáveis de ambiente cujo valor existente em `.env` / shell sempre vence, mesmo contra uma fonte com `override_existing: true`. Use para segredos de plataforma por perfil (por exemplo, `FEISHU_APP_SECRET`) que devem diferir intencionalmente entre perfis, enquanto tudo o mais rotaciona centralmente:

  ```yaml
  secrets:
    preserve_existing: [FEISHU_APP_SECRET, TELEGRAM_BOT_TOKEN]
  ```

- **Aliasing de perfil** (ativado por padrão; use `secrets.profile_alias: false` para desativar) — quando o Work4You roda sob um perfil nomeado, um segredo no cofre chamado `FOO_<PROFILE>` (apenas sufixos com formato de credencial: `*_API_KEY`, `*_TOKEN`, `*_SECRET`, `*_KEY`, `*_PASSWORD`) também alimenta o `FOO` canônico. Armazene `TELEGRAM_BOT_TOKEN_MILLA` no projeto compartilhado e os adaptadores do perfil `milla` — que leem o nome fixo `TELEGRAM_BOT_TOKEN` — recebem o valor correto automaticamente. Uma variável que o cofre fornece diretamente sob seu nome canônico sempre vence sobre um alias.

Ambos se aplicam a toda fonte — nativa e via plugin — porque residem no orquestrador, não nos backends.

## Adicionando seu próprio backend

Gerenciadores de segredos de terceiros são distribuídos como plugins independentes, não como PRs no núcleo. Um backend estende `agent.secret_sources.base.SecretSource` (um método obrigatório: `fetch(cfg, home_path) -> FetchResult`) e se registra via `ctx.register_secret_source(MySource())` dentro do `register(ctx)` do plugin. O orquestrador é responsável pela precedência, tratamento de conflitos, timeouts e proveniência — sua fonte só busca os dados. Guia completo com as regras de contrato, o helper de segurança de subprocesso e o kit de conformidade: [Building a Secret Source Plugin](/developer-guide/secret-source-plugin).

O conjunto empacotado é deliberadamente fechado (mesma política dos provedores de memória): Bitwarden e 1Password vêm embutidos. Todo o resto — Infisical, Proton Pass, HashiCorp Vault, AWS Secrets Manager, keystores do sistema operacional — pertence a repositórios de plugins; compartilhe-os no Discord do Work4You (`#plugins-skills-and-skins`).

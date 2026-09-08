---
sidebar_position: 11
title: Model Catalog
description: Manifesto hospedado remotamente que alimenta as listas selecionadas do seletor de modelos para OpenRouter e Work4You Portal.
---

# Model Catalog

O Work4You busca listas de modelos selecionadas para **OpenRouter** e **Work4You Portal** a partir de um manifesto JSON hospedado junto com o site de documentação. Isso permite que os mantenedores atualizem as listas do seletor sem precisar lançar uma nova versão do `work4you`.

Quando o manifesto está inacessível (offline, rede bloqueada, falha de hospedagem), o Work4You recorre silenciosamente ao snapshot embutido no repositório que acompanha a CLI. O manifesto nunca quebra o seletor — na pior das hipóteses, você vê a lista que veio empacotada com a sua versão instalada.

## URL do manifesto ao vivo

```
https://work4you.ai/docs/api/model-catalog.json
```

Publicado a cada merge na `main` através do pipeline existente do GitHub Pages, `deploy-site.yml`. A fonte de verdade fica no repositório em `website/static/api/model-catalog.json`.

## Esquema

```json
{
  "version": 1,
  "updated_at": "2026-04-25T22:00:00Z",
  "metadata": {},
  "providers": {
    "openrouter": {
      "metadata": {},
      "models": [
        {"id": "z-ai/glm-5.2",         "description": "default", "default": true},
        {"id": "moonshotai/kimi-k3",   "description": "recommended", "metadata": {}},
        {"id": "openai/gpt-5.4",       "description": ""}
      ]
    },
    "work4you": {
      "metadata": {},
      "models": [
        {"id": "z-ai/glm-5.2", "default": true},
        {"id": "anthropic/claude-opus-4.7"},
        {"id": "moonshotai/kimi-k3"}
      ]
    }
  }
}
```

Notas sobre os campos:

- **`version`** — versão do esquema, em número inteiro. Esquemas futuros incrementam esse valor; o Work4You recusa manifestos com versões que não reconhece e recorre ao snapshot fixo no código.
- **`metadata`** — dicionário de formato livre no nível do manifesto, do provedor e do modelo. Aceita qualquer chave. O Work4You ignora campos desconhecidos, então você pode anotar entradas (`"tier": "paid"`, `"tags": [...]`, etc.) sem precisar coordenar uma mudança de esquema.
- **`description`** — exclusivo do OpenRouter. Determina o texto do badge no seletor (`"recommended"`, `"free"`, `"default"`, ou vazio). O Work4You Portal não usa este campo — o controle de acesso ao nível gratuito é determinado ao vivo a partir do endpoint de preços do Portal.
- **`default`** — exatamente uma entrada por provedor pode carregar `"default": true`. Esse modelo é o **padrão silencioso**: aquele em que o Work4You recai quando o usuário nunca selecionou um modelo (card de confirmação do onboarding gráfico, `provider` configurado sem `model`, `model.default` vazio). É lido somente do cache em tempo de execução (`get_default_model_from_cache`), de modo que os caminhos de resolução críticos nunca acessam a rede; quando não existe manifesto em cache, o Work4You recorre à constante `PREFERRED_SILENT_DEFAULT_MODEL` embutida no repositório, que precisa corresponder à entrada marcada. Isso permite que os mantenedores rotacionem o padrão silencioso sem lançar uma release. É deliberadamente um modelo capaz e de baixo custo, nunca o carro-chefe mais caro.
- **Preço e tamanho de contexto** NÃO estão no manifesto. Eles vêm das APIs ao vivo dos provedores (endpoints `/v1/models`, models.dev) no momento da busca.

## Comportamento de busca

| Quando | O que acontece |
|---|---|
| `/model` ou `work4you model` | Busca se o cache em disco estiver desatualizado, senão usa o cache |
| Cache em disco atualizado (< TTL) | Nenhum acesso à rede |
| Falha de rede com cache | Fallback silencioso para o cache, uma linha de log |
| Falha de rede, sem cache | Fallback silencioso para o snapshot embutido no repositório |
| Manifesto falha na validação do esquema | Tratado como inacessível |

Local do cache: `~/.work4you/cache/model_catalog.json`.

## Configuração

```yaml
model_catalog:
  enabled: true
  url: https://work4you.ai/docs/api/model-catalog.json
  ttl_hours: 1
  providers: {}
```

Defina `enabled: false` para desabilitar completamente a busca remota e sempre usar o snapshot embutido no repositório.

### URLs de sobrescrita por provedor

Terceiros podem hospedar sua própria lista de curadoria usando o mesmo esquema. Aponte um provedor para uma URL personalizada:

```yaml
model_catalog:
  providers:
    openrouter:
      url: https://example.com/my-openrouter-curation.json
```

O manifesto de sobrescrita só precisa preencher o(s) bloco(s) de provedor com que se importa. Os demais provedores continuam a ser resolvidos contra a URL principal.

### Ocultando provedores do seletor

`excluded_providers` permite ocultar provedores específicos do seletor `/model` mesmo quando existem credenciais válidas. Útil quando há credenciais presentes para provedores legados ou de teste que não devem aparecer em uso normal (por exemplo, um token antigo do Copilot ou do OpenRouter ainda em cache no `auth.json` ou descoberto via a CLI `gh`).

```yaml
model_catalog:
  excluded_providers:
    - copilot
    - openrouter
    - openai
```

A exclusão é comparada sem diferenciar maiúsculas de minúsculas contra cada chave sob a qual um provedor pode aparecer — o id do Work4You e o id do models.dev (provedores mapeados nativamente), o pid de overlay e o slug Work4You resolvido (provedores de overlay), e o slug canônico (provedores canônicos) — assim, uma única entrada como `copilot` oculta o provedor independentemente de qual seção o exponha. Isso é respeitado por toda superfície do seletor `/model`: os seletores interativo/texto do gateway, o seletor da TUI e o seletor interativo da CLI `work4you model`. Uma lista vazia (ou a omissão da chave) não tem efeito.

## Atualizando o manifesto

Mantenedores:

```bash
# Regenera a partir das listas fixas embutidas no repositório (mantém o manifesto
# sincronizado depois de editar OPENROUTER_MODELS ou _PROVIDER_MODELS["work4you"]
# em work4you_cli/models.py).
python scripts/build_model_catalog.py
```

Em seguida, abra um PR com a alteração resultante em `website/static/api/model-catalog.json` para a `main`. O site de documentação faz o deploy automaticamente após o merge e o novo manifesto fica disponível em poucos minutos.

Você também pode editar o JSON manualmente para mudanças de metadados de granularidade fina que não pertencem ao snapshot embutido no repositório — o script gerador é uma conveniência, não a única fonte de verdade.

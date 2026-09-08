---
sidebar_position: 3
title: "Escopo Gerenciado"
description: "Configuração e segredos fixados pelo administrador e imutáveis para o usuário, via um diretório gerenciado em nível de sistema"
---

# Escopo Gerenciado

O **escopo gerenciado** permite que um administrador imponha uma base de configuração e
segredos que um usuário padrão (não root) **não pode sobrescrever**. É destinado a
implantações de frota/organização em que a área de TI precisa fixar, por exemplo, o provedor de modelo, uma
URL base de API compartilhada, ou `security.redact_secrets: true` em todos os usuários de
uma máquina.

Quando um escopo gerenciado está presente, os valores que ele especifica vencem o `~/.work4you/config.yaml`
do usuário, o `~/.work4you/.env` e até mesmo o ambiente do shell — exatamente para as
chaves que ele fixa. Tudo o mais permanece totalmente sob controle do usuário.

:::note Diferente de uma instalação bloqueada por gerenciador de pacotes
Uma instalação gerenciada por gerenciador de pacotes (declarative-distro / formula) bloqueia *toda*
mutação de configuração e instrui você a usar seu gerenciador de pacotes. O escopo gerenciado é um
mecanismo separado: ele injeta *valores imutáveis específicos* chave por chave,
em vez de bloquear toda a configuração. Os dois são independentes e podem coexistir.
:::

## Onde fica

O escopo gerenciado é lido de um diretório em nível de sistema, por padrão `/etc/work4you`:

```text
/etc/work4you/
├── config.yaml     # managed config layer (wins over ~/.work4you/config.yaml)
└── .env            # managed env layer (wins over ~/.work4you/.env + shell)
```

O diretório e os arquivos pertencem a `root` (modo de diretório `0755`, arquivos
`0644`): legíveis por todos, graváveis apenas por um administrador. **Essa
permissão de sistema de arquivos é o mecanismo de aplicação** — um usuário padrão pode ler
os arquivos gerenciados, mas não pode editá-los.

Cada arquivo é opcional. Um diretório gerenciado ausente ou um arquivo ausente simplesmente
significa "sem escopo gerenciado", e a configuração é resolvida exatamente como seria sem
o recurso.

### Realocando o diretório

O local pode ser realocado com a variável de ambiente `WORK4YOU_MANAGED_DIR`
(para contêineres ou implantações fora de `/etc`). Este é um controle de caminho de implantação/bootstrap
— assim como `WORK4YOU_HOME` — definido pelo mesmo administrador que possui os arquivos
gerenciados. Ele **nunca é persistido** em nenhum `.env` pelo Work4You.

```bash
# Point managed scope at a custom directory (set by IT / the deployment, not the user)
export WORK4YOU_MANAGED_DIR=/opt/org/work4you-policy
```

:::warning
Um usuário que consegue definir `WORK4YOU_MANAGED_DIR` pode redirecionar o escopo gerenciado para um diretório
que controla, anulando-o. Em uma implantação real, essa variável deve ser fixada
pelo administrador (por exemplo, embutida na unidade de serviço / imagem do contêiner), não
deixada configurável pelo usuário. `work4you doctor` reporta o diretório gerenciado *resolvido*,
para que um redirecionamento fique visível.
:::

## Precedência

Para as chaves que uma camada gerenciada especifica, a ordem é (a mais alta vence):

| Camada | config.yaml | .env |
|---|---|---|
| 1 | `/etc/work4you/config.yaml` (gerenciado) | `/etc/work4you/.env` (gerenciado) |
| 2 | `~/.work4you/config.yaml` (usuário) | `~/.work4you/.env` (usuário) |
| 3 | padrões embutidos | ambiente de shell pré-existente |

A mesclagem é feita **no nível de folha**: fixar `model.default` não congela o resto de
`model.*`. Um `config.yaml` gerenciado como:

```yaml
model:
  default: org/standard-model
```

força `model.default` para todo usuário, deixando `model.fallback` (e qualquer
outra chave) sob controle do usuário.

:::note Nota de precedência
Para as chaves que fixa, o escopo gerenciado deliberadamente vence até mesmo o ambiente do shell —
caso contrário, não seria "gerenciado". Este é o único lugar que inverte a
regra usual de que "uma variável de ambiente sobrescreve o config.yaml", e isso se aplica apenas
às chaves específicas que a camada gerenciada especifica.
:::

## Vendo o que é gerenciado

```bash
work4you config        # shows a header naming the managed source + the pinned keys
work4you doctor        # reports the resolved managed dir + pinned key counts
```

Se você tentar alterar um valor gerenciado, o Work4You recusa e nomeia a fonte:

```bash
$ work4you config set model.default my/model
Cannot set 'model.default': it is managed by your administrator
(/etc/work4you/config.yaml) and cannot be changed.
```

O mesmo se aplica a segredos gerenciados — `work4you config set` / setup não vai escrever
um valor de usuário para uma chave de ambiente fixada pelo `.env` gerenciado.

## Configurando um escopo gerenciado (administradores)

```bash
sudo mkdir -p /etc/work4you

# Pin some config values for every user on this machine
sudo tee /etc/work4you/config.yaml >/dev/null <<'YAML'
model:
  provider: work4you
security:
  redact_secrets: true
YAML

# Optionally pin a shared, non-sensitive env value
sudo tee /etc/work4you/.env >/dev/null <<'ENV'
OPENAI_API_BASE=https://inference.example.com/v1
ENV

sudo chmod 0755 /etc/work4you
sudo chmod 0644 /etc/work4you/config.yaml /etc/work4you/.env
```

As mudanças entram em vigor na próxima inicialização do Work4You (um arquivo gerenciado malformado é registrado
de forma bem visível e ignorado — nunca bloqueia a inicialização, mas o administrador deve verificar
`work4you doctor` para confirmar que a política está sendo aplicada).

## Modelo de segurança e limitações (v1)

- **A aplicação é feita apenas por permissões de sistema de arquivos.** Se um usuário tiver acesso de gravação ao
  diretório gerenciado (ou executar o Work4You como `root`), o escopo gerenciado é apenas consultivo.
- **O `.env` gerenciado é legível por todo o sistema** (`0644`), então qualquer usuário local pode ler
  segredos enviados por meio dele. Use-o para valores compartilhados e não sensíveis (uma URL base de API
  organizacional, padrões de recurso), em vez de segredos altamente sensíveis.
- **As próprias ferramentas do agente não são bloqueadas de forma rígida contra um valor de *env* gerenciado.** Uma
  variável de ambiente gerenciada é aplicada na inicialização, mas nada impede que o
  agente defina um valor diferente dentro do seu próprio shell de subprocesso. A v1 é uma barreira
  de conveniência de gerenciamento contra um usuário normal, não um sandbox inescapável.

O seguinte está intencionalmente **fora do escopo da v1** e pode vir depois:

- Uma barreira rígida que o próprio agente não consegue escapar.
- Locais gerenciados nativos no macOS e Windows (a v1 é focada em Linux/POSIX primeiro).
- Diretórios de fragmentos drop-in (`managed.d/`) para políticas em camadas.
- Arquivos gerenciados assinados / com verificação de integridade.
- Entrega remota / por gerenciamento de dispositivos (MDM).
- Permissões mais restritas (por grupo) para segredos gerenciados.

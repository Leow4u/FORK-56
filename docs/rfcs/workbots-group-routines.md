# Rotinas para grupos do WorkBots — plano para retomada

**Status:** proposta adiada, registrada em PR draft a pedido do utilizador.
**Data do estudo:** 8 de outubro de 2026.
**Escopo deste documento:** diagnóstico, reaproveitamento possível e etapas de
implementação. Nenhuma funcionalidade, regra de execução ou configuração é
alterada por este PR. As decisões indicadas como pendentes continuam abertas.

## Problema e resultado desejado

Ao abrir um chat em grupo, o painel de tarefas agendadas continua mostrando um
agente individual. Criar uma rotina ali agenda uma tarefa para esse agente;
não agenda uma conversa entre os participantes do grupo.

A proposta para uma implementação futura é associar a rotina ao grupo. No
horário definido, suas instruções seriam registradas como uma atividade
agendada naquela conversa, processadas pelos participantes e acompanhadas no
mesmo histórico usado pela conversa manual.

## Evidências verificadas

O fork foi examinado em
[`1948cd07`](https://github.com/Leow4u/FORK-56/commit/1948cd071884b70329113170135584f2136648a7).
No [plugin WorkBots](../../apps/desktop/src/plugins/work4you-bots/plugin.js):

- `RoutinesPane` resolve um perfil individual e `CreateRoutineDialog` envia
  `profile`, nome, instruções, agendamento, limite e continuidade a `cron.manage`.
  Não envia a identidade nem os participantes de um grupo.
- `sendToGroupChat` e `runGroupChatRounds` coordenam a conversa coletiva no
  renderer. O estado do grupo é mantido e persistido por `updateGroupChat`.
- O painel de rotinas acompanha a visibilidade do WorkBots, o que explica sua
  presença ao lado de uma conversa em grupo sem oferecer agendamento coletivo.

O upstream foi examinado em
[`08165d58`](https://github.com/NousResearch/hermes-agent/commit/08165d58931841cee713468ae89032af7c57060a).
As referências abaixo são fixadas nesse commit; precisam ser reavaliadas quando
este trabalho for retomado.

| Componente upstream | O que existe | Limite relevante |
| --- | --- | --- |
| [`HostedRoomService`](https://github.com/NousResearch/hermes-agent/blob/08165d58931841cee713468ae89032af7c57060a/tui_gateway/hosted_room_service.py) e [`groups.*`](https://github.com/NousResearch/hermes-agent/blob/08165d58931841cee713468ae89032af7c57060a/tui_gateway/methods_groups.py) | Identidade persistente, mensagens e processamento de grupos no backend; `groups.send` registra a mensagem e acorda o serviço. | Essa infraestrutura não está no fork analisado. Sua ligação com os grupos atuais do desktop precisa ser demonstrada. |
| [`CreateRoutineDialog`](https://github.com/NousResearch/hermes-agent/blob/08165d58931841cee713468ae89032af7c57060a/apps/desktop/src/plugins/hermes-bots/cron.tsx) | Rotinas por agente, com destino no histórico ou no Bot Chat individual. | Não oferece grupo como alvo da rotina. A entrega ao Bot Chat não é pré-requisito para esta proposta. |
| [`group-external-writes.ts`](https://github.com/NousResearch/hermes-agent/blob/08165d58931841cee713468ae89032af7c57060a/apps/desktop/src/plugins/hermes-bots/group-external-writes.ts) | Reflete determinadas mensagens externas das sessões dos participantes no histórico do grupo. | Possui filtros e cursores; não garante refletir qualquer relatório de cron nem inicia, por si só, uma discussão agendada. |

Há componentes aproveitáveis, mas não foi encontrada uma integração pronta
entre o agendador e o grupo do WorkBots. Adicionar um seletor à UI não completa
essa integração.

## Sequência proposta de implementação

### PR 1 — Base de grupos no backend e integração com o desktop

1. Atualizar o diagnóstico contra as versões vigentes do fork e do upstream.
2. Mapear dependências de armazenamento, sessões, transporte e ciclo de vida
   do serviço de grupos antes de definir o recorte a incorporar.
3. Reaproveitar os componentes e testes upstream necessários, preservando
   autoria, sem trazer mudanças não relacionadas de toda a `main`.
4. Conectar o grupo exibido no desktop à mesma identidade, participantes e
   histórico gerenciados no backend. Evitar dois motores processando a mesma
   mensagem ou dois históricos divergentes.
5. Demonstrar o envio pelo backend iniciando uma conversa no mesmo grupo
   mostrado pelo WorkBots, com a tela da conversa fechada.

**Primeiro marco:** prova de integração ponta a ponta. O tamanho da incorporação
e a compatibilidade com o modelo atual de sessões só podem ser confirmados
após esse mapeamento; não se presume que copiar dois arquivos seja suficiente.

### PR 2 — Disparo de uma rotina no grupo

1. Reutilizar o agendador existente para frequência, horário, pausa, retomada,
   limite de execuções e controle dos disparos.
2. Associar a rotina a uma identidade estável do grupo e ao serviço responsável,
   sem depender do nome apresentado ou do último perfil selecionado no desktop.
3. Conectar o disparo ao envio das instruções para o grupo. A proposta é evitar
   uma chamada adicional de IA apenas para preparar esse envio.
4. Correlacionar cada disparo com sua atividade no grupo e reutilizar as
   proteções existentes contra duplicação nas novas fronteiras de integração.
5. Distinguir aceitação do envio, processamento coletivo e resultado final,
   incluindo falhas que ocorram depois de o envio ter sido aceito.
6. Integrar a continuidade depois de definir o que representa o resultado de
   uma execução coletiva e como ele entra na próxima execução da mesma rotina.

**Marco:** uma rotina criada para um grupo inicia a atividade no destino
correto, com acompanhamento do resultado e sem disparo duplicado em uma
reconexão ou repetição de tentativa.

### PR 3 — Painel contextual e criação de rotina

1. Fazer o painel identificar o contexto aberto: agente individual ou grupo.
2. Listar e criar rotinas vinculadas a esse contexto, com identificação clara
   do proprietário e sem encaminhamento silencioso ao agente anterior.
3. Reaproveitar o modal compacto discutido para WorkBots, exibindo nome e
   avatares do grupo quando aplicável. Limite e continuidade devem permanecer
   visíveis, conforme a preferência visual aprovada.
4. Reutilizar componentes, estilos e traduções existentes, e apresentar os
   estados de execução produzidos pela integração.

**Marco:** a interface permite criar e acompanhar uma rotina do grupo e
continua funcionando corretamente nas conversas individuais.

## Decisões pendentes para a retomada

- Como relacionar os grupos atuais do renderer às identidades do backend,
  incluindo grupos com participantes de outras conexões.
- Onde a rotina do grupo será armazenada e qual serviço será responsável por
  dispará-la, preservando isolamento entre perfis e conexões.
- Como identificar a origem agendada da mensagem sem apresentá-la como uma
  nova mensagem manual do utilizador. O contrato de `groups.send` deve ser
  avaliado para esse uso; não se pressupõe que sua autoria atual seja adequada.
- O que caracteriza conclusão da atividade coletiva e resultado anterior para
  continuidade; a contagem do limite não pode confundir envio com conclusão.
- O comportamento quando já houver uma atividade em execução, quando membros
  forem alterados ou estiverem indisponíveis, e quando o grupo for excluído.

Esses pontos são parte do desenho futuro, não políticas introduzidas por este
documento. Também não está prevista uma migração ampla de utilizadores em
produção: o contexto informado é de testers com rotinas superficiais.

## Validação prevista

- Fluxo real com agendador, serviço de grupos e pelo menos dois agentes,
  usando ambiente de teste isolado.
- Correlação entre rotina, disparo, grupo, participantes e histórico.
- Reenvio, reconexão e reinício sem duplicação da mesma atividade.
- Execução com a conversa fechada e posterior exibição do resultado no desktop.
- Pausa, retomada, limite, continuidade e frequências já disponíveis.
- Grupo renomeado ou excluído, mudança de participantes, indisponibilidade e
  rotas locais/remotas suportadas; sem redirecionamento para outro perfil.
- Regressão das conversas manuais e das rotinas individuais.
- Comportamento nas plataformas desktop suportadas, incluindo Windows.

## Limites desta proposta

A execução depende do serviço responsável estar em funcionamento. Inicialização
automática dos serviços com a plataforma, despertar de perfis e disponibilidade
contínua pertencem ao trabalho de infraestrutura anteriormente adiado; este
plano não promete resolver esses aspectos nem iniciar todos os backends.

O polimento visual do formulário de rotinas do WorkBots é um trabalho separado.
Este draft não implementa esse visual, não oculta o painel nos grupos e não
altera os modais de criação de agentes ou a tela principal de Rotinas.

Para retomar, revisar primeiro as evidências e as dependências do PR 1, fechar
as decisões pendentes e então atualizar este plano com o escopo concreto dos
PRs de implementação.

// @ts-nocheck — extracted from the desktop locales (apps/desktop/src/i18n/<locale>.ts).
// The chat transcript is a parity port of the desktop's, so its lines read from
// the desktop catalog. ``desktopSections`` carries the English one for every
// locale; these are the locales the desktop also speaks, deep-merged over it in
// ``resolveTranslations`` so a missing key still falls back to English.
export const desktopSectionsByLocale = {
  pt: {
    assistant: {
    thread: {
      loadingSession: 'Carregando sessão',
      showEarlier: 'Mostrar mensagens anteriores',
      loadingResponse: 'O Work4You está carregando uma resposta',
      working: 'O Work4You está trabalhando',
      summarizingThread: 'Resumindo a conversa',
      resumeWhenBackgroundDone: count =>
        count === 1
          ? 'Continua quando a tarefa em segundo plano terminar'
          : `Continua quando ${count} tarefas em segundo plano terminarem`,
      thinking: 'Pensando',
      thought: 'Pensou',
      thoughtBriefly: 'Pensou rapidamente',
      thoughtFor: duration => `Pensou por ${duration}`,
      worked: 'Trabalhou',
      workedFor: duration => `Trabalhou por ${duration}`,
      turnDuration: duration => `Este turno levou ${duration}`,
      writing: 'Escrevendo',
      stepOf: (step, total) => `Etapa ${step} de ${total}`,
      thoughtAbout: title => `Pensamento · ${title}`,
      today: time => `Hoje, ${time}`,
      yesterday: time => `Ontem, ${time}`,
      copy: 'Copiar',
      refresh: 'Gerar novamente',
      moreActions: 'Mais ações',
      branchNewChat: 'Ramificar em nova conversa',
      react: 'Reagir',
      dismissError: 'Dispensar erro',
      filesChanged: count => (count === 1 ? 'Editou 1 arquivo' : `Editou ${count} arquivos`),
      reviewChanges: 'Revisar',
      readAloudFailed: 'Falha ao ler em voz alta',
      preparingAudio: 'Preparando áudio...',
      stopReading: 'Parar leitura',
      readAloud: 'Ler em voz alta',
      editMessage: 'Editar mensagem',
      expandMessage: 'Expandir mensagem',
      scrollToBottom: 'Rolar até o fim',
      stop: 'Parar',
      restorePrevious: 'Restaurar checkpoint anterior',
      restoreCheckpoint: 'Restaurar checkpoint',
      restoreFromHere: 'Restaurar checkpoint — executar de novo a partir deste prompt',
      restoreTitle: 'Restaurar este checkpoint?',
      restoreBody:
        'Tudo o que vem depois deste prompt será removido da conversa, e o prompt será executado de novo a partir daqui.',
      restoreConfirm: 'Restaurar e reexecutar',
      restoreNext: 'Restaurar próximo checkpoint',
      goForward: 'Avançar',
      sendEdited: 'Enviar mensagem editada',
      attachingFile: 'Anexando…'
    },
    notices: {
      steered: 'direcionou',
      repliedTo: name => `Respondeu a ${name}`,
      showReply: 'ver resposta',
      messaging: name => `Enviando mensagem para ${name}…`,
      messaged: name => `Mensagem enviada para ${name}`,
      messageFrom: name => `Mensagem de ${name}`,
      showMessage: 'ver mensagem',
      output: 'saída'
    },
    approval: {
      gatewayDisconnected: 'O gateway do Work4You não está conectado',
      sendFailed: 'Não foi possível enviar a resposta de aprovação',
      title: 'Permitir este comando?',
      allow: 'Permitir',
      notNow: 'Agora não',
      more: 'Mais',
      moreOptions: 'Mais opções de aprovação',
      allowSession: 'Permitir nesta sessão',
      alwaysAllowMenu: 'Sempre permitir…',
      jumpToApproval: 'Aprovação necessária',
      alwaysTitle: 'Sempre permitir este comando?',
      alwaysDescription: pattern =>
        `Isso adiciona o padrão “${pattern}” à sua lista de permissões permanente (~/.work4you/config.yaml). O Work4You não vai perguntar de novo sobre comandos como este — nem nesta sessão nem em nenhuma futura.`,
      alwaysAllow: 'Sempre permitir'
    },
    clarify: {
      notReady: 'O pedido de esclarecimento ainda não está pronto',
      gatewayDisconnected: 'O gateway do Work4You não está conectado',
      sendFailed: 'Não foi possível enviar a resposta de esclarecimento',
      loadingQuestion: 'Carregando pergunta…',
      other: 'Outra (digite sua resposta)',
      placeholder: 'Digite sua resposta…',
      skip: 'Pular',
      skipped: 'Pulada',
      continueLabel: 'Continuar',
      confirmAndContinueLabel: 'Confirmar e continuar',
      answeredBadge: 'Respondida',
      questionProgress: (answered, total) => `Respondidas: ${answered} de ${total}`,
      lateAnswer: (question, choice) => `Sobre "${question}" — minha resposta: ${choice}`,
      lateAnswerTip: 'Criar rascunho de nova mensagem com esta resposta',
      lateAnswerHint:
        'Esta pergunta não está mais aguardando. Escolha uma opção para criar um rascunho de nova mensagem com a resposta.'
    },
    mcpSetup: {
      installTitle: server => `Adicionar o servidor MCP ${server}?`,
      enableTitle: server => `Ativar o servidor MCP ${server}?`,
      authorizeTitle: server => `Autorizar o servidor MCP ${server}?`,
      connectTitle: server => `Conectar ${server}?`,
      installAction: 'Instalar',
      enableAction: 'Ativar',
      authorizeAction: 'Autorizar',
      connectAction: 'Conectar',
      helpersHeader: 'Conectores que podem ajudar',
      decline: 'Agora não',
      declined: 'Recusado',
      installed: server => `${server} instalado`,
      enabled: server => `${server} ativado`,
      authorized: server => `${server} autorizado`,
      failed: server => `Falha na configuração de ${server}`,
      unanswered: 'Sem resposta',
      toolCount: count => (count === 1 ? '1 ferramenta' : `${count} ferramentas`),
      notInCatalog: server => `“${server}” não está no catálogo MCP`,
      catalogSource: 'Do catálogo aprovado pelo Work4You',
      work4youAppsSource: 'Work4You Apps',
      loginRequired: 'Entre no Work4You para conectar este app',
      envRequired: 'Preencha as credenciais obrigatórias primeiro',
      sendFailed: 'Não foi possível enviar a resposta de configuração do MCP',
      reloadFailed:
        'Servidor salvo, mas houve falha ao recarregar as ferramentas MCP — elas serão carregadas na próxima sessão',
      gatewayDisconnected: 'O gateway do Work4You não está conectado'
    },
    tool: {
      copyCode: 'Copiar código',
      renderingImage: 'Renderizando imagem',
      copyOutput: 'Copiar saída',
      copyCommand: 'Copiar comando',
      copyContent: 'Copiar conteúdo',
      copyUrl: 'Copiar URL',
      copyResults: 'Copiar resultados',
      copyQuery: 'Copiar consulta',
      copyFile: 'Copiar arquivo',
      copyPath: 'Copiar caminho',
      outputAlt: 'Saída da ferramenta',
      rawResponse: 'Resposta bruta',
      copyActivity: 'Copiar atividade',
      recoveredOne: 'Recuperado após 1 etapa com falha',
      recoveredMany: count => `Recuperado após ${count} etapas com falha`,
      failedOne: '1 etapa falhou',
      failedMany: count => `${count} etapas falharam`,
      statusRunning: 'Executando',
      statusError: 'Erro',
      statusRecovered: 'Recuperado',
      statusDone: 'Concluído',
      memoryWriteNoted: 'Tentativa de gravar na memória',
      actions: {
        read: 'Leu',
        reading: 'Lendo',
        opened: 'Abriu',
        opening: 'Abrindo',
        failedToOpen: 'Falha ao abrir',
        searched: 'Buscou',
        searching: 'Buscando',
        ran: 'Executou',
        running: 'Executando',
        ranCode: 'Executou código',
        runningCode: 'Executando código'
      },
      prefixes: {
        browser: 'Navegador',
        web: 'Web'
      },
      titleTemplates: {
        actionCommand: (action, command) => `${action} ${command}`,
        actionQuoted: (action, value) => `${action} “${value}”`,
        actionTarget: (action, target) => `${action} ${target}`,
        prefixedDone: (prefix, action) => `${prefix}: ${action}`,
        runningPrefixedTool: (prefix, action) => `Executando ${action.toLowerCase()} (${prefix.toLowerCase()})`,
        runningTool: action => `Executando ${action.toLowerCase()}`
      },
      searchResults: 'Resultados da busca',
      detailLabels: { details: 'Detalhes', errorDetails: 'Detalhes do erro', snapshotSummary: 'Resumo da captura' },
      countNouns: {
        document: count => (count === 1 ? '1 documento' : `${count} documentos`),
        file: count => (count === 1 ? '1 arquivo' : `${count} arquivos`),
        item: count => (count === 1 ? '1 item' : `${count} itens`),
        match: count => (count === 1 ? '1 ocorrência' : `${count} ocorrências`),
        result: count => (count === 1 ? '1 resultado' : `${count} resultados`),
        row: count => (count === 1 ? '1 linha' : `${count} linhas`),
        search: count => (count === 1 ? '1 busca' : `${count} buscas`),
        source: count => (count === 1 ? '1 fonte' : `${count} fontes`),
        step: count => (count === 1 ? '1 etapa' : `${count} etapas`),
        todo: count => (count === 1 ? '1 tarefa' : `${count} tarefas`)
      },
      runSummary: {
        categories: {
          create: {
            count: count => (count === 1 ? '1 arquivo' : `${count} arquivos`),
            past: 'Criou',
            present: 'Criando'
          },
          delegate: {
            count: count => (count === 1 ? '1 tarefa' : `${count} tarefas`),
            past: 'Delegou',
            present: 'Delegando'
          },
          edit: {
            count: count => (count === 1 ? '1 arquivo' : `${count} arquivos`),
            past: 'Editou',
            present: 'Editando'
          },
          explore: {
            count: count => (count === 1 ? '1 arquivo' : `${count} arquivos`),
            past: 'Explorou',
            present: 'Explorando'
          },
          other: {
            count: count => (count === 1 ? '1 ferramenta' : `${count} ferramentas`),
            past: 'Usou',
            present: 'Usando'
          },
          run: {
            count: count => (count === 1 ? '1 comando' : `${count} comandos`),
            past: 'Executou',
            present: 'Executando'
          }
        },
        clause: (verb, object) => `${verb} ${object}`,
        repeated: (action, count) => `${action} ${count} vezes`,
        separator: ', '
      },
      titles: {
        apply_layout: { done: 'Aplicou o layout', pending: 'Aplicando o layout', pendingAction: 'Aplicando' },
        browser_back: { done: 'Voltou uma página', pending: 'Voltando uma página', pendingAction: 'Voltando' },
        browser_cdp: {
          done: 'Enviou comando ao navegador',
          pending: 'Enviando comando ao navegador',
          pendingAction: 'Enviando'
        },
        browser_click: {
          done: 'Clicou em elemento da página',
          pending: 'Clicando em elemento da página',
          pendingAction: 'Clicando'
        },
        browser_console: {
          done: 'Leu o console do navegador',
          pending: 'Lendo o console do navegador',
          pendingAction: 'Lendo'
        },
        browser_dialog: {
          done: 'Respondeu a um diálogo da página',
          pending: 'Respondendo a um diálogo da página',
          pendingAction: 'Respondendo'
        },
        browser_exec: {
          done: 'Executou script na página',
          pending: 'Executando script na página',
          pendingAction: 'Executando'
        },
        browser_fill: {
          done: 'Preencheu campo de formulário',
          pending: 'Preenchendo campo de formulário',
          pendingAction: 'Preenchendo'
        },
        browser_get_images: {
          done: 'Listou imagens da página',
          pending: 'Listando imagens da página',
          pendingAction: 'Listando'
        },
        browser_navigate: { done: 'Abriu página', pending: 'Abrindo página', pendingAction: 'Abrindo' },
        browser_press: {
          done: 'Pressionou uma tecla',
          pending: 'Pressionando uma tecla',
          pendingAction: 'Pressionando'
        },
        browser_scroll: { done: 'Rolou a página', pending: 'Rolando a página', pendingAction: 'Rolando' },
        browser_snapshot: {
          done: 'Capturou snapshot da página',
          pending: 'Capturando snapshot da página',
          pendingAction: 'Capturando'
        },
        browser_take_screenshot: {
          done: 'Capturou a tela',
          pending: 'Capturando a tela',
          pendingAction: 'Capturando'
        },
        browser_type: { done: 'Digitou na página', pending: 'Digitando na página', pendingAction: 'Digitando' },
        browser_vision: { done: 'Olhou a página', pending: 'Olhando a página', pendingAction: 'Olhando' },
        clarify: { done: 'Fez uma pergunta', pending: 'Fazendo uma pergunta', pendingAction: 'Fazendo' },
        close_preview: { done: 'Fechou o preview', pending: 'Fechando o preview', pendingAction: 'Fechando' },
        close_terminal: { done: 'Fechou o terminal', pending: 'Fechando o terminal', pendingAction: 'Fechando' },
        computer_use: { done: 'Usou o computador', pending: 'Usando o computador', pendingAction: 'Usando' },
        cronjob: { done: 'Tarefa agendada', pending: 'Agendando tarefa', pendingAction: 'Agendando' },
        drive_preview: { done: 'Usou o preview', pending: 'Usando o preview', pendingAction: 'Usando' },
        edit_file: { done: 'Editou arquivo', pending: 'Editando arquivo', pendingAction: 'Editando' },
        execute_code: { done: 'Executou código', pending: 'Executando código', pendingAction: 'Executando código' },
        focus_pane: { done: 'Mostrou um painel', pending: 'Mostrando um painel', pendingAction: 'Mostrando' },
        image_generate: { done: 'Gerou imagem', pending: 'Gerando imagem', pendingAction: 'Gerando' },
        list_files: { done: 'Listou arquivos', pending: 'Listando arquivos', pendingAction: 'Listando' },
        memory: { done: 'Salvou na memória', pending: 'Salvando na memória', pendingAction: 'Salvando' },
        open_preview: { done: 'Abriu o preview', pending: 'Abrindo o preview', pendingAction: 'Abrindo' },
        patch: { done: 'Alterou arquivo', pending: 'Alterando arquivo', pendingAction: 'Alterando' },
        process: {
          done: 'Verificou processo em segundo plano',
          pending: 'Verificando processo em segundo plano',
          pendingAction: 'Verificando'
        },
        project_create: { done: 'Criou projeto', pending: 'Criando projeto', pendingAction: 'Criando' },
        project_list: { done: 'Listou projetos', pending: 'Listando projetos', pendingAction: 'Listando' },
        project_switch: { done: 'Trocou de projeto', pending: 'Trocando de projeto', pendingAction: 'Trocando' },
        read_file: { done: 'Leu arquivo', pending: 'Lendo arquivo', pendingAction: 'Lendo' },
        read_preview: { done: 'Leu o preview', pending: 'Lendo o preview', pendingAction: 'Lendo' },
        read_terminal: { done: 'Leu o terminal', pending: 'Lendo o terminal', pendingAction: 'Lendo' },
        read_window_below: {
          done: 'Verificou a janela atrás',
          pending: 'Verificando a janela atrás',
          pendingAction: 'Verificando'
        },
        search_files: { done: 'Buscou nos arquivos', pending: 'Buscando nos arquivos', pendingAction: 'Buscando' },
        session_search: {
          done: 'Buscou em sessões anteriores',
          pending: 'Buscando em sessões anteriores',
          pendingAction: 'Buscando'
        },
        session_search_recall: {
          done: 'Buscou no histórico de sessões',
          pending: 'Buscando no histórico de sessões',
          pendingAction: 'Buscando'
        },
        skill_manage: { done: 'Atualizou skill', pending: 'Atualizando skill', pendingAction: 'Atualizando' },
        skill_view: { done: 'Leu skill', pending: 'Lendo skill', pendingAction: 'Lendo' },
        skills_list: { done: 'Listou skills', pending: 'Listando skills', pendingAction: 'Listando' },
        terminal: { done: 'Executou comando', pending: 'Executando comando', pendingAction: 'Executando' },
        text_to_speech: { done: 'Gerou áudio', pending: 'Gerando áudio', pendingAction: 'Gerando' },
        todo: {
          done: 'Atualizou a lista de tarefas',
          pending: 'Atualizando a lista de tarefas',
          pendingAction: 'Atualizando'
        },
        tool_call: { done: 'Usou uma ferramenta', pending: 'Usando uma ferramenta', pendingAction: 'Usando' },
        tool_describe: {
          done: 'Leu detalhes da ferramenta',
          pending: 'Lendo detalhes da ferramenta',
          pendingAction: 'Lendo'
        },
        tool_search: { done: 'Buscou ferramentas', pending: 'Buscando ferramentas', pendingAction: 'Buscando' },
        tour: { done: 'Mostrou um tour', pending: 'Mostrando um tour', pendingAction: 'Mostrando' },
        video_analyze: { done: 'Analisou vídeo', pending: 'Analisando vídeo', pendingAction: 'Analisando' },
        video_generate: { done: 'Gerou vídeo', pending: 'Gerando vídeo', pendingAction: 'Gerando' },
        vision_analyze: { done: 'Analisou imagem', pending: 'Analisando imagem', pendingAction: 'Analisando' },
        web_extract: { done: 'Leu página da web', pending: 'Lendo página da web', pendingAction: 'Lendo' },
        web_search: { done: 'Buscou na web', pending: 'Buscando na web', pendingAction: 'Buscando' },
        write_file: { done: 'Escreveu arquivo', pending: 'Escrevendo arquivo', pendingAction: 'Escrevendo' }
      }
    }
  },
    settings: {
      appearance: {
      activityDensityTitle: 'Detalhe da atividade',
      activityDensityDesc: 'Quanto do trabalho do agente o chat mostra enquanto ele trabalha e depois que termina. Perguntas, aprovações e arquivos alterados sempre ficam na tela.',
      activityDensityCompact: 'Compacto',
      activityDensityBalanced: 'Equilibrado',
      activityDensityDetailed: 'Detalhado'
      }
    }
  },
  ja: {
    assistant: {
    thread: {
      loadingSession: 'セッションを読み込み中',
      showEarlier: '以前のメッセージを表示',
      loadingResponse: 'Work4You が応答を読み込み中',
      working: 'Work4You が作業中',
      summarizingThread: 'スレッドを要約中',
      resumeWhenBackgroundDone: count =>
        count === 1
          ? 'バックグラウンドタスクの完了後に再開します'
          : `${count} 件のバックグラウンドタスクの完了後に再開します`,
      thinking: '考え中',
      thought: '思考済み',
      thoughtBriefly: '少し思考',
      thoughtFor: duration => `${duration} 思考`,
      worked: '作業済み',
      workedFor: duration => `${duration} 作業`,
      turnDuration: duration => `このターンの所要時間: ${duration}`,
      writing: '執筆中',
      stepOf: (step, total) => `ステップ ${step}/${total}`,
      thoughtAbout: title => `思考 · ${title}`,
      today: time => `今日 ${time}`,
      yesterday: time => `昨日 ${time}`,
      copy: 'コピー',
      refresh: '更新',
      moreActions: 'その他のアクション',
      branchNewChat: '新しいチャットでブランチ',
      react: 'リアクション',
      dismissError: 'エラーを閉じる',
      filesChanged: count => `${count} 件のファイルを編集`,
      reviewChanges: 'レビュー',
      readAloudFailed: '読み上げに失敗しました',
      preparingAudio: '音声を準備中...',
      stopReading: '読み上げを停止',
      readAloud: '読み上げ',
      editMessage: 'メッセージを編集',
      stop: '停止',
      restorePrevious: '前のチェックポイントに戻す',
      restoreCheckpoint: 'チェックポイントを復元',
      restoreFromHere: 'チェックポイントを復元 — このプロンプトから再実行',
      restoreTitle: 'このチェックポイントに復元しますか？',
      restoreBody: 'このプロンプト以降のメッセージは会話から削除され、ここからプロンプトが再実行されます。',
      restoreConfirm: '復元して再実行',
      restoreNext: '次のチェックポイントに戻す',
      goForward: '進む',
      sendEdited: '編集済みメッセージを送信',
      attachingFile: '添付中…'
    },
    notices: {
      steered: '方向修正',
      repliedTo: name => `${name} に返信`,
      showReply: '返信を表示',
      messaging: name => `${name} にメッセージを送信中…`,
      messaged: name => `${name} にメッセージを送信`,
      messageFrom: name => `${name} からのメッセージ`,
      showMessage: 'メッセージを表示',
      output: '出力'
    },
    approval: {
      gatewayDisconnected: 'Work4You ゲートウェイが接続されていません',
      sendFailed: '承認応答を送信できませんでした',
      title: 'このコマンドを許可しますか？',
      allow: '許可',
      notNow: '今はしない',
      more: 'その他',
      moreOptions: 'その他の承認オプション',
      allowSession: 'このセッションで許可',
      alwaysAllowMenu: '常に許可…',
      jumpToApproval: '承認が必要',
      alwaysTitle: 'このコマンドを常に許可しますか？',
      alwaysDescription: pattern =>
        `これにより "${pattern}" パターンが永続的な許可リスト (~/.work4you/config.yaml) に追加されます。Work4You はこのセッションや将来のセッションで、このようなコマンドについて再度尋ねません。`,
      alwaysAllow: '常に許可'
    },
    clarify: {
      notReady: '明確化リクエストはまだ準備できていません',
      gatewayDisconnected: 'Work4You ゲートウェイが接続されていません',
      sendFailed: '明確化応答を送信できませんでした',
      loadingQuestion: '質問を読み込み中…',
      other: 'その他（回答を入力）',
      placeholder: '回答を入力…',
      skip: 'スキップ',
      skipped: 'スキップ済み',
      continueLabel: '続行',
      confirmAndContinueLabel: '確定して続行',
      answeredBadge: '回答済み',
      questionProgress: (answered, total) => `${total}問中${answered}問回答済み`,
      lateAnswer: (question, choice) => `「${question}」について — 私の回答: ${choice}`,
      lateAnswerTip: 'この回答をフォローアップメッセージとして下書きします',
      lateAnswerHint: 'この質問はもう回答を待っていません。選択肢を選ぶとフォローアップメッセージとして下書きされます。'
    },
    tool: {
      copyCode: 'コードをコピー',
      renderingImage: '画像をレンダリング中',
      copyOutput: '出力をコピー',
      copyCommand: 'コマンドをコピー',
      copyContent: 'コンテンツをコピー',
      copyUrl: 'URL をコピー',
      copyResults: '結果をコピー',
      copyQuery: 'クエリをコピー',
      copyFile: 'ファイルをコピー',
      copyPath: 'パスをコピー',
      outputAlt: 'ツール出力',
      rawResponse: '生の応答',
      copyActivity: 'アクティビティをコピー',
      recoveredOne: '1 つの失敗したステップの後に回復しました',
      recoveredMany: count => `${count} つの失敗したステップの後に回復しました`,
      failedOne: '1 つのステップが失敗しました',
      failedMany: count => `${count} つのステップが失敗しました`,
      statusRunning: '実行中',
      statusError: 'エラー',
      statusRecovered: '回復しました',
      statusDone: '完了',
      memoryWriteNoted: 'メモリへの書き込みを記録',
      actions: {
        read: '読み取り完了',
        reading: '読み取り中',
        opened: 'オープン済み',
        opening: 'オープン中',
        failedToOpen: 'オープン失敗',
        searched: '検索完了',
        searching: '検索中',
        ran: '実行完了',
        running: '実行中',
        ranCode: 'コード実行完了',
        runningCode: 'スクリプト作成中'
      },
      prefixes: {
        browser: 'ブラウザー',
        web: 'Web'
      },
      titleTemplates: {
        actionCommand: (action, command) => `${action} ${command}`,
        actionQuoted: (action, value) => `「${value}」を${action}`,
        actionTarget: (action, target) => `${target} を${action}`,
        prefixedDone: (prefix, action) => `${prefix} ${action}`,
        runningPrefixedTool: (prefix, action) => `${prefix} ${action}を実行中`,
        runningTool: action => `${action}を実行中`
      },
      searchResults: '検索結果',
      detailLabels: { details: '詳細', errorDetails: 'エラーの詳細', snapshotSummary: 'スナップショットの概要' },
      countNouns: {
        document: count => `${count} 件のドキュメント`,
        file: count => `${count} 件のファイル`,
        item: count => `${count} 件の項目`,
        match: count => `${count} 件の一致`,
        result: count => `${count} 件の結果`,
        row: count => `${count} 行`,
        search: count => `${count} 回の検索`,
        source: count => `${count} 件のソース`,
        step: count => `${count} ステップ`,
        todo: count => `${count} 件のToDo`
      },
      runSummary: {
        categories: {
          create: { count: count => `${count} 件のファイル`, past: '作成', present: '作成中' },
          delegate: { count: count => `${count} 件のタスク`, past: '委任', present: '委任中' },
          edit: { count: count => `${count} 件のファイル`, past: '編集', present: '編集中' },
          explore: { count: count => `${count} 件のファイル`, past: '確認', present: '確認中' },
          other: { count: count => `${count} 個のツール`, past: '使用', present: '使用中' },
          run: { count: count => `${count} 件のコマンド`, past: '実行', present: '実行中' }
        },
        clause: (verb, object) => `${object}を${verb}`,
        repeated: (action, count) => `${action}（${count}回）`,
        separator: '、'
      },
      titles: {
        apply_layout: { done: 'レイアウトを適用しました', pending: 'レイアウトを適用中', pendingAction: '適用中' },
        browser_back: { done: '前のページに戻りました', pending: '前のページへ移動中', pendingAction: '移動中' },
        browser_cdp: {
          done: 'ブラウザーコマンドを送信しました',
          pending: 'ブラウザーコマンドを送信中',
          pendingAction: '送信中'
        },
        browser_click: {
          done: 'ページ要素をクリックしました',
          pending: 'ページ要素をクリック中',
          pendingAction: 'クリック中'
        },
        browser_console: {
          done: 'ブラウザーコンソールを読み取りました',
          pending: 'ブラウザーコンソールを読み取り中',
          pendingAction: '読み取り中'
        },
        browser_dialog: {
          done: 'ページのダイアログに応答しました',
          pending: 'ページのダイアログに応答中',
          pendingAction: '応答中'
        },
        browser_exec: {
          done: 'ページスクリプトを実行しました',
          pending: 'ページスクリプトを実行中',
          pendingAction: '実行中'
        },
        browser_fill: { done: 'フォーム欄に入力しました', pending: 'フォーム欄に入力中', pendingAction: '入力中' },
        browser_get_images: {
          done: 'ページの画像を一覧表示しました',
          pending: 'ページの画像を一覧表示中',
          pendingAction: '一覧表示中'
        },
        browser_navigate: { done: 'ページを開きました', pending: 'ページをオープン中', pendingAction: 'オープン中' },
        browser_press: { done: 'キーを押しました', pending: 'キーを押下中', pendingAction: '押下中' },
        browser_scroll: {
          done: 'ページをスクロールしました',
          pending: 'ページをスクロール中',
          pendingAction: 'スクロール中'
        },
        browser_snapshot: {
          done: 'ページスナップショットを取得しました',
          pending: 'ページスナップショットを取得中',
          pendingAction: '取得中'
        },
        browser_take_screenshot: {
          done: 'スクリーンショットを取得しました',
          pending: 'スクリーンショットを取得中',
          pendingAction: '取得中'
        },
        browser_type: { done: 'ページに入力しました', pending: 'ページに入力中', pendingAction: '入力中' },
        browser_vision: { done: 'ページを確認しました', pending: 'ページを確認中', pendingAction: '確認中' },
        clarify: { done: '質問しました', pending: '質問中', pendingAction: '質問中' },
        close_preview: {
          done: 'プレビューを閉じました',
          pending: 'プレビューをクローズ中',
          pendingAction: 'クローズ中'
        },
        close_terminal: {
          done: 'ターミナルを閉じました',
          pending: 'ターミナルをクローズ中',
          pendingAction: 'クローズ中'
        },
        computer_use: {
          done: 'コンピューターを操作しました',
          pending: 'コンピューターを操作中',
          pendingAction: '操作中'
        },
        cronjob: { done: 'Cron ジョブ', pending: 'Cron ジョブをスケジュール中', pendingAction: 'スケジュール中' },
        drive_preview: { done: 'プレビューを操作しました', pending: 'プレビューを操作中', pendingAction: '操作中' },
        edit_file: { done: 'ファイルを編集しました', pending: 'ファイルを編集中', pendingAction: '編集中' },
        execute_code: { done: 'コードを実行しました', pending: 'スクリプト作成中', pendingAction: 'スクリプト作成中' },
        focus_pane: { done: 'ペインを表示しました', pending: 'ペインを表示中', pendingAction: '表示中' },
        image_generate: { done: '画像を生成しました', pending: '画像を生成中', pendingAction: '生成中' },
        list_files: {
          done: 'ファイルを一覧表示しました',
          pending: 'ファイルを一覧表示中',
          pendingAction: '一覧表示中'
        },
        memory: {
          done: 'メモリに保存しました',
          pending: 'メモリに保存中',
          pendingAction: '保存中'
        },
        open_preview: {
          done: 'プレビューを開きました',
          pending: 'プレビューをオープン中',
          pendingAction: 'オープン中'
        },
        patch: {
          done: 'ファイルにパッチを適用しました',
          pending: 'ファイルにパッチ適用中',
          pendingAction: 'パッチ適用中'
        },
        process: {
          done: 'バックグラウンドプロセスを確認しました',
          pending: 'バックグラウンドプロセスを確認中',
          pendingAction: '確認中'
        },
        project_create: {
          done: 'プロジェクトを作成しました',
          pending: 'プロジェクトを作成中',
          pendingAction: '作成中'
        },
        project_list: {
          done: 'プロジェクトを一覧表示しました',
          pending: 'プロジェクトを一覧表示中',
          pendingAction: '一覧表示中'
        },
        project_switch: {
          done: 'プロジェクトを切り替えました',
          pending: 'プロジェクトを切り替え中',
          pendingAction: '切り替え中'
        },
        read_file: { done: 'ファイルを読み取りました', pending: 'ファイルを読み取り中', pendingAction: '読み取り中' },
        read_preview: {
          done: 'プレビューを読み取りました',
          pending: 'プレビューを読み取り中',
          pendingAction: '読み取り中'
        },
        read_terminal: {
          done: 'ターミナルを読み取りました',
          pending: 'ターミナルを読み取り中',
          pendingAction: '読み取り中'
        },
        read_window_below: {
          done: '背後のウィンドウを確認しました',
          pending: '背後のウィンドウを確認中',
          pendingAction: '確認中'
        },
        search_files: { done: 'ファイルを検索しました', pending: 'ファイルを検索中', pendingAction: '検索中' },
        session_search: {
          done: '過去のセッションを検索しました',
          pending: '過去のセッションを検索中',
          pendingAction: '検索中'
        },
        session_search_recall: {
          done: 'セッション履歴を検索しました',
          pending: 'セッション履歴を検索中',
          pendingAction: '検索中'
        },
        skill_manage: { done: 'スキルを更新しました', pending: 'スキルを更新中', pendingAction: '更新中' },
        skill_view: { done: 'スキルを読み取りました', pending: 'スキルを読み取り中', pendingAction: '読み取り中' },
        skills_list: { done: 'スキルを一覧表示しました', pending: 'スキルを一覧表示中', pendingAction: '一覧表示中' },
        terminal: { done: 'コマンドを実行しました', pending: 'コマンドを実行中', pendingAction: '実行中' },
        text_to_speech: { done: '音声を生成しました', pending: '音声を生成中', pendingAction: '生成中' },
        todo: { done: 'Todo を更新しました', pending: 'Todo を更新中', pendingAction: '更新中' },
        tool_call: { done: 'ツールを使用しました', pending: 'ツールを使用中', pendingAction: '使用中' },
        tool_describe: {
          done: 'ツールの詳細を読み取りました',
          pending: 'ツールの詳細を読み取り中',
          pendingAction: '読み取り中'
        },
        tool_search: { done: 'ツールを検索しました', pending: 'ツールを検索中', pendingAction: '検索中' },
        tour: { done: 'ツアーを表示しました', pending: 'ツアーを表示中', pendingAction: '表示中' },
        video_analyze: { done: '動画を分析しました', pending: '動画を分析中', pendingAction: '分析中' },
        video_generate: { done: '動画を生成しました', pending: '動画を生成中', pendingAction: '生成中' },
        vision_analyze: { done: '画像を分析しました', pending: '画像を分析中', pendingAction: '分析中' },
        web_extract: {
          done: 'Web ページを読み取りました',
          pending: 'Web ページを読み取り中',
          pendingAction: '読み取り中'
        },
        web_search: { done: 'Web を検索しました', pending: 'Web を検索中', pendingAction: '検索中' },
        write_file: { done: 'ファイルを書き込みました', pending: 'ファイルを書き込み中', pendingAction: '書き込み中' }
      }
    }
  },
    settings: {
      appearance: {
      activityDensityTitle: 'アクティビティの詳細',
      activityDensityDesc: 'エージェントの作業中と完了後に、チャットに作業内容をどこまで表示するか。質問、承認、変更されたファイルは常に表示されます。',
      activityDensityCompact: 'コンパクト',
      activityDensityBalanced: 'バランス',
      activityDensityDetailed: '詳細'
      }
    }
  },
  zh: {
    assistant: {
    thread: {
      loadingSession: '正在加载会话',
      showEarlier: '显示更早的消息',
      loadingResponse: 'Work4You 正在加载回复',
      working: 'Work4You 正在工作',
      summarizingThread: '正在总结对话',
      resumeWhenBackgroundDone: count =>
        count === 1 ? '后台任务完成后将自动继续' : `${count} 个后台任务完成后将自动继续`,
      thinking: '思考中',
      thought: '已思考',
      thoughtBriefly: '思考了片刻',
      thoughtFor: duration => `思考了 ${duration}`,
      worked: '已完成工作',
      workedFor: duration => `工作了 ${duration}`,
      turnDuration: duration => `本轮耗时 ${duration}`,
      writing: '撰写中',
      stepOf: (step, total) => `第 ${step} 步，共 ${total} 步`,
      thoughtAbout: title => `思考 · ${title}`,
      today: time => `今天，${time}`,
      yesterday: time => `昨天，${time}`,
      copy: '复制',
      refresh: '刷新',
      moreActions: '更多操作',
      branchNewChat: '在新对话中分支',
      react: '回应',
      dismissError: '关闭错误',
      filesChanged: count => `已编辑 ${count} 个文件`,
      reviewChanges: '查看',
      readAloudFailed: '朗读失败',
      preparingAudio: '正在准备音频...',
      stopReading: '停止朗读',
      readAloud: '朗读',
      editMessage: '编辑消息',
      expandMessage: '展开消息',
      scrollToBottom: '滚动到底部',
      stop: '停止',
      restorePrevious: '恢复上一个检查点',
      restoreCheckpoint: '恢复检查点',
      restoreFromHere: '恢复检查点 — 从此提示重新运行',
      restoreTitle: '恢复到此检查点？',
      restoreBody: '此提示之后的所有消息将从对话中移除，并从此处重新运行该提示。',
      restoreConfirm: '恢复并重新运行',
      restoreNext: '恢复下一个检查点',
      goForward: '前进',
      sendEdited: '发送编辑后的消息',
      attachingFile: '正在附加…'
    },
    notices: {
      steered: '已转向',
      repliedTo: name => `已回复 ${name}`,
      showReply: '查看回复',
      messaging: name => `正在给 ${name} 发消息…`,
      messaged: name => `已给 ${name} 发消息`,
      messageFrom: name => `来自 ${name} 的消息`,
      showMessage: '查看消息',
      output: '输出'
    },
    approval: {
      gatewayDisconnected: 'Work4You 网关未连接',
      sendFailed: '无法发送审批响应',
      title: '允许运行此命令？',
      allow: '允许',
      notNow: '暂不',
      more: '更多',
      moreOptions: '更多审批选项',
      allowSession: '允许本会话',
      alwaysAllowMenu: '始终允许…',
      jumpToApproval: '需要审批',
      alwaysTitle: '始终允许此命令？',
      alwaysDescription: pattern =>
        `这会将“${pattern}”模式加入永久允许列表 (~/.work4you/config.yaml)。Work4You 对类似命令将不再询问，包括当前会话和未来会话。`,
      alwaysAllow: '始终允许'
    },
    clarify: {
      notReady: '澄清请求尚未就绪',
      gatewayDisconnected: 'Work4You 网关未连接',
      sendFailed: '无法发送澄清响应',
      loadingQuestion: '正在加载问题…',
      other: '其他 (输入你的答案)',
      placeholder: '输入你的答案…',
      skip: '跳过',
      skipped: '已跳过',
      continueLabel: '继续',
      confirmAndContinueLabel: '确认并继续',
      answeredBadge: '已回答',
      questionProgress: (answered, total) => `已回答 ${answered}/${total}`,
      lateAnswer: (question, choice) => `关于"${question}" — 我的回答: ${choice}`,
      lateAnswerTip: '将此回答起草为后续消息',
      lateAnswerHint: '此问题已不再等待回答。选择一个选项会将其起草为后续消息。'
    },
    mcpSetup: {
      installTitle: server => `添加 ${server} MCP 服务器？`,
      enableTitle: server => `启用 ${server} MCP 服务器？`,
      authorizeTitle: server => `授权 ${server} MCP 服务器？`,
      connectTitle: server => `连接 ${server}？`,
      installAction: '安装',
      enableAction: '启用',
      authorizeAction: '授权',
      connectAction: '连接',
      helpersHeader: '可能有帮助的连接器',
      decline: '暂不',
      declined: '已拒绝',
      installed: server => `已安装 ${server}`,
      enabled: server => `已启用 ${server}`,
      authorized: server => `已授权 ${server}`,
      failed: server => `${server} 设置失败`,
      unanswered: '未响应',
      toolCount: count => `${count} 个工具`,
      notInCatalog: server => `“${server}”不在 MCP 目录中`,
      catalogSource: '来自 Work4You 认证目录',
      work4youAppsSource: 'Work4You Apps',
      loginRequired: '请登录 Work4You 后再连接此应用',
      envRequired: '请先填写所需凭据',
      sendFailed: '无法发送 MCP 设置响应',
      reloadFailed: '服务器已保存，但重新加载 MCP 工具失败 — 将在下个会话加载',
      gatewayDisconnected: 'Work4You 网关未连接'
    },
    tool: {
      copyCode: '复制代码',
      renderingImage: '正在渲染图片',
      copyOutput: '复制输出',
      copyCommand: '复制命令',
      copyContent: '复制内容',
      copyUrl: '复制 URL',
      copyResults: '复制结果',
      copyQuery: '复制查询',
      copyFile: '复制文件',
      copyPath: '复制路径',
      outputAlt: '工具输出',
      rawResponse: '原始响应',
      copyActivity: '复制活动',
      recoveredOne: '在 1 个失败步骤后已恢复',
      recoveredMany: count => `在 ${count} 个失败步骤后已恢复`,
      failedOne: '1 个步骤失败',
      failedMany: count => `${count} 个步骤失败`,
      statusRunning: '运行中',
      statusError: '错误',
      statusRecovered: '已恢复',
      statusDone: '完成',
      memoryWriteNoted: '已记下记忆写入',
      actions: {
        read: '已读取',
        reading: '正在读取',
        opened: '已打开',
        opening: '正在打开',
        failedToOpen: '打开失败',
        searched: '已搜索',
        searching: '正在搜索',
        ran: '已运行',
        running: '正在运行',
        ranCode: '已运行代码',
        runningCode: '正在编写脚本'
      },
      prefixes: {
        browser: '浏览器',
        web: '网页'
      },
      titleTemplates: {
        actionCommand: (action, command) => `${action} ${command}`,
        actionQuoted: (action, value) => `${action}“${value}”`,
        actionTarget: (action, target) => `${action} ${target}`,
        prefixedDone: (prefix, action) => `${prefix}${action}`,
        runningPrefixedTool: (prefix, action) => `正在运行${prefix}${action}`,
        runningTool: action => `正在运行 ${action}`
      },
      searchResults: '搜索结果',
      detailLabels: { details: '详情', errorDetails: '错误详情', snapshotSummary: '快照摘要' },
      countNouns: {
        document: count => `${count} 个文档`,
        file: count => `${count} 个文件`,
        item: count => `${count} 项`,
        match: count => `${count} 处匹配`,
        result: count => `${count} 条结果`,
        row: count => `${count} 行`,
        search: count => `${count} 次搜索`,
        source: count => `${count} 个来源`,
        step: count => `${count} 个步骤`,
        todo: count => `${count} 个待办`
      },
      runSummary: {
        categories: {
          create: { count: count => `${count} 个文件`, past: '创建了', present: '正在创建' },
          delegate: { count: count => `${count} 个任务`, past: '委派了', present: '正在委派' },
          edit: { count: count => `${count} 个文件`, past: '编辑了', present: '正在编辑' },
          explore: { count: count => `${count} 个文件`, past: '浏览了', present: '正在浏览' },
          other: { count: count => `${count} 个工具`, past: '使用了', present: '正在使用' },
          run: { count: count => `${count} 条命令`, past: '运行了', present: '正在运行' }
        },
        clause: (verb, object) => `${verb} ${object}`,
        repeated: (action, count) => `${action}（${count} 次）`,
        separator: '，'
      },
      titles: {
        apply_layout: { done: '已应用布局', pending: '正在应用布局', pendingAction: '正在应用' },
        browser_back: { done: '已返回上一页', pending: '正在返回上一页', pendingAction: '正在返回' },
        browser_cdp: { done: '已发送浏览器命令', pending: '正在发送浏览器命令', pendingAction: '正在发送' },
        browser_click: { done: '已点击页面元素', pending: '正在点击页面元素', pendingAction: '正在点击' },
        browser_console: { done: '已读取浏览器控制台', pending: '正在读取浏览器控制台', pendingAction: '正在读取' },
        browser_dialog: { done: '已处理页面对话框', pending: '正在处理页面对话框', pendingAction: '正在处理' },
        browser_exec: { done: '已运行页面脚本', pending: '正在运行页面脚本', pendingAction: '正在运行' },
        browser_fill: { done: '已填写表单字段', pending: '正在填写表单字段', pendingAction: '正在填写' },
        browser_get_images: { done: '已列出页面图片', pending: '正在列出页面图片', pendingAction: '正在列出' },
        browser_navigate: { done: '已打开页面', pending: '正在打开页面', pendingAction: '正在打开' },
        browser_press: { done: '已按下按键', pending: '正在按下按键', pendingAction: '正在按键' },
        browser_scroll: { done: '已滚动页面', pending: '正在滚动页面', pendingAction: '正在滚动' },
        browser_snapshot: { done: '已捕获页面快照', pending: '正在捕获页面快照', pendingAction: '正在捕获' },
        browser_take_screenshot: { done: '已捕获截图', pending: '正在捕获截图', pendingAction: '正在捕获' },
        browser_type: { done: '已在页面输入', pending: '正在页面输入', pendingAction: '正在输入' },
        browser_vision: { done: '已查看页面', pending: '正在查看页面', pendingAction: '正在查看' },
        clarify: { done: '已提问', pending: '正在提问', pendingAction: '正在提问' },
        close_preview: { done: '已关闭预览', pending: '正在关闭预览', pendingAction: '正在关闭' },
        close_terminal: { done: '已关闭终端', pending: '正在关闭终端', pendingAction: '正在关闭' },
        computer_use: { done: '已操作电脑', pending: '正在操作电脑', pendingAction: '正在操作' },
        cronjob: { done: 'Cron 任务', pending: '正在安排 Cron 任务', pendingAction: '正在安排' },
        drive_preview: { done: '已操作预览', pending: '正在操作预览', pendingAction: '正在操作' },
        edit_file: { done: '已编辑文件', pending: '正在编辑文件', pendingAction: '正在编辑' },
        execute_code: { done: '已运行代码', pending: '正在编写脚本', pendingAction: '正在编写脚本' },
        focus_pane: { done: '已显示面板', pending: '正在显示面板', pendingAction: '正在显示' },
        image_generate: { done: '已生成图片', pending: '正在生成图片', pendingAction: '正在生成' },
        list_files: { done: '已列出文件', pending: '正在列出文件', pendingAction: '正在列出' },
        memory: { done: '已保存到记忆', pending: '正在保存到记忆', pendingAction: '正在保存' },
        open_preview: { done: '已打开预览', pending: '正在打开预览', pendingAction: '正在打开' },
        patch: { done: '已修补文件', pending: '正在修补文件', pendingAction: '正在修补' },
        process: { done: '已检查后台进程', pending: '正在检查后台进程', pendingAction: '正在检查' },
        project_create: { done: '已创建项目', pending: '正在创建项目', pendingAction: '正在创建' },
        project_list: { done: '已列出项目', pending: '正在列出项目', pendingAction: '正在列出' },
        project_switch: { done: '已切换项目', pending: '正在切换项目', pendingAction: '正在切换' },
        read_file: { done: '已读取文件', pending: '正在读取文件', pendingAction: '正在读取' },
        read_preview: { done: '已读取预览', pending: '正在读取预览', pendingAction: '正在读取' },
        read_terminal: { done: '已读取终端', pending: '正在读取终端', pendingAction: '正在读取' },
        read_window_below: { done: '已查看后方窗口', pending: '正在查看后方窗口', pendingAction: '正在查看' },
        search_files: { done: '已搜索文件', pending: '正在搜索文件', pendingAction: '正在搜索' },
        session_search: { done: '已搜索过往会话', pending: '正在搜索过往会话', pendingAction: '正在搜索' },
        session_search_recall: { done: '已搜索会话历史', pending: '正在搜索会话历史', pendingAction: '正在搜索' },
        skill_manage: { done: '已更新技能', pending: '正在更新技能', pendingAction: '正在更新' },
        skill_view: { done: '已读取技能', pending: '正在读取技能', pendingAction: '正在读取' },
        skills_list: { done: '已列出技能', pending: '正在列出技能', pendingAction: '正在列出' },
        terminal: { done: '已运行命令', pending: '正在运行命令', pendingAction: '正在运行' },
        text_to_speech: { done: '已生成语音', pending: '正在生成语音', pendingAction: '正在生成' },
        todo: { done: '已更新待办', pending: '正在更新待办', pendingAction: '正在更新' },
        tool_call: { done: '已使用工具', pending: '正在使用工具', pendingAction: '正在使用' },
        tool_describe: { done: '已读取工具详情', pending: '正在读取工具详情', pendingAction: '正在读取' },
        tool_search: { done: '已搜索工具', pending: '正在搜索工具', pendingAction: '正在搜索' },
        tour: { done: '已展示导览', pending: '正在展示导览', pendingAction: '正在展示' },
        video_analyze: { done: '已分析视频', pending: '正在分析视频', pendingAction: '正在分析' },
        video_generate: { done: '已生成视频', pending: '正在生成视频', pendingAction: '正在生成' },
        vision_analyze: { done: '已分析图片', pending: '正在分析图片', pendingAction: '正在分析' },
        web_extract: { done: '已读取网页', pending: '正在读取网页', pendingAction: '正在读取' },
        web_search: { done: '已搜索网页', pending: '正在搜索网页', pendingAction: '正在搜索' },
        write_file: { done: '已写入文件', pending: '正在写入文件', pendingAction: '正在写入' }
      }
    }
  },
    settings: {
      appearance: {
      activityDensityTitle: '活动详情',
      activityDensityDesc: '智能体工作时和完成后，聊天中显示多少工作过程。提问、审批和已更改的文件始终保留在屏幕上。',
      activityDensityCompact: '紧凑',
      activityDensityBalanced: '均衡',
      activityDensityDetailed: '详细'
      }
    }
  },
  "zh-hant": {
    assistant: {
    thread: {
      loadingSession: '正在載入工作階段',
      showEarlier: '顯示較早的訊息',
      loadingResponse: 'Work4You 正在載入回覆',
      working: 'Work4You 正在工作',
      summarizingThread: '正在總結對話',
      resumeWhenBackgroundDone: count =>
        count === 1 ? '背景工作完成後將自動繼續' : `${count} 個背景工作完成後將自動繼續`,
      thinking: '思考中',
      thought: '已思考',
      thoughtBriefly: '思考了片刻',
      thoughtFor: duration => `思考了 ${duration}`,
      worked: '已完成工作',
      workedFor: duration => `工作了 ${duration}`,
      turnDuration: duration => `本輪耗時 ${duration}`,
      writing: '撰寫中',
      stepOf: (step, total) => `第 ${step} 步，共 ${total} 步`,
      thoughtAbout: title => `思考 · ${title}`,
      today: time => `今天，${time}`,
      yesterday: time => `昨天，${time}`,
      copy: '複製',
      refresh: '重新整理',
      moreActions: '更多動作',
      branchNewChat: '在新聊天中分支',
      react: '回應',
      dismissError: '关闭错误',
      filesChanged: count => `已編輯 ${count} 個檔案`,
      reviewChanges: '檢視',
      readAloudFailed: '朗讀失敗',
      preparingAudio: '正在準備音訊...',
      stopReading: '停止朗讀',
      readAloud: '朗讀',
      editMessage: '編輯訊息',
      stop: '停止',
      restorePrevious: '還原至上一個檢查點',
      restoreCheckpoint: '還原檢查點',
      restoreFromHere: '還原檢查點 — 從此提示重新執行',
      restoreTitle: '還原至此檢查點？',
      restoreBody: '此提示之後的所有訊息將從對話中移除，並從此處重新執行該提示。',
      restoreConfirm: '還原並重新執行',
      restoreNext: '還原至下一個檢查點',
      goForward: '前進',
      sendEdited: '傳送編輯後的訊息',
      attachingFile: '正在附加…'
    },
    notices: {
      steered: '已轉向',
      repliedTo: name => `已回覆 ${name}`,
      showReply: '查看回覆',
      messaging: name => `正在傳訊息給 ${name}…`,
      messaged: name => `已傳訊息給 ${name}`,
      messageFrom: name => `來自 ${name} 的訊息`,
      showMessage: '查看訊息',
      output: '輸出'
    },
    approval: {
      gatewayDisconnected: 'Work4You 閘道未連線',
      sendFailed: '無法傳送核准回應',
      title: '允許執行此指令？',
      allow: '允許',
      notNow: '暫不',
      more: '更多',
      moreOptions: '更多核准選項',
      allowSession: '允許本工作階段',
      alwaysAllowMenu: '一律允許…',
      jumpToApproval: '需要核准',
      alwaysTitle: '一律允許此指令？',
      alwaysDescription: pattern =>
        `這會將「${pattern}」模式加入永久允許清單（~/.work4you/config.yaml）。Work4You 對類似指令將不再詢問，包括目前工作階段和未來工作階段。`,
      alwaysAllow: '一律允許'
    },
    clarify: {
      notReady: '澄清請求尚未就緒',
      gatewayDisconnected: 'Work4You 閘道未連線',
      sendFailed: '無法傳送澄清回應',
      loadingQuestion: '正在載入問題…',
      other: '其他（輸入您的答案）',
      placeholder: '輸入您的答案…',
      skip: '略過',
      skipped: '已略過',
      continueLabel: '繼續',
      confirmAndContinueLabel: '確認並繼續',
      answeredBadge: '已回答',
      questionProgress: (answered, total) => `已回答 ${answered}/${total}`,
      lateAnswer: (question, choice) => `關於「${question}」 — 我的回答: ${choice}`,
      lateAnswerTip: '將此回答起草為後續訊息',
      lateAnswerHint: '此問題已不再等待回答。選擇一個選項會將其起草為後續訊息。'
    },
    tool: {
      copyCode: '複製程式碼',
      renderingImage: '正在渲染圖片',
      copyOutput: '複製輸出',
      copyCommand: '複製指令',
      copyContent: '複製內容',
      copyUrl: '複製 URL',
      copyResults: '複製結果',
      copyQuery: '複製查詢',
      copyFile: '複製檔案',
      copyPath: '複製路徑',
      outputAlt: '工具輸出',
      rawResponse: '原始回應',
      copyActivity: '複製活動',
      recoveredOne: '在 1 個失敗步驟後已復原',
      recoveredMany: count => `在 ${count} 個失敗步驟後已復原`,
      failedOne: '1 個步驟失敗',
      failedMany: count => `${count} 個步驟失敗`,
      statusRunning: '執行中',
      statusError: '錯誤',
      statusRecovered: '已復原',
      statusDone: '完成',
      memoryWriteNoted: '已記下記憶寫入',
      actions: {
        read: '已讀取',
        reading: '正在讀取',
        opened: '已開啟',
        opening: '正在開啟',
        failedToOpen: '開啟失敗',
        searched: '已搜尋',
        searching: '正在搜尋',
        ran: '已執行',
        running: '正在執行',
        ranCode: '已執行程式碼',
        runningCode: '正在撰寫腳本'
      },
      prefixes: {
        browser: '瀏覽器',
        web: '網頁'
      },
      titleTemplates: {
        actionCommand: (action, command) => `${action} ${command}`,
        actionQuoted: (action, value) => `${action}「${value}」`,
        actionTarget: (action, target) => `${action} ${target}`,
        prefixedDone: (prefix, action) => `${prefix}${action}`,
        runningPrefixedTool: (prefix, action) => `正在執行${prefix}${action}`,
        runningTool: action => `正在執行 ${action}`
      },
      searchResults: '搜尋結果',
      detailLabels: { details: '詳細資料', errorDetails: '錯誤詳細資料', snapshotSummary: '快照摘要' },
      countNouns: {
        document: count => `${count} 個文件`,
        file: count => `${count} 個檔案`,
        item: count => `${count} 項`,
        match: count => `${count} 處相符`,
        result: count => `${count} 筆結果`,
        row: count => `${count} 列`,
        search: count => `${count} 次搜尋`,
        source: count => `${count} 個來源`,
        step: count => `${count} 個步驟`,
        todo: count => `${count} 個待辦`
      },
      runSummary: {
        categories: {
          create: { count: count => `${count} 個檔案`, past: '建立了', present: '正在建立' },
          delegate: { count: count => `${count} 個任務`, past: '委派了', present: '正在委派' },
          edit: { count: count => `${count} 個檔案`, past: '編輯了', present: '正在編輯' },
          explore: { count: count => `${count} 個檔案`, past: '瀏覽了', present: '正在瀏覽' },
          other: { count: count => `${count} 個工具`, past: '使用了', present: '正在使用' },
          run: { count: count => `${count} 條指令`, past: '執行了', present: '正在執行' }
        },
        clause: (verb, object) => `${verb} ${object}`,
        repeated: (action, count) => `${action}（${count} 次）`,
        separator: '，'
      },
      titles: {
        apply_layout: { done: '已套用版面配置', pending: '正在套用版面配置', pendingAction: '正在套用' },
        browser_back: { done: '已返回上一頁', pending: '正在返回上一頁', pendingAction: '正在返回' },
        browser_cdp: { done: '已傳送瀏覽器指令', pending: '正在傳送瀏覽器指令', pendingAction: '正在傳送' },
        browser_click: { done: '已點擊頁面元素', pending: '正在點擊頁面元素', pendingAction: '正在點擊' },
        browser_console: { done: '已讀取瀏覽器主控台', pending: '正在讀取瀏覽器主控台', pendingAction: '正在讀取' },
        browser_dialog: { done: '已處理頁面對話框', pending: '正在處理頁面對話框', pendingAction: '正在處理' },
        browser_exec: { done: '已執行頁面腳本', pending: '正在執行頁面腳本', pendingAction: '正在執行' },
        browser_fill: { done: '已填寫表單欄位', pending: '正在填寫表單欄位', pendingAction: '正在填寫' },
        browser_get_images: { done: '已列出頁面圖片', pending: '正在列出頁面圖片', pendingAction: '正在列出' },
        browser_navigate: { done: '已開啟頁面', pending: '正在開啟頁面', pendingAction: '正在開啟' },
        browser_press: { done: '已按下按鍵', pending: '正在按下按鍵', pendingAction: '正在按鍵' },
        browser_scroll: { done: '已捲動頁面', pending: '正在捲動頁面', pendingAction: '正在捲動' },
        browser_snapshot: { done: '已擷取頁面快照', pending: '正在擷取頁面快照', pendingAction: '正在擷取' },
        browser_take_screenshot: { done: '已擷取截圖', pending: '正在擷取截圖', pendingAction: '正在擷取' },
        browser_type: { done: '已在頁面輸入', pending: '正在頁面輸入', pendingAction: '正在輸入' },
        browser_vision: { done: '已查看頁面', pending: '正在查看頁面', pendingAction: '正在查看' },
        clarify: { done: '已提問', pending: '正在提問', pendingAction: '正在提問' },
        close_preview: { done: '已關閉預覽', pending: '正在關閉預覽', pendingAction: '正在關閉' },
        close_terminal: { done: '已關閉終端機', pending: '正在關閉終端機', pendingAction: '正在關閉' },
        computer_use: { done: '已操作電腦', pending: '正在操作電腦', pendingAction: '正在操作' },
        cronjob: { done: 'Cron 工作', pending: '正在安排 Cron 工作', pendingAction: '正在安排' },
        drive_preview: { done: '已操作預覽', pending: '正在操作預覽', pendingAction: '正在操作' },
        edit_file: { done: '已編輯檔案', pending: '正在編輯檔案', pendingAction: '正在編輯' },
        execute_code: { done: '已執行程式碼', pending: '正在撰寫腳本', pendingAction: '正在撰寫腳本' },
        focus_pane: { done: '已顯示面板', pending: '正在顯示面板', pendingAction: '正在顯示' },
        image_generate: { done: '已生成圖片', pending: '正在生成圖片', pendingAction: '正在生成' },
        list_files: { done: '已列出檔案', pending: '正在列出檔案', pendingAction: '正在列出' },
        memory: { done: '已儲存至記憶', pending: '正在儲存至記憶', pendingAction: '正在儲存' },
        open_preview: { done: '已開啟預覽', pending: '正在開啟預覽', pendingAction: '正在開啟' },
        patch: { done: '已修補檔案', pending: '正在修補檔案', pendingAction: '正在修補' },
        process: { done: '已檢查背景程序', pending: '正在檢查背景程序', pendingAction: '正在檢查' },
        project_create: { done: '已建立專案', pending: '正在建立專案', pendingAction: '正在建立' },
        project_list: { done: '已列出專案', pending: '正在列出專案', pendingAction: '正在列出' },
        project_switch: { done: '已切換專案', pending: '正在切換專案', pendingAction: '正在切換' },
        read_file: { done: '已讀取檔案', pending: '正在讀取檔案', pendingAction: '正在讀取' },
        read_preview: { done: '已讀取預覽', pending: '正在讀取預覽', pendingAction: '正在讀取' },
        read_terminal: { done: '已讀取終端機', pending: '正在讀取終端機', pendingAction: '正在讀取' },
        read_window_below: { done: '已查看後方視窗', pending: '正在查看後方視窗', pendingAction: '正在查看' },
        search_files: { done: '已搜尋檔案', pending: '正在搜尋檔案', pendingAction: '正在搜尋' },
        session_search: { done: '已搜尋過往工作階段', pending: '正在搜尋過往工作階段', pendingAction: '正在搜尋' },
        session_search_recall: {
          done: '已搜尋工作階段歷史',
          pending: '正在搜尋工作階段歷史',
          pendingAction: '正在搜尋'
        },
        skill_manage: { done: '已更新技能', pending: '正在更新技能', pendingAction: '正在更新' },
        skill_view: { done: '已讀取技能', pending: '正在讀取技能', pendingAction: '正在讀取' },
        skills_list: { done: '已列出技能', pending: '正在列出技能', pendingAction: '正在列出' },
        terminal: { done: '已執行指令', pending: '正在執行指令', pendingAction: '正在執行' },
        text_to_speech: { done: '已生成語音', pending: '正在生成語音', pendingAction: '正在生成' },
        todo: { done: '已更新待辦', pending: '正在更新待辦', pendingAction: '正在更新' },
        tool_call: { done: '已使用工具', pending: '正在使用工具', pendingAction: '正在使用' },
        tool_describe: { done: '已讀取工具詳細資料', pending: '正在讀取工具詳細資料', pendingAction: '正在讀取' },
        tool_search: { done: '已搜尋工具', pending: '正在搜尋工具', pendingAction: '正在搜尋' },
        tour: { done: '已展示導覽', pending: '正在展示導覽', pendingAction: '正在展示' },
        video_analyze: { done: '已分析影片', pending: '正在分析影片', pendingAction: '正在分析' },
        video_generate: { done: '已生成影片', pending: '正在生成影片', pendingAction: '正在生成' },
        vision_analyze: { done: '已分析圖片', pending: '正在分析圖片', pendingAction: '正在分析' },
        web_extract: { done: '已讀取網頁', pending: '正在讀取網頁', pendingAction: '正在讀取' },
        web_search: { done: '已搜尋網頁', pending: '正在搜尋網頁', pendingAction: '正在搜尋' },
        write_file: { done: '已寫入檔案', pending: '正在寫入檔案', pendingAction: '正在寫入' }
      }
    }
  },
    settings: {
      appearance: {
      activityDensityTitle: '活動詳情',
      activityDensityDesc: '代理工作時和完成後，聊天中顯示多少工作過程。提問、審核和已變更的檔案一律保留在畫面上。',
      activityDensityCompact: '緊湊',
      activityDensityBalanced: '均衡',
      activityDensityDetailed: '詳細'
      }
    }
  },
  ar: {
    assistant: {
    thread: {
      loadingSession: 'جار تحميل الجلسة...',
      showEarlier: 'عرض الرسائل الأقدم',
      loadingResponse: 'جار تحميل الرد...',
      working: 'Work4You يعمل',
      summarizingThread: 'جار تلخيص المحادثة',
      resumeWhenBackgroundDone: count =>
        count === 1 ? 'سيُستأنف عند انتهاء المهمة الخلفية' : `سيُستأنف عند انتهاء ${count} مهام خلفية`,
      thinking: 'يفكر...',
      thought: 'فكّر',
      thoughtBriefly: 'فكّر قليلاً',
      thoughtFor: duration => `فكّر لمدة ${duration}`,
      worked: 'عمل',
      workedFor: duration => `عمل لمدة ${duration}`,
      turnDuration: duration => `استغرقت هذه الجولة ${duration}`,
      writing: 'يكتب',
      stepOf: (step, total) => `الخطوة ${step} من ${total}`,
      thoughtAbout: title => `تفكير · ${title}`,
      today: time => `اليوم ${time}`,
      yesterday: time => `أمس ${time}`,
      copy: 'نسخ',
      refresh: 'تحديث',
      moreActions: 'إجراءات إضافية',
      branchNewChat: 'تفريع إلى محادثة جديدة',
      react: 'تفاعل',
      dismissError: 'تجاهل الخطأ',
      filesChanged: count => (count === 1 ? 'تم تعديل ملف واحد' : `تم تعديل ${count} ملفات`),
      reviewChanges: 'مراجعة',
      readAloudFailed: 'فشلت القراءة بصوت عال',
      preparingAudio: 'جار تجهيز الصوت',
      stopReading: 'إيقاف القراءة',
      readAloud: 'قراءة بصوت عال',
      editMessage: 'تحرير الرسالة',
      scrollToBottom: 'التمرير إلى الأسفل',
      stop: 'إيقاف',
      restorePrevious: 'استعادة السابق',
      restoreCheckpoint: 'استعادة النقطة',
      restoreFromHere: 'استعادة نقطة التحقق — إعادة التشغيل من هذا الموجّه',
      restoreTitle: 'الاستعادة إلى نقطة التحقق هذه؟',
      restoreBody: 'يُزال كل ما يلي هذا الموجّه من المحادثة، ويُعاد تشغيل الموجّه من هنا.',
      restoreConfirm: 'استعادة وإعادة تشغيل',
      restoreNext: 'استعادة التالي',
      goForward: 'تقدم',
      sendEdited: 'إرسال التعديل',
      attachingFile: 'جار إرفاق الملف'
    },
    notices: {
      steered: 'وجّه',
      repliedTo: name => `ردّ على ${name}`,
      showReply: 'عرض الرد',
      messaging: name => `يراسل ${name}…`,
      messaged: name => `راسل ${name}`,
      messageFrom: name => `رسالة من ${name}`,
      showMessage: 'عرض الرسالة',
      output: 'المخرجات'
    },
    approval: {
      gatewayDisconnected: 'البوابة غير متصلة',
      sendFailed: 'فشل الإرسال',
      title: 'السماح بهذا الأمر؟',
      allow: 'سماح',
      notNow: 'ليس الآن',
      more: 'المزيد',
      moreOptions: 'خيارات إضافية',
      allowSession: 'السماح لهذه الجلسة',
      alwaysAllowMenu: 'السماح دائما',
      jumpToApproval: 'الموافقة مطلوبة',
      alwaysTitle: 'السماح دائما',
      alwaysDescription: pattern => `السماح دائما بالأوامر المطابقة لـ ${pattern}`,
      alwaysAllow: 'السماح دائما'
    },
    clarify: {
      notReady: 'غير جاهز',
      gatewayDisconnected: 'البوابة غير متصلة',
      sendFailed: 'فشل الإرسال',
      loadingQuestion: 'جار تحميل السؤال...',
      other: 'غير ذلك',
      placeholder: 'اكتب إجابتك...',
      skip: 'تخطي',
      continueLabel: 'متابعة',
      confirmAndContinueLabel: 'تأكيد ومتابعة',
      answeredBadge: 'تمت الإجابة',
      questionProgress: (answered, total) => `تمت الإجابة على ${answered} من ${total}`
    },
    tool: {
      copyCode: 'نسخ الكود',
      renderingImage: 'جار عرض الصورة...',
      copyOutput: 'نسخ الإخراج',
      copyCommand: 'نسخ الأمر',
      copyContent: 'نسخ المحتوى',
      copyUrl: 'نسخ الرابط',
      copyResults: 'نسخ النتائج',
      copyQuery: 'نسخ الاستعلام',
      copyFile: 'نسخ الملف',
      copyPath: 'نسخ المسار',
      outputAlt: 'إخراج الأداة',
      rawResponse: 'الرد الخام',
      copyActivity: 'نسخ النشاط',
      recoveredOne: 'تم الاسترداد',
      recoveredMany: count => `تم استرداد ${count}`,
      failedOne: 'فشل',
      failedMany: count => `فشل ${count}`,
      statusRunning: 'يعمل',
      statusError: 'خطأ',
      statusRecovered: 'تم الاسترداد',
      statusDone: 'تم',
      memoryWriteNoted: 'تم تسجيل كتابة الذاكرة',
      actions: {
        read: 'قراءة',
        reading: 'جار القراءة',
        opened: 'تم الفتح',
        opening: 'جار الفتح',
        searched: 'تم البحث',
        searching: 'جار البحث',
        ran: 'تم التشغيل',
        running: 'جار التشغيل',
        ranCode: 'تم تشغيل الكود',
        runningCode: 'جار البرمجة'
      },
      prefixes: {
        browser: 'المتصفح',
        web: 'الويب'
      },
      titleTemplates: {
        actionCommand: (action, command) => `${action} ${command}`,
        actionQuoted: (action, value) => `${action} “${value}”`,
        actionTarget: (action, target) => `${action} ${target}`,
        prefixedDone: (prefix, action) => `${prefix} ${action}`,
        runningPrefixedTool: (prefix, action) => `جار تشغيل ${prefix.toLowerCase()} ${action.toLowerCase()}`,
        runningTool: action => `جار تشغيل ${action.toLowerCase()}`
      },
      searchResults: 'نتائج البحث',
      detailLabels: { details: 'التفاصيل', errorDetails: 'تفاصيل الخطأ', snapshotSummary: 'ملخص اللقطة' },
      countNouns: {
        document: count => (count === 1 ? 'مستند واحد' : `${count} مستندات`),
        file: count => (count === 1 ? 'ملف واحد' : `${count} ملفات`),
        item: count => (count === 1 ? 'عنصر واحد' : `${count} عناصر`),
        match: count => (count === 1 ? 'تطابق واحد' : `${count} تطابقات`),
        result: count => (count === 1 ? 'نتيجة واحدة' : `${count} نتائج`),
        row: count => (count === 1 ? 'صف واحد' : `${count} صفوف`),
        search: count => (count === 1 ? 'بحث واحد' : `${count} عمليات بحث`),
        source: count => (count === 1 ? 'مصدر واحد' : `${count} مصادر`),
        step: count => (count === 1 ? 'خطوة واحدة' : `${count} خطوات`),
        todo: count => (count === 1 ? 'مهمة واحدة' : `${count} مهام`)
      },
      runSummary: {
        categories: {
          create: { count: count => (count === 1 ? 'ملفًا واحدًا' : `${count} ملفات`), past: 'أنشأ', present: 'ينشئ' },
          delegate: { count: count => (count === 1 ? 'مهمة واحدة' : `${count} مهام`), past: 'فوّض', present: 'يفوّض' },
          edit: { count: count => (count === 1 ? 'ملفًا واحدًا' : `${count} ملفات`), past: 'حرّر', present: 'يحرّر' },
          explore: {
            count: count => (count === 1 ? 'ملفًا واحدًا' : `${count} ملفات`),
            past: 'استكشف',
            present: 'يستكشف'
          },
          other: { count: count => (count === 1 ? 'أداة واحدة' : `${count} أدوات`), past: 'استخدم', present: 'يستخدم' },
          run: { count: count => (count === 1 ? 'أمرًا واحدًا' : `${count} أوامر`), past: 'شغّل', present: 'يشغّل' }
        },
        clause: (verb, object) => `${verb} ${object}`,
        repeated: (action, count) =>
          count === 2 ? `${action} مرتين` : count <= 10 ? `${action} ${count} مرات` : `${action} ${count} مرة`,
        separator: '، '
      },
      titles: {
        apply_layout: { done: 'تم تطبيق التخطيط', pending: 'جار تطبيق التخطيط', pendingAction: 'جار التطبيق' },
        browser_back: {
          done: 'تم الرجوع إلى الصفحة السابقة',
          pending: 'جار الرجوع إلى الصفحة السابقة',
          pendingAction: 'جار الرجوع'
        },
        browser_cdp: { done: 'تم إرسال أمر المتصفح', pending: 'جار إرسال أمر المتصفح', pendingAction: 'جار الإرسال' },
        browser_click: {
          done: 'تم النقر على عنصر الصفحة',
          pending: 'جار النقر على عنصر الصفحة',
          pendingAction: 'جار النقر'
        },
        browser_console: {
          done: 'تمت قراءة وحدة تحكم المتصفح',
          pending: 'جار قراءة وحدة تحكم المتصفح',
          pendingAction: 'جار القراءة'
        },
        browser_dialog: {
          done: 'تم الرد على حوار الصفحة',
          pending: 'جار الرد على حوار الصفحة',
          pendingAction: 'جار الرد'
        },
        browser_exec: {
          done: 'تم تشغيل برنامج الصفحة النصي',
          pending: 'جار تشغيل برنامج الصفحة النصي',
          pendingAction: 'جار التشغيل'
        },
        browser_fill: {
          done: 'تم ملء حقل النموذج',
          pending: 'جار ملء حقل النموذج',
          pendingAction: 'جار الملء'
        },
        browser_get_images: { done: 'تم سرد صور الصفحة', pending: 'جار سرد صور الصفحة', pendingAction: 'جار السرد' },
        browser_navigate: {
          done: 'تم فتح الصفحة',
          pending: 'جار فتح الصفحة',
          pendingAction: 'جار الفتح'
        },
        browser_press: { done: 'تم الضغط على مفتاح', pending: 'جار الضغط على مفتاح', pendingAction: 'جار الضغط' },
        browser_scroll: { done: 'تم تمرير الصفحة', pending: 'جار تمرير الصفحة', pendingAction: 'جار التمرير' },
        browser_snapshot: {
          done: 'تم التقاط لقطة الصفحة',
          pending: 'جار التقاط لقطة الصفحة',
          pendingAction: 'جار الالتقاط'
        },
        browser_take_screenshot: {
          done: 'تم التقاط لقطة الشاشة',
          pending: 'جار التقاط لقطة الشاشة',
          pendingAction: 'جار الالتقاط'
        },
        browser_type: {
          done: 'تمت الكتابة على الصفحة',
          pending: 'جار الكتابة على الصفحة',
          pendingAction: 'جار الكتابة'
        },
        browser_vision: { done: 'تم فحص الصفحة', pending: 'جار فحص الصفحة', pendingAction: 'جار الفحص' },
        clarify: {
          done: 'تم طرح سؤال',
          pending: 'جار طرح سؤال',
          pendingAction: 'جار السؤال'
        },
        close_preview: { done: 'تم إغلاق المعاينة', pending: 'جار إغلاق المعاينة', pendingAction: 'جار الإغلاق' },
        close_terminal: { done: 'تم إغلاق الطرفية', pending: 'جار إغلاق الطرفية', pendingAction: 'جار الإغلاق' },
        computer_use: { done: 'تم استخدام الحاسوب', pending: 'جار استخدام الحاسوب', pendingAction: 'جار الاستخدام' },
        cronjob: {
          done: 'مهمة مجدولة',
          pending: 'جار جدولة المهمة',
          pendingAction: 'جار الجدولة'
        },
        drive_preview: { done: 'تم استخدام المعاينة', pending: 'جار استخدام المعاينة', pendingAction: 'جار الاستخدام' },
        edit_file: {
          done: 'تم تحرير الملف',
          pending: 'جار تحرير الملف',
          pendingAction: 'جار التحرير'
        },
        execute_code: {
          done: 'تم تشغيل الكود',
          pending: 'جار البرمجة',
          pendingAction: 'جار البرمجة'
        },
        focus_pane: { done: 'تم عرض اللوحة', pending: 'جار عرض اللوحة', pendingAction: 'جار العرض' },
        image_generate: {
          done: 'تم إنشاء الصورة',
          pending: 'جار إنشاء الصورة',
          pendingAction: 'جار الإنشاء'
        },
        list_files: {
          done: 'تم سرد الملفات',
          pending: 'جار سرد الملفات',
          pendingAction: 'جار السرد'
        },
        memory: {
          done: 'تم الحفظ في الذاكرة',
          pending: 'جار الحفظ في الذاكرة',
          pendingAction: 'جار الحفظ'
        },
        open_preview: { done: 'تم فتح المعاينة', pending: 'جار فتح المعاينة', pendingAction: 'جار الفتح' },
        patch: {
          done: 'تم تصحيح الملف',
          pending: 'جار تصحيح الملف',
          pendingAction: 'جار التصحيح'
        },
        process: { done: 'تم فحص العملية الخلفية', pending: 'جار فحص العملية الخلفية', pendingAction: 'جار الفحص' },
        project_create: { done: 'تم إنشاء المشروع', pending: 'جار إنشاء المشروع', pendingAction: 'جار الإنشاء' },
        project_list: { done: 'تم سرد المشاريع', pending: 'جار سرد المشاريع', pendingAction: 'جار السرد' },
        project_switch: { done: 'تم تبديل المشروع', pending: 'جار تبديل المشروع', pendingAction: 'جار التبديل' },
        read_file: {
          done: 'تمت قراءة الملف',
          pending: 'جار قراءة الملف',
          pendingAction: 'جار القراءة'
        },
        read_preview: { done: 'تمت قراءة المعاينة', pending: 'جار قراءة المعاينة', pendingAction: 'جار القراءة' },
        read_terminal: { done: 'تمت قراءة الطرفية', pending: 'جار قراءة الطرفية', pendingAction: 'جار القراءة' },
        read_window_below: {
          done: 'تم فحص النافذة الخلفية',
          pending: 'جار فحص النافذة الخلفية',
          pendingAction: 'جار الفحص'
        },
        search_files: {
          done: 'تم البحث في الملفات',
          pending: 'جار البحث في الملفات',
          pendingAction: 'جار البحث'
        },
        session_search: {
          done: 'تم البحث في الجلسات السابقة',
          pending: 'جار البحث في الجلسات السابقة',
          pendingAction: 'جار البحث'
        },
        session_search_recall: {
          done: 'تم البحث في سجل الجلسة',
          pending: 'جار البحث في سجل الجلسة',
          pendingAction: 'جار البحث'
        },
        skill_manage: { done: 'تم تحديث المهارة', pending: 'جار تحديث المهارة', pendingAction: 'جار التحديث' },
        skill_view: { done: 'تمت قراءة المهارة', pending: 'جار قراءة المهارة', pendingAction: 'جار القراءة' },
        skills_list: { done: 'تم سرد المهارات', pending: 'جار سرد المهارات', pendingAction: 'جار السرد' },
        terminal: {
          done: 'تم تشغيل الأمر',
          pending: 'جار تشغيل الأمر',
          pendingAction: 'جار التشغيل'
        },
        text_to_speech: { done: 'تم إنشاء مقطع صوتي', pending: 'جار إنشاء مقطع صوتي', pendingAction: 'جار الإنشاء' },
        todo: {
          done: 'تم تحديث المهام',
          pending: 'جار تحديث المهام',
          pendingAction: 'جار التحديث'
        },
        tool_call: { done: 'تم استخدام أداة', pending: 'جار استخدام أداة', pendingAction: 'جار الاستخدام' },
        tool_describe: {
          done: 'تمت قراءة تفاصيل الأداة',
          pending: 'جار قراءة تفاصيل الأداة',
          pendingAction: 'جار القراءة'
        },
        tool_search: { done: 'تم البحث عن الأدوات', pending: 'جار البحث عن الأدوات', pendingAction: 'جار البحث' },
        tour: { done: 'تم عرض جولة', pending: 'جار عرض جولة', pendingAction: 'جار العرض' },
        video_analyze: { done: 'تم تحليل الفيديو', pending: 'جار تحليل الفيديو', pendingAction: 'جار التحليل' },
        video_generate: { done: 'تم إنشاء الفيديو', pending: 'جار إنشاء الفيديو', pendingAction: 'جار الإنشاء' },
        vision_analyze: {
          done: 'تم تحليل الصورة',
          pending: 'جار تحليل الصورة',
          pendingAction: 'جار التحليل'
        },
        web_extract: {
          done: 'تمت قراءة صفحة الويب',
          pending: 'جار قراءة صفحة الويب',
          pendingAction: 'جار القراءة'
        },
        web_search: {
          done: 'تم البحث في الويب',
          pending: 'جار البحث في الويب',
          pendingAction: 'جار البحث'
        },
        write_file: {
          done: 'تمت كتابة الملف',
          pending: 'جار كتابة الملف',
          pendingAction: 'جار الكتابة'
        }
      }
    }
  },
    settings: {
      appearance: {
      activityDensityTitle: 'تفاصيل النشاط',
      activityDensityDesc: 'مقدار ما تعرضه المحادثة من عمل الوكيل أثناء العمل وبعد انتهائه. تبقى الأسئلة والموافقات والملفات المعدّلة ظاهرة دائمًا.',
      activityDensityCompact: 'مضغوط',
      activityDensityBalanced: 'متوازن',
      activityDensityDetailed: 'مفصّل'
      }
    }
  }
}

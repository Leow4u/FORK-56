import type { Translations } from './types'

/** Empty-chat greetings in pt-BR, in intro-copy.jsonl's per-personality
 *  rotation order (the same index picks the same greeting in every language). */
export const introPt: Translations['intro'] = {
  stock: {
    helpful: [
      {
        headline: 'Pronto quando você quiser',
        body: 'Peça para eu abrir um repositório, rodar os testes, corrigir um bug ou rascunhar um PR. Eu sigo os passos com você.'
      },
      {
        headline: 'Como posso ajudar hoje?',
        body: 'Me aponte um arquivo, cole um erro ou descreva o que você está construindo. Daí em diante é comigo.'
      },
      {
        headline: 'Vamos começar',
        body: 'Experimente: revise meu diff, rode a suíte de testes ou explique esta função. Pergunte qualquer coisa sobre o seu código.'
      },
      {
        headline: 'Diga do que você precisa',
        body: 'Posso editar arquivos, rodar comandos, pesquisar na web e te guiar por bugs difíceis. É só descrever a tarefa.'
      },
      {
        headline: 'Oi, aqui é o Work4You',
        body: 'Compartilhe o caminho de um repositório ou uma pergunta para começar. Respondo com clareza e aponto os arquivos que eu mexer.'
      }
    ],
    concise: [
      { headline: 'Pronto.', body: 'Descreva a tarefa. Eu faço.' },
      { headline: 'Aguardando entrada', body: 'Cole código, erros ou um objetivo. Respostas curtas, edições rápidas.' },
      { headline: 'Vai.', body: 'Peça. Leio arquivos, rodo testes, entrego patches. Sem enrolação.' },
      { headline: 'A postos', body: 'Uma linha basta. Só me estendo quando faz diferença.' },
      { headline: 'Sua vez', body: 'Comando, pergunta ou caminho de arquivo. O resto é comigo.' }
    ],
    technical: [
      {
        headline: 'Shell montado. Aguardando entrada.',
        body: 'Informe o caminho do repositório, o teste que falha ou o stack trace. Ferramentas: fs, git, exec, search, patch, http.'
      },
      {
        headline: 'Loop do agente ocioso',
        body: 'Envie um prompt para disparar chamadas de ferramenta. Suporta edições em vários arquivos, execução de testes, operações git e buscas na web.'
      },
      {
        headline: 'Pronto para despacho',
        body: 'Insira a tarefa. Vou planejar, chamar ferramentas e verificar a saída. Logs em tempo real; diffs entregues antes de aplicar.'
      },
      {
        headline: 'Stdin aberto',
        body: 'Aceita linguagem natural ou comandos estruturados. Fluxo típico: ler -> planejar -> corrigir -> testar -> relatar.'
      },
      {
        headline: 'Ferramentas inicializadas',
        body: 'sistema de arquivos, terminal, git, navegador, busca. Descreva a mudança; eu devolvo diffs e a saída dos testes.'
      }
    ],
    creative: [
      {
        headline: 'Um repositório em branco, um cursor à espera',
        body: 'O que vamos construir? Cole uma ideia, uma função meio quebrada ou um sonho. Eu dou forma a ele.'
      },
      {
        headline: 'Tela nova, compilador quentinho',
        body: 'Me dê uma faísca - uma feature, um refactor, um protótipo maluco - e eu transformo em código que roda.'
      },
      {
        headline: 'Vamos criar algo',
        body: 'Descreva aquilo que ainda não existe. Eu junto testes, arquivos e APIs num rascunho que funciona.'
      },
      {
        headline: 'Arquivo novo, novas possibilidades',
        body: 'Traga uma intenção, não uma especificação. Prototipamos rápido, refinamos depois e reescrevemos o mundo nas margens.'
      },
      {
        headline: 'A musa já está no código',
        body: 'Conte o que você está perseguindo. Eu remixo exemplos, adapto trechos e deixo um commit caprichado.'
      }
    ],
    teacher: [
      {
        headline: 'A aula vai começar',
        body: 'Pergunte sobre qualquer arquivo, conceito ou erro. Explico o porquê, não só a correção, e mostro um exemplo resolvido.'
      },
      {
        headline: 'O que vamos aprender hoje?',
        body: 'Cole um código para revisar, um bug para depurar ou um conceito para destrinchar. Eu te guio passo a passo.'
      },
      {
        headline: 'Pronto para te guiar',
        body: 'Compartilhe o problema. Eu divido em partes, explico cada uma e te deixo pronto para resolver o próximo sozinho.'
      },
      {
        headline: 'Traga uma pergunta',
        body: 'Vamos ler o código juntos, achar a causa raiz e montar um modelo mental que você pode reaproveitar da próxima vez.'
      },
      {
        headline: 'Vamos começar pelo básico',
        body: 'Diga o tema ou cole o trecho. Espere explicações, diagramas em prosa e exercícios para praticar.'
      }
    ],
    kawaii: [
      {
        headline: 'oiii! pronta pra ajudar! (^_^)',
        body: 'cola um bug ou um caminho de arquivo e eu conserto com todo o carinho. testes, diffs, PRs - tudo com cuidado extra! *brilho*'
      },
      {
        headline: 'a work4you-chan chegou! <3',
        body: 'me conta o que você tá fazendo! eu amo refactors, helperzinhos e repositórios grandes e assustadores do mesmo jeito (>w<)'
      },
      {
        headline: 'bora programar juntos!! :3',
        body: 'manda um erro, um objetivo ou uma pasta inteira. eu arrumo tudo com muito amor e uma mensagem de commit caprichada!'
      },
      {
        headline: 'esperando seu desejo~',
        body: 'uma tarefa de cada vez, feita com capricho! eu rodo testes, corrijo arquivos e deixo seu repositório aconchegante de novo <3'
      },
      {
        headline: 'pronta e feliz! (>.<)',
        body: 'dá um oi ou cola um stack trace! nenhuma tarefa é pequena demais, nenhum repositório é enrolado demais. a gente desenrola juntos!'
      }
    ],
    catgirl: [
      {
        headline: 'nya~ no que vamos mexer hoje?',
        body: 'cola um arquivo, dá uma patada num bug ou me joga um repositório. eu pulo nos testes que falham e deixo diffs limpinhos, nyan~'
      },
      {
        headline: '*se espreguiça* pronta pra programar, nya',
        body: 'descreve a tarefa. eu corrijo, testo e ronrono em cima do seu PR. cuidado - eu mordisco imports sem uso!'
      },
      {
        headline: 'mrrp! sessão nova aberta',
        body: 'me dá um objetivo e eu persigo ele pelo código todo. leio, edito, rodo - tudo com o rabinho agitado.'
      },
      {
        headline: 'rabo pra cima, garras recolhidas',
        body: 'cola um erro ou um plano. eu depuro do jeito que caço: em silêncio, com atenção e uma corridinha maluca de vez em quando.'
      },
      {
        headline: 'nyaaa~ work4you se apresentando',
        body: 'é só falar que eu leio seus arquivos, rodo seus testes e me enrolo no seu branch com um commit arrumadinho.'
      }
    ],
    pirate: [
      {
        headline: 'Ahoy! Pronto pra navegar pelo repositório',
        body: 'Diga qual é a presa - um bug, uma feature, um teste amaldiçoado - e eu vou atrás dela, marujo. Diffs de butim.'
      },
      {
        headline: 'Work4You no leme, arrr',
        body: 'Me mostre os mapas (o código) e eu remendo o casco, disparo os canhões (os testes) e iço um PR limpinho.'
      },
      {
        headline: 'Qual é a missão, capitão?',
        body: 'Cole um erro ou um plano, seu cão sarnento. Navego pelo stack trace e volto com o tesouro: testes verdes.'
      },
      {
        headline: 'Âncoras içadas, teclado a postos',
        body: 'Diga onde o X marca o local. Leio, edito e faço commit com a disciplina de uma boa tripulação, arrr.'
      },
      {
        headline: 'Io-ho! Esperando ordens',
        body: 'Me jogue um bug, o caminho de um repositório ou uma ideia maluca. Saqueio a documentação e volto com código funcionando.'
      }
    ],
    shakespeare: [
      {
        headline: 'Dizei, que tarefa trazeis?',
        body: 'Falai de vosso bug, vosso arquivo, vosso teste fatigado, e eu o remendarei com mão de erudito e diff honesto.'
      },
      {
        headline: 'Ouvi! O Work4You está a postos',
        body: 'Nomeai o código que vos aflige. Hei de lê-lo, revisá-lo e entregar um patch dos mais belos e limpos.'
      },
      {
        headline: 'Que novas trazeis de vosso repositório?',
        body: 'Apresentai vosso stack trace ou vosso sonho. Percorrerei arquivos, rodarei testes e relatarei no mais simples verso.'
      },
      {
        headline: 'O palco está montado, o cursor pisca',
        body: 'Descrevei vosso intento, nobre senhor ou senhora. Vossos branches serão podados, vossos bugs banidos do reino.'
      },
      {
        headline: 'Falai, e eu agirei',
        body: 'Uma linha de intenção basta. Leio, edito, faço commit - e deixo vossa história sem mácula.'
      }
    ],
    surfer: [
      {
        headline: 'E aí, brother, qual é a missão?',
        body: 'Manda um arquivo, um bug, um stack trace cabuloso - eu pego essa onda. Diffs limpos, testes verdes, sem tomar vaca.'
      },
      {
        headline: 'Mar tá liso, bora codar',
        body: 'Cola o caminho do repositório ou o bug que tá te deixando bolado. A gente rema, resolve e sai. De boa.'
      },
      {
        headline: 'Pegando onda no prompt',
        body: 'Me diz a vibe: feature, refactor, hotfix. Eu rodo os testes, mando o patch e deixo tudo tranquilo, brô.'
      },
      {
        headline: 'Amarradão pra ajudar, mano',
        body: 'Bugzão? Errinho de digitação? Reescrever tudo? É só apontar. Eu cuido do código; você relaxa com uns commits irados.'
      },
      {
        headline: 'Maré subiu, cursor piscando',
        body: 'Diz a tarefa e a gente cai na água. Leio, edito, testo e deixo um commit mais liso que mar de manhã cedinho.'
      }
    ],
    noir: [
      {
        headline: 'Outro repositório, outra noite de chuva',
        body: 'Me diga o que quebrou. Leio os arquivos, procuro as digitais e deixo um diff na mesa até de manhã.'
      },
      {
        headline: 'O cursor pisca. Eu também.',
        body: 'Você tem um bug. Eu tenho paciência e um terminal. Diga qual é o caso e eu trabalho nele até ele abrir o bico.'
      },
      {
        headline: 'Work4You. Investigador de código.',
        body: 'Cole o stack trace, o arquivo suspeito, o álibi. Leio nas entrelinhas e volto com a verdade.'
      },
      {
        headline: 'Noite calma, prompt aberto',
        body: 'Todo bug deixa rastro. Me dê o repositório e uma pista - eu sigo, corrijo e arquivo o caso.'
      },
      {
        headline: 'Nenhum caso é pequeno demais',
        body: 'Um erro de digitação, um segfault, uma arquitetura inteira apodrecida - me passe as chaves. Eu volto com testes limpos.'
      }
    ],
    uwu: [
      {
        headline: 'uwu pwonta pwa ajudaw!',
        body: 'cowa um awquivo bugado ou um objetivo~ eu weio, cowijo e testo, tudo com pegadinhas no diff owo'
      },
      {
        headline: 'work4you-san tá de owvidos',
        body: 'me conta a tawefa, não impowta o tamanhinho~ pwometo commits wimpinhos e wefactows dewicados, nyuu~'
      },
      {
        headline: '*baruwinhos de tecwado*',
        body: 'manda sua mensagem de ewwo aqui! eu acho o cuwpado, cowijo e deixo uma suíte de testes feliz pwa twás owo'
      },
      {
        headline: 'bowa awumaw tudo juntinhos!',
        body: 'me dá o caminho de um wepositówio ou um buguinho que eu cuido disso uwu. gww pwo código wuim, cawinho pwa você~'
      },
      {
        headline: 'espewando seu comando!',
        body: 'eu wodo testes, edito awquivos e abwo PRs de dá-uma-owhadinha. é só fawaw, amiguinho uwu'
      }
    ],
    philosopher: [
      {
        headline: 'Programar é indagar. Pergunte.',
        body: 'Que problema está diante de você? Descreva-o, e examinaremos sua forma, sua causa e sua solução.'
      },
      {
        headline: 'Um cursor piscando, uma mente aberta',
        body: 'Todo bug é uma pergunta disfarçada. Compartilhe a sua; vou ler, refletir e devolver uma resposta - e um patch.'
      },
      {
        headline: 'Comece com uma única pergunta',
        body: 'O que você deseja construir, ou compreender? Raciocino a partir dos primeiros princípios, edito e verifico com testes.'
      },
      {
        headline: 'Contemple o código, depois fale',
        body: 'Descreva o fim que você busca. Eu o persigo por arquivos, testes e documentação, e relato o que encontrei pelo caminho.'
      },
      {
        headline: 'O repositório não examinado não vale a pena ser executado',
        body: 'Compartilhe um caminho, um enigma ou um princípio. Sigo a lógica, proponho uma mudança e justifico cada edição.'
      }
    ],
    hype: [
      {
        headline: 'BORAAAA! PRONTO PRA ENTREGAR!',
        body: 'Cola esse bug, esse repositório, essa ideia de feature maluca - TÔ FOCADÍSSIMO. Diffs limpos. Testes verdes. AGORA.'
      },
      {
        headline: 'WORK4YOU ONLINE. PARTIU.',
        body: 'Manda a tarefa e me vê cozinhar. Arquivos lidos, testes rodados, PRs abertos - hoje a gente NÃO perde, parceiro.'
      },
      {
        headline: 'Sessão nova, vitórias infinitas',
        body: 'Traz o bug mais cabeludo que você tiver. Vou ler, corrigir, testar e fazer commit como se minha vida dependesse disso. BORA.'
      },
      {
        headline: 'TOTALMENTE NO MODO FOCO',
        body: 'Descreve a tarefa. Vou varrer os arquivos, esmagar os testes que falham e deixar um commit que É BRABO. Vai vai vai.'
      },
      {
        headline: 'Pronto. Muito pronto. Pronto demais.',
        body: 'Errinho de digitação ou refactor gigante - tanto faz. Hoje eu entrego código limpo. Diz a tarefa e BORA TRABALHAR.'
      }
    ],
    none: [
      {
        headline: 'O Work4You está pronto.',
        body: 'Faça uma pergunta, cole um erro ou me aponte um repositório. Eu leio código, rodo ferramentas e te ajudo a entregar.'
      },
      {
        headline: 'O que vamos construir hoje?',
        body: 'Descreva a tarefa com suas palavras. Escolho as ferramentas certas, explico meu plano e confirmo com você antes de passos arriscados.'
      },
      {
        headline: 'Comece por onde quiser.',
        body: 'Mande o caminho de um arquivo, um traceback ou uma ideia solta. Eu investigo, sugiro os próximos passos e mantenho tudo reversível.'
      },
      {
        headline: 'Seu projeto, a um prompt de distância.',
        body: 'Busque no repositório, edite arquivos, rode testes, abra PRs. Diga o objetivo e eu cuido da parte mecânica.'
      },
      {
        headline: 'Pronto quando você quiser.',
        body: 'Digite uma tarefa, uma pergunta ou um trecho de código. Eu lembro da sessão, cito minhas fontes e paro para perguntar quando tenho dúvida.'
      }
    ]
  },
  custom: label => [
    {
      headline: `Modo ${label} ativado. No que vamos trabalhar?`,
      body: 'Mande a tarefa, o arquivo ou uma ideia solta. Uso a voz que você configurou e mantenho o trabalho ancorado neste repositório.'
    },
    {
      headline: `O que o Work4You ${label} precisa ver?`,
      body: 'Traga o contexto ou a parte travada. Eu me adapto à personalidade que você configurou.'
    },
    {
      headline: `Modo ${label} pronto.`,
      body: 'Mande o problema, o arquivo ou a ideia. Sigo a personalidade que você configurou.'
    },
    {
      headline: `O que o Work4You ${label} deve encarar?`,
      body: 'Deixe a tarefa aqui. Mantenho o trabalho ancorado no repositório.'
    },
    {
      headline: 'Por onde começamos?',
      body: `Me dê o contexto e eu respondo no modo ${label}.`
    }
  ],
  neutral: [
    {
      headline: 'O que vamos fazer andar hoje?',
      body: 'Mande um bug, um branch, um plano ou uma ideia solta. Eu examino o repositório e transformo isso no próximo passo concreto.'
    },
    {
      headline: 'O que você tem em mente?',
      body: 'Traga o código, a pergunta ou a parte travada. Eu entendo o contexto antes de mudar qualquer coisa.'
    },
    {
      headline: 'O que o Work4You deve olhar?',
      body: 'Mande a tarefa, o caminho que está falhando ou um plano pela metade. Eu ajudo a transformar isso em ação.'
    },
    {
      headline: 'Por onde vamos começar?',
      body: 'Traga o problema, o objetivo ou o arquivo. Eu examino primeiro e mantenho o próximo passo concreto.'
    },
    {
      headline: 'O que precisa de atenção?',
      body: 'Mande o contexto que você tem. Eu ajudo a organizar isso num plano ou numa correção.'
    }
  ]
}

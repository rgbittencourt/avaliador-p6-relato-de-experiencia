/* Núcleo do Avaliador P6 · Relato de experiência (TEDPRO/IFSC).
   Usado no navegador (window.RelatoCore) e no servidor (require).
   Fonte única da rubrica oficial, do cálculo da nota e das verificações automáticas. */
(function (raiz, fabrica) {
  const api = fabrica();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else raiz.RelatoCore = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Rubrica oficial (exportada do Moodle em 09/11/2026). Cada critério vale de 0 a 3 níveis;
  // o peso indica quanto o critério representa em 100. Nota = soma(nível / 3 × peso) / 10.
  const RUBRICA = {
  "apresentacao": {
    "label": "Apresentação do documento e adequação ao formato solicitado",
    "curto": "Apresentação e formato",
    "peso": 15,
    "max": 3,
    "niveis": [
      {
        "pontos": 0,
        "desc": "Não apresentou documento acessível para avaliação ou entregou um material sem organização mínima como relato de experiência, mantendo o modelo essencialmente sem preenchimento."
      },
      {
        "pontos": 1,
        "desc": "Apresentou documento com várias partes iniciais ausentes ou incompletas, como identificação, título, resumo e palavras-chave. Predomina o formato de perguntas e respostas ou permanecem numerosos textos de orientação do modelo."
      },
      {
        "pontos": 2,
        "desc": "Apresentou documento predominantemente narrativo, com nome, matrícula, orientador(a), título, resumo e palavras-chave, mas deixou ajustes pontuais nas orientações de apresentação: formulação ou capitalização do título, conteúdo, extensão ou formatação do resumo, quantidade ou apresentação das palavras-chave, remoção dos textos orientadores ou formato de envio."
      },
      {
        "pontos": 3,
        "desc": "Apresentou nome, matrícula e orientador(a); título adaptado da pergunta-desafio como afirmação, com maiúsculas conforme o modelo; resumo de 150 a 250 palavras que sintetiza desafio, recursos e principais resultados, sem recuo inicial, com espaçamento simples e alinhamento justificado; e três palavras-chave pertinentes, com iniciais maiúsculas e separadas por ponto e vírgula. Escreveu o relato em narrativa, não em perguntas e respostas, retirou os textos orientadores e entregou PDF ou link do Google Docs com visualização liberada."
      }
    ]
  },
  "contextualizacao": {
    "label": "Contextualização pessoal, definição do desafio e percurso de pesquisa",
    "curto": "Contextualização, desafio e pesquisa",
    "peso": 15,
    "max": 3,
    "niveis": [
      {
        "pontos": 0,
        "desc": "Não contextualizou sua trajetória nem apresentou o desafio e o percurso utilizado para defini-lo e escolher os recursos."
      },
      {
        "pontos": 1,
        "desc": "Mencionou sua trajetória ou o desafio de forma genérica, deixando sem esclarecimento o público-alvo, os motivos da escolha e as pesquisas ou estratégias utilizadas para decidir os recursos."
      },
      {
        "pontos": 2,
        "desc": "Apresentou sua contextualização, o desafio, o público-alvo e as razões da escolha. Relatou pesquisas ou estratégias de decisão e a aprendizagem das ferramentas, mas deixou pouco desenvolvida alguma dessas etapas ou não explicou as alterações do desafio quando ocorreram."
      },
      {
        "pontos": 3,
        "desc": "Apresentou profissão ou formação, cidade e motivação para ingressar no curso; explicitou a pergunta-desafio, seu público-alvo e os motivos da escolha, explicando eventuais alterações. Nos parágrafos orientados pelo modelo, relatou assuntos, autores e referências efetivamente pesquisados ou, quando não realizou pesquisas, os aspectos e estratégias considerados para definir o desafio e os recursos. Explicou também como aprendeu a utilizar as ferramentas de produção."
      }
    ]
  },
  "recursos": {
    "label": "Reflexão sobre a produção dos recursos e a organização do portfólio — P2 a P6",
    "curto": "Reflexão sobre P2 a P6",
    "peso": 25,
    "max": 3,
    "niveis": [
      {
        "pontos": 0,
        "desc": "Não relatou a experiência de produção dos recursos e de organização do portfólio."
      },
      {
        "pontos": 1,
        "desc": "Limitou-se a listar produtos ou relatou apenas parte das atividades P2 a P6, com poucas informações sobre aprendizagens, dificuldades e relação com o desafio."
      },
      {
        "pontos": 2,
        "desc": "Abordou P2, P3, P4, P5 e P6, apresentando aprendizagens e dificuldades, mas deixou alguma atividade pouco desenvolvida. Explicou parcialmente a contribuição dos recursos para o desafio ou a contribuição da organização do Padlet e da escrita do relato para sua formação."
      },
      {
        "pontos": 3,
        "desc": "Dedicou ao menos um parágrafo a cada atividade: P2, vídeo e roteiro; P3, proposta formativa; P4, podcast; P5, agente mediador com IA; e P6, relato e portfólio no Padlet. Relatou aprendizagens e dificuldades em cada experiência; na P2, discutiu a escolha e a apresentação do desafio em vídeo; nas P3 a P5, explicou como os recursos contribuem para enfrentá-lo. Na P6, refletiu sobre a trajetória de pesquisa, a organização do portfólio e do relato, suas contribuições formativas, pontos positivos e maiores desafios."
      }
    ]
  },
  "competencias": {
    "label": "Preenchimento do quadro e autoavaliação de competências e ferramentas",
    "curto": "Quadro e autoavaliação de competências",
    "peso": 15,
    "max": 3,
    "niveis": [
      {
        "pontos": 0,
        "desc": "Não preencheu o quadro de competências e ferramentas nem apresentou a reflexão solicitada sobre seu desenvolvimento."
      },
      {
        "pontos": 1,
        "desc": "Preencheu poucas partes do quadro, manteve exemplos sem adequá-los à própria experiência ou apresentou reflexão genérica, sem relacioná-la às competências indicadas."
      },
      {
        "pontos": 2,
        "desc": "Preencheu o quadro para a maior parte das atividades e apresentou reflexão sobre suas competências, mas deixou lacunas nas marcações, nas ferramentas utilizadas ou na análise das competências prévias, não desenvolvidas e eventualmente ampliadas."
      },
      {
        "pontos": 3,
        "desc": "Preencheu as colunas P1 a P6 com marcações das competências que considera ter desenvolvido, incluindo a opção de nenhuma competência quando pertinente, e indicou as ferramentas aprendidas e/ou utilizadas em cada atividade, substituindo os exemplos do modelo por sua autoavaliação. Em ao menos um parágrafo, discutiu competências que já possuía, aquelas que considera não ter desenvolvido e a existência ou não de outras competências adquiridas. A avaliação considera a consistência do registro, não a quantidade de competências assinaladas."
      }
    ]
  },
  "resultados": {
    "label": "Análise da aplicação, dos resultados e das perspectivas de continuidade",
    "curto": "Resultados e continuidade",
    "peso": 20,
    "max": 3,
    "niveis": [
      {
        "pontos": 0,
        "desc": "Não apresentou análise dos resultados, perspectivas de continuidade ou fechamento da experiência formativa."
      },
      {
        "pontos": 1,
        "desc": "Afirmou resultados de modo genérico, sem explicar sua relação com a produção ou experimentação dos recursos e com o público-alvo. Apresentou próximos passos vagos ou não registrou o que foi significativo para sua aprendizagem."
      },
      {
        "pontos": 2,
        "desc": "Relatou resultados e possibilidades de continuidade, mas desenvolveu parcialmente a experiência de aplicação e a opinião do público-alvo, a suficiência dos recursos, as mudanças que faria ou os recursos adicionais que criaria. Apresentou um fechamento, ainda pouco relacionado às aprendizagens narradas."
      },
      {
        "pontos": 3,
        "desc": "Analisou, em ao menos um parágrafo, os resultados dos recursos produzidos e/ou experimentados, situando a aplicação com o público-alvo e sua opinião e explicitando eventuais limites dessa experiência. Discutiu se os recursos são suficientes para solucionar o desafio, se criaria outros e se faria algum de modo diferente. Em outro parágrafo, apresentou próximos passos coerentes com essa análise e finalizou destacando o que foi mais significativo e marcante para sua aprendizagem. O reconhecimento de limitações não é penalizado por si só."
      }
    ]
  },
  "transparencia": {
    "label": "Declaração e reflexão sobre o uso de IA generativa na redação do relato",
    "curto": "Declaração de uso de IA",
    "peso": 10,
    "max": 3,
    "niveis": [
      {
        "pontos": 0,
        "desc": "Não apresentou a declaração solicitada sobre o uso ou não de IA generativa na elaboração do relato."
      },
      {
        "pontos": 1,
        "desc": "Informou que utilizou IA ou apenas citou ferramentas, sem esclarecer suas finalidades, o processo de interação e validação e os impactos na escrita e na aprendizagem."
      },
      {
        "pontos": 2,
        "desc": "Identificou as ferramentas utilizadas e suas finalidades, mas descreveu parcialmente o processo de interação e validação das respostas ou os impactos do uso na escrita e na aprendizagem."
      },
      {
        "pontos": 3,
        "desc": "Quando utilizou IA generativa, identificou as ferramentas, detalhou as finalidades de uso na redação do relato, descreveu como interagiu com as respostas e as validou, incluindo ajustes, verificações ou limites encontrados, e refletiu sobre os impactos na escrita e na aprendizagem. Quando não utilizou, apresentou a declaração prevista no modelo: 'Não utilizei ferramentas de IA generativa na elaboração deste relato.' Ambas as situações atendem integralmente ao critério; não se atribui vantagem ou penalidade pela decisão de usar ou não IA."
      }
    ]
  }
};
  const ORDEM = Object.keys(RUBRICA);

  const arred = (n) => Math.round(n * 100) / 100;
  // Pontos (em 0 a 10) obtidos num critério a partir do nível escolhido.
  function pontosCriterio(chave, nivel) {
    const c = RUBRICA[chave];
    if (!c || nivel === null || nivel === undefined || nivel === '' || !Number.isFinite(Number(nivel))) return 0;
    return arred((Number(nivel) / c.max) * c.peso / 10);
  }
  const maxCriterio = (chave) => RUBRICA[chave].peso / 10;
  // niveis: { chave: nível } → nota de 0 a 10 (duas casas)
  function notaFinal(niveis) {
    return arred(ORDEM.reduce((soma, k) => soma + pontosCriterio(k, niveis ? niveis[k] : null), 0));
  }
  function nivelValido(chave, valor) {
    const niveis = RUBRICA[chave].niveis.map((n) => n.pontos);
    const v = Number(valor);
    if (niveis.includes(v)) return v;
    if (!Number.isFinite(v)) return 0;
    return niveis.reduce((m, n) => (Math.abs(n - v) < Math.abs(m - v) ? n : m), niveis[0]);
  }
  const formatar = (n) => Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 });

  // ---------- verificações automáticas ----------
  const t = (v) => String(v == null ? '' : v).trim();
  const semAcento = (s) => t(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  function contarPalavras(texto) {
    const m = t(texto).match(/[\p{L}\p{N}][\p{L}\p{N}'’\-]*/gu);
    return m ? m.length : 0;
  }
  // Trechos de orientação do modelo (texto azul) que deveriam ter sido apagados.
  const TEXTOS_ORIENTADORES = [
    /\[escreva aqui\]/i, /escreva ao menos um par[aá]grafo/i, /escreva um par[aá]grafo/i,
    /\(seu nome\)/i, /\(sua profiss[aã]o/i, /\(sua cidade\)/i, /\(sua motiva[cç][aã]o/i, /\(pergunta do seu desafio\)/i,
    /\(quais foram os motivos/i, /\(alunos, professores, profissionais/i,
    /se n[aã]o houve altera[cç][aã]o, elimine esse par[aá]grafo/i, /preencher conforme exemplos/i,
    /na primeira coluna do quadro/i, /o resumo deve ser escrito ao finalizar/i, /apresente 3 palavras-chave/i,
    /descreva aqui quais ferramentas/i, /detalhe aqui para quais finalidades/i, /explique aqui qual foi o impacto/i,
    /voc[eê] elaborou este recurso na p\d/i, /respondendo [aà]s seguintes perguntas/i,
    /ele deve ser uma adapta[cç][aã]o do texto usado/i, /finalize o seu relato de experi[eê]ncia registrando/i,
    /caso n[aã]o tenha utilizado nenhuma ferramenta de ia/i
  ];
  // Começos de frase fixos do modelo (texto preto): não contam como conteúdo do estudante.
  const FRASES_FIXAS = [
    /Para elaborar este portf[óo]lio, realizamos 6 principais atividades, sendo a primeira delas \(P1\) relativa a escolha de um desafio para ser desenvolvido ao longo do curso\.?/gi,
    /Escolhi o seguinte desafio para pesquisar durante o curso:?/gi, /O p[úu]blico-alvo do meu desafio s[ãa]o/gi, /Escolhi esse desafio porque/gi,
    /Para entender melhor o desafio e propor recursos digitais e estrat[ée]gias educacionais para solucionar o desafio, eu pesquisei e busquei informa[çc][õo]es sobre os seguintes assuntos:?/gi,
    /Com base no meu desafio delimitado na primeira atividade \(P1\), desenvolvi um portf[óo]lio composto pelos seguintes recursos educacionais digitais:?/gi,
    /Meu nome [ée]/gi, /e me inscrevi na Especializa[çc][ãa]o em Tecnologias para Educa[çc][ãa]o Profissional porque/gi
  ];
  function textosOrientadoresEncontrados(texto) {
    const s = t(texto);
    return TEXTOS_ORIENTADORES.filter((re) => re.test(s)).length;
  }
  // Texto do estudante sem as frases de orientação do modelo e sem perguntas copiadas.
  function semOrientacoes(texto, { manterPerguntas = false } = {}) {
    let base = t(texto).replace(/\[escreva aqui\]/gi, ' ');
    FRASES_FIXAS.forEach((re) => { base = base.replace(re, ' '); });
    const frases = base.split(/(?<=[.?!])\s+|\n+/);
    return frases.filter((f) => f.trim().replace(/[\s,.;:]+/g, '') && (manterPerguntas || !/\?\s*$/.test(f)) && !TEXTOS_ORIENTADORES.some((re) => re.test(f))
      && !/\((?:seu|sua|alunos, professores|pergunta do seu|quais foram)[^)]*\)/i.test(f)
      && !/^\s*(?:ex:|descreva aqui|detalhe aqui|explique aqui)/i.test(f)).join(' ').trim();
  }
  const PLACEHOLDER_NOME = /^\s*(seu nome|nome completo:?)\s*$/i;
  const PLACEHOLDER_MATRICULA = /^\s*(matr[ií]cula|n[uú]mero de matr[ií]cula:?)\s*$/i;
  const orientadorVazio = (v) => !t(v) || /^\s*selecione\s*$/i.test(v);

  function analisarPalavrasChave(texto) {
    const s = t(texto).replace(/\.$/, '');
    if (!s) return { quantidade: 0, separador: '', maiusculas: false };
    const separador = s.includes(';') ? ';' : s.includes(',') ? ',' : '';
    const partes = s.split(separador || /\n/).map((p) => p.trim()).filter(Boolean);
    const maiusculas = partes.every((p) => /^[\p{Lu}\d]/u.test(p));
    return { quantidade: partes.length, separador, maiusculas, partes };
  }
  // Título no formato do modelo: afirmação (sem "?") e maiúsculas só na inicial e em nomes próprios.
  function analisarTitulo(texto) {
    const s = t(texto);
    const palavras = s.split(/\s+/).filter((p) => p.length > 3);
    const capitalizadas = palavras.slice(1).filter((p) => /^\p{Lu}/u.test(p)).length;
    return {
      vazio: !s || /\[escreva aqui\]/i.test(s),
      pergunta: /\?\s*$/.test(s) || /^como podemos/i.test(s),
      tudoMaiusculo: s.length > 8 && s === s.toUpperCase(),
      muitasMaiusculas: palavras.length >= 4 && capitalizadas / Math.max(1, palavras.length - 1) > 0.5
    };
  }

  // Campos narrativos do relato (para checar formato de perguntas e respostas).
  const CAMPOS_NARRATIVOS = ['contextualizacao', 'recursoP2', 'recursoP3', 'recursoP4', 'recursoP5', 'recursoP6', 'reflexaoCompetencias', 'resultados', 'proximosPassos', 'fechamento'];

  // d: campos do formulário; textoCompleto: texto integral do PDF (opcional)
  function alertas(d, textoCompleto) {
    const out = [];
    const add = (nivel, texto) => out.push({ nivel, texto });
    if (!t(d.nome) || PLACEHOLDER_NOME.test(d.nome)) add('erro', 'Nome não preenchido (consta o texto do modelo ou está vazio).');
    if (!t(d.matricula) || PLACEHOLDER_MATRICULA.test(d.matricula)) add('erro', 'Matrícula não preenchida.');
    if (orientadorVazio(d.orientador)) add('erro', 'Orientador(a) não selecionado(a) no documento.');

    const tit = analisarTitulo(d.titulo);
    if (tit.vazio) add('erro', 'Título ausente ou com o texto do modelo.');
    else {
      if (tit.pergunta) add('aviso', 'O título está em forma de pergunta; o modelo pede uma afirmação adaptada da pergunta-desafio.');
      if (tit.tudoMaiusculo || tit.muitasMaiusculas) add('aviso', 'O título usa maiúsculas além da inicial e dos nomes próprios.');
    }
    const palavras = contarPalavras(semOrientacoes(d.resumo));
    if (!palavras) add('erro', 'Resumo ausente.');
    else if (palavras < 150 || palavras > 250) add('aviso', `O resumo tem cerca de ${palavras} palavras; o modelo pede de 150 a 250.`);
    const pc = analisarPalavrasChave(d.palavrasChave);
    if (!pc.quantidade) add('erro', 'Palavras-chave ausentes.');
    else {
      if (pc.quantidade !== 3) add('aviso', `Foram identificadas ${pc.quantidade} palavras-chave; o modelo pede 3.`);
      if (pc.separador && pc.separador !== ';') add('aviso', 'As palavras-chave não estão separadas por ponto e vírgula.');
      if (!pc.maiusculas) add('aviso', 'Nem todas as palavras-chave começam com inicial maiúscula.');
    }

    const orientadores = textosOrientadoresEncontrados([textoCompleto || '', ...Object.values(d).map(t)].join('\n'));
    if (orientadores) add('aviso', `Permanecem ${orientadores} trecho(s) de orientação do modelo (texto azul) que deveriam ter sido apagados.`);
    const perguntas = CAMPOS_NARRATIVOS.reduce((n, k) => n + (t(d[k]).match(/\?/g) || []).length, 0);
    if (perguntas >= 6) add('aviso', `Há ${perguntas} pontos de interrogação nas partes narrativas: verifique se o relato não ficou no formato de perguntas e respostas.`);

    const so = (k) => semOrientacoes(d[k]);
    if (!so('contextualizacao')) add('erro', 'Contextualização pessoal e do desafio ausente (ou só com o texto do modelo).');
    ['P2', 'P3', 'P4', 'P5', 'P6'].forEach((p) => { if (!so('recurso' + p)) add('erro', `Parágrafo sobre a ${p} ausente (ou só com o texto do modelo).`); });
    if (!t(d.quadroCompetencias)) add('erro', 'Quadro de competências e ferramentas não identificado.');
    else if (/preencher conforme exemplos/i.test(d.quadroCompetencias)) add('aviso', 'O quadro de competências ainda contém "preencher conforme exemplos".');
    if (!so('reflexaoCompetencias')) add('aviso', 'Reflexão sobre as competências (prévias, não desenvolvidas e outras) não identificada.');
    if (!so('resultados')) add('erro', 'Análise dos resultados ausente.');
    if (!so('proximosPassos')) add('aviso', 'Próximos passos não identificados.');
    if (!so('fechamento')) add('aviso', 'Fechamento do relato (o que foi mais significativo) não identificado.');
    const ia = ['iaFerramentas', 'iaFinalidades', 'iaValidacao', 'iaImpacto'].map(so);
    const naoUsou = /n[aã]o utilizei ferramentas de ia/i.test(ia.join(' '));
    if (!ia.some(Boolean)) add('erro', 'Declaração sobre o uso de IA generativa não respondida.');
    else if (!naoUsou && ia.filter(Boolean).length < 4) add('aviso', 'A declaração de IA não responde a todas as questões (ferramentas, finalidades, interação e validação, impacto).');
    return out;
  }

  return { RUBRICA, ORDEM, pontosCriterio, maxCriterio, notaFinal, nivelValido, formatar, contarPalavras,
    textosOrientadoresEncontrados, semOrientacoes, analisarPalavrasChave, analisarTitulo, orientadorVazio, alertas, CAMPOS_NARRATIVOS };
});

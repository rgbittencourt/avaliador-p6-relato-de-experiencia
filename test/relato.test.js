const test = require('node:test');
const assert = require('node:assert');
const C = require('../public/relato-core.js');
const { avaliarLocalmente, montarPrompt, montarPromptExtracao, limparAvaliacao, CAMPOS_RELATO } = require('../server');

test('rubrica oficial: 6 critérios de 0 a 3 com pesos que somam 100', () => {
  assert.deepEqual(C.ORDEM, ['apresentacao','contextualizacao','recursos','competencias','resultados','transparencia']);
  assert.equal(C.ORDEM.reduce((s, k) => s + C.RUBRICA[k].peso, 0), 100);
  C.ORDEM.forEach(k => assert.deepEqual(C.RUBRICA[k].niveis.map(n => n.pontos), [0, 1, 2, 3]));
});

test('nota ponderada: soma(nível/3 × peso)/10', () => {
  const todos = n => Object.fromEntries(C.ORDEM.map(k => [k, n]));
  assert.equal(C.notaFinal(todos(3)), 10);
  assert.equal(C.notaFinal(todos(0)), 0);
  assert.equal(C.notaFinal({ ...todos(3), recursos: 2 }), 9.17);
  assert.equal(C.pontosCriterio('recursos', 3), 2.5);
  assert.equal(C.notaFinal({ apresentacao: 3 }), 1.5);
  assert.equal(C.nivelValido('recursos', 7), 3);
  assert.equal(C.nivelValido('recursos', 1.4), 1);
});

test('alertas de forma: identificação, título, resumo, palavras-chave e textos do modelo', () => {
  const textos = a => C.alertas(a).map(x => x.texto).join(' | ');
  const ruim = textos({ nome: 'SEU NOME', matricula: '', orientador: 'selecione', titulo: 'Como Podemos Usar Jogos?', resumo: 'curto demais', palavrasChave: 'Jogos, ensino', recursoP4: 'Escreva um parágrafo sobre o recurso produzido na P4, respondendo às seguintes perguntas:' });
  assert.match(ruim, /Nome não preenchido/);
  assert.match(ruim, /Orientador\(a\) não selecionado/);
  assert.match(ruim, /forma de pergunta/);
  assert.match(ruim, /maiúsculas/);
  assert.match(ruim, /cerca de 2 palavras/);
  assert.match(ruim, /2 palavras-chave/);
  assert.match(ruim, /ponto e vírgula/);
  assert.match(ruim, /orientação do modelo/);
  assert.match(ruim, /Parágrafo sobre a P2 ausente/);
  const resumo = Array(180).fill('palavra').join(' ');
  const bom = textos({ nome: 'Ana', matricula: '1', orientador: 'Prof. Rogério', titulo: 'O uso de jogos digitais no IFSC', resumo, palavrasChave: 'Jogos digitais; Ensino de química; Educação profissional' });
  assert.doesNotMatch(bom, /Nome|Matrícula|Orientador|Título|resumo tem|palavras-chave/);
  assert.equal(C.analisarPalavrasChave('Um; Dois; Três').quantidade, 3);
  assert.equal(C.contarPalavras('Isto é um teste, com cinco-palavras.'), 6);
});

test('declaração de não uso de IA atende o critério na avaliação local', () => {
  const r = avaliarLocalmente({ iaFerramentas: 'Não utilizei ferramentas de IA generativa na elaboração deste relato.' });
  assert.equal(r.pontuacoes.transparencia.pontos, 3);
  assert.equal(r.modo, 'local');
});

test('avaliação local é conservadora e calcula a nota ponderada', () => {
  const longo = n => Array(n).fill('aprendi com dificuldade').join(' ');
  const c = { nome: 'Ana', matricula: '1', orientador: 'Prof. Rogério', titulo: 'O uso de jogos', resumo: Array(180).fill('x').join(' '), palavrasChave: 'A; B; C',
    contextualizacao: 'Pesquisei autores e aprendi a usar ferramentas. ' + longo(40), desafio: 'Como podemos?', publicoAlvo: 'Estudantes',
    recursoP2: longo(25), recursoP3: longo(25), recursoP4: longo(25), recursoP5: longo(25), recursoP6: longo(25),
    quadroCompetencias: 'C1 | P1: x | P2: x', reflexaoCompetencias: longo(20), resultados: longo(20), proximosPassos: longo(20), fechamento: longo(20),
    iaFerramentas: 'ChatGPT', iaFinalidades: 'revisar a gramática do texto', iaValidacao: 'conferi tudo o que foi sugerido', iaImpacto: 'ajudou muito na escrita final' };
  const r = avaliarLocalmente(c);
  assert.equal(r.pontuacoes.apresentacao.pontos, 2, 'formatação exige conferência visual');
  assert.equal(r.pontuacoes.contextualizacao.pontos, 3);
  assert.equal(r.pontuacoes.recursos.pontos, 3);
  assert.equal(r.pontuacoes.competencias.pontos, 2);
  assert.equal(r.pontuacoes.resultados.pontos, 3);
  assert.equal(r.pontuacoes.transparencia.pontos, 3);
  assert.equal(r.nota, C.notaFinal({ apresentacao: 2, contextualizacao: 3, recursos: 3, competencias: 2, resultados: 3, transparencia: 3 }));
  assert.ok(r.feedback.endsWith('Um abraço,\nProf. Rogério'));
});

test('prompt de avaliação traz rubrica com pesos, alertas, regras de IA e padrão do feedback', () => {
  const p = montarPrompt({ nome: 'Ana Beatriz Souza', resumo: 'curto' });
  assert.match(p, /peso 25/);
  assert.match(p, /Olá, Ana,/);
  assert.match(p, /SOMENTE os critérios que não atingiram o nível máximo/);
  assert.match(p, /sem travessão/);
  assert.match(p, /não dá vantagem nem penalidade/);
  assert.match(p, /ALERTAS AUTOMÁTICOS/);
  assert.match(p, /"transparencia":\{"pontos":0/);
});

test('prompt de extração pede todos os campos e preserva textos do modelo esquecidos', () => {
  const p = montarPromptExtracao({ paginas: ['texto'], camposPreliminares: {} });
  CAMPOS_RELATO.forEach(k => assert.ok(p.includes(`"${k}":""`), k));
  assert.match(p, /MANTENHA nos campos qualquer texto de orientação/);
});

test('limparAvaliacao ajusta níveis, remove travessão e fixa a assinatura', () => {
  const r = limparAvaliacao({ pontuacoes: { recursos: { pontos: 5, justificativa: 'Bom — mas falta P4.' } }, feedback: 'Olá, Ana,\n\nTexto — com travessão.' });
  assert.equal(r.pontuacoes.recursos.pontos, 3);
  assert.equal(r.pontuacoes.recursos.justificativa, 'Bom, mas falta P4.');
  assert.ok(!r.feedback.includes('—'));
  assert.ok(r.feedback.endsWith('Um abraço,\nProf. Rogério'));
});

test('critério omitido pela IA fica sem nível, em vez de virar zero', () => {
  const r = limparAvaliacao({ pontuacoes: { recursos: { pontos: 2, justificativa: 'ok' } } });
  assert.equal(r.pontuacoes.recursos.pontos, 2);
  assert.equal(r.pontuacoes.apresentacao.pontos, null);
});

test('texto azul do modelo não conta como resposta', () => {
  const guia = 'Escreva um parágrafo sobre o recurso produzido na P4, respondendo às seguintes perguntas: Qual foi seu principal aprendizado na criação desse recurso? Qual foi sua principal dificuldade?';
  assert.equal(C.semOrientacoes(guia), '');
  assert.equal(C.semOrientacoes('Meu nome é (seu nome), sou (sua profissão ou formação). Aprendi muito no curso.'), 'Aprendi muito no curso.');
  const c = { recursoP2: guia, recursoP3: guia, recursoP4: guia, recursoP5: guia, recursoP6: guia, resultados: 'Escreva ao menos um parágrafo respondendo às seguintes perguntas: Quais foram os resultados?' };
  const r = avaliarLocalmente(c);
  assert.equal(r.pontuacoes.recursos.pontos, 0);
  assert.equal(r.pontuacoes.resultados.pontos, 0);
  assert.match(C.alertas(c).map(a => a.texto).join(' '), /P4 ausente \(ou só com o texto do modelo\)/);
});

test('frases fixas do modelo e a frase de não uso dentro da orientação não contam', () => {
  const ctx = 'Para elaborar este portfólio, realizamos 6 principais atividades, sendo a primeira delas (P1) relativa a escolha de um desafio para ser desenvolvido ao longo do curso. Escolhi o seguinte desafio para pesquisar durante o curso: (pergunta do seu desafio). Para entender melhor o desafio e propor recursos digitais e estratégias educacionais para solucionar o desafio, eu pesquisei e busquei informações sobre os seguintes assuntos:';
  assert.equal(C.semOrientacoes(ctx), '');
  assert.equal(C.semOrientacoes('Escolhi esse desafio porque os alunos faltavam muito.'), 'os alunos faltavam muito.');
  const iaGuia = 'descreva aqui quais ferramentas de IA (ex: ChatGPT, Gemini, etc.) você utilizou. Caso não tenha utilizado nenhuma ferramenta de IA, escreva apenas a declaração: "Não utilizei ferramentas de IA generativa na elaboração deste relato."';
  const r = avaliarLocalmente({ contextualizacao: ctx, desafio: '(pergunta do seu desafio).', iaFerramentas: iaGuia });
  assert.equal(r.pontuacoes.contextualizacao.pontos, 0);
  assert.equal(r.pontuacoes.transparencia.pontos, 0);
});

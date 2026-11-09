require('dotenv').config();
const express = require('express');
const path = require('path');
const Core = require('./public/relato-core.js');
const { RUBRICA, ORDEM } = Core;
const db = require('./db');
const {configIA, configDaRequisicao, chamarIA, statusIA} = require('./ia');
const { montarPromptCoerencia, limparSaidaCoerencia } = require('./coerencia');

const app = express();
const PORT = process.env.PORT || 3000;
const IA = configIA();
const APP_USERNAME = process.env.APP_USERNAME || 'professor';
const APP_PASSWORD = process.env.APP_PASSWORD || '';

if(process.env.NODE_ENV === 'production' && !APP_PASSWORD){
  throw new Error('APP_PASSWORD é obrigatória em produção.');
}
if(process.env.NODE_ENV === 'production' && !process.env.DATABASE_URL){
  throw new Error('DATABASE_URL é obrigatória em produção para impedir perda de turmas em armazenamento temporário.');
}

app.use((req,res,next)=>{
  if(!APP_PASSWORD || req.path === '/api/health' || !req.path.startsWith('/api/')) return next();
  const header = req.headers.authorization || '';
  let usuario='', senha='';
  try{ [usuario,senha] = Buffer.from(header.replace(/^Basic\s+/i,''),'base64').toString('utf8').split(':'); }catch{}
  if(usuario === APP_USERNAME && senha === APP_PASSWORD) return next();
  res.set('X-Login-Necessario', '1'); // sem WWW-Authenticate: a janela de login é a do app, não a do navegador
  return res.status(401).send('Autenticação necessária.');
});

app.use(express.json({limit:'4mb'}));
app.use((req,_res,next)=>{req.ia=configDaRequisicao(req);next();});
const chamarIAReq=(req,prompt,temperatura)=>chamarIA(prompt,temperatura,{config:req.ia});
app.use(express.static(path.join(__dirname,'public')));
app.get('/api/health',(_req,res)=>res.json({ok:true,openaiConfigurada:IA.configurada,...statusIA(IA),postgresConfigurado:Boolean(process.env.DATABASE_URL),backupGitHubConfigurado:Boolean(db.statusBackupGitHub().configurado)}));

function precisaChave(res){
  if(res.req.ia.configurada) return false;
  res.status(401).json({erro:`${res.req.ia.variavelChave} não configurada no servidor.`});
  return true;
}

app.get('/api/turmas',async(_req,res)=>{try{res.json(await db.listarTurmas());}catch(e){res.status(500).json({erro:e.message});}});
app.post('/api/turmas',async(req,res)=>{try{res.status(201).json(await db.criarTurma(req.body?.nome));}catch(e){res.status(400).json({erro:e.message});}});
app.patch('/api/turmas/:id',async(req,res)=>{try{res.json(await db.renomearTurma(req.params.id,req.body?.nome));}catch(e){res.status(400).json({erro:e.message});}});
app.delete('/api/turmas/:id',async(req,res)=>{try{res.json(await db.excluirTurma(req.params.id,req.body?.confirmarNome));}catch(e){res.status(400).json({erro:e.message});}});
app.get('/api/turmas/:id/avaliacoes',async(req,res)=>{try{res.json(await db.listarAvaliacoes(req.params.id));}catch(e){res.status(404).json({erro:e.message});}});
app.put('/api/turmas/:id/avaliacoes/:avaliacaoId',async(req,res)=>{try{res.json(await db.upsertAvaliacao(req.params.id,req.params.avaliacaoId,req.body));}catch(e){res.status(500).json({erro:e.message});}});
app.post('/api/importar-turma',async(req,res)=>{try{res.json(await db.importarTurma(req.body||{}));}catch(e){res.status(400).json({erro:e.message});}});
app.delete('/api/turmas/:id/avaliacoes/:avaliacaoId',async(req,res)=>{try{await db.removerAvaliacao(req.params.id,req.params.avaliacaoId);res.json({ok:true});}catch(e){res.status(500).json({erro:e.message});}});
app.delete('/api/turmas/:id/avaliacoes',async(req,res)=>{try{await db.limparAvaliacoes(req.params.id);res.json({ok:true});}catch(e){res.status(500).json({erro:e.message});}});
app.get('/api/backup/github',(_req,res)=>res.json(db.statusBackupGitHub()));
app.post('/api/backup/github',async(_req,res)=>{try{res.json(await db.sincronizarBackupGitHub());}catch(e){res.status(503).json({erro:e.message,...db.statusBackupGitHub()});}});

function textoCampo(valor){
  const s=String(valor||'').trim();
  return s || '(não preenchido)';
}

// Campos do relato extraídos do PDF (modelo oficial da P6).
const CAMPOS_RELATO = ['nome','matricula','orientador','titulo','resumo','palavrasChave','contextualizacao','desafio','publicoAlvo',
  'recursoP2','recursoP3','recursoP4','recursoP5','recursoP6','quadroCompetencias','reflexaoCompetencias',
  'resultados','proximosPassos','fechamento','iaFerramentas','iaFinalidades','iaValidacao','iaImpacto'];

function blocoDados(c={}){
  const palavrasResumo = Core.contarPalavras(c.resumo);
  return `Nome: ${textoCampo(c.nome)}
Matrícula: ${textoCampo(c.matricula)}
Orientador(a): ${textoCampo(c.orientador)}
Formato da entrega e observações do professor: ${textoCampo(c.conformidadeModelo)}
Link do documento (se entregue como Google Docs): ${textoCampo(c.linkDocumento)}

TÍTULO: ${textoCampo(c.titulo)}
RESUMO (${palavrasResumo} palavras contadas pelo aplicativo): ${textoCampo(c.resumo)}
PALAVRAS-CHAVE: ${textoCampo(c.palavrasChave)}

CONTEXTUALIZAÇÃO PESSOAL, DESAFIO E PERCURSO DE PESQUISA:
${textoCampo(c.contextualizacao)}
Pergunta-desafio identificada: ${textoCampo(c.desafio)}
Público-alvo identificado: ${textoCampo(c.publicoAlvo)}

P2 (vídeo e roteiro): ${textoCampo(c.recursoP2)}
P3 (proposta formativa): ${textoCampo(c.recursoP3)}
P4 (podcast): ${textoCampo(c.recursoP4)}
P5 (agente mediador com IA): ${textoCampo(c.recursoP5)}
P6 (relato e portfólio no Padlet): ${textoCampo(c.recursoP6)}

QUADRO DE COMPETÊNCIAS E FERRAMENTAS (reconstruído do PDF; marcações "x" por coluna P1 a P6):
${textoCampo(c.quadroCompetencias)}
Reflexão sobre as competências: ${textoCampo(c.reflexaoCompetencias)}

Resultados: ${textoCampo(c.resultados)}
Próximos passos: ${textoCampo(c.proximosPassos)}
Fechamento (o que foi mais significativo): ${textoCampo(c.fechamento)}

DECLARAÇÃO DE USO DE IA NA REDAÇÃO DO RELATO
Ferramentas: ${textoCampo(c.iaFerramentas)}
Finalidades: ${textoCampo(c.iaFinalidades)}
Interação e validação: ${textoCampo(c.iaValidacao)}
Impacto: ${textoCampo(c.iaImpacto)}`;
}

function montarPrompt(campos={}){
  const rubrica = ORDEM.map(chave=>{
    const c=RUBRICA[chave];
    return `${chave} — ${c.label} (peso ${c.peso}; escolha um nível de 0 a ${c.max}):\n${c.niveis.map(n=>`- nível ${n.pontos}: ${n.desc}`).join('\n')}`;
  }).join('\n\n');
  const alertas = Core.alertas(campos).map(a=>`- ${a.texto}`).join('\n') || '- nenhum';
  return `Você auxilia o Prof. Rogério a avaliar a atividade P6 - Relato de experiência (Portfólio II) do TEDPRO/IFSC. O relato é uma narrativa da trajetória do estudante no curso: definição do desafio, pesquisas, produção dos recursos P2 a P6, autoavaliação de competências, resultados, próximos passos e declaração de uso de IA. Aplique SOMENTE a rubrica oficial abaixo. Escolha exatamente um nível previsto em cada critério. Não premie extensão por si só.

REGRAS DE EVIDÊNCIA
- O texto vem de um PDF lido automaticamente. Formatação visual (recuo, espaçamento, alinhamento, cor do texto) não é visível no texto: use as observações do professor sobre formato quando houver e não penalize nem confirme formatação sem evidência.
- Restos do modelo (textos de orientação em azul, como "Escreva ao menos um parágrafo", "[Escreva aqui]", "(seu nome)", "preencher conforme exemplos") indicam orientações não removidas.
- O relato deve ser narrativo. Muitas perguntas copiadas do modelo seguidas de respostas indicam formato de perguntas e respostas.
- No quadro de competências, avalie a consistência do registro, não a quantidade de competências marcadas. No formato "C1 | P1: x | P2: | ...", só "x" é marcação; coluna vazia significa sem marcação. Exemplos do modelo mantidos sem adaptação (como as marcações e ferramentas de exemplo da coluna P1/P2) contam como não preenchidos.
- Na declaração de IA, usar ou não usar IA não dá vantagem nem penalidade. A frase "Não utilizei ferramentas de IA generativa na elaboração deste relato." atende integralmente ao critério.
- O reconhecimento de limitações nos resultados não é penalizado por si só.
- Produza justificativas específicas, citando evidências ou ausências concretas do relato.

ALERTAS AUTOMÁTICOS DO APLICATIVO (verificações de forma; confirme no texto)
${alertas}

RUBRICA OFICIAL
${rubrica}

RELATO EXTRAÍDO E REVISTO
${blocoDados(campos)}

FEEDBACK AO ESTUDANTE (campo "feedback")
- Comece exatamente com "Olá, ${String(campos.nome||'').trim().split(/\s+/)[0]||'estudante'},".
- Uma frase de reconhecimento geral do percurso, específica e sem elogios vazios.
- Comente SOMENTE os critérios que não atingiram o nível máximo, dizendo com clareza o que faltou e como melhorar. Não comente os critérios com nível máximo.
- Escreva em parágrafos, em segunda pessoa, sem listas e sem travessão (—).
- Termine exatamente com: Um abraço,\nProf. Rogério

Responda APENAS em JSON válido:
{"pontuacoes":{${ORDEM.map(k=>`"${k}":{"pontos":0,"justificativa":""}`).join(',')}},"alertas":[""],"feedback":""}`;
}

const semTravessao = (s) => String(s||'').replace(/\s*[—–]\s*/g, ', ').replace(/,\s*,/g, ',');

function limparAvaliacao(resultado={}){
  const pontuacoes={};
  const niveis={};
  for(const chave of ORDEM){
    const item=resultado.pontuacoes?.[chave]||{};
    const informado = item.pontos !== null && item.pontos !== undefined && item.pontos !== '' && Number.isFinite(Number(item.pontos));
    const pontos = informado ? Core.nivelValido(chave,item.pontos) : null; // critério omitido pela IA fica sem nível
    pontuacoes[chave]={pontos,justificativa:semTravessao(String(item.justificativa||'').trim())};
    niveis[chave]=pontos;
  }
  let feedback=semTravessao(String(resultado.feedback||'').trim()).replace(/\s*Um abraço,\s*Prof\. Rogério\s*$/i,'').trim();
  feedback += '\n\nUm abraço,\nProf. Rogério';
  return {pontuacoes,nota:Core.notaFinal(niveis),alertas:Array.isArray(resultado.alertas)?resultado.alertas.map(String).map(semTravessao).filter(Boolean):[],feedback};
}

app.post('/api/avaliar',async(req,res)=>{
  if(!req.ia.configurada) return res.json(avaliarLocalmente(req.body||{}));
  try{res.json({...limparAvaliacao(await chamarIAReq(req,montarPrompt(req.body||{}))),modo:req.ia.provedor});}
  catch(e){
    const fallback=avaliarLocalmente(req.body||{});
    fallback.modo='local-fallback';
    fallback.alertas.unshift(`A avaliação com IA não pôde ser concluída (${e.message}). A rubrica foi preenchida pela análise local conservadora; revise as notas.`);
    res.json(fallback);
  }
});

// Avaliação local conservadora: verifica presença e extensão das partes, não o mérito.
function avaliarLocalmente(original={}){
  // Considera só o texto do estudante: frases de orientação e perguntas do modelo não contam como resposta.
  const c = Object.fromEntries(Object.entries(original).map(([k,v]) => [k, typeof v === 'string' && !['nome','matricula','orientador','palavrasChave','quadroCompetencias'].includes(k) ? Core.semOrientacoes(v, {manterPerguntas: ['titulo','desafio','publicoAlvo'].includes(k)}) : v]));
  const pal = (x) => Core.contarPalavras(x);
  const tem = (x, n = 1) => pal(x) >= n;
  const al = Core.alertas(original);
  const avisos = (re) => al.some(a => re.test(a.texto));

  const identificacao = [c.nome, c.matricula, c.orientador, c.titulo, c.resumo, c.palavrasChave].filter(x => tem(x)).length;
  const orientadoresRestantes = Core.textosOrientadoresEncontrados(Object.values(original).join('\n'));
  // Modelo entregue essencialmente sem preenchimento (nível 0 da rubrica de apresentação).
  const modeloEmBranco = orientadoresRestantes >= 8 && (!String(original.nome||'').trim() || /^\s*seu nome\s*$/i.test(original.nome));
  let apresentacao;
  if (modeloEmBranco || (!identificacao && !tem(c.contextualizacao))) apresentacao = 0;
  else if (identificacao < 5 || orientadoresRestantes >= 3 || avisos(/perguntas e respostas/)) apresentacao = 1;
  else if (avisos(/título|resumo|palavras-chave|orientação do modelo|Orientador/)) apresentacao = 2;
  else apresentacao = 2; // formatação do resumo e retirada de todo texto azul exigem conferência visual

  const ctx = String(c.contextualizacao || '');
  const temPesquisa = /pesquis|leitur|autor|refer[eê]ncia|artigo|estudo/i.test(ctx);
  const temFerramentas = /ferrament|aprendi a (usar|utilizar)|tutoria|aprend/i.test(ctx);
  let contextualizacao;
  if (!tem(ctx)) contextualizacao = 0;
  else if (pal(ctx) < 80 || !tem(c.desafio) || !tem(c.publicoAlvo)) contextualizacao = 1;
  else if (!temPesquisa || !temFerramentas) contextualizacao = 2;
  else contextualizacao = 3;

  const recursos = ['P2','P3','P4','P5','P6'].map(p => String(c['recurso'+p] || ''));
  const presentes = recursos.filter(r => tem(r, 25)).length;
  const completos = recursos.filter(r => tem(r, 60) && /aprend/i.test(r) && /dificuldad|desafi/i.test(r)).length;
  const nivelRecursos = presentes === 0 ? 0 : presentes < 5 ? 1 : completos === 5 ? 3 : 2;

  const quadroOk = tem(c.quadroCompetencias, 5) && !/preencher conforme exemplos/i.test(c.quadroCompetencias);
  const reflexaoOk = tem(c.reflexaoCompetencias, 40);
  const competencias = modeloEmBranco || (!tem(c.quadroCompetencias) && !tem(c.reflexaoCompetencias)) ? 0 : (quadroOk && reflexaoOk) ? 2 : 1;

  const partesResultados = [c.resultados, c.proximosPassos, c.fechamento];
  const resultados = partesResultados.every(x => !tem(x)) ? 0
    : partesResultados.every(x => tem(x, 40)) ? 3
    : partesResultados.every(x => tem(x)) ? 2 : 1;

  const ia = [c.iaFerramentas, c.iaFinalidades, c.iaValidacao, c.iaImpacto];
  const naoUsou = /n[aã]o utilizei ferramentas de ia/i.test(ia.join(' '));
  const transparencia = naoUsou ? 3 : (tem(c.iaFerramentas) && [c.iaFinalidades, c.iaValidacao, c.iaImpacto].every(x => tem(x, 5))) ? 3 : (tem(c.iaFerramentas) && tem(c.iaFinalidades)) ? 2 : ia.some(x => tem(x)) ? 1 : 0;

  const just = {
    apresentacao: modeloEmBranco ? 'O documento mantém o modelo essencialmente sem preenchimento (nome do modelo e numerosos textos de orientação).' : `Identificação, título, resumo e palavras-chave: ${identificacao} de 6 partes presentes; ${orientadoresRestantes} trecho(s) de orientação do modelo encontrados. A formatação do resumo e a remoção de todo o texto azul precisam de conferência visual no PDF.`,
    contextualizacao: `Contextualização com cerca de ${pal(ctx)} palavras; desafio ${tem(c.desafio)?'identificado':'não identificado'}; público-alvo ${tem(c.publicoAlvo)?'identificado':'não identificado'}; ${temPesquisa?'há':'não há'} menção a pesquisas ou referências; ${temFerramentas?'há':'não há'} menção à aprendizagem das ferramentas.`,
    recursos: `Parágrafos identificados para ${presentes} das 5 atividades (P2 a P6); ${completos} trazem aprendizagens e dificuldades com algum desenvolvimento.`,
    competencias: `Quadro ${quadroOk?'preenchido':'ausente ou com texto do modelo'}; reflexão sobre competências ${reflexaoOk?'presente':'ausente ou breve'}. A consistência das marcações precisa ser conferida no PDF.`,
    resultados: `Resultados, próximos passos e fechamento: ${partesResultados.filter(x=>tem(x)).length} de 3 partes presentes.`,
    transparencia: naoUsou ? 'Apresenta a declaração de não uso prevista no modelo.' : `A declaração de IA responde a ${ia.filter(x=>tem(x)).length} das 4 questões orientadoras.`
  };
  const niveis = {apresentacao, contextualizacao, recursos: nivelRecursos, competencias, resultados, transparencia};
  const pontuacoes = {};
  ORDEM.forEach(k => { pontuacoes[k] = {pontos: niveis[k], justificativa: just[k]}; });
  const resultado = limparAvaliacao({pontuacoes, alertas:['Avaliação automática local: verifica presença e extensão das partes, não o mérito. Revise cada critério lendo o relato.'], feedback:'A avaliação automática local verificou a presença das partes do relato. Revise as justificativas da rubrica e ajuste a pontuação após a leitura do texto.'});
  return {...resultado, modo:'local'};
}

function montarPromptExtracao({paginas=[],camposPreliminares={}}={}){
  const textoPaginas=(Array.isArray(paginas)?paginas:[]).slice(0,30).map((p,i)=>`\n===== PÁGINA ${i+1} =====\n${String(p||'').slice(0,30000)}`).join('\n');
  return `Extraia fielmente as partes de um RELATO DE EXPERIÊNCIA preenchido da atividade P6 (Portfólio II, TEDPRO/IFSC), escrito no modelo oficial.

ESTRUTURA DO MODELO
Página 1: Nome completo, Número de matrícula, Orientador(a), TÍTULO, RESUMO, PALAVRAS-CHAVE.
Depois, "RELATO DE EXPERIÊNCIA" em narrativa: apresentação pessoal (profissão/formação, cidade, motivação), o desafio (pergunta) e o público-alvo, motivos e eventuais alterações, pesquisas para definir o desafio e decidir os recursos, aprendizagem das ferramentas; em seguida um parágrafo para cada recurso, sob os títulos "P2: vídeo e roteiro...", "P3: proposta formativa...", "P4: podcast...", "P5: agente mediador com IA...", "P6: relato de experiência e finalização do Padlet..."; depois "Produzindo esses recursos, desenvolvi algumas competências..." com um QUADRO (linhas C1 a C4, "Não adquiri nenhuma das competências", "Ferramentas que aprendi e/ou usei"; colunas P1 a P6) e um parágrafo de reflexão sobre competências; depois resultados ("Considerando o desafio que escolhi..."), próximos passos ("Com base nos resultados obtidos...") e fechamento ("Ao finalizar este relato de experiência..."); por fim a "DECLARAÇÃO DE USO DE INTELIGÊNCIA ARTIFICIAL" com quatro itens: ferramentas, como foram usadas, interação e validação, impacto.

REGRAS OBRIGATÓRIAS
- Copie o texto do estudante sem resumir, melhorar ou inventar. Remova cabeçalhos, rodapés, números de página e os títulos/rótulos do modelo.
- MANTENHA nos campos qualquer texto de orientação do modelo que o estudante não apagou (por exemplo "Escreva ao menos um parágrafo...", "(seu nome)", "[Escreva aqui]", "preencher conforme exemplos"): isso é evidência para a avaliação. Só remova os rótulos fixos de seção.
- "contextualizacao": todo o texto narrativo entre "RELATO DE EXPERIÊNCIA" e o parágrafo da P2 (inclusive a frase que introduz a lista de recursos).
- "desafio": só a pergunta-desafio citada; "publicoAlvo": só o público-alvo declarado. Se não houver, "".
- "recursoP2" a "recursoP6": o texto do estudante sob cada título correspondente.
- "quadroCompetencias": se o campo preliminar já estiver no formato "C1 | P1: x | P2: | ...", COPIE-O sem alterar (ele foi lido pela posição das colunas). Senão, reconstrua o quadro em linhas de texto, uma por linha do quadro (C1, C2, C3, C4, "Não adquiri nenhuma"), no formato "C1 | P1: x | P2: | P3: x | P4: | P5: | P6:", e a linha de ferramentas como "Ferramentas | P1: ... | P2: ... | ... | P6: ...", com as ferramentas SEPARADAS por coluna. Só "x" ou "X" é marcação; "-", " - ", espaço ou célula vazia significam SEM marcação. Se as colunas não puderem ser identificadas com segurança, transcreva o conteúdo e acrescente "(colunas incertas)".
- "reflexaoCompetencias": o parágrafo após o quadro sobre competências prévias, não desenvolvidas e outras.
- "resultados", "proximosPassos", "fechamento": os parágrafos correspondentes.
- "iaFerramentas", "iaFinalidades", "iaValidacao", "iaImpacto": as respostas aos quatro itens da declaração. Se o estudante escreveu apenas "Não utilizei ferramentas de IA generativa na elaboração deste relato.", coloque essa frase em "iaFerramentas" e deixe os demais vazios.
- Campo ausente ou só com o rótulo do modelo deve ser "".

CAMPOS PRELIMINARES (podem estar errados; use apenas como pista)
${JSON.stringify(camposPreliminares)}

TEXTO EXTRAÍDO POR PÁGINA
${textoPaginas}

Responda APENAS com JSON válido, contendo todas estas chaves:
{${CAMPOS_RELATO.map(k=>`"${k}":""`).join(',')}}`;
}

function limparExtracaoSemantica(resultado={}){
  const saida={};
  for(const chave of CAMPOS_RELATO) saida[chave]=String(resultado?.[chave]||'').trim();
  return saida;
}

app.post('/api/extrair-relatorio',async(req,res)=>{
  if(precisaChave(res)) return;
  try{res.json(limparExtracaoSemantica(await chamarIAReq(req,montarPromptExtracao(req.body||{}),0)));}
  catch(e){res.status(502).json({erro:e.message});}
});

// ---------- Coerência (complementar, sem pontuação) ----------
const ASSINATURA_COERENCIA = () => 'Prof. Rogério';
function atividadeCoerencia(c = {}) {
  return {
    nome: 'P6 - Relato de experiência (fechamento do portfólio)',
    produto: 'relato da trajetória no curso e do conjunto de recursos produzidos (P2 a P5) e de seus resultados',
    cadeia: 'desafio -> público-alvo -> pesquisas -> recursos produzidos (P2 vídeo, P3 proposta formativa, P4 podcast, P5 agente de IA) -> aplicação e opinião do público -> resultados -> próximos passos',
    criterios: [
      'Pergunte se, pelo que o relato mostra, o conjunto de recursos produzidos e os resultados narrados de fato ajudam a enfrentar o desafio para aquele público, ou se os recursos ficaram como entregas isoladas, apenas sobre o tema.',
      'Verifique se cada recurso narrado (P2 a P5) tem uma contribuição clara para o desafio e para o público, e se juntos formam um percurso que converge para o desafio.',
      'Verifique se os resultados e a opinião do público sustentam a utilidade alegada, e se os próximos passos atacam o que ainda falta para resolver o desafio.',
      'Não avalie a qualidade da escrita nem o preenchimento do modelo: isso já está na rubrica.'
    ],
    evidencia: 'Diferencie o que o estudante relata ter feito e observado do que apenas pretende fazer. Não invente resultados ou reações do público.',
    campos: [
      ['Nome', c.nome], ['Título', c.titulo], ['Desafio', c.desafio], ['Público-alvo', c.publicoAlvo],
      ['Contextualização e percurso de pesquisa', c.contextualizacao],
      ['P2 (vídeo e roteiro)', c.recursoP2], ['P3 (proposta formativa)', c.recursoP3], ['P4 (podcast)', c.recursoP4],
      ['P5 (agente de IA)', c.recursoP5], ['P6 (relato e Padlet)', c.recursoP6],
      ['Resultados', c.resultados], ['Próximos passos', c.proximosPassos]
    ]
  };
}

app.post('/api/analisar-coerencia', async (req, res) => {
  if (!req.ia.configurada) return res.status(401).json({ erro: `${req.ia.variavelChave} não configurada no servidor. A análise de coerência precisa de IA.` });
  const campos = req.body || {};
  try { res.json(limparSaidaCoerencia(await chamarIAReq(req, montarPromptCoerencia(atividadeCoerencia(campos)), 0.25), ASSINATURA_COERENCIA(campos))); }
  catch (e) { res.status(e.status || 502).json({ erro: e.message }); }
});

app.use((err,_req,res,_next)=>res.status(500).json({erro:err.message||'Erro interno.'}));

if(require.main===module) app.listen(PORT,()=>console.log(`Avaliador P6 em http://localhost:${PORT}`));
module.exports={app,atividadeCoerencia,montarPrompt,montarPromptExtracao,limparExtracaoSemantica,limparAvaliacao,avaliarLocalmente,CAMPOS_RELATO};

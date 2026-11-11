/* Avaliador P6 · Relato de experiência (TEDPRO/IFSC) */
const C=window.RelatoCore;
const RUBRIC=C.RUBRICA;
const ORDER=C.ORDEM;
const FIELD_IDS=['nome','matricula','orientador','titulo','resumo','palavrasChave','conformidadeModelo','linkDocumento','contextualizacao','desafio','publicoAlvo','recursoP2','recursoP3','recursoP4','recursoP5','recursoP6','quadroCompetencias','reflexaoCompetencias','resultados','proximosPassos','fechamento','iaFerramentas','iaFinalidades','iaValidacao','iaImpacto'];
let classes=[],evaluations=[],currentEvaluationId=null,authHeader=sessionStorage.getItem('p6Auth')||'',rawPdfPages=[],pagePreviews=[],rawItemPages=[],quadroLidoPorPosicao=false;
const $=id=>document.getElementById(id);
const value=id=>$(id)?.type==='checkbox'?($(id).checked?'Sim, verificado':'Não verificado'):($(id)?.value||'').trim();
const escapeHtml=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const slug=s=>String(s||'avaliacao').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,80)||`avaliacao-${Date.now()}`;

async function api(url,options={}){
  const headers={...(options.headers||{}),...(window.SeletorIA?SeletorIA.cabecalho():{})};
  if(authHeader) headers.Authorization=authHeader;
  if(options.body && !(options.body instanceof FormData)) headers['Content-Type']='application/json';
  let response=await fetch(url,{...options,headers});
  if(response.status===401&&response.headers.get('X-Login-Necessario')){
    const login=await SeletorIA.pedirLogin('professor'); if(!login) throw new Error('Autenticação cancelada.');
    authHeader=SeletorIA.basic(login.usuario,login.senha); sessionStorage.setItem('p6Auth',authHeader);
    response=await fetch(url,{...options,headers:{...headers,...SeletorIA.cabecalho(),Authorization:authHeader}});
    if(response.status===401){authHeader='';sessionStorage.removeItem('p6Auth');SeletorIA.esquecerLogin();throw new Error('Usuário ou senha incorretos.');}
  }
  const text=await response.text(); let data; try{data=JSON.parse(text);}catch{data={erro:text||`Erro ${response.status}`};}
  if(!response.ok) throw new Error(data.erro||`Erro ${response.status}`);
  return data;
}
const fmt=n=>C.formatar(n);

function renderRubric(){
  $('rubric').innerHTML=ORDER.map(key=>{const c=RUBRIC[key];return `<fieldset><legend>${escapeHtml(c.label)} <span class="weight">(peso ${c.peso} · até ${fmt(C.maxCriterio(key))} na nota)</span></legend>${c.niveis.map(n=>`<label class="level"><input type="radio" name="rub_${key}" value="${n.pontos}"><span>${escapeHtml(n.desc)}</span><span class="pts">nível ${n.pontos} · ${fmt(C.pontosCriterio(key,n.pontos))}</span></label>`).join('')}<label>Observação do avaliador</label><textarea id="obs_${key}" placeholder="Evidência, ponto forte, ausência ou orientação personalizada."></textarea></fieldset>`}).join('');
  $('rubric').addEventListener('change',()=>{updateScore();generateLocalFeedback(false);});
  ORDER.forEach(k=>$(`obs_${k}`).addEventListener('input',()=>generateLocalFeedback(false)));
}
function selected(key){const el=document.querySelector(`input[name="rub_${key}"]:checked`);return el?Number(el.value):null;}
function setScore(key,level){const el=document.querySelector(`input[name="rub_${key}"][value="${level}"]`);if(el)el.checked=true;}
function levels(){const o={};ORDER.forEach(k=>o[k]=selected(k));return o;}
function total(){return C.notaFinal(levels());}
function updateScore(){
  $('scoreTotal').textContent=fmt(total());
  $('scoreTable').innerHTML=ORDER.map(k=>{const c=RUBRIC[k],p=selected(k);const cls=p===null?'mid':p===c.max?'max':p===0?'zero':'mid';return `<tr><td>${escapeHtml(c.curto)}<span class="hint"> · peso ${c.peso}</span></td><td style="text-align:right"><span class="badge ${cls}">${p===null?'—':`${p}/${c.max}`}</span><span class="pts-crit">${p===null?'':`${fmt(C.pontosCriterio(k,p))} de ${fmt(C.maxCriterio(k))}`}</span></td></tr>`}).join('');
  renderAlerts();
}
function fullText(){return rawPdfPages.join('\n');}
function automaticAlerts(){const out=C.alertas(formData(),fullText());if(ORDER.some(k=>selected(k)===null))out.push({nivel:'aviso',texto:'Há critérios da rubrica ainda não avaliados.'});return out;}
function renderAlerts(){
  const manual=value('manualAlerts').split('\n').map(s=>s.trim()).filter(Boolean).map(texto=>({nivel:'aviso',texto}));
  const all=[...automaticAlerts(),...manual];
  $('alerts').innerHTML=all.length?all.map(a=>`<div class="alert ${a.nivel==='erro'?'':'info'}">${escapeHtml(a.texto)}</div>`).join(''):'<div class="ok">Nenhum alerta pendente.</div>';
  updateCounters();
}
function updateCounters(){
  const n=C.contarPalavras(value('resumo'));const r=$('resumoContador');
  r.textContent=n?`${n} palavras (o modelo pede de 150 a 250)`:'';r.className='counter '+(n>=150&&n<=250?'okc':n?'badc':'');
  const pc=C.analisarPalavrasChave(value('palavrasChave'));const k=$('palavrasContador');
  k.textContent=pc.quantidade?`${pc.quantidade} palavra(s)-chave${pc.separador&&pc.separador!==';'?' · separador diferente de ponto e vírgula':''}${pc.maiusculas?'':' · verifique as iniciais maiúsculas'}`:'';
  k.className='counter '+(pc.quantidade===3&&(pc.separador===';'||!pc.separador)&&pc.maiusculas?'okc':pc.quantidade?'badc':'');
}
// Feedback no padrão do Prof. Rogério: saudação, reconhecimento, só critérios abaixo do máximo, despedida.
function generateLocalFeedback(overwrite=true){
  if(!overwrite && value('feedback'))return;
  const first=value('nome').split(/\s+/)[0]||'estudante';
  const lines=[`Olá, ${first},`,`Obrigado por compartilhar o seu relato de experiência e a trajetória que você construiu ao longo do curso. A avaliação da sua P6 resultou em ${fmt(total())} de 10 pontos.`];
  const abaixo=ORDER.filter(k=>{const p=selected(k);return p!==null&&p<RUBRIC[k].max;});
  if(abaixo.length){lines.push('Para aprimorar o seu relato, observe os pontos a seguir.');for(const k of abaixo){const p=selected(k);const obs=value(`obs_${k}`);lines.push(`${RUBRIC[k].label}: ${obs||RUBRIC[k].niveis.find(n=>n.pontos===p)?.desc||''}`);}}
  else if(ORDER.every(k=>selected(k)!==null))lines.push('Todos os critérios da rubrica foram atendidos plenamente. Parabéns pelo cuidado com o relato e com o portfólio.');
  lines.push('Um abraço,\nProf. Rogério');
  $('feedback').value=lines.join('\n\n').replace(/\s*[—–]\s*/g,', ');
}
function formData(){const d={};FIELD_IDS.forEach(id=>d[id]=value(id));return d;}

async function autoEvaluate(){
  const b=$('autoEvaluate');b.disabled=true;b.textContent='Analisando...';
  try{const r=await api('/api/avaliar',{method:'POST',body:JSON.stringify(formData())});let preenchidos=0;for(const k of ORDER){const x=r.pontuacoes?.[k];if(x&&x.pontos!==null&&x.pontos!==undefined&&Number.isFinite(Number(x.pontos))){setScore(k,Number(x.pontos));$(`obs_${k}`).value=x.justificativa||'';preenchidos++;}}if(preenchidos!==ORDER.length)throw new Error(`a resposta preencheu apenas ${preenchidos} de ${ORDER.length} critérios`);$('manualAlerts').value=(r.alertas||[]).join('\n');$('feedback').value=r.feedback||'';const nomes={openai:'OpenAI',anthropic:'Claude'};$('autoEvaluateStatus').textContent=r.modo==='local-fallback'?'A IA não concluiu a análise. A rubrica foi preenchida pela avaliação local conservadora; revise as notas.':r.modo==='local'?'Avaliação automática local concluída (verifica presença das partes, não o mérito). Revise cada critério.':`Avaliação com IA (${nomes[r.modo]||'IA'}) concluída. Revise as sugestões antes de salvar.`;updateScore();}
  catch(e){$('autoEvaluateStatus').textContent=`Não foi possível avaliar: ${e.message}`;}finally{b.disabled=false;b.textContent='✨ Avaliar automaticamente';}
}

/* ---------- leitura do PDF ---------- */
function normalizePdfText(s){return String(s||'').replace(/​/g,'').replace(/\s+fi\s+/gi,'fi').replace(/desa\s+fi\s+o/gi,'desafio').replace(/[ \t]+$/gm,'');}
function layoutRows(content){const rows=[];for(const item of content.items){const x=item.transform[4],y=item.transform[5],width=item.width||0;let row=rows.find(r=>Math.abs(r.y-y)<2.2);if(!row){row={y,items:[]};rows.push(row);}row.items.push({x,width,text:item.str});}rows.sort((a,b)=>b.y-a.y);for(const row of rows)row.items.sort((a,b)=>a.x-b.x);return rows;}
function rowText(row){let line='',end=null;for(const item of row.items){if(end!==null){const gap=item.x-end;line+=gap>28?'\t':gap>2?' ':'';}line+=item.text;end=item.x+item.width;}return line.trimEnd();}
// Remove rodapés (números de página), cabeçalho do curso e junta linhas de parágrafo.
function cleanBlock(s,{keepLines=false}={}){
  let out=String(s||'').replace(/^\s*\d{1,2}\s*$/gm,'').replace(/^\s*Especializa[cç][aã]o lato sensu[^\n]*$/gim,'');
  out=out.replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
  if(keepLines)return out;
  return out.split(/\n\s*\n/).map(p=>p.replace(/\s*\n\s*/g,' ').trim()).filter(Boolean).join('\n\n');
}
function firstIndex(text,res,from=0){let best=-1,len=0;for(const re of res){const r=new RegExp(re.source,re.flags.includes('g')?re.flags:re.flags+'g');r.lastIndex=from;const m=r.exec(text);if(m&&(best<0||m.index<best)){best=m.index;len=m[0].length;}}return {index:best,length:len};}
// Texto entre o marcador inicial e o primeiro dos marcadores finais encontrados depois dele.
function section(text,start,ends,opts){const a=firstIndex(text,[start]);if(a.index<0)return'';const from=a.index+a.length;const b=firstIndex(text,ends,from);return cleanBlock(text.slice(from,b.index<0?undefined:b.index),opts);}
const MARCAS={
  titulo:/T[ÍI]TULO:/i, resumo:/RESUMO:/i, palavras:/PALAVRAS[- ]CHAVE:/i, relato:/RELATO DE EXPERI[ÊE]NCIA\s*\n/i,
  p2:/\n\s*P2:[^\n]*/i, p3:/\n\s*P3:[^\n]*/i, p4:/\n\s*P4:[^\n]*/i, p5:/\n\s*P5:[^\n]*/i, p6:/\n\s*P6:[^\n]*/i,
  competencias:/Produzindo esses recursos,?\s*desenvolvi(?:[\s\S]{0,160}?quadro a seguir:|[^\n]*)/i, resultados:/Considerando o desafio que escolhi(?:[\s\S]{0,160}?seguintes resultados:|[^\n]*)|^[ \t]*RESULTADOS(?:[ \t]+[A-ZÀ-Ü,]+)*[ \t]*$/im,
  passos:/Com base nos resultados obtidos(?:[\s\S]{0,200}?considero que:|[^\n]*)|^[ \t]*PR[ÓO]XIMOS PASSOS[ \t]*$/im, fechamento:/^[ \t]*CONSIDERA[ÇC][ÕO]ES FINAIS[ \t]*$|Ao finalizar este relato(?: de experi[êe]ncia)?[.…]*/im,
  declaracao:/DECLARA[ÇC][ÃA]O DE USO DE INTELIG[ÊE]NCIA ARTIFICIAL/i,
  iaFerr:/Ferramentas de IA usadas:/i, iaUso:/Como as ferramentas de IA foram usadas[^:]*:/i, iaVal:/Como foi o processo de intera[çc][ãa]o e valida[çc][ãa]o[^:]*:/i, iaImp:/Impacto do uso da IA:/i
};
// Continuação dos títulos P2 a P6 que vai para a linha seguinte, ex.: "P3 da UC Portfólio I)."
const continuacaoTitulo=s=>s.replace(/^\s*(?:da\s+)?UC\s+Portf[óo]lio\s+I{1,2}\)\.?\s*/i,'').replace(/^\s*(?:recurso\s+)?(?:na\s+)?P\d\s+da\s+UC\s+Portf[óo]lio\s+I{1,2}\)\.?\s*/i,'').replace(/^\s*Portf[óo]lio\s+I{1,2}\)\.?\s*/i,'').replace(/^\s*recurso na P\d da UC Portf[óo]lio I{1,2}\)\.?\s*/i,'');
// Separa o quadro de competências do parágrafo de reflexão que vem logo depois dele.
function separarQuadro(bloco){
  const linhas=String(bloco||'').split('\n');const f=linhas.findIndex(l=>/Ferramentas que aprendi/i.test(l));
  if(f<0)return [bloco,''];
  let j=f+1;while(j<linhas.length&&(!linhas[j].trim()||linhas[j].includes('\t')||linhas[j].trim().length<70))j++;
  return [cleanBlock(linhas.slice(0,j).join('\n'),{keepLines:true}),cleanBlock(linhas.slice(j).join('\n'))];
}
function applyPreliminaryExtraction(text,fileName=''){
  const linha=re=>{const m=text.match(re);return m?m[1].trim():'';};
  let nome=linha(/Nome completo:\s*([^\n]*)/i);if(!nome){const m=String(fileName).match(/\(([^()]+)\)\s*\.pdf$/i);nome=m?.[1]?.trim()||'';}
  $('nome').value=nome;$('matricula').value=linha(/(?:N[úu]mero de matr[íi]cula|Matr[íi]cula):\s*([^\n]*)/i);$('orientador').value=linha(/Orientador\(a\):\s*([^\n]*)/i);
  const M=MARCAS;
  $('titulo').value=section(text,M.titulo,[M.resumo]).replace(/\s*\n+\s*/g,' ');
  $('resumo').value=section(text,M.resumo,[M.palavras]);
  $('palavrasChave').value=section(text,M.palavras,[M.relato,/\n\s*\d+\s*\n/]).split('\n\n')[0].replace(/\s*\n\s*/g,' ');
  $('contextualizacao').value=section(text,M.relato,[M.p2,M.p3,M.competencias]);
  const ctx=value('contextualizacao');
  const desafio=ctx.match(/desafio para pesquisar durante o curso:?\s*([^\n]*?\?)/i)||ctx.match(/(Como podemos[^?]*\?)/i);$('desafio').value=desafio?desafio[1].trim():'';
  const publico=ctx.match(/p[úu]blico[- ]alvo do meu desafio (?:s[ãa]o|[ée])\s*([^.\n]*)/i);$('publicoAlvo').value=publico?publico[1].trim():'';
  const fins=[M.p3,M.p4,M.p5,M.p6,M.competencias];
  $('recursoP2').value=continuacaoTitulo(section(text,M.p2,fins));
  $('recursoP3').value=continuacaoTitulo(section(text,M.p3,fins.slice(1)));
  $('recursoP4').value=continuacaoTitulo(section(text,M.p4,fins.slice(2)));
  $('recursoP5').value=continuacaoTitulo(section(text,M.p5,fins.slice(3)));
  $('recursoP6').value=continuacaoTitulo(section(text,M.p6,[M.competencias,M.resultados]));
  const [quadro,reflexao]=separarQuadro(section(text,M.competencias,[M.resultados],{keepLines:true}));
  $('quadroCompetencias').value=quadro;$('reflexaoCompetencias').value=reflexao;
  $('resultados').value=section(text,M.resultados,[M.passos,M.fechamento,M.declaracao]);
  $('proximosPassos').value=section(text,M.passos,[M.fechamento,M.declaracao]);
  $('fechamento').value=section(text,M.fechamento,[M.declaracao]).replace(/^[\s,;.:…-]+/,'');
  const decl=section(text,M.declaracao,[/$^/],{keepLines:true});
  const iaFerr=section(decl,M.iaFerr,[M.iaUso,M.iaVal,M.iaImp]),iaUso=section(decl,M.iaUso,[M.iaVal,M.iaImp]),iaVal=section(decl,M.iaVal,[M.iaImp]),iaImp=section(decl,M.iaImp,[/$^/]);
  $('iaFerramentas').value=iaFerr||(/n[ãa]o utilizei ferramentas de ia/i.test(decl)?'Não utilizei ferramentas de IA generativa na elaboração deste relato.':'');
  $('iaFinalidades').value=iaUso;$('iaValidacao').value=iaVal;$('iaImpacto').value=iaImp;
}
function renderPageGallery(){$('pageGallery').innerHTML=pagePreviews.map((src,i)=>`<button type="button" class="page-thumb" data-page="${i}"><img src="${src}" alt="Miniatura da página ${i+1}"><span>Página ${i+1} · ampliar</span></button>`).join('');}
function openPage(index){$('modalTitle').textContent=`Página ${index+1} do relato`;$('modalImage').src=pagePreviews[index];$('pageModal').classList.remove('hidden');document.body.style.overflow='hidden';}
function closePage(){$('pageModal').classList.add('hidden');$('modalImage').src='';document.body.style.overflow='';}
async function semanticExtract(){
  if(!rawPdfPages.length)return alert('Importe um PDF primeiro.');const b=$('semanticExtract');b.disabled=true;b.textContent='Interpretando...';$('pdfStatus').textContent='Separando os parágrafos do relato e reconstruindo o quadro de competências...';
  try{const result=await api('/api/extrair-relatorio',{method:'POST',body:JSON.stringify({paginas:rawPdfPages,camposPreliminares:formData()})});let mantidos=0;for(const [key,val] of Object.entries(result)){if(!$(key))continue;if(key==='quadroCompetencias'&&quadroLidoPorPosicao)continue;const novo=String(val||'').trim();if(!novo&&value(key)){mantidos++;continue;}$(key).value=novo;}$('pdfStatus').textContent=`Interpretação semântica concluída${mantidos?` (${mantidos} campo(s) que a IA deixou vazios mantiveram a leitura por seções)`:''}. Revise os campos e confira o quadro de competências nas páginas do relato.`;checkDuplicate();renderAlerts();}
  catch(e){$('pdfStatus').textContent=`Não foi possível interpretar semanticamente: ${e.message}. Os campos preliminares, separados pelas seções do modelo, permanecem disponíveis para revisão.`;}finally{b.disabled=false;b.textContent='Reinterpretar campos com IA';}
}
// Quadro de competências lido pela posição das colunas no PDF (mais confiável que o texto corrido).
function lerQuadroPorPosicao(){
  quadroLidoPorPosicao=false;
  if(!window.QuadroCompetencias||!rawItemPages.length)return;
  try{const q=QuadroCompetencias.ler(rawItemPages);if(q.ok){$('quadroCompetencias').value=QuadroCompetencias.comoTexto(q);quadroLidoPorPosicao=true;}
    $('quadroStatus').textContent=q.ok?'✔ Quadro lido pela posição das colunas P1 a P6 (só "x" conta como marcação). Confira com a página do relato.':`Leitura do quadro pela posição não foi possível (${q.motivo}); a interpretação com IA vai tentar reconstruí-lo.`;}
  catch(e){$('quadroStatus').textContent=`Leitura do quadro pela posição falhou (${e.message}).`;}
  renderQuadro();
}
// Mostra o quadro (formato "C1 | P1: x | ...") como tabela, para conferência rápida.
function renderQuadro(){
  const box=$('quadroTabela');if(!box)return;
  const linhas=value('quadroCompetencias').split('\n').map(l=>l.split('|').map(c=>c.trim())).filter(c=>c.length>=7);
  if(!linhas.length){box.innerHTML='';return;}
  const cel=c=>{const v=c.replace(/^P[1-6]\s*:\s*/i,'');return v;};
  box.innerHTML=`<table class="mini"><thead><tr><th></th>${['P1','P2','P3','P4','P5','P6'].map(p=>`<th>${p}</th>`).join('')}</tr></thead><tbody>${linhas.map(l=>{const ferr=/^ferramentas/i.test(l[0]);return `<tr><td><b>${escapeHtml(l[0])}</b></td>${l.slice(1,7).map(c=>{const v=cel(c);return ferr?`<td>${escapeHtml(v)}</td>`:`<td style="text-align:center">${/^x$/i.test(v)?'<span class="s">✔</span>':'<span style="color:var(--muted)">·</span>'}</td>`;}).join('')}</tr>`;}).join('')}</tbody></table>`;
}
async function importPdf(file){
  if(!file)return;newEvaluation(false);$('pdfStatus').textContent='Lendo o texto e as páginas do PDF...';rawPdfPages=[];pagePreviews=[];rawItemPages=[];quadroLidoPorPosicao=false;$('semanticActions').classList.add('hidden');$('pageGallery').classList.add('hidden');
  try{
    const bytes=new Uint8Array(await file.arrayBuffer());const pdf=await pdfjsLib.getDocument({data:bytes}).promise;
    for(let i=1;i<=pdf.numPages;i++){const page=await pdf.getPage(i);const content=await page.getTextContent();const vp1=page.getViewport({scale:1});rawItemPages.push({altura:vp1.height,itens:content.items.map(t=>({x:t.transform[4],y:t.transform[5],w:t.width,h:t.height,s:t.str}))});rawPdfPages.push(normalizePdfText(layoutRows(content).map(rowText).join('\n')));const viewport=page.getViewport({scale:1.25});const canvas=document.createElement('canvas');canvas.width=viewport.width;canvas.height=viewport.height;await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;pagePreviews.push(canvas.toDataURL('image/jpeg',.82));}
    const text=rawPdfPages.join('\n\n');applyPreliminaryExtraction(text,file.name);lerQuadroPorPosicao();renderPageGallery();$('semanticActions').classList.remove('hidden');
    const estrutura=/RELATO DE EXPERI[ÊE]NCIA/i.test(text)&&/DECLARA[ÇC][ÃA]O DE USO DE INTELIG/i.test(text);
    $('conformidadeModelo').value=`Arquivo PDF com ${pdf.numPages} página(s); estrutura do modelo P6 ${estrutura?'identificada':'não confirmada'}.`;
    $('pdfStatus').textContent=`PDF lido: ${pdf.numPages} página(s). Iniciando a interpretação semântica...`;checkDuplicate();updateScore();await semanticExtract();
  }catch(e){$('pdfStatus').textContent=`Falha ao ler o PDF: ${e.message}`;}
}

function evaluationId(){return currentEvaluationId||slug(value('matricula')||value('nome'))+'-'+Date.now();}
function snapshot(){const scores={};ORDER.forEach(k=>scores[k]={points:selected(k),observation:value(`obs_${k}`)});return {id:evaluationId(),...formData(),scores,manualAlerts:value('manualAlerts'),feedback:value('feedback'),...(window.CoerenciaUI?CoerenciaUI.valores():{}),total:total(),palavrasResumo:C.contarPalavras(value('resumo')),updatedAt:new Date().toISOString()};}
function loadEvaluation(e){newEvaluation(false);currentEvaluationId=e.id;FIELD_IDS.forEach(id=>{if($(id))$(id).value=e[id]||'';});ORDER.forEach(k=>{const p=e.scores?.[k]?.points;if(p!==null&&p!==undefined)setScore(k,p);$(`obs_${k}`).value=e.scores?.[k]?.observation||'';});$('manualAlerts').value=e.manualAlerts||'';$('feedback').value=e.feedback||'';if(window.CoerenciaUI)CoerenciaUI.definir(e);updateScore();renderQuadro();window.scrollTo({top:0,behavior:'smooth'});}
function newEvaluation(confirmFirst=true){if(confirmFirst&&!confirm('Limpar todo o formulário e iniciar nova avaliação?'))return;currentEvaluationId=null;FIELD_IDS.forEach(id=>{if($(id))$(id).value='';});ORDER.forEach(k=>{document.querySelectorAll(`input[name="rub_${k}"]`).forEach(x=>x.checked=false);$(`obs_${k}`).value='';});['manualAlerts','feedback'].forEach(id=>$(id).value='');if(window.CoerenciaUI)CoerenciaUI.limpar();['autoEvaluateStatus','pdfStatus','quadroStatus'].forEach(id=>$(id).textContent='');$('pdfFile').value='';rawItemPages=[];quadroLidoPorPosicao=false;$('pageGallery').innerHTML='';$('pageGallery').classList.add('hidden');$('semanticActions').classList.add('hidden');rawPdfPages=[];pagePreviews=[];closePage();checkDuplicate();updateScore();}
function checkDuplicate(){const n=value('nome').toLowerCase(),m=value('matricula').toLowerCase();const dup=evaluations.find(e=>e.id!==currentEvaluationId&&((m&&String(e.matricula||'').toLowerCase()===m)||(n&&String(e.nome||'').toLowerCase()===n)));$('nome').classList.toggle('duplicate',!!dup);$('matricula').classList.toggle('duplicate',!!dup);$('duplicidade').classList.toggle('hidden',!dup);$('duplicidade').textContent=dup?`Já existe avaliação para ${dup.nome||'este aluno'} nesta turma.`:'';}

async function loadClasses(preferred){try{classes=await api('/api/turmas');$('classSelect').innerHTML=classes.map(c=>`<option value="${escapeHtml(c.id)}">${escapeHtml(c.nome)} (${c.quantidade||0})</option>`).join('');if(preferred&&classes.some(c=>c.id===preferred))$('classSelect').value=preferred;if(classes.length){await loadEvaluations();const ativa=classes.find(c=>c.id===$('classSelect').value);$('classNameInput').value=ativa?.nome||'';}else{evaluations=[];$('classNameInput').value='';renderRoster();$('classStatus').textContent='Crie uma turma para começar.';}}catch(e){$('classStatus').textContent=e.message;}}
async function loadEvaluations(){const id=$('classSelect').value;if(!id)return;evaluations=await api(`/api/turmas/${encodeURIComponent(id)}/avaliacoes`);renderRoster();checkDuplicate();}
function renderRoster(){$('roster').innerHTML=evaluations.length?evaluations.map(e=>`<tr><td>${escapeHtml(e.nome||'Sem nome')}</td><td>${escapeHtml(e.matricula||'—')}</td><td>${fmt(e.total)}</td><td><button class="btn secondary" data-open="${escapeHtml(e.id)}">Abrir</button><button class="btn danger" data-delete="${escapeHtml(e.id)}">Excluir</button></td></tr>`).join(''):'<tr><td colspan="4">Nenhum aluno salvo.</td></tr>';}
function sameStudent(e){const m=value('matricula').toLowerCase(),n=value('nome').toLowerCase(),em=String(e?.matricula||'').trim().toLowerCase(),en=String(e?.nome||'').trim().toLowerCase();return m&&em?m===em:Boolean(n&&en&&n===en);}
async function saveEvaluation(){const cid=$('classSelect').value;if(!cid){$('classStatus').textContent='Crie ou selecione uma turma antes de salvar o aluno.';return;}if(!value('nome')&&!value('matricula')){$('classStatus').textContent='Informe o nome ou a matrícula do aluno.';return;}try{const aberto=evaluations.find(e=>e.id===currentEvaluationId);const novaIdentidade=Boolean(aberto&&!sameStudent(aberto));if(novaIdentidade)currentEvaluationId=null;const data=snapshot();await api(`/api/turmas/${encodeURIComponent(cid)}/avaliacoes/${encodeURIComponent(data.id)}`,{method:'PUT',body:JSON.stringify(data)});currentEvaluationId=data.id;await loadClasses(cid);$('classStatus').textContent=`${novaIdentidade?'Nova avaliação':'Avaliação'} salva com sucesso para ${data.nome||data.matricula}.`;}catch(e){$('classStatus').textContent=`Não foi possível salvar: ${e.message}`;}}

function download(name,content,type='application/json'){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([content],{type}));a.download=name;a.click();URL.revokeObjectURL(a.href);}
function exportJson(){const c=classes.find(x=>x.id===$('classSelect').value);download(`${slug(c?.nome)}-p6.json`,JSON.stringify({version:2,turma:c,avaliacoes:evaluations},null,2));}
function csvCell(v){return `"${String(v??'').replace(/"/g,'""')}"`;}
function exportCsv(){const header=['Nome','Matrícula','Nota',...ORDER.flatMap(k=>[`${RUBRIC[k].curto} (nível)`,`${RUBRIC[k].curto} (pontos)`]),'Palavras do resumo','Alertas','Análise de coerência','Feedback de coerência'];const rows=evaluations.map(e=>[e.nome,e.matricula,fmt(e.total),...ORDER.flatMap(k=>{const p=e.scores?.[k]?.points;return [p??'',p===null||p===undefined?'':fmt(C.pontosCriterio(k,p))];}),e.palavrasResumo??C.contarPalavras(e.resumo),e.manualAlerts,e.analiseCoerencia,e.feedbackCoerencia]);download('avaliacoes-p6.csv','﻿'+[header,...rows].map(r=>r.map(csvCell).join(';')).join('\n'),'text/csv;charset=utf-8');}

function executiveReport(){
  if(!evaluations.length)return alert('A turma não possui avaliações.');

  const turma=classes.find(x=>x.id===$('classSelect').value);
  const temNota=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
  const notas=evaluations.map(e=>Number(e.total)).filter(Number.isFinite);
  const media=notas.reduce((a,b)=>a+b,0)/(notas.length||1);
  const ordenadas=[...notas].sort((a,b)=>a-b);
  const meio=Math.floor(ordenadas.length/2);
  const mediana=ordenadas.length%2?ordenadas[meio]:(ordenadas[meio-1]+ordenadas[meio])/2;
  const minimo=Math.min(...notas),maximo=Math.max(...notas);
  const faixas=[
    {label:'Abaixo de 6,0',count:notas.filter(n=>n<6).length,color:'#b6473f'},
    {label:'6,0 a 7,9',count:notas.filter(n=>n>=6&&n<8).length,color:'#d39a2c'},
    {label:'8,0 a 8,9',count:notas.filter(n=>n>=8&&n<9).length,color:'#4f94a0'},
    {label:'9,0 a 10,0',count:notas.filter(n=>n>=9).length,color:'#28735e'}
  ];
  const criterios=ORDER.map(k=>{
    const valores=evaluations.map(e=>e.scores?.[k]?.points).filter(temNota).map(Number);
    const mediaCriterio=valores.reduce((a,b)=>a+b,0)/(valores.length||1);
    return {k,label:RUBRIC[k].label,max:RUBRIC[k].max,media:mediaCriterio,pct:Math.round((mediaCriterio/RUBRIC[k].max)*100),respondidos:valores.length,peso:RUBRIC[k].peso};
  });
  const completos=evaluations.filter(e=>ORDER.every(k=>temNota(e.scores?.[k]?.points))).length;
  const pendentes=evaluations.length-completos;
  const conclusao=Math.round((completos/evaluations.length)*100);
  const resumoOk=evaluations.filter(e=>{const n=e.palavrasResumo??C.contarPalavras(e.resumo);return n>=150&&n<=250;}).length;
  const resumoPct=Math.round((resumoOk/evaluations.length)*100);
  const naoUsouIA=evaluations.filter(e=>/n[ãa]o utilizei ferramentas de ia/i.test([e.iaFerramentas,e.iaFinalidades].join(' '))).length;
  const usouIA=evaluations.filter(e=>String(e.iaFerramentas||'').trim()&&!/n[ãa]o utilizei ferramentas de ia/i.test(e.iaFerramentas)).length;
  const coerencia=evaluations.filter(e=>String(e.analiseCoerencia||'').trim()).length;
  const alertas=evaluations.flatMap(e=>String(e.manualAlerts||'').split('\n')).map(s=>s.trim()).filter(Boolean);
  const alertasPrincipais=Object.entries(alertas.reduce((acc,a)=>(acc[a]=(acc[a]||0)+1,acc),{})).sort((a,b)=>b[1]-a[1]).slice(0,6);
  const ranking=[...criterios].sort((a,b)=>b.pct-a.pct);
  const forte=ranking[0],fragil=[...ranking].reverse()[0];
  const pct=n=>Math.round((n/evaluations.length)*100);
  const diagnostico=media>=9?'desempenho geral excelente':media>=8?'desempenho geral muito bom':media>=6?'desempenho geral satisfatório, com oportunidades claras de consolidação':'desempenho geral abaixo do esperado, indicando necessidade de intervenção pedagógica';
  const recomendacoes=[];
  const orientacoes={
    apresentacao:'Mostrar um exemplo de página inicial completa: título como afirmação, resumo de 150 a 250 palavras e três palavras-chave separadas por ponto e vírgula, lembrando de apagar todos os textos azuis.',
    contextualizacao:'Orientar a contextualização a citar profissão ou formação, cidade, motivação, o desafio com seu público e as pesquisas, autores ou estratégias que definiram os recursos.',
    recursos:'Pedir um parágrafo por atividade (P2 a P6) com aprendizagem, dificuldade e contribuição do recurso para o desafio, evitando apenas listar os produtos.',
    competencias:'Demonstrar o preenchimento do quadro de competências e ferramentas por coluna, substituindo os exemplos do modelo, e a reflexão sobre competências prévias e não desenvolvidas.',
    resultados:'Orientar a análise dos resultados com a aplicação junto ao público e sua opinião, a suficiência dos recursos e próximos passos coerentes com essa análise.',
    transparencia:'Reforçar que a declaração de IA deve responder às quatro questões (ferramentas, finalidades, validação e impacto) ou trazer a frase de não uso prevista no modelo.'
  };
  recomendacoes.push(orientacoes[fragil.k]);
  const segundo=[...ranking].reverse()[1];if(segundo&&segundo.pct<80)recomendacoes.push(orientacoes[segundo.k]);
  if(resumoOk<evaluations.length)recomendacoes.push('Incluir na lista de conferência final a contagem de palavras do resumo (150 a 250).');
  if(pendentes)recomendacoes.push(`Concluir os critérios pendentes em ${pendentes} avaliação${pendentes===1?'':'ões'} antes de tomar decisões definitivas sobre a turma.`);
  recomendacoes.push('Reservar um momento de revisão por pares do relato antes da entrega, conferindo a narrativa, os textos azuis e o quadro de competências.');
  const unicas=[...new Set(recomendacoes)].slice(0,5);
  const data=new Date().toLocaleDateString('pt-BR',{day:'2-digit',month:'long',year:'numeric'});
  const linhas=[...evaluations].sort((a,b)=>Number(b.total||0)-Number(a.total||0)||String(a.nome||'').localeCompare(String(b.nome||''),'pt-BR'));

  const html=`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Relatório Executivo · P6 Relato de Experiência</title><style>
  :root{--navy:#153d59;--teal:#1B6B93;--teal2:#5DADE2;--pale:#D6EAF8;--ink:#20343a;--muted:#61747a;--line:#d6e1e3;--gold:#d89b2b;--red:#b6473f;--green:#28735e}*{box-sizing:border-box}body{margin:0;background:#eef3f7;color:var(--ink);font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif}.page{width:min(1000px,calc(100% - 30px));margin:28px auto;background:#fff;box-shadow:0 12px 42px #173b4526}.hero{position:relative;overflow:hidden;padding:46px 54px 38px;background:linear-gradient(125deg,#153d59 0%,#1B4F72 60%,#1B6B93 100%);color:#fff}.hero:after{content:"";position:absolute;width:300px;height:300px;border:60px solid #ffffff12;border-radius:50%;right:-105px;top:-135px}.brand{display:flex;align-items:center;gap:18px;position:relative;z-index:1}.brand img{width:76px;height:76px;object-fit:contain;filter:drop-shadow(0 5px 10px #0b293555)}.eyebrow{text-transform:uppercase;letter-spacing:.15em;font-weight:800;font-size:11px;color:#bcd9ee}.hero h1{font-size:34px;line-height:1.12;margin:5px 0 8px}.hero p{margin:0;color:#dbeaf5}.hero-meta{position:relative;z-index:1;display:flex;flex-wrap:wrap;gap:22px;margin-top:27px;padding-top:18px;border-top:1px solid #ffffff38;font-size:13px}.content{padding:40px 54px 55px}.section{margin:0 0 38px}.section h2{margin:0 0 17px;color:var(--navy);font-size:21px;display:flex;gap:10px;align-items:center}.section h2 span{display:grid;place-items:center;width:28px;height:28px;border-radius:50%;background:var(--pale);color:var(--teal);font-size:13px}.lead{font-size:16px;margin:0}.summary{padding:22px 24px;background:linear-gradient(90deg,#eaf5f5,#f7faf9);border-left:5px solid var(--teal);border-radius:0 10px 10px 0}.summary strong{color:var(--navy)}.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:13px}.kpi{border:1px solid var(--line);border-radius:12px;padding:18px;background:#fff}.kpi small{display:block;color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.06em;font-weight:700}.kpi strong{display:block;color:var(--teal);font-size:29px;line-height:1.15;margin:6px 0}.kpi em{font-style:normal;color:var(--muted);font-size:12px}.criterion{display:grid;grid-template-columns:minmax(230px,1.45fr) 2fr 70px;gap:14px;align-items:center;padding:9px 0}.criterion-name{font-size:13px}.track{height:12px;background:#e7edef;border-radius:8px;overflow:hidden}.fill{height:100%;border-radius:8px;background:linear-gradient(90deg,var(--teal),var(--teal2))}.criterion b{text-align:right;color:var(--navy);font-size:13px}.criterion b small{display:block;color:var(--muted);font-weight:500}.split{display:grid;grid-template-columns:1fr 1fr;gap:18px}.card{border:1px solid var(--line);border-radius:12px;padding:20px}.card h3{margin:0 0 13px;color:var(--navy);font-size:16px}.bands{display:flex;align-items:flex-end;height:155px;gap:12px;padding-top:12px}.band{flex:1;text-align:center;color:var(--muted);font-size:10px}.column{min-height:5px;border-radius:7px 7px 0 0;margin-bottom:6px}.band b{display:block;color:var(--navy);font-size:17px}.fact{display:flex;justify-content:space-between;gap:12px;padding:9px 0;border-bottom:1px solid #e8edef}.fact:last-child{border:0}.fact strong{color:var(--navy)}.callout{padding:18px 20px;border-radius:10px;background:#fff7e6;border-left:5px solid var(--gold)}.callout p{margin:5px 0 0}.alerts{margin:0;padding-left:20px}.alerts li{margin:8px 0}.alerts b{color:var(--red)}.recommendations{counter-reset:item;list-style:none;padding:0;margin:0}.recommendations li{counter-increment:item;position:relative;padding:0 0 15px 44px;min-height:34px}.recommendations li:before{content:counter(item);position:absolute;left:0;top:0;display:grid;place-items:center;width:29px;height:29px;background:var(--navy);color:#fff;border-radius:50%;font-weight:800;font-size:12px}table{border-collapse:collapse;width:100%;font-size:12px}thead{display:table-header-group}th{background:var(--navy);color:#fff;text-align:left;padding:10px}td{border-bottom:1px solid var(--line);padding:9px 10px}tbody tr:nth-child(even){background:#f7f9f9}.score{font-weight:800;color:var(--navy)}.status{display:inline-block;border-radius:12px;padding:2px 8px;font-size:10px;font-weight:700}.ok{background:#dff1e9;color:#1f644f}.warn{background:#fff0d0;color:#875e0f}.no{background:#f8dfdc;color:#8d3933}.method{color:var(--muted);font-size:12px;border-top:1px solid var(--line);padding-top:18px}.print{position:fixed;right:25px;bottom:25px;border:0;border-radius:24px;background:var(--gold);color:#172e34;padding:13px 20px;font-weight:800;box-shadow:0 5px 18px #0003;cursor:pointer}@media(max-width:720px){.hero,.content{padding-left:24px;padding-right:24px}.hero h1{font-size:27px}.kpis{grid-template-columns:1fr 1fr}.split{grid-template-columns:1fr}.criterion{grid-template-columns:1fr 75px}.criterion .track{grid-column:1/-1;grid-row:2}.brand img{width:60px;height:60px}}@media print{@page{size:A4;margin:13mm}body{background:#fff;font-size:11px}.page{width:auto;margin:0;box-shadow:none}.hero{padding:25px 30px 22px;-webkit-print-color-adjust:exact;print-color-adjust:exact}.hero h1{font-size:25px}.brand img{width:54px;height:54px}.hero-meta{margin-top:16px;padding-top:10px}.content{padding:25px 30px}.section{margin-bottom:24px}.section h2{font-size:17px;margin-bottom:12px}.kpi,.card,.summary,.callout,.criterion,.recommendations li,tr{break-inside:avoid}.kpi{padding:12px}.kpi strong{font-size:22px}.bands{height:115px}.print{display:none}.section.page-break{break-before:page}table{font-size:9px}th,td{padding:6px}}
  </style></head><body><main class="page"><header class="hero"><div class="brand"><img src="${location.origin}/assets/logo-relato.png" alt="Relato de experiência"><div><div class="eyebrow">Especialização em Tecnologias para Educação Profissional e Tecnológica</div><h1>Relatório Executivo · P6 Relato de Experiência</h1><p>Avaliação dos relatos de experiência que documentam a trajetória formativa</p></div></div><div class="hero-meta"><span><b>Turma:</b> ${escapeHtml(turma?.nome||'Não identificada')}</span><span><b>Emissão:</b> ${data}</span><span><b>Avaliações:</b> ${evaluations.length}</span></div></header><div class="content">
  <section class="section"><h2><span>1</span> Síntese executiva</h2><div class="summary"><p class="lead">A turma apresentou <strong>${diagnostico}</strong>, com média <strong>${media.toFixed(1).replace('.',',')}</strong> e mediana <strong>${mediana.toFixed(1).replace('.',',')}</strong>. As notas variaram de <strong>${minimo.toFixed(1).replace('.',',')}</strong> a <strong>${maximo.toFixed(1).replace('.',',')}</strong>.</p><p>O melhor resultado proporcional ocorreu em <strong>${escapeHtml(forte.label)}</strong> (${forte.pct}%), enquanto <strong>${escapeHtml(fragil.label)}</strong> (${fragil.pct}%) demanda maior atenção. O resumo ficou dentro de 150 a 250 palavras em ${resumoOk} de ${evaluations.length} relatos.</p></div></section>
  <section class="section"><h2><span>2</span> Indicadores principais</h2><div class="kpis"><div class="kpi"><small>Avaliações</small><strong>${evaluations.length}</strong><em>registros na turma</em></div><div class="kpi"><small>Média geral</small><strong>${media.toFixed(1).replace('.',',')}</strong><em>em uma escala de 0 a 10</em></div><div class="kpi"><small>Avaliações completas</small><strong>${conclusao}%</strong><em>${completos} completas · ${pendentes} pendentes</em></div><div class="kpi"><small>Resumo no tamanho pedido</small><strong>${resumoPct}%</strong><em>${resumoOk} de ${evaluations.length} relatos</em></div></div></section>
  <section class="section"><h2><span>3</span> Desempenho por critério</h2>${criterios.map(c=>`<div class="criterion"><div class="criterion-name">${escapeHtml(c.label)}</div><div class="track"><div class="fill" style="width:${Math.max(0,Math.min(100,c.pct))}%"></div></div><b>${c.pct}%<small>nível ${c.media.toFixed(2).replace('.',',')} / ${c.max} · peso ${c.peso}</small></b></div>`).join('')}</section>
  <section class="section"><h2><span>4</span> Distribuição e contexto</h2><div class="split"><div class="card"><h3>Distribuição das notas</h3><div class="bands">${faixas.map(f=>`<div class="band"><div class="column" style="height:${Math.max(5,pct(f.count))}%;background:${f.color}"></div><b>${f.count}</b>${f.label}</div>`).join('')}</div></div><div class="card"><h3>Leitura complementar</h3><div class="fact"><span>Mediana da turma</span><strong>${mediana.toFixed(1).replace('.',',')}</strong></div><div class="fact"><span>Amplitude das notas</span><strong>${(maximo-minimo).toFixed(1).replace('.',',')} pontos</strong></div><div class="fact"><span>Declararam uso de IA no relato</span><strong>${usouIA} (${pct(usouIA)}%)</strong></div><div class="fact"><span>Declararam não uso de IA</span><strong>${naoUsouIA} (${pct(naoUsouIA)}%)</strong></div><div class="fact"><span>Com análise de coerência registrada</span><strong>${coerencia}</strong></div></div></div></section>
  <section class="section"><h2><span>5</span> Padrões e alertas</h2><div class="callout"><strong>Leitura pedagógica</strong><p>Os indicadores automatizados apoiam a visão de conjunto, mas não substituem a leitura docente do relato, da formatação visual do resumo e das marcações do quadro de competências no PDF.</p></div>${alertasPrincipais.length?`<h3 style="margin-top:20px">Alertas recorrentes registrados</h3><ul class="alerts">${alertasPrincipais.map(([a,n])=>`<li>${escapeHtml(a)} <b>${n} ocorrência${n===1?'':'s'}</b></li>`).join('')}</ul>`:'<p style="color:var(--muted)">Não há alertas recorrentes registrados nesta turma.</p>'}</section>
  <section class="section"><h2><span>6</span> Recomendações para a próxima oferta</h2><ol class="recommendations">${unicas.map(r=>`<li>${escapeHtml(r)}</li>`).join('')}</ol></section>
  <section class="section page-break"><h2><span>7</span> Resultados individuais</h2><table><thead><tr><th>#</th><th>Aluno</th><th>Matrícula</th><th>Nota</th><th>Resumo</th><th>Avaliação</th></tr></thead><tbody>${linhas.map((e,i)=>{const completo=ORDER.every(k=>temNota(e.scores?.[k]?.points));const np=e.palavrasResumo??C.contarPalavras(e.resumo);const classe=np>=150&&np<=250?'ok':np?'warn':'no';const texto=np?`${np} palavras`:'Ausente';return `<tr><td>${i+1}</td><td>${escapeHtml(e.nome||'Sem nome')}</td><td>${escapeHtml(e.matricula||'—')}</td><td class="score">${fmt(e.total)}</td><td><span class="status ${classe}">${texto}</span></td><td><span class="status ${completo?'ok':'warn'}">${completo?'Completa':'Pendente'}</span></td></tr>`}).join('')}</tbody></table></section>
  <section class="section"><h2><span>8</span> Nota metodológica</h2><p class="method">Este relatório consolida as avaliações salvas no aplicativo na data de emissão. Os percentuais por critério representam o nível médio obtido em relação ao nível máximo (3). A nota de cada relato pondera os critérios pelos pesos da rubrica oficial (15, 15, 25, 15, 20 e 10). Alertas e observações refletem os registros existentes e podem ser alterados pelo avaliador. A interpretação pedagógica deve considerar o tamanho da turma, a completude das avaliações e a verificação qualitativa dos trabalhos.</p></section>
  </div></main><button class="print" onclick="window.print()">Imprimir / salvar em PDF</button></body></html>`;
  const w=window.open('','_blank');
  if(!w)return alert('O navegador bloqueou a abertura do relatório. Permita janelas pop-up para este site e tente novamente.');
  w.document.open();w.document.write(html);w.document.close();
}

async function importClassJson(file){
  if(!file)return;
  const status=$('importStatus');status.textContent='Lendo e importando o arquivo...';
  try{
    const obj=JSON.parse(await file.text());
    const items=Array.isArray(obj)?obj:(Array.isArray(obj.avaliacoes)?obj.avaliacoes:[obj]);
    if(!items.length)throw new Error('O arquivo não contém avaliações.');
    const turma=obj.turma?.nome?obj.turma:classes.find(c=>c.id===$('classSelect').value);
    if(!turma)throw new Error('Este JSON não informa a turma. Crie ou selecione uma turma antes de importá-lo.');
    const body=JSON.stringify({turma,avaliacoes:items});
    let resultado;
    try{resultado=await api('/api/importar-turma',{method:'POST',body});}
    catch(err){
      if(!/Failed to fetch|Falha de rede|NetworkError/i.test(err.message))throw err;
      status.textContent='A conexão oscilou. Tentando novamente...';
      await new Promise(resolve=>setTimeout(resolve,1800));
      resultado=await api('/api/importar-turma',{method:'POST',body});
    }
    await loadClasses(resultado.id);
    status.textContent=`Importação concluída: ${resultado.inseridas} nova(s), ${resultado.atualizadas} atualizada(s). Turma ${resultado.nome}: ${resultado.quantidade} avaliação(ões).`;
    $('classStatus').textContent=`Turma ${resultado.nome} carregada com ${resultado.quantidade} avaliação(ões).`;
  }catch(err){status.textContent=/Failed to fetch/i.test(err.message)?'O servidor não respondeu. Aguarde alguns segundos e tente novamente; o arquivo não foi alterado.':`Não foi possível importar: ${err.message}`;}
  finally{$('importJson').value='';}
}

function bind(){
  $('pdfFile').addEventListener('change',e=>importPdf(e.target.files[0]));FIELD_IDS.forEach(id=>{$(id)?.addEventListener('input',()=>{if(id==='nome'||id==='matricula')checkDuplicate();renderAlerts();});});$('manualAlerts').addEventListener('input',renderAlerts);
  $('semanticExtract').onclick=semanticExtract;$('togglePages').onclick=()=>{$('pageGallery').classList.toggle('hidden');$('togglePages').textContent=$('pageGallery').classList.contains('hidden')?'Ver páginas do relato':'Ocultar páginas';};$('pageGallery').onclick=e=>{const button=e.target.closest('[data-page]');if(button)openPage(Number(button.dataset.page));};$('closeModal').onclick=closePage;$('pageModal').onclick=e=>{if(e.target===$('pageModal'))closePage();};document.addEventListener('keydown',e=>{if(e.key==='Escape')closePage();});
  $('autoEvaluate').onclick=autoEvaluate;$('refreshFeedback').onclick=()=>generateLocalFeedback(true);$('copyFeedback').onclick=()=>navigator.clipboard.writeText(value('feedback'));$('clearRubric').onclick=()=>{ORDER.forEach(k=>{document.querySelectorAll(`input[name="rub_${k}"]`).forEach(x=>x.checked=false);$(`obs_${k}`).value='';});updateScore();};
  $('classSelect').onchange=async()=>{await loadEvaluations();const c=classes.find(x=>x.id===$('classSelect').value);$('classNameInput').value=c?.nome||'';$('classStatus').textContent='';};$('refreshClasses').onclick=async()=>{const atual=$('classSelect').value;$('classStatus').textContent='Atualizando turmas...';await loadClasses(atual);$('classStatus').textContent=classes.length?`${classes.length} turma(s) carregada(s) do banco.`:'Nenhuma turma encontrada no banco.';};$('newClass').onclick=async()=>{const n=value('classNameInput');if(!n){$('classStatus').textContent='Digite o nome da nova turma no campo acima.';return;}try{const c=await api('/api/turmas',{method:'POST',body:JSON.stringify({nome:n})});await loadClasses(c.id);$('classNameInput').value=c.nome;$('classStatus').textContent='Turma criada com sucesso.';}catch(e){$('classStatus').textContent=`Não foi possível criar a turma: ${e.message}`;}};$('renameClass').onclick=async()=>{const c=classes.find(x=>x.id===$('classSelect').value),n=value('classNameInput');if(!c){$('classStatus').textContent='Selecione uma turma.';return;}if(!n){$('classStatus').textContent='Digite o novo nome da turma.';return;}try{await api(`/api/turmas/${encodeURIComponent(c.id)}`,{method:'PATCH',body:JSON.stringify({nome:n})});await loadClasses(c.id);$('classStatus').textContent='Turma renomeada com sucesso.';}catch(e){$('classStatus').textContent=`Não foi possível renomear: ${e.message}`;}};$('deleteClass').onclick=async()=>{const c=classes.find(x=>x.id===$('classSelect').value),confirmName=value('classNameInput');if(!c){$('classStatus').textContent='Selecione uma turma.';return;}if(confirmName!==c.nome){$('classStatus').textContent=`Para excluir, digite exatamente: ${c.nome}`;return;}try{await api(`/api/turmas/${encodeURIComponent(c.id)}`,{method:'DELETE',body:JSON.stringify({confirmarNome:confirmName})});newEvaluation(false);$('classNameInput').value='';await loadClasses();$('classStatus').textContent='Turma excluída.';}catch(e){$('classStatus').textContent=`Não foi possível excluir: ${e.message}`;}};
  $('saveEvaluation').onclick=saveEvaluation;$('newEvaluation').onclick=()=>newEvaluation(true);$('exportJson').onclick=exportJson;$('exportCsv').onclick=exportCsv;$('executiveReport').onclick=executiveReport;$('githubBackup').onclick=async()=>{try{const r=await api('/api/backup/github',{method:'POST'});$('classStatus').textContent=r.ultimoErro?`Falha: ${r.ultimoErro}`:`Cópia no GitHub atualizada em ${new Date(r.ultimaSincronizacao).toLocaleString('pt-BR')}.`;}catch(e){$('classStatus').textContent=e.message;}};$('clearClass').onclick=async()=>{const c=classes.find(x=>x.id===$('classSelect').value);if(c&&confirm(`Apagar TODAS as avaliações de ${c.nome}?`)){await api(`/api/turmas/${encodeURIComponent(c.id)}/avaliacoes`,{method:'DELETE'});newEvaluation(false);await loadClasses(c.id);}};
  $('roster').onclick=async e=>{const open=e.target.dataset.open,del=e.target.dataset.delete;if(open)loadEvaluation(evaluations.find(x=>x.id===open));if(del&&confirm('Excluir esta avaliação?')){await api(`/api/turmas/${encodeURIComponent($('classSelect').value)}/avaliacoes/${encodeURIComponent(del)}`,{method:'DELETE'});await loadClasses($('classSelect').value);}};
  $('chooseImportJson').onclick=()=>$('importJson').click();$('importJson').onchange=e=>importClassJson(e.target.files[0]);
}

document.addEventListener('DOMContentLoaded',async()=>{if(window.pdfjsLib)pdfjsLib.GlobalWorkerOptions.workerSrc='vendor/pdf.worker.min.js';renderRubric();bind();updateScore();try{const q=new URLSearchParams(location.search),tq=q.get('turma'),aq=q.get('avaliacao');await loadClasses(tq||undefined);if(aq){const e=evaluations.find(x=>x.id===aq);if(e){loadEvaluation(e);$('classStatus').textContent='Avaliação aberta pelo link do Fechamento do Portfólio.';}else $('classStatus').textContent='A avaliação indicada no link não foi encontrada nesta turma.';}}catch{}if('serviceWorker'in navigator)navigator.serviceWorker.register('/service-worker.js').catch(()=>{});});
// Bloco de coerência (complementar), logo abaixo do Feedback gerado.
if(window.CoerenciaUI)CoerenciaUI.montar({depoisDe:$('feedback').closest('section'),tagCard:'section',coletar:()=>formData(),api,
  titulo:'Coerência do percurso com o desafio',produto:'do percurso relatado',
  explicacao:'Uma única análise semântica relaciona o <b>percurso relatado</b> (os recursos P2 a P5, os resultados e os próximos passos) com o <b>desafio</b> e o <b>público-alvo</b> do estudante: o conjunto do que foi produzido e aplicado ajuda de fato esse público a enfrentar o desafio, ou os recursos ficaram como entregas isoladas sobre o tema? Ela não altera a rubrica, a nota nem o feedback da avaliação.',
  dicaAnalise:'Parecer técnico ao professor sobre a coerência do percurso com o desafio e o público-alvo. Totalmente editável.',
  dicaFeedback:'Mensagem pedagógica ao estudante sobre essa coerência. Totalmente editável.'});

document.addEventListener('DOMContentLoaded',()=>{const q=$('quadroCompetencias');if(q)q.addEventListener('input',renderQuadro);});

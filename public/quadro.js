/* Leitura do quadro "Autoavaliação de competências e ferramentas" pela posição do texto no PDF.
   Cada coluna P1 a P6 é localizada pelo cabeçalho; cada linha (C1 a C4, "Não adquiri", "Ferramentas")
   pelo rótulo da primeira coluna. Só "x"/"X" contam como marcação; "-", espaço ou vazio = sem marcação.
   Entrada: páginas [{altura, itens:[{x, y, w, h, s}]}] (coordenadas do pdf.js, y a partir da base da página). */
(function (raiz, fabrica) {
  const api = fabrica();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else raiz.QuadroCompetencias = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const MARCA = /^[xX✓✔]$/;
  const VAZIO = /^[-–—_.\s]*$/;
  const PALAVRAS_CURTAS = new Set(['e', 'em', 'de', 'do', 'da', 'dos', 'das', 'no', 'na', 'nos', 'nas', 'com', 'para', 'por', 'o', 'a', 'os', 'as', 'ou', 'um', 'uma', 'ao', 'via']);

  function achatar(paginas) {
    const itens = [];
    paginas.forEach((p, i) => {
      for (const t of p.itens || []) {
        const s = String(t.s || '');
        if (!s.trim()) continue;
        itens.push({ x: t.x, cx: t.x + (t.w || 0) / 2, w: t.w || 0, gy: i * 10000 + (p.altura - t.y), s, pagina: i + 1 });
      }
    });
    return itens.sort((a, b) => a.gy - b.gy || a.x - b.x);
  }

  // Junta os pedaços de texto de uma célula, linha a linha, reconstruindo palavras quebradas ("SoundCl" + "oud").
  function textoCelula(itens) {
    const linhas = [];
    for (const it of itens.sort((a, b) => a.gy - b.gy || a.x - b.x)) {
      const l = linhas.find((x) => Math.abs(x.gy - it.gy) < 3);
      if (l) l.partes.push(it); else linhas.push({ gy: it.gy, partes: [it] });
    }
    let texto = '';
    for (const l of linhas) {
      const s = l.partes.sort((a, b) => a.x - b.x).map((p) => p.s.trim()).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
      if (!s) continue;
      if (!texto) { texto = s; continue; }
      const ultima = texto.split(' ').pop(), primeira = s.split(' ')[0];
      const quebrada = /[a-zà-ú]$/i.test(ultima) && /^[a-zà-ú]/.test(primeira) && !/[,;.:]$/.test(ultima)
        && !PALAVRAS_CURTAS.has(ultima.toLowerCase()) && !PALAVRAS_CURTAS.has(primeira.replace(/[,;.]$/, '').toLowerCase());
      texto += (quebrada ? '' : ' ') + s;
    }
    return texto.replace(/\s+([,;])/g, '$1').replace(/\s+/g, ' ').trim();
  }

  function ler(paginas) {
    const itens = achatar(paginas);
    const ini = itens.find((t) => /AUTOAVALIA[ÇC][ÃA]O DE COMPET/i.test(t.s)) || itens.find((t) => /Compet[êe]ncias do egresso/i.test(t.s));
    if (!ini) return { ok: false, motivo: 'Quadro de competências não encontrado no PDF.' };
    const depois = itens.filter((t) => t.gy >= ini.gy);
    // cabeçalho: P1: ... P6:
    const colunas = [];
    for (let n = 1; n <= 6; n++) {
      const h = depois.find((t) => new RegExp(`^\\s*P${n}\\s*:?\\s*$`, 'i').test(t.s) || new RegExp(`^\\s*P${n}\\s*:`, 'i').test(t.s));
      if (!h) return { ok: false, motivo: `Cabeçalho da coluna P${n} não encontrado.` };
      colunas.push({ p: `P${n}`, cx: h.cx, gy: h.gy });
    }
    const passo = (colunas[5].cx - colunas[0].cx) / 5;
    const esquerda = colunas[0].cx - passo * 0.55, direita = colunas[5].cx + passo * 0.75;
    const colunaDe = (t) => {
      if (t.cx < esquerda || t.cx > direita) return -1;
      let melhor = 0;
      colunas.forEach((c, i) => { if (Math.abs(c.cx - t.cx) < Math.abs(colunas[melhor].cx - t.cx)) melhor = i; });
      return melhor;
    };
    const topoCabecalho = Math.max(...colunas.map((c) => c.gy));
    // rótulos das linhas: texto da primeira coluna, reunido por linha (os PDFs separam palavra por palavra)
    const linhasRotulo = [];
    for (const t of depois) {
      if (t.gy <= topoCabecalho + 2 || t.x >= esquerda) continue;
      const l = linhasRotulo.find((x) => Math.abs(x.gy - t.gy) < 3);
      if (l) l.partes.push(t); else linhasRotulo.push({ gy: t.gy, partes: [t] });
    }
    linhasRotulo.forEach((l) => { l.s = l.partes.sort((a, b) => a.x - b.x).map((p) => p.s.trim()).join(' ').replace(/\s+/g, ' '); });
    linhasRotulo.sort((a, b) => a.gy - b.gy);
    const rotulos = [];
    for (const l of linhasRotulo) {
      const m = l.s.match(/^\s*C\s*([1-4])\s*[:.)-]/i);
      if (m && !rotulos.some((r) => r.chave === `C${m[1]}`)) rotulos.push({ chave: `C${m[1]}`, gy: l.gy });
      else if (/N[ãa]o\s+adquiri/i.test(l.s) && !rotulos.some((r) => r.chave === 'nenhuma')) rotulos.push({ chave: 'nenhuma', gy: l.gy });
      else if (/Ferramentas\s+que/i.test(l.s) && !rotulos.some((r) => r.chave === 'ferramentas')) rotulos.push({ chave: 'ferramentas', gy: l.gy });
    }
    const marcacao = rotulos.filter((r) => r.chave !== 'ferramentas').sort((a, b) => a.gy - b.gy);
    if (!marcacao.length) return { ok: false, motivo: 'Linhas C1 a C4 não encontradas no quadro.' };
    const alturaLinha = 8;
    const conteudo = depois.filter((t) => t.gy > topoCabecalho + 2 && colunaDe(t) >= 0 && !/^\s*P[1-6]\s*:?\s*$/i.test(t.s));
    // fim do quadro: primeiro texto da largura da página (na coluna dos rótulos) bem depois do rótulo "Ferramentas"
    const rotFerr = rotulos.find((r) => r.chave === 'ferramentas');
    const ultimoRotulo = Math.max(...rotulos.map((r) => r.gy));
    const fimQuadro = (linhasRotulo.find((l) => l.gy > ultimoRotulo + alturaLinha * 3 && l.s.length > 25 && !/Ferramentas|criando esses|aprendi|usei/i.test(l.s)) || { gy: Infinity }).gy;
    const linhas = {};
    let inicioFerramentas = null;
    marcacao.forEach((r, i) => {
      const inicio = r.gy - alturaLinha * 0.6;
      let fim = i + 1 < marcacao.length ? marcacao[i + 1].gy - alturaLinha * 0.6 : (rotFerr ? rotFerr.gy : fimQuadro);
      if (r.chave === 'nenhuma' || i === marcacao.length - 1) {
        // a última linha de marcação termina onde começa o primeiro texto que não é marca (as ferramentas)
        const primeiroTexto = conteudo.find((t) => t.gy > r.gy && !MARCA.test(t.s.trim()) && !VAZIO.test(t.s));
        if (primeiroTexto) fim = Math.min(fim === Infinity ? primeiroTexto.gy : Math.max(fim, inicio), primeiroTexto.gy - 1);
        inicioFerramentas = primeiroTexto ? primeiroTexto.gy - 1 : fim;
      }
      const celulas = colunas.map(() => []);
      for (const t of conteudo) if (t.gy >= inicio && t.gy < fim) celulas[colunaDe(t)].push(t);
      linhas[r.chave] = celulas.map((cel) => cel.some((t) => MARCA.test(t.s.trim())));
    });
    let ferramentas = colunas.map(() => '');
    if (inicioFerramentas !== null) {
      const celulas = colunas.map(() => []);
      for (const t of conteudo) if (t.gy >= inicioFerramentas && t.gy < fimQuadro) celulas[colunaDe(t)].push(t);
      ferramentas = celulas.map((cel) => { const s = textoCelula(cel); return VAZIO.test(s) ? '' : s.replace(/^[-–]\s*|\s*[-–]$/g, '').trim(); });
    }
    return { ok: true, colunas: colunas.map((c) => c.p), linhas, ferramentas, limites: { inicio: ini.gy, fim: fimQuadro } };
  }

  // Texto padronizado para o campo do Avaliador.
  function comoTexto(q) {
    if (!q || !q.ok) return '';
    const ordem = ['C1', 'C2', 'C3', 'C4', 'nenhuma'].filter((k) => q.linhas[k]);
    const nome = { nenhuma: 'Não adquiri nenhuma' };
    const linhas = ordem.map((k) => `${nome[k] || k} | ${q.colunas.map((p, i) => `${p}: ${q.linhas[k][i] ? 'x' : ''}`.trimEnd()).join(' | ')}`);
    linhas.push(`Ferramentas | ${q.colunas.map((p, i) => `${p}: ${q.ferramentas[i] || '(não informado)'}`).join(' | ')}`);
    return linhas.join('\n');
  }

  return { ler, comoTexto, textoCelula };
});

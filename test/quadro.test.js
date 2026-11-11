const test = require('node:test');
const assert = require('node:assert');
const Q = require('../public/quadro.js');

test('quadro de competências feito no Word: "-" é vazio, só X marca, ferramentas por coluna', () => {
  const q = Q.ler(require('./fixtures/quadro-word.json'));
  assert.ok(q.ok, q.motivo);
  assert.deepEqual(q.linhas.C1, [false, true, true, true, true, true]);
  assert.deepEqual(q.linhas.C2, [true, true, true, true, true, true]);
  assert.deepEqual(q.linhas.C4, [false, false, true, false, true, true]);
  assert.deepEqual(q.linhas.nenhuma, [false, false, false, false, false, false]);
  assert.equal(q.ferramentas[0], 'Google Docs, Microsoft Copilot');
  assert.equal(q.ferramentas[1], 'Loom, Roteiro em tabela, Copilot');
  assert.match(q.ferramentas[3], /SoundCloud/);
  assert.match(q.ferramentas[4], /Gem ConectEJA/);
  assert.match(Q.comoTexto(q), /^C1 \| P1: \| P2: x/);
});

test('quadro feito no Google Docs: rótulos palavra por palavra, x minúsculo, tabela em duas páginas', () => {
  const q = Q.ler(require('./fixtures/quadro-gdocs.json'));
  assert.ok(q.ok, q.motivo);
  assert.deepEqual(q.linhas.C1, [true, true, true, true, true, true]);
  assert.deepEqual(q.linhas.C2, [true, false, true, true, true, true]);
  assert.deepEqual(q.linhas.C4, [false, false, true, false, false, false]);
  assert.ok(q.linhas.nenhuma.every((v) => !v));
  assert.deepEqual(q.ferramentas, ['Google Docs', 'Google Vids', 'Google Docs e Gemini', 'Google Vids, SoundCloud, Google Forms', 'Gemini', 'Padlet, Google Docs']);
});

test('sem quadro, a leitura avisa e não inventa', () => {
  const q = Q.ler([{ altura: 800, itens: [{ x: 50, y: 700, w: 100, h: 10, s: 'Outro texto' }] }]);
  assert.equal(q.ok, false);
  assert.equal(Q.comoTexto(q), '');
});

test('quadro do Google Docs com o título "Competências do egresso" centralizado abaixo dos cabeçalhos P1 a P6', () => {
  const q = Q.ler(require('./fixtures/quadro-gdocs-centralizado.json'));
  assert.ok(q.ok, q.motivo);
  assert.deepEqual(q.linhas.C1, [false, true, true, true, true, true]);
  assert.deepEqual(q.linhas.C2, [true, false, true, false, false, false]);
  assert.deepEqual(q.linhas.C3, [false, true, true, true, true, true]);
  assert.deepEqual(q.linhas.C4, [false, false, true, true, true, false]);
  assert.ok(q.linhas.nenhuma.every((v) => !v));
  assert.equal(q.ferramentas[0], 'Google Docs');
  assert.equal(q.ferramentas[1], 'Google Slides, Canva, Gemini');
  assert.match(q.ferramentas[2], /^Google Drive, Docs, Planilhas, Apresentações, Forms, Meet, Agenda, Google Classroom, Padlet, MIRO, Canva, WhatsApp$/);
  assert.equal(q.ferramentas[4], 'Gemini (Gem Íris)');
  assert.equal(q.ferramentas[5], 'Gemini notebook Google Docs, Padlet');
});

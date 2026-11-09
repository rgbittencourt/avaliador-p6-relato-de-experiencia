# Avaliador P6 · Relato de Experiência (TEDPRO)

PWA para apoiar a avaliação da atividade **P6 - Documentando sua trajetória formativa por meio do relato de experiência** (UC Portfólio II) do TEDPRO/IFSC. Segue a rubrica oficial da P6: seis critérios com níveis de 0 a 3, ponderados pelos pesos 15, 15, 25, 15, 20 e 10.

## Aplicativo publicado

- **App (P6 Relato de Experiência):** https://avaliador-p6-relato-de-experiencia.onrender.com
- **Verificação do servidor:** https://avaliador-p6-relato-de-experiencia.onrender.com/api/health
- Hospedagem: Render (serviço `avaliador-p6-relato-de-experiencia`). O plano gratuito "dorme" sem uso: a primeira abertura pode levar uns 50 segundos.

## Funcionalidades

- importação do relato em PDF no modelo oficial da P6 (lido no navegador com pdf.js, separado pelas seções do modelo e interpretado com IA);
- campos para identificação, título, resumo (com contador de palavras), palavras-chave, contextualização, P2 a P6, quadro de competências, reflexão, resultados, próximos passos, fechamento e declaração de IA;
- alertas automáticos: identificação do modelo não preenchida, orientador "selecione", título em pergunta ou com maiúsculas indevidas, resumo fora de 150 a 250 palavras, palavras-chave (quantidade, ponto e vírgula, iniciais), textos azuis de orientação esquecidos, formato de perguntas e respostas, partes ausentes e declaração de IA incompleta;
- rubrica oficial ponderada: nota = soma(nível ÷ 3 × peso) ÷ 10, de 0 a 10;
- avaliação automática com IA (OpenAI ou Anthropic) ou local conservadora, que desconsidera o texto do modelo;
- feedback no padrão do Prof. Rogério: saudação, reconhecimento, comentários só dos critérios abaixo do máximo, sem travessão, "Um abraço, Prof. Rogério";
- bloco complementar de **coerência do percurso com o desafio** (sem pontuação), com parecer ao professor e feedback ao estudante;
- turmas no PostgreSQL (Neon), backup no repositório privado `avaliador-p6-relato-de-experiencia-dados`, exportação JSON/CSV, importação de turma e relatório executivo.

## Rubrica

| Critério | Peso | Até (na nota) |
|---|---|---|
| Apresentação do documento e adequação ao formato solicitado | 15 | 1,5 |
| Contextualização pessoal, definição do desafio e percurso de pesquisa | 15 | 1,5 |
| Reflexão sobre a produção dos recursos e a organização do portfólio (P2 a P6) | 25 | 2,5 |
| Preenchimento do quadro e autoavaliação de competências e ferramentas | 15 | 1,5 |
| Análise da aplicação, dos resultados e das perspectivas de continuidade | 20 | 2,0 |
| Declaração e reflexão sobre o uso de IA generativa na redação do relato | 10 | 1,0 |

A rubrica, o cálculo da nota e os alertas ficam em `public/relato-core.js`, usado pela tela e pelo servidor.

## Rodar localmente

```bash
npm install
cp .env.example .env   # preencha as chaves que quiser usar
npm start
```

Abra `http://localhost:3000`. Testes: `npm test`.

## Variáveis de ambiente

- `IA_PROVEDOR`: `openai` ou `anthropic` (vazio: OpenAI se houver chave, senão Anthropic);
- `OPENAI_API_KEY` / `OPENAI_MODEL` (padrão `gpt-4o-mini`): OpenAI;
- `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` (padrão `claude-haiku-5-5`): Anthropic (Claude);
- `APP_USERNAME` e `APP_PASSWORD`: proteção das APIs (janela de login do próprio app);
- `DATABASE_URL`: PostgreSQL/Neon (projeto `avaliador-p6-relato-experiencia`); sem ela, usa `data/turmas.json`;
- `GITHUB_DATA_*`: repositório privado de backup das turmas.

## Seletor de IA

Com as duas chaves configuradas, a janela de login tem o campo **Inteligência artificial** e o topo da página tem o seletor **IA** para trocar a qualquer momento. `IA_PROVEDOR` define só a opção inicial.

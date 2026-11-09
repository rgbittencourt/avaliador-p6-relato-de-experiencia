# Publicação no Render

1. No Render, crie um Blueprint usando `render.yaml` (serviço `avaliador-p6-relato-de-experiencia`, região Oregon).
2. Configure como segredos: `APP_PASSWORD`, `DATABASE_URL` (Neon, projeto `avaliador-p6-relato-experiencia`), `GITHUB_DATA_TOKEN` e as chaves de IA (`OPENAI_API_KEY` e/ou `ANTHROPIC_API_KEY`).
3. Confirme `GITHUB_DATA_REPO=avaliador-p6-relato-de-experiencia-dados` (repositório privado de backup).
4. Aguarde o deploy ficar `Live` e acesse `/api/health`.

O banco PostgreSQL/Neon é a fonte primária. O arquivo `dados/turmas.json` no GitHub funciona como cópia de segurança versionada.

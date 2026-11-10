# Oportuniza - Como Publicar e Corrigir Tela Branca no GitHub Pages

Se o link `https://pedroorchel.github.io/Oportuniza/` estiver com tela branca, siga estes passos no repositório **https://github.com/Pedroorchel/Oportuniza**:

### 1. Envie os arquivos atualizados e remova o workflow do Jekyll
1. Envie/sincronize os arquivos atualizados deste projeto para a branch `main` do repositório `Pedroorchel/Oportuniza` (`.github/workflows/deploy.yml`, `vite.config.ts`, `index.html`, `public/.nojekyll` e `src/`).
2. **Apague** `.github/workflows/jekyll-gh-pages.yml` no GitHub caso ele ainda exista (deve ficar **apenas** `.github/workflows/deploy.yml`).

### 2. Troque o Source para "GitHub Actions" (Obrigatório!)
1. No GitHub, abra **Settings** → **Pages**.
2. Em **Build and deployment**, veja **Source**:
   - Se estiver em **Deploy from a branch**, mude para **GitHub Actions**.
   - *(Enquanto estiver em "Deploy from a branch", o processo `pages build and deployment` roda depois do deploy e sobrescreve o site compilado com o `index.html` bruto da raiz, causando a tela branca.)*

### 3. Execute ou aguarde o deploy
1. Abra a aba **Actions**.
2. Se não houver uma execução nova após mudar para **GitHub Actions**, clique em **Deploy to GitHub Pages** → **Run workflow** → **Run workflow**.
3. Aguarde ficar verde (`Success`) e acesse `https://pedroorchel.github.io/Oportuniza/` (use `Ctrl+F5` ou aba anônima se o navegador tiver cache antigo).

# Oportuniza - Como Ativar o GitHub Pages

Se o seu link `https://pedroorchel.github.io/oportunizae/` estiver com tela branca, siga este passo único no seu repositório do GitHub:

### Passo Rápido (1 minuto):
1. Acesse o seu repositório no GitHub: **https://github.com/pedroorchel/oportunizae**
2. Clique na aba **Settings** (Configurações) no menu superior.
3. No menu lateral esquerdo, clique em **Pages**.
4. Em **Build and deployment**:
   - Onde está escrito **Source**, clique e selecione: **GitHub Actions**.
5. Salve / confirme.

Pronto! O GitHub vai rodar o workflow que já está criado em `.github/workflows/deploy.yml` e publicar a pasta `dist` gerada com o `base: './'`, fazendo o app carregar imediatamente ao abrir o link.

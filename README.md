# MyDeck Pokémon

Site de fãs para colecionar cartas e montar decks de **Pokémon TCG**: catálogo completo em português e inglês,
decks prontos (personagens do anime, decks oficiais, meta atual e campeões mundiais), valor de mercado em reais,
painel com gráficos, exportação e a rede social **Treinadores**.

No ar: <https://luanps2.github.io/mydecks-pokemon/>

Feito com **React + TypeScript + Vite**, contas e banco no **Supabase**, publicado no **GitHub Pages**.
Detalhes de cada parte, fontes de dados e decisões: [`CLAUDE.md`](CLAUDE.md).

## Rodar no computador
```bash
npm install
npm run dev        # abre em http://localhost:5173
npm run build      # gera a pasta dist/ (o GitHub Actions faz isso sozinho a cada push)
```
Sem o Supabase configurado, dá para montar decks salvando só no navegador (útil para testar).

## Ligar o Supabase (contas, banco e Treinadores)

### 1. Criar o projeto
1. Entre em <https://supabase.com> → **Start your project** e crie a conta (grátis; pode usar o GitHub).
2. **New project**: nome `mydeck-pokemon`, crie uma senha para o banco (guarde num lugar seguro) e em **Region** escolha **South America (São Paulo)**. Clique em **Create new project** e espere ~2 minutos.

### 2. Criar as tabelas
1. No menu da esquerda, **SQL Editor** → **New query**.
2. Cole todo o conteúdo de [`supabase/schema.sql`](supabase/schema.sql) e clique em **Run**.
   No fim aparece uma tabela com `profiles`, `lists` e `list_cards` e "rls ligado" = `true`. Pode rodar de novo quando quiser.

### 3. Pegar as chaves públicas
1. **Project Settings** (engrenagem) → **API Keys** (ou **Data API**).
2. Copie a **Project URL** e a chave **Publishable key** (ou **anon public**). **Nunca** use a `service_role`/`secret`.

### 4. Guardar as chaves no GitHub
No repositório: **Settings → Secrets and variables → Actions → New repository secret**, crie dois:
- `VITE_SUPABASE_URL` = a Project URL
- `VITE_SUPABASE_KEY` = a chave publishable/anon

Depois, em **Actions → Publicar no GitHub Pages → Run workflow**, publique de novo.

### 5. Endereços de volta do login
**Authentication → URL Configuration**:
- **Site URL**: `https://luanps2.github.io/mydecks-pokemon/`
- **Redirect URLs** → **Add URL**: `https://luanps2.github.io/mydecks-pokemon/**` e `http://localhost:5173/**`

### 6. E-mail e senha, link mágico e "Esqueci a senha"
Já vêm ligados (**Authentication → Sign In / Providers → Email**, com **Confirm email** ligado: a conta só fica ativa
depois do link). O Supabase manda poucos e-mails por hora no plano grátis; para mais, configure um SMTP em
**Authentication → Emails → SMTP Settings**.

### 7. Entrar com o Google
1. <https://console.cloud.google.com/> → crie um projeto (ex.: `MyDeck Pokemon`).
2. **APIs e serviços → Tela de permissão OAuth**: tipo **Externo**, nome do app, seu e-mail de suporte → salvar. Em **Público**, clique em **Publicar app**.
3. **APIs e serviços → Credenciais → Criar credenciais → ID do cliente OAuth** → **Aplicativo da Web**.
   - **Origens JavaScript autorizadas**: `https://luanps2.github.io`
   - **URIs de redirecionamento autorizados**: `https://SEU-PROJETO.supabase.co/auth/v1/callback` (o endereço exato aparece no passo seguinte, no Supabase).
4. Copie o **ID do cliente** e a **Chave secreta do cliente**.
5. No Supabase: **Authentication → Sign In / Providers → Google** → ligue **Enable**, cole os dois valores e **Save**.

## Dados (gerados pelo GitHub Actions)
- `public/data/cartas.json`: catálogo e preços (TCGdex), gerado de novo todo dia na publicação.
- `public/data/decks-*.json`, `populares.json`, `public/img/caixas`, `public/img/personagens`: workflow **Atualizar dados**
  (aba Actions → Run workflow, ou gravar os scripts em `.github/dados-pedido.txt` e dar push).

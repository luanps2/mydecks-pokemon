# MyDeck Pokémon – coleção e decks de Pokémon TCG

Site de fãs para colecionar cartas e montar decks de **Pokémon Estampas Ilustradas (TCG)**. Projeto do Luan: **falar sempre em português do Brasil**, frases simples, sem jargão. Toda a interface em português do Brasil.
Modelo: o MyDecks de Yu-Gi-Oh! (`luanps2/projeto-lista-yugioh`, pasta `web/`, e o `CLAUDE.md` de lá). Mesma organização, comportamento e cuidado com o visual; só muda o universo.

- Site no ar: https://luanps2.github.io/mydecks-pokemon/ (repositório `luanps2/mydecks-pokemon`)
- Nome: **MyDeck Pokémon** (marca "My" + "Deck" em vermelho; `<title>` "MyDeck Pokémon").

## Regras de trabalho (pedidos do Luan)
- **Toda alteração pronta e testada vai direto para a `main`** (commit + push), sem Pull Request, mesmo em sessões na nuvem que recebam outro ramo de trabalho. Antes do push: `npm run build` sem erros e `git pull --rebase`. Mensagens de commit terminam com a linha de coautoria do Claude.
- Testar cada funcionalidade no navegador (Playwright + Chromium) antes de dizer que está pronta, com capturas no computador e no celular (390px), modos claro e escuro.
- **Montar decks só com conta** (09/10/2026): sem login a pessoa só vê (decks prontos, catálogo, Treinadores). Sem Supabase configurado (desenvolvimento), dá para montar no navegador.
- Nunca usar nem pedir a chave secreta (service_role) do Supabase: no site vai só a chave pública. Não mandar o e-mail do Luan para serviços de terceiros.
- Não deixar o projeto dentro do OneDrive (no projeto antigo a sincronização trouxe arquivos velhos por cima dos novos).

## Tecnologia
- React 19 + TypeScript + Vite 8, na raiz do repositório (`src/`, `public/`, `scripts/`). `npm run dev` / `npm run build`.
- `vite.config.ts`: `base: '/mydecks-pokemon/'` só no build; caminhos de arquivos com `import.meta.env.BASE_URL`.
- Supabase (banco Postgres com RLS e login) — etapa 4. Sem `.env.local` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_KEY`), salva só no navegador (`localStorage` `mdp-estado-v1`).
- Publicação: `.github/workflows/deploy.yml` (GitHub Pages; a cada push na `main` e todo dia às 6h17 de Brasília). **Precisa do Pages ligado em Settings → Pages → Source: GitHub Actions.**

## Fontes de dados (testadas pelo GitHub Actions em 09/10/2026)
O ambiente das sessões na nuvem do Claude **não acessa** essas APIs (o proxy recusa com 403). Para testar uma API, usar o workflow "Sondar APIs" (`scripts/sondar-apis.mjs`, grupos `tcgdex`, `ptcgapi`, `limitless`, `cotacao`, `fandom`, `fontes2`) e ler o log pelas ferramentas do GitHub.
- **TCGdex** (principal): `https://api.tcgdex.net/v2/{pt|en}/...`, grátis, sem chave, rápida (~20 ms; 400 cartas com 16 em paralelo em 2,2 s). Aceita User-Agent de navegador.
  - 23.736 cartas em inglês, 13.907 em português (125 coleções; as anteriores a ~2005 em português só existem em parte; ex.: `pt/cards/base1-4` dá 404).
  - `/cards` (lista resumida: id, localId, name, image), `/cards/{id}` (completa: category, hp, types, stage, evolveFrom, attacks, abilities, weaknesses, resistances, retreat, rarity, regulationMark, legal, illustrator, variants, `pricing` com TCGplayer US$ por variante e Cardmarket € com avg/low/trend/avg1/7/30 e versões holo), `/sets`, `/sets/{id}` (releaseDate, serie, `abbreviation.official` = sigla impressa, cards), `/series`. Filtros na URL funcionam (`?name=`, `?types=Fire&hp=gte:300`, `pagination:itemsPerPage`). O GraphQL não tem `pricing` e deu erro com paginação: não usar.
  - Em português os nomes de Pokémon ficam iguais aos em inglês (Pikachu); os Treinadores e Energias são traduzidos. Alguns nomes vêm com o símbolo em inglês ("Energia Psychic Básica"): o gerador traduz (`nomePtLimpo`).
  - Os tipos em português da TCGdex são "Planta", "Lutador", "Sombrio"; no site usamos **Grama, Luta, Escuridão** (pedido do Luan).
  - A série `tcgp` (Pokémon TCG Pocket, jogo de celular) fica fora do catálogo.
  - Imagens: `https://assets.tcgdex.net/{pt|en}/{série}/{coleção}/{número}/{low|high}.webp` (low ~15 KB, high ~60 KB). Logo da coleção: `.../{série}/{coleção}/logo.webp`. ~1.500 cartas não têm imagem na TCGdex.
- **Pokémon TCG API** (reserva de imagens): `https://api.pokemontcg.io/v2/...` funciona **sem** User-Agent; com User-Agent de navegador ou próprio responde 500/502. Imagens `https://images.pokemontcg.io/{setId}/{número}.png` e `_hires.png`. O gerador liga cada coleção da TCGdex à do pokemontcg.io pelo nome ou pela sigla (`sets[].pc`), e o site usa essa imagem por último.
- **Limitless TCG**: `https://play.limitlesstcg.com/api/tournaments?game=PTCG&format=STANDARD&limit=50`, `/tournaments/{id}/details`, `/tournaments/{id}/standings` (listas completas: pokemon/trainer/energy com count, set = sigla do PTCG Live, number; e `deck.id/name` = arquétipo). Aceita qualquer User-Agent. Campeões mundiais: site principal (HTML) `https://limitlesstcg.com/tournaments?time=all&show=500` tem "World Championships 2017…2026" (`/tournaments/{n}`).
- **Decks oficiais**: `PokemonTCG/pokemon-tcg-data` no GitHub, pasta `decks/en/{coleção}.json` (Theme Decks com id das cartas no formato do pokemontcg.io e `count`). Fotos dos produtos: catálogo do TCGplayer em `https://tcgcsv.com/tcgplayer/3/groups` (e produtos de cada grupo).
- **Cotação**: AwesomeAPI `economia.awesomeapi.com.br/json/last/USD-BRL,EUR-BRL` respondeu **429 (cota)** a partir do GitHub; reservas Frankfurter (`api.frankfurter.app/latest?from=USD&to=BRL,EUR`) e open.er-api funcionam. Ordem no `scripts/lib-api.mjs`: AwesomeAPI → Frankfurter → ExchangeRate-API.
- **Retratos dos personagens**: Pokémon Wiki do Fandom (`pokemon.fandom.com/api.php?action=query&prop=pageimages&piprop=original&titles=...`) responde a qualquer User-Agent. Bulbapedia bloqueia (Cloudflare 403).

## Catálogo (`public/data/cartas.json`)
- Gerado por `scripts/gerar-catalogo.mjs` (~2 min, 21.256 cartas, 1,9 MB; ~0,5 MB compactado). Formato compacto: `c` = linhas `[id, nomeEn, nomePt ("" se igual), índice da coleção, número, categoria 0/1/2, tipos em letras, estágio, hp, raridade, subtipo, sufixo, marca de regulação, legal (1 Padrão | 2 Expandido), evoluiDe, nº da Pokédex, imagens (1 inglês | 2 português), menor R$, maior R$, ilustrador]`, com dicionários em `dic`; `sets`, `series`, `cotacao`.
- **Valor de mercado** (menor e maior em reais): entre as variantes da carta (normal, holo, reverse, 1ª edição…), pelo `marketPrice` do TCGplayer × dólar; sem TCGplayer, Cardmarket (média ou tendência, normal e holo) × euro.
- Na publicação diária (`deploy.yml`) o catálogo é gerado de novo **uma vez por dia** e guardado no cache do GitHub (`catalogo-AAAA-MM-DD`); os outros pushes do dia usam o do cache; se a API falhar, fica o arquivo do repositório. O arquivo do repositório é a reserva: atualizar pelo workflow "Atualizar dados" (gravar `.github/dados-pedido.txt` com os scripts a rodar e dar push, ou rodar pela aba Actions).
- No site (`src/lib/catalog.ts`): baixado uma vez, vira objetos `CatCard`, com `byId`, `byName` (versões), `evolvesTo`, `byDex` e texto de busca sem acento. Busca por nome em português ou inglês, número (`25`, `025`) e sigla da coleção (`MEW 25`).

## Testes no navegador nas sessões na nuvem
- O ramo **`amostras-teste`** (fora do `main`) tem imagens e respostas reais da TCGdex de algumas coleções (sv03.5, base1, me02.5, sv08, swsh7, sv01), geradas pelo workflow "Amostras para testes" (`scripts/amostras-teste.mjs`; pedido em `.github/amostras-pedido.txt`). O teste com Playwright serve `assets.tcgdex.net` e `api.tcgdex.net` a partir dessa cópia (`page.route`). Cartas fora da amostra aparecem como "Imagem indisponível" só no teste.
- Abrir o Chromium sem `--hide-scrollbars` para ver as barras de rolagem.

## O que cada parte faz (src/)
- `App.tsx`: cabeçalho (linha 1: logo | busca | Treinadores | conta; linha 2: seletor de deck | Decks prontos | Exportar | Adicionar cartas), filtros (Todas/Pokémon/Treinador/Energia/Sem imagem/Imagem minha + tipo, estágio, subtipo, valor; no celular atrás de "Filtros"), decks agrupados em Pokémon/Treinador/Energia, avisos das regras, modo Lista, rodapé e menu de baixo do celular.
- `lib/rules.ts`: avisos (sem bloquear) de 60 cartas, máximo 4 cópias com o mesmo nome (Energia Básica livre; versões diferentes somam) e legalidade Padrão/Expandido.
- `state/collection.tsx`: decks e cartas (local ou nuvem), `allowed()`/`askLogin()` para exigir conta, desfazer remoção, cópias (1 a 999), versões (`changeVersion`), idioma da imagem, imagem própria, backup. **Cada impressão (coleção + número) é uma carta do deck**: outra versão da mesma carta entra separada.
- `components/Catalog.tsx`: "Adicionar cartas" com filtros locais (categoria, tipo, estágio, subtipo, série, coleção, raridade, HP, regulação, formato, valor, ordenação), busca enquanto digita, rolagem infinita (60 por vez), seleção múltipla.
- `components/SearchPanel.tsx`: busca do topo no catálogo inteiro enquanto digita (48 primeiros; "Ver as N cartas no catálogo" abre o catálogo já filtrado).
- `components/CardModal.tsx` (carta dos decks) e `DetailModal.tsx` (carta do catálogo, busca, relacionadas, decks prontos): imagem grande (clique amplia), setas e teclas ←/→, `CardInfo` (dados, ataques com custo e dano, habilidades, fraqueza/resistência/recuo, texto em português e o original em inglês), `PriceLine` (preço em cada loja, cotação), `VersionStrip` (todas as versões; clique troca, + põe como outra carta), `RelatedCards` (linha evolutiva, o mesmo Pokémon, parecidas).
- `lib/tcgdex.ts`: dados completos na hora (`/v2/pt` e `/v2/en`), guardados na memória.
- `lib/images.ts`: ordem das imagens: imagem própria → R2 (se houver) → TCGdex português → TCGdex inglês → pokemontcg.io.
- `components/GlobalBehaviors.tsx`: prévia ampliada ao passar o mouse (troca `low.webp` por `high.webp`) e faixas horizontais com roda do mouse/arrastar.

## Visual
- Neutro e limpo (fundo `#f6f5f2`, superfícies brancas; escuro grafite automático), sem degradês exagerados nem animações em cascata. Destaque vermelho da Poké Bola (`--accent` `#e3350d`, escuro `#ff6a4d`) só para seleção, foco e detalhes; verde só na ação principal de cada área. Fontes Bricolage Grotesque (títulos) e Geist/Geist Mono.
- Ícone próprio (`components/Logo.tsx` e `public/favicon.svg`): carta escura com um círculo vermelho e branco. Não usar logotipos oficiais.
- Cartas na proporção 63/88. Barras de rolagem finas e vermelhas (fim do `index.css`).

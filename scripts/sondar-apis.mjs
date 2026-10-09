/* Sondagem das APIs (roda no GitHub Actions, que tem internet): imprime no log o que cada uma devolve.
   Uso: node scripts/sondar-apis.mjs [grupo] */
const UAS = {
  nenhum: undefined,
  mozilla: "Mozilla/5.0",
  chrome: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36",
  proprio: "MyDecksPokemon/1.0 (+https://github.com/luanps2/mydecks-pokemon)",
};
const cut = (s, n = 1500) => (s.length > n ? s.slice(0, n) + `… (+${s.length - n})` : s);
async function get(url, { ua = "chrome", n = 1500, method = "GET", body, headers = {} } = {}) {
  const t = Date.now();
  try {
    const r = await fetch(url, { method, body, headers: { ...(UAS[ua] ? { "User-Agent": UAS[ua] } : {}), ...headers } });
    const txt = await r.text();
    console.log(`\n### ${method} ${url} [UA ${ua}] -> ${r.status} em ${Date.now() - t} ms, ${txt.length} bytes`);
    console.log(cut(txt, n));
    try { return JSON.parse(txt); } catch { return null; }
  } catch (e) {
    console.log(`\n### ${url} [UA ${ua}] -> ERRO ${e.message}`);
    return null;
  }
}
const grupos = process.argv.slice(2).length ? process.argv.slice(2) : ["tudo"];
const quer = (g) => grupos.includes("tudo") || grupos.includes(g);

if (quer("tcgdex")) {
  const series = await get("https://api.tcgdex.net/v2/pt/series", { n: 3000 });
  const sets = await get("https://api.tcgdex.net/v2/pt/sets", { n: 400 });
  if (Array.isArray(sets)) console.log("PT sets:", sets.length, sets.map((s) => `${s.id}:${s.cardCount?.total}/${s.cardCount?.official}`).join(" "));
  const setsEn = await get("https://api.tcgdex.net/v2/en/sets", { n: 200 });
  if (Array.isArray(setsEn)) console.log("EN sets:", setsEn.length, setsEn.map((s) => s.id).join(" "));
  const cardsPt = await get("https://api.tcgdex.net/v2/pt/cards", { n: 400 });
  if (Array.isArray(cardsPt)) console.log("PT cards:", cardsPt.length, "com imagem:", cardsPt.filter((c) => c.image).length);
  const cardsEn = await get("https://api.tcgdex.net/v2/en/cards", { n: 400 });
  if (Array.isArray(cardsEn)) console.log("EN cards:", cardsEn.length, "com imagem:", cardsEn.filter((c) => c.image).length);
  await get("https://api.tcgdex.net/v2/pt/cards/sv03.5-025", { n: 6000 });
  await get("https://api.tcgdex.net/v2/en/cards/sv03.5-025", { n: 6000 });
  await get("https://api.tcgdex.net/v2/pt/cards/swsh3-136", { n: 3000 });
  await get("https://api.tcgdex.net/v2/pt/cards/base1-4", { n: 3000 });
  await get("https://api.tcgdex.net/v2/en/cards/base1-4", { n: 3000 });
  await get("https://api.tcgdex.net/v2/pt/cards/sv01-196", { n: 3000 });
  await get("https://api.tcgdex.net/v2/pt/sets/sv03.5", { n: 1500 });
  await get("https://api.tcgdex.net/v2/pt/series/sv", { n: 1500 });
  await get("https://api.tcgdex.net/v2/pt/cards?name=pikachu", { n: 800 });
  await get("https://api.tcgdex.net/v2/pt/cards?name=eq:Pikachu", { n: 800 });
  await get("https://api.tcgdex.net/v2/en/cards?types=Fire&hp=gte:300&pagination:itemsPerPage=5", { n: 800 });
  await get("https://api.tcgdex.net/v2/en/cards?category=Trainer&trainerType=Supporter&pagination:itemsPerPage=3&pagination:page=2", { n: 800 });
  await get("https://api.tcgdex.net/v2/pt/types", { n: 800 });
  await get("https://api.tcgdex.net/v2/pt/rarities", { n: 1500 });
  await get("https://api.tcgdex.net/v2/pt/stages", { n: 800 });
  await get("https://api.tcgdex.net/v2/pt/trainer-types", { n: 800 });
  await get("https://api.tcgdex.net/v2/pt/energy-types", { n: 800 });
  await get("https://api.tcgdex.net/v2/pt/regulation-marks", { n: 800 });
  await get("https://api.tcgdex.net/v2/pt/variants", { n: 800 });
  await get("https://api.tcgdex.net/v2/pt/suffixes", { n: 800 });
  await get("https://api.tcgdex.net/v2/graphql", { method: "POST", headers: { "Content-Type": "application/json" }, n: 3000,
    body: JSON.stringify({ query: "{ cards(pagination:{page:1,count:3}) { id localId name category hp types stage rarity regulationMark set { id name } legal { standard expanded } } }" }) });
  await get("https://api.tcgdex.net/v2/graphql", { method: "POST", headers: { "Content-Type": "application/json" }, n: 3000,
    body: JSON.stringify({ query: "{ cards(pagination:{page:1,count:2}) { id name pricing } }" }) });
  await get("https://assets.tcgdex.net/pt/sv/sv03.5/025/low.webp", { n: 50 });
  await get("https://assets.tcgdex.net/pt/sv/sv03.5/025/high.webp", { n: 50 });
  await get("https://assets.tcgdex.net/en/base/base1/4/low.webp", { n: 50 });
  await get("https://assets.tcgdex.net/pt/base/base1/4/low.webp", { n: 50 });
  await get("https://assets.tcgdex.net/en/sv/sv03.5/025/low.png", { n: 50 });
  await get("https://assets.tcgdex.net/pt/sv/sv03.5/logo.webp", { n: 50 });
  await get("https://assets.tcgdex.net/univ/sv/sv03.5/symbol.webp", { n: 50 });
}
if (quer("ptcgapi")) {
  for (const ua of ["nenhum", "chrome", "proprio"]) await get("https://api.pokemontcg.io/v2/cards?q=name:pikachu%20set.id:sv3pt5&pageSize=1", { ua, n: 2500 });
  await get("https://api.pokemontcg.io/v2/sets?pageSize=3&orderBy=-releaseDate", { n: 1500 });
  await get("https://images.pokemontcg.io/sv3pt5/25.png", { n: 50 });
}
if (quer("limitless")) {
  for (const ua of ["nenhum", "chrome", "proprio"]) await get("https://play.limitlesstcg.com/api/tournaments?game=PTCG&limit=3", { ua, n: 1500 });
  const ts = await get("https://play.limitlesstcg.com/api/tournaments?game=PTCG&format=STANDARD&limit=50", { n: 600 });
  if (Array.isArray(ts) && ts[0]) {
    const big = [...ts].sort((a, b) => (b.players || 0) - (a.players || 0))[0];
    await get(`https://play.limitlesstcg.com/api/tournaments/${big.id}/details`, { n: 1500 });
    await get(`https://play.limitlesstcg.com/api/tournaments/${big.id}/standings`, { n: 4000 });
  }
  await get("https://play.limitlesstcg.com/api/games", { n: 1500 });
  await get("https://limitlesstcg.com/api/tournaments?limit=3", { n: 800 });
}
if (quer("cotacao")) {
  await get("https://economia.awesomeapi.com.br/json/last/USD-BRL,EUR-BRL", { n: 800 });
  await get("https://open.er-api.com/v6/latest/USD", { n: 400 });
  await get("https://api.frankfurter.app/latest?from=USD&to=BRL,EUR", { n: 400 });
}
if (quer("fandom")) {
  for (const ua of ["nenhum", "chrome", "proprio"])
    await get("https://pokemon.fandom.com/api.php?action=query&titles=Ash_Ketchum&prop=pageimages|images&imlimit=60&pithumbsize=600&format=json", { ua, n: 3000 });
  await get("https://bulbapedia.bulbagarden.net/w/api.php?action=query&titles=Ash_Ketchum&prop=pageimages|images&imlimit=60&pithumbsize=600&format=json", { n: 3000 });
  await get("https://archives.bulbagarden.net/w/api.php?action=query&list=allimages&aiprefix=Ash&ailimit=20&format=json", { n: 2000 });
}

if (quer("fontes2")) {
  // detalhes de coleção (abreviação), coleção básica em português, tempo de muitas cartas
  await get("https://api.tcgdex.net/v2/en/sets/sv03.5", { n: 700 });
  await get("https://api.tcgdex.net/v2/en/sets/base1", { n: 700 });
  await get("https://api.tcgdex.net/v2/pt/sets/base1", { n: 700 });
  await get("https://api.tcgdex.net/v2/pt/sets/30th", { n: 700 });
  await get("https://api.tcgdex.net/v2/en/sets/me02.5", { n: 500 });
  const lst = await (await fetch("https://api.tcgdex.net/v2/en/cards")).json();
  const amostra = lst.slice(5000, 5400).map((c) => c.id);
  let t = Date.now(), ok = 0, falhas = 0, i = 0;
  await Promise.all(Array.from({ length: 16 }, async () => {
    while (i < amostra.length) { const id = amostra[i++]; const r = await fetch("https://api.tcgdex.net/v2/en/cards/" + id); if (r.ok) { ok++; await r.text(); } else falhas++; }
  }));
  console.log(`\n### 400 cartas com 16 em paralelo: ${Date.now() - t} ms, ok ${ok}, falhas ${falhas}`);
  await get("https://api.tcgdex.net/v2/graphql", { method: "POST", headers: { "Content-Type": "application/json" }, n: 1500,
    body: JSON.stringify({ query: '{ cards(pagination:{page:1,itemsPerPage:3}) { id name category hp types stage rarity regulationMark evolveFrom dexId set { id } legal { standard expanded } } }' }) });
  // decks oficiais: catálogo do TCGplayer (tcgcsv) e o repositório de dados do pokemontcg.io
  await get("https://tcgcsv.com/tcgplayer/3/groups", { n: 1500 });
  await get("https://api.github.com/repos/PokemonTCG/pokemon-tcg-data/contents/decks/en", { n: 3000 });
  await get("https://raw.githubusercontent.com/PokemonTCG/pokemon-tcg-data/master/decks/en/base1.json", { n: 1500 });
  // campeões mundiais na Limitless (site principal)
  await get("https://limitlesstcg.com/tournaments?type=worlds&time=all", { n: 300 });
  const h = await (await fetch("https://limitlesstcg.com/tournaments?time=all&show=500", { headers: { "User-Agent": UAS.chrome } })).text();
  console.log("\n### links de torneios (World):", [...h.matchAll(/href="(\/tournaments\/\d+)"[^>]*>([^<]*World[^<]*)</g)].map((m) => m[1] + " " + m[2]).slice(0, 40).join(" | "));
  console.log("trecho:", [...h.matchAll(/<tr[^>]*data-[^>]*>/g)].slice(0, 3).map((m) => m[0]).join("\n"));
  // retratos no Pokémon Fandom: imagem principal da página (original)
  for (const t of ["Ash Ketchum", "Misty", "Brock", "Gary Oak", "Jessie", "Dawn", "May", "Serena", "Goh", "Liko", "Roy", "Red"])
    await get("https://pokemon.fandom.com/api.php?action=query&prop=pageimages&piprop=original|name&format=json&titles=" + encodeURIComponent(t), { n: 500 });
  await get("https://pokemon.fandom.com/api.php?action=query&list=allimages&aiprefix=Ash_JN&aiprop=url|size|mime&ailimit=20&format=json", { n: 2500 });
}
if (quer("worlds")) {
  const h = await (await fetch("https://limitlesstcg.com/tournaments/500", { headers: { "User-Agent": UAS.chrome } })).text();
  console.log("\n### /tournaments/500 tamanho", h.length);
  const i = h.indexOf("<table");
  console.log(h.slice(i, i + 3500));
  const links = [...h.matchAll(/href="(\/decks\/list\/[^"]+)"/g)].map((m) => m[1]);
  console.log("listas:", links.slice(0, 5));
  if (links[0]) {
    const d = await (await fetch("https://limitlesstcg.com" + links[0], { headers: { "User-Agent": UAS.chrome } })).text();
    const b = d.indexOf("<body");
    const k = d.search(/Pok[eé]mon \(\d+\)|decklist-column|data-set=|class="decklist/);
    console.log("\n### lista", links[0], d.length, "posição", k);
    console.log(d.slice(Math.max(b, k - 300), k + 3500));
  }
  const t = await (await fetch("https://limitlesstcg.com/tournaments?time=all&show=500", { headers: { "User-Agent": UAS.chrome } })).text();
  console.log("\n### mundiais:", [...t.matchAll(/<tr[^>]*data-name="([^"]*World[^"]*)"[^>]*data-winner="([^"]*)"[\s\S]{0,400}?href="(\/tournaments\/\d+)"/g)].map((m) => `${m[1]} | ${m[2]} | ${m[3]}`).join("\n"));
}
if (quer("tcgcsv")) {
  const H = { headers: { "User-Agent": "MyDeckPokemon/1.0 (+https://luanps2.github.io/mydecks-pokemon/)" } };
  const g = await (await fetch("https://tcgcsv.com/tcgplayer/3/groups", H)).json();
  const base = g.results.find((x) => x.name === "Base Set");
  console.log("Base Set:", JSON.stringify(base));
  const p = await (await fetch(`https://tcgcsv.com/tcgplayer/3/${base.groupId}/products`, H)).json();
  console.log(p.results.filter((x) => /deck|theme/i.test(x.name)).slice(0, 8).map((x) => JSON.stringify({ n: x.name, id: x.productId, img: x.imageUrl })).join("\n"));
  console.log("nomes de grupos com Deck:", g.results.filter((x) => /deck|theme|battle academy|league/i.test(x.name)).map((x) => x.name).join(" | "));
}

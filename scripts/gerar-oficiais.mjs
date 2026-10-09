/* Gera public/data/decks-oficiais.json: os decks temáticos oficiais (Theme Decks) com as cartas e quantidades reais,
   do projeto PokemonTCG/pokemon-tcg-data (decks/en/{coleção}.json), e a foto da caixa em PNG com fundo transparente
   (public/img/caixas/{id}.png), tirada do catálogo do TCGplayer (tcgcsv.com, que pede um User-Agent com o nome do app).
   Roda no GitHub Actions (workflow "Atualizar dados"). Precisa de: npm i --no-save --no-package-lock sharp */
import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import sharp from "sharp";
import { emParalelo, getJSON, sleep } from "./lib-api.mjs";

const cat = JSON.parse(await readFile("public/data/cartas.json", "utf8"));
const APP_UA = "MyDeckPokemon/1.0 (+https://luanps2.github.io/mydecks-pokemon/)";
const GH = process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {};
const norm = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[’‘`]/g, "'").toLowerCase().trim();
const semZeros = (n) => String(n).replace(/^0+(?=\d)/, "").toLowerCase();

// 1) mapas do catálogo: coleção do pokemontcg.io → coleção da TCGdex; (coleção, número) → carta; nome → cartas
const porPc = new Map(cat.sets.filter((s) => s.pc).map((s) => [s.pc, s]));
const porNumero = new Map(), porNome = new Map();
for (const c of cat.c) {
  const set = cat.sets[c[3]];
  porNumero.set(set.id + "|" + semZeros(c[4]), c);
  const k = norm(c[1]);
  if (!porNome.has(k)) porNome.set(k, []);
  porNome.get(k).push(c);
}
function cartaDe(pcId, nome) {
  const [pc, num] = [pcId.slice(0, pcId.lastIndexOf("-")), pcId.slice(pcId.lastIndexOf("-") + 1)];
  const set = porPc.get(pc);
  const c = set && porNumero.get(set.id + "|" + semZeros(num));
  if (c) return c;
  const lista = porNome.get(norm(nome));   // reserva: a versão mais nova com imagem
  return lista ? [...lista].sort((a, b) => (b[16] ? 1 : 0) - (a[16] ? 1 : 0) || cat.sets[b[3]].d.localeCompare(cat.sets[a[3]].d))[0] : null;
}

// 2) decks do pokemon-tcg-data
const arquivos = await (await fetch("https://api.github.com/repos/PokemonTCG/pokemon-tcg-data/contents/decks/en", { headers: { ...GH, "User-Agent": APP_UA } })).json();
console.log("Arquivos de decks:", arquivos.length);
const decks = [];
for (const a of arquivos) {
  const lista = await getJSON(a.download_url, { ua: APP_UA });
  const pc = a.name.replace(/\.json$/, "");
  for (const d of lista || []) decks.push({ ...d, pc });
}
console.log("Decks:", decks.length);

// 3) catálogo do TCGplayer (grupos = coleções; produtos = cartas e produtos selados, com foto)
const grupos = (await getJSON("https://tcgcsv.com/tcgplayer/3/groups", { ua: APP_UA })).results;
const produtosDoGrupo = new Map();
async function produtos(gid) {
  if (!produtosDoGrupo.has(gid)) { await sleep(150); produtosDoGrupo.set(gid, (await getJSON(`https://tcgcsv.com/tcgplayer/3/${gid}/products`, { ua: APP_UA }).catch(() => ({ results: [] }))).results || []); }
  return produtosDoGrupo.get(gid);
}
function gruposDaColecao(set) {
  const d = Date.parse(set.d);
  return grupos.filter((g) => (set.ab && g.abbreviation && g.abbreviation.toUpperCase() === set.ab.toUpperCase())
    || norm(g.name) === norm(set.en) || norm(g.name).endsWith(": " + norm(set.en))
    || (Math.abs(Date.parse(g.publishedOn) - d) < 5 * 864e5 && norm(g.name).includes(norm(set.en).split(" ")[0])));
}

/* Foto da caixa: fundo branco liso → transparente (a partir das bordas), recorta e reduz para 360px de altura */
async function caixaPng(url, arquivo) {
  const r = await fetch(url, { headers: { "User-Agent": APP_UA } });
  if (!r.ok) return false;
  const img = sharp(Buffer.from(await r.arrayBuffer())).ensureAlpha();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info, px = (i) => i * 4;
  const claro = (i) => data[px(i)] > 236 && data[px(i) + 1] > 236 && data[px(i) + 2] > 236;
  const visto = new Uint8Array(w * h), fila = [];
  for (let x = 0; x < w; x++) fila.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) fila.push(y * w, y * w + w - 1);
  while (fila.length) {
    const i = fila.pop();
    if (visto[i] || !claro(i)) continue;
    visto[i] = 1;
    data[px(i) + 3] = 0;
    const x = i % w, y = (i / w) | 0;
    if (x > 0) fila.push(i - 1); if (x < w - 1) fila.push(i + 1); if (y > 0) fila.push(i - w); if (y < h - 1) fila.push(i + w);
  }
  await sharp(data, { raw: { width: w, height: h, channels: 4 } }).trim({ threshold: 1 }).resize({ height: 360, withoutEnlargement: true })
    .png({ palette: true, quality: 85, effort: 9 }).toFile(arquivo);
  return true;
}

await mkdir("public/img/caixas", { recursive: true });
const temas = [];
let semCaixa = 0, semCarta = 0;
await emParalelo(decks, 4, async (d) => {
  const set = porPc.get(d.pc);
  const cartas = new Map();
  for (const c of d.cards || []) {
    const x = cartaDe(c.id, c.name);
    if (!x) { semCarta++; console.log(`  ${d.name}: sem carta ${c.id} ${c.name}`); continue; }
    cartas.set(x[0], (cartas.get(x[0]) || 0) + (c.count || 1));
  }
  if (!cartas.size) return;
  const lista = [...cartas];
  // capa: os Pokémon mais fortes do deck (maior HP), com imagem
  const capa = lista.map(([id]) => cat.c.find((c) => c[0] === id)).filter((c) => c && c[5] === 0 && c[16]).sort((a, b) => b[8] - a[8]).slice(0, 3).map((c) => c[0]);
  const ano = (set?.d || "").slice(0, 4);
  const tema = { nome: `${d.name.replace(/\s*Theme Deck\s*/i, "").trim() || d.name}`, grupo: "oficiais", era: `${set?.pt || set?.en || d.pc} · ${ano}`,
    desc: `Deck temático oficial da coleção ${set?.pt || set?.en || d.pc}${set?.pt && set.en && set.pt !== set.en ? ` (${set.en})` : ""}, lançado em ${ano}, com as cartas e quantidades reais.`,
    cartas: lista, capa, data: set?.d || "", id: d.id };
  // foto da caixa
  const arq = `public/img/caixas/${d.id}.png`;
  const ja = await access(arq).then(() => true, () => false);
  if (ja) tema.caixa = `img/caixas/${d.id}.png`;
  else if (set) {
    const alvo = norm(d.name.replace(/theme deck/i, ""));
    for (const g of gruposDaColecao(set)) {
      const p = (await produtos(g.groupId)).find((x) => /deck/i.test(x.name) && norm(x.name).includes(alvo));
      if (p && await caixaPng(`https://tcgplayer-cdn.tcgplayer.com/product/${p.productId}_in_1000x1000.jpg`, arq).catch(() => false)) { tema.caixa = `img/caixas/${d.id}.png`; break; }
    }
  }
  if (!tema.caixa) semCaixa++;
  temas.push(tema);
}, "decks oficiais");
temas.sort((a, b) => b.data.localeCompare(a.data) || a.nome.localeCompare(b.nome));
for (const t of temas) delete t.id;
await writeFile("public/data/decks-oficiais.json", JSON.stringify(temas));
console.log(`${temas.length} decks oficiais; sem foto da caixa: ${semCaixa}; cartas não encontradas: ${semCarta}`);

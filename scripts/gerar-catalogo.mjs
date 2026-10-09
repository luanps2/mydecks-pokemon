/* Gera public/data/cartas.json: o catálogo completo do Pokémon TCG (TCGdex), em formato compacto, com os nomes em
   português, os dados usados nos filtros e o valor de mercado em reais (menor e maior valor de cada carta).
   Roda no GitHub Actions (todo dia, antes do build) e também à mão: node scripts/gerar-catalogo.mjs
   As cartas do "Pokémon Estampas Ilustradas Pocket" (série tcgp, jogo de celular) ficam de fora: não são cartas físicas. */
import { mkdir, writeFile } from "node:fs/promises";
import { cotacao, emParalelo, getJSON } from "./lib-api.mjs";

const API = "https://api.tcgdex.net/v2";
const FORA = new Set(["tcgp"]);   // séries que não entram
const t0 = Date.now();

// 1) séries e coleções nos dois idiomas
const [seriesEn, seriesPt, setsEnLista, setsPtLista] = await Promise.all([
  getJSON(`${API}/en/series`), getJSON(`${API}/pt/series`), getJSON(`${API}/en/sets`), getJSON(`${API}/pt/sets`),
]);
const ptSerie = new Map(seriesPt.map((s) => [s.id, s.name]));
const setsEn = (await emParalelo(setsEnLista.map((s) => s.id), 12, (id) => getJSON(`${API}/en/sets/${encodeURIComponent(id)}`), "coleções EN")).filter(Boolean);
const setsPt = new Map((await emParalelo(setsPtLista.map((s) => s.id), 12, (id) => getJSON(`${API}/pt/sets/${encodeURIComponent(id)}`), "coleções PT"))
  .filter(Boolean).map((s) => [s.id, s]));
const validos = setsEn.filter((s) => !FORA.has(s.serie?.id));
// coleções só em português (não existem na versão em inglês da API)
for (const [id, s] of setsPt) if (!setsEn.some((e) => e.id === id) && !FORA.has(s.serie?.id)) validos.push({ ...s, soPt: true });
validos.sort((a, b) => String(a.releaseDate).localeCompare(String(b.releaseDate)) || a.id.localeCompare(b.id));
console.log(`Coleções: ${validos.length} (de ${setsEn.length} em inglês e ${setsPt.size} em português)`);

// 2) dados completos de cada carta (inglês; as que só existem em português vêm do português)
const ptCarta = new Map();   // id → { name, image } da versão em português
for (const s of setsPt.values()) for (const c of s.cards || []) ptCarta.set(c.id, c);
const alvos = [];
for (const s of validos) for (const c of s.cards || []) alvos.push({ id: c.id, set: s, img: !!c.image, lang: s.soPt ? "pt" : "en" });
console.log(`Cartas para baixar: ${alvos.length}`);
const dados = await emParalelo(alvos, 16, async (a) => {
  try { return await getJSON(`${API}/${a.lang}/cards/${encodeURIComponent(a.id)}`); }
  catch (e) { console.log("falhou:", a.id, e.message); return null; }
}, "cartas");

// 3) cotação do dia e valor de cada carta em reais
const cot = await cotacao();
console.log("Cotação:", cot);
/** menor e maior valor (R$) entre as versões da carta (normal, holo, reverse, 1ª edição…): TCGplayer primeiro; sem ele, Cardmarket */
function valores(p) {
  if (!p) return [0, 0];
  const usd = [];
  for (const [k, v] of Object.entries(p.tcgplayer || {})) {
    if (k === "unit" || k === "updated" || !v || typeof v !== "object") continue;
    const x = v.marketPrice || v.midPrice || v.lowPrice;
    if (x > 0) usd.push(x);
  }
  if (usd.length) return [Math.min(...usd) * cot.usd, Math.max(...usd) * cot.usd];
  const cm = p.cardmarket || {};
  const eur = [cm.avg || cm.trend, cm["avg-holo"] || cm["trend-holo"]].filter((x) => x > 0);
  return eur.length ? [Math.min(...eur) * cot.eur, Math.max(...eur) * cot.eur] : [0, 0];
}

// 4) formato compacto: dicionários para os textos que se repetem
const dic = { stage: [""], rarity: [""], sub: [""], suffix: [""], illus: [""] };
const cod = (k, v) => { if (!v) return 0; let i = dic[k].indexOf(v); if (i < 0) { i = dic[k].length; dic[k].push(v); } return i; };
const TIPOS = { Grass: "G", Fire: "R", Water: "W", Lightning: "L", Psychic: "P", Fighting: "F", Darkness: "D", Metal: "M", Fairy: "Y", Dragon: "N", Colorless: "C" };
const TIPOS_PT = { Planta: "G", Fogo: "R", "Água": "W", "Elétrico": "L", "Psíquico": "P", Lutador: "F", Sombrio: "D", Metal: "M", Fada: "Y", "Dragão": "N", Incolor: "C" };
const CAT = { Pokemon: 0, "Pokémon": 0, Trainer: 1, Treinador: 1, Energy: 2, Energia: 2 };
const setIdx = new Map(validos.map((s, i) => [s.id, i]));
const cartas = [];
let semDados = 0;
alvos.forEach((a, i) => {
  const d = dados[i];
  if (!d) { semDados++; return; }
  const pt = ptCarta.get(a.id);
  const [lo, hi] = valores(d.pricing);
  const tipos = (d.types || []).map((t) => TIPOS[t] || TIPOS_PT[t] || "").join("");
  const legal = (d.legal?.standard ? 1 : 0) | (d.legal?.expanded ? 2 : 0);
  const img = (a.lang === "en" && a.img ? 1 : 0) | (pt?.image ? 2 : 0);
  const nomePt = pt && pt.name !== d.name ? pt.name : "";
  cartas.push([
    a.id, d.name, nomePt, setIdx.get(a.set.id), d.localId, CAT[d.category] ?? 1, tipos, cod("stage", d.stage), d.hp || 0,
    cod("rarity", d.rarity === "None" ? "" : d.rarity), cod("sub", d.trainerType || d.energyType), cod("suffix", d.suffix), d.regulationMark || "",
    legal, d.evolveFrom || "", (d.dexId || [])[0] || 0, img, Math.round(lo * 100) / 100, Math.round(hi * 100) / 100, cod("illus", d.illustrator),
  ]);
});
console.log(`Cartas no catálogo: ${cartas.length} (sem dados: ${semDados})`);
for (const k of ["stage", "rarity", "sub", "suffix"]) console.log(k + ":", dic[k].slice(1).join(" | "));

const sets = validos.map((s) => ({
  id: s.id, s: s.serie?.id || "", en: s.soPt ? "" : s.name, pt: setsPt.get(s.id)?.name || "", d: s.releaseDate || "",
  ab: s.abbreviation?.official || s.tcgOnline || "", n: s.cardCount?.official || 0, t: s.cardCount?.total || 0,
  logo: s.logo ? 1 : 0, sym: s.symbol ? 1 : 0,
}));
const series = [];
for (const s of validos) if (s.serie && !series.some((x) => x.id === s.serie.id))
  series.push({ id: s.serie.id, en: seriesEn.find((x) => x.id === s.serie.id)?.name || s.serie.name, pt: ptSerie.get(s.serie.id) || "" });

const out = { gerado: new Date().toISOString(), cotacao: cot, series, sets, dic, campos: "id,nomeEn,nomePt,set,num,cat,tipos,estagio,hp,raridade,sub,sufixo,regulacao,legal,evoluiDe,dex,img,menor,maior,ilustrador", c: cartas };
await mkdir("public/data", { recursive: true });
const json = JSON.stringify(out);
await writeFile("public/data/cartas.json", json);
console.log(`public/data/cartas.json: ${(json.length / 1048576).toFixed(2)} MB em ${((Date.now() - t0) / 1000).toFixed(0)} s`);
if (cartas.length < 15000) { console.log("Poucas cartas: algo deu errado na API."); process.exit(1); }

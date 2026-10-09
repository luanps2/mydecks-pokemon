/* Gera public/data/decks-meta.json (grupos "meta" e "campeoes") e public/data/populares.json, a partir da Limitless TCG.
   - Meta atual: torneios do formato Padrão dos últimos 35 dias na play.limitlesstcg.com (API pública), os 16 arquétipos
     que mais aparecem entre os melhores colocados; de cada um, a lista com a melhor colocação no maior torneio.
   - Metas antigos: o deck campeão de cada Mundial (limitlesstcg.com/tournaments?time=all, páginas HTML; 2017 em diante).
   - Populares: as cartas mais usadas nas listas dos melhores colocados desses torneios e dos campeões (para as "Sugestões para você").
   Roda no GitHub Actions (workflow "Atualizar dados"). */
import { readFile, writeFile } from "node:fs/promises";
import { emParalelo, getJSON } from "./lib-api.mjs";

const cat = JSON.parse(await readFile("public/data/cartas.json", "utf8"));
const norm = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[’‘`]/g, "'").toLowerCase().trim();
const semZeros = (n) => String(n).replace(/^0+(?=\d)/, "").toLowerCase();

// siglas das coleções (as impressas na carta, usadas pelo Pokémon TCG Live e pela Limitless) → coleção da TCGdex
const porSigla = new Map();
for (const s of cat.sets) if (s.ab) porSigla.set(s.ab.toUpperCase(), s);
const APELIDOS = { SVP: "svp", "PR-SV": "svp", "PR-SW": "swshp", SWSHP: "swshp", SMP: "smp", "PR-SM": "smp", "PR-XY": "xyp", "PR-BLW": "bwp", MEP: "mep" };
const porNumero = new Map(), porNome = new Map(), porId = new Map(cat.c.map((c) => [c[0], c]));
for (const c of cat.c) {
  const set = cat.sets[c[3]];
  porNumero.set(set.id + "|" + semZeros(c[4]), c);
  const k = norm(c[1]);
  if (!porNome.has(k)) porNome.set(k, []);
  porNome.get(k).push(c);
}
const melhorPorNome = (nome) => {
  const l = porNome.get(norm(nome));
  return l ? [...l].sort((a, b) => (b[16] & 2) - (a[16] & 2) || (b[16] ? 1 : 0) - (a[16] ? 1 : 0) || cat.sets[b[3]].d.localeCompare(cat.sets[a[3]].d))[0] : null;
};
let naoAchei = 0;
function carta(sigla, numero, nome) {
  const s = porSigla.get(String(sigla).toUpperCase()) || cat.sets.find((x) => x.id === APELIDOS[String(sigla).toUpperCase()]);
  const c = s && porNumero.get(s.id + "|" + semZeros(numero));
  if (c && norm(c[1]).split(" ")[0] === norm(nome).split(" ")[0]) return c;
  const r = melhorPorNome(nome) || melhorPorNome(nome.replace(/^Basic /, ""));
  if (!r) { naoAchei++; console.log("  não achei:", sigla, numero, nome); }
  return r;
}
/** lista [{count, set, number, name}] → [[id, cópias]] (junta as repetidas) */
function converter(cartas) {
  const m = new Map();
  for (const x of cartas) { const c = carta(x.set, x.number, x.name); if (c) m.set(c[0], (m.get(c[0]) || 0) + (+x.count || 1)); }
  return [...m];
}
/** capa: os 3 Pokémon com mais cópias (os de maior HP primeiro no empate), com imagem */
function capaDe(lista) {
  const info = (id) => porId.get(id);
  return lista.map(([id, q]) => ({ c: info(id), q })).filter((x) => x.c && x.c[5] === 0 && x.c[16])
    .sort((a, b) => b.q - a.q || b.c[8] - a.c[8]).slice(0, 3).map((x) => x.c[0]);
}
const uso = new Map();   // nome da carta → { n, porId }
function contarUso(lista) {
  for (const [id, q] of lista) {
    const c = porId.get(id);
    if (!c || (c[5] === 2 && cat.dic.sub[c[10]] !== "Special")) continue;   // energia básica não é sugestão
    const k = norm(c[1]), e = uso.get(k) || { n: 0, porId: new Map() };
    e.n += q; e.porId.set(id, (e.porId.get(id) || 0) + q);
    uso.set(k, e);
  }
}
const mes = (d) => new Date(d).toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
const dataBr = (d) => new Date(d).toLocaleDateString("pt-BR");

// ===== 1) Meta atual =====
const PLAY = "https://play.limitlesstcg.com/api";
const desde = Date.now() - 35 * 864e5;
let torneios = [];
for (let page = 1; page <= 8; page++) {
  const t = await getJSON(`${PLAY}/tournaments?game=PTCG&format=STANDARD&limit=100&page=${page}`).catch(() => []);
  if (!t?.length) break;
  torneios.push(...t);
  if (Date.parse(t[t.length - 1].date) < desde) break;
}
torneios = torneios.filter((t) => Date.parse(t.date) >= desde && t.players >= 32).sort((a, b) => b.players - a.players).slice(0, 60);
console.log("Torneios do meta:", torneios.length);
const arqs = new Map();   // arquétipo → { nome, n, melhor }
await emParalelo(torneios, 6, async (t) => {
  const st = await getJSON(`${PLAY}/tournaments/${t.id}/standings`).catch(() => null);
  if (!Array.isArray(st)) return;
  const corte = Math.max(8, Math.round(t.players * 0.125));
  for (const p of st) {
    if (!p.decklist || !p.deck?.id || p.deck.id === "other" || !p.placing || p.placing > corte) continue;
    const a = arqs.get(p.deck.id) || { nome: p.deck.name, n: 0, melhor: null };
    a.n++;
    contarUso(converter([...(p.decklist.pokemon || []), ...(p.decklist.trainer || []), ...(p.decklist.energy || [])]));
    const nota = t.players / p.placing;
    if (!a.melhor || nota > a.melhor.nota) a.melhor = { nota, p, t };
    arqs.set(p.deck.id, a);
  }
}, "torneios");
const meta = [...arqs.values()].sort((a, b) => b.n - a.n).slice(0, 16).map((a) => {
  const { p, t } = a.melhor, d = p.decklist;
  const lista = converter([...(d.pokemon || []), ...(d.trainer || []), ...(d.energy || [])]);
  return { nome: a.nome, grupo: "meta", era: `Padrão · ${mes(t.date)}`, data: t.date.slice(0, 10), capa: capaDe(lista), cartas: lista,
    desc: `Aparece ${a.n} vezes entre os melhores colocados de ${torneios.length} torneios recentes. Esta é a lista de ${p.name}, ${p.placing}º lugar em "${t.name}" (${t.players} jogadores, ${dataBr(t.date)}).` };
});
console.log("Meta:", meta.map((m) => `${m.nome} (${m.cartas.reduce((s, x) => s + x[1], 0)})`).join(", "));

// ===== 2) Campeões do Mundial =====
const SITE = "https://limitlesstcg.com";
const lista = await getJSON(`${SITE}/tournaments?time=all&show=500`, { texto: true });
const mundiais = [...lista.matchAll(/<tr[^>]*data-date="([^"]*)"[^>]*data-name="(World Championships \d{4})"[^>]*data-winner="([^"]*)"[\s\S]{0,600}?href="(\/tournaments\/\d+)"/g)]
  .map((m) => ({ data: m[1], nome: m[2], vencedor: m[3], url: m[4] }));
console.log("Mundiais:", mundiais.map((m) => m.nome).join(", "));
function lerLista(html) {
  const out = [];
  for (const m of html.matchAll(/class="decklist-card" data-set="([^"]*)" data-number="([^"]*)"[\s\S]*?card-count">(\d+)<[\s\S]*?card-name">([^<]*)</g))
    out.push({ set: m[1], number: m[2], count: +m[3], name: m[4].replace(/&#039;|&apos;/g, "'").replace(/&amp;/g, "&").trim() });
  return out;
}
const campeoes = [];
for (const w of mundiais) {
  const h = await getJSON(SITE + w.url, { texto: true }).catch(() => "");
  const m = h.match(/<tr data-rank="1" data-name="([^"]*)" data-country="([^"]*)" data-deck="([^"]*)"[\s\S]*?href="(\/decks\/list\/\d+)"/);
  if (!m) { console.log("sem lista do campeão:", w.nome); continue; }
  const l = lerLista(await getJSON(SITE + m[4], { texto: true }));
  const cartas = converter(l);
  contarUso(cartas);
  const ano = w.nome.match(/\d{4}/)[0];
  campeoes.push({ nome: `Campeão mundial ${ano}: ${m[3].replace(/&amp;/g, "&")}`, grupo: "campeoes", era: `Mundial ${ano}`, data: w.data, capa: capaDe(cartas), cartas,
    desc: `O deck de ${m[1]} (${m[2]}), campeão do Mundial de ${ano} na categoria principal (Masters).` });
}
console.log("Campeões:", campeoes.map((c) => `${c.nome} (${c.cartas.reduce((s, x) => s + x[1], 0)})`).join(", "));

// ===== 3) Gravar =====
if (meta.length < 5) { console.log("Poucos decks do meta: algo deu errado; arquivos mantidos."); process.exit(1); }
await writeFile("public/data/decks-meta.json", JSON.stringify([...meta, ...campeoes]));
const populares = [...uso.values()].sort((a, b) => b.n - a.n).slice(0, 500)
  .map((e) => [...e.porId].sort((a, b) => b[1] - a[1])[0][0]);
await writeFile("public/data/populares.json", JSON.stringify(populares));
console.log(`decks-meta.json: ${meta.length} do meta + ${campeoes.length} campeões; populares: ${populares.length}; cartas não encontradas: ${naoAchei}`);

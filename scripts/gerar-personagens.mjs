/* Gera public/data/decks-personagens.json a partir de scripts/personagens.mjs e do catálogo (public/data/cartas.json).
   Roda sem internet: node scripts/gerar-personagens.mjs
   Para cada nome escolhe a impressão: a coleção pedida (@id) ou, nesta ordem, com imagem em português, com imagem,
   legal no Expandido, a mais barata e a mais nova. Confere 60 cartas e no máximo 4 cópias com o mesmo nome (Energia Básica livre). */
import { readFile, writeFile } from "node:fs/promises";
import { PERSONAGENS } from "./personagens.mjs";

const cat = JSON.parse(await readFile("public/data/cartas.json", "utf8"));
const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[’‘`]/g, "'").toLowerCase().trim();
const porNome = new Map();
for (const c of cat.c) {
  const k = norm(c[1]);
  if (!porNome.has(k)) porNome.set(k, []);
  porNome.get(k).push(c);
}
const SV_ENERGIA = new Set(["sve", "mee"]);
function escolher(nome, colecao) {
  const lista = porNome.get(norm(nome));
  if (!lista) return null;
  const set = (c) => cat.sets[c[3]];
  const nota = (c) => (colecao && set(c).id === colecao ? 1000 : 0) + (c[16] & 2 ? 8 : 0) + (c[16] & 1 ? 4 : set(c).pc ? 2 : 0)
    + (c[13] & 2 ? 2 : 0) + (c[5] === 2 && SV_ENERGIA.has(set(c).id) ? 3 : 0);
  // empate: a versão mais barata (as raras de ilustração deixariam o deck caro), depois a mais nova
  const preco = (c) => (c[17] > 0 ? c[17] : 1e6);
  return [...lista].sort((a, b) => nota(b) - nota(a) || preco(a) - preco(b) || set(b).d.localeCompare(set(a).d))[0];
}

let erros = 0;
const temas = PERSONAGENS.map((p) => {
  const cartas = [], capa = [], porCopia = new Map();
  let total = 0;
  for (const linha of p.cartas.trim().split("\n")) {
    const m = linha.trim().match(/^(\*?)(\d+)\s+(.+?)(?:\s+@(\S+))?$/);
    if (!m) { console.log(`${p.nome}: linha estranha "${linha}"`); erros++; continue; }
    const [, star, q, nome, col] = m;
    const c = escolher(nome, col);
    if (!c) { console.log(`${p.nome}: NÃO ACHEI "${nome}"`); erros++; continue; }
    cartas.push([c[0], +q]);
    if (star) capa.push(c[0]);
    total += +q;
    const basica = c[5] === 2 && cat.dic.sub[c[10]] !== "Special";
    if (!basica) porCopia.set(norm(nome), (porCopia.get(norm(nome)) || 0) + +q);
  }
  if (total !== 60) { console.log(`${p.nome}: ${total} cartas (precisa de 60)`); erros++; }
  for (const [n, q] of porCopia) if (q > 4) { console.log(`${p.nome}: ${q} cópias de ${n}`); erros++; }
  return { nome: p.nome, grupo: "personagens", era: p.era, desc: p.desc, retrato: p.retrato, capa: capa.slice(0, 3), cartas };
});
await writeFile("public/data/decks-personagens.json", JSON.stringify(temas));
console.log(`${temas.length} decks de personagens gravados; problemas: ${erros}`);
if (erros) process.exitCode = 1;

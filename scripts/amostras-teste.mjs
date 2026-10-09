/* Baixa uma amostra real de imagens e respostas da TCGdex para testar o site no navegador num ambiente sem acesso
   à internet (as sessões na nuvem do Claude). Grava em amostras/, espelhando os caminhos originais:
   amostras/img/{idioma}/{série}/{coleção}/{número}/{low|high}.webp e amostras/api/{idioma}/cards/{id}.json.
   O workflow "Amostras para testes" grava isso no ramo amostras-teste (fora do main). */
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { dirname } from "node:path";
import { emParalelo, getJSON, UA } from "./lib-api.mjs";

const cat = JSON.parse(await readFile("public/data/cartas.json", "utf8"));
const COLS = (process.env.AMOSTRA_COLECOES || "sv03.5,base1,me02.5,sv08,swsh7").split(",");
const ALTA = new Set((process.env.AMOSTRA_ALTA || "").split(",").filter(Boolean));
const ids = cat.c.filter((c) => COLS.includes(cat.sets[c[3]].id));
const extra = (process.env.AMOSTRA_IDS || "").split(",").filter(Boolean);
for (const id of extra) { const c = cat.c.find((x) => x[0] === id); if (c && !ids.includes(c)) ids.push(c); }
console.log("Cartas na amostra:", ids.length);
async function baixar(url, arq) {
  const r = await fetch(url, { headers: { "User-Agent": UA } });
  if (!r.ok) return false;
  await mkdir(dirname(arq), { recursive: true });
  await writeFile(arq, Buffer.from(await r.arrayBuffer()));
  return true;
}
let n = 0;
await emParalelo(ids, 12, async (c) => {
  const set = cat.sets[c[3]], img = c[16];
  for (const lang of ["pt", "en"]) {
    if (lang === "pt" ? img & 2 : img & 1) {
      const base = `${lang}/${set.s}/${set.id}/${c[4]}`;
      if (await baixar(`https://assets.tcgdex.net/${base}/low.webp`, `amostras/img/${base}/low.webp`)) n++;
      if (ALTA.has(set.id) || ALTA.has(c[0]) || extra.includes(c[0])) await baixar(`https://assets.tcgdex.net/${base}/high.webp`, `amostras/img/${base}/high.webp`);
    }
    const j = await getJSON(`https://api.tcgdex.net/v2/${lang}/cards/${encodeURIComponent(c[0])}`).catch(() => null);
    if (j) { await mkdir(`amostras/api/${lang}/cards`, { recursive: true }); await writeFile(`amostras/api/${lang}/cards/${c[0]}.json`, JSON.stringify(j)); }
  }
}, "amostra");
console.log("Imagens:", n);

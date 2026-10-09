/* Baixa os retratos dos personagens do Pokémon Wiki (Fandom) para public/img/personagens/{chave}.png:
   imagem principal da página do personagem (arte oficial, quase sempre com fundo transparente); se vier com fundo
   liso, apaga o fundo a partir das bordas; corta as sobras e reduz para 520px de altura.
   Arquivo escolhido à mão: RETRATOS_ARQUIVOS='{"ash": "Ash JN.png"}'. Só alguns: RETRATOS_APENAS="ash,misty".
   Roda no GitHub Actions (workflow "Atualizar dados"). Precisa de: npm i --no-save --no-package-lock sharp */
import { mkdir } from "node:fs/promises";
import sharp from "sharp";
import { getJSON } from "./lib-api.mjs";

const PAGINAS = {
  ash: ["Ash Ketchum"], misty: ["Misty"], brock: ["Brock"], gary: ["Gary Oak"], "equipe-rocket": ["Team Rocket trio", "Jessie"],
  dawn: ["Dawn"], may: ["May"], serena: ["Serena (anime)", "Serena"], goh: ["Goh"], liko: ["Liko"], roy: ["Roy"], red: ["Red"], cynthia: ["Cynthia"],
};
const API = "https://pokemon.fandom.com/api.php?format=json&action=query";
const escolhidos = JSON.parse(process.env.RETRATOS_ARQUIVOS || "{}");
const apenas = (process.env.RETRATOS_APENAS || "").split(",").filter(Boolean);

async function urlDaPagina(titulo) {
  const r = await getJSON(`${API}&prop=pageimages&piprop=original&titles=${encodeURIComponent(titulo)}`);
  const p = Object.values(r?.query?.pages || {})[0];
  return p?.original?.source || "";
}
async function urlDoArquivo(nome) {
  const r = await getJSON(`${API}&prop=imageinfo&iiprop=url&titles=${encodeURIComponent("File:" + nome)}`);
  return Object.values(r?.query?.pages || {})[0]?.imageinfo?.[0]?.url || "";
}
/* fundo liso (cor do canto) → transparente, a partir das bordas */
function apagarFundo(data, w, h) {
  const px = (i) => i * 4;
  if (data[3] < 250) return;   // já tem transparência
  const [r0, g0, b0] = [data[0], data[1], data[2]];
  const perto = (i) => Math.abs(data[px(i)] - r0) + Math.abs(data[px(i) + 1] - g0) + Math.abs(data[px(i) + 2] - b0) < 40;
  const visto = new Uint8Array(w * h), fila = [];
  for (let x = 0; x < w; x++) fila.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) fila.push(y * w, y * w + w - 1);
  while (fila.length) {
    const i = fila.pop();
    if (visto[i] || !perto(i)) continue;
    visto[i] = 1; data[px(i) + 3] = 0;
    const x = i % w, y = (i / w) | 0;
    if (x > 0) fila.push(i - 1); if (x < w - 1) fila.push(i + 1); if (y > 0) fila.push(i - w); if (y < h - 1) fila.push(i + w);
  }
}

await mkdir("public/img/personagens", { recursive: true });
for (const [chave, titulos] of Object.entries(PAGINAS)) {
  if (apenas.length && !apenas.includes(chave)) continue;
  let url = escolhidos[chave] ? await urlDoArquivo(escolhidos[chave]) : "";
  for (const t of titulos) { if (url) break; url = await urlDaPagina(t).catch(() => ""); }
  if (!url) { console.log(`${chave}: sem imagem`); continue; }
  const r = await fetch(url);
  if (!r.ok) { console.log(`${chave}: ${r.status} ${url}`); continue; }
  const { data, info } = await sharp(Buffer.from(await r.arrayBuffer())).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  apagarFundo(data, info.width, info.height);
  await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).trim({ threshold: 1 })
    .resize({ height: 520, withoutEnlargement: true }).png({ palette: true, quality: 90, effort: 9 }).toFile(`public/img/personagens/${chave}.png`);
  console.log(`${chave}: ${decodeURIComponent(url.split("/images/")[1]?.split("/revision")[0] || url)} (${info.width}×${info.height})`);
}

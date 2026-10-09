import type { CatCard, EnergyType } from "../types";
import { norm } from "./util";

/* ===== Nomes em português (os mesmos da TCGdex em português e das cartas impressas no Brasil) ===== */

/** Tipos de energia: nome, cor do selo (fundo e texto) e símbolo curto */
export const TYPES: Record<EnergyType, { pt: string; en: string; bg: string; fg: string }> = {
  G: { pt: "Grama", en: "Grass", bg: "#4f9d43", fg: "#fff" },
  R: { pt: "Fogo", en: "Fire", bg: "#d9432c", fg: "#fff" },
  W: { pt: "Água", en: "Water", bg: "#2f86d0", fg: "#fff" },
  L: { pt: "Elétrico", en: "Lightning", bg: "#f2c12e", fg: "#2a2105" },
  P: { pt: "Psíquico", en: "Psychic", bg: "#9b59b6", fg: "#fff" },
  F: { pt: "Luta", en: "Fighting", bg: "#b5672f", fg: "#fff" },
  D: { pt: "Escuridão", en: "Darkness", bg: "#2f3b45", fg: "#fff" },
  M: { pt: "Metal", en: "Metal", bg: "#8c99a6", fg: "#16191c" },
  Y: { pt: "Fada", en: "Fairy", bg: "#e07fb4", fg: "#2a0d1d" },
  N: { pt: "Dragão", en: "Dragon", bg: "#b08b2e", fg: "#fff" },
  C: { pt: "Incolor", en: "Colorless", bg: "#d8d4cb", fg: "#24221d" },
};
export const TYPE_ORDER = Object.keys(TYPES) as EnergyType[];
/** Nome do tipo vindo da API (em inglês ou português) → letra */
const TYPE_BY_NAME: Record<string, EnergyType> = {};
for (const k of TYPE_ORDER) { TYPE_BY_NAME[norm(TYPES[k].en)] = k; TYPE_BY_NAME[norm(TYPES[k].pt)] = k; }
Object.assign(TYPE_BY_NAME, { planta: "G", lutador: "F", sombrio: "D", escuro: "D" });
export const typeOf = (name = ""): EnergyType | undefined => TYPE_BY_NAME[norm(name)];
export const typePt = (name = "") => { const k = typeOf(name); return k ? TYPES[k].pt : name; };

export const CAT_PT = ["Pokémon", "Treinador", "Energia"] as const;

const STAGE_PT: Record<string, string> = {
  Basic: "Básico", Stage1: "Estágio 1", Stage2: "Estágio 2", VMAX: "VMAX", VSTAR: "V-ASTRO", MEGA: "Mega", BREAK: "TURBO",
  "LEVEL-UP": "Nível X", "V-UNION": "V-UNIÃO", Restored: "Restaurado", Baby: "Bebê", LEGEND: "LENDA",
};
export const stagePt = (s = "") => STAGE_PT[s] || s;

const SUB_PT: Record<string, string> = {
  Item: "Item", Supporter: "Apoiador", Stadium: "Estádio", Tool: "Ferramenta", "Pokémon Tool": "Ferramenta", "Technical Machine": "Máquina Técnica",
  "Rocket's Secret Machine": "Máquina Secreta da Equipe Rocket", "Goldenrod Game Corner": "Item",
  Normal: "Básica", Special: "Especial",
};
export const subPt = (s = "") => SUB_PT[s] || s;

const RARITY_PT: Record<string, string> = {
  Common: "Comum", Uncommon: "Incomum", Rare: "Rara", "Rare Holo": "Rara Holo", "Holo Rare": "Rara Holo", "Double rare": "Rara Dupla",
  "Ultra Rare": "Ultra Rara", "Illustration rare": "Ilustração Rara", "Special illustration rare": "Ilustração Rara Especial",
  "Hyper rare": "Hiper Rara", "ACE SPEC Rare": "ACE SPEC Rara", "Shiny rare": "Shiny Rara", "Shiny Ultra Rare": "Shiny Ultra Rara",
  "Shiny rare V": "Shiny Rara V", "Shiny rare VMAX": "Shiny Rara VMAX", "Amazing Rare": "Rara Incrível", "Radiant Rare": "Rara Radiante",
  "Rare Holo V": "Rara Holo V", "Holo Rare V": "Rara Holo V", "Rare Holo VMAX": "Rara Holo VMAX", "Holo Rare VMAX": "Rara Holo VMAX",
  "Rare Holo VSTAR": "Rara Holo V-ASTRO", "Holo Rare VSTAR": "Rara Holo V-ASTRO", "Secret Rare": "Rara Secreta", "Rare Secret": "Rara Secreta",
  "Full Art Trainer": "Arte Completa de Treinador", "Rare Holo LV.X": "Rara Holo Nível X", "Rare PRIME": "Rara PRIME", "Rare BREAK": "Rara TURBO",
  "Rare Ultra": "Ultra Rara", "Rare Rainbow": "Rara Arco-íris", "Rare Shiny": "Shiny Rara", "Rare Shining": "Rara Brilhante", "Rare Holo EX": "Rara Holo EX",
  "Rare Holo GX": "Rara Holo GX", "Rare Prism Star": "Rara Prisma", "Rare ACE": "ACE SPEC Rara", Promo: "Promo", "Black White Rare": "Rara Preto e Branco",
  "Mega Hyper Rare": "Mega Hiper Rara", "Crown": "Coroa", "One Diamond": "1 Diamante", LEGEND: "LENDA", "Classic Collection": "Coleção Clássica",
};
export const rarityPt = (r = "") => RARITY_PT[r] || r;

/** Nome da série (era) em português; a TCGdex não traduz todas */
const SERIE_PT: Record<string, string> = {
  base: "Coleção Básica", gym: "Gym", neo: "Neo", lc: "Coleção Lendária", ecard: "e-Card", ex: "EX", pop: "POP", tk: "Kits de Treinador",
  dp: "Diamante & Pérola", pl: "Platina", hgss: "HeartGold SoulSilver", col: "Chamado das Lendas", bw: "Black & White", xy: "XY",
  sm: "Sol & Lua", swsh: "Espada & Escudo", sv: "Escarlate & Violeta", me: "Megaevolução", misc: "Diversos", mc: "McDonald's", tcgp: "Pocket",
};
export const seriePt = (id: string, fallback = "") => SERIE_PT[id] || fallback || id;

/** Grupo de "estágio" usado nos filtros: Básico, Estágio 1, Estágio 2 e as mecânicas especiais (ex, EX, GX, V, VMAX, V-ASTRO, Mega) */
export type StageFilter = "" | "basic" | "s1" | "s2" | "ex" | "EX" | "GX" | "V" | "VMAX" | "VSTAR" | "MEGA" | "BREAK";
export const STAGE_FILTERS: [StageFilter, string][] = [
  ["", "Todos"], ["basic", "Básico"], ["s1", "Estágio 1"], ["s2", "Estágio 2"], ["ex", "ex (minúsculo)"], ["EX", "EX"], ["GX", "GX"],
  ["V", "V"], ["VMAX", "VMAX"], ["VSTAR", "V-ASTRO"], ["MEGA", "Mega"], ["BREAK", "TURBO"],
];
export function matchStage(c: CatCard, f: StageFilter): boolean {
  if (!f) return true;
  if (c.cat !== 0) return false;
  const name = c.en;
  switch (f) {
    case "basic": return c.stage === "Basic";
    case "s1": return c.stage === "Stage1";
    case "s2": return c.stage === "Stage2";
    case "ex": return c.suffix === "ex" || / ex\b/.test(name);
    case "EX": return c.suffix === "EX" || /[- ]EX\b/.test(name);
    case "GX": return c.suffix === "GX" || /[- ]GX\b/.test(name);
    case "V": return c.suffix === "V" || / V$/.test(name);
    case "VMAX": return c.stage === "VMAX" || / VMAX$/.test(name);
    case "VSTAR": return c.stage === "VSTAR" || / VSTAR$/.test(name);
    case "MEGA": return c.stage === "MEGA" || /^(Mega |M )/.test(name);
    case "BREAK": return c.stage === "BREAK" || / BREAK$/.test(name);
  }
  return true;
}

/** Subtipos de Treinador e de Energia usados nos filtros */
export type SubFilter = "" | "Item" | "Supporter" | "Stadium" | "Tool" | "basicE" | "specialE";
export const SUB_FILTERS: [SubFilter, string][] = [
  ["", "Todos"], ["Item", "Item"], ["Supporter", "Apoiador"], ["Stadium", "Estádio"], ["Tool", "Ferramenta"], ["basicE", "Energia Básica"], ["specialE", "Energia Especial"],
];
export function matchSub(c: CatCard, f: SubFilter): boolean {
  if (!f) return true;
  if (f === "basicE") return c.cat === 2 && c.sub !== "Special";
  if (f === "specialE") return c.cat === 2 && c.sub === "Special";
  if (c.cat !== 1) return false;
  if (f === "Tool") return /Tool/.test(c.sub);
  return c.sub === f;
}
/** Energia básica (fica fora da regra de no máximo 4 cópias) */
export const isBasicEnergy = (c: CatCard) => c.cat === 2 && c.sub !== "Special";

/** Resumo curto do tipo da carta: "Pokémon · Fogo · Estágio 2", "Treinador · Apoiador", "Energia Especial" */
export function kindLine(c: CatCard): string {
  if (c.cat === 0) return ["Pokémon", c.types.map((t) => TYPES[t].pt).join("/"), stagePt(c.stage)].filter(Boolean).join(" · ");
  if (c.cat === 1) return ["Treinador", subPt(c.sub)].filter(Boolean).join(" · ");
  return c.sub === "Special" ? "Energia Especial" : "Energia Básica";
}

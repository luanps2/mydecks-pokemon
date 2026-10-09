import type { CatCard } from "../types";

/* ===== Valor de mercado =====
   Vem do catálogo (public/data/cartas.json, gerado todo dia): menor e maior valor em reais de cada carta,
   a partir do TCGplayer (US$) e, sem ele, do Cardmarket (€), convertidos pela cotação do dia. */

/** Faixas do filtro por valor (pelo menor valor da carta) */
export type PriceBand = "" | "1" | "5" | "20" | "100" | "500" | "500+" | "none";
export const PRICE_BANDS: [PriceBand, string][] = [
  ["", "Todos os valores"], ["1", "Até R$ 1"], ["5", "R$ 1 a R$ 5"], ["20", "R$ 5 a R$ 20"], ["100", "R$ 20 a R$ 100"],
  ["500", "R$ 100 a R$ 500"], ["500+", "Acima de R$ 500"], ["none", "Sem preço informado"],
];
const LIMITS: Record<string, [number, number]> = { "1": [0, 1], "5": [1, 5], "20": [5, 20], "100": [20, 100], "500": [100, 500], "500+": [500, Infinity] };
export function inBand(c: CatCard | undefined, band: PriceBand): boolean {
  if (!band) return true;
  const v = c?.lo || 0;
  if (band === "none") return !(v > 0);
  const [a, b] = LIMITS[band];
  return v > 0 && v > a - 1e-9 && v <= b;
}

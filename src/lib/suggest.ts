import type { CatCard } from "../types";
import type { Catalog } from "./catalog";
import { norm, readJSON, writeJSON } from "./util";

/* ===== Sugestões de cartas =====
   public/data/populares.json: códigos das cartas mais usadas nos decks dos torneios recentes (Limitless), na ordem de
   popularidade, gerado por scripts/gerar-meta.mjs. Sem o arquivo, usa as cartas mais valiosas do formato Padrão. */
let cache: Promise<string[]> | null = null;
export function loadPopular(): Promise<string[]> {
  return cache || (cache = fetch(import.meta.env.BASE_URL + "data/populares.json")
    .then((r) => (r.ok ? (r.json() as Promise<string[]>) : []), () => []));
}
export function popularPool(cat: Catalog, ids: string[]): CatCard[] {
  const list = ids.map((id) => cat.byId.get(id)).filter((c): c is CatCard => !!c && (c.imgPt || c.imgEn));
  if (list.length >= 60) return list;
  return cat.cards.filter((c) => c.std && (c.imgPt || c.imgEn) && c.lo > 0).sort((a, b) => b.lo - a.lo).slice(0, 400);
}

/* Cartas já sugeridas recentemente: ficam de fora até a lista de populares se esgotar */
const SEEN = "mdp-sugestoes-vistas";

/* Sorteia n cartas que a pessoa ainda não tem (pelo nome), sem repetir as das últimas visitas e sem repetir nomes.
   As do topo da lista têm mais chance de sair, mas todas aparecem com o tempo. */
export function pickSuggestions(pool: CatCard[], have: Set<string>, n: number): CatCard[] {
  const fresh = pool.filter((c) => !have.has(norm(c.en)));
  let seen = new Set<string>(readJSON<string[]>(SEEN, []));
  let cand = fresh.map((c, rank) => ({ c, rank })).filter((x) => !seen.has(x.c.id));
  if (cand.length < n) { seen = new Set(); cand = fresh.map((c, rank) => ({ c, rank })); }
  // sorteio com peso: chave aleatória ^ (1/peso), fica com as maiores (amostragem ponderada sem repetição)
  const keyed = cand.map((x) => ({ c: x.c, k: Math.pow(Math.random(), Math.sqrt(x.rank + 15)) })).sort((a, b) => b.k - a.k);
  const out: CatCard[] = [], names = new Set<string>();
  for (const x of keyed) {
    if (names.has(norm(x.c.en))) continue;
    names.add(norm(x.c.en));
    out.push(x.c);
    if (out.length >= n) break;
  }
  out.forEach((c) => seen.add(c.id));
  writeJSON(SEEN, [...seen].slice(-500));
  return out;
}

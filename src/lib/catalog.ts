import { useSyncExternalStore } from "react";
import type { CatCard, Category, EnergyType, SerieInfo, SetInfo } from "../types";
import { createSignal, norm } from "./util";

/* ===== Catálogo completo (public/data/cartas.json) =====
   Gerado todo dia pela publicação automática (scripts/gerar-catalogo.mjs, a partir da TCGdex) e baixado uma vez
   (~3 MB, ~0,6 MB compactado). Com ele, filtros, busca enquanto digita, versões e relacionadas funcionam sem
   consultar a API; só a janela de detalhes busca os textos completos da carta na hora. */

interface Raw {
  gerado: string;
  cotacao: { usd: number; eur: number; fonte: string; data: string };
  series: SerieInfo[];
  sets: SetInfo[];
  dic: { stage: string[]; rarity: string[]; sub: string[]; suffix: string[]; illus: string[] };
  c: [string, string, string, number, string, number, string, number, number, number, number, number, string, number, string, number, number, number, number, number][];
}
export interface Catalog {
  cards: CatCard[];
  byId: Map<string, CatCard>;
  /** todas as versões (impressões) de cada nome em inglês, da mais nova para a mais antiga */
  byName: Map<string, CatCard[]>;
  /** quem evolui de cada nome (nome em inglês → cartas) */
  evolvesTo: Map<string, CatCard[]>;
  byDex: Map<number, CatCard[]>;
  sets: SetInfo[];
  series: SerieInfo[];
  rate: Raw["cotacao"];
  generated: string;
  /** texto de busca de cada carta (nomes sem acento, número, sigla da coleção) */
  hay: Map<string, string>;
}

let cat: Catalog | null = null;
let failed = false;
let loading: Promise<Catalog | null> | null = null;
export const catalogSignal = createSignal();
const key = (s: string) => norm(s);

function build(r: Raw): Catalog {
  const cards: CatCard[] = new Array(r.c.length);
  const byId = new Map<string, CatCard>(), byName = new Map<string, CatCard[]>(), evolvesTo = new Map<string, CatCard[]>(), byDex = new Map<number, CatCard[]>();
  const hay = new Map<string, string>();
  r.c.forEach((x, i) => {
    const set = r.sets[x[3]];
    const c: CatCard = {
      id: x[0], en: x[1], pt: x[2] || x[1], set, num: x[4], cat: x[5] as Category, types: x[6].split("") as EnergyType[],
      stage: r.dic.stage[x[7]] || "", hp: x[8], rarity: r.dic.rarity[x[9]] || "", sub: r.dic.sub[x[10]] || "", suffix: r.dic.suffix[x[11]] || "",
      reg: x[12], std: !!(x[13] & 1), exp: !!(x[13] & 2), evolveFrom: x[14], dex: x[15], imgEn: !!(x[16] & 1), imgPt: !!(x[16] & 2),
      lo: x[17], hi: x[18], illus: r.dic.illus[x[19]] || "",
    };
    cards[i] = c;
    byId.set(c.id, c);
    const k = key(c.en);
    (byName.get(k) || byName.set(k, []).get(k)!).push(c);
    if (c.evolveFrom) { const e = key(c.evolveFrom); (evolvesTo.get(e) || evolvesTo.set(e, []).get(e)!).push(c); }
    if (c.dex) (byDex.get(c.dex) || byDex.set(c.dex, []).get(c.dex)!).push(c);
    hay.set(c.id, norm(`${c.pt} ${c.en} ${c.num} ${set.ab} ${set.pt} ${set.en}`));
  });
  // versões e relacionadas: as mais novas primeiro
  const newer = (a: CatCard, b: CatCard) => b.set.d.localeCompare(a.set.d) || a.num.localeCompare(b.num, undefined, { numeric: true });
  for (const m of [byName, evolvesTo, byDex]) (m as Map<unknown, CatCard[]>).forEach((v) => v.sort(newer));
  return { cards, byId, byName, evolvesTo, byDex, sets: r.sets, series: r.series, rate: r.cotacao, generated: r.gerado, hay };
}

export function loadCatalog(): Promise<Catalog | null> {
  if (cat) return Promise.resolve(cat);
  if (!loading) {
    loading = fetch(import.meta.env.BASE_URL + "data/cartas.json")
      .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then((r: Raw) => { cat = build(r); failed = false; catalogSignal.bump(); return cat; })
      .catch(() => { failed = true; loading = null; catalogSignal.bump(); return null; });
  }
  return loading;
}
export const getCatalog = () => cat;

/** Catálogo para os componentes: começa a baixar na primeira vez e redesenha quando chega */
export function useCatalog(): { cat: Catalog | null; failed: boolean } {
  useSyncExternalStore(catalogSignal.subscribe, catalogSignal.get);
  if (!cat && !failed && !loading) void loadCatalog();
  return { cat, failed };
}

/** Busca por nome (português ou inglês), número na coleção ("25", "025", "MEW 25") ou sigla. Cada palavra precisa aparecer. */
export function searchCards(c: Catalog, q: string, pool: CatCard[] = c.cards): CatCard[] {
  const words = norm(q).split(/\s+/).filter(Boolean);
  if (!words.length) return pool;
  return pool.filter((x) => {
    const h = c.hay.get(x.id) || "";
    return words.every((w) => (/^\d+$/.test(w) ? x.num.replace(/^0+/, "") === w.replace(/^0+/, "") || h.includes(w) : h.includes(w)));
  });
}

/** Ordena resultados de busca: nome exato primeiro, depois começando pela busca; dentro disso, as que têm imagem e preço
    e as mais novas antes (coleções comemorativas com dezenas de "Pikachu" sem imagem ficavam na frente) */
export function rankByName(list: CatCard[], q: string): CatCard[] {
  const n = norm(q.trim());
  const score = (c: CatCard) => {
    const a = norm(c.pt), b = norm(c.en);
    const name = a === n || b === n ? 0 : a.startsWith(n) || b.startsWith(n) ? 1 : 2;
    return name * 4 + (c.imgPt || c.imgEn ? 0 : 2) + (c.lo > 0 ? 0 : 1);
  };
  return [...list].sort((a, b) => score(a) - score(b) || b.set.d.localeCompare(a.set.d));
}

import type { CatCard, Hit } from "../types";
import type { Catalog } from "./catalog";

/* ===== Decks prontos =====
   Arquivos do site (gerados por scripts e gravados no repositório):
   - data/decks-personagens.json: decks dos personagens do anime (scripts/personagens.mjs → gerar-personagens.mjs)
   - data/decks-oficiais.json: decks oficiais da The Pokémon Company, com a foto da caixa (gerar-oficiais.mjs)
   - data/decks-meta.json: meta atual (Limitless) e decks campeões do Mundial (gerar-meta.mjs)
   E os temas de coleção (todas as cartas de uma coleção ou série), montados aqui com o catálogo. */
export type PresetGroup = "personagens" | "oficiais" | "meta" | "campeoes" | "colecoes";
export interface Preset {
  nome: string;
  grupo: PresetGroup;
  /** subtítulo curto: era, coleção, ano */
  era?: string;
  desc: string;
  /** [código da carta, cópias] */
  cartas?: [string, number][];
  /** temas de coleção: todas as cartas de uma coleção ou de uma série, buscadas no catálogo */
  filtro?: { set?: string; serie?: string };
  /** as 3 cartas do leque */
  capa?: string[];
  /** chave do retrato do personagem (img/personagens/{chave}.png) */
  retrato?: string;
  /** foto da caixa do deck oficial (img/caixas/…) */
  caixa?: string;
  /** data de lançamento ou do torneio (AAAA-MM-DD) */
  data?: string;
}
export const GROUP_TITLES: Record<PresetGroup, string> = {
  personagens: "Decks dos personagens do anime",
  oficiais: "Decks oficiais da The Pokémon Company",
  meta: "Meta atual – os decks que mais aparecem nos torneios",
  campeoes: "Metas antigos – decks campeões do Mundial",
  colecoes: "Coleções completas",
};

const FILES = ["decks-personagens", "decks-oficiais", "decks-meta"];
let cache: Promise<Preset[]> | null = null;
export function loadPresets(): Promise<Preset[]> {
  // cada arquivo falha sozinho (ainda não gerado, sem internet): os outros grupos aparecem assim mesmo
  return cache || (cache = Promise.all(FILES.map((f) => fetch(`${import.meta.env.BASE_URL}data/${f}.json`)
    .then((r) => (r.ok ? r.json() : []))
    .then((d: unknown) => (Array.isArray(d) ? (d as Preset[]) : []))
    .catch(() => [] as Preset[])))
    .then((all) => all.flat()));
}

/** Temas de coleção: as coleções mais lembradas e as séries mais recentes */
const SETS = ["base1", "base2", "base3", "base4", "sv03.5", "cel25", "swsh12.5", "sv08.5"];
const SERIES = ["sv", "me"];
export function collectionPresets(cat: Catalog): Preset[] {
  const out: Preset[] = [];
  const newest = cat.sets.filter((s) => s.s === "me" && s.n > 50 && !SETS.includes(s.id)).slice(-1);
  for (const s of [...SETS.map((id) => cat.sets.find((x) => x.id === id)), ...newest]) {
    if (!s) continue;
    const n = cat.cards.filter((c) => c.set.id === s.id).length;
    out.push({ nome: `Todas as cartas de ${s.pt || s.en}`, grupo: "colecoes", era: `${s.ab || s.id} · ${s.d.slice(0, 4)}`, filtro: { set: s.id },
      desc: `As ${n} cartas da coleção ${s.pt || s.en}${s.pt && s.en && s.pt !== s.en ? ` (${s.en})` : ""}, lançada em ${s.d.slice(0, 4)}, uma de cada.` });
  }
  for (const id of SERIES) {
    const serie = cat.series.find((x) => x.id === id);
    if (!serie) continue;
    const n = cat.cards.filter((c) => c.set.s === id).length;
    out.push({ nome: `Todas as cartas de ${serie.pt || serie.en}`, grupo: "colecoes", era: "Série inteira", filtro: { serie: id },
      desc: `As ${n.toLocaleString("pt-BR")} cartas da série ${serie.pt || serie.en}, em todas as coleções, uma de cada.` });
  }
  return out;
}

/** Cartas de um tema, na ordem do tema (coleções: na ordem da coleção), com as cópias */
export function presetCards(p: Preset, cat: Catalog): Hit[] {
  if (p.filtro) {
    const list = cat.cards.filter((c) => (p.filtro!.set ? c.set.id === p.filtro!.set : c.set.s === p.filtro!.serie));
    return list.map((card) => ({ card, qty: 1 }));
  }
  return (p.cartas || []).map(([id, qty]) => ({ card: cat.byId.get(id), qty })).filter((h): h is { card: CatCard; qty: number } => !!h.card);
}

/** Capa (3 cartas do leque): as marcadas no tema; senão as 3 primeiras */
export function presetCover(p: Preset, cat: Catalog): CatCard[] {
  const ids = p.capa?.length ? p.capa : p.cartas?.slice(0, 3).map((x) => x[0]) || [];
  const fromIds = ids.map((id) => cat.byId.get(id)).filter((c): c is CatCard => !!c);
  if (fromIds.length || !p.filtro) return fromIds.slice(0, 3);
  // coleções: as 3 cartas mais valiosas com imagem
  return presetCards(p, cat).map((h) => h.card).filter((c) => c.imgPt || c.imgEn).sort((a, b) => b.lo - a.lo).slice(0, 3);
}

/** Total de cartas (somando as cópias) e custo médio para montar (cópias × menor valor de cada carta) */
export function presetTotals(p: Preset, cat: Catalog): { n: number; cost: number } {
  return presetCards(p, cat).reduce((t, h) => ({ n: t.n + (h.qty || 1), cost: t.cost + (h.qty || 1) * (h.card.lo || 0) }), { n: 0, cost: 0 });
}

/** Retrato do personagem (PNG transparente do próprio site) */
export const portraitSrc = (key?: string) => (key ? `${import.meta.env.BASE_URL}img/personagens/${key}.png` : "");
/** Caixa do deck oficial: arquivo do site ou endereço completo */
export const boxSrc = (u: string) => (/^https?:/.test(u) ? u : import.meta.env.BASE_URL + u);

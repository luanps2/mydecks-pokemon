import type { CatCard } from "../types";
import type { Catalog } from "./catalog";
import { norm } from "./util";

/* Cartas relacionadas, calculadas com o catálogo (sem consultar a API):
   - Linha evolutiva: de quem esta carta evolui e quem evolui dela (e os estágios seguintes)
   - O mesmo Pokémon: outras cartas com o mesmo número da Pokédex (ex.: Pikachu ex, Pikachu V)
   - Parecidas: mesmo tipo e estágio (Pokémon) ou mesmo subtipo (Treinador/Energia), das coleções mais novas
   De cada nome entra só uma versão (a mais nova, de preferência com imagem em português). */
export interface RelGroup { title: string; list: CatCard[] }

/** a versão que representa um nome: a mais nova com imagem em português; senão, a mais nova */
export function bestVersion(c: Catalog, nameEn: string): CatCard | undefined {
  const all = c.byName.get(norm(nameEn));
  return all?.find((x) => x.imgPt) || all?.[0];
}

export function relatedOf(c: Catalog, card: CatCard): RelGroup[] {
  const seen = new Set([norm(card.en)]);
  const pick = (list: (CatCard | undefined)[], max = 24) => {
    const out: CatCard[] = [];
    for (const x of list) {
      if (!x || seen.has(norm(x.en))) continue;
      seen.add(norm(x.en));
      out.push(bestVersion(c, x.en) || x);
      if (out.length >= max) break;
    }
    return out;
  };
  const groups: RelGroup[] = [];
  if (card.cat === 0) {
    // linha evolutiva completa: sobe pelos "evolui de" e desce pelos "evolui para"
    const before: (CatCard | undefined)[] = [];
    let from = card.evolveFrom, guard = 0;
    while (from && guard++ < 3) { const b = bestVersion(c, from); before.unshift(b); from = b?.evolveFrom || ""; }
    const after: CatCard[] = [];
    let level = [card.en];
    for (let i = 0; i < 2 && level.length; i++) {
      const next: string[] = [];
      for (const n of level) for (const x of c.evolvesTo.get(norm(n)) || []) { after.push(x); next.push(x.en); }
      level = [...new Set(next)];
    }
    const line = pick([...before, ...after], 16);
    if (line.length) groups.push({ title: "Linha evolutiva", list: line });
    const same = pick(card.dex ? c.byDex.get(card.dex) || [] : []);
    if (same.length) groups.push({ title: "O mesmo Pokémon em outras cartas", list: same });
    const t = card.types[0];
    const similar = pick(c.cards.filter((x) => x.cat === 0 && x.types[0] === t && x.stage === card.stage && x.std).reverse(), 18);
    if (similar.length) groups.push({ title: "Parecidas (mesmo tipo e estágio)", list: similar });
  } else {
    const similar = pick(c.cards.filter((x) => x.cat === card.cat && x.sub === card.sub && (x.std || x.exp)).reverse(), 24);
    if (similar.length) groups.push({ title: card.cat === 1 ? "Outros Treinadores do mesmo tipo" : "Outras Energias", list: similar });
  }
  return groups;
}

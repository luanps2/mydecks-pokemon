import type { CatCard, UserCard } from "../types";
import { isBasicEnergy } from "./labels";
import { norm } from "./util";

/* ===== Regras de montagem de deck (aviso, sem bloquear) =====
   - 60 cartas no deck
   - no máximo 4 cópias com o mesmo nome (Energia Básica pode quantas quiser); versões diferentes da mesma carta somam
   - formato Padrão / Expandido: cada carta precisa ser legal no formato (campo "legal" da TCGdex) */
export interface DeckCheck {
  total: number;
  /** nomes com mais de 4 cópias */
  over: { name: string; n: number }[];
  /** cartas (diferentes) fora do Padrão e do Expandido; unknown = cartas que o catálogo não tem */
  notStd: number;
  notExp: number;
  unknown: number;
}
export function checkDeck(cards: UserCard[], byId: Map<string, CatCard> | undefined): DeckCheck {
  const byName = new Map<string, { name: string; n: number }>();
  let total = 0, notStd = 0, notExp = 0, unknown = 0;
  for (const u of cards) {
    const q = u.quantity || 1;
    total += q;
    const c = u.cardId ? byId?.get(u.cardId) : undefined;
    if (!c) { unknown++; continue; }
    if (!c.std) notStd++;
    if (!c.exp) notExp++;
    if (isBasicEnergy(c)) continue;
    const k = norm(c.en);
    const e = byName.get(k) || { name: u.namePt, n: 0 };
    e.n += q;
    byName.set(k, e);
  }
  return { total, over: [...byName.values()].filter((x) => x.n > 4), notStd, notExp, unknown };
}

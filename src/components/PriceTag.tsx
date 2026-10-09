import type { CatCard } from "../types";
import { brlShort } from "../lib/util";

/* Etiqueta de preço nas miniaturas: menor valor (versão mais barata da carta) e maior (versão mais cara) */
export function PriceTag({ card }: { card: CatCard | undefined }) {
  if (!card || !(card.lo > 0)) return null;
  const hasMax = card.hi > card.lo * 1.15;
  return (
    <span className="ptag" title={`Menor valor de mercado: ${brlShort(card.lo)}${hasMax ? ` · maior (versão mais cara): ${brlShort(card.hi)}` : ""}`}>
      <b>{brlShort(card.lo)}</b>{hasMax && <> <i>–</i> {brlShort(card.hi)}</>}
    </span>
  );
}

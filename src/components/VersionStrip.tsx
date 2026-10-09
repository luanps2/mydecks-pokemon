import type { CatCard } from "../types";
import { useCatalog } from "../lib/catalog";
import { cardSources } from "../lib/images";
import { rarityPt } from "../lib/labels";
import { brlShort, norm } from "../lib/util";
import { CardImage } from "./CardImage";

/* Faixa com todas as versões (artes) de uma carta: a mesma carta em outras coleções e raridades
   (normal, holo, full art, ilustração especial…). Clique na versão: onPick. Botão + no canto: onAdd
   (põe a versão no deck como outra carta; cada versão conta separado). */
export function VersionStrip({ card, onPick, onAdd, inDeck, hint }: {
  card: CatCard;
  onPick: (c: CatCard) => void;
  onAdd?: (c: CatCard) => void;
  /** versões (códigos) que já estão no deck */
  inDeck?: Set<string>;
  hint?: string;
}) {
  const { cat } = useCatalog();
  const all = cat?.byName.get(norm(card.en)) || [];
  if (all.length < 2) return null;
  return (
    <div className="vers-pick">
      <p className="note">Versões desta carta ({all.length}){hint ? " · " + hint : ""}</p>
      <div className="vers">
        {all.map((v) => {
          const has = !!inDeck?.has(v.id);
          return (
            <span key={v.id} className="ver-w">
              <button type="button" aria-pressed={v.id === card.id} onClick={() => onPick(v)}
                title={`${v.set.pt || v.set.en} · ${v.num}${v.rarity ? " · " + rarityPt(v.rarity) : ""}${v.lo ? " · " + brlShort(v.lo) : ""}`}>
                <span className="img"><CardImage sources={cardSources(v, "low")} alt={`${v.pt} – ${v.set.pt || v.set.en}`} /></span>
                <span className="ver-n">{v.set.ab || v.set.id} {v.num}</span>
              </button>
              {onAdd && (
                <button type="button" className={"ver-add" + (has ? " on" : "")} disabled={has}
                  aria-label={has ? "Esta versão já está no deck" : "Pôr esta versão no deck como outra carta"}
                  title={has ? "Esta versão já está no deck" : "Pôr esta versão no deck como outra carta"} onClick={() => onAdd(v)}>{has ? "✓" : "+"}</button>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}

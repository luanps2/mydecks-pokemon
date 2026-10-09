import { memo } from "react";
import type { CatCard, UserCard } from "../types";
import { userCardSources } from "../lib/images";
import { norm } from "../lib/util";
import { CardImage } from "./CardImage";
import { PriceTag } from "./PriceTag";
import { QtyStepper } from "./QtyStepper";

export const ICON_TRASH = <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" /></svg>;

/* Uma carta da grade: imagem, número, cópias, nome em português e em inglês, coleção, valor e lixeira no canto.
   srcKey (as fontes da imagem juntas) entra só para redesenhar quando a imagem muda (catálogo carregou, idioma, imagem própria). */
export const CardTile = memo(function CardTile({ card, info, n, onOpen, onRemove, onQty }: {
  card: UserCard;
  info: CatCard | undefined;
  n: number;
  srcKey: string;
  onOpen: (id: string) => void;
  onRemove: (id: string) => void;
  onQty: (id: string, n: number) => void;
}) {
  const showEn = norm(card.nameEn) !== norm(card.namePt);
  const src = userCardSources(card, "low");
  return (
    <div className="cardw">
      <button type="button" className="card" onClick={() => onOpen(card.id)} data-hover={src[0] || undefined}>
        <span className="img">
          {src.length ? <CardImage sources={src} alt={card.namePt} /> : <span className="ph">{info === undefined && card.cardId ? "Carregando…" : "Sem imagem"}</span>}
          <span className="num">{n}</span>
          {card.quantity > 1 && <span className="qty-badge" title={`${card.quantity} cópias no deck`}>×{card.quantity}</span>}
        </span>
        <span className="pt">{card.namePt}</span>
        {showEn && <span className="en">{card.nameEn}</span>}
        {info && <span className="setl">{info.set.pt || info.set.en} · {info.num}</span>}
        <PriceTag card={info} />
      </button>
      <span className="tile-qty"><QtyStepper compact value={card.quantity || 1} label={card.namePt} onChange={(q) => onQty(card.id, q)} /></span>
      <button type="button" className="cdel" aria-label={`Remover ${card.namePt} do deck`} title="Remover do deck" onClick={() => onRemove(card.id)}>{ICON_TRASH}</button>
    </div>
  );
});

import { useMemo, useState } from "react";
import type { CatCard, Hit } from "../types";
import { useCatalog } from "../lib/catalog";
import { cardSources } from "../lib/images";
import { relatedOf } from "../lib/related";
import { norm } from "../lib/util";
import { useCollection } from "../state/collection";
import { useToast } from "../state/toast";
import { CardImage } from "./CardImage";
import { PriceTag } from "./PriceTag";

/* "Botão + adiciona em": lembra o último deck escolhido enquanto o app está aberto */
let lastDest = "";

/* Cartas relacionadas: linha evolutiva, o mesmo Pokémon em outras cartas e parecidas.
   Clique na carta: abre os detalhes por cima; botão + no canto: adiciona direto no deck escolhido. */
export function RelatedCards({ card, defaultDest, onOpen }: {
  card: CatCard;
  defaultDest: string;
  onOpen: (list: Hit[], index: number) => void;
}) {
  const { cat } = useCatalog();
  const { col, addCards, canEdit, askLogin } = useCollection();
  const toast = useToast();
  const [dest, setDest] = useState(lastDest);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const groups = useMemo(() => (cat ? relatedOf(cat, card) : []), [cat, card]);
  const have = useMemo(() => new Set(col.cards.map((c) => norm(c.nameEn))), [col.cards]);
  const listId = col.lists.some((l) => l.id === dest) ? dest : col.lists.some((l) => l.id === defaultDest) ? defaultDest : col.lists[0]?.id || "";
  const flat: Hit[] = groups.flatMap((g) => g.list.map((c) => ({ card: c })));

  async function quickAdd(c: CatCard) {
    if (!canEdit) { askLogin(); return; }
    const L = col.lists.find((l) => l.id === listId);
    if (!L) return;
    if (col.cards.some((x) => x.listId === listId && x.cardId === c.id)) { toast(`"${c.pt}" já está em ${L.name}.`); return; }
    if (await addCards([{ card: c }], listId)) { setAdded((s) => new Set(s).add(c.id)); toast(`"${c.pt}" adicionada em ${L.name}.`); }
  }

  if (!groups.length) return null;
  let k = 0;
  return (
    <div className="box">
      <div className="rel-head">
        <h5>Cartas relacionadas</h5>
        {col.lists.length > 0 && (
          <label>Botão + adiciona em
            <select className="reldest" value={listId} aria-label="Deck onde o botão + adiciona"
              onChange={(e) => { setDest(e.target.value); lastDest = e.target.value; }}>
              {col.lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </label>
        )}
      </div>
      {groups.map((g) => (
        <div key={g.title}>
          <p className="reltitle">{g.title} <small>{g.list.length}</small></p>
          <div className="rel">
            {g.list.map((c) => {
              const i = k++, done = added.has(c.id);
              return (
                <div className="relw" key={c.id}>
                  <button type="button" className="relc" title={c.pt !== c.en ? `${c.pt} (${c.en})` : c.en} onClick={() => onOpen(flat, i)}>
                    <span className="img">
                      <CardImage sources={cardSources(c, "low")} alt={c.pt} />
                      {have.has(norm(c.en)) && <span className="have">Já nos decks</span>}
                    </span>
                    <span className="pt">{c.pt}</span>
                    {c.pt !== c.en && <span className="en">{c.en}</span>}
                    <PriceTag card={c} />
                  </button>
                  {(col.lists.length > 0 || !canEdit) && (
                    <button type="button" className="reladd" disabled={done} aria-label={`Adicionar ${c.pt} ao deck`} title={done ? "Adicionada" : "Adicionar ao deck"} onClick={() => void quickAdd(c)}>
                      {done ? "✓" : "+"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

import { useState } from "react";
import type { CatCard, Hit } from "../types";
import { cardSources } from "../lib/images";
import { useCardDetails } from "../lib/tcgdex";
import { norm } from "../lib/util";
import { useCollection } from "../state/collection";
import { useToast } from "../state/toast";
import { CardImage } from "./CardImage";
import { CardInfo } from "./CardInfo";
import { Modal } from "./Modal";
import { PriceLine } from "./PriceLine";
import { QtyStepper } from "./QtyStepper";
import { RelatedCards } from "./RelatedCards";
import { VersionStrip } from "./VersionStrip";
import { Zoom } from "./Zoom";

/* Deck escolhido para "Adicionar no deck" (lembrado entre as cartas) */
let lastDest = "";

export interface DetailView {
  items: Hit[];
  index: number;
  /** cat: veio do catálogo (botão Selecionar); rel: busca, relacionadas, sugestões e decks prontos (botão Adicionar) */
  mode: "cat" | "rel";
}

/* Janela de detalhes de uma carta do catálogo, por cima das outras janelas.
   As setas andam pela lista de onde a carta veio; clicar numa relacionada abre ela aqui, com "Voltar". */
export function DetailModal({ view, onClose, onIndex, canLoadMore, loadMore, selected, onToggleSel, defaultDest }: {
  view: DetailView | null;
  onClose: () => void;
  onIndex: (i: number) => void;
  /** catálogo: ainda há cartas para mostrar depois da última */
  canLoadMore?: boolean;
  loadMore?: () => void;
  selected?: Set<string>;
  onToggleSel?: (c: CatCard) => void;
  defaultDest: string;
}) {
  const { col, addCards, removeCard, createList, setQuantity, canEdit, askLogin } = useCollection();
  const toast = useToast();
  const [stack, setStack] = useState<{ items: Hit[]; index: number }[]>([]);   // relacionadas abertas (para "Voltar")
  const [shown, setShown] = useState({ k: "", v: "" });
  const [zoom, setZoom] = useState("");
  const [ver, setVer] = useState<{ k: string; card: CatCard } | null>(null);   // versão escolhida na faixa (por carta)
  const [dest, setDest] = useState(lastDest);

  // nova lista de origem (outra busca, outra carta do catálogo): esquece as relacionadas abertas
  const viewKey = view ? view.items : null;
  const [stackFor, setStackFor] = useState(viewKey);
  if (stackFor !== viewKey) { setStackFor(viewKey); setStack([]); }

  const top = stack[stack.length - 1];
  const items = top ? top.items : view?.items || [];
  const index = top ? top.index : view?.index ?? -1;
  const hit = items[index];
  const base = hit?.card;
  const card = ver && base && ver.k === base.id ? ver.card : base;
  const det = useCardDetails(card?.id);

  const step = (dir: -1 | 1) => {
    if (!view) return;
    if (top) {
      const i = top.index + dir;
      if (i >= 0 && i < top.items.length) setStack((s) => [...s.slice(0, -1), { ...top, index: i }]);
      return;
    }
    const i = view.index + dir;
    if (i >= view.items.length && canLoadMore && loadMore) loadMore();   // chegou ao fim do que está na tela: mostra mais
    onIndex(Math.max(0, i));
  };

  if (!view || !card || !base) return <Modal open={false} onClose={onClose} label="Detalhes da carta">{null}</Modal>;

  const have = col.cards.some((c) => norm(c.nameEn) === norm(card.en));
  const prev = index > 0, next = index < items.length - 1 || (!top && !!canLoadMore);
  const listId = col.lists.some((l) => l.id === dest) ? dest : col.lists.some((l) => l.id === defaultDest) ? defaultDest : col.lists[0]?.id || "";
  const inList = col.cards.find((c) => c.listId === listId && c.cardId === card.id);
  const sources = cardSources(card, "high");
  const shownSrc = shown.k === card.id ? shown.v : "";
  const asCat = view.mode === "cat" && !top;
  const isSel = !!selected?.has(card.id);
  const deckName = col.lists.find((l) => l.id === listId)?.name;

  return (
    <>
      <Modal open onClose={() => { setStack([]); onClose(); }} label={card.pt} className="det" onArrow={(dir) => step(dir)}>
        <button type="button" className="navarrow prev" aria-label="Carta anterior" title="Carta anterior (←)" disabled={!prev} onClick={() => step(-1)}>‹</button>
        <button type="button" className="navarrow next" aria-label="Próxima carta" title="Próxima carta (→)" disabled={!next} onClick={() => step(1)}>›</button>
        <div className="cardview">
          <div className="big">
            <span className="img" title="Clique para ampliar">
              <CardImage key={card.id} sources={sources} alt={card.pt} lazy={false}
                onShown={(v) => setShown({ k: card.id, v })} onClick={() => shownSrc && setZoom(shownSrc)} />
            </span>
            <VersionStrip card={card} hint="clique para ver e escolher a versão que vai para o deck; cada versão conta como outra carta"
              inDeck={new Set(col.cards.filter((c) => c.listId === listId).map((c) => c.cardId || ""))}
              onPick={(v) => setVer({ k: base.id, card: v })} />
          </div>
          <div>
            <h4>{card.pt}</h4>
            <p className="meta">{card.pt !== card.en ? card.en : "Nome original em inglês"}{have && <> · <b>Já está nos seus decks</b></>}</p>
            <PriceLine card={card} live={det.en || det.pt} />
            <CardInfo card={card} pt={det.pt} en={det.en} loading={det.loading} />
            <div className="det-nav">
              {stack.length > 0 && <button type="button" onClick={() => setStack((s) => s.slice(0, -1))}>↩ Voltar</button>}
              <span className="det-act">
                {asCat ? (
                  <button type="button" className={isSel ? "" : "success"} onClick={() => onToggleSel?.(card)}>{isSel ? "Tirar da seleção" : "Selecionar esta carta"}</button>
                ) : !canEdit ? (
                  // sem conta só dá para ver: montar decks precisa de conta
                  <button type="button" className="success" onClick={askLogin}>Criar conta para adicionar no deck</button>
                ) : !col.lists.length ? (
                  <button type="button" className="success" onClick={async () => {
                    const to = createList("Meu deck");
                    if (await addCards([{ card }], to)) toast(`"${card.pt}" adicionada no novo deck "Meu deck".`);
                  }}>Adicionar em um novo deck</button>
                ) : (
                  <>
                    <select aria-label="Deck" value={listId} onChange={(e) => { setDest(e.target.value); lastDest = e.target.value; }}>
                      {col.lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                    {inList
                      ? <>
                          <QtyStepper value={inList.quantity || 1} label={inList.namePt} onChange={(n) => setQuantity(inList.id, n)} />
                          <button type="button" className="danger-fill" onClick={() => removeCard(inList.id)}>Remover do deck</button>
                        </>
                      : <button type="button" className="success" onClick={async () => {
                          const n = await addCards([{ card, qty: hit.qty }], listId);
                          toast(n ? `"${card.pt}" adicionada em ${deckName}.` : "A carta já está nesse deck.");
                        }}>Adicionar no deck</button>}
                  </>
                )}
              </span>
            </div>
          </div>
        </div>
        <RelatedCards card={card} defaultDest={listId} onOpen={(list, i) => setStack((s) => [...s, { items: list, index: i }])} />
      </Modal>
      <Zoom src={zoom} alt={card.pt} onClose={() => setZoom("")} />
    </>
  );
}

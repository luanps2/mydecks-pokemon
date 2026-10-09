import { useMemo, useState } from "react";
import type { CatCard, Hit } from "../types";
import { rankByName, searchCards, useCatalog } from "../lib/catalog";
import { useDebounced } from "../lib/hooks";
import { cardSources } from "../lib/images";
import { useCollection } from "../state/collection";
import { useToast } from "../state/toast";
import { CardImage } from "./CardImage";
import { PriceTag } from "./PriceTag";

const MAX = 48;

/* Busca no catálogo inteiro (português e inglês) a partir da barra de pesquisa, enquanto a pessoa digita.
   Cada resultado mostra se já está no deck escolhido; se não estiver, dá para adicionar com um clique. */
export function SearchPanel({ query, defaultList, onOpen, onCatalog }: {
  query: string;
  defaultList: string;
  onOpen: (hits: Hit[], index: number) => void;
  /** abre o catálogo completo (para ver mais resultados) */
  onCatalog: (q: string) => void;
}) {
  const { cat, failed } = useCatalog();
  const { col, addCards, createList, canEdit, askLogin } = useCollection();
  const toast = useToast();
  const q = useDebounced(query.trim(), 200);
  const [dest, setDest] = useState("");
  const found = useMemo(() => (cat && q.length >= 2 ? rankByName(searchCards(cat, q), q) : []), [cat, q]);
  const hits = useMemo(() => found.slice(0, MAX).map((card) => ({ card })), [found]);
  // deck de destino: o escolhido aqui; senão o que está na tela; senão o primeiro
  const listId = col.lists.some((l) => l.id === dest) ? dest : col.lists.some((l) => l.id === defaultList) ? defaultList : col.lists[0]?.id || "";
  const listName = col.lists.find((l) => l.id === listId)?.name || "";
  const inDeck = useMemo(() => new Set(col.cards.filter((c) => c.listId === listId).map((c) => c.cardId)), [col.cards, listId]);

  if (q.length < 2) return null;

  async function add(c: CatCard) {
    if (!canEdit) { askLogin(); return; }
    const to = listId || createList("Meu deck");   // ainda não há nenhum deck
    const n = await addCards([{ card: c }], to);
    const name = col.lists.find((l) => l.id === to)?.name || "Meu deck";
    toast(n ? `"${c.pt}" adicionada em ${name}.` : `"${c.pt}" já está em ${name}.`);
  }

  return (
    <section className="search-panel" aria-live="polite">
      <div className="sp-head">
        <h2>No catálogo <small>{!cat ? (failed ? "" : "carregando…") : `${found.length.toLocaleString("pt-BR")} ${found.length === 1 ? "carta" : "cartas"} para “${q}”`}</small></h2>
        {col.lists.length > 0 && canEdit && (
          <label className="sp-dest">Adicionar em
            <select value={listId} onChange={(e) => setDest(e.target.value)}>
              {col.lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </label>
        )}
      </div>
      {failed && <p className="note">Não foi possível carregar o catálogo. Verifique a internet e tente de novo.</p>}
      {cat && !found.length && <p className="note">Nenhuma carta com esse nome. Tente o nome em inglês ou em português, ou só uma parte dele.</p>}
      <div className="sp-grid">
        {hits.map(({ card: c }, i) => {
          const here = inDeck.has(c.id);
          return (
            <div className="sp-item" key={c.id}>
              <button type="button" className="sp-card" onClick={() => onOpen(hits, i)} title="Ver detalhes">
                <span className="img"><CardImage sources={cardSources(c, "low")} alt={c.pt} /></span>
                <span className="pt">{c.pt}</span>
                {c.pt !== c.en && <span className="en">{c.en}</span>}
                <span className="setl">{c.set.pt || c.set.en} · {c.num}</span>
                <PriceTag card={c} />
              </button>
              {/* o botão fica sempre no pé do cartão, alinhado com os vizinhos, mesmo com nomes de tamanhos diferentes */}
              {here
                ? <span className="sp-in sp-foot" title={`Já está em ${listName}`}>✓ Já está em {listName}</span>
                : <button type="button" className="btn add sp-foot" onClick={() => void add(c)}>+ Adicionar</button>}
            </div>
          );
        })}
      </div>
      {found.length > MAX && (
        <p className="sp-more"><button type="button" className="btn" onClick={() => onCatalog(q)}>Ver as {found.length.toLocaleString("pt-BR")} cartas no catálogo, com filtros</button></p>
      )}
    </section>
  );
}

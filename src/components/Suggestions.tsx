import { useEffect, useMemo, useRef, useState } from "react";
import type { CatCard, Hit } from "../types";
import { useCatalog } from "../lib/catalog";
import { cardSources } from "../lib/images";
import { loadPopular, pickSuggestions, popularPool } from "../lib/suggest";
import { norm } from "../lib/util";
import { useCollection } from "../state/collection";
import { useToast } from "../state/toast";
import { CardImage } from "./CardImage";
import { PriceTag } from "./PriceTag";

const N = 45;

/* ===== Sugestões: 45 cartas populares que a pessoa ainda não tem, novas a cada visita =====
   Clique na carta abre os detalhes; o botão + adiciona direto no deck escolhido. */
export function Suggestions({ defaultList, onOpen }: { defaultList: string; onOpen: (hits: Hit[], index: number) => void }) {
  const { cat } = useCatalog();
  const { col, ready, addCards, createList, canEdit, askLogin } = useCollection();
  const toast = useToast();
  const [ids, setIds] = useState<string[] | null>(null);
  const [hits, setHits] = useState<CatCard[]>([]);
  const [dest, setDest] = useState("");
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [round, setRound] = useState(0);
  const strip = useRef<HTMLDivElement>(null);

  useEffect(() => { void loadPopular().then(setIds); }, []);
  const have = useMemo(() => new Set(col.cards.map((c) => norm(c.nameEn))), [col.cards]);
  // sorteia quando os decks e as populares estiverem prontos, e de novo a cada "Sugerir novas cartas"
  const haveRef = useRef(have);
  useEffect(() => { haveRef.current = have; });
  useEffect(() => {
    if (!ready || !ids || !cat) return;
    setHits(pickSuggestions(popularPool(cat, ids), haveRef.current, N));
    setAdded(new Set());
    strip.current?.scrollTo({ left: 0, behavior: "smooth" });
  }, [ready, ids, cat, round]);

  const listId = col.lists.some((l) => l.id === dest) ? dest : col.lists.some((l) => l.id === defaultList) ? defaultList : col.lists[0]?.id || "";
  const list: Hit[] = useMemo(() => hits.map((card) => ({ card })), [hits]);

  async function add(c: CatCard) {
    if (!canEdit) { askLogin(); return; }
    const to = listId || createList("Meu deck");
    const name = col.lists.find((l) => l.id === to)?.name || "Meu deck";
    if (await addCards([{ card: c }], to)) { setAdded((s) => new Set(s).add(c.id)); toast(`"${c.pt}" adicionada em ${name}.`); }
    else toast(`"${c.pt}" já está em ${name}.`);
  }
  const page = (d: number) => { const el = strip.current; if (el) el.scrollBy({ left: d * el.clientWidth * 0.85, behavior: "smooth" }); };

  return (
    <section className="sug" aria-labelledby="sug-t">
      <div className="sug-head">
        <div>
          <h2 id="sug-t">Sugestões para você <small>{hits.length || N} cartas</small></h2>
          <p className="sug-sub">Entre as mais usadas nos torneios e que você ainda não tem. A cada visita, cartas novas.</p>
        </div>
        <div className="sug-tools">
          {col.lists.length > 0 && canEdit && (
            <label className="sp-dest">Botão + adiciona em
              <select value={listId} onChange={(e) => setDest(e.target.value)}>
                {col.lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </label>
          )}
          <button type="button" className="btn draw" onClick={() => setRound((r) => r + 1)} title="Trocar por outras 45 cartas">
            <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="6" width="10" height="14" rx="2" /><path d="M8 3h10a2 2 0 0 1 2 2v12" /></svg>
            Sugerir novas cartas
          </button>
        </div>
      </div>
      <div className="sug-wrap">
        <button type="button" className="sug-arrow prev" aria-label="Ver as anteriores" onClick={() => page(-1)}>‹</button>
        <div className="sug-strip" ref={strip}>
          {!hits.length && Array.from({ length: 8 }, (_, i) => <div key={i} className="sugw"><span className="img skel" /></div>)}
          {hits.map((c, i) => {
            const done = added.has(c.id);
            return (
              <div className="sugw" key={`${round}-${c.id}`}>
                <button type="button" className="sugc" title={c.pt !== c.en ? `${c.pt} (${c.en})` : c.en} onClick={() => onOpen(list, i)}>
                  <span className="img"><CardImage sources={cardSources(c, "low")} alt={c.pt} /></span>
                  <span className="pt">{c.pt}</span>
                  {c.pt !== c.en && <span className="en">{c.en}</span>}
                  <PriceTag card={c} />
                </button>
                <button type="button" className="sugadd" disabled={done} aria-label={`Adicionar ${c.pt} ao deck`} title={done ? "Adicionada" : "Adicionar ao deck"} onClick={() => void add(c)}>
                  {done ? "✓" : "+"}
                </button>
              </div>
            );
          })}
        </div>
        <button type="button" className="sug-arrow next" aria-label="Ver as próximas" onClick={() => page(1)}>›</button>
      </div>
    </section>
  );
}

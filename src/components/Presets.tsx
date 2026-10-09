import { useEffect, useMemo, useRef, useState } from "react";
import type { Hit } from "../types";
import { useCatalog, type Catalog } from "../lib/catalog";
import { cardSources } from "../lib/images";
import { GROUP_TITLES, boxSrc, collectionPresets, loadPresets, presetCards, presetCover, presetTotals, type Preset, type PresetGroup } from "../lib/presets";
import { seriePt } from "../lib/labels";
import { brl, norm } from "../lib/util";
import { useCollection } from "../state/collection";
import { useToast } from "../state/toast";
import { CardImage } from "./CardImage";
import { Modal } from "./Modal";
import { PokeLoader } from "./PokeLoader";
import { Portrait } from "./Portrait";
import { PriceTag } from "./PriceTag";
import { QtyStepper } from "./QtyStepper";

/** série da maioria das cartas do deck (a primeira pode ser uma reimpressão de outra série) */
function mainSerie(p: Preset, cat: Catalog): string {
  const n = new Map<string, number>();
  for (const [id, q] of p.cartas || []) { const s = cat.byId.get(id)?.set.s; if (s) n.set(s, (n.get(s) || 0) + q); }
  return [...n].sort((a, b) => b[1] - a[1])[0]?.[0] || "";
}
const ORDER: PresetGroup[] = ["personagens", "oficiais", "meta", "campeoes", "colecoes"];

/* ===== Decks prontos: personagens do anime, decks oficiais, meta atual, campeões do Mundial e coleções =====
   Cria um deck com as cartas marcadas (e as cópias); se o nome já existir, oferece juntar no deck existente (sem repetir cartas). */
export function Presets({ open, onClose, initial, onOpenCard }: {
  open: boolean;
  onClose: () => void;
  /** abre direto neste tema (vitrine da página inicial) */
  initial?: string;
  /** clique na carta: abre a janela de detalhes */
  onOpenCard?: (hits: Hit[], index: number) => void;
}) {
  const { cat } = useCatalog();
  const { col, addCards, createList, canEdit, askLogin } = useCollection();
  const toast = useToast();
  const [files, setFiles] = useState<Preset[] | null>(null);
  const [sel, setSel] = useState<{ p: Preset; off: Set<string>; name: string; qty: Record<string, number> } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (open && !files) void loadPresets().then(setFiles); }, [open, files]);
  const presets = useMemo(() => (files && cat ? [...files, ...collectionPresets(cat)] : null), [files, cat]);

  // aberta pela vitrine: já entra no tema escolhido (uma vez por abertura)
  const usedInitial = useRef(false);
  useEffect(() => {
    if (!open) { usedInitial.current = false; return; }
    if (!initial || usedInitial.current || !presets) return;
    usedInitial.current = true;
    const p = presets.find((x) => x.nome === initial);
    if (p) openPreset(p);
  });

  const have = useMemo(() => new Set(col.cards.map((c) => c.cardId)), [col.cards]);
  const listNames = new Set(col.lists.map((l) => norm(l.name)));
  const cards = useMemo(() => (sel && cat ? presetCards(sel.p, cat) : []), [sel, cat]);

  function openPreset(p: Preset) {
    const qty: Record<string, number> = {};
    for (const [id, q] of p.cartas || []) qty[id] = q;
    setSel({ p, off: new Set(), name: p.nome, qty });
  }
  async function create() {
    if (!canEdit) { askLogin(); return; }
    if (!sel) return;
    const name = sel.name.trim();
    if (!name) { toast("Digite um nome para o deck."); return; }
    const list = col.lists.find((l) => norm(l.name) === norm(name));
    if (list && !confirm(`Você já tem um deck chamado "${list.name}". Juntar as cartas nele (sem repetir as que já estão lá)?`)) return;
    const inList = new Set(list ? col.cards.filter((c) => c.listId === list.id).map((c) => c.cardId) : []);
    const picked = cards.filter((h) => !sel.off.has(h.card.id) && !inList.has(h.card.id)).map((h) => ({ card: h.card, qty: sel.qty[h.card.id] || 1 }));
    if (!picked.length) { toast("Essas cartas já estão nesse deck."); return; }
    if (picked.length > 300 && !confirm(`Isso vai adicionar ${picked.length.toLocaleString("pt-BR")} cartas em "${list ? list.name : name}". Continuar?`)) return;
    setBusy(true);
    const to = list ? list.id : createList(name);
    const n = await addCards(picked, to);
    setBusy(false);
    toast(`${n} ${n === 1 ? "carta adicionada" : "cartas adicionadas"} em ${list ? list.name : name}.`);
    setSel(null);
    onClose();
  }

  const close = () => { setSel(null); onClose(); };
  let body;
  if (!sel) {
    // decks oficiais separados por série (são muitos); os outros grupos como estão
    const groups: { g: string; title: string; items: Preset[] }[] = [];
    for (const g of ORDER) for (const p of presets || []) {
      if (p.grupo !== g) continue;
      const s = g === "oficiais" && cat ? mainSerie(p, cat) : "";
      const title = s ? `${GROUP_TITLES[g]} – ${seriePt(s)}` : GROUP_TITLES[g];
      let x = groups.find((y) => y.title === title);
      if (!x) groups.push((x = { g, title, items: [] }));
      x.items.push(p);
    }
    body = (
      <>
        <h4>Decks prontos</h4>
        <p className="meta">Escolha um tema para criar um deck já com as cartas e as cópias. Antes de criar, dá para tirar as que você não quiser, mudar as cópias e o nome.</p>
        {!presets && <PokeLoader />}
        {groups.map(({ title, items }) => (
          <div key={title}>
            <p className="reltitle">{title} <small>{items.length}</small></p>
            <div className="presets">
              {items.map((p) => {
                const t = presetTotals(p, cat!);
                return (
                  <button key={p.nome} type="button" className="preset" onClick={() => openPreset(p)}>
                    <span className={"fan" + (p.caixa ? " fan-box" : "")}>
                      {presetCover(p, cat!).map((c) => <CardImage key={c.id} sources={cardSources(c, "low")} alt="" />)}
                      {p.caixa ? <img className="box" src={boxSrc(p.caixa)} alt="" loading="lazy" /> : <Portrait who={p.retrato} className="preset-who" />}
                    </span>
                    <span className="preset-txt">
                      <span className="tag">{p.era ? `${p.era} · ` : ""}{t.n.toLocaleString("pt-BR")} cartas</span>
                      <b>{p.nome}</b><small>{p.desc}</small>
                      {t.cost > 0 && <span className="pcost" title="Soma das cópias × menor valor de mercado de cada carta, pela cotação do dia">Custo médio para montar: <b>{brl(t.cost)}</b></span>}
                      {listNames.has(norm(p.nome)) && <small><b>Você já tem um deck com esse nome.</b></small>}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </>
    );
  } else {
    // cartas marcadas, contando as cópias
    const q = (id: string) => sel.qty[id] || 1;
    const n = cards.reduce((t, h) => t + (sel.off.has(h.card.id) ? 0 : q(h.card.id)), 0);
    const all = cards.reduce((t, h) => t + q(h.card.id), 0);
    const cost = cards.reduce((t, h) => t + (sel.off.has(h.card.id) ? 0 : q(h.card.id) * (h.card.lo || 0)), 0);
    const hits = cards.map((h) => ({ card: h.card, qty: q(h.card.id) }));
    body = (
      <div className="psel">
        <button type="button" className="psel-back" onClick={() => setSel(null)}>← Outros temas</button>
        <div className="psel-head">
          {sel.p.caixa ? <img className="psel-box" src={boxSrc(sel.p.caixa)} alt="" /> : <Portrait who={sel.p.retrato} className="psel-who" />}
          <div>
            <h4>{sel.p.nome}</h4>
            <p className="meta">{sel.p.desc} Clique numa carta para ver os detalhes; o ✓ no canto tira ou põe de volta.</p>
          </div>
        </div>
        <div className="row">
          <input value={sel.name} onChange={(e) => setSel({ ...sel, name: e.target.value })} aria-label="Nome do novo deck" />
          <button type="button" onClick={() => setSel({ ...sel, off: new Set() })}>Marcar todas</button>
          <button type="button" onClick={() => setSel({ ...sel, off: new Set(cards.map((h) => h.card.id)) })}>Desmarcar todas</button>
        </div>
        {!cat && <PokeLoader />}
        <div className="psel-scroll">
          <div className="pgrid">
            {cards.map((h, i) => {
              const on = !sel.off.has(h.card.id), c = h.card;
              return (
                <div key={c.id} className="pwrap">
                  <button type="button" className="pcard" aria-pressed={on} title={(c.pt !== c.en ? `${c.pt} (${c.en})` : c.en) + " – ver detalhes"}
                    onClick={() => onOpenCard?.(hits, i)}>
                    <span className="img">
                      <CardImage sources={cardSources(c, "low")} alt={c.pt} />
                      {have.has(c.id) && <span className="have">Já nos decks</span>}
                    </span>
                    <span className="pt">{c.pt}</span>
                    {c.pt !== c.en && <span className="en">{c.en}</span>}
                    <PriceTag card={c} />
                  </button>
                  {on && <span className="pqty"><QtyStepper compact value={q(c.id)} label={c.pt} onChange={(v) => setSel({ ...sel, qty: { ...sel.qty, [c.id]: v } })} /></span>}
                  <button type="button" className="ptick" aria-pressed={on} aria-label={on ? `Tirar ${c.pt} do deck` : `Pôr ${c.pt} de volta no deck`} title={on ? "Tirar do deck" : "Pôr de volta"}
                    onClick={() => { const off = new Set(sel.off); if (on) off.add(c.id); else off.delete(c.id); setSel({ ...sel, off }); }}>✓</button>
                </div>
              );
            })}
          </div>
        </div>
        <div className="pfoot">
          <span className="cnt">{n} de {all} cartas marcadas{cost > 0 && <small className="pcost-sel"> · custo médio para montar: <b>{brl(cost)}</b></small>}</span>
          <button type="button" className="success" disabled={canEdit && (!n || busy)} onClick={() => void create()}>{canEdit ? "Criar deck" : "Criar conta para montar o deck"}</button>
        </div>
      </div>
    );
  }
  return <Modal open={open} onClose={close} label="Decks prontos" className={"small" + (sel ? " psel-open" : "")}>{body}</Modal>;
}

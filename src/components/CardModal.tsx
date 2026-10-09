import { useRef, useState } from "react";
import type { Hit, ImageLang } from "../types";
import { useCatalog } from "../lib/catalog";
import { useSignal } from "../lib/hooks";
import { customSrc, userCardSources } from "../lib/images";
import { localImgSignal } from "../lib/localImages";
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

const LANGS: [ImageLang | null, string][] = [[null, "Automática"], ["pt", "Português"], ["en", "Inglês"]];

/* Janela de uma carta dos decks. As setas andam pelas cartas que estão na tela, na mesma ordem. */
export function CardModal({ cardId, numbers, onClose, onStep, canPrev, canNext, onOpenRelated }: {
  cardId: string | null;
  numbers: Record<string, number>;
  onClose: () => void;
  onStep: (dir: -1 | 1) => void;
  canPrev: boolean;
  canNext: boolean;
  onOpenRelated: (list: Hit[], index: number) => void;
}) {
  useSignal(localImgSignal);
  const { cat } = useCatalog();
  const { col, addCards, removeCard, moveCard, copyCard, renameCard, changeVersion, setImageLang, setCustomImage, setQuantity } = useCollection();
  const toast = useToast();
  const [zoom, setZoom] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  // campos que voltam ao padrão a cada carta
  const [form, setForm] = useState({ k: "", dest: "", url: "", namePt: "", shown: "" });
  const user = cardId ? col.cards.find((c) => c.id === cardId) : undefined;
  const f = form.k === cardId ? form : { k: cardId || "", dest: "", url: "", namePt: user?.namePt || "", shown: "" };
  const set = (p: Partial<typeof form>) => setForm({ ...f, ...p, k: cardId || "" });
  const card = user?.cardId ? cat?.byId.get(user.cardId) : undefined;
  const det = useCardDetails(card?.id);

  if (!user) return <Modal open={false} onClose={onClose} label="Carta">{null}</Modal>;

  const list = col.lists.find((l) => l.id === user.listId);
  const sources = userCardSources(user, "high");
  const mine = !!customSrc(user);
  const dest = f.dest || user.listId;
  const destName = col.lists.find((l) => l.id === dest)?.name || "";

  async function pickFile(file: File) {
    try { await setCustomImage(user!.id, { file }); toast("Imagem salva."); }
    catch { toast("Não foi possível salvar essa imagem. Tente outro arquivo."); }
  }

  return (
    <>
      <Modal open onClose={onClose} label={user.namePt} className="det" onArrow={(d) => { if ((d < 0 && canPrev) || (d > 0 && canNext)) onStep(d); }}>
        <button type="button" className="navarrow prev" aria-label="Carta anterior" title="Carta anterior (←)" disabled={!canPrev} onClick={() => onStep(-1)}>‹</button>
        <button type="button" className="navarrow next" aria-label="Próxima carta" title="Próxima carta (→)" disabled={!canNext} onClick={() => onStep(1)}>›</button>
        <div className="cardview">
          <div className="big">
            <span className="img" title="Clique para ampliar">
              {sources.length
                ? <CardImage key={sources.join("|")} sources={sources} alt={user.namePt} lazy={false} onShown={(v) => set({ shown: v })} onClick={() => f.shown && setZoom(f.shown)} />
                : <span className="ph">Sem imagem</span>}
            </span>
            {/* versões logo abaixo da imagem: clique troca a versão desta carta; + põe a versão no deck como outra carta */}
            {card && (
              <VersionStrip card={card} hint="clique troca a versão desta carta; + põe a versão no deck como outra carta"
                inDeck={new Set(col.cards.filter((c) => c.listId === user.listId).map((c) => c.cardId || ""))}
                onPick={(v) => {
                  if (v.id === card.id) return;
                  if (col.cards.some((c) => c.listId === user.listId && c.cardId === v.id)) { toast("Essa versão já está no deck como outra carta."); return; }
                  changeVersion(user.id, v.id, v.en, v.pt); toast(`Versão trocada: ${v.set.pt || v.set.en} · ${v.num}.`);
                }}
                onAdd={async (v) => {
                  const n = await addCards([{ card: v }], user.listId);
                  toast(n ? "Versão adicionada no deck como outra carta." : "Essa versão já está no deck.");
                }} />
            )}
          </div>
          <div>
            <h4>{numbers[user.id]}. {user.namePt}</h4>
            <p className="meta">{norm(user.nameEn) !== norm(user.namePt) ? user.nameEn : "Nome original em inglês"} · {list?.name}</p>
            <div className="qty-line"><span>Cópias no deck</span><QtyStepper value={user.quantity || 1} label={user.namePt} onChange={(n) => setQuantity(user.id, n)} /></div>
            {card && <PriceLine card={card} live={det.en || det.pt} qty={user.quantity || 1} />}
            {card ? <CardInfo card={card} pt={det.pt} en={det.en} loading={det.loading} />
              : !cat ? <p className="note">Carregando o catálogo…</p>
              : <p className="note">Esta carta não está no catálogo da TCGdex. Você pode pôr uma imagem própria logo abaixo.</p>}
            {user.note && <p className="note">Observação: {user.note}</p>}
          </div>
        </div>

        {card && <RelatedCards card={card} defaultDest={user.listId} onOpen={onOpenRelated} />}

        <div className="box">
          <h5>Imagem da carta</h5>
          {card && (
            <div className="srcpick" role="group" aria-label="Idioma da imagem">
              <span>Imagem em:</span>
              {LANGS.map(([k, l]) => (
                <button key={l} type="button" aria-pressed={user.imageLang === k} disabled={k === "pt" ? !card.imgPt : k === "en" ? !card.imgEn : false}
                  title={k === "pt" && !card.imgPt ? "Esta carta não tem imagem em português" : undefined}
                  onClick={() => { setImageLang(user.id, k); toast("Imagem: " + l.toLowerCase() + "."); }}>{l}</button>
              ))}
            </div>
          )}
          {card && !mine && <p className="note" style={{ margin: "6px 0 0" }}>Automática: a carta impressa em português, quando saiu no Brasil; senão, a versão em inglês.</p>}
          {mine && <p className="note" style={{ margin: "6px 0 0" }}>Esta carta usa uma imagem sua, que tem prioridade. Para voltar à imagem da carta, use "Voltar à imagem da carta".</p>}
          <div className="row" style={{ marginTop: 8 }}>
            <input type="url" placeholder="Cole o link de uma imagem" value={f.url} onChange={(ev) => set({ url: ev.target.value })} aria-label="Link da imagem" />
            <button type="button" className="success" onClick={() => {
              const u = f.url.trim();
              if (!/^https?:\/\//i.test(u)) { toast("Cole um link que comece com http:// ou https://"); return; }
              void setCustomImage(user.id, { url: u }); set({ url: "" }); toast("Imagem salva.");
            }}>Usar link</button>
            <button type="button" onClick={() => fileRef.current?.click()}>Enviar do aparelho</button>
            {user.customImage && <button type="button" className="danger" onClick={() => { void setCustomImage(user.id, null); toast("Voltou para a imagem da carta."); }}>Voltar à imagem da carta</button>}
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(ev) => { const file = ev.target.files?.[0]; if (file) void pickFile(file); ev.target.value = ""; }} />
          </div>
        </div>

        <div className="box">
          <h5>Organizar</h5>
          <div className="row">
            <select aria-label="Deck de destino" value={dest} onChange={(ev) => set({ dest: ev.target.value })}>
              {col.lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
            <button type="button" className="success" onClick={() => {
              if (dest === user.listId) { toast("A carta já está nesse deck."); return; }
              moveCard(user.id, dest); toast(`Carta movida para ${destName}.`); onClose();
            }}>Mover</button>
            <button type="button" onClick={() => { copyCard(user.id, dest); toast(`Carta copiada para ${destName}.`); }}>Copiar</button>
          </div>
          <div className="row">
            <input value={f.namePt} onChange={(ev) => set({ namePt: ev.target.value })} aria-label="Nome em português" placeholder="Nome em português" />
            <button type="button" onClick={() => {
              if (!f.namePt.trim()) { toast("Escreva o nome."); return; }
              renameCard(user.id, f.namePt); toast("Nome salvo.");
            }}>Renomear</button>
          </div>
          <div className="row"><button type="button" className="danger" onClick={() => { removeCard(user.id); onClose(); }}>Remover deste deck</button></div>
        </div>
      </Modal>
      <Zoom src={zoom} alt={user.namePt} onClose={() => setZoom("")} />
    </>
  );
}

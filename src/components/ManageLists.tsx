import { useMemo, useRef, useState } from "react";
import { copies } from "../lib/util";
import { useCollection } from "../state/collection";
import { useToast } from "../state/toast";
import { supabase } from "../lib/supabase";
import { Modal } from "./Modal";

/* ===== Meus decks: criar, renomear, reordenar, excluir, público/privado; backup e apagar tudo em "Mais opções" ===== */
export function ManageLists({ open, onClose, onPresets }: { open: boolean; onClose: () => void; onPresets: () => void }) {
  const { col, mode, createList, renameList, setListVisibility, moveList, deleteList, clearAll, importBackup, exportBackup, canEdit, askLogin } = useCollection();
  const toast = useToast();
  const [newName, setNewName] = useState("");
  const [names, setNames] = useState<Record<string, string>>({});
  const backupRef = useRef<HTMLInputElement>(null);
  const lists = useMemo(() => [...col.lists].sort((a, b) => a.position - b.position), [col.lists]);
  const count = (id: string) => copies(col.cards.filter((c) => c.listId === id));
  const [priv, setPriv] = useState(false);   // "Deck privado" ao criar

  const cloud = mode.kind === "cloud";
  const totalCards = copies(col.cards);
  return (
    <Modal open={open} onClose={onClose} label="Meus decks" className="small mdecks">
      <h4>Meus decks</h4>
      <p className="meta">{lists.length ? `${lists.length} ${lists.length === 1 ? "deck" : "decks"} · ${totalCards.toLocaleString("pt-BR")} cartas. Tudo é salvo na hora.` : "Crie o seu primeiro deck."}</p>

      {/* 1) criar */}
      <form className="md-new" onSubmit={(e) => {
        e.preventDefault();
        if (!canEdit) { askLogin(); return; }
        const v = newName.trim();
        if (!v) { toast("Digite um nome para o deck."); return; }
        createList(v, priv ? "private" : "public"); setNewName(""); toast(`Deck "${v}" criado${priv ? " (privado)" : ""}.`);
      }}>
        <input placeholder="Nome do novo deck, ex.: Deck de Água" value={newName} onChange={(e) => setNewName(e.target.value)} aria-label="Nome do novo deck" maxLength={120} />
        <button type="submit" className="success">+ Criar deck</button>
        {cloud && <label className="md-priv" title="Deck privado: só você vê. Sem marcar, o deck aparece no seu perfil em Treinadores."><input type="checkbox" checked={priv} onChange={(e) => setPriv(e.target.checked)} /> Deck privado</label>}
      </form>
      <button type="button" className="md-preset" onClick={onPresets}>ou comece com um <b>deck pronto</b> (personagens do anime, decks oficiais e campeões) →</button>

      {/* 2) meus decks */}
      {lists.length > 0 && (
        <ul className="md-list">
          {lists.map((l, i) => {
            const n = count(l.id), priv = l.visibility === "private";
            return (
              <li key={l.id} className="md-row">
                <span className="md-move">
                  <button type="button" disabled={i === 0} aria-label={`Subir ${l.name}`} title="Subir" onClick={() => moveList(l.id, -1)}>
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 14 5-5 5 5" /></svg>
                  </button>
                  <button type="button" disabled={i === lists.length - 1} aria-label={`Descer ${l.name}`} title="Descer" onClick={() => moveList(l.id, 1)}>
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5" /></svg>
                  </button>
                </span>
                <span className="md-name">
                  <input value={names[l.id] ?? l.name} aria-label="Nome do deck (clique para renomear)" title="Clique para renomear" maxLength={120}
                    onChange={(e) => setNames({ ...names, [l.id]: e.target.value })}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v === l.name) return;
                      if (!v) { setNames({ ...names, [l.id]: l.name }); toast("O deck precisa de um nome."); return; }
                      renameList(l.id, v); toast("Deck renomeado.");
                    }}
                    onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
                  <small>{n} {n === 1 ? "carta" : "cartas"}</small>
                </span>
                {cloud && (
                  <button type="button" role="switch" aria-checked={!priv} className={"md-vis" + (priv ? " priv" : "")}
                    title={priv ? "Privado: só você vê. Clique para deixar público." : "Público: aparece no seu perfil em Treinadores. Clique para deixar privado."}
                    onClick={() => {
                      const v = priv ? "public" : "private";
                      setListVisibility(l.id, v);
                      toast(v === "public" ? `"${l.name}" agora é público: aparece no seu perfil em Treinadores.` : `"${l.name}" agora é privado: só você vê.`);
                    }}>
                    {priv
                      ? <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
                      : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="2.8" /></svg>}
                    <span>{priv ? "Privado" : "Público"}</span>
                  </button>
                )}
                <button type="button" className="md-del" aria-label={`Excluir ${l.name}`} title="Excluir deck" onClick={() => {
                  if (!confirm(`Excluir o deck "${l.name}"${n ? ` e as ${n} cartas dele` : ""}? Isso não pode ser desfeito.`)) return;
                  deleteList(l.id); toast(`Deck "${l.name}" excluído.`);
                }}>
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" /></svg>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {cloud && lists.length > 0 && <p className="md-hint">Decks <b>públicos</b> aparecem no seu perfil em Treinadores. Clique em "Público" para deixar um deck privado.</p>}
      {!cloud && supabase && lists.length > 0 && <p className="md-hint">Entre com a sua conta para guardar os decks na nuvem e mostrar no seu perfil de treinador.</p>}

      {/* 3) o resto, escondido até precisar */}
      <details className="md-more">
        <summary>Mais opções <small>backup e começar do zero</small></summary>
        <div className="md-opts">
          <div>
            <b>Backup</b>
            <small>{cloud ? "Os decks já ficam na sua conta; o backup é uma cópia extra em arquivo." : "Os decks ficam só neste navegador: baixe um backup para não perder nada."}</small>
            <span className="row">
              <button type="button" onClick={() => { exportBackup(); toast("Backup baixado."); }}>Baixar backup</button>
              <button type="button" onClick={() => backupRef.current?.click()}>Importar backup</button>
            </span>
          </div>
          <div>
            <b>Começar do zero</b>
            <small>Apaga todos os decks e cartas{cloud ? " da sua conta" : " deste navegador"}.</small>
            <span className="row">
              <button type="button" className="danger" disabled={!col.lists.length} onClick={async () => {
                if (!confirm(`Começar do zero? Todos os seus decks (${col.lists.length}) e cartas (${col.cards.length}) serão apagados${cloud ? " da sua conta" : " deste navegador"}. Isso não pode ser desfeito: baixe um backup antes se quiser guardar.`)) return;
                await clearAll(); toast("Pronto: você está sem decks. Crie um ou use um deck pronto.");
              }}>Apagar tudo</button>
            </span>
          </div>
        </div>
        <input ref={backupRef} type="file" accept="application/json,.json" hidden onChange={async (e) => {
          const f = e.target.files?.[0]; e.target.value = "";
          if (!f) return;
          try { const n = await importBackup(JSON.parse(await f.text())); toast(`Backup importado: ${n} cartas em decks novos.`); }
          catch { toast("Esse arquivo não é um backup desta página."); }
        }} />
      </details>
    </Modal>
  );
}

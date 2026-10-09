import { useMemo, useState } from "react";
import { ALL_FIELDS, EXPORT_FIELDS, buildRows, exportLists, txtCard, type FieldKey } from "../lib/exporter";
import { copies, readJSON, writeJSON } from "../lib/util";
import { numbersOf, useCollection } from "../state/collection";
import { useToast } from "../state/toast";
import { Modal } from "./Modal";

const FIELDS_KEY = "mdp-exportar-campos";   // informações escolhidas da última vez
const BASIC: FieldKey[] = ["n", "qtd", "pt", "en"];
const COLLECTOR: FieldKey[] = ["n", "qtd", "pt", "en", "colecao", "num", "rar", "valor", "total", "lista"];

/* Exportar em 3 passos: quais decks, quais informações (colunas) e o formato (Excel, texto ou lista do Pokémon TCG Live) */
export function ExportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { col } = useCollection();
  const toast = useToast();
  const lists = useMemo(() => [...col.lists].sort((a, b) => a.position - b.position), [col.lists]);
  const [off, setOff] = useState<Set<string>>(new Set());   // listas desmarcadas
  const [fields, setFieldsState] = useState<FieldKey[]>(() => {
    const saved = readJSON<string[]>(FIELDS_KEY, ALL_FIELDS).filter((k): k is FieldKey => (ALL_FIELDS as string[]).includes(k));
    return saved.length ? saved : ALL_FIELDS;
  });
  const setFields = (f: FieldKey[]) => { const ordered = ALL_FIELDS.filter((k) => f.includes(k)); setFieldsState(ordered); writeJSON(FIELDS_KEY, ordered); };
  const chosen = lists.filter((l) => !off.has(l.id));
  const count = (id: string) => copies(col.cards.filter((c) => c.listId === id));
  const cards = chosen.reduce((s, l) => s + count(l.id), 0);
  const all = chosen.length === lists.length, none = !chosen.length;
  const sample = useMemo(() => (open ? buildRows(chosen, col.cards, numbersOf(col)).slice(0, 3) : []), [open, chosen, col]);
  const cols = EXPORT_FIELDS.filter((f) => fields.includes(f.k));
  const same = (a: FieldKey[]) => a.length === fields.length && a.every((k) => fields.includes(k));

  async function run(fmt: "xlsx" | "txt" | "live") {
    toast(await exportLists(fmt, chosen, lists, col.cards, numbersOf(col), fields));
  }
  return (
    <Modal open={open} onClose={onClose} label="Exportar decks" className="exp">
      <h4>Exportar decks</h4>
      <p className="meta">Gere um arquivo Excel ou de texto com as suas cartas, escolhendo os decks e as informações, ou a lista para importar no Pokémon TCG Live.</p>
      {!col.cards.length && <p className="note">Ainda não há cartas para exportar.</p>}

      <section className="exp-step">
        <h5><span className="exp-n">1</span>Quais decks</h5>
        <label className="pick-all">
          <input type="checkbox" checked={all} ref={(el) => { if (el) el.indeterminate = !all && !none; }}
            onChange={(e) => setOff(e.target.checked ? new Set() : new Set(lists.map((l) => l.id)))} />
          Todos os decks <span>{copies(col.cards)} cartas</span>
        </label>
        <div className="pick-list">
          {lists.map((l) => (
            <label key={l.id}>
              <input type="checkbox" checked={!off.has(l.id)}
                onChange={(e) => { const s = new Set(off); if (e.target.checked) s.delete(l.id); else s.add(l.id); setOff(s); }} />
              {l.name} <span>{count(l.id)}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="exp-step">
        <h5><span className="exp-n">2</span>Quais informações</h5>
        <div className="exp-presets" role="group" aria-label="Atalhos">
          <button type="button" aria-pressed={same(ALL_FIELDS)} onClick={() => setFields(ALL_FIELDS)}>Todas</button>
          <button type="button" aria-pressed={same(BASIC)} onClick={() => setFields(BASIC)}>Só número e nomes</button>
          <button type="button" aria-pressed={same(COLLECTOR)} onClick={() => setFields(COLLECTOR)}>Para colecionar</button>
          <button type="button" onClick={() => setFields([])}>Desmarcar todas</button>
        </div>
        <div className="exp-fields">
          {EXPORT_FIELDS.map((f) => (
            <label key={f.k} title={f.hint || undefined}>
              <input type="checkbox" checked={fields.includes(f.k)}
                onChange={(e) => setFields(e.target.checked ? [...fields, f.k] : fields.filter((k) => k !== f.k))} />
              <span>{f.label}{f.hint && <small>{f.hint}</small>}</span>
            </label>
          ))}
        </div>
        {cols.length > 0 && sample.length > 0 && (
          <div className="exp-preview">
            <p className="note" style={{ margin: "0 0 6px" }}>Prévia das primeiras cartas:</p>
            <div className="exp-table">
              <table>
                <thead><tr>{cols.map((c) => <th key={c.k}>{c.label}</th>)}</tr></thead>
                <tbody>{sample.map((r, i) => <tr key={i}>{cols.map((c) => <td key={c.k}>{String(r.v[c.k])}</td>)}</tr>)}</tbody>
              </table>
            </div>
            <pre className="exp-txt" aria-label="Prévia em texto">{sample.flatMap((r) => txtCard(r.v, fields)).join("\n")}</pre>
          </div>
        )}
      </section>

      <section className="exp-step">
        <h5><span className="exp-n">3</span>Formato</h5>
        <div className="fmt">
          <button type="button" className="success" disabled={none || !cols.length} onClick={() => void run("xlsx")}><b>Baixar Excel (.xlsx)</b><small>Uma coluna para cada informação escolhida</small></button>
          <button type="button" disabled={none || !cols.length} onClick={() => void run("txt")}><b>Baixar texto (.txt)</b><small>Fácil de ler, imprimir ou colar numa mensagem</small></button>
          <button type="button" disabled={none} onClick={() => void run("live")}><b>Lista do Pokémon TCG Live</b><small>"4 Pikachu MEW 25": baixa e copia para importar no jogo (as informações acima não entram)</small></button>
        </div>
        <p className="note">{none ? "Marque pelo menos um deck." : !cols.length ? "Marque pelo menos uma informação."
          : `${chosen.length} ${chosen.length === 1 ? "deck" : "decks"} · ${cards} ${cards === 1 ? "carta" : "cartas"} · ${cols.length} ${cols.length === 1 ? "informação" : "informações"}.`}</p>
      </section>
    </Modal>
  );
}

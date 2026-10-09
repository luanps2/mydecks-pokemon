import type { CardList, CatCard, UserCard } from "../types";
import { getCatalog } from "./catalog";
import { kindLine, rarityPt, seriePt } from "./labels";
import { norm } from "./util";

/* ===== Exportar decks: Excel (.xlsx, SheetJS carregado só na hora), texto (.txt) e lista do Pokémon TCG Live ===== */
/* Informações que podem ir para o arquivo (a pessoa escolhe quais), na ordem das colunas */
export const EXPORT_FIELDS = [
  { k: "n", label: "Nº", hint: "Número da carta (1, 2, 3…)", w: 6 },
  { k: "qtd", label: "Qtd.", hint: "Cópias da carta no deck", w: 6 },
  { k: "lista", label: "Deck", hint: "Nome do deck", w: 28 },
  { k: "pt", label: "Nome em português", hint: "", w: 32 },
  { k: "en", label: "Nome original (inglês)", hint: "", w: 32 },
  { k: "tipo", label: "Tipo", hint: "Pokémon · Fogo · Estágio 1, Treinador · Apoiador…", w: 30 },
  { k: "hp", label: "HP", hint: "", w: 6 },
  { k: "colecao", label: "Coleção", hint: "Nome da coleção e série", w: 30 },
  { k: "num", label: "Nº na coleção", hint: "Ex.: MEW 025/165", w: 16 },
  { k: "rar", label: "Raridade", hint: "", w: 18 },
  { k: "reg", label: "Regulação", hint: "Marca de regulação (G, H…)", w: 9 },
  { k: "legal", label: "Formatos", hint: "Padrão / Expandido", w: 18 },
  { k: "valor", label: "Valor (R$)", hint: "Menor valor de mercado de uma cópia", w: 11 },
  { k: "total", label: "Valor × cópias (R$)", hint: "", w: 14 },
  { k: "obs", label: "Observação", hint: "", w: 24 },
] as const;
export type FieldKey = (typeof EXPORT_FIELDS)[number]["k"];
export const ALL_FIELDS: FieldKey[] = EXPORT_FIELDS.map((f) => f.k);
type Cell = string | number;
export interface Row { listId: string; card?: CatCard; u: UserCard; v: Record<FieldKey, Cell> }

const money = (v: number) => Math.round(v * 100) / 100;
export function buildRows(lists: CardList[], cards: UserCard[], numbers: Record<string, number>): Row[] {
  const cat = getCatalog(), out: Row[] = [];
  for (const l of lists) {
    for (const u of cards.filter((x) => x.listId === l.id).sort((a, b) => a.position - b.position)) {
      const c = u.cardId ? cat?.byId.get(u.cardId) : undefined, q = u.quantity || 1;
      out.push({ listId: l.id, card: c, u, v: {
        n: numbers[u.id], qtd: q, lista: l.name, pt: u.namePt, en: u.nameEn, tipo: c ? kindLine(c) : "", hp: c?.hp || "",
        colecao: c ? `${c.set.pt || c.set.en} (${seriePt(c.set.s)})` : "", num: c ? `${c.set.ab ? c.set.ab + " " : ""}${c.num}${c.set.n ? "/" + c.set.n : ""}` : "",
        rar: c ? rarityPt(c.rarity) : "", reg: c?.reg || "", legal: c ? [c.std ? "Padrão" : "", c.exp ? "Expandido" : ""].filter(Boolean).join(" / ") || "Nenhum" : "",
        valor: c?.lo ? money(c.lo) : "", total: c?.lo ? money(c.lo * q) : "", obs: u.note } });
    }
  }
  return out;
}
function download(blob: Blob, name: string) {
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
interface XLSXLib {
  utils: { book_new(): unknown; aoa_to_sheet(d: Cell[][]): Record<string, unknown>; book_append_sheet(wb: unknown, ws: unknown, name: string): void };
  writeFile(wb: unknown, name: string): void;
}
let xlsxLib: Promise<XLSXLib> | null = null;
function loadXLSX(): Promise<XLSXLib> {
  return xlsxLib || (xlsxLib = new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
    s.onload = () => res((window as unknown as { XLSX: XLSXLib }).XLSX);
    s.onerror = () => { xlsxLib = null; s.remove(); rej(new Error("xlsx")); };
    document.head.appendChild(s);
  }));
}
function sheetName(name: string, used: Set<string>) {
  const base = String(name).replace(/[[\]:*?/\\]/g, " ").trim().slice(0, 31) || "Deck";
  let n = base, i = 2;
  while (used.has(n.toLowerCase())) n = base.slice(0, 31 - String(i).length - 1) + " " + i++;
  used.add(n.toLowerCase());
  return n;
}
const fileSlug = (s: string) => norm(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

/* Uma carta no arquivo de texto, só com as informações escolhidas:
   primeira linha "Nº. 3x Nome em português (Nome em inglês)", segunda com o resto */
export function txtCard(v: Record<FieldKey, Cell>, fields: FieldKey[]): string[] {
  const has = (k: FieldKey) => fields.includes(k) && String(v[k]) !== "";
  const s = (k: FieldKey) => String(v[k]);
  const name = has("pt") && has("en") ? s("pt") + (norm(s("pt")) !== norm(s("en")) ? ` (${s("en")})` : "") : has("pt") ? s("pt") : has("en") ? s("en") : "";
  const head = [has("n") ? s("n") + "." : "", has("qtd") ? s("qtd") + "x" : "", name].filter(Boolean).join(" ");
  const brl = (k: FieldKey) => "R$ " + Number(v[k]).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
  const bits = [has("lista") ? "Deck: " + s("lista") : "", has("tipo") ? s("tipo") : "", has("hp") ? "HP " + s("hp") : "",
    has("colecao") ? "Coleção: " + s("colecao") : "", has("num") ? "Nº " + s("num") : "", has("rar") ? s("rar") : "", has("reg") ? "Regulação " + s("reg") : "",
    has("legal") ? "Formatos: " + s("legal") : "", has("valor") ? "Valor: " + brl("valor") : "", has("total") ? "× cópias: " + brl("total") : "",
    has("obs") ? "Obs.: " + s("obs") : ""].filter(Boolean);
  if (!head) return [bits.join(" · ")];
  return bits.length ? [head, "   " + bits.join(" · ")] : [head];
}

/* ===== Lista no formato do Pokémon TCG Live (e do antigo PTCGO): "4 Pikachu MEW 25", em 3 blocos =====
   Energia Básica no formato do jogo: "8 Basic {L} Energy SVE 4". Cartas sem sigla de coleção saem só com o nome. */
const BASIC_SYMBOL: Record<string, string> = { grass: "G", fire: "R", water: "W", lightning: "L", psychic: "P", fighting: "F", darkness: "D", metal: "M", fairy: "Y" };
function liveLine(u: UserCard, c?: CatCard): string {
  const q = u.quantity || 1;
  if (!c) return `${q} ${u.nameEn}`;
  const num = c.num.replace(/^0+(?=\d)/, "");
  const basic = c.cat === 2 && c.sub !== "Special" && /^(\w+) Energy$/i.exec(c.en.replace(/^Basic /, ""));
  const name = basic && BASIC_SYMBOL[basic[1].toLowerCase()] ? `Basic {${BASIC_SYMBOL[basic[1].toLowerCase()]}} Energy` : c.en;
  return `${q} ${name}${c.set.ab ? ` ${c.set.ab} ${num}` : ""}`;
}
export function liveList(list: CardList, cards: UserCard[]): string {
  const cat = getCatalog();
  const mine = cards.filter((x) => x.listId === list.id).sort((a, b) => a.position - b.position);
  const groups: [string, UserCard[]][] = [["Pokémon", []], ["Trainer", []], ["Energy", []]];
  for (const u of mine) { const c = u.cardId ? cat?.byId.get(u.cardId) : undefined; groups[c ? c.cat : 1][1].push(u); }
  const out: string[] = [];
  for (const [title, us] of groups) {
    if (!us.length) continue;
    out.push(`${title}: ${us.reduce((t, u) => t + (u.quantity || 1), 0)}`);
    for (const u of us) out.push(liveLine(u, u.cardId ? cat?.byId.get(u.cardId) : undefined));
    out.push("");
  }
  out.push(`Total Cards: ${mine.reduce((t, u) => t + (u.quantity || 1), 0)}`);
  return out.join("\n");
}

/* Devolve a mensagem para mostrar ao terminar */
export async function exportLists(fmt: "xlsx" | "txt" | "live", chosen: CardList[], allLists: CardList[], cards: UserCard[], numbers: Record<string, number>,
  fields: FieldKey[] = ALL_FIELDS): Promise<string> {
  const all = chosen.length === allLists.length;
  const file = "decks-pokemon" + (all ? "" : chosen.length === 1 ? "-" + fileSlug(chosen[0].name) : `-${chosen.length}-decks`);
  if (fmt === "live") {
    const txt = chosen.map((l) => (chosen.length > 1 ? `### ${l.name}\n` : "") + liveList(l, cards)).join("\n\n");
    download(new Blob([txt], { type: "text/plain;charset=utf-8" }), file + "-tcg-live.txt");
    try { await navigator.clipboard.writeText(txt); return "Lista baixada e copiada: no Pokémon TCG Live, use Decks → Importar."; }
    catch { return "Lista baixada: no Pokémon TCG Live, use Decks → Importar e cole o conteúdo do arquivo."; }
  }
  const cols = EXPORT_FIELDS.filter((f) => fields.includes(f.k));
  if (!cols.length) return "Escolha pelo menos uma informação para exportar.";
  const rs = buildRows(chosen, cards, numbers);
  if (!rs.length) return chosen.length === 1 ? "Esse deck não tem cartas." : "Os decks escolhidos não têm cartas.";
  if (fmt === "xlsx") {
    let X: XLSXLib;
    try { X = await loadXLSX(); } catch { return "Não foi possível carregar o gerador de Excel. Verifique a internet ou exporte em texto."; }
    const wb = X.utils.book_new(), used = new Set<string>();
    const sheet = (part: Row[]) => {
      const ws = X.utils.aoa_to_sheet([cols.map((c) => c.label), ...part.map((x) => cols.map((c) => x.v[c.k]))]);
      ws["!cols"] = cols.map((c) => ({ wch: c.w }));
      ws["!autofilter"] = { ref: ws["!ref"] };
      return ws;
    };
    // uma aba com tudo e, se houver mais de um deck, uma aba para cada
    X.utils.book_append_sheet(wb, sheet(rs), sheetName(chosen.length === 1 ? chosen[0].name : all ? "Todos" : "Selecionados", used));
    if (chosen.length > 1) for (const l of chosen) { const part = rs.filter((x) => x.listId === l.id); if (part.length) X.utils.book_append_sheet(wb, sheet(part), sheetName(l.name, used)); }
    X.writeFile(wb, file + ".xlsx");
  } else {
    const out = [`MyDeck Pokémon – exportado em ${new Date().toLocaleDateString("pt-BR")}`, ""];
    for (const l of chosen) {
      const part = rs.filter((x) => x.listId === l.id);
      if (!part.length) continue;
      const n = part.reduce((t, x) => t + (x.u.quantity || 1), 0);
      out.push(`==== ${l.name} (${n} ${n === 1 ? "carta" : "cartas"}) ====`, "");
      for (const { v } of part) out.push(...txtCard(v, fields), "");
    }
    download(new Blob(["﻿" + out.join("\r\n")], { type: "text/plain;charset=utf-8" }), file + ".txt");
  }
  const n = rs.reduce((t, x) => t + (x.u.quantity || 1), 0);
  return `Exportado: ${n} ${n === 1 ? "carta" : "cartas"}.`;
}

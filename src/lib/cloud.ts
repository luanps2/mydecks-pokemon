import type { CardList, Collection, ImageLang, UserCard } from "../types";
import { supabase } from "./supabase";

/* Leitura e gravação da coleção no Supabase.
   As regras do banco (supabase/schema.sql) garantem que cada pessoa só lê e grava os próprios dados. */
interface ListRow { id: string; name: string; position: number; visibility?: "private" | "public" }
interface CardRow {
  id: string; list_id: string; card_id: string | null; name_en: string; name_pt: string;
  section: string; note: string; position: number; image_lang: ImageLang | null;
  custom_image: string | null; quantity: number;
}
const CARD_COLS = "id,list_id,card_id,name_en,name_pt,section,note,position,image_lang,custom_image,quantity";
export const toCard = (r: CardRow): UserCard => ({
  id: r.id, listId: r.list_id, cardId: r.card_id, nameEn: r.name_en, namePt: r.name_pt, section: r.section || "", note: r.note || "",
  position: r.position, imageLang: r.image_lang, customImage: r.custom_image, quantity: r.quantity || 1,
});
const fromCard = (c: UserCard): CardRow => ({
  id: c.id, list_id: c.listId, card_id: c.cardId, name_en: c.nameEn, name_pt: c.namePt, section: c.section, note: c.note,
  position: c.position, image_lang: c.imageLang,
  // "idb" é uma imagem guardada só no navegador: na conta, a imagem vai para o Storage antes de gravar
  custom_image: c.customImage === "idb" ? null : c.customImage, quantity: c.quantity || 1,
});

function db() {
  if (!supabase) throw new Error("Supabase não configurado");
  return supabase;
}
export function check<T>(r: { data: T | null; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  return r.data as T;
}

/** O Supabase devolve no máximo 1000 linhas por consulta: lê as cartas em páginas */
export async function fetchCardRows(filter: { owner?: string; lists?: string[] }): Promise<UserCard[]> {
  const out: UserCard[] = [];
  for (let from = 0; ; from += 1000) {
    let q = db().from("list_cards").select(CARD_COLS);
    if (filter.owner) q = q.eq("owner_id", filter.owner);
    if (filter.lists) q = q.in("list_id", filter.lists);
    const page = check(await q.order("position").order("id").range(from, from + 999)) as CardRow[];
    out.push(...page.map(toCard));
    if (page.length < 1000) break;
  }
  return out;
}

export async function fetchCollection(userId: string): Promise<Collection> {
  const lists = check(await db().from("lists").select("id,name,position,visibility").eq("owner_id", userId).order("position")) as ListRow[];
  return { lists, cards: await fetchCardRows({ owner: userId }) };
}

export async function insertLists(lists: CardList[]) {
  if (lists.length) check(await db().from("lists").insert(lists.map((l) => ({ id: l.id, name: l.name, position: l.position, visibility: l.visibility || "public" }))));
}
export async function updateList(id: string, patch: Partial<CardList>) {
  const row: Partial<ListRow> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.position !== undefined) row.position = patch.position;
  if (patch.visibility !== undefined) row.visibility = patch.visibility;
  check(await db().from("lists").update(row).eq("id", id));
}
/* Apagar o deck apaga as cartas dele junto (on delete cascade no banco) */
export async function deleteLists(ids: string[]) {
  if (ids.length) check(await db().from("lists").delete().in("id", ids));
}
export async function insertCards(cards: UserCard[]) {
  for (let i = 0; i < cards.length; i += 500) check(await db().from("list_cards").insert(cards.slice(i, i + 500).map(fromCard)));
}
export async function deleteCards(ids: string[]) {
  for (let i = 0; i < ids.length; i += 200) check(await db().from("list_cards").delete().in("id", ids.slice(i, i + 200)));
}
export async function updateCard(id: string, patch: Partial<UserCard>) {
  const full = fromCard({ id, listId: "", cardId: null, nameEn: "", namePt: "", section: "", note: "", position: 0, imageLang: null, customImage: null, quantity: 1, ...patch });
  const row: Partial<CardRow> = {};
  for (const [k, f] of [["listId", "list_id"], ["position", "position"], ["imageLang", "image_lang"], ["namePt", "name_pt"], ["nameEn", "name_en"],
    ["cardId", "card_id"], ["section", "section"], ["customImage", "custom_image"], ["quantity", "quantity"], ["note", "note"]] as const)
    if (k in patch) (row as Record<string, unknown>)[f] = full[f];
  check(await db().from("list_cards").update(row).eq("id", id));
}

/* Imagem enviada pela pessoa: vai para card-images/{usuário}/{carta}-{data}.jpg e devolve o endereço público */
export async function uploadImage(userId: string, cardId: string, dataUrl: string): Promise<string> {
  const blob = await (await fetch(dataUrl)).blob();
  const path = `${userId}/${cardId}-${Date.now()}.jpg`;
  check(await db().storage.from("card-images").upload(path, blob, { contentType: "image/jpeg", upsert: true }));
  return db().storage.from("card-images").getPublicUrl(path).data.publicUrl;
}

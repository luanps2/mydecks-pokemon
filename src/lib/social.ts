import { supabase } from "./supabase";

/* ===== Treinadores: perfis e decks públicos das outras pessoas =====
   Todo deck novo nasce público (a pessoa pode marcar "Deck privado"). As regras do banco (supabase/schema.sql)
   deixam qualquer visitante ler os perfis e as cartas dos decks públicos. */
export interface Profile { id: string; name: string; avatar: string }
export interface PublicList { id: string; ownerId: string; name: string; count: number; covers: string[]; updatedAt: string }
export interface PublicCard { id: string; cardId: string | null; nameEn: string; namePt: string; section: string; customImage: string | null; quantity: number }

function db() {
  if (!supabase) throw new Error("Supabase não configurado");
  return supabase;
}
function check<T>(r: { data: T | null; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  return r.data as T;
}
interface ProfileRow { id: string; display_name: string | null; avatar_url: string | null }
/* Perfis pelo código */
async function profilesBy(ids: string[]): Promise<ProfileRow[]> {
  return check(await db().from("profiles").select("id,display_name,avatar_url").in("id", ids)) as ProfileRow[];
}
const toProfile = (r: ProfileRow): Profile => ({ id: r.id, name: r.display_name || "Treinador", avatar: r.avatar_url || "" });
interface ListRow { id: string; owner_id: string; name: string; updated_at: string; list_cards: { count: number }[] }

/* Capas: as 3 primeiras cartas de cada deck */
async function coversOf(listIds: string[]): Promise<Map<string, string[]>> {
  const m = new Map<string, string[]>();
  if (!listIds.length) return m;
  const rows = check(await db().from("list_cards").select("list_id,card_id,position").in("list_id", listIds)
    .not("card_id", "is", null).lt("position", 12).order("position")) as { list_id: string; card_id: string }[];
  for (const r of rows) {
    const a = m.get(r.list_id) || [];
    if (a.length < 3) a.push(r.card_id);
    m.set(r.list_id, a);
  }
  return m;
}
async function publicLists(ownerId?: string): Promise<PublicList[]> {
  let q = db().from("lists").select("id,owner_id,name,updated_at,list_cards(count)").eq("visibility", "public");
  if (ownerId) q = q.eq("owner_id", ownerId);
  const rows = check(await q.order("position")) as ListRow[];
  const covers = await coversOf(rows.map((r) => r.id));
  return rows.map((r) => ({ id: r.id, ownerId: r.owner_id, name: r.name, updatedAt: r.updated_at, count: r.list_cards?.[0]?.count || 0, covers: covers.get(r.id) || [] }));
}

/* Página Treinadores: cada pessoa com pelo menos uma lista pública, com as listas dela */
export async function fetchCommunity(): Promise<{ profile: Profile; lists: PublicList[] }[]> {
  // todas as pessoas cadastradas (rede social), mais os decks públicos de cada uma
  const [lists, everyone] = await Promise.all([publicLists(), allProfiles()]);
  const ids = [...new Set([...everyone.map((p) => p.id), ...lists.map((l) => l.ownerId)])];
  const byId = new Map(everyone.map((p) => [p.id, p]));
  const out = ids.map((id) => ({ profile: byId.get(id) || { id, name: "Treinador", avatar: "" }, lists: lists.filter((l) => l.ownerId === id) }));
  // quem tem decks e atualizou por último aparece primeiro; quem ainda não tem decks vem depois
  const last = (x: { lists: PublicList[] }) => x.lists.reduce((m, l) => (l.updatedAt > m ? l.updatedAt : m), "");
  return out.sort((a, b) => last(b).localeCompare(last(a)) || a.profile.name.localeCompare(b.profile.name));
}
/* Todos os perfis (em páginas de 1000, o máximo do Supabase por consulta) */
async function allProfiles(): Promise<Profile[]> {
  const out: Profile[] = [];
  for (let from = 0; ; from += 1000) {
    const page = check(await db().from("profiles").select("id,display_name,avatar_url").order("created_at").range(from, from + 999)) as ProfileRow[];
    out.push(...page.map(toProfile));
    if (page.length < 1000) break;
  }
  return out;
}

/* Perfil de uma pessoa: dados e decks públicos */
export async function fetchProfile(id: string): Promise<{ profile: Profile; lists: PublicList[] } | null> {
  const [rows, lists] = await Promise.all([
    profilesBy([id]),
    publicLists(id),
  ]);
  if (!rows.length && !lists.length) return null;
  return { profile: rows[0] ? toProfile(rows[0]) : { id, name: "Treinador", avatar: "" }, lists };
}

/* Cartas de um deck público (em páginas de 1000, o máximo do Supabase) */
export async function fetchListCards(listId: string): Promise<PublicCard[]> {
  const out: PublicCard[] = [];
  for (let from = 0; ; from += 1000) {
    const page = check(await db().from("list_cards").select("id,card_id,name_en,name_pt,section,custom_image,quantity").eq("list_id", listId)
      .order("position").order("id").range(from, from + 999)) as { id: string; card_id: string | null; name_en: string; name_pt: string; section: string; custom_image: string | null; quantity: number | null }[];
    out.push(...page.map((r) => ({ id: r.id, cardId: r.card_id, nameEn: r.name_en, namePt: r.name_pt, section: r.section, customImage: r.custom_image, quantity: r.quantity || 1 })));
    if (page.length < 1000) break;
  }
  return out;
}

/* Ao entrar: guarda a foto do Google no perfil e cria o perfil se faltar (contas antigas) */
export async function syncMyProfile(userId: string, name: string, avatar: string, email: string) {
  const rows = check(await db().from("profiles").select("id,display_name,avatar_url").eq("id", userId)) as ProfileRow[];
  if (!rows.length) {
    await db().from("profiles").insert({ id: userId, display_name: name || email.split("@")[0], avatar_url: avatar || null });
    return;
  }
  // foto do Google sempre atualizada; nome completo do Google no lugar do começo do e-mail (sem apagar um nome escolhido pela pessoa)
  const patch: Record<string, string> = {};
  if (avatar && rows[0].avatar_url !== avatar) patch.avatar_url = avatar;
  if (name && (!rows[0].display_name || rows[0].display_name === email.split("@")[0])) patch.display_name = name.slice(0, 60);
  if (Object.keys(patch).length) await db().from("profiles").update(patch).eq("id", userId);
}
export async function myProfile(userId: string): Promise<Profile | null> {
  const rows = await profilesBy([userId]);
  return rows[0] ? toProfile(rows[0]) : null;
}
export async function renameMe(userId: string, name: string) {
  check(await db().from("profiles").update({ display_name: name }).eq("id", userId));
}

/* Endereço para compartilhar um perfil: o site abre direto nele */
export const profileLink = (id: string) => `${location.origin}${import.meta.env.BASE_URL}#treinador/${id}`;

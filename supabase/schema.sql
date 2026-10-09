-- =====================================================================
-- MyDeck Pokémon – estrutura do banco no Supabase
-- Como usar: no painel do Supabase, abra "SQL Editor" → "New query", cole este arquivo
-- inteiro e clique em "Run". Pode rodar de novo sem problema (não apaga nada).
-- Cada pessoa só mexe nos próprios decks (Row Level Security); decks públicos e perfis
-- podem ser vistos por todos, em "Treinadores".
-- =====================================================================

-- ---------- Perfis (um por pessoa, criado no primeiro login) ----------
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) between 1 and 60),
  avatar_url   text,
  created_at   timestamptz not null default now()
);

-- ---------- Decks ----------
create table if not exists public.lists (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 120),
  position   integer not null default 0,
  -- public: aparece no perfil da pessoa em "Treinadores" (padrão); private: só o dono vê
  visibility text not null default 'public' check (visibility in ('private', 'public')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists lists_owner_idx on public.lists (owner_id, position);

-- ---------- Cartas de cada deck ----------
create table if not exists public.list_cards (
  id           uuid primary key default gen_random_uuid(),
  list_id      uuid not null references public.lists (id) on delete cascade,
  owner_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  card_id      text check (card_id is null or char_length(card_id) <= 40),  -- código da TCGdex (ex.: sv03.5-025)
  name_en      text not null check (char_length(name_en) between 1 and 200),
  name_pt      text not null check (char_length(name_pt) between 1 and 200),
  section      text not null default '',
  note         text not null default '' check (char_length(note) <= 500),
  quantity     integer not null default 1 check (quantity between 1 and 999),
  position     integer not null default 0,
  image_lang   text check (image_lang in ('pt', 'en')),                    -- vazio = automática
  custom_image text check (custom_image is null or char_length(custom_image) <= 1000),
  created_at   timestamptz not null default now()
);
create index if not exists list_cards_list_idx  on public.list_cards (list_id, position);
create index if not exists list_cards_owner_idx on public.list_cards (owner_id);

-- ---------- updated_at automático nos decks ----------
create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end $$;
drop trigger if exists lists_touch on public.lists;
create trigger lists_touch before update on public.lists
  for each row execute function public.touch_updated_at();

-- ---------- Perfil criado no primeiro login, com o nome e a foto do Google ----------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (new.id,
          left(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)), 60),
          coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture'))
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Segurança: cada pessoa só mexe nos próprios dados ----------
alter table public.profiles   enable row level security;
alter table public.lists      enable row level security;
alter table public.list_cards enable row level security;

-- perfis: todos veem (página Treinadores); cada um cria e edita só o seu
drop policy if exists "perfil: ver todos" on public.profiles;
drop policy if exists "perfil: criar o próprio" on public.profiles;
drop policy if exists "perfil: editar o próprio" on public.profiles;
create policy "perfil: ver todos" on public.profiles for select using (true);
create policy "perfil: criar o próprio" on public.profiles
  for insert with check (id = (select auth.uid()));
create policy "perfil: editar o próprio" on public.profiles
  for update using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- decks: o dono vê todos os seus; os outros veem só os públicos
drop policy if exists "decks: ler" on public.lists;
drop policy if exists "decks: criar" on public.lists;
drop policy if exists "decks: editar" on public.lists;
drop policy if exists "decks: excluir" on public.lists;
create policy "decks: ler" on public.lists
  for select using (owner_id = (select auth.uid()) or visibility = 'public');
create policy "decks: criar" on public.lists
  for insert with check (owner_id = (select auth.uid()));
create policy "decks: editar" on public.lists
  for update using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "decks: excluir" on public.lists
  for delete using (owner_id = (select auth.uid()));

-- cartas: as do dono e as dos decks públicos; só dá para pôr cartas nos próprios decks
drop policy if exists "cartas: ler" on public.list_cards;
drop policy if exists "cartas: criar" on public.list_cards;
drop policy if exists "cartas: editar" on public.list_cards;
drop policy if exists "cartas: excluir" on public.list_cards;
create policy "cartas: ler" on public.list_cards
  for select using (
    owner_id = (select auth.uid())
    or exists (select 1 from public.lists l where l.id = list_id and l.visibility = 'public'));
create policy "cartas: criar" on public.list_cards
  for insert with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.lists l where l.id = list_id and l.owner_id = (select auth.uid())));
create policy "cartas: editar" on public.list_cards
  for update using (owner_id = (select auth.uid())) with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.lists l where l.id = list_id and l.owner_id = (select auth.uid())));
create policy "cartas: excluir" on public.list_cards
  for delete using (owner_id = (select auth.uid()));

-- ---------- Imagens enviadas pelas pessoas (Storage) ----------
-- Leitura pública (as imagens aparecem nos decks); cada pessoa só envia, troca e apaga
-- arquivos dentro da própria pasta: card-images/{id da pessoa}/...
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('card-images', 'card-images', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
drop policy if exists "imagens: enviar na própria pasta" on storage.objects;
drop policy if exists "imagens: trocar na própria pasta" on storage.objects;
drop policy if exists "imagens: apagar da própria pasta" on storage.objects;
create policy "imagens: enviar na própria pasta" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'card-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "imagens: trocar na própria pasta" on storage.objects
  for update to authenticated
  using (bucket_id = 'card-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "imagens: apagar da própria pasta" on storage.objects
  for delete to authenticated
  using (bucket_id = 'card-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---------- Acesso pela API do Supabase ----------
grant select, insert, update, delete on public.lists, public.list_cards to authenticated;
grant select on public.lists, public.list_cards, public.profiles to anon;
grant select, insert, update on public.profiles to authenticated;

-- ---------- Perfis de quem já tinha conta antes deste arquivo ----------
-- Nome do Google (ou o começo do e-mail) e a foto do Google; não apaga nomes que a pessoa já escolheu.
insert into public.profiles (id, display_name, avatar_url)
select u.id,
       left(coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', split_part(u.email, '@', 1)), 60),
       coalesce(u.raw_user_meta_data ->> 'avatar_url', u.raw_user_meta_data ->> 'picture')
from auth.users u
on conflict (id) do update
  set display_name = coalesce(public.profiles.display_name, excluded.display_name),
      avatar_url   = coalesce(excluded.avatar_url, public.profiles.avatar_url);

-- ---------- Conferência: deve mostrar as 3 tabelas com "rls ligado = true" ----------
select c.relname as tabela, c.relrowsecurity as "rls ligado"
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in ('profiles', 'lists', 'list_cards');

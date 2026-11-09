-- THE LAST CHECKPOINT — initial schema
-- Security model:
--   * Players are Supabase anonymous (guest) users. auth.uid() identifies them.
--   * rooms / matches / player_views are readable only by the two room members (RLS).
--   * match_secrets holds the full authoritative game state. RLS is enabled with NO
--     policies, so only the service role (used by the `game` Edge Function) can touch it.
--   * Clients never write game state. All writes go through SECURITY DEFINER RPCs
--     (room lifecycle) or the Edge Function (game actions).

-- ------------------------------------------------------------------ rooms
create table if not exists public.rooms (
  id              uuid primary key default gen_random_uuid(),
  code            text not null unique,
  host_id         uuid not null references auth.users(id) on delete cascade,
  guest_id        uuid references auth.users(id) on delete set null,
  host_name       text not null default 'Player 1',
  guest_name      text,
  status          text not null default 'lobby' check (status in ('lobby', 'playing', 'finished', 'closed')),
  current_match_id uuid,
  match_count     int  not null default 0,
  host_seen_at    timestamptz not null default now(),
  guest_seen_at   timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  expires_at      timestamptz not null default now() + interval '3 hours'
);
create index if not exists rooms_host_idx on public.rooms (host_id);
create index if not exists rooms_guest_idx on public.rooms (guest_id);

-- ------------------------------------------------------------------ matches
create table if not exists public.matches (
  id          uuid primary key default gen_random_uuid(),
  room_id     uuid not null references public.rooms(id) on delete cascade,
  number      int  not null,
  guard_id    uuid not null,
  zombie_id   uuid not null,
  status      text not null default 'active' check (status in ('active', 'finished')),
  winner      text check (winner in ('guard', 'zombie')),
  win_reason  text,
  created_at  timestamptz not null default now(),
  ended_at    timestamptz,
  unique (room_id, number)
);

alter table public.rooms
  add constraint rooms_current_match_fk foreign key (current_match_id) references public.matches(id) on delete set null;

-- ------------------------------------------------------------------ secret state (server only)
create table if not exists public.match_secrets (
  match_id   uuid primary key references public.matches(id) on delete cascade,
  state      jsonb not null,
  version    int  not null default 0,
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------------ per-player filtered views
create table if not exists public.player_views (
  match_id   uuid not null references public.matches(id) on delete cascade,
  player_id  uuid not null,
  role       text not null check (role in ('guard', 'zombie')),
  view       jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (match_id, player_id)
);

-- ------------------------------------------------------------------ RLS
alter table public.rooms         enable row level security;
alter table public.matches       enable row level security;
alter table public.match_secrets enable row level security;
alter table public.player_views  enable row level security;

-- No policies on match_secrets: invisible to anon/authenticated roles.
revoke all on public.match_secrets from anon, authenticated;

create policy "members read room" on public.rooms
  for select to authenticated
  using (auth.uid() = host_id or auth.uid() = guest_id);

create policy "members read matches" on public.matches
  for select to authenticated
  using (exists (
    select 1 from public.rooms r
    where r.id = matches.room_id and (auth.uid() = r.host_id or auth.uid() = r.guest_id)
  ));

create policy "player reads own view" on public.player_views
  for select to authenticated
  using (player_id = auth.uid());

-- Clients never insert/update/delete directly.
revoke insert, update, delete on public.rooms, public.matches, public.player_views from anon, authenticated;

-- ------------------------------------------------------------------ realtime
alter publication supabase_realtime add table public.rooms;
alter publication supabase_realtime add table public.matches;
alter publication supabase_realtime add table public.player_views;

-- ------------------------------------------------------------------ RPCs
-- 6 characters from a 31-symbol alphabet (no 0/O/1/I/L), drawn from gen_random_uuid()'s
-- cryptographically secure random bytes (built into Postgres 13+, no extension needed).
create or replace function public.gen_room_code() returns text
language plpgsql set search_path = public as $$
declare
  alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  result text;
  bytes bytea;
  i int;
begin
  loop
    result := '';
    bytes := uuid_send(gen_random_uuid());
    for i in 0..5 loop
      result := result || substr(alphabet, 1 + (get_byte(bytes, i) % length(alphabet)), 1);
    end loop;
    exit when not exists (select 1 from public.rooms where code = result);
  end loop;
  return result;
end $$;

create or replace function public.create_room(p_name text default null)
returns public.rooms
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  recent int;
  r public.rooms;
begin
  if uid is null then raise exception 'Not signed in'; end if;
  select count(*) into recent from public.rooms where host_id = uid and created_at > now() - interval '10 minutes';
  if recent >= 10 then raise exception 'Too many rooms created. Wait a few minutes.'; end if;
  -- close this host's older lobbies so codes do not pile up
  update public.rooms set status = 'closed', updated_at = now()
    where host_id = uid and status = 'lobby';
  insert into public.rooms (code, host_id, host_name)
    values (public.gen_room_code(), uid, coalesce(nullif(left(trim(p_name), 20), ''), 'Player 1'))
    returning * into r;
  return r;
end $$;

create or replace function public.join_room(p_code text, p_name text default null)
returns public.rooms
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  r public.rooms;
begin
  if uid is null then raise exception 'Not signed in'; end if;
  select * into r from public.rooms where code = upper(trim(p_code)) for update;
  if not found then raise exception 'Room not found'; end if;
  if r.status = 'closed' or r.expires_at < now() then raise exception 'This room has expired'; end if;

  -- Reconnect: already a member
  if r.host_id = uid then
    update public.rooms set host_seen_at = now(), updated_at = now() where id = r.id returning * into r;
    return r;
  end if;
  if r.guest_id = uid then
    update public.rooms set guest_seen_at = now(), updated_at = now() where id = r.id returning * into r;
    return r;
  end if;

  if r.guest_id is not null then raise exception 'Room is full'; end if;
  if r.status <> 'lobby' then raise exception 'Match already in progress'; end if;

  update public.rooms
    set guest_id = uid,
        guest_name = coalesce(nullif(left(trim(p_name), 20), ''), 'Player 2'),
        guest_seen_at = now(),
        updated_at = now(),
        expires_at = greatest(expires_at, now() + interval '3 hours')
    where id = r.id
    returning * into r;
  return r;
end $$;

create or replace function public.leave_room(p_room uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  r public.rooms;
begin
  select * into r from public.rooms where id = p_room for update;
  if not found then return; end if;
  if r.host_id = uid then
    update public.rooms set status = 'closed', updated_at = now() where id = r.id;
  elsif r.guest_id = uid and r.status in ('lobby', 'finished') then
    update public.rooms set guest_id = null, guest_name = null, guest_seen_at = null, status = 'lobby', updated_at = now()
      where id = r.id;
  end if;
end $$;

-- Heartbeat used for reconnection windows / forfeit claims.
create or replace function public.heartbeat(p_room uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  update public.rooms
    set host_seen_at  = case when host_id  = uid then now() else host_seen_at end,
        guest_seen_at = case when guest_id = uid then now() else guest_seen_at end,
        expires_at    = greatest(expires_at, now() + interval '1 hour')
    where id = p_room and (host_id = uid or guest_id = uid);
end $$;

create or replace function public.cleanup_expired_rooms()
returns int
language sql security definer set search_path = public as $$
  with d as (delete from public.rooms where expires_at < now() - interval '1 hour' returning 1)
  select count(*)::int from d;
$$;

revoke all on function public.cleanup_expired_rooms() from public, anon, authenticated;
revoke all on function public.gen_room_code() from public, anon, authenticated;
grant execute on function public.create_room(text) to authenticated;
grant execute on function public.join_room(text, text) to authenticated;
grant execute on function public.leave_room(uuid) to authenticated;
grant execute on function public.heartbeat(uuid) to authenticated;

-- Optional (requires the pg_cron extension, enable in Dashboard > Database > Extensions):
-- select cron.schedule('cleanup-rooms', '*/30 * * * *', 'select public.cleanup_expired_rooms()');

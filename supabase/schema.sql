-- Winchell Analytics: user subscriptions + Web Push for Live Sales.
--
-- Apply once in the Supabase SQL editor (or `supabase db push`). Auth itself
-- is Supabase's built-in email magic-link sign-in — no extra tables needed.
--
-- Access model:
--   * signed-in users manage only their own subscription rows (RLS below);
--   * the daily pipeline uses the service-role key, which bypasses RLS, to
--     read everyone's subscriptions and record what it has already sent.

-- One row per sale a user subscribes to (catalogue_id from the feed).
create table if not exists public.sale_subscriptions (
  user_id      uuid not null references auth.users (id) on delete cascade,
  catalogue_id text not null,
  sale_name    text not null default '',
  created_at   timestamptz not null default now(),
  primary key (user_id, catalogue_id)
);

-- One row per watched sire / damsire. sire_key is the normalised form the
-- site and pipeline both use for matching; sire_name is as the user typed it.
create table if not exists public.sire_subscriptions (
  user_id    uuid not null references auth.users (id) on delete cascade,
  sire_key   text not null,
  sire_name  text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, sire_key)
);

-- One row per browser/device push endpoint a user has enabled.
create table if not exists public.push_subscriptions (
  endpoint   text primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  p256dh     text not null,
  auth       text not null,
  user_agent text not null default '',
  created_at timestamptz not null default now()
);

-- Pipeline-only ledger of notifications already delivered (dedup), including
-- the silent baseline rows written when a subscription is first seen.
create table if not exists public.push_sent (
  user_id   uuid not null,
  event_key text not null,
  sent_at   timestamptz not null default now(),
  primary key (user_id, event_key)
);

alter table public.sale_subscriptions enable row level security;
alter table public.sire_subscriptions enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.push_sent enable row level security; -- no policies: service-role only

create policy "own sale subscriptions"
  on public.sale_subscriptions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own sire subscriptions"
  on public.sire_subscriptions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own push subscriptions"
  on public.push_subscriptions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

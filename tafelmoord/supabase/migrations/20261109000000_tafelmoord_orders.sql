-- Tafelmoord-bestellingen (gedeeld project, daarom met prefix). Alleen de edge functions (service role) lezen en schrijven.
create table if not exists public.tafelmoord_orders (
  id                    bigint generated always as identity primary key,
  stripe_session_id     text not null unique,
  product               text not null,          -- bv. 'oudejaar-nl', 'taart-fr' (zie catalog.json)
  email                 text,
  amount_total_cents    integer,
  currency              text,
  livemode              boolean not null default false,
  withdrawal_waiver_at  timestamptz,
  email_sent_at         timestamptz,
  last_download_at      timestamptz,
  created_at            timestamptz not null default now()
);

create index if not exists tafelmoord_orders_product_created_idx on public.tafelmoord_orders (product, created_at);

alter table public.tafelmoord_orders enable row level security;
-- Bewust geen policies: anon en authenticated hebben geen toegang.

-- Privé-bucket voor de spelpakketten (<spel>-<taal>.zip); downloads enkel via signed URL's.
insert into storage.buckets (id, name, public)
values ('tafelmoord-pakketten', 'tafelmoord-pakketten', false)
on conflict (id) do nothing;

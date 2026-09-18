-- Dumerso Coffee schema for a friend's own Supabase project.
-- Paste this into the Supabase SQL editor first (before seed.sql).
-- The Next.js API uses the service role key, which bypasses RLS.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  photo_url text,
  role text not null default 'pending' check (role in ('pending', 'staff', 'admin')),
  disabled boolean not null default false,
  approved_by text,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz
);

create table if not exists public.settings (
  id text primary key default 'default',
  cafe_name text not null default 'Dumerso Coffee',
  logo_url text not null default '/logo.jpg',
  description text not null default 'Freshly brewed. Made with care.',
  tagline text not null default 'Scan. Browse. Enjoy.',
  phone text not null default '+251 913 961 921',
  location text not null default 'Gombora Taxi Mazoriya',
  maps_url text not null default '',
  opening_hours text not null default 'Mon - Sun: 7:00 AM - 10:00 PM',
  facebook text not null default '',
  instagram text not null default '',
  telegram text not null default '',
  tiktok text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  icon text not null default '☕',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.menu_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category_id uuid not null references public.categories (id) on delete cascade,
  price double precision not null,
  description text,
  image_url text,
  is_available boolean not null default true,
  is_special boolean not null default false,
  is_popular boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (category_id, name)
);

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  details text not null,
  type text not null default 'update',
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  order_date text not null,
  order_time text not null,
  total_amount double precision not null,
  payment_method text not null default 'Cash',
  status text not null default 'Completed',
  is_closed boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  menu_item_id uuid,
  item_name text not null,
  category_name text not null default 'General',
  quantity integer not null,
  unit_price double precision not null,
  subtotal double precision not null
);

create table if not exists public.daily_sales_summaries (
  id uuid primary key default gen_random_uuid(),
  date text not null unique,
  total_sales double precision not null,
  total_orders integer not null,
  items_sold integer not null,
  average_order double precision not null,
  cash_sales double precision not null default 0,
  telebirr_sales double precision not null default 0,
  card_sales double precision not null default 0,
  other_sales double precision not null default 0,
  is_closed boolean not null default true,
  closed_at timestamptz not null default now()
);

create table if not exists public.costs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  cost_type text not null,
  amount double precision,
  percentage double precision,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists menu_items_category_id_idx on public.menu_items (category_id);
create index if not exists orders_order_date_idx on public.orders (order_date);
create index if not exists order_items_order_id_idx on public.order_items (order_id);
create index if not exists profiles_role_idx on public.profiles (role);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute procedure public.set_updated_at();

drop trigger if exists settings_set_updated_at on public.settings;
create trigger settings_set_updated_at
before update on public.settings
for each row execute procedure public.set_updated_at();

drop trigger if exists categories_set_updated_at on public.categories;
create trigger categories_set_updated_at
before update on public.categories
for each row execute procedure public.set_updated_at();

drop trigger if exists menu_items_set_updated_at on public.menu_items;
create trigger menu_items_set_updated_at
before update on public.menu_items
for each row execute procedure public.set_updated_at();

drop trigger if exists costs_set_updated_at on public.costs;
create trigger costs_set_updated_at
before update on public.costs
for each row execute procedure public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security: deny browser access. The Next.js API uses the service
-- role key, which bypasses RLS.
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.settings enable row level security;
alter table public.categories enable row level security;
alter table public.menu_items enable row level security;
alter table public.activity_logs enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.daily_sales_summaries enable row level security;
alter table public.costs enable row level security;

-- ---------------------------------------------------------------------------
-- Storage: public menu images (read), writes only via service role
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('menu-images', 'menu-images', true)
on conflict (id) do nothing;

drop policy if exists "Public read menu images" on storage.objects;
create policy "Public read menu images"
on storage.objects
for select
using (bucket_id = 'menu-images');

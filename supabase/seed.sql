-- Optional starter data for Dumerso Coffee.
-- Run AFTER 0001_init.sql. Safe to re-run (upserts / on conflict).

insert into public.settings (
  id, cafe_name, logo_url, description, tagline, phone, location, opening_hours
) values (
  'default',
  'Dumerso Coffee',
  '/logo.jpg',
  'Freshly brewed. Made with care.',
  'Scan. Browse. Enjoy.',
  '+251 913 961 921',
  'Gombora Taxi Mazoriya',
  'Mon - Sun: 7:00 AM - 10:00 PM'
)
on conflict (id) do update set
  cafe_name = excluded.cafe_name,
  logo_url = excluded.logo_url,
  description = excluded.description,
  tagline = excluded.tagline,
  phone = excluded.phone,
  location = excluded.location,
  opening_hours = excluded.opening_hours;

insert into public.categories (id, name, icon, sort_order) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Tea & Hot Drinks', '🍃', 1),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Coffee', '☕', 2),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Water', '💧', 3)
on conflict (name) do update set
  icon = excluded.icon,
  sort_order = excluded.sort_order;

insert into public.menu_items (
  name, category_id, price, description, image_url, is_special, is_popular, sort_order, is_available
) values
  ('Special Tea', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 85, 'Special house tea.',
    'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=800&q=80', true, true, 1, true),
  ('Wetet Belewiz', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 75, 'Milk and peanut.',
    'https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=800&q=80', true, true, 2, true),
  ('Fruit Tea', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 65, 'Fruit tea.',
    'https://images.unsplash.com/photo-1597481499750-3e6b22637e12?auto=format&fit=crop&w=800&q=80', false, true, 3, true),
  ('Lewiz Tea', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 65, 'Peanut tea.',
    'https://images.unsplash.com/photo-1561047029-3000c68339ca?auto=format&fit=crop&w=800&q=80', false, false, 4, true),
  ('Milk', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 55, 'Milk',
    'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=800&q=80', false, false, 5, true),
  ('Tea', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 25, 'Tea',
    'https://images.unsplash.com/photo-1594631252845-29fc4cc86de5?auto=format&fit=crop&w=800&q=80', false, false, 6, true),
  ('Macchiato', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 50, 'Rich espresso with milk foam.',
    'https://images.unsplash.com/photo-1485808191679-5f86510681a2?auto=format&fit=crop&w=800&q=80', true, true, 1, true),
  ('Espresso', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 35, 'Pure concentrated espresso shot.',
    'https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?auto=format&fit=crop&w=800&q=80', false, true, 2, true),
  ('Coffee', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 35, 'Freshly brewed black coffee.',
    'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=800&q=80', false, true, 3, true),
  ('1/2 Liter', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 35, 'Purified drinking water (500ml).',
    'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?auto=format&fit=crop&w=800&q=80', false, false, 1, true),
  ('1 Liter', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 50, 'Purified drinking water (1000ml).',
    'https://images.unsplash.com/photo-1560023907-5f339617ea30?auto=format&fit=crop&w=800&q=80', false, false, 2, true),
  ('2 Liter', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 60, 'Purified drinking water (2000ml).',
    'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=800&q=80', false, false, 3, true)
on conflict (category_id, name) do nothing;

insert into public.activity_logs (action, details, type)
select v.action, v.details, v.type
from (
  values
    ('Added new item: Espresso', 'Added to Coffee category', 'add'),
    ('Updated item: Fruit Tea', 'Updated price to 65 ETB', 'update'),
    ('Deleted item: Green Tea', 'Removed from menu', 'delete'),
    ('Added new item: 2 Liter Water', 'Added to Water category', 'add')
) as v(action, details, type)
where not exists (
  select 1 from public.activity_logs existing where existing.action = v.action
);

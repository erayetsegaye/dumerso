import { getAdminClient } from '@/lib/supabase/admin';

function throwIfError(error: { message: string } | null, fallback: string): void {
  if (error) {
    throw new Error(error.message || fallback);
  }
}

function iso(value: string | null | undefined): string {
  if (!value) return new Date().toISOString();
  return new Date(value).toISOString();
}

type CategoryRow = {
  id: string;
  name: string;
  icon: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
  menu_items?: { count: number }[] | null;
};

type MenuItemRow = {
  id: string;
  name: string;
  category_id: string;
  price: number;
  description: string | null;
  image_url: string | null;
  is_available: boolean;
  is_special: boolean;
  is_popular: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  categories?: CategoryRow | CategoryRow[] | null;
};

type OrderItemRow = {
  id: string;
  order_id: string;
  menu_item_id: string | null;
  item_name: string;
  category_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
};

type OrderRow = {
  id: string;
  order_number: string;
  order_date: string;
  order_time: string;
  total_amount: number;
  payment_method: string;
  status: string;
  is_closed: boolean;
  created_at: string;
  order_items?: OrderItemRow[] | null;
};

type CostRow = {
  id: string;
  name: string;
  description: string | null;
  cost_type: string;
  amount: number | null;
  percentage: number | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

type SettingsRow = {
  id: string;
  cafe_name: string;
  logo_url: string;
  description: string;
  tagline: string;
  phone: string;
  location: string;
  maps_url: string;
  opening_hours: string;
  facebook: string;
  instagram: string;
  telegram: string;
  tiktok: string;
  updated_at: string;
};

type ActivityRow = {
  id: string;
  action: string;
  details: string;
  type: string;
  created_at: string;
};

type SummaryRow = {
  id: string;
  date: string;
  total_sales: number;
  total_orders: number;
  items_sold: number;
  average_order: number;
  cash_sales: number;
  telebirr_sales: number;
  card_sales: number;
  other_sales: number;
  is_closed: boolean;
  closed_at: string;
};

type ProfileRow = {
  id: string;
  email: string | null;
  display_name: string | null;
  photo_url: string | null;
  role: string;
  disabled: boolean;
  created_at: string;
  updated_at: string;
  last_seen_at: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
};

function itemsCount(value: CategoryRow['menu_items']): number {
  if (!value) return 0;
  if (Array.isArray(value)) return Number(value[0]?.count ?? 0);
  return Number((value as { count?: number }).count ?? 0);
}

function mapCategory(row: CategoryRow) {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon,
    order: row.sort_order,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    _count: {
      items: itemsCount(row.menu_items),
    },
  };
}

function nestedCategory(row: MenuItemRow): ReturnType<typeof mapCategory> | null {
  const raw = Array.isArray(row.categories) ? row.categories[0] : row.categories;
  return raw ? mapCategory(raw) : null;
}

function mapMenuItem(row: MenuItemRow) {
  return {
    id: row.id,
    name: row.name,
    categoryId: row.category_id,
    price: Number(row.price),
    description: row.description,
    imageUrl: row.image_url,
    isAvailable: Boolean(row.is_available),
    isSpecial: Boolean(row.is_special),
    isPopular: Boolean(row.is_popular),
    order: row.sort_order,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    category: nestedCategory(row),
  };
}

function mapOrderItem(row: OrderItemRow) {
  return {
    id: row.id,
    orderId: row.order_id,
    menuItemId: row.menu_item_id,
    itemName: row.item_name,
    categoryName: row.category_name,
    quantity: Number(row.quantity),
    unitPrice: Number(row.unit_price),
    subtotal: Number(row.subtotal),
  };
}

function mapOrder(row: OrderRow) {
  return {
    id: row.id,
    orderNumber: row.order_number,
    orderDate: row.order_date,
    orderTime: row.order_time,
    totalAmount: Number(row.total_amount),
    paymentMethod: row.payment_method,
    status: row.status,
    isClosed: Boolean(row.is_closed),
    createdAt: iso(row.created_at),
    items: (row.order_items || []).map(mapOrderItem),
  };
}

function mapCost(row: CostRow) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    costType: row.cost_type,
    amount: row.amount === null ? null : Number(row.amount),
    percentage: row.percentage === null ? null : Number(row.percentage),
    active: Boolean(row.active),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

function mapSettings(row: SettingsRow) {
  return {
    id: row.id,
    cafeName: row.cafe_name,
    logoUrl: row.logo_url,
    description: row.description,
    tagline: row.tagline,
    phone: row.phone,
    location: row.location,
    mapsUrl: row.maps_url,
    openingHours: row.opening_hours,
    facebook: row.facebook,
    instagram: row.instagram,
    telegram: row.telegram,
    tiktok: row.tiktok,
    updatedAt: iso(row.updated_at),
  };
}

function mapActivity(row: ActivityRow) {
  return {
    id: row.id,
    action: row.action,
    details: row.details,
    type: row.type,
    createdAt: iso(row.created_at),
  };
}

function mapSummary(row: SummaryRow) {
  return {
    id: row.id,
    date: row.date,
    totalSales: Number(row.total_sales),
    totalOrders: Number(row.total_orders),
    itemsSold: Number(row.items_sold),
    averageOrder: Number(row.average_order),
    cashSales: Number(row.cash_sales),
    telebirrSales: Number(row.telebirr_sales),
    cardSales: Number(row.card_sales),
    otherSales: Number(row.other_sales),
    isClosed: Boolean(row.is_closed),
    closedAt: iso(row.closed_at),
  };
}

export function mapProfile(row: ProfileRow) {
  return {
    uid: row.id,
    email: row.email,
    displayName: row.display_name,
    photoURL: row.photo_url,
    role: row.role,
    disabled: Boolean(row.disabled),
    createdAt: iso(row.created_at),
    lastSeenAt: row.last_seen_at ? iso(row.last_seen_at) : null,
  };
}

const MENU_WITH_CATEGORY = '*, categories(*)';
const ORDER_WITH_ITEMS = '*, order_items(*)';
const CATEGORY_WITH_COUNT = '*, menu_items(count)';

export async function listCategories() {
  const { data, error } = await getAdminClient()
    .from('categories')
    .select(CATEGORY_WITH_COUNT)
    .order('sort_order', { ascending: true });
  throwIfError(error, 'Failed to fetch categories');
  return ((data || []) as CategoryRow[]).map(mapCategory);
}

export async function createCategory(input: { name: string; icon: string; order: number }) {
  const { data, error } = await getAdminClient()
    .from('categories')
    .insert({ name: input.name, icon: input.icon, sort_order: input.order })
    .select()
    .single();
  throwIfError(error, 'Failed to create category');
  return mapCategory(data as CategoryRow);
}

export async function updateCategory(
  id: string,
  input: { name?: string; icon?: string; order?: number }
) {
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.icon !== undefined) patch.icon = input.icon;
  if (input.order !== undefined) patch.sort_order = input.order;

  const { data, error } = await getAdminClient()
    .from('categories')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  throwIfError(error, 'Failed to update category');
  return mapCategory(data as CategoryRow);
}

export async function deleteCategory(id: string) {
  const { error } = await getAdminClient().from('categories').delete().eq('id', id);
  throwIfError(error, 'Failed to delete category');
}

export async function listMenuItems(filters: {
  categoryId?: string | null;
  search?: string | null;
  availableOnly?: boolean;
}) {
  let query = getAdminClient()
    .from('menu_items')
    .select(MENU_WITH_CATEGORY)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });

  if (filters.categoryId && filters.categoryId !== 'all') {
    query = query.eq('category_id', filters.categoryId);
  }
  if (filters.availableOnly) {
    query = query.eq('is_available', true);
  }
  if (filters.search && filters.search.trim()) {
    const term = filters.search.trim().replace(/[%_,]/g, '');
    query = query.or(`name.ilike.%${term}%,description.ilike.%${term}%`);
  }

  const { data, error } = await query;
  throwIfError(error, 'Failed to fetch menu items');
  return ((data || []) as MenuItemRow[]).map(mapMenuItem);
}

export async function getMenuItem(id: string) {
  const { data, error } = await getAdminClient()
    .from('menu_items')
    .select(MENU_WITH_CATEGORY)
    .eq('id', id)
    .maybeSingle();
  throwIfError(error, 'Failed to fetch menu item');
  return data ? mapMenuItem(data as MenuItemRow) : null;
}

export async function createMenuItem(input: {
  name: string;
  categoryId: string;
  price: number;
  description: string | null;
  imageUrl: string | null;
  isAvailable: boolean;
  isSpecial: boolean;
  isPopular: boolean;
}) {
  const { data, error } = await getAdminClient()
    .from('menu_items')
    .insert({
      name: input.name,
      category_id: input.categoryId,
      price: input.price,
      description: input.description,
      image_url: input.imageUrl,
      is_available: input.isAvailable,
      is_special: input.isSpecial,
      is_popular: input.isPopular,
    })
    .select(MENU_WITH_CATEGORY)
    .single();
  throwIfError(error, 'Failed to create menu item');
  return mapMenuItem(data as MenuItemRow);
}

export async function updateMenuItem(
  id: string,
  input: {
    name?: string;
    categoryId?: string;
    price?: number;
    description?: string | null;
    imageUrl?: string | null;
    isAvailable?: boolean;
    isSpecial?: boolean;
    isPopular?: boolean;
  }
) {
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.categoryId !== undefined) patch.category_id = input.categoryId;
  if (input.price !== undefined) patch.price = input.price;
  if (input.description !== undefined) patch.description = input.description;
  if (input.imageUrl !== undefined) patch.image_url = input.imageUrl;
  if (input.isAvailable !== undefined) patch.is_available = input.isAvailable;
  if (input.isSpecial !== undefined) patch.is_special = input.isSpecial;
  if (input.isPopular !== undefined) patch.is_popular = input.isPopular;

  const { data, error } = await getAdminClient()
    .from('menu_items')
    .update(patch)
    .eq('id', id)
    .select(MENU_WITH_CATEGORY)
    .single();
  throwIfError(error, 'Failed to update menu item');
  return mapMenuItem(data as MenuItemRow);
}

export async function deleteMenuItem(id: string) {
  const { error } = await getAdminClient().from('menu_items').delete().eq('id', id);
  throwIfError(error, 'Failed to delete menu item');
}

export async function getSettings() {
  const { data, error } = await getAdminClient()
    .from('settings')
    .select('*')
    .eq('id', 'default')
    .maybeSingle();
  throwIfError(error, 'Failed to fetch settings');
  return data ? mapSettings(data as SettingsRow) : null;
}

export async function createDefaultSettings() {
  const { data, error } = await getAdminClient()
    .from('settings')
    .insert({
      id: 'default',
      cafe_name: 'Dumerso Café',
      logo_url: '/logo.jpg',
      description: 'Freshly brewed. Made with care.',
      tagline: 'Scan. Browse. Enjoy.',
      phone: '+251 913 961 921',
      location: 'Gombora Taxi Mazoriya',
      opening_hours: 'Mon - Sun: 7:00 AM - 10:00 PM',
    })
    .select()
    .single();
  throwIfError(error, 'Failed to create settings');
  return mapSettings(data as SettingsRow);
}

export async function upsertSettings(input: {
  cafeName?: string;
  logoUrl?: string;
  description?: string;
  tagline?: string;
  phone?: string;
  location?: string;
  mapsUrl?: string;
  openingHours?: string;
  facebook?: string;
  instagram?: string;
  telegram?: string;
  tiktok?: string;
}) {
  const { data, error } = await getAdminClient()
    .from('settings')
    .upsert({
      id: 'default',
      cafe_name: input.cafeName || 'Dumerso Café',
      logo_url: input.logoUrl || '/logo.jpg',
      description: input.description || 'Freshly brewed. Made with care.',
      tagline: input.tagline || 'Scan. Browse. Enjoy.',
      phone: input.phone || '+251 913 961 921',
      location: input.location || 'Gombora Taxi Mazoriya',
      maps_url: input.mapsUrl || '',
      opening_hours: input.openingHours || 'Mon - Sun: 7:00 AM - 10:00 PM',
      facebook: input.facebook || '',
      instagram: input.instagram || '',
      telegram: input.telegram || '',
      tiktok: input.tiktok || '',
    })
    .select()
    .single();
  throwIfError(error, 'Failed to update settings');
  return mapSettings(data as SettingsRow);
}

export async function listOrders(filters: {
  date?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  status?: string;
}) {
  let query = getAdminClient()
    .from('orders')
    .select(ORDER_WITH_ITEMS)
    .order('created_at', { ascending: false });

  if (filters.status) query = query.eq('status', filters.status);
  if (filters.date) {
    query = query.eq('order_date', filters.date);
  } else if (filters.startDate && filters.endDate) {
    query = query.gte('order_date', filters.startDate).lte('order_date', filters.endDate);
  }

  const { data, error } = await query;
  throwIfError(error, 'Failed to fetch orders');
  return ((data || []) as OrderRow[]).map(mapOrder);
}

export async function getOrder(id: string) {
  const { data, error } = await getAdminClient()
    .from('orders')
    .select(ORDER_WITH_ITEMS)
    .eq('id', id)
    .maybeSingle();
  throwIfError(error, 'Failed to fetch order');
  return data ? mapOrder(data as OrderRow) : null;
}

export async function countOrders() {
  const { count, error } = await getAdminClient()
    .from('orders')
    .select('id', { count: 'exact', head: true });
  throwIfError(error, 'Failed to count orders');
  return count ?? 0;
}

export async function createOrder(input: {
  orderNumber: string;
  orderDate: string;
  orderTime: string;
  totalAmount: number;
  paymentMethod: string;
  status: string;
  items: Array<{
    menuItemId: string | null;
    itemName: string;
    categoryName: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
  }>;
}) {
  const admin = getAdminClient();
  const { data: order, error: orderError } = await admin
    .from('orders')
    .insert({
      order_number: input.orderNumber,
      order_date: input.orderDate,
      order_time: input.orderTime,
      total_amount: input.totalAmount,
      payment_method: input.paymentMethod,
      status: input.status,
    })
    .select()
    .single();
  throwIfError(orderError, 'Failed to create order');

  const orderId = (order as OrderRow).id;
  const { error: itemsError } = await admin.from('order_items').insert(
    input.items.map((item) => ({
      order_id: orderId,
      menu_item_id: item.menuItemId,
      item_name: item.itemName,
      category_name: item.categoryName,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      subtotal: item.subtotal,
    }))
  );
  throwIfError(itemsError, 'Failed to create order items');

  const created = await getOrder(orderId);
  if (!created) throw new Error('Failed to load created order');
  return created;
}

export async function deleteOrder(id: string) {
  const { error } = await getAdminClient().from('orders').delete().eq('id', id);
  throwIfError(error, 'Failed to delete order');
}

export async function listActivity(limit = 10) {
  const { data, error } = await getAdminClient()
    .from('activity_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  throwIfError(error, 'Failed to fetch activity log');
  return ((data || []) as ActivityRow[]).map(mapActivity);
}

export async function createActivity(input: { action: string; details: string; type: string }) {
  const { error } = await getAdminClient().from('activity_logs').insert({
    action: input.action,
    details: input.details,
    type: input.type,
  });
  throwIfError(error, 'Failed to write activity log');
}

export async function listCosts() {
  const { data, error } = await getAdminClient()
    .from('costs')
    .select('*')
    .order('created_at', { ascending: false });
  throwIfError(error, 'Failed to fetch costs');
  return ((data || []) as CostRow[]).map(mapCost);
}

export async function getCost(id: string) {
  const { data, error } = await getAdminClient().from('costs').select('*').eq('id', id).maybeSingle();
  throwIfError(error, 'Failed to fetch cost');
  return data ? mapCost(data as CostRow) : null;
}

export async function createCost(input: {
  name: string;
  description: string | null;
  costType: string;
  amount: number | null;
  percentage: number | null;
  active: boolean;
}) {
  const { data, error } = await getAdminClient()
    .from('costs')
    .insert({
      name: input.name,
      description: input.description,
      cost_type: input.costType,
      amount: input.amount,
      percentage: input.percentage,
      active: input.active,
    })
    .select()
    .single();
  throwIfError(error, 'Failed to create cost');
  return mapCost(data as CostRow);
}

export async function updateCost(
  id: string,
  input: {
    name?: string;
    description?: string | null;
    costType?: string;
    amount?: number | null;
    percentage?: number | null;
    active?: boolean;
  }
) {
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.description !== undefined) patch.description = input.description;
  if (input.costType !== undefined) patch.cost_type = input.costType;
  if (input.amount !== undefined) patch.amount = input.amount;
  if (input.percentage !== undefined) patch.percentage = input.percentage;
  if (input.active !== undefined) patch.active = input.active;

  const { data, error } = await getAdminClient()
    .from('costs')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  throwIfError(error, 'Failed to update cost');
  return mapCost(data as CostRow);
}

export async function deleteCost(id: string) {
  const { error } = await getAdminClient().from('costs').delete().eq('id', id);
  throwIfError(error, 'Failed to delete cost');
}

export async function getDailySummary(date: string) {
  const { data, error } = await getAdminClient()
    .from('daily_sales_summaries')
    .select('*')
    .eq('date', date)
    .maybeSingle();
  throwIfError(error, 'Failed to fetch daily summary');
  return data ? mapSummary(data as SummaryRow) : null;
}

export async function upsertDailySummary(input: {
  date: string;
  totalSales: number;
  totalOrders: number;
  itemsSold: number;
  averageOrder: number;
  cashSales: number;
  telebirrSales: number;
  cardSales: number;
  otherSales: number;
  isClosed: boolean;
}) {
  const { data, error } = await getAdminClient()
    .from('daily_sales_summaries')
    .upsert(
      {
        date: input.date,
        total_sales: input.totalSales,
        total_orders: input.totalOrders,
        items_sold: input.itemsSold,
        average_order: input.averageOrder,
        cash_sales: input.cashSales,
        telebirr_sales: input.telebirrSales,
        card_sales: input.cardSales,
        other_sales: input.otherSales,
        is_closed: input.isClosed,
        closed_at: new Date().toISOString(),
      },
      { onConflict: 'date' }
    )
    .select()
    .single();
  throwIfError(error, 'Failed to close daily sales');
  return mapSummary(data as SummaryRow);
}

export async function listProfiles() {
  const { data, error } = await getAdminClient()
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });
  throwIfError(error, 'Failed to load users');
  return ((data || []) as ProfileRow[]).map(mapProfile);
}

export async function getProfile(id: string) {
  const { data, error } = await getAdminClient()
    .from('profiles')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  throwIfError(error, 'Failed to load profile');
  return data ? mapProfile(data as ProfileRow) : null;
}

export async function insertProfile(input: {
  id: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  role: string;
  disabled?: boolean;
}) {
  const now = new Date().toISOString();
  const { data, error } = await getAdminClient()
    .from('profiles')
    .insert({
      id: input.id,
      email: input.email,
      display_name: input.displayName,
      photo_url: input.photoURL,
      role: input.role,
      disabled: input.disabled ?? false,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();
  throwIfError(error, 'Failed to create profile');
  return mapProfile(data as ProfileRow);
}

export async function updateProfile(
  id: string,
  input: {
    email?: string | null;
    displayName?: string | null;
    photoURL?: string | null;
    role?: string;
    disabled?: boolean;
    lastSeenAt?: string;
    approvedBy?: string | null;
    approvedAt?: string | null;
  }
) {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.email !== undefined) patch.email = input.email;
  if (input.displayName !== undefined) patch.display_name = input.displayName;
  if (input.photoURL !== undefined) patch.photo_url = input.photoURL;
  if (input.role !== undefined) patch.role = input.role;
  if (input.disabled !== undefined) patch.disabled = input.disabled;
  if (input.lastSeenAt !== undefined) patch.last_seen_at = input.lastSeenAt;
  if (input.approvedBy !== undefined) patch.approved_by = input.approvedBy;
  if (input.approvedAt !== undefined) patch.approved_at = input.approvedAt;

  const { data, error } = await getAdminClient()
    .from('profiles')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  throwIfError(error, 'Failed to update profile');
  return mapProfile(data as ProfileRow);
}

export async function deleteProfile(id: string) {
  const { error } = await getAdminClient().from('profiles').delete().eq('id', id);
  throwIfError(error, 'Failed to delete profile');
}

export async function countActiveAdmins() {
  const { count, error } = await getAdminClient()
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'admin')
    .eq('disabled', false);
  throwIfError(error, 'Failed to count admins');
  return count ?? 0;
}

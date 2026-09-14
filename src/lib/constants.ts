export const DEFAULT_FALLBACK_IMAGES: Record<string, string> = {
  coffee: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=800&q=80',
  tea: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=800&q=80',
  water: 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?auto=format&fit=crop&w=800&q=80',
  general: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=800&q=80',
};

export function getCategoryFallbackImage(categoryName?: string): string {
  if (!categoryName) return DEFAULT_FALLBACK_IMAGES.general;
  const name = categoryName.toLowerCase();
  if (name.includes('coffee')) return DEFAULT_FALLBACK_IMAGES.coffee;
  if (name.includes('tea') || name.includes('drink')) return DEFAULT_FALLBACK_IMAGES.tea;
  if (name.includes('water')) return DEFAULT_FALLBACK_IMAGES.water;
  return DEFAULT_FALLBACK_IMAGES.general;
}

export const ITEM_IMAGE_MAP: Record<string, string> = {
  'Special Tea': 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=800&q=80',
  'Wetet Belewiz': 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=800&q=80',
  'Fruit Tea': 'https://images.unsplash.com/photo-1597481499750-3e6b22637e12?auto=format&fit=crop&w=800&q=80',
  'Lewiz Tea': 'https://images.unsplash.com/photo-1561047029-3000c68339ca?auto=format&fit=crop&w=800&q=80',
  'Milk': 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=800&q=80',
  'Tea': 'https://images.unsplash.com/photo-1594631252845-29fc4cc86de5?auto=format&fit=crop&w=800&q=80',
  'Macchiato': 'https://images.unsplash.com/photo-1485808191679-5f86510681a2?auto=format&fit=crop&w=800&q=80',
  'Espresso': 'https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?auto=format&fit=crop&w=800&q=80',
  'Coffee': 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=800&q=80',
  '1/2 Liter': 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?auto=format&fit=crop&w=800&q=80',
  '1 Liter': 'https://images.unsplash.com/photo-1560023907-5f339617ea30?auto=format&fit=crop&w=800&q=80',
  '2 Liter': 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=800&q=80',
};

export const PRESET_BEVERAGE_IMAGES = [
  { name: 'Special Tea', category: 'Tea & Hot Drinks', url: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=800&q=80' },
  { name: 'Wetet Belewiz', category: 'Tea & Hot Drinks', url: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=800&q=80' },
  { name: 'Fruit Tea', category: 'Tea & Hot Drinks', url: 'https://images.unsplash.com/photo-1597481499750-3e6b22637e12?auto=format&fit=crop&w=800&q=80' },
  { name: 'Lewiz Tea', category: 'Tea & Hot Drinks', url: 'https://images.unsplash.com/photo-1561047029-3000c68339ca?auto=format&fit=crop&w=800&q=80' },
  { name: 'Fresh Milk', category: 'Tea & Hot Drinks', url: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=800&q=80' },
  { name: 'Classic Black Tea', category: 'Tea & Hot Drinks', url: 'https://images.unsplash.com/photo-1594631252845-29fc4cc86de5?auto=format&fit=crop&w=800&q=80' },
  { name: 'Macchiato', category: 'Coffee', url: 'https://images.unsplash.com/photo-1485808191679-5f86510681a2?auto=format&fit=crop&w=800&q=80' },
  { name: 'Espresso Shot', category: 'Coffee', url: 'https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?auto=format&fit=crop&w=800&q=80' },
  { name: 'Fresh Coffee', category: 'Coffee', url: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=800&q=80' },
  { name: 'Bottled Water', category: 'Water', url: 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?auto=format&fit=crop&w=800&q=80' },
];

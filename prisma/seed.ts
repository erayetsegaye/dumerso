import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Dumerso Coffee database...');

  // 1. Seed Settings
  await prisma.settings.upsert({
    where: { id: 'default' },
    update: {
      cafeName: 'Dumerso Coffee',
      logoUrl: '/logo.jpg',
      description: 'Freshly brewed. Made with care.',
      tagline: 'Scan. Browse. Enjoy.',
      phone: '+251 913 961 921',
      location: 'Gombora Taxi Mazoriya',
      openingHours: 'Mon - Sun: 7:00 AM - 10:00 PM',
    },
    create: {
      id: 'default',
      cafeName: 'Dumerso Coffee',
      logoUrl: '/logo.jpg',
      description: 'Freshly brewed. Made with care.',
      tagline: 'Scan. Browse. Enjoy.',
      phone: '+251 913 961 921',
      location: 'Gombora Taxi Mazoriya',
      openingHours: 'Mon - Sun: 7:00 AM - 10:00 PM',
    },
  });

  // 2. Seed Admin User
  const hashedPassword = await bcrypt.hash('dumerso123', 10);
  await prisma.adminUser.upsert({
    where: { username: 'admin' },
    update: { password: hashedPassword },
    create: {
      username: 'admin',
      password: hashedPassword,
    },
  });

  // 3. Seed Categories & Items matching reference image
  const categoriesData = [
    {
      name: 'Tea & Hot Drinks',
      icon: '🍃',
      order: 1,
      items: [
        {
          name: 'Special Tea',
          price: 85,
          description: 'Special house tea.',
          imageUrl: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=800&q=80',
          isSpecial: true,
          isPopular: true,
          order: 1,
        },
        {
          name: 'Wetet Belewiz',
          price: 75,
          description: 'Milk and peanut.',
          imageUrl: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=800&q=80',
          isSpecial: true,
          isPopular: true,
          order: 2,
        },
        {
          name: 'Fruit Tea',
          price: 65,
          description: 'Fruit tea.',
          imageUrl: 'https://images.unsplash.com/photo-1597481499750-3e6b22637e12?auto=format&fit=crop&w=800&q=80',
          isSpecial: false,
          isPopular: true,
          order: 3,
        },
        {
          name: 'Lewiz Tea',
          price: 65,
          description: 'Peanut tea.',
          imageUrl: 'https://images.unsplash.com/photo-1561047029-3000c68339ca?auto=format&fit=crop&w=800&q=80',
          isSpecial: false,
          isPopular: false,
          order: 4,
        },
        {
          name: 'Milk',
          price: 55,
          description: 'Milk',
          imageUrl: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=800&q=80',
          isSpecial: false,
          isPopular: false,
          order: 5,
        },
        {
          name: 'Tea',
          price: 25,
          description: 'Tea',
          imageUrl: 'https://images.unsplash.com/photo-1594631252845-29fc4cc86de5?auto=format&fit=crop&w=800&q=80',
          isSpecial: false,
          isPopular: false,
          order: 6,
        },
      ],
    },
    {
      name: 'Coffee',
      icon: '☕',
      order: 2,
      items: [
        {
          name: 'Macchiato',
          price: 50,
          description: 'Rich espresso with milk foam.',
          imageUrl: 'https://images.unsplash.com/photo-1485808191679-5f86510681a2?auto=format&fit=crop&w=800&q=80',
          isSpecial: true,
          isPopular: true,
          order: 1,
        },
        {
          name: 'Espresso',
          price: 35,
          description: 'Pure concentrated espresso shot.',
          imageUrl: 'https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?auto=format&fit=crop&w=800&q=80',
          isSpecial: false,
          isPopular: true,
          order: 2,
        },
        {
          name: 'Coffee',
          price: 35,
          description: 'Freshly brewed black coffee.',
          imageUrl: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=800&q=80',
          isSpecial: false,
          isPopular: true,
          order: 3,
        },
      ],
    },
    {
      name: 'Water',
      icon: '💧',
      order: 3,
      items: [
        {
          name: '1/2 Liter',
          price: 35,
          description: 'Purified drinking water (500ml).',
          imageUrl: 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?auto=format&fit=crop&w=800&q=80',
          isSpecial: false,
          isPopular: false,
          order: 1,
        },
        {
          name: '1 Liter',
          price: 50,
          description: 'Purified drinking water (1000ml).',
          imageUrl: 'https://images.unsplash.com/photo-1560023907-5f339617ea30?auto=format&fit=crop&w=800&q=80',
          isSpecial: false,
          isPopular: false,
          order: 2,
        },
        {
          name: '2 Liter',
          price: 60,
          description: 'Purified drinking water (2000ml).',
          imageUrl: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=800&q=80',
          isSpecial: false,
          isPopular: false,
          order: 3,
        },
      ],
    },
  ];

  for (const cat of categoriesData) {
    let category = await prisma.category.findUnique({
      where: { name: cat.name },
    });

    if (!category) {
      category = await prisma.category.create({
        data: {
          name: cat.name,
          icon: cat.icon,
          order: cat.order,
        },
      });
    }

    for (const item of cat.items) {
      const existing = await prisma.menuItem.findFirst({
        where: { name: item.name, categoryId: category.id },
      });

      if (!existing) {
        await prisma.menuItem.create({
          data: {
            name: item.name,
            categoryId: category.id,
            price: item.price,
            description: item.description,
            imageUrl: item.imageUrl,
            isSpecial: item.isSpecial,
            isPopular: item.isPopular,
            order: item.order,
            isAvailable: true,
          },
        });
      }
    }
  }

  // 4. Seed Initial Activity Logs
  const initialActivities = [
    { action: 'Added new item: Espresso', details: 'Added to Coffee category', type: 'add' },
    { action: 'Updated item: Fruit Tea', details: 'Updated price to 65 ETB', type: 'update' },
    { action: 'Deleted item: Green Tea', details: 'Removed from menu', type: 'delete' },
    { action: 'Added new item: 2 Liter Water', details: 'Added to Water category', type: 'add' },
  ];

  for (const act of initialActivities) {
    const count = await prisma.activityLog.count({ where: { action: act.action } });
    if (count === 0) {
      await prisma.activityLog.create({
        data: act,
      });
    }
  }

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

require("dotenv").config();

const bcrypt = require("bcryptjs");
const { randomUUID } = require("crypto");
const prisma = require("../src/db");
const config = require("../src/config");
const { ensureUniqueRestaurantSlug } = require("../src/utils/slugs");

const DEFAULT_PLANS = [
  {
    code: "STARTER",
    displayName: "Starter",
    monthlyPrice: 29,
    description: "Small cafe setup with basic employee management."
  },
  {
    code: "GROWTH",
    displayName: "Growth",
    monthlyPrice: 79,
    description: "Best for active restaurants with multiple teams."
  },
  {
    code: "PREMIUM",
    displayName: "Premium",
    monthlyPrice: 149,
    description: "Advanced tier for larger operations and scaling."
  }
];

const DEFAULT_OPENING_HOURS = [
  { dayOfWeek: 0, openTime: "10:00", closeTime: "23:30", isClosed: false },
  { dayOfWeek: 1, openTime: "10:00", closeTime: "23:30", isClosed: false },
  { dayOfWeek: 2, openTime: "10:00", closeTime: "23:30", isClosed: false },
  { dayOfWeek: 3, openTime: "10:00", closeTime: "23:30", isClosed: false },
  { dayOfWeek: 4, openTime: "10:00", closeTime: "23:59", isClosed: false },
  { dayOfWeek: 5, openTime: "10:00", closeTime: "23:59", isClosed: false },
  { dayOfWeek: 6, openTime: "10:00", closeTime: "23:30", isClosed: false }
];

const ONLINE_ORDER_SAMPLE_RESTAURANTS = [
  {
    name: "CROT Burger House",
    slug: "crot-burger-house",
    description: "Fresh burgers, crispy fries, and fast delivery.",
    phone: "+1 555 100 1000",
    city: "Istanbul",
    district: "Besiktas",
    addressText: "Barbaros Bulvari No: 120, Besiktas",
    latitude: 41.043174,
    longitude: 29.006956,
    minimumOrderAmount: 150,
    baseDeliveryFee: 18,
    feePerKm: 4.5,
    freeDeliveryThreshold: 350,
    estimatedDeliveryMinutes: 35,
    deliveryRadiusKm: 4,
    cuisineType: "Burger",
    logoUrl: "https://images.unsplash.com/photo-1586816001966-79b736744398?w=320",
    coverImageUrl: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=1200",
    categories: [
      {
        name: "Burger",
        sortOrder: 1,
        products: [
          {
            name: "Classic Burger",
            description: "Beef patty, cheddar, lettuce, tomato, pickles.",
            price: 220,
            preparationMinutes: 18,
            sortOrder: 1
          },
          {
            name: "BBQ Burger",
            description: "Smoked BBQ sauce, onion rings, cheddar.",
            price: 260,
            preparationMinutes: 20,
            sortOrder: 2
          }
        ]
      },
      {
        name: "Sides",
        sortOrder: 2,
        products: [
          {
            name: "French Fries",
            description: "Crispy golden fries.",
            price: 90,
            preparationMinutes: 8,
            sortOrder: 1
          },
          {
            name: "Onion Rings",
            description: "Crunchy onion rings with house dip.",
            price: 110,
            preparationMinutes: 10,
            sortOrder: 2
          }
        ]
      }
    ]
  },
  {
    name: "CROT Pizza Point",
    slug: "crot-pizza-point",
    description: "Wood-fired pizza and fresh pasta.",
    phone: "+1 555 200 2000",
    city: "Istanbul",
    district: "Kadikoy",
    addressText: "Rasimpasa Mah. Misaki Milli Sok. No: 14, Kadikoy",
    latitude: 40.991179,
    longitude: 29.028297,
    minimumOrderAmount: 180,
    baseDeliveryFee: 22,
    feePerKm: 4.8,
    freeDeliveryThreshold: 400,
    estimatedDeliveryMinutes: 40,
    deliveryRadiusKm: 6,
    cuisineType: "Pizza & Italyan",
    logoUrl: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=320",
    coverImageUrl: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=1200",
    categories: [
      {
        name: "Pizza",
        sortOrder: 1,
        products: [
          {
            name: "Margherita",
            description: "Mozzarella, tomato sauce, basil.",
            price: 240,
            preparationMinutes: 22,
            sortOrder: 1
          },
          {
            name: "Pepperoni Pizza",
            description: "Pepperoni, mozzarella, tomato sauce.",
            price: 290,
            preparationMinutes: 24,
            sortOrder: 2
          }
        ]
      },
      {
        name: "Pasta",
        sortOrder: 2,
        products: [
          {
            name: "Spaghetti Bolognese",
            description: "Beef ragu with parmesan.",
            price: 250,
            preparationMinutes: 18,
            sortOrder: 1
          },
          {
            name: "Penne Alfredo",
            description: "Creamy alfredo sauce and mushrooms.",
            price: 245,
            preparationMinutes: 17,
            sortOrder: 2
          }
        ]
      }
    ]
  },
  {
    name: "CROT Anatolian Kebap",
    slug: "crot-anatolian-kebap",
    description: "Charcoal grilled kebap and mezze selections.",
    phone: "+1 555 300 3000",
    city: "Istanbul",
    district: "Sisli",
    addressText: "Halaskargazi Cad. No: 210, Sisli",
    latitude: 41.060805,
    longitude: 28.987673,
    minimumOrderAmount: 200,
    baseDeliveryFee: 25,
    feePerKm: 5.2,
    freeDeliveryThreshold: 450,
    estimatedDeliveryMinutes: 45,
    deliveryRadiusKm: 3.5,
    cuisineType: "Kebap",
    logoUrl: "https://images.unsplash.com/photo-1544025162-d76694265947?w=320",
    coverImageUrl: "https://images.unsplash.com/photo-1544025162-d76694265947?w=1200",
    categories: [
      {
        name: "Kebap",
        sortOrder: 1,
        products: [
          {
            name: "Adana Kebap",
            description: "Spiced minced lamb kebap with lavash.",
            price: 310,
            preparationMinutes: 25,
            sortOrder: 1
          },
          {
            name: "Urfa Kebap",
            description: "Mild seasoned kebap with grilled peppers.",
            price: 305,
            preparationMinutes: 24,
            sortOrder: 2
          }
        ]
      },
      {
        name: "Mezze",
        sortOrder: 2,
        products: [
          {
            name: "Haydari",
            description: "Strained yogurt mezze with dill and garlic.",
            price: 95,
            preparationMinutes: 7,
            sortOrder: 1
          },
          {
            name: "Ezme",
            description: "Spicy tomato and pepper mezze.",
            price: 90,
            preparationMinutes: 7,
            sortOrder: 2
          }
        ]
      }
    ]
  },
  {
    name: "CROT Sushi Lab",
    slug: "crot-sushi-lab",
    description: "Modern sushi bowls and fresh rolls.",
    phone: "+1 555 400 4000",
    city: "Istanbul",
    district: "Beyoglu",
    addressText: "Cihangir Mah. Defterdar Yokusu No: 32, Beyoglu",
    latitude: 41.033218,
    longitude: 28.985507,
    minimumOrderAmount: 260,
    baseDeliveryFee: 28,
    feePerKm: 6.4,
    freeDeliveryThreshold: 600,
    estimatedDeliveryMinutes: 38,
    deliveryRadiusKm: 4.5,
    cuisineType: "Uzak Dogu",
    logoUrl: "https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=320",
    coverImageUrl: "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=1200",
    categories: [
      {
        name: "Roll",
        sortOrder: 1,
        products: [
          {
            name: "Salmon Roll",
            description: "Fresh salmon, avocado and cucumber roll.",
            price: 285,
            preparationMinutes: 20,
            sortOrder: 1
          },
          {
            name: "Crispy Shrimp Roll",
            description: "Tempura shrimp roll with spicy mayo.",
            price: 305,
            preparationMinutes: 22,
            sortOrder: 2
          }
        ]
      },
      {
        name: "Bowl",
        sortOrder: 2,
        products: [
          {
            name: "Poke Bowl",
            description: "Rice, salmon cubes, edamame and sesame.",
            price: 295,
            preparationMinutes: 16,
            sortOrder: 1
          }
        ]
      }
    ]
  },
  {
    name: "CROT Vegan Kitchen",
    slug: "crot-vegan-kitchen",
    description: "Plant-based comfort food and healthy bowls.",
    phone: "+1 555 500 5000",
    city: "Istanbul",
    district: "Uskudar",
    addressText: "Mimar Sinan Mah. Selmanaga Cad. No: 44, Uskudar",
    latitude: 41.023815,
    longitude: 29.015431,
    minimumOrderAmount: 170,
    baseDeliveryFee: 16,
    feePerKm: 3.9,
    freeDeliveryThreshold: 320,
    estimatedDeliveryMinutes: 32,
    deliveryRadiusKm: 5.2,
    cuisineType: "Vegan",
    logoUrl: "https://images.unsplash.com/photo-1543339494-b4cd4f7ba686?w=320",
    coverImageUrl: "https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=1200",
    categories: [
      {
        name: "Bowl",
        sortOrder: 1,
        products: [
          {
            name: "Falafel Bowl",
            description: "Falafel, quinoa, greens and tahini sauce.",
            price: 190,
            preparationMinutes: 15,
            sortOrder: 1
          }
        ]
      },
      {
        name: "Burger",
        sortOrder: 2,
        products: [
          {
            name: "Vegan Burger",
            description: "House plant patty with caramelized onion.",
            price: 210,
            preparationMinutes: 17,
            sortOrder: 1
          }
        ]
      }
    ]
  }
];

async function seedPlans() {
  for (const plan of DEFAULT_PLANS) {
    await prisma.plan.upsert({
      where: { code: plan.code },
      update: {
        displayName: plan.displayName,
        monthlyPrice: plan.monthlyPrice,
        description: plan.description
      },
      create: plan
    });
  }
}

async function seedSuperAdmin() {
  const email = config.superAdminEmail;
  const password = config.superAdminPassword;

  if (!email || !password) {
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.upsert({
    where: { email },
    update: {
      fullName: config.superAdminName,
      passwordHash,
      systemRole: "SUPER_ADMIN",
      restaurantId: null,
      employeeRole: null
    },
    create: {
      fullName: config.superAdminName,
      email,
      passwordHash,
      systemRole: "SUPER_ADMIN"
    }
  });
}

async function backfillRestaurantSlugs() {
  const restaurants = await prisma.restaurant.findMany({
    where: {
      slug: null
    },
    orderBy: {
      createdAt: "asc"
    }
  });

  for (const restaurant of restaurants) {
    const slug = await ensureUniqueRestaurantSlug(prisma, restaurant.name || restaurant.id, restaurant.id);
    await prisma.restaurant.update({
      where: {
        id: restaurant.id
      },
      data: {
        slug
      }
    });
  }
}

async function backfillOrderPublicIds() {
  const orders = await prisma.order.findMany({
    where: {
      publicId: null
    },
    select: {
      id: true
    }
  });

  for (const order of orders) {
    await prisma.order.update({
      where: {
        id: order.id
      },
      data: {
        publicId: randomUUID().replace(/-/g, "")
      }
    });
  }
}

async function backfillOrderItemRestaurantIds() {
  const orderItems = await prisma.orderItem.findMany({
    where: {
      restaurantId: null
    },
    select: {
      id: true,
      order: {
        select: {
          restaurantId: true
        }
      }
    }
  });

  for (const orderItem of orderItems) {
    if (!orderItem.order?.restaurantId) {
      continue;
    }

    await prisma.orderItem.update({
      where: {
        id: orderItem.id
      },
      data: {
        restaurantId: orderItem.order.restaurantId
      }
    });
  }
}

async function seedRestaurantOpeningHours(restaurantId) {
  await prisma.restaurantOpeningHour.deleteMany({
    where: {
      restaurantId
    }
  });

  await prisma.restaurantOpeningHour.createMany({
    data: DEFAULT_OPENING_HOURS.map((slot) => ({
      restaurantId,
      dayOfWeek: slot.dayOfWeek,
      openTime: slot.openTime,
      closeTime: slot.closeTime,
      isClosed: slot.isClosed
    }))
  });
}

async function seedOnlineOrderingSamples() {
  for (const sampleRestaurant of ONLINE_ORDER_SAMPLE_RESTAURANTS) {
    const restaurant = await prisma.restaurant.upsert({
      where: {
        slug: sampleRestaurant.slug
      },
      update: {
        name: sampleRestaurant.name,
        description: sampleRestaurant.description,
        cuisineType: sampleRestaurant.cuisineType,
        phone: sampleRestaurant.phone,
        city: sampleRestaurant.city,
        district: sampleRestaurant.district,
        address: sampleRestaurant.addressText,
        addressText: sampleRestaurant.addressText,
        latitude: sampleRestaurant.latitude,
        longitude: sampleRestaurant.longitude,
        logoUrl: sampleRestaurant.logoUrl,
        coverImageUrl: sampleRestaurant.coverImageUrl,
        isOpen: true,
        onlineOrderingEnabled: true,
        isOnlineOrderingEnabled: true,
        publicOrderingEnabled: true,
        pickupEnabled: true,
        deliveryEnabled: true,
        minimumOrderAmount: sampleRestaurant.minimumOrderAmount,
        minOrderAmount: sampleRestaurant.minimumOrderAmount,
        baseDeliveryFee: sampleRestaurant.baseDeliveryFee,
        feePerKm: sampleRestaurant.feePerKm,
        deliveryFee: sampleRestaurant.baseDeliveryFee,
        freeDeliveryThreshold: sampleRestaurant.freeDeliveryThreshold,
        estimatedDeliveryMinutes: sampleRestaurant.estimatedDeliveryMinutes,
        deliveryRadiusKm: sampleRestaurant.deliveryRadiusKm,
        ratingAverage: 4.3,
        ratingCount: 120
      },
      create: {
        name: sampleRestaurant.name,
        slug: sampleRestaurant.slug,
        description: sampleRestaurant.description,
        cuisineType: sampleRestaurant.cuisineType,
        phone: sampleRestaurant.phone,
        city: sampleRestaurant.city,
        district: sampleRestaurant.district,
        address: sampleRestaurant.addressText,
        addressText: sampleRestaurant.addressText,
        latitude: sampleRestaurant.latitude,
        longitude: sampleRestaurant.longitude,
        logoUrl: sampleRestaurant.logoUrl,
        coverImageUrl: sampleRestaurant.coverImageUrl,
        isOpen: true,
        onlineOrderingEnabled: true,
        isOnlineOrderingEnabled: true,
        publicOrderingEnabled: true,
        pickupEnabled: true,
        deliveryEnabled: true,
        minimumOrderAmount: sampleRestaurant.minimumOrderAmount,
        minOrderAmount: sampleRestaurant.minimumOrderAmount,
        baseDeliveryFee: sampleRestaurant.baseDeliveryFee,
        feePerKm: sampleRestaurant.feePerKm,
        deliveryFee: sampleRestaurant.baseDeliveryFee,
        freeDeliveryThreshold: sampleRestaurant.freeDeliveryThreshold,
        estimatedDeliveryMinutes: sampleRestaurant.estimatedDeliveryMinutes,
        deliveryRadiusKm: sampleRestaurant.deliveryRadiusKm,
        ratingAverage: 4.3,
        ratingCount: 120
      }
    });

    await seedRestaurantOpeningHours(restaurant.id);

    for (const categoryData of sampleRestaurant.categories) {
      const category = await prisma.category.upsert({
        where: {
          restaurantId_name: {
            restaurantId: restaurant.id,
            name: categoryData.name
          }
        },
        update: {
          sortOrder: categoryData.sortOrder,
          isActive: true
        },
        create: {
          restaurantId: restaurant.id,
          name: categoryData.name,
          sortOrder: categoryData.sortOrder,
          isActive: true
        }
      });

      for (const productData of categoryData.products) {
        await prisma.product.upsert({
          where: {
            restaurantId_name: {
              restaurantId: restaurant.id,
              name: productData.name
            }
          },
          update: {
            categoryId: category.id,
            description: productData.description,
            price: productData.price,
            imageUrl: null,
            isAvailable: true,
            preparationMinutes: productData.preparationMinutes,
            sortOrder: productData.sortOrder
          },
          create: {
            restaurantId: restaurant.id,
            categoryId: category.id,
            name: productData.name,
            description: productData.description,
            price: productData.price,
            imageUrl: null,
            isAvailable: true,
            preparationMinutes: productData.preparationMinutes,
            sortOrder: productData.sortOrder
          }
        });

        await prisma.menuItem.upsert({
          where: {
            restaurantId_name: {
              restaurantId: restaurant.id,
              name: productData.name
            }
          },
          update: {
            category: categoryData.name,
            description: productData.description,
            priceCents: Math.round(productData.price * 100),
            stock: 120,
            isAvailable: true
          },
          create: {
            restaurantId: restaurant.id,
            name: productData.name,
            category: categoryData.name,
            description: productData.description,
            priceCents: Math.round(productData.price * 100),
            stock: 120,
            isAvailable: true
          }
        });
      }
    }
  }
}

async function main() {
  await seedPlans();
  await seedSuperAdmin();
  await seedOnlineOrderingSamples();
  await backfillRestaurantSlugs();
  await backfillOrderPublicIds();
  await backfillOrderItemRestaurantIds();
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log("Seed completed.");
  })
  .catch(async (error) => {
    await prisma.$disconnect();
    console.error("Seed failed:", error);
    process.exit(1);
  });

const express = require("express");
const prisma = require("../db");
const { listMenuItems } = require("../utils/menu");

const router = express.Router();

function mapPublicRestaurant(restaurant) {
  return {
    id: restaurant.id,
    name: restaurant.name,
    slug: restaurant.slug,
    description: restaurant.description || null,
    city: restaurant.city || null,
    district: restaurant.district || null,
    address: restaurant.address || null,
    phone: restaurant.phone || null,
    logoUrl: restaurant.logoUrl || null,
    minOrderAmount: Number(restaurant.minOrderAmount || 0),
    deliveryFee: Number(restaurant.deliveryFee || 0),
    isOpen: Boolean(restaurant.isOpen),
    onlineOrderingEnabled: Boolean(restaurant.onlineOrderingEnabled),
    deliveryEnabled: Boolean(restaurant.deliveryEnabled),
    pickupEnabled: Boolean(restaurant.pickupEnabled)
  };
}

function mapPublicProduct(product) {
  return {
    id: product.id,
    name: product.name,
    description: product.description || null,
    price: Number(product.price || 0),
    priceCents: Number(product.priceCents || 0),
    stock: Number(product.stock || 0),
    isAvailable: Boolean(product.isAvailable),
    isOrderable: Boolean(product.isOrderable),
    availabilityText: product.availabilityText || null,
    photoUrl: product.photoUrl || null
  };
}

router.get("/restaurants", async (req, res) => {
  try {
    const restaurants = await prisma.restaurant.findMany({
      where: {
        onlineOrderingEnabled: true,
        isOpen: true
      },
      orderBy: [{ createdAt: "desc" }]
    });

    return res.status(200).json({
      success: true,
      data: {
        restaurants: restaurants.map(mapPublicRestaurant)
      }
    });
  } catch (error) {
    console.error("GET /api/public/restaurants failed:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error."
    });
  }
});

router.get("/restaurants/:slug", async (req, res) => {
  try {
    const slug = String(req.params.slug || "").trim().toLowerCase();
    if (!slug) {
      return res.status(400).json({
        success: false,
        message: "Restaurant slug is required."
      });
    }

    const restaurant = await prisma.restaurant.findFirst({
      where: {
        slug,
        onlineOrderingEnabled: true,
        isOpen: true
      }
    });

    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: "Restaurant not found."
      });
    }

    const products = await listMenuItems(prisma, restaurant.id, {
      includeUnavailable: true
    });

    const categoriesMap = new Map();
    for (const product of products) {
      const categoryName = String(product.category || "General").trim() || "General";
      if (!categoriesMap.has(categoryName)) {
        categoriesMap.set(categoryName, {
          id: categoryName.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
          name: categoryName,
          products: []
        });
      }

      categoriesMap.get(categoryName).products.push(mapPublicProduct(product));
    }

    return res.status(200).json({
      success: true,
      data: {
        restaurant: mapPublicRestaurant(restaurant),
        categories: [...categoriesMap.values()]
      }
    });
  } catch (error) {
    console.error("GET /api/public/restaurants/:slug failed:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error."
    });
  }
});

module.exports = router;

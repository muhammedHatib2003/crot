const ONLINE_CART_STORAGE_KEY = "crot_online_order_cart";

function normalizeItem(item) {
  const productId = String(item?.productId || "").trim();
  const quantity = Number(item?.quantity);
  const price = Number(item?.price || 0);
  const name = String(item?.name || "").trim();

  if (!productId || !name || !Number.isFinite(price) || price < 0 || !Number.isInteger(quantity) || quantity < 1) {
    return null;
  }

  return {
    productId,
    name,
    price,
    quantity
  };
}

function normalizeRestaurant(restaurant) {
  if (!restaurant?.id) {
    return null;
  }

  const minimumOrderAmount =
    restaurant.minimumOrderAmount !== undefined
      ? Number(restaurant.minimumOrderAmount || 0)
      : Number(restaurant.minOrderAmount || 0);

  return {
    id: String(restaurant.id),
    slug: String(restaurant.slug || ""),
    name: String(restaurant.name || ""),
    deliveryFee: Number(restaurant.deliveryFee || 0),
    minimumOrderAmount,
    minOrderAmount: minimumOrderAmount,
    freeDeliveryThreshold:
      restaurant.freeDeliveryThreshold === undefined || restaurant.freeDeliveryThreshold === null
        ? null
        : Number(restaurant.freeDeliveryThreshold),
    estimatedDeliveryMinutes: Number(restaurant.estimatedDeliveryMinutes || 0)
  };
}

function normalizeCart(rawCart) {
  const restaurant = normalizeRestaurant(rawCart?.restaurant);
  const items = (Array.isArray(rawCart?.items) ? rawCart.items : []).map(normalizeItem).filter(Boolean);

  if (!restaurant || items.length === 0) {
    return {
      restaurant: null,
      items: []
    };
  }

  return {
    restaurant,
    items
  };
}

export function readOnlineCart() {
  try {
    const parsed = JSON.parse(localStorage.getItem(ONLINE_CART_STORAGE_KEY) || "null");
    return normalizeCart(parsed);
  } catch (error) {
    return {
      restaurant: null,
      items: []
    };
  }
}

export function writeOnlineCart(cart) {
  const normalized = normalizeCart(cart);
  localStorage.setItem(ONLINE_CART_STORAGE_KEY, JSON.stringify(normalized));
  window.dispatchEvent(new Event("online-order-cart-updated"));
  return normalized;
}

export function clearOnlineCart() {
  return writeOnlineCart({
    restaurant: null,
    items: []
  });
}

export function addToOnlineCart(cart, restaurant, product, quantity = 1) {
  const normalizedCart = normalizeCart(cart);
  const normalizedRestaurant = normalizeRestaurant(restaurant);
  const normalizedQuantity = Number(quantity);
  const productId = String(product?.id || product?.productId || "").trim();

  if (!normalizedRestaurant || !productId || !Number.isInteger(normalizedQuantity) || normalizedQuantity < 1) {
    return normalizedCart;
  }

  const productName = String(product?.name || "").trim();
  const productPrice = Number(product?.price || 0);
  if (!productName || !Number.isFinite(productPrice) || productPrice < 0) {
    return normalizedCart;
  }

  if (normalizedCart.restaurant?.id && normalizedCart.restaurant.id !== normalizedRestaurant.id) {
    return {
      ...normalizedCart,
      conflictRestaurant: normalizedCart.restaurant
    };
  }

  const currentItems = [...(normalizedCart.items || [])];
  const existingIndex = currentItems.findIndex((item) => item.productId === productId);
  if (existingIndex >= 0) {
    currentItems[existingIndex] = {
      ...currentItems[existingIndex],
      quantity: currentItems[existingIndex].quantity + normalizedQuantity
    };
  } else {
    currentItems.push({
      productId,
      name: productName,
      price: productPrice,
      quantity: normalizedQuantity
    });
  }

  return {
    restaurant: normalizedRestaurant,
    items: currentItems
  };
}

export function updateOnlineCartItemQuantity(cart, productId, quantity) {
  const normalizedCart = normalizeCart(cart);
  const normalizedProductId = String(productId || "").trim();
  const normalizedQuantity = Number(quantity);

  if (!normalizedProductId) {
    return normalizedCart;
  }

  const nextItems = normalizedCart.items
    .map((item) => {
      if (item.productId !== normalizedProductId) {
        return item;
      }

      if (!Number.isInteger(normalizedQuantity) || normalizedQuantity < 1) {
        return null;
      }

      return {
        ...item,
        quantity: normalizedQuantity
      };
    })
    .filter(Boolean);

  if (nextItems.length === 0) {
    return {
      restaurant: null,
      items: []
    };
  }

  return {
    restaurant: normalizedCart.restaurant,
    items: nextItems
  };
}

export function getOnlineCartTotals(cart) {
  const normalizedCart = normalizeCart(cart);
  const subtotal = normalizedCart.items.reduce(
    (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0),
    0
  );
  const deliveryFee = Number(normalizedCart.restaurant?.deliveryFee || 0);
  const total = subtotal + deliveryFee;

  return {
    subtotal,
    deliveryFee,
    total
  };
}

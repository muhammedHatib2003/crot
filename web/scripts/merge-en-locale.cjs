const fs = require("fs");
const path = require("path");

const localesDir = path.join(__dirname, "..", "src", "locales");
const enExisting = JSON.parse(fs.readFileSync(path.join(localesDir, "en", "common.json"), "utf8"));
const trFull = JSON.parse(fs.readFileSync(path.join(localesDir, "tr", "common.json"), "utf8"));

const missingSections = {
  common: {
    loading: {
      menu: "Loading menu...",
      dashboard: "Loading dashboard...",
      orders: "Loading orders...",
      workspace: "Loading workspace...",
      tables: "Loading tables...",
      cashierTables: "Loading cashier tables...",
      recipe: "Loading recipe...",
      menuItems: "Loading menu items..."
    },
    categories: {
      general: "General",
      starter: "Starter",
      main: "Main",
      dessert: "Dessert",
      drink: "Drink"
    },
    orderStatus: {
      pending: "Pending",
      preparing: "Preparing",
      ready: "Ready",
      paid: "Paid",
      cancelled: "Cancelled",
      fulfilled: "Fulfilled",
      rejected: "Rejected",
      accepted: "Accepted",
      completed: "Completed",
      onTheWay: "On the way"
    },
    tableStatus: {
      available: "Available",
      occupied: "Occupied",
      reserved: "Reserved",
      cleaning: "Cleaning"
    },
    employeeRole: {
      chef: "Chef",
      cashier: "Cashier",
      waiter: "Waiter",
      inventory_manager: "Inventory manager"
    },
    systemRole: {
      super_admin: "Super admin",
      owner: "Owner",
      employee: "Employee"
    },
    units: {
      pcs: "Pieces",
      kg: "Kilogram",
      g: "Gram",
      l: "Liter",
      ml: "Milliliter"
    },
    paymentMethod: {
      card: "Card",
      cash: "Cash"
    },
    time: {
      justNow: "Just now",
      minuteAgo: "{{count}} min ago",
      minutesAgo: "{{count}} min ago",
      hourAgo: "{{count}} hr ago",
      hoursAgo: "{{count}} hr ago",
      lessThanMinute: "< 1 min"
    }
  },
  cashier: {
    title: "Cashier",
    eyebrow: "Role",
    description: "The dining room stays front and center. Tables fill most of the screen and payment details open in a popup.",
    panelTitle: "Tables",
    panelDescription: "Cashier view is dining-room focused. Click any table to open the payment window.",
    dueNow: "Due now",
    tablePayment: "Table payment",
    paymentDescription: "Review the current table and complete payment from this window.",
    readyToPay: "Ready to pay",
    readyOrders: "Ready orders",
    payWithCard: "Pay with card",
    payWithCash: "Pay with cash",
    waiting: "Waiting",
    emptyTable: "This table is empty.",
    tableStillActive: "This table is still active, but there is no dine-in order ready for payment.",
    tabs: {
      payment: "Payment",
      openTable: "Open table / Order"
    },
    openTable: {
      title: "Open table & order",
      description: "Select a table, add items, and send orders to the kitchen.",
      selectTable: "Select a table",
      addItems: "Add items",
      sendOrder: "Send order",
      updateOrder: "Update order",
      clearDraft: "Clear draft",
      noProducts: "No products available.",
      draftEmpty: "Add items to the draft first."
    },
    online: {
      title: "Online orders",
      handedToCourier: "Handed to courier",
      completed: "Completed",
      cancel: "Cancel"
    },
    messages: {
      paymentCompleted: "Payment completed for {{tableName}} via {{method}}.",
      orderSent: "Order sent to kitchen.",
      orderUpdated: "Order updated."
    },
    tableStatus: {
      readyCount: "{{count}} ready",
      activeCount: "{{count}} active",
      empty: "empty"
    }
  },
  waiter: {
    title: "Waiter",
    eyebrow: "Role",
    description: "Tables now fill the screen. Click any table to open the service window and manage orders.",
    tablesTitle: "Tables",
    tablesDescription: "The floor plan takes most of the UI. Click a table to open the order window.",
    service: "Service",
    serviceLaneTitle: "Service lane",
    serviceLaneDescription: "Side panel stays compact so tables remain the main focus.",
    productsLoaded: "Products loaded",
    busy: "Busy",
    ready: "Ready",
    tableService: "Table service",
    tableServiceDescription: "Add products, update the pending order, and close ready tickets from this window.",
    readyOnTable: "Ready on table",
    pendingOrder: "Pending order",
    draftItems: "Draft items",
    activeOrders: "Active orders",
    draftTotal: "Draft total",
    none: "None",
    addProducts: "Add products",
    addProductsDescription: "Tap a product to add it to this table's draft.",
    tapProduct: "Tap a product to add it to this table's draft.",
    productsCount: "{{count}} products",
    leftInStock: "{{count}} left",
    openCount: "{{count}} open",
    activeOrdersDescription: "Ready tickets can be marked as seen by the waiter here.",
    pendingDraft: "Pending draft",
    pendingDraftEdit: "Update or clear the existing pending order.",
    pendingDraftCreate: "Create a new pending order for this table.",
    editing: "Editing",
    newDraft: "New draft",
    pendingTotal: "Pending total",
    createOrder: "Create order",
    updateOrder: "Update order",
    deleteDraft: "Delete draft",
    noActiveOrders: "No active orders on this table.",
    noPendingItems: "No pending items for this table yet.",
    markSeen: "Seen",
    readyTicketSeen: "Ready ticket seen",
    seenAt: "Seen at {{time}}",
    paid: "Paid",
    messages: {
      pendingRemoved: "Pending order removed.",
      addOneItem: "Add at least one item before saving.",
      orderUpdated: "Order updated.",
      orderCreated: "Order created.",
      orderPaid: "{{orderCode}} marked as paid.",
      orderSeen: "{{orderCode}} marked as seen by waiter."
    }
  },
  order: {
    headerEyebrow: "QR table order",
    tableLabel: "Table {{tableName}}",
    currentOrder: "Current order",
    notesPlaceholder: "Notes for this item",
    orderSent: "Order sent.",
    submit: "Place order for {{total}}",
    submitting: "Sending order...",
    noPhoto: "No photo",
    loading: "Loading menu...",
    emptyCart: "Your cart is empty.",
    addToCart: "Add to cart"
  },
  pickup: {
    eyebrow: "Online pickup",
    description: "Order online and pick up at the restaurant when ready.",
    summaryTitle: "Pickup",
    tenantLabel: "Tenant: /{{slug}}",
    latestOrder: "Latest pickup order",
    pickupTime: "Pickup time",
    asap: "As soon as possible",
    browseMenu: "Browse menu",
    chooseItems: "Choose your items",
    browseDescription: "Pickup orders are prepared fresh and appear live in the kitchen.",
    selectedCategory: "Selected",
    itemsCount: "{{count}} items",
    itemsSelected: "{{count}} items selected",
    customerName: "Customer name",
    customerNamePlaceholder: "Your full name",
    customerPhone: "Phone",
    customerPhonePlaceholder: "+90 555 123 45 67",
    orderNotes: "Order notes",
    orderNotesPlaceholder: "Add notes for pickup or kitchen",
    cartTitle: "Pickup cart",
    cartDescription: "Review your items before placing the order.",
    emptyCart: "Your cart is empty.",
    emptyMenu: "No menu yet.",
    defaultDescription: "Freshly prepared pickup item.",
    unavailable: "Unavailable",
    addMore: "Add more",
    addToCart: "Add to cart",
    submit: "Place pickup order for {{total}}",
    submitting: "Sending order...",
    loading: "Loading menu..."
  },
  kitchen: {
    brand: "Kitchen KDS",
    fallbackName: "Kitchen",
    tabs: { orders: "Orders", menu: "Menu" },
    ordersDescription: "Real-time order management and prep tracking",
    menuDescription: "Manage dishes, recipes, and menu items",
    currentTime: "Time",
    allOrders: "All orders",
    dineIn: "Dine-in",
    takeaway: "Takeaway",
    pickup: "Pickup",
    online: "Online",
    pendingOrders: "Pending orders",
    inPreparation: "In preparation",
    createDish: "Create new dish",
    dishName: "Dish name",
    pricePlaceholder: "0.00",
    descriptionPlaceholder: "Describe the dish...",
    photoUrlPlaceholder: "https://...",
    optionalRecipe: "Optional when creating. Add recipe lines now or save the dish and edit later.",
    addIngredient: "+ Add ingredient",
    selectIngredient: "Select ingredient",
    qty: "Qty",
    noIngredientsYet: "No ingredients added yet.",
    createDishButton: "Create dish",
    menuItems: "Menu items",
    noDishesYet: "No dishes yet. Create your first dish above.",
    noImage: "No image",
    noDescription: "No description",
    stockLabel: "Stock: {{count}}",
    ingredientsCount: "{{count}} ingredients",
    noRecipe: "No recipe",
    editDish: "Edit: {{name}}",
    dishDetails: "Dish details",
    photoUrl: "Photo URL",
    availableOnMenu: "Show on menu",
    saveChanges: "Save changes",
    recipe: "Recipe",
    noRecipeYet: "No ingredients yet. Add a few!",
    saveRecipe: "Save recipe",
    working: "Working...",
    loadingOrders: "Loading orders...",
    justNow: "Just now",
    minuteAgo: "{{count}} min ago",
    hoursAgo: "{{label}} ago",
    lessThanMinute: "< 1 min",
    source: { pickup: "PICKUP", online: "ONLINE", table: "TABLE" },
    action: {
      pending: "Start",
      preparing: "Ready",
      ready: "Complete",
      pickupDelivered: "Delivered"
    },
    column: {
      orders: "Orders",
      pending: "Pending",
      preparing: "Preparing",
      ready: "Ready",
      empty: "No orders in {{column}} column."
    },
    card: {
      new: "New",
      placed: "Placed",
      started: "Started",
      elapsed: "Elapsed"
    },
    cancel: {
      title: "Cancel order",
      reason: "Stock / ingredients insufficient",
      confirm: "Cancel order"
    },
    errors: {
      recipeRequired: "Add at least one ingredient before saving the recipe."
    }
  },
  inventory: {
    brand: "StockFlow",
    tabs: {
      overview: "Overview",
      ingredients: "Ingredients",
      requests: "Requests",
      menu: "Menu impact",
      movements: "Movements"
    },
    descriptions: {
      overview: "Stock health and key metrics at a glance",
      ingredients: "Manage your ingredient stock levels",
      requests: "Review and approve kitchen requests",
      menu: "See how stock affects menu availability",
      movements: "Track all stock changes"
    },
    metrics: {
      ingredients: "Ingredients",
      ingredientsDetail: "Tracked in stock",
      lowStock: "Low stock",
      lowStockDetail: "Needs attention",
      pendingRequests: "Pending requests",
      pendingRequestsDetail: "{{count}} awaiting approval",
      orderableMenu: "Orderable menu",
      orderableMenuDetail: "out of {{total}} dishes"
    },
    overview: {
      lowStockTitle: "Low stock alerts",
      lowStockDescription: "Ingredients needing urgent attention",
      allGood: "All good!",
      noLowStock: "No low-stock items right now.",
      pendingRequestsTitle: "Pending requests",
      pendingRequestsDescription: "Awaiting your approval",
      noPendingRequests: "No pending requests",
      caughtUp: "All caught up.",
      menuOverviewTitle: "Menu overview",
      menuOverviewDescription: "How stock status affects your menu",
      orderableDishes: "Orderable dishes",
      blockedDishes: "Blocked dishes",
      limitedByStock: "Limited by stock",
      missingRecipes: "Missing recipes",
      update: "Update"
    },
    ingredients: {
      addTitle: "Add new ingredient",
      addDescription: "Create stock items for your kitchen",
      name: "Ingredient name",
      namePlaceholder: "e.g. Tomato, Flour, Olive oil",
      unit: "Unit",
      minimumStock: "Minimum stock",
      currentStock: "Current stock",
      submit: "Add ingredient",
      stockTitle: "Ingredient stock",
      stockDescription: "Current stock levels",
      minimum: "Min: {{value}} {{unit}}",
      healthy: "Healthy",
      low: "Low",
      empty: "No ingredients yet",
      emptyDescription: "Add your first ingredient to get started."
    },
    requests: {
      title: "Kitchen requests",
      description: "Approve or reject ingredient requests from kitchen staff",
      addToForm: "Add to form",
      empty: "No requests",
      emptyDescription: "All caught up. No pending requests."
    },
    menu: {
      title: "Menu items",
      description: "How stock status affects each dish",
      dish: "Dish",
      recipe: "Recipe",
      status: "Status",
      stockImpact: "Stock impact",
      recipeMissing: "Recipe missing",
      orderable: "Orderable",
      hidden: "Hidden",
      blocked: "Blocked",
      empty: "No menu items",
      emptyDescription: "Add dishes to see stock impact."
    },
    movements: {
      title: "Recent stock movements",
      description: "Track all stock changes",
      updated: "Stock updated",
      newStock: "New: {{value}} {{unit}}",
      empty: "No movements yet",
      emptyDescription: "Stock updates will appear here."
    },
    messages: {
      requestLoaded: "{{name}} loaded into add form.",
      ingredientAdded: "Ingredient added.",
      stockUpdated: "{{name}} stock updated.",
      requestMarked: "{{name}} marked as {{status}}."
    }
  },
  owner: {
    eyebrow: "Business workspace",
    description: "Manage staff, tables, menu, and business settings from one admin area.",
    planRequired: "A plan must be selected before staff, table, and menu tools are enabled.",
    tabs: {
      overview: "Overview",
      staff: "Staff",
      tables: "Tables",
      menu: "Menu",
      inventory: "Inventory",
      settings: "Settings"
    },
    metrics: {
      staff: "Staff",
      staffDetail: "Active employee accounts",
      tables: "Tables",
      tablesDetail: "Configured dining tables",
      menu: "Menu",
      menuDetail: "Menu items to manage",
      plan: "Plan",
      planRequired: "Required",
      planDetail: "Select a plan to unlock operations"
    },
    steps: {
      selectPlan: "Select a subscription plan.",
      addTable: "Add your first table.",
      addMenuItem: "Add your first menu item.",
      inviteStaff: "Invite staff accounts."
    },
    plan: {
      none: "No active plan",
      current: "Current plan",
      use: "Use {{name}} plan",
      select: "Select a plan"
    }
  },
  notifications: {
    title: "Notifications",
    unread: "{{count}} unread",
    markAllRead: "Mark all read",
    clear: "Clear",
    empty: "No notifications yet.",
    enableBrowser: "Enable browser alerts",
    types: {
      NEW_ORDER: "New order",
      ORDER_READY: "Order ready",
      ORDER_CANCELLED: "Order cancelled",
      REMINDER: "Reminder"
    }
  },
  oss: {
    title: "Order status",
    subtitle: "Live order board",
    loading: "Loading orders...",
    empty: "No active orders.",
    columns: {
      pending: "Pending",
      preparing: "Preparing",
      ready: "Ready",
      completed: "Completed"
    },
    pickupDelivered: "Picked up"
  },
  payment: {
    start: {
      title: "Payment",
      loading: "Starting payment...",
      redirecting: "Redirecting to payment provider..."
    },
    result: {
      title: "Payment result",
      success: "Payment successful",
      failed: "Payment failed",
      pending: "Payment pending",
      backToOrders: "Back to my orders",
      backToRestaurant: "Back to restaurant"
    }
  },
  onlineRestaurant: {
    loading: "Loading restaurant...",
    closed: "Currently closed",
    open: "Open now",
    menu: "Menu",
    addToCart: "Add to cart",
    viewCart: "View cart",
    minimumOrder: "Minimum order",
    deliveryFee: "Delivery fee",
    estimatedTime: "Estimated time",
    noItems: "No items in this category."
  },
  myOrders: {
    title: "My orders",
    empty: "You have no orders yet.",
    loading: "Loading orders...",
    reorder: "Reorder",
    track: "Track order",
    status: "Status"
  },
  pickupStatus: {
    title: "Order status",
    placed: "Order placed",
    preparing: "Preparing",
    ready: "Ready for pickup",
    completed: "Completed",
    cancelled: "Cancelled",
    refresh: "Refresh status"
  },
  print: {
    kitchenTicket: "Kitchen ticket",
    customerReceipt: "Customer receipt",
    orderCode: "Order",
    table: "Table",
    total: "Total",
    notes: "Notes",
    thankYou: "Thank you!"
  }
};

function deepMerge(target, source) {
  for (const [key, value] of Object.entries(source || {})) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      if (!target[key] || typeof target[key] !== "object") {
        target[key] = {};
      }
      deepMerge(target[key], value);
    } else {
      target[key] = value;
    }
  }
  return target;
}

function fillMissingFromTr(enObj, trObj) {
  for (const [key, value] of Object.entries(trObj || {})) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      if (!enObj[key]) enObj[key] = {};
      fillMissingFromTr(enObj[key], value);
    } else if (!(key in enObj)) {
      enObj[key] = value;
    }
  }
}

const merged = JSON.parse(JSON.stringify(enExisting));
deepMerge(merged, missingSections);
fillMissingFromTr(merged, trFull);

fs.writeFileSync(path.join(localesDir, "en", "common.json"), `${JSON.stringify(merged, null, 2)}\n`, "utf8");
console.log("Updated en/common.json");

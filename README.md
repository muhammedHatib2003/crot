# CROT Restaurant/Cafe Service MVP

MVP SaaS starter for restaurants and cafes with:

- `SUPER_ADMIN` panel: list users, restaurants, and edit plan prices
- `OWNER` panel: select a plan, add employees, manage tables and menu
- `Kitchen module`: chef-only kitchen queue and order status flow
- `Waiter module`: waiter-only dine-in order entry, table service board, and served handoff
- `Payment module`: cashier-only payments, checkout, and receipts
- `Inventory module`: inventory_manager-only ingredients, stock levels, suppliers, purchase orders, low-stock alerts, and recipes
- `EMPLOYEE` login: chef, waiter, cashier, and inventory_manager roles
- `QR ordering`: customers scan table QR, create cart, and place orders
- `Cashier receipts`: cash/card checkout with saved receipt records
- Stack: `React + Tailwind + Express + PostgreSQL + Prisma + Docker`

## 1) Run with Docker

```bash
docker compose up --build
```

Services:

- Frontend: `http://localhost:5173`
- API: `http://localhost:4000`
- PostgreSQL: `localhost:5432`

## 2) Default super admin login

Seeded from `docker-compose.yml`:

- Email: `admin@crot.local`
- Password: `admin123`

Change these values in `docker-compose.yml` for production.

## 3) Core user flow

1. Open `/signup` and create an owner account with restaurant data.
2. Owner logs in and opens owner panel.
3. Owner selects a plan to activate the subscription.
4. Owner adds employees, tables, and menu items.
5. Owner can set a restaurant logo URL that appears in employee views.
6. Customer scans `/order/:tableId`, adds items to cart, and places an order.
7. Inventory manager configures ingredients, suppliers, purchase orders, and recipes for menu items.
8. Chef sees new table orders, marks them `ACCEPTED`, `PREPARING`, and `READY`.
9. Waiter can also create dine-in orders manually from the waiter panel and mark ready dishes as `SERVED`.
10. Moving an order to `PREPARING` automatically deducts recipe ingredients through stock movements.
11. Cashier sees served or ready tables plus pickup orders, selects `CASH` or `CARD`, completes payment, and the table becomes available again.
12. Receipt records are stored for later review.
13. Super admin logs in and sees all users plus restaurant names and plan pricing.

## 5) Local development without Docker

### API

```bash
cd api
cp .env.example .env
npm install
npm run setup
npm run dev
```

### Web

```bash
cd web
cp .env.example .env
npm install
npm run dev
```

## 6) API endpoints

- `POST /api/auth/owner-signup`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/plans`
- `GET /api/admin/users` (super admin)
- `GET /api/admin/plans` (super admin)
- `PATCH /api/admin/plans/:planId` (super admin)
- `GET /api/owner/dashboard` (owner)
- `PATCH /api/owner/restaurant` (owner)
- `GET /api/owner/employees` (owner)
- `POST /api/owner/employees` (owner)
- `POST /api/owner/subscription/select` (owner)
- `GET /api/kitchen/orders` (chef)
- `PATCH /api/kitchen/orders/:orderId/status` (chef)
- `GET /api/waiter/orders` (waiter)
- `POST /api/waiter/orders` (waiter)
- `PATCH /api/waiter/orders/:orderId/status` (waiter)
- `GET /api/waiter/tables` (waiter)
- `GET /api/waiter/menu` (waiter)
- `GET /api/payment/orders` (cashier)
- `PATCH /api/payment/orders/:orderId/status` (cashier)
- `GET /api/payment/tables` (cashier)
- `PATCH /api/payment/tables/:tableId/status` (cashier)
- `POST /api/payment/tables/:tableId/checkout` (cashier)
- `GET /api/payment/payments` (cashier)
- `GET /api/inventory/dashboard` (inventory_manager)
- `GET /api/inventory/ingredients` (inventory_manager)
- `POST /api/inventory/ingredients` (inventory_manager)
- `PATCH /api/inventory/ingredients/:ingredientId` (inventory_manager)
- `GET /api/inventory/ingredients/:ingredientId/movements` (inventory_manager)
- `GET /api/inventory/movements` (inventory_manager)
- `POST /api/inventory/movements` (inventory_manager)
- `GET /api/inventory/suppliers` (inventory_manager)
- `POST /api/inventory/suppliers` (inventory_manager)
- `GET /api/inventory/purchase-orders` (inventory_manager)
- `POST /api/inventory/purchase-orders` (inventory_manager)
- `POST /api/inventory/purchase-orders/:purchaseOrderId/receive` (inventory_manager)
- `GET /api/inventory/alerts/low-stock` (inventory_manager)
- `GET /api/inventory/reports/consumption` (inventory_manager)
- `GET /api/inventory/menu-items` (inventory_manager)
- `GET /api/inventory/menu-items/:menuItemId/recipe` (inventory_manager)
- `PUT /api/inventory/menu-items/:menuItemId/recipe` (inventory_manager)
- `DELETE /api/inventory/menu-items/:menuItemId/recipe` (inventory_manager)
- `GET /api/public/tables/:tableId/menu`
- `POST /api/public/tables/:tableId/orders`
- `GET /api/public/orders/:orderId`

## 7) Notes

- This MVP uses plan selection instead of real payments.
- Inventory keeps both a stock ledger (`stock_movements`) and a live `IngredientStock` snapshot maintained by the API.
- Moving an order to `PREPARING` now requires recipes for all ordered menu items and enough ingredient stock.
- Menu items consume ingredients through recipes, not through direct menu-item stock counts.
- Replace JWT secret and admin credentials before deployment.
- Add HTTPS, refresh tokens, audit logging, and payment integration for production.

# CROT Restaurant/Cafe Service MVP

MVP SaaS starter for restaurants and cafes with:

- `SUPER_ADMIN` panel: list users, restaurants, and edit plan prices
- `OWNER` panel: select a plan, add employees, manage tables and menu
- `EMPLOYEE` login: chef and cashier order management
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
7. Chef sees new table orders, marks them `PREPARING` and then `READY`.
8. Cashier sees ready tables, selects `CASH` or `CARD`, completes payment, and the table becomes available again.
9. Receipt records are stored for later review.
10. Super admin logs in and sees all users plus restaurant names and plan pricing.

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
- `GET /api/public/tables/:tableId/menu`
- `POST /api/public/tables/:tableId/orders`
- `GET /api/public/orders/:orderId`
- `GET /api/employee/orders`
- `PATCH /api/employee/orders/:orderId/status`
- `GET /api/employee/payments`
- `POST /api/employee/tables/:tableId/checkout`

## 7) Notes

- This MVP uses plan selection instead of real payments.
- Replace JWT secret and admin credentials before deployment.
- Add HTTPS, refresh tokens, audit logging, and payment integration for production.

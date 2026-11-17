# BatStateU Marketplace

A campus buy-and-sell platform for Batangas State University students — think Facebook Marketplace, but scoped to one campus.

Built as a **strict 3-tier application** for IT 314 (Web Systems and Architecture) and System Integration and Architecture.

**Current status: Phases 1–3 complete** — database, authentication, and the full marketplace (browse, search, filter, list, edit, delete).

---

## 1. Tech stack

| Layer | Technology |
| --- | --- |
| Presentation (tier 1) | HTML5, CSS3, vanilla JavaScript, `fetch()` |
| Application logic (tier 2) | Node.js, Express 5, express-session, bcryptjs, multer |
| Data (tier 3) | SQLite via `better-sqlite3` |
| Charts (Phase 6) | Chart.js |

## 2. Three-tier architecture

```
 ┌──────────────────────────────────────────────────────────┐
 │ TIER 1 — PRESENTATION                                    │
 │ public/*.html, public/css, public/js                      │
 │ Renders UI, validates input, calls the REST API           │
 └───────────────────────────┬──────────────────────────────┘
                             │ HTTP + JSON + session cookie
 ┌───────────────────────────▼──────────────────────────────┐
 │ TIER 2 — APPLICATION / BUSINESS LOGIC                    │
 │ routes/ → controllers/ → services/ → middleware/         │
 │ Auth, validation, ownership rules, aggregation           │
 └───────────────────────────┬──────────────────────────────┘
                             │ parameterized SQL
 ┌───────────────────────────▼──────────────────────────────┐
 │ TIER 3 — DATA                                            │
 │ models/ + config/db.js + database/                       │
 │ SQLite file: database/marketplace.db                     │
 └──────────────────────────────────────────────────────────┘
```

**The rule that makes it a real 3-tier system:** the browser never touches the database, and SQL exists only inside `models/`. Controllers never import `better-sqlite3`.

| Folder | Tier | Responsibility |
| --- | --- | --- |
| `public/` | 1 | HTML pages, CSS, browser JS |
| `routes/` | 2 | URL → controller mapping, route-level middleware |
| `controllers/` | 2 | Reads the request, returns JSON |
| `services/` | 2 | Business rules (who may edit what, price conversion, etc.) |
| `middleware/` | 2 | Session auth, role guards, upload handling, error handling |
| `models/` | 3 | Every SQL statement in the app |
| `config/db.js` | 3 | Opens the database, applies the schema |
| `database/` | 3 | `schema.sql`, `seed.js`, `marketplace.db` |

## 3. Requirements

- **Node.js 18 or newer** (built and tested on Node 24)
- npm (comes with Node)
- A modern browser

Check your version:

```powershell
node -v
```

## 4. How to run it

Open a terminal in the project folder (`IT 314`).

**Step 1 — install dependencies** (only needed once, or after changing `package.json`):

```powershell
npm install
```

**Step 2 — create the demo data** (only needed once, or whenever you want a clean reset):

```powershell
npm run seed
```

This creates `database/marketplace.db` with 1 admin, 10 students, 6 categories, and 30 listings.

**Step 3 — start the server:**

```powershell
npm start
```

You should see:

```
  BatStateU Marketplace
  ---------------------
  Website : http://localhost:3000
  API     : http://localhost:3000/api/health
  Database: C:\...\IT 314\database\marketplace.db
```

**Step 4 — open the site:** <http://localhost:3000>

To stop the server, press `Ctrl + C` in that terminal.

For development (auto-restart on file changes):

```powershell
npm run dev
```

### Demo accounts

All demo accounts use the password **`password123`**.

| Role | Email |
| --- | --- |
| Student | `juan.delacruz@batstate-u.edu.ph` |
| Student | `maria.santos@batstate-u.edu.ph` |
| Admin | `admin@batstate-u.edu.ph` |

Registration is restricted to `@batstate-u.edu.ph` addresses. To change that, copy `.env.example` to `.env` and edit `ALLOWED_EMAIL_DOMAIN`.

## 5. Pages

| Page | URL | Notes |
| --- | --- | --- |
| Marketplace | `/` | Search, category chips, sorting, pagination |
| Listing detail | `/listing.html?id=1` | Photos, seller card, view counter, owner actions |
| Log in | `/login.html` | Redirects back to `?next=` after login |
| Sign up | `/register.html` | School-email validation, bcrypt hashing |
| Post / edit item | `/sell.html` (`?id=` to edit) | Photo upload, live preview |
| My listings | `/account.html` | Edit and delete your own items |

Owner-only rules are enforced in the **service layer**, not just hidden in the UI: editing or deleting someone else's listing returns `403` even if you call the API directly.

## 6. API endpoints (Phase 1–3)

| Method | Endpoint | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/api/health` | — | Server status |
| POST | `/api/auth/register` | — | Create a student account |
| POST | `/api/auth/login` | — | Start a session |
| POST | `/api/auth/logout` | — | Destroy the session |
| GET | `/api/auth/me` | — | Current user or `null` |
| POST | `/api/auth/heartbeat` | ✔ | Update `last_seen_at` (feeds "users online") |
| GET | `/api/categories` | — | List categories |
| GET | `/api/listings` | — | Browse (`q`, `category`, `sort`, `page`, `limit`, `mine=1`) |
| GET | `/api/listings/:id` | — | Detail (increments views) |
| POST | `/api/listings` | ✔ | Create (multipart, optional `image`) |
| PATCH | `/api/listings/:id` | ✔ owner | Update |
| DELETE | `/api/listings/:id` | ✔ owner | Soft delete (`status = 'removed'`) |

Error shape is always the same:

```json
{ "error": { "message": "You can only edit your own listings." } }
```

## 7. Database schema

```
users(id, student_id ✦, full_name, email ✦, password_hash, role, program,
      year_level, status, last_seen_at, created_at)

categories(id, name ✦, slug ✦)

listings(id, seller_id → users, category_id → categories, title, description,
         price_centavos, item_condition, image_path, status, views,
         created_at, updated_at)
```

Design decisions worth mentioning in your defense:

- **Money is stored as integer centavos** (`price_centavos`), not floats — no rounding drift.
- **Soft delete** (`status = 'removed'`) keeps the row so future order history stays intact.
- **CHECK constraints** on `role`, `status`, `item_condition`, and `price_centavos >= 0`.
- **Foreign keys are on** (`PRAGMA foreign_keys = ON`) with `ON DELETE CASCADE` for a seller's listings.
- Indexes on `status`, `category_id`, `seller_id`, and `created_at` for the browse queries.

## 8. Security notes

- Passwords hashed with **bcrypt** (10 rounds); plain-text passwords are never stored or returned.
- Sessions via `express-session` with an **HttpOnly**, `SameSite=Lax` cookie.
- The session ID is **regenerated on login** to prevent session fixation.
- Login errors are identical for "unknown email" and "wrong password" so the API does not leak registered emails.
- `role` can never be set from the registration form — self-registration is always a student.
- All SQL is **parameterized** (no string concatenation of user input).
- Sort keys are chosen from a **whitelist**, never interpolated from the query string.
- Uploads are limited to images, 5 MB, and renamed with random bytes.
- Baseline headers: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`.

Known limitation for now: sessions live in memory, so restarting the server logs everyone out. A SQLite session store is a Phase 6/7 task.

## 9. Project structure

```
IT 314/
├── server.js                  # entry point: Express, session, static files
├── package.json
├── .env.example
├── config/
│   └── db.js                  # opens SQLite, applies schema
├── database/
│   ├── schema.sql             # tables, constraints, indexes
│   ├── seed.js                # demo data (npm run seed)
│   └── marketplace.db         # generated, gitignored
├── models/                    # TIER 3 — all SQL
│   ├── user.model.js
│   ├── category.model.js
│   └── listing.model.js
├── services/                  # TIER 2 — business rules
│   ├── auth.service.js
│   └── listing.service.js
├── controllers/               # TIER 2 — request/response
│   ├── auth.controller.js
│   └── listing.controller.js
├── routes/                    # TIER 2 — URL mapping
│   ├── index.js
│   ├── auth.routes.js
│   ├── listing.routes.js
│   └── category.routes.js
├── middleware/
│   ├── auth.js                # attachUser, requireAuth, requireAdmin
│   ├── upload.js              # multer image upload
│   └── error.js               # central error handler
├── utils/
│   ├── AppError.js
│   ├── validate.js
│   ├── files.js
│   ├── asyncHandler.js
│   └── session.js
└── public/                    # TIER 1 — presentation
    ├── index.html  login.html  register.html
    ├── listing.html  sell.html  account.html  404.html
    ├── css/style.css
    ├── js/ api.js  app.js  auth.js  marketplace.js  listing.js  sell.js  account.js
    └── uploads/               # listing photos (gitignored)
```

## 10. Roadmap

| Phase | Scope | Status |
| --- | --- | --- |
| 1 | Schema, seed data, project scaffold | ✅ done |
| 2 | Authentication, sessions, role guard | ✅ done |
| 3 | Listings: browse, search, filter, create, edit, delete | ✅ done |
| 4 | Orders: request to buy → seller confirms → purchases/sales | next |
| 5 | Buyer ↔ seller messaging | later |
| 6 | Admin dashboard: KPIs, Chart.js charts, user management | later |
| 7 | Polish, responsive pass, documentation set | later |

The `listings.status` field already supports `reserved` and `sold`, and the schema already tracks `last_seen_at`, so Phase 4 and Phase 6 will not require a redesign.

## 11. Troubleshooting

**`npm install` fails on better-sqlite3**
It normally installs a prebuilt binary. If it tries to compile, install the "Desktop development with C++" workload from Visual Studio Build Tools, or use Node LTS (20/22).

**`EADDRINUSE: address already in use :::3000`**
Another server is already running. Close it, or start on a different port:
```powershell
$env:PORT=3001; npm start
```

**I want a clean database (remove test listings/users)**
```powershell
npm run seed
```
This wipes `users`, `categories`, and `listings` and re-inserts the demo data.

**The site loads but there are no listings**
The server started before seeding. Run `npm run seed`, then restart `npm start`.

**I was logged out unexpectedly**
Sessions are stored in memory, so restarting the server ends all sessions. Log in again.

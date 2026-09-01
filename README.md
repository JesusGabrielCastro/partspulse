# PartsPulse

Inventory and purchasing system for operations teams that manage spare parts
bought from suppliers billing in different currencies. It flags low stock,
manages the purchase order lifecycle through an explicit state machine, and
shows total spend converted to a base currency using real exchange rates.

Technical assessment — Nova IoT Systems.

## Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.11 + FastAPI |
| ORM / migrations | SQLAlchemy 2.x + Alembic |
| Database | SQLite by default (zero setup) — Postgres supported via Docker |
| Auth | JWT (python-jose) + bcrypt (passlib) |
| Frontend | React 19 + Vite + TypeScript |
| Styling | Tailwind CSS 4 |
| Charts | Recharts |
| Tests | pytest + httpx (TestClient) |
| External API | [Frankfurter](https://www.frankfurter.app/) (exchange rates, no API key) |

## Quick start

### Requirements
- Python 3.11+
- Node 20+
- (Optional) Docker Desktop, if you want Postgres instead of SQLite

### Backend

```bash
cd backend
python -m venv .venv
./.venv/Scripts/activate        # Windows (git-bash: source .venv/Scripts/activate)
# source .venv/bin/activate     # macOS/Linux
pip install -r requirements.txt

cp .env.example .env            # defaults to SQLite, works out of the box

python -m alembic upgrade head  # creates the schema
python -m app.seed              # demo data (users, suppliers, parts)

python -m uvicorn app.main:app --reload --port 8000
```

Backend available at `http://localhost:8000`. Interactive Swagger docs at
`http://localhost:8000/docs`.

Seeded users:
- `admin@partspulse.io` / `Admin123!`
- `staff@partspulse.io` / `Staff123!`

### Frontend

```bash
cd frontend
npm install
cp .env.example .env            # points to http://localhost:8000 by default
npm run dev
```

Frontend available at `http://localhost:5173`.

### Using Postgres instead of SQLite (optional)

```bash
docker compose up -d
```

Then in `backend/.env` change:
```
DATABASE_URL=postgresql+psycopg2://partspulse:partspulse@localhost:5432/partspulse
```
Then run `python -m alembic upgrade head` again pointing at Postgres.

### Tests

Backend — 13 tests: business logic (low-stock, state machine), API
integration (RBAC, full PO lifecycle), and external integration fallback.

```bash
cd backend
python -m pytest -q
```

Frontend — Vitest + Testing Library: low-stock badge rendering and PO
request form validation.

```bash
cd frontend
npm test
```

## Architecture

```
React (UI, roles, states)
   ↓ REST + JWT
FastAPI (validation, RBAC, business logic)
   ↓ SQLAlchemy              ↘ isolated HTTP client (app/clients/)
SQLite / PostgreSQL             Frankfurter (exchange rates)
```

Backend layers:
- `app/models/` — SQLAlchemy, source of truth for the schema.
- `app/schemas/` — Pydantic, input/output validation.
- `app/api/` — HTTP routers, no business logic.
- `app/services/` — pure business logic (low-stock, PO state machine).
- `app/clients/` — isolated external API clients; never imported directly
  from `api/` without going through `services/` or the client itself.
- `app/core/` — config, security (JWT/bcrypt), auth/RBAC dependencies.
- Structured logging of key operations and errors (auth, PO transitions,
  exchange-rate client), configured in `app/main.py`; no secrets are logged.

Frontend:
- `src/api/` — the only place that calls the backend (axios with a 401
  interceptor).
- `src/auth/` — session context and route guards.
- `src/pages/` — one page per route, no server-side business logic.

## Data model and decisions

See [`docs/schema.md`](docs/schema.md) for the entity diagram, constraints,
and indexes documented with their query.

Key decisions:

1. **`is_low_stock` is never a column.** It's computed on every read
   (`current_stock <= reorder_threshold`) in `app/services/inventory_service.py`.
   That way it can never drift from the actual stock.
2. **Price and currency snapshot on the purchase order.** `unit_price_at_request`
   and `currency_code` are copied from the part when the PO is created. If the
   supplier raises the price later, historical orders don't change.
3. **`ON DELETE RESTRICT` on `parts.supplier_id`.** Deleting a supplier with
   parts attached returns `409 SUPPLIER_HAS_PARTS`, never a cascade delete.
4. **Explicit state machine** for purchase orders
   (`app/services/purchase_order_service.py`), validated in the service — a
   status coming from the client is never trusted.
5. **A user can't approve their own purchase request**, even as admin —
   business rule enforced in the approval endpoint.

## Exchange rate integration

Isolated module: `backend/app/clients/exchange_rate_client.py`. No router or
business service knows the shape of Frankfurter's response — the client
returns a `Decimal` and a status (`LIVE` / `CACHED` / `UNAVAILABLE`), never
the raw API dict.

**Why Frankfurter and not a key-based API:** it needs no authentication, is
stable, and the format is simple — this let the available time go into the
client's architecture instead of secret management. The architecture
(isolated client, config via the `EXCHANGE_API_BASE_URL` env var) would
support a key-based API by changing only that module, with no changes
elsewhere in the system.

**Behavior:**
1. Explicit 4s timeout (configurable via env).
2. In-memory cache with a 1h TTL per currency pair.
3. Cascading fallback: live cache → last known rate even if stale →
   no conversion (`UNAVAILABLE`).
4. `GET /api/dashboard/summary` always responds `200`, even if the external
   API is down — it never breaks the dashboard.
5. The frontend shows a discreet badge when `conversion_status` is `CACHED`,
   and when it's `UNAVAILABLE` it indicates conversion isn't available.

To force the fallback in a demo: change `EXCHANGE_API_BASE_URL` in `.env` to
an invalid URL and restart the backend, or cut network access for a moment.

## Environment variables

See `backend/.env.example` and `frontend/.env.example`. No real secret is
committed — `.env` has been in `.gitignore` since the first commit.

## AI usage

This project was built with assistance from Claude (Anthropic) as a coding
copilot under direct supervision and human review at every step: scaffolding
the backend (models, schemas, routers, services), the exchange-rate client
with its fallback logic, and the frontend (components, pages, API client).

Concrete example of a real fix during development: the initially generated
Frankfurter client (`exchange_rate_client.py`) didn't follow HTTP redirects.
Frankfurter's API responds with a `301` (redirect to `https://` via
Cloudflare) under certain network conditions, and `httpx.get()` doesn't
follow redirects by default. When testing the endpoint live,
`conversion_status` came back as `UNAVAILABLE` instead of `LIVE` even though
the API was reachable. It was diagnosed with `curl -sL` (confirming that
without `-L` the response was a 301) and fixed by adding
`follow_redirects=True` to the call. Without testing the endpoint against
the real network this bug would have gone unnoticed, because the code
"looked correct" and didn't fail loudly — it silently returned the worst of
the three possible states.

## Known limitations / future work

Given the time available for this submission (~2.5h), a solid backend (auth,
server-side RBAC, state machine, external integration with fallback, tests)
was prioritized over frontend polish. Left out, documented as a conscious
scope decision:

- Server-side pagination for purchase orders in the frontend (the backend
  already supports it).
- ~~Editing/deleting parts and suppliers from the UI~~ — added: inline edit
  for parts and suppliers, and supplier delete, are implemented in the UI.
- Stock movement history (`stock_movements`) — would require a new table,
  designed but not implemented.
- A partial index or generated column to speed up the `low_stock` filter
  (see the note in `docs/schema.md`).

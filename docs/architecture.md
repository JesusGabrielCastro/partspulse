# Architecture

```
React (UI, roles, states)
   ↓ REST + JWT
FastAPI (validation, RBAC, business logic)
   ↓ SQLAlchemy                ↘ isolated HTTP client
SQLite / PostgreSQL              Frankfurter (exchange rates)
```

## Where each responsibility lives (backend)

| Responsibility | Location |
|---|---|
| Schema / entities | `app/models/__init__.py` |
| Input/output validation | `app/schemas/__init__.py` (Pydantic) |
| Authentication (JWT, bcrypt) | `app/core/security.py` |
| RBAC (`get_current_user`, `require_admin` dependencies) | `app/core/deps.py` |
| Low-stock (single source of truth) | `app/services/inventory_service.py` |
| Purchase order state machine | `app/services/purchase_order_service.py` |
| Isolated external HTTP client (Frankfurter) | `app/clients/exchange_rate_client.py` |
| HTTP routers (no business logic) | `app/api/*.py` |
| Environment config | `app/core/config.py` (pydantic-settings) |
| Uniform error handling | `app/main.py` (exception handlers → `{"error": {...}}`) |

## Why the exchange rate client is separate from `api/`

`app/clients/exchange_rate_client.py` is the only module aware that
Frankfurter exists. `httpx` is never imported in a router. The dashboard
router (`app/api/dashboard.py`) calls `exchange_rate_client.get_rate(...)`
and gets back an object with a `Decimal` and a status enum — nothing about
the shape of the raw HTTP response leaks upward. This allows:

- Switching exchange rate providers without touching routers or services.
- Testing the fallback by mocking a single point (`httpx.get`) without
  coupling the test to HTTP routes.
- An external API outage never propagating as an uncontrolled exception up
  to the client — the worst possible case is
  `conversion_status: "UNAVAILABLE"`, never a 500.

## RBAC: where it's enforced

All authorization lives in the backend, never only in the frontend:

- `get_current_user` (dependency): requires a valid JWT → 401 if missing or
  invalid.
- `require_admin` (dependency): requires the admin role → 403 if the user
  is authenticated but not an admin.
- Additional domain rule in
  `app/api/purchase_orders.py::approve_purchase_order`: a user can't approve
  their own request, even as admin.

The frontend hides admin UI for the `staff` role
(`user?.role === "admin"` in the pages), but that's UX only — the real
security is that the endpoints return 403 regardless of what the client
sends.

## Errors: uniform shape

Every API error response follows the same shape, defined in `app/main.py`
via exception handlers:

```json
{ "error": { "code": "ILLEGAL_TRANSITION", "message": "...", "details": [] } }
```

HTTP codes used consistently: `400/422` validation, `401` not authenticated,
`403` authenticated without permission, `404` not found, `409` state or FK
conflict, `500` internal without an exposed stack trace.

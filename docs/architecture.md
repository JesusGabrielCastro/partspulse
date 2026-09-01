# Arquitectura

```
React (UI, roles, estados)
   ↓ REST + JWT
FastAPI (validación, RBAC, lógica de negocio)
   ↓ SQLAlchemy                ↘ cliente HTTP aislado
SQLite / PostgreSQL              Frankfurter (tipos de cambio)
```

## Dónde vive cada responsabilidad (backend)

| Responsabilidad | Ubicación |
|---|---|
| Esquema / entidades | `app/models/__init__.py` |
| Validación de entrada/salida | `app/schemas/__init__.py` (Pydantic) |
| Autenticación (JWT, bcrypt) | `app/core/security.py` |
| RBAC (dependencias `get_current_user`, `require_admin`) | `app/core/deps.py` |
| Low-stock (única fuente de verdad) | `app/services/inventory_service.py` |
| Máquina de estados de purchase orders | `app/services/purchase_order_service.py` |
| Cliente HTTP externo aislado (Frankfurter) | `app/clients/exchange_rate_client.py` |
| Routers HTTP (sin lógica de negocio) | `app/api/*.py` |
| Config por entorno | `app/core/config.py` (pydantic-settings) |
| Manejo de errores uniforme | `app/main.py` (exception handlers → `{"error": {...}}`) |

## Por qué el cliente de tipos de cambio está separado de `api/`

`app/clients/exchange_rate_client.py` es el único módulo que sabe que existe
Frankfurter. Nunca se importa `httpx` en un router. El router de dashboard
(`app/api/dashboard.py`) llama a `exchange_rate_client.get_rate(...)` y
recibe un objeto con un `Decimal` y un enum de estado — nada de la forma de
la respuesta HTTP cruda se filtra hacia arriba. Esto permite:

- Cambiar de proveedor de tasas de cambio sin tocar routers ni servicios.
- Testear el fallback mockeando un único punto (`httpx.get`) sin acoplar el
  test a rutas HTTP.
- Que una caída de la API externa nunca se propague como una excepción no
  controlada hacia el cliente — el peor caso posible es
  `conversion_status: "UNAVAILABLE"`, nunca un 500.

## RBAC: dónde se aplica

Toda autorización vive en el backend, nunca solo en el frontend:

- `get_current_user` (dependency): exige un JWT válido → 401 si falta o es
  inválido.
- `require_admin` (dependency): exige rol admin → 403 si el usuario está
  autenticado pero no es admin.
- Regla de dominio adicional en `app/api/purchase_orders.py::approve_purchase_order`:
  un usuario no puede aprobar su propia solicitud, incluso siendo admin.

El frontend oculta la UI de administración para el rol `staff`
(`user?.role === "admin"` en las páginas), pero eso es exclusivamente UX —
la seguridad real está en que los endpoints devuelven 403 sin importar lo
que envíe el cliente.

## Errores: forma uniforme

Toda respuesta de error de la API sigue la misma forma, definida en
`app/main.py` vía exception handlers:

```json
{ "error": { "code": "ILLEGAL_TRANSITION", "message": "...", "details": [] } }
```

Códigos HTTP usados con consistencia: `400/422` validación,
`401` no autenticado, `403` autenticado sin permiso, `404` no existe,
`409` conflicto de estado o de FK, `500` interno sin stack trace expuesto.

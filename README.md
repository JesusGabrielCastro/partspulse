# PartsPulse

Sistema de inventario y compras para equipos de operaciones que gestionan
repuestos comprados a proveedores en distintas monedas. Detecta bajo stock,
gestiona el ciclo de vida de las órdenes de compra con una máquina de estados,
y muestra el gasto total convertido a una moneda base usando tasas de cambio
reales.

Prueba técnica — Nova IoT Systems.

## Stack

| Capa | Tecnología |
|---|---|
| Backend | Python 3.11 + FastAPI |
| ORM / migraciones | SQLAlchemy 2.x + Alembic |
| Base de datos | SQLite por defecto (cero setup) — Postgres soportado vía Docker |
| Auth | JWT (python-jose) + bcrypt (passlib) |
| Frontend | React 19 + Vite + TypeScript |
| Estilos | Tailwind CSS 4 |
| Gráficas | Recharts |
| Tests | pytest + httpx (TestClient) |
| API externa | [Frankfurter](https://www.frankfurter.app/) (tasas de cambio, sin API key) |

## Arranque rápido

### Requisitos
- Python 3.11+
- Node 20+
- (Opcional) Docker Desktop, si querés Postgres en lugar de SQLite

### Backend

```bash
cd backend
python -m venv .venv
./.venv/Scripts/activate        # Windows (git-bash: source .venv/Scripts/activate)
# source .venv/bin/activate     # macOS/Linux
pip install -r requirements.txt

cp .env.example .env            # por defecto usa SQLite, funciona sin tocar nada

python -m alembic upgrade head  # crea el esquema
python -m app.seed              # datos de demo (usuarios, proveedores, parts)

python -m uvicorn app.main:app --reload --port 8000
```

Backend disponible en `http://localhost:8000`. Swagger interactivo en
`http://localhost:8000/docs`.

Usuarios sembrados:
- `admin@partspulse.io` / `Admin123!`
- `staff@partspulse.io` / `Staff123!`

### Frontend

```bash
cd frontend
npm install
cp .env.example .env            # apunta a http://localhost:8000 por defecto
npm run dev
```

Frontend disponible en `http://localhost:5173`.

### Usar Postgres en vez de SQLite (opcional)

```bash
docker compose up -d
```

Y en `backend/.env` cambiá:
```
DATABASE_URL=postgresql+psycopg2://partspulse:partspulse@localhost:5432/partspulse
```
Luego corré `python -m alembic upgrade head` de nuevo apuntando a Postgres.

### Tests

```bash
cd backend
python -m pytest -q
```

13 tests: lógica de negocio (low-stock, máquina de estados), integración de
API (RBAC, ciclo completo de PO), y fallback de la integración externa.

## Arquitectura

```
React (UI, roles, estados)
   ↓ REST + JWT
FastAPI (validación, RBAC, lógica de negocio)
   ↓ SQLAlchemy              ↘ cliente HTTP aislado (app/clients/)
SQLite / PostgreSQL             Frankfurter (tasas de cambio)
```

Capas del backend:
- `app/models/` — SQLAlchemy, fuente de verdad del esquema.
- `app/schemas/` — Pydantic, validación de entrada/salida.
- `app/api/` — routers HTTP, sin lógica de negocio.
- `app/services/` — lógica de negocio pura (low-stock, máquina de estados de PO).
- `app/clients/` — clientes de APIs externas, aislados; nunca se importan
  desde `api/` directamente sin pasar antes por `services/` o el propio cliente.
- `app/core/` — config, seguridad (JWT/bcrypt), dependencias de auth/RBAC.

Frontend:
- `src/api/` — único lugar que llama al backend (axios con interceptor de 401).
- `src/auth/` — contexto de sesión y guards de ruta.
- `src/pages/` — una página por ruta, sin lógica de negocio de servidor.

## Modelo de datos y decisiones

Ver [`docs/schema.md`](docs/schema.md) para el diagrama de entidades,
constraints, e índices documentados con su consulta.

Decisiones clave:

1. **`is_low_stock` nunca es una columna.** Se calcula en cada lectura
   (`current_stock <= reorder_threshold`), en `app/services/inventory_service.py`.
   Así nunca puede desincronizarse del stock real.
2. **Snapshot de precio y moneda en la orden de compra.** `unit_price_at_request`
   y `currency_code` se copian del part al momento de crear la PO. Si el
   proveedor cambia el precio después, las órdenes históricas no se alteran.
3. **`ON DELETE RESTRICT` en `parts.supplier_id`.** Borrar un proveedor con
   repuestos asociados devuelve `409 SUPPLIER_HAS_PARTS`, nunca borra en cascada.
4. **Máquina de estados explícita** para purchase orders
   (`app/services/purchase_order_service.py`), validada en el servicio — nunca
   se confía en un status que venga del cliente.
5. **Un usuario no puede aprobar su propia solicitud de compra**, ni siquiera
   siendo admin — regla de negocio aplicada en el endpoint de aprobación.

## Integración de tipos de cambio

Módulo aislado: `backend/app/clients/exchange_rate_client.py`. Ningún router
ni servicio de negocio conoce el formato de respuesta de Frankfurter — el
cliente devuelve un `Decimal` y un estado (`LIVE` / `CACHED` / `UNAVAILABLE`),
nunca el dict crudo de la API.

**Por qué Frankfurter y no otra API con key:** no requiere autenticación, es
estable, y el formato es simple — permite dedicar el tiempo disponible a la
arquitectura del cliente en vez de a gestionar secretos. La arquitectura
(cliente aislado, config por variable de entorno `EXCHANGE_API_BASE_URL`)
soportaría una API con key cambiando solo ese módulo, sin tocar el resto del
sistema.

**Comportamiento:**
1. Timeout explícito de 4s (configurable por env).
2. Caché en memoria con TTL de 1h por par de monedas.
3. Fallback en cascada: caché viva → última tasa conocida aunque esté vencida
   → sin conversión (`UNAVAILABLE`).
4. `GET /api/dashboard/summary` siempre responde `200`, incluso si la API
   externa está caída — nunca rompe el dashboard.
5. El frontend muestra un badge discreto si `conversion_status` es `CACHED`,
   y si es `UNAVAILABLE` indica que la conversión no está disponible.

Para forzar el fallback en una demo: cambiar `EXCHANGE_API_BASE_URL` en
`.env` a una URL inválida y reiniciar el backend, o cortar la red un momento.

## Variables de entorno

Ver `backend/.env.example` y `frontend/.env.example`. Ningún secreto real
está commiteado — `.env` está en `.gitignore` desde el primer commit.

## Uso de IA

Este proyecto se construyó con asistencia de Claude (Anthropic) como
copiloto de código bajo supervisión directa y revisión humana en cada paso:
generación del scaffold del backend (modelos, schemas, routers, servicios),
del cliente de tipos de cambio con su lógica de fallback, y del frontend
(componentes, páginas, cliente API).

Ejemplo concreto de una corrección real durante el desarrollo: el cliente de
Frankfurter (`exchange_rate_client.py`) generado inicialmente no seguía
redirecciones HTTP. La API de Frankfurter responde con un `301` (redirect a
`https://` vía Cloudflare) en ciertas condiciones de red, y `httpx.get()` no
sigue redirects por defecto. Al probar el endpoint en vivo, `conversion_status`
devolvía `UNAVAILABLE` en vez de `LIVE` aun con la API disponible. Se
diagnosticó con `curl -sL` (verificando que sin `-L` la respuesta era un 301)
y se corrigió agregando `follow_redirects=True` a la llamada. Sin probar el
endpoint contra la red real este bug hubiera pasado desapercibido, porque el
código "se veía correcto" y no fallaba de forma obvia — solo devolvía el peor
de los tres estados posibles silenciosamente.

## Limitaciones conocidas / trabajo futuro

Dado el tiempo disponible para esta entrega (~2.5h), se priorizó backend
sólido (auth, RBAC de servidor, máquina de estados, integración externa con
fallback, tests) sobre pulido de frontend. Quedó fuera, documentado como
alcance consciente:

- Paginación de purchase orders en el frontend (el backend sí la soporta).
- Edición/eliminación de parts y proveedores desde la UI (los endpoints existen).
- Tests de frontend (Vitest).
- Historial de movimientos de stock (`stock_movements`) — requeriría una
  tabla nueva, pensada pero no implementada.
- Índice parcial o columna generada para acelerar el filtro `low_stock`
  (ver nota en `docs/schema.md`).

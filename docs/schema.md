# Esquema de datos

## Entidades

```
users                       suppliers
─────                       ─────────
id            PK            id             PK
email         UNIQUE        name
password_hash                currency_code    (USD, EUR, GBP, INR...)
role          admin|staff   contact_email
created_at                  contact_phone
                             created_at

parts                                purchase_orders
─────                                ───────────────
id                PK                 id                     PK
name                                 part_id                FK → parts (RESTRICT)
sku               UNIQUE             requested_by           FK → users
current_stock     >= 0               approved_by            FK → users (nullable)
reorder_threshold >= 0               quantity               > 0
unit_price        > 0                status                 enum, indexado
supplier_id       FK → suppliers     unit_price_at_request  snapshot
created_at / updated_at              currency_code          snapshot
                                      created_at / updated_at
```

## Constraints relevantes

- `CHECK (current_stock >= 0)`, `CHECK (reorder_threshold >= 0)`,
  `CHECK (unit_price > 0)` en `parts`.
- `CHECK (quantity > 0)` en `purchase_orders`.
- `UNIQUE` en `parts.sku` y `users.email`.
- `FOREIGN KEY parts.supplier_id ... ON DELETE RESTRICT` — borrar un
  proveedor con parts asociados falla a nivel de base de datos (y se
  intercepta antes en el servicio con un `409` claro).

## Índices

- **`idx_purchase_orders_status`** (columna `status`, `index=True` en el
  modelo). Es el índice significativo de este esquema: soporta dos consultas
  reales de la aplicación —
  - `GET /api/purchase-orders?status=REQUESTED` (filtro de la lista de POs)
  - el conteo de "aprobaciones pendientes" del dashboard:
    `SELECT count(*) FROM purchase_orders WHERE status = 'REQUESTED'`
- `idx_parts_supplier_id` — acelera el join/filtro de parts por proveedor.
- Único en `parts.sku` (`idx_parts_sku`) y `users.email` (`idx_users_email`).

### Nota sobre el filtro low-stock

El filtro `?low_stock=true` traduce a
`WHERE current_stock <= reorder_threshold` — una comparación entre dos
columnas de la misma fila. Un índice B-tree simple sobre una sola columna no
acelera esa condición. En Postgres, la forma correcta de resolverlo sería un
**índice parcial** (si el umbral fuera relativamente estable) o una
**columna generada** (`GENERATED ALWAYS AS (current_stock <= reorder_threshold) STORED`)
con su propio índice. No se implementó por alcance de tiempo — la tabla de
~25 partes de la demo no lo necesita — pero es la respuesta correcta si el
dataset creciera.

## Trabajo futuro: histórico de stock

Para trazar el historial de cambios de stock (motivo: ajuste manual, PO
recibida, etc.) la forma correcta es una tabla nueva, no más columnas en
`parts`:

```
stock_movements
────────────────
id          PK
part_id     FK → parts
delta       int (positivo o negativo)
reason      text
po_id       FK → purchase_orders (nullable)
created_at
```

No implementada en esta entrega; queda documentada como diseño pensado.

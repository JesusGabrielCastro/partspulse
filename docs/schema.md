# Data schema

## Entities

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
unit_price        > 0                status                 enum, indexed
supplier_id       FK → suppliers     unit_price_at_request  snapshot
created_at / updated_at              currency_code          snapshot
                                      created_at / updated_at
```

## Relevant constraints

- `CHECK (current_stock >= 0)`, `CHECK (reorder_threshold >= 0)`,
  `CHECK (unit_price > 0)` on `parts`.
- `CHECK (quantity > 0)` on `purchase_orders`.
- `UNIQUE` on `parts.sku` and `users.email`.
- `FOREIGN KEY parts.supplier_id ... ON DELETE RESTRICT` — deleting a
  supplier with parts attached fails at the database level (and is
  intercepted earlier in the service with a clear `409`).

## Indexes

- **`idx_purchase_orders_status`** (column `status`, `index=True` in the
  model). This is the significant index in this schema: it backs two real
  application queries —
  - `GET /api/purchase-orders?status=REQUESTED` (the PO list filter)
  - the dashboard's "pending approvals" count:
    `SELECT count(*) FROM purchase_orders WHERE status = 'REQUESTED'`
- `idx_parts_supplier_id` — speeds up the join/filter of parts by supplier.
- Unique on `parts.sku` (`idx_parts_sku`) and `users.email` (`idx_users_email`).

### Note on the low-stock filter

The `?low_stock=true` filter translates to
`WHERE current_stock <= reorder_threshold` — a comparison between two
columns of the same row. A simple single-column B-tree index doesn't speed
up that condition. In Postgres, the correct way to solve it would be a
**partial index** (if the threshold were relatively stable) or a
**generated column** (`GENERATED ALWAYS AS (current_stock <= reorder_threshold) STORED`)
with its own index. Not implemented due to time scope — the demo's ~25-part
table doesn't need it — but it's the right answer if the dataset grew.

## Future work: stock history

To trace stock change history (reason: manual adjustment, PO received,
etc.) the right approach is a new table, not more columns on `parts`:

```
stock_movements
────────────────
id          PK
part_id     FK → parts
delta       int (positive or negative)
reason      text
po_id       FK → purchase_orders (nullable)
created_at
```

Not implemented in this submission; documented as a thought-out design.

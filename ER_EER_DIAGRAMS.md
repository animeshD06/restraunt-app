# Restaurant App — ER, EER & Relational Diagrams

> **Source**: `backend/setup.sql` + business rules enforced in `backend/routes/` and `backend/services/`
>
> **Database**: PostgreSQL (schema `restaurant_app`) with in-memory fallback (`pg-mem`)

---

## 1 · Entity-Relationship (ER) Diagram

Crow's-foot notation. Every entity shows all attributes with keys and nullability.

```mermaid
erDiagram

    %% ── Relationships ────────────────────────────────────────────
    CATEGORIES          ||--o{  MENU_ITEMS            : "classifies (1 : N)"
    CUSTOMERS           |o--o{  ORDERS                : "places (0..1 : N)"
    RESTAURANT_TABLES   ||--o{  ORDERS                : "serves (1 : N)"
    ORDERS              ||--|{  ORDER_ITEMS            : "contains (1 : N+)"
    MENU_ITEMS          ||--o{  ORDER_ITEMS            : "appears in (1 : N)"
    ORDERS              ||--o{  ORDER_STATUS_HISTORY   : "tracks (1 : N)"
    ORDERS              ||--o|  PAYMENTS               : "settled by (1 : 0..1)"
    CUSTOMERS           ||--o{  RESERVATIONS           : "makes (1 : N)"
    RESTAURANT_TABLES   ||--o{  RESERVATIONS           : "booked for (1 : N)"

    %% ── Entity Attributes ────────────────────────────────────────

    CATEGORIES {
        int         id              PK  "GENERATED ALWAYS AS IDENTITY"
        varchar50   name            UK  "NOT NULL, BTRIM ≠ ''"
        timestamptz created_at          "DEFAULT NOW()"
    }

    CUSTOMERS {
        int         id              PK  "GENERATED ALWAYS AS IDENTITY"
        varchar100  name                "NOT NULL, BTRIM ≠ ''"
        varchar20   phone           UK  "NULLABLE — partial unique index"
        varchar120  email           UK  "NULLABLE — partial unique index"
        timestamptz created_at          "DEFAULT NOW()"
        timestamptz updated_at          "DEFAULT NOW(), auto-trigger"
    }

    RESTAURANT_TABLES {
        int         id              PK  "GENERATED ALWAYS AS IDENTITY"
        int         table_number    UK  "NOT NULL, > 0"
        int         capacity            "NOT NULL, > 0"
        varchar20   status              "available | occupied | reserved | maintenance"
        timestamptz created_at          "DEFAULT NOW()"
        timestamptz updated_at          "DEFAULT NOW(), auto-trigger"
    }

    MENU_ITEMS {
        int         id              PK  "GENERATED ALWAYS AS IDENTITY"
        varchar100  name                "NOT NULL, BTRIM ≠ ''"
        numeric102  price               "NOT NULL, > 0"
        int         category_id     FK  "NOT NULL → categories(id) ON DELETE RESTRICT"
        boolean     available           "NOT NULL, DEFAULT TRUE"
        timestamptz created_at          "DEFAULT NOW()"
        timestamptz updated_at          "DEFAULT NOW(), auto-trigger"
    }

    ORDERS {
        int         id              PK  "GENERATED ALWAYS AS IDENTITY"
        int         customer_id     FK  "NULLABLE → customers(id) ON DELETE SET NULL"
        int         table_id        FK  "NOT NULL → restaurant_tables(id) ON DELETE RESTRICT"
        varchar20   status              "pending | preparing | served | paid | cancelled"
        text        notes               "NULLABLE"
        timestamptz created_at          "DEFAULT NOW()"
        timestamptz updated_at          "DEFAULT NOW(), auto-trigger"
    }

    ORDER_ITEMS {
        int         id                      PK  "GENERATED ALWAYS AS IDENTITY"
        int         order_id                FK  "NOT NULL → orders(id) ON DELETE CASCADE"
        int         menu_item_id            FK  "NOT NULL → menu_items(id) ON DELETE RESTRICT"
        int         quantity                    "NOT NULL, > 0"
        numeric102  unit_price_at_order         "NOT NULL, > 0 — historical snapshot"
        timestamptz created_at                  "DEFAULT NOW()"
    }

    ORDER_STATUS_HISTORY {
        int         id          PK  "GENERATED ALWAYS AS IDENTITY"
        int         order_id    FK  "NOT NULL → orders(id) ON DELETE CASCADE"
        varchar20   old_status      "NULLABLE (first transition)"
        varchar20   new_status      "NOT NULL"
        timestamptz changed_at      "DEFAULT NOW()"
    }

    PAYMENTS {
        int         id              PK  "GENERATED ALWAYS AS IDENTITY"
        int         order_id        FK  "NOT NULL UNIQUE → orders(id) ON DELETE CASCADE"
        numeric102  amount              "NOT NULL, > 0"
        varchar20   payment_method      "cash | card | upi"
        varchar20   payment_status      "pending | completed | refunded"
        timestamptz paid_at             "DEFAULT NOW()"
        timestamptz created_at          "DEFAULT NOW()"
    }

    RESERVATIONS {
        int         id                  PK  "GENERATED ALWAYS AS IDENTITY"
        int         customer_id         FK  "NOT NULL → customers(id) ON DELETE CASCADE"
        int         table_id            FK  "NOT NULL → restaurant_tables(id) ON DELETE RESTRICT"
        timestamptz reservation_time        "NOT NULL"
        int         guest_count             "NOT NULL, > 0"
        varchar20   status                  "booked | completed | cancelled"
        text        notes                   "NULLABLE"
        timestamptz created_at              "DEFAULT NOW()"
        timestamptz updated_at              "DEFAULT NOW(), auto-trigger"
    }
```

---

## 2 · Enhanced Entity-Relationship (EER) Diagram

The EER diagram adds:
- **Derived / computed attributes** (dashed)
- **Business-rule constraints** (blue boxes)
- **Specialisation / participation constraints**
- **Aggregation** (order_items as associative entity)
- **Temporal / audit** semantics

```mermaid
flowchart TD
    subgraph CORE ["🗂️  Core Entities"]
        direction TB
        CAT["<b>Category</b><br/>━━━━━━━━━━━━<br/>🔑 id (PK)<br/>name (UK, NOT NULL)"]
        CUST["<b>Customer</b><br/>━━━━━━━━━━━━<br/>🔑 id (PK)<br/>name (NOT NULL)<br/>phone (UK, nullable)<br/>email (UK, nullable)"]
        TBL["<b>RestaurantTable</b><br/>━━━━━━━━━━━━<br/>🔑 id (PK)<br/>table_number (UK, NOT NULL)<br/>capacity (>0, NOT NULL)<br/>⬡ status (derived)"]
        MNU["<b>MenuItem</b><br/>━━━━━━━━━━━━<br/>🔑 id (PK)<br/>name (NOT NULL)<br/>price (>0)<br/>available (boolean)<br/>🔗 category_id (FK)"]
    end

    subgraph TRANSACTIONS ["📋  Transaction Entities"]
        direction TB
        ORD["<b>Order</b><br/>━━━━━━━━━━━━<br/>🔑 id (PK)<br/>🔗 customer_id (FK, nullable)<br/>🔗 table_id (FK, NOT NULL)<br/>status (enum)<br/>notes (nullable)<br/>⬡ total_amount (derived)"]
        OI["<b>OrderItem</b><br/><i>Associative Entity</i><br/>━━━━━━━━━━━━<br/>🔑 id (PK)<br/>🔗 order_id (FK)<br/>🔗 menu_item_id (FK)<br/>quantity (>0)<br/>unit_price_at_order (snapshot)"]
        PAY["<b>Payment</b><br/>━━━━━━━━━━━━<br/>🔑 id (PK)<br/>🔗 order_id (FK, UK)<br/>amount (>0)<br/>payment_method (enum)<br/>payment_status (enum)"]
    end

    subgraph AUDIT ["🕐  Audit / History Entities"]
        direction TB
        HST["<b>OrderStatusHistory</b><br/>━━━━━━━━━━━━<br/>🔑 id (PK)<br/>🔗 order_id (FK)<br/>old_status (nullable)<br/>new_status (NOT NULL)<br/>changed_at"]
    end

    subgraph RESERVE ["📅  Reservation Entity"]
        RES["<b>Reservation</b><br/>━━━━━━━━━━━━<br/>🔑 id (PK)<br/>🔗 customer_id (FK, NOT NULL)<br/>🔗 table_id (FK, NOT NULL)<br/>reservation_time<br/>guest_count (>0)<br/>status (enum)<br/>notes (nullable)"]
    end

    %% ── Relationships ──────────────────────────────────────────
    CAT  -->|"1 ──────── N<br/><i>mandatory, ON DELETE RESTRICT</i>"| MNU
    CUST --->|"1 ──────── 0..N<br/><i>optional for walk-in orders</i>"| ORD
    TBL  -->|"1 ──────── N<br/><i>mandatory table on every order</i>"| ORD
    ORD  -->|"1 ──────── 1..N<br/><i>order must have ≥1 line item</i>"| OI
    MNU  -->|"1 ──────── 0..N<br/><i>one item → many order lines</i>"| OI
    ORD  -->|"1 ──────── 0..1<br/><i>UNIQUE FK → at most 1 payment</i>"| PAY
    ORD  -->|"1 ──────── N<br/><i>ON DELETE CASCADE</i>"| HST
    CUST -->|"1 ──────── 0..N<br/><i>mandatory customer on reservation</i>"| RES
    TBL  -->|"1 ──────── 0..N<br/><i>table booked over time</i>"| RES

    %% ── Business Rules ─────────────────────────────────────────
    BR1["<b>📌 Order Status Lifecycle</b><br/>pending → preparing → served → paid<br/>cancel allowed before 'paid'<br/><i>enforced in orders route</i>"]:::rule
    BR2["<b>📌 Table Status Derivation</b><br/>'occupied' if active orders exist<br/>'reserved' if future bookings exist<br/>'maintenance' = manual override<br/><i>application-managed, not DB trigger</i>"]:::rule
    BR3["<b>📌 Reservation Conflict Rule</b><br/>Same table cannot overlap within<br/>±90 minutes of existing booking<br/><i>enforced in reservations service</i>"]:::rule
    BR4["<b>📌 Price Snapshot Rule</b><br/>unit_price_at_order copied at<br/>order creation time<br/><i>protects history from price changes</i>"]:::rule
    BR5["<b>📌 Partial Unique Indexes</b><br/>customers.phone UNIQUE WHERE NOT NULL<br/>customers.email UNIQUE WHERE NOT NULL<br/><i>allows multiple NULL values</i>"]:::rule

    ORD  -. "lifecycle" .-> BR1
    TBL  -. "status logic" .-> BR2
    RES  -. "conflict check" .-> BR3
    OI   -. "price capture" .-> BR4
    CUST -. "nullable unique" .-> BR5

    %% ── Derived Attributes ──────────────────────────────────────
    D1["⬡ total_amount<br/><i>SUM(qty × unit_price_at_order)</i>"]:::derived
    D2["⬡ table.status<br/><i>computed from orders + reservations</i>"]:::derived
    ORD  -. "derived" .-> D1
    TBL  -. "derived" .-> D2

    %% ── Triggers (auto-maintained) ──────────────────────────────
    TR1["⚡ Triggers (BEFORE UPDATE)<br/>customers · restaurant_tables<br/>menu_items · orders · reservations<br/><i>auto-updates updated_at column</i>"]:::trigger
    CUST -. "trigger" .-> TR1
    TBL  -. "trigger" .-> TR1
    MNU  -. "trigger" .-> TR1
    ORD  -. "trigger" .-> TR1
    RES  -. "trigger" .-> TR1

    classDef rule    fill:#dbeafe,stroke:#1d4ed8,color:#1e3a5f,rx:8
    classDef derived fill:#fef9c3,stroke:#a16207,color:#3b2f00,rx:8
    classDef trigger fill:#fce7f3,stroke:#9d174d,color:#4a1525,rx:8
```

---

## 3 · Relational Schema Diagram

Shows all tables with columns, primary keys (🔑), foreign keys (🔗), unique keys (UK), and indexes.

```mermaid
erDiagram

    %% ── All relationships (same as ER, shown for schema context) ──
    categories          ||--o{  menu_items            : "category_id FK"
    customers           |o--o{  orders                : "customer_id FK (nullable)"
    restaurant_tables   ||--o{  orders                : "table_id FK"
    orders              ||--|{  order_items            : "order_id FK CASCADE"
    menu_items          ||--o{  order_items            : "menu_item_id FK"
    orders              ||--o{  order_status_history   : "order_id FK CASCADE"
    orders              ||--o|  payments               : "order_id FK UNIQUE CASCADE"
    customers           ||--o{  reservations           : "customer_id FK CASCADE"
    restaurant_tables   ||--o{  reservations           : "table_id FK"

    categories {
        int         id              PK
        varchar50   name            UK
        timestamptz created_at
    }

    customers {
        int         id              PK
        varchar100  name
        varchar20   phone
        varchar120  email
        timestamptz created_at
        timestamptz updated_at
    }

    restaurant_tables {
        int         id              PK
        int         table_number    UK
        int         capacity
        varchar20   status
        timestamptz created_at
        timestamptz updated_at
    }

    menu_items {
        int         id              PK
        varchar100  name
        numeric     price
        int         category_id     FK
        boolean     available
        timestamptz created_at
        timestamptz updated_at
    }

    orders {
        int         id              PK
        int         customer_id     FK
        int         table_id        FK
        varchar20   status
        text        notes
        timestamptz created_at
        timestamptz updated_at
    }

    order_items {
        int         id                  PK
        int         order_id            FK
        int         menu_item_id        FK
        int         quantity
        numeric     unit_price_at_order
        timestamptz created_at
    }

    order_status_history {
        int         id          PK
        int         order_id    FK
        varchar20   old_status
        varchar20   new_status
        timestamptz changed_at
    }

    payments {
        int         id              PK
        int         order_id        FK
        numeric     amount
        varchar20   payment_method
        varchar20   payment_status
        timestamptz paid_at
        timestamptz created_at
    }

    reservations {
        int         id                  PK
        int         customer_id         FK
        int         table_id            FK
        timestamptz reservation_time
        int         guest_count
        varchar20   status
        text        notes
        timestamptz created_at
        timestamptz updated_at
    }
```

---

## 4 · Cardinality & Participation Summary

| Relationship | ER Notation | Participation | Enforcement |
|---|---|---|---|
| `categories` → `menu_items` | 1 : N | Total on MenuItem side | `NOT NULL FK`, `ON DELETE RESTRICT` |
| `customers` → `orders` | 1 : N (optional) | Partial on Order side | `NULLABLE FK`, `ON DELETE SET NULL` |
| `restaurant_tables` → `orders` | 1 : N | Total on Order side | `NOT NULL FK`, `ON DELETE RESTRICT` |
| `orders` → `order_items` | 1 : N (min 1) | Total — app enforces ≥1 | `ON DELETE CASCADE`, app-level check |
| `menu_items` → `order_items` | 1 : N | Partial | `NOT NULL FK`, `ON DELETE RESTRICT` |
| `orders` → `payments` | 1 : 0..1 | Optional | `UNIQUE FK`, `ON DELETE CASCADE` |
| `orders` → `order_status_history` | 1 : N | Partial | `ON DELETE CASCADE` |
| `customers` → `reservations` | 1 : N | Total on Reservation side | `NOT NULL FK`, `ON DELETE CASCADE` |
| `restaurant_tables` → `reservations` | 1 : N | Partial | `NOT NULL FK`, `ON DELETE RESTRICT` |

---

## 5 · Index Reference

| Index Name | Table | Column(s) | Type | Purpose |
|---|---|---|---|---|
| `idx_menu_items_category_id` | `menu_items` | `category_id` | B-Tree | Fast menu lookups by category |
| `idx_menu_items_available` | `menu_items` | `available` | B-Tree | Filter available items |
| `idx_customers_phone_unique` | `customers` | `phone WHERE NOT NULL` | Partial Unique | Unique non-null phones |
| `idx_customers_email_unique` | `customers` | `email WHERE NOT NULL` | Partial Unique | Unique non-null emails |
| `idx_orders_status` | `orders` | `status` | B-Tree | Filter active/pending orders |
| `idx_orders_created_at` | `orders` | `created_at DESC` | B-Tree | Recent orders pagination |
| `idx_orders_table_id` | `orders` | `table_id` | B-Tree | Orders per table lookup |
| `idx_order_items_order_id` | `order_items` | `order_id` | B-Tree | Line items for an order |
| `idx_order_items_menu_item_id` | `order_items` | `menu_item_id` | B-Tree | Sales per menu item |
| `idx_payments_paid_at` | `payments` | `paid_at DESC` | B-Tree | Revenue reports by time |
| `idx_payments_method` | `payments` | `payment_method` | B-Tree | Payment method analytics |
| `idx_reservations_table_time` | `reservations` | `(table_id, reservation_time)` | B-Tree | Conflict detection query |
| `idx_reservations_status_time` | `reservations` | `(status, reservation_time)` | B-Tree | Active/future booking filter |

---

## 6 · EER Specialisation & Additional Constraints

### 6.1 Attribute Constraints (CHECK)

| Table | Column | Constraint |
|---|---|---|
| `categories` | `name` | `BTRIM(name) <> ''` |
| `customers` | `name` | `BTRIM(name) <> ''` |
| `restaurant_tables` | `table_number` | `> 0` |
| `restaurant_tables` | `capacity` | `> 0` |
| `restaurant_tables` | `status` | `IN ('available', 'occupied', 'reserved', 'maintenance')` |
| `menu_items` | `name` | `BTRIM(name) <> ''` |
| `menu_items` | `price` | `> 0` |
| `orders` | `status` | `IN ('pending', 'preparing', 'served', 'paid', 'cancelled')` |
| `order_items` | `quantity` | `> 0` |
| `order_items` | `unit_price_at_order` | `> 0` |
| `order_status_history` | `old_status` | `NULL OR IN (status enum values)` |
| `order_status_history` | `new_status` | `IN (status enum values)` |
| `payments` | `amount` | `> 0` |
| `payments` | `payment_method` | `IN ('cash', 'card', 'upi')` |
| `payments` | `payment_status` | `IN ('pending', 'completed', 'refunded')` |
| `reservations` | `guest_count` | `> 0` |
| `reservations` | `status` | `IN ('booked', 'completed', 'cancelled')` |

### 6.2 Composite Unique Constraints

| Table | Columns | Meaning |
|---|---|---|
| `menu_items` | `(name, category_id)` | Same dish name allowed in different categories |
| `order_items` | `(order_id, menu_item_id)` | One line per item per order (quantity field aggregates) |
| `payments` | `order_id` | One payment record per order (1:0..1 via UNIQUE FK) |

### 6.3 Application-Level Business Rules (Not in SQL)

| Rule | Where Enforced |
|---|---|
| Order status can only advance forward (`pending→preparing→served→paid`) | `backend/routes/orders.js` |
| Cancellation only allowed before `paid` | `backend/routes/orders.js` |
| `restaurant_tables.status` computed from active orders & bookings | App logic on every order/reservation change |
| Reservation conflict: same table cannot overlap within ±90 minutes | `backend/services/reservationService.js` |
| Order must contain ≥1 item before it can be placed | `backend/routes/orders.js` |

---

## 7 · Entity Descriptions

| Entity | Role | Walk-in Support |
|---|---|---|
| **categories** | Groups menu items (Starters, Mains, Desserts, Beverages) | — |
| **customers** | Registered customers; optional on orders (walk-ins) | ✅ via nullable FK |
| **restaurant_tables** | Physical dining tables with capacity & status | — |
| **menu_items** | Dishes/drinks with price and availability flag | — |
| **orders** | Core transaction linking a table (and optionally a customer) to items | ✅ customer optional |
| **order_items** | Associative entity (M:N resolution) storing quantity + price snapshot | — |
| **order_status_history** | Temporal audit log for every order status transition | — |
| **payments** | Final payment record; at most one per order | — |
| **reservations** | Future table booking; always requires a registered customer | ❌ customer mandatory |

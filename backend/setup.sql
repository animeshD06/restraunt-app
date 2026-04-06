DROP SCHEMA IF EXISTS restaurant_app CASCADE;
CREATE SCHEMA restaurant_app;
SET search_path TO restaurant_app, public;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE categories (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (BTRIM(name) <> '')
);

CREATE TABLE customers (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(120),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (BTRIM(name) <> '')
);

CREATE TABLE restaurant_tables (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  table_number INTEGER NOT NULL UNIQUE,
  capacity INTEGER NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'available',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (table_number > 0),
  CHECK (capacity > 0),
  CHECK (status IN ('available', 'occupied', 'reserved', 'maintenance'))
);

CREATE TABLE menu_items (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  price NUMERIC(10, 2) NOT NULL,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  available BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT menu_items_name_category_unique UNIQUE (name, category_id),
  CONSTRAINT menu_items_name_not_blank CHECK (BTRIM(name) <> ''),
  CONSTRAINT menu_items_price_positive CHECK (price > 0)
);

CREATE TABLE orders (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  table_id INTEGER NOT NULL REFERENCES restaurant_tables(id) ON DELETE RESTRICT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (status IN ('pending', 'preparing', 'served', 'paid', 'cancelled'))
);

CREATE TABLE order_items (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id INTEGER NOT NULL REFERENCES menu_items(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL,
  unit_price_at_order NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT order_items_quantity_positive CHECK (quantity > 0),
  CONSTRAINT order_items_price_positive CHECK (unit_price_at_order > 0),
  CONSTRAINT order_items_unique_line UNIQUE (order_id, menu_item_id)
);

CREATE TABLE order_status_history (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  old_status VARCHAR(20),
  new_status VARCHAR(20) NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (old_status IS NULL OR old_status IN ('pending', 'preparing', 'served', 'paid', 'cancelled')),
  CHECK (new_status IN ('pending', 'preparing', 'served', 'paid', 'cancelled'))
);

CREATE TABLE payments (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id INTEGER NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  amount NUMERIC(10, 2) NOT NULL,
  payment_method VARCHAR(20) NOT NULL,
  payment_status VARCHAR(20) NOT NULL DEFAULT 'completed',
  paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (amount > 0),
  CHECK (payment_method IN ('cash', 'card', 'upi')),
  CHECK (payment_status IN ('pending', 'completed', 'refunded'))
);

CREATE TABLE reservations (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  table_id INTEGER NOT NULL REFERENCES restaurant_tables(id) ON DELETE RESTRICT,
  reservation_time TIMESTAMPTZ NOT NULL,
  guest_count INTEGER NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'booked',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (guest_count > 0),
  CHECK (status IN ('booked', 'completed', 'cancelled'))
);

CREATE INDEX idx_menu_items_category_id ON menu_items(category_id);
CREATE INDEX idx_menu_items_available ON menu_items(available);
CREATE UNIQUE INDEX idx_customers_phone_unique ON customers(phone) WHERE phone IS NOT NULL;
CREATE UNIQUE INDEX idx_customers_email_unique ON customers(email) WHERE email IS NOT NULL;
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX idx_orders_table_id ON orders(table_id);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_menu_item_id ON order_items(menu_item_id);
CREATE INDEX idx_payments_paid_at ON payments(paid_at DESC);
CREATE INDEX idx_payments_method ON payments(payment_method);
CREATE INDEX idx_reservations_table_time ON reservations(table_id, reservation_time);
CREATE INDEX idx_reservations_status_time ON reservations(status, reservation_time);

CREATE TRIGGER trg_customers_updated_at
BEFORE UPDATE ON customers
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_tables_updated_at
BEFORE UPDATE ON restaurant_tables
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_menu_items_updated_at
BEFORE UPDATE ON menu_items
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_orders_updated_at
BEFORE UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_reservations_updated_at
BEFORE UPDATE ON reservations
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

INSERT INTO categories (name)
VALUES
  ('Starters'),
  ('Mains'),
  ('Desserts'),
  ('Beverages');

INSERT INTO restaurant_tables (table_number, capacity, status)
VALUES
  (1, 2, 'available'),
  (2, 2, 'available'),
  (3, 4, 'available'),
  (4, 4, 'available'),
  (5, 4, 'available'),
  (6, 6, 'available'),
  (7, 6, 'available'),
  (8, 8, 'available');

INSERT INTO menu_items (name, price, category_id, available)
SELECT seed.name, seed.price, c.id, seed.available
FROM (
  VALUES
    ('Garlic Bread', 4.99::NUMERIC(10, 2), 'Starters', TRUE),
    ('Tomato Soup', 3.99::NUMERIC(10, 2), 'Starters', TRUE),
    ('Grilled Steak', 19.99::NUMERIC(10, 2), 'Mains', TRUE),
    ('Spaghetti Carbonara', 14.99::NUMERIC(10, 2), 'Mains', TRUE),
    ('Cheesecake', 6.99::NUMERIC(10, 2), 'Desserts', TRUE),
    ('Ice Cream', 4.99::NUMERIC(10, 2), 'Desserts', TRUE),
    ('Coke', 1.99::NUMERIC(10, 2), 'Beverages', TRUE),
    ('Coffee', 2.49::NUMERIC(10, 2), 'Beverages', TRUE)
) AS seed(name, price, category_name, available)
JOIN categories c ON c.name = seed.category_name;

INSERT INTO customers (name, phone, email)
VALUES
  ('Walk-in Guest', NULL, NULL),
  ('Aarav Sharma', '9876543210', 'aarav@example.com'),
  ('Diya Patel', '9876501234', 'diya@example.com');

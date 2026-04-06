const express = require('express');
const router = express.Router();
const db = require('../db');
const { findOrCreateCustomer } = require('../services/customers');
const { syncTableStatus } = require('../services/table-status');

const ACTIVE_ORDER_STATUSES = ['pending', 'preparing', 'served'];
const PAYMENT_METHODS = ['cash', 'card', 'upi'];

function normalizeItems(items = []) {
  const merged = new Map();

  for (const item of items) {
    const menuItemId = Number(item.menu_item_id);
    const quantity = Number(item.quantity);

    if (!Number.isInteger(menuItemId) || !Number.isInteger(quantity) || quantity <= 0) {
      return null;
    }

    merged.set(menuItemId, (merged.get(menuItemId) || 0) + quantity);
  }

  return Array.from(merged.entries()).map(([menu_item_id, quantity]) => ({
    menu_item_id,
    quantity,
  }));
}

function isValidStatusTransition(currentStatus, nextStatus) {
  const allowedTransitions = {
    pending: ['preparing', 'cancelled'],
    preparing: ['served', 'cancelled'],
    served: ['paid'],
    paid: [],
    cancelled: [],
  };

  return allowedTransitions[currentStatus]?.includes(nextStatus);
}

async function getOrderWithSummary(connection, orderId) {
  const [rows] = await connection.query(
    `
      SELECT
        o.id,
        o.status,
        o.notes,
        o.created_at,
        o.updated_at,
        rt.id AS table_id,
        rt.table_number,
        rt.capacity AS table_capacity,
        c.id AS customer_id,
        c.name AS customer_name,
        c.phone AS customer_phone,
        c.email AS customer_email,
        COALESCE(totals.total_amount, 0) AS total_amount,
        p.id AS payment_id,
        p.payment_method,
        p.payment_status,
        p.paid_at
      FROM orders o
      JOIN restaurant_tables rt ON o.table_id = rt.id
      LEFT JOIN customers c ON o.customer_id = c.id
      LEFT JOIN (
        SELECT order_id, SUM(quantity * unit_price_at_order) AS total_amount
        FROM order_items
        GROUP BY order_id
      ) totals ON totals.order_id = o.id
      LEFT JOIN payments p ON o.id = p.order_id
      WHERE o.id = ?
    `,
    [orderId]
  );

  return rows[0] || null;
}

// GET /orders
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        o.id,
        o.status,
        o.notes,
        o.created_at,
        rt.id AS table_id,
        rt.table_number,
        c.name AS customer_name,
        c.phone AS customer_phone,
        COALESCE(totals.total_amount, 0) AS total_amount,
        p.payment_method,
        p.payment_status,
        p.paid_at
      FROM orders o
      JOIN restaurant_tables rt ON o.table_id = rt.id
      LEFT JOIN customers c ON o.customer_id = c.id
      LEFT JOIN (
        SELECT order_id, SUM(quantity * unit_price_at_order) AS total_amount
        FROM order_items
        GROUP BY order_id
      ) totals ON totals.order_id = o.id
      LEFT JOIN payments p ON o.id = p.order_id
      ORDER BY o.created_at DESC
    `);
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// GET /orders/:id/items
router.get('/:id/items', async (req, res) => {
  try {
    const [rows] = await db.query(
      `
        SELECT oi.*, mi.name AS menu_item_name, oi.unit_price_at_order AS price
        FROM order_items oi
        JOIN menu_items mi ON oi.menu_item_id = mi.id
        WHERE oi.order_id = ?
        ORDER BY oi.id ASC
      `,
      [req.params.id]
    );
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch order items' });
  }
});

// POST /orders
router.post('/', async (req, res) => {
  const { table_id, table_number, items, customer_name, customer_phone, customer_email, notes } = req.body;
  const normalizedItems = normalizeItems(items);
  const normalizedTableId = Number(table_id);
  const normalizedTableNumber = Number(table_number);
  const connection = await db.getConnection();

  try {
    if (!normalizedItems || normalizedItems.length === 0) {
      return res.status(400).json({ error: 'At least one valid order item is required' });
    }

    await connection.beginTransaction();

    let tableRow = null;
    if (Number.isInteger(normalizedTableId) && normalizedTableId > 0) {
      [tableRow] = await connection.query('SELECT * FROM restaurant_tables WHERE id = ?', [normalizedTableId]);
    } else if (Number.isInteger(normalizedTableNumber) && normalizedTableNumber > 0) {
      [tableRow] = await connection.query('SELECT * FROM restaurant_tables WHERE table_number = ?', [normalizedTableNumber]);
    } else {
      await connection.rollback();
      return res.status(400).json({ error: 'A valid table is required' });
    }

    const selectedTable = tableRow?.[0];
    if (!selectedTable) {
      await connection.rollback();
      return res.status(404).json({ error: 'Table not found' });
    }

    if (selectedTable.status === 'maintenance' || selectedTable.status === 'occupied') {
      await connection.rollback();
      return res.status(400).json({ error: 'Selected table is not currently available' });
    }

    const menuItemIds = normalizedItems.map((item) => item.menu_item_id);
    const placeholders = menuItemIds.map(() => '?').join(', ');
    const [menuRows] = await connection.query(
      `
        SELECT id, name, price, available
        FROM menu_items
        WHERE id IN (${placeholders})
      `,
      menuItemIds
    );

    if (menuRows.length !== menuItemIds.length) {
      await connection.rollback();
      return res.status(400).json({ error: 'One or more menu items do not exist' });
    }

    const menuById = new Map(menuRows.map((row) => [row.id, row]));
    const unavailableItem = normalizedItems.find((item) => !menuById.get(item.menu_item_id)?.available);
    if (unavailableItem) {
      await connection.rollback();
      return res.status(400).json({
        error: `Menu item is unavailable: ${menuById.get(unavailableItem.menu_item_id).name}`,
      });
    }

    const customer = await findOrCreateCustomer(connection, {
      name: customer_name,
      phone: customer_phone,
      email: customer_email,
    });

    const [orderResult] = await connection.query(
      'INSERT INTO orders (customer_id, table_id, notes) VALUES (?, ?, ?)',
      [customer?.id || null, selectedTable.id, notes?.trim() || null]
    );
    const orderId = orderResult.insertId;

    for (const item of normalizedItems) {
      const menuItem = menuById.get(item.menu_item_id);
      await connection.query(
        `
          INSERT INTO order_items (order_id, menu_item_id, quantity, unit_price_at_order)
          VALUES (?, ?, ?, ?)
        `,
        [orderId, item.menu_item_id, item.quantity, menuItem.price]
      );
    }

    await connection.query(
      'INSERT INTO order_status_history (order_id, old_status, new_status) VALUES (?, ?, ?)',
      [orderId, null, 'pending']
    );
    await syncTableStatus(connection, selectedTable.id);
    const order = await getOrderWithSummary(connection, orderId);

    await connection.commit();
    res.status(201).json(order);
  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ error: 'Failed to create order' });
  } finally {
    connection.release();
  }
});

// PUT /orders/:id
router.put('/:id', async (req, res) => {
  const { status } = req.body;
  if (!db.STATUS_VALUES.includes(status)) {
    return res.status(400).json({ error: 'Invalid order status' });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const order = await getOrderWithSummary(connection, req.params.id);
    if (!order) {
      await connection.rollback();
      return res.status(404).json({ error: 'Order not found' });
    }

    if (!isValidStatusTransition(order.status, status)) {
      await connection.rollback();
      return res.status(400).json({ error: `Cannot change order from ${order.status} to ${status}` });
    }

    await connection.query('UPDATE orders SET status = ? WHERE id = ?', [status, req.params.id]);
    await connection.query(
      'INSERT INTO order_status_history (order_id, old_status, new_status) VALUES (?, ?, ?)',
      [req.params.id, order.status, status]
    );
    await syncTableStatus(connection, order.table_id);

    const updatedOrder = await getOrderWithSummary(connection, req.params.id);
    await connection.commit();
    res.json({ success: true, order: updatedOrder });
  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ error: 'Failed to update order status' });
  } finally {
    connection.release();
  }
});

// DELETE /orders/:id
router.delete('/:id', async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const order = await getOrderWithSummary(connection, req.params.id);
    if (!order) {
      await connection.rollback();
      return res.status(404).json({ error: 'Order not found' });
    }

    if (!ACTIVE_ORDER_STATUSES.includes(order.status)) {
      await connection.rollback();
      return res.status(400).json({ error: 'Only active orders can be cancelled' });
    }

    await connection.query('UPDATE orders SET status = ? WHERE id = ?', ['cancelled', req.params.id]);
    await connection.query(
      'INSERT INTO order_status_history (order_id, old_status, new_status) VALUES (?, ?, ?)',
      [req.params.id, order.status, 'cancelled']
    );
    await syncTableStatus(connection, order.table_id);

    await connection.commit();
    res.json({ success: true });
  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ error: 'Failed to cancel order' });
  } finally {
    connection.release();
  }
});

// GET /orders/:id/bill
router.get('/:id/bill', async (req, res) => {
  try {
    const order = await getOrderWithSummary(db, req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const [rows] = await db.query(
      `
        SELECT
          mi.name,
          oi.quantity,
          oi.unit_price_at_order AS price,
          (oi.quantity * oi.unit_price_at_order) AS subtotal
        FROM order_items oi
        JOIN menu_items mi ON oi.menu_item_id = mi.id
        WHERE oi.order_id = ?
        ORDER BY oi.id ASC
      `,
      [req.params.id]
    );

    const total = rows.reduce((sum, row) => sum + Number(row.subtotal), 0);
    res.json({ order, items: rows, total });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to calculate bill' });
  }
});

// POST /orders/:id/payment
router.post('/:id/payment', async (req, res) => {
  const { payment_method } = req.body;
  if (!PAYMENT_METHODS.includes(payment_method)) {
    return res.status(400).json({ error: 'Invalid payment method' });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const order = await getOrderWithSummary(connection, req.params.id);

    if (!order) {
      await connection.rollback();
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.payment_id) {
      await connection.rollback();
      return res.status(400).json({ error: 'Payment already recorded for this order' });
    }

    if (order.status !== 'served') {
      await connection.rollback();
      return res.status(400).json({ error: 'Only served orders can be paid' });
    }

    await connection.query(
      `
        INSERT INTO payments (order_id, amount, payment_method, payment_status)
        VALUES (?, ?, ?, 'completed')
      `,
      [req.params.id, order.total_amount, payment_method]
    );
    await connection.query('UPDATE orders SET status = ? WHERE id = ?', ['paid', req.params.id]);
    await connection.query(
      'INSERT INTO order_status_history (order_id, old_status, new_status) VALUES (?, ?, ?)',
      [req.params.id, order.status, 'paid']
    );
    await syncTableStatus(connection, order.table_id);

    const updatedOrder = await getOrderWithSummary(connection, req.params.id);
    await connection.commit();
    res.status(201).json({ success: true, order: updatedOrder });
  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ error: 'Failed to record payment' });
  } finally {
    connection.release();
  }
});

module.exports = router;

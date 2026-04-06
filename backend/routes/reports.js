const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /reports/revenue - Daily revenue report
router.get('/revenue', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        CAST(p.paid_at AS DATE) AS date,
        SUM(p.amount) AS daily_revenue
      FROM payments p
      WHERE p.payment_status = 'completed'
      GROUP BY CAST(p.paid_at AS DATE)
      ORDER BY date DESC
    `);
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch revenue report' });
  }
});

// GET /reports/popular - Most popular dishes
router.get('/popular', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        mi.name,
        SUM(oi.quantity) AS total_ordered
      FROM order_items oi
      JOIN menu_items mi ON oi.menu_item_id = mi.id
      GROUP BY mi.id, mi.name
      ORDER BY total_ordered DESC, mi.name ASC
      LIMIT 10
    `);
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch popular items report' });
  }
});

// GET /reports/payments - Payment method mix
router.get('/payments', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        payment_method,
        COUNT(*)::INT AS payments_count,
        SUM(amount) AS total_amount
      FROM payments
      WHERE payment_status = 'completed'
      GROUP BY payment_method
      ORDER BY total_amount DESC
    `);
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch payment report' });
  }
});

// GET /reports/tables - Table usage summary
router.get('/tables', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        rt.table_number,
        rt.capacity,
        rt.status,
        COALESCE(order_counts.total_orders, 0) AS total_orders,
        COALESCE(reservation_counts.total_reservations, 0) AS total_reservations
      FROM restaurant_tables rt
      LEFT JOIN (
        SELECT table_id, COUNT(*)::INT AS total_orders
        FROM orders
        GROUP BY table_id
      ) order_counts ON order_counts.table_id = rt.id
      LEFT JOIN (
        SELECT table_id, COUNT(*)::INT AS total_reservations
        FROM reservations
        GROUP BY table_id
      ) reservation_counts ON reservation_counts.table_id = rt.id
      ORDER BY rt.table_number ASC
    `);
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch table utilization report' });
  }
});

module.exports = router;

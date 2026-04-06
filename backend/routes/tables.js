const express = require('express');
const router = express.Router();
const db = require('../db');
const { syncTableStatus } = require('../services/table-status');

// GET /tables
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        rt.*,
        COALESCE(active_orders.active_order_count, 0) AS active_order_count,
        upcoming.next_reservation_time
      FROM restaurant_tables rt
      LEFT JOIN (
        SELECT table_id, COUNT(*)::INT AS active_order_count
        FROM orders
        WHERE status IN ('pending', 'preparing', 'served')
        GROUP BY table_id
      ) active_orders ON active_orders.table_id = rt.id
      LEFT JOIN (
        SELECT table_id, MIN(reservation_time) AS next_reservation_time
        FROM reservations
        WHERE status = 'booked' AND reservation_time >= NOW()
        GROUP BY table_id
      ) upcoming ON upcoming.table_id = rt.id
      ORDER BY rt.table_number ASC
    `);
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch tables' });
  }
});

// PUT /tables/:id/status
router.put('/:id/status', async (req, res) => {
  const { status } = req.body;
  if (!['available', 'occupied', 'reserved', 'maintenance'].includes(status)) {
    return res.status(400).json({ error: 'Invalid table status' });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [rows] = await connection.query('SELECT * FROM restaurant_tables WHERE id = ?', [req.params.id]);
    const table = rows[0];
    if (!table) {
      await connection.rollback();
      return res.status(404).json({ error: 'Table not found' });
    }

    if (status === 'maintenance') {
      const [activeOrders] = await connection.query(
        `
          SELECT COUNT(*)::INT AS count
          FROM orders
          WHERE table_id = ?
            AND status IN ('pending', 'preparing', 'served')
        `,
        [req.params.id]
      );

      if ((activeOrders[0]?.count || 0) > 0) {
        await connection.rollback();
        return res.status(400).json({ error: 'Cannot set table to maintenance while an order is active' });
      }
    }

    await connection.query('UPDATE restaurant_tables SET status = ? WHERE id = ?', [status, req.params.id]);
    if (status !== 'maintenance') {
      await syncTableStatus(connection, req.params.id);
    }

    const [updatedRows] = await connection.query('SELECT * FROM restaurant_tables WHERE id = ?', [req.params.id]);
    await connection.commit();
    res.json(updatedRows[0]);
  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ error: 'Failed to update table status' });
  } finally {
    connection.release();
  }
});

module.exports = router;

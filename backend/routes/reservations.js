const express = require('express');
const router = express.Router();
const db = require('../db');
const { findOrCreateCustomer } = require('../services/customers');
const { syncTableStatus } = require('../services/table-status');

// GET /reservations
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        r.*,
        c.name AS customer_name,
        c.phone AS customer_phone,
        rt.table_number,
        rt.capacity AS table_capacity
      FROM reservations r
      JOIN customers c ON r.customer_id = c.id
      JOIN restaurant_tables rt ON r.table_id = rt.id
      ORDER BY r.reservation_time ASC
    `);
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch reservations' });
  }
});

// POST /reservations
router.post('/', async (req, res) => {
  const { customer_name, customer_phone, customer_email, table_id, guest_count, reservation_time, notes } = req.body;
  const normalizedTableId = Number(table_id);
  const normalizedGuestCount = Number(guest_count);
  const reservationDate = new Date(reservation_time);

  if (!Number.isInteger(normalizedTableId) || normalizedTableId <= 0) {
    return res.status(400).json({ error: 'A valid table is required' });
  }

  if (!Number.isInteger(normalizedGuestCount) || normalizedGuestCount <= 0) {
    return res.status(400).json({ error: 'Guest count must be greater than zero' });
  }

  if (Number.isNaN(reservationDate.getTime())) {
    return res.status(400).json({ error: 'Reservation time is invalid' });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const customer = await findOrCreateCustomer(connection, {
      name: customer_name,
      phone: customer_phone,
      email: customer_email,
    });

    if (!customer) {
      await connection.rollback();
      return res.status(400).json({ error: 'Customer details are required' });
    }

    const [tableRows] = await connection.query('SELECT * FROM restaurant_tables WHERE id = ?', [normalizedTableId]);
    const table = tableRows[0];

    if (!table) {
      await connection.rollback();
      return res.status(404).json({ error: 'Table not found' });
    }

    if (table.status === 'maintenance') {
      await connection.rollback();
      return res.status(400).json({ error: 'Table is under maintenance' });
    }

    if (normalizedGuestCount > table.capacity) {
      await connection.rollback();
      return res.status(400).json({ error: 'Guest count exceeds table capacity' });
    }

    const [conflicts] = await connection.query(
      `
        SELECT id
        FROM reservations
        WHERE table_id = ?
          AND status = 'booked'
          AND reservation_time BETWEEN (?::timestamptz - INTERVAL '90 minutes')
                                  AND (?::timestamptz + INTERVAL '90 minutes')
      `,
      [normalizedTableId, reservationDate.toISOString(), reservationDate.toISOString()]
    );

    if (conflicts.length > 0) {
      await connection.rollback();
      return res.status(400).json({ error: 'Table already has a nearby reservation slot booked' });
    }

    const [result] = await connection.query(
      `
        INSERT INTO reservations (customer_id, table_id, reservation_time, guest_count, notes)
        VALUES (?, ?, ?, ?, ?)
      `,
      [customer.id, normalizedTableId, reservationDate.toISOString(), normalizedGuestCount, notes?.trim() || null]
    );

    await syncTableStatus(connection, normalizedTableId);
    const [rows] = await connection.query(
      `
        SELECT
          r.*,
          c.name AS customer_name,
          c.phone AS customer_phone,
          rt.table_number,
          rt.capacity AS table_capacity
        FROM reservations r
        JOIN customers c ON r.customer_id = c.id
        JOIN restaurant_tables rt ON r.table_id = rt.id
        WHERE r.id = ?
      `,
      [result.insertId]
    );

    await connection.commit();
    res.status(201).json(rows[0]);
  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ error: 'Failed to create reservation' });
  } finally {
    connection.release();
  }
});

// PUT /reservations/:id/status
router.put('/:id/status', async (req, res) => {
  const { status } = req.body;
  if (!['booked', 'completed', 'cancelled'].includes(status)) {
    return res.status(400).json({ error: 'Invalid reservation status' });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [rows] = await connection.query('SELECT * FROM reservations WHERE id = ?', [req.params.id]);
    const reservation = rows[0];
    if (!reservation) {
      await connection.rollback();
      return res.status(404).json({ error: 'Reservation not found' });
    }

    await connection.query('UPDATE reservations SET status = ? WHERE id = ?', [status, req.params.id]);
    await syncTableStatus(connection, reservation.table_id);

    const [updatedRows] = await connection.query('SELECT * FROM reservations WHERE id = ?', [req.params.id]);
    await connection.commit();
    res.json(updatedRows[0]);
  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ error: 'Failed to update reservation status' });
  } finally {
    connection.release();
  }
});

module.exports = router;

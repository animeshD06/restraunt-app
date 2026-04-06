const express = require('express');
const router = express.Router();
const db = require('../db');

const TABLES = [
  'categories',
  'customers',
  'restaurant_tables',
  'menu_items',
  'orders',
  'order_items',
  'order_status_history',
  'payments',
  'reservations',
];

router.get('/database', async (req, res) => {
  try {
    const results = {};

    for (const tableName of TABLES) {
      const [rows] = await db.query(`SELECT * FROM ${tableName} ORDER BY id ASC`);
      results[tableName] = rows;
    }

    res.json({
      mode: process.env.USE_PG_MEM === 'true' ? 'in-memory' : 'postgresql',
      tables: results,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to inspect database' });
  }
});

module.exports = router;

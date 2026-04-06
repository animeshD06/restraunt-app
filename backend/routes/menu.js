const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /menu - View full menu by category
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT m.id, m.name, m.price, m.available, c.name as category_name, c.id as category_id
      FROM menu_items m
      JOIN categories c ON m.category_id = c.id
      ORDER BY c.name, m.name
    `);
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch menu', details: error.message });
  }
});

// GET /menu/categories
router.get('/categories', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM categories ORDER BY name');
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// POST /menu - Add an item
router.post('/', async (req, res) => {
  const { name, price, category_id, available } = req.body;
  const normalizedName = typeof name === 'string' ? name.trim() : '';
  const normalizedPrice = Number(price);
  const normalizedCategoryId = Number(category_id);

  if (!normalizedName) {
    return res.status(400).json({ error: 'Menu item name is required' });
  }

  if (!Number.isFinite(normalizedPrice) || normalizedPrice <= 0) {
    return res.status(400).json({ error: 'Menu item price must be greater than zero' });
  }

  if (!Number.isInteger(normalizedCategoryId) || normalizedCategoryId <= 0) {
    return res.status(400).json({ error: 'A valid category is required' });
  }

  try {
    const [result] = await db.query(
      'INSERT INTO menu_items (name, price, category_id, available) VALUES (?, ?, ?, ?)',
      [normalizedName, normalizedPrice, normalizedCategoryId, available !== undefined ? available : true]
    );
    res.status(201).json({
      id: result.insertId,
      name: normalizedName,
      price: normalizedPrice,
      category_id: normalizedCategoryId,
      available: available !== undefined ? available : true,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to add menu item' });
  }
});

// PUT /menu/:id - Update availability
router.put('/:id', async (req, res) => {
  const { available } = req.body;
  if (typeof available !== 'boolean') {
    return res.status(400).json({ error: 'Availability must be a boolean value' });
  }

  try {
    const [result] = await db.query('UPDATE menu_items SET available = ? WHERE id = ?', [available, req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Menu item not found' });
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update menu item' });
  }
});

module.exports = router;

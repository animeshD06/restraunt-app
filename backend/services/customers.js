async function findOrCreateCustomer(connection, { name, phone, email } = {}) {
  const normalizedName = typeof name === 'string' ? name.trim() : '';
  const normalizedPhone = typeof phone === 'string' ? phone.trim() : '';
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

  if (!normalizedName && !normalizedPhone && !normalizedEmail) {
    return null;
  }

  if (normalizedPhone) {
    const [phoneMatches] = await connection.query('SELECT * FROM customers WHERE phone = ?', [normalizedPhone]);
    if (phoneMatches[0]) return phoneMatches[0];
  }

  if (normalizedEmail) {
    const [emailMatches] = await connection.query('SELECT * FROM customers WHERE email = ?', [normalizedEmail]);
    if (emailMatches[0]) return emailMatches[0];
  }

  if (normalizedName) {
    const [nameMatches] = await connection.query(
      'SELECT * FROM customers WHERE LOWER(name) = LOWER(?) ORDER BY id ASC LIMIT 1',
      [normalizedName]
    );
    if (nameMatches[0]) return nameMatches[0];
  }

  const [result] = await connection.query(
    'INSERT INTO customers (name, phone, email) VALUES (?, ?, ?)',
    [normalizedName || 'Walk-in Guest', normalizedPhone || null, normalizedEmail || null]
  );

  const [rows] = await connection.query('SELECT * FROM customers WHERE id = ?', [result.insertId]);
  return rows[0] || null;
}

module.exports = {
  findOrCreateCustomer,
};

async function syncTableStatus(connection, tableId) {
  const [activeOrders] = await connection.query(
    `
      SELECT COUNT(*)::INT AS count
      FROM orders
      WHERE table_id = ?
        AND status IN ('pending', 'preparing', 'served')
    `,
    [tableId]
  );

  let nextStatus = 'available';

  if ((activeOrders[0]?.count || 0) > 0) {
    nextStatus = 'occupied';
  } else {
    const [futureReservations] = await connection.query(
      `
        SELECT COUNT(*)::INT AS count
        FROM reservations
        WHERE table_id = ?
          AND status = 'booked'
          AND reservation_time >= NOW()
      `,
      [tableId]
    );

    if ((futureReservations[0]?.count || 0) > 0) {
      nextStatus = 'reserved';
    }
  }

  await connection.query('UPDATE restaurant_tables SET status = ? WHERE id = ?', [nextStatus, tableId]);
  return nextStatus;
}

module.exports = {
  syncTableStatus,
};

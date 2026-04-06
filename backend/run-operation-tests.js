const fs = require('fs/promises');
const path = require('path');

process.env.USE_PG_MEM = 'true';
process.env.PORT = '0';

const { startServer } = require('./server');
const db = require('./db');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function request(baseUrl, method, route, body) {
  const response = await fetch(`${baseUrl}${route}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch (error) {
    data = text;
  }

  return {
    status: response.status,
    ok: response.ok,
    data,
  };
}

async function run() {
  const reportLines = [];
  const record = (title, details) => {
    reportLines.push(`${title}`);
    reportLines.push(details);
    reportLines.push('');
  };

  const server = startServer(0);

  try {
    await new Promise((resolve) => server.once('listening', resolve));
    const address = server.address();
    const baseUrl = `http://127.0.0.1:${address.port}`;

    record('Environment', `Backend started in in-memory PostgreSQL test mode on ${baseUrl}`);

    const menuRes = await request(baseUrl, 'GET', '/menu');
    assert(menuRes.ok, 'GET /menu failed');
    assert(menuRes.data.length >= 8, 'Expected seeded menu items');
    record('GET /menu', `PASS - returned ${menuRes.data.length} menu items`);

    const tablesRes = await request(baseUrl, 'GET', '/tables');
    assert(tablesRes.ok, 'GET /tables failed');
    assert(tablesRes.data.length >= 8, 'Expected seeded tables');
    const table1 = tablesRes.data.find((table) => table.table_number === 1);
    const table2 = tablesRes.data.find((table) => table.table_number === 2);
    const table8 = tablesRes.data.find((table) => table.table_number === 8);
    assert(table1 && table2 && table8, 'Expected seeded tables 1, 2, and 8');
    record('GET /tables', `PASS - returned ${tablesRes.data.length} tables`);

    const maintenanceRes = await request(baseUrl, 'PUT', `/tables/${table8.id}/status`, { status: 'maintenance' });
    assert(maintenanceRes.ok, 'PUT /tables/:id/status failed');
    assert(maintenanceRes.data.status === 'maintenance', 'Table 8 should be maintenance');
    record('PUT /tables/:id/status', `PASS - table ${table8.table_number} marked maintenance`);

    const blockedOrderRes = await request(baseUrl, 'POST', '/orders', {
      table_id: table8.id,
      customer_name: 'Blocked Table Test',
      items: [{ menu_item_id: menuRes.data[0].id, quantity: 1 }],
    });
    assert(blockedOrderRes.status === 400, 'Order should be rejected for maintenance table');
    record('POST /orders on maintenance table', 'PASS - rejected with HTTP 400 as expected');

    const reservationTime = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const reservationRes = await request(baseUrl, 'POST', '/reservations', {
      customer_name: 'Reservation Guest',
      customer_phone: '9000000001',
      table_id: table2.id,
      guest_count: 2,
      reservation_time: reservationTime,
      notes: 'Window seat preferred',
    });
    assert(reservationRes.ok, 'POST /reservations failed');
    assert(reservationRes.data.status === 'booked', 'Reservation should be booked');
    record('POST /reservations', `PASS - reservation ${reservationRes.data.id} created for table ${reservationRes.data.table_number}`);

    const duplicateReservationRes = await request(baseUrl, 'POST', '/reservations', {
      customer_name: 'Reservation Conflict',
      customer_phone: '9000000002',
      table_id: table2.id,
      guest_count: 2,
      reservation_time: reservationTime,
    });
    assert(duplicateReservationRes.status === 400, 'Conflicting reservation should be rejected');
    record('POST /reservations conflicting slot', 'PASS - conflicting reservation rejected with HTTP 400');

    const reservationsListRes = await request(baseUrl, 'GET', '/reservations');
    assert(reservationsListRes.ok, 'GET /reservations failed');
    assert(reservationsListRes.data.length >= 1, 'Expected at least one reservation');
    record('GET /reservations', `PASS - returned ${reservationsListRes.data.length} reservation(s)`);

    const orderRes = await request(baseUrl, 'POST', '/orders', {
      table_id: table1.id,
      customer_name: 'Order Guest',
      customer_phone: '9000000003',
      notes: 'Less spicy',
      items: [
        { menu_item_id: menuRes.data[0].id, quantity: 2 },
        { menu_item_id: menuRes.data[2].id, quantity: 1 },
      ],
    });
    assert(orderRes.ok, 'POST /orders failed');
    assert(orderRes.data.status === 'pending', 'Order should start pending');
    const orderId = orderRes.data.id;
    record('POST /orders', `PASS - order ${orderId} created for table ${orderRes.data.table_number}`);

    const ordersListRes = await request(baseUrl, 'GET', '/orders');
    assert(ordersListRes.ok, 'GET /orders failed');
    const createdOrder = ordersListRes.data.find((order) => order.id === orderId);
    assert(createdOrder, 'Created order not found in list');
    assert(Number(createdOrder.total_amount) > 0, 'Order total should be positive');
    record('GET /orders', `PASS - order ${orderId} visible with total ${createdOrder.total_amount}`);

    const itemsRes = await request(baseUrl, 'GET', `/orders/${orderId}/items`);
    assert(itemsRes.ok, 'GET /orders/:id/items failed');
    assert(itemsRes.data.length === 2, 'Expected 2 order line items');
    record('GET /orders/:id/items', `PASS - returned ${itemsRes.data.length} line items`);

    const toPreparingRes = await request(baseUrl, 'PUT', `/orders/${orderId}`, { status: 'preparing' });
    assert(toPreparingRes.ok, 'Transition to preparing failed');
    record('PUT /orders/:id preparing', `PASS - order moved to ${toPreparingRes.data.order.status}`);

    const invalidTransitionRes = await request(baseUrl, 'PUT', `/orders/${orderId}`, { status: 'paid' });
    assert(invalidTransitionRes.status === 400, 'Invalid status transition should fail');
    record('PUT /orders/:id invalid transition', 'PASS - invalid transition rejected with HTTP 400');

    const toServedRes = await request(baseUrl, 'PUT', `/orders/${orderId}`, { status: 'served' });
    assert(toServedRes.ok, 'Transition to served failed');
    record('PUT /orders/:id served', `PASS - order moved to ${toServedRes.data.order.status}`);

    const billBeforePaymentRes = await request(baseUrl, 'GET', `/orders/${orderId}/bill`);
    assert(billBeforePaymentRes.ok, 'GET /orders/:id/bill failed');
    assert(Number(billBeforePaymentRes.data.total) > 0, 'Bill total should be positive');
    record('GET /orders/:id/bill', `PASS - bill total ${billBeforePaymentRes.data.total}`);

    const paymentRes = await request(baseUrl, 'POST', `/orders/${orderId}/payment`, { payment_method: 'cash' });
    assert(paymentRes.ok, 'POST /orders/:id/payment failed');
    assert(paymentRes.data.order.status === 'paid', 'Order should become paid after payment');
    record('POST /orders/:id/payment', `PASS - payment recorded and order moved to ${paymentRes.data.order.status}`);

    const duplicatePaymentRes = await request(baseUrl, 'POST', `/orders/${orderId}/payment`, { payment_method: 'cash' });
    assert(duplicatePaymentRes.status === 400, 'Duplicate payment should fail');
    record('POST /orders/:id/payment duplicate', 'PASS - duplicate payment rejected with HTTP 400');

    const cancelPaidOrderRes = await request(baseUrl, 'DELETE', `/orders/${orderId}`);
    assert(cancelPaidOrderRes.status === 400, 'Paid order cancellation should fail');
    record('DELETE /orders/:id on paid order', 'PASS - cancellation rejected for paid order');

    const reservationCompleteRes = await request(baseUrl, 'PUT', `/reservations/${reservationRes.data.id}/status`, { status: 'completed' });
    assert(reservationCompleteRes.ok, 'Completing reservation failed');
    record('PUT /reservations/:id/status', `PASS - reservation moved to ${reservationCompleteRes.data.status}`);

    const revenueReportRes = await request(baseUrl, 'GET', '/reports/revenue');
    assert(revenueReportRes.ok, 'GET /reports/revenue failed');
    assert(revenueReportRes.data.length >= 1, 'Expected revenue data after payment');
    record('GET /reports/revenue', `PASS - returned ${revenueReportRes.data.length} revenue row(s)`);

    const popularReportRes = await request(baseUrl, 'GET', '/reports/popular');
    assert(popularReportRes.ok, 'GET /reports/popular failed');
    assert(popularReportRes.data.length >= 1, 'Expected popular item data');
    record('GET /reports/popular', `PASS - top item ${popularReportRes.data[0].name}`);

    const paymentsReportRes = await request(baseUrl, 'GET', '/reports/payments');
    assert(paymentsReportRes.ok, 'GET /reports/payments failed');
    assert(paymentsReportRes.data.some((row) => row.payment_method === 'cash'), 'Expected cash payment in report');
    record('GET /reports/payments', `PASS - payment methods covered: ${paymentsReportRes.data.map((row) => row.payment_method).join(', ')}`);

    const tableReportRes = await request(baseUrl, 'GET', '/reports/tables');
    assert(tableReportRes.ok, 'GET /reports/tables failed');
    assert(tableReportRes.data.length >= 8, 'Expected table utilization rows');
    record('GET /reports/tables', `PASS - returned ${tableReportRes.data.length} table utilization rows`);

    const tablesAfterRes = await request(baseUrl, 'GET', '/tables');
    assert(tablesAfterRes.ok, 'Final GET /tables failed');
    const finalTable1 = tablesAfterRes.data.find((table) => table.id === table1.id);
    const finalTable2 = tablesAfterRes.data.find((table) => table.id === table2.id);
    assert(finalTable1.status === 'available', 'Paid order should release table 1');
    assert(finalTable2.status === 'available', 'Completed reservation should release table 2');
    record('Final table state validation', 'PASS - occupied/reserved tables returned to available');

    const reportPath = path.join(__dirname, 'TEST_REPORT.txt');
    await fs.writeFile(reportPath, reportLines.join('\n'), 'utf8');
    console.log(`Test report written to ${reportPath}`);
  } finally {
    await db.close().catch(() => {});
    await new Promise((resolve) => server.close(resolve));
  }
}

run().catch(async (error) => {
  const reportPath = path.join(__dirname, 'TEST_REPORT.txt');
  const contents = [
    'Operation Test Run',
    'FAILED',
    '',
    error.stack || error.message,
    '',
  ].join('\n');

  await fs.writeFile(reportPath, contents, 'utf8');
  console.error(error);
  process.exitCode = 1;
});

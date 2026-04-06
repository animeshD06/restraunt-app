const express = require('express');
const cors = require('cors');
require('dotenv').config();

const menuRoutes = require('./routes/menu');
const orderRoutes = require('./routes/orders');
const reportRoutes = require('./routes/reports');
const tableRoutes = require('./routes/tables');
const reservationRoutes = require('./routes/reservations');
const debugRoutes = require('./routes/debug');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/menu', menuRoutes);
app.use('/orders', orderRoutes);
app.use('/reports', reportRoutes);
app.use('/tables', tableRoutes);
app.use('/reservations', reservationRoutes);
app.use('/debug', debugRoutes);

const PORT = process.env.PORT || 5000;

function startServer(port = PORT) {
  return app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}

if (require.main === module) {
  startServer();
}

module.exports = {
  app,
  startServer,
};

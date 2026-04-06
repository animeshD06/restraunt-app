import { useEffect, useMemo, useState } from 'react';
import { Award, CreditCard, DollarSign, LayoutGrid, RefreshCw, TrendingUp } from 'lucide-react';
import api from '../api';

function Reports() {
  const [revenue, setRevenue] = useState([]);
  const [popular, setPopular] = useState([]);
  const [payments, setPayments] = useState([]);
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchReports = async () => {
    try {
      const [revenueRes, popularRes, paymentRes, tableRes] = await Promise.all([
        api.get('/reports/revenue'),
        api.get('/reports/popular'),
        api.get('/reports/payments'),
        api.get('/reports/tables'),
      ]);
      setRevenue(revenueRes.data);
      setPopular(popularRes.data);
      setPayments(paymentRes.data);
      setTables(tableRes.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const totals = useMemo(() => ({
    revenue: revenue.reduce((sum, row) => sum + Number(row.daily_revenue), 0),
    payments: payments.reduce((sum, row) => sum + Number(row.total_amount), 0),
    ordersHandled: tables.reduce((sum, row) => sum + Number(row.total_orders), 0),
  }), [payments, revenue, tables]);

  if (loading) return <div>Loading reports...</div>;

  return (
    <div style={{ display: 'grid', gap: '2rem' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Management Reports</h1>
          <p className="section-subtitle">Revenue, menu demand, payment mix, and table usage from live backend data.</p>
        </div>
        <button className="btn btn-outline" onClick={fetchReports}>
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-4">
        <div className="stat-card">
          <span className="eyebrow">Revenue</span>
          <strong>${totals.revenue.toFixed(2)}</strong>
          <span className="stat-caption">Completed payment total</span>
        </div>
        <div className="stat-card">
          <span className="eyebrow">Top Item</span>
          <strong>{popular[0]?.name || 'N/A'}</strong>
          <span className="stat-caption">{popular[0]?.total_ordered || 0} portions sold</span>
        </div>
        <div className="stat-card">
          <span className="eyebrow">Payments</span>
          <strong>${totals.payments.toFixed(2)}</strong>
          <span className="stat-caption">Across all methods</span>
        </div>
        <div className="stat-card">
          <span className="eyebrow">Table Load</span>
          <strong>{totals.ordersHandled}</strong>
          <span className="stat-caption">Orders handled overall</span>
        </div>
      </div>

      <div className="grid grid-cols-2">
        <div className="card">
          <h2 className="report-heading"><TrendingUp size={20} /> Daily Revenue</h2>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th style={{ textAlign: 'right' }}>Revenue</th>
                </tr>
              </thead>
              <tbody>
                {revenue.length === 0 ? (
                  <tr><td colSpan="2" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No completed payments yet.</td></tr>
                ) : revenue.map((row, index) => (
                  <tr key={`${row.date}-${index}`}>
                    <td>{new Date(row.date).toLocaleDateString()}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--success)' }}>${Number(row.daily_revenue).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h2 className="report-heading"><Award size={20} /> Most Popular Items</h2>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Item Name</th>
                  <th style={{ textAlign: 'center' }}>Times Ordered</th>
                </tr>
              </thead>
              <tbody>
                {popular.length === 0 ? (
                  <tr><td colSpan="2" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No items ordered yet.</td></tr>
                ) : popular.map((row, index) => (
                  <tr key={row.name}>
                    <td>
                      {row.name}
                      {index === 0 && <span className="tag tag-warning" style={{ marginLeft: '0.5rem' }}>#1</span>}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 600 }}>{row.total_ordered}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h2 className="report-heading"><CreditCard size={20} /> Payment Mix</h2>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Method</th>
                  <th style={{ textAlign: 'center' }}>Count</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {payments.length === 0 ? (
                  <tr><td colSpan="3" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No payments recorded.</td></tr>
                ) : payments.map((row) => (
                  <tr key={row.payment_method}>
                    <td>{row.payment_method.toUpperCase()}</td>
                    <td style={{ textAlign: 'center' }}>{row.payments_count}</td>
                    <td style={{ textAlign: 'right' }}>${Number(row.total_amount).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h2 className="report-heading"><LayoutGrid size={20} /> Table Utilization</h2>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Table</th>
                  <th style={{ textAlign: 'center' }}>Orders</th>
                  <th style={{ textAlign: 'center' }}>Reservations</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {tables.map((row) => (
                  <tr key={row.table_number}>
                    <td>Table {row.table_number}</td>
                    <td style={{ textAlign: 'center' }}>{row.total_orders}</td>
                    <td style={{ textAlign: 'center' }}>{row.total_reservations}</td>
                    <td>
                      <span className={`tag ${row.status === 'available' ? 'tag-success' : row.status === 'maintenance' ? 'tag-danger' : 'tag-warning'}`}>
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Reports;

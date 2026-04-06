import { useEffect, useMemo, useState } from 'react';
import {
  CalendarClock,
  CheckCircle,
  CheckCircle2,
  ChefHat,
  Clock,
  CreditCard,
  FileText,
  RefreshCw,
  Trash2,
  Users,
} from 'lucide-react';
import api from '../api';
import { useNavigate } from 'react-router-dom';

function OrderDashboard() {
  const [orders, setOrders] = useState([]);
  const [tables, setTables] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchData = async () => {
    try {
      const [ordersRes, tablesRes, reservationsRes] = await Promise.all([
        api.get('/orders'),
        api.get('/tables'),
        api.get('/reservations'),
      ]);
      setOrders(ordersRes.data);
      setTables(tablesRes.data);
      setReservations(reservationsRes.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  const updateStatus = async (id, status) => {
    try {
      await api.put(`/orders/${id}`, { status });
      fetchData();
    } catch (error) {
      console.error(error);
      alert(error.response?.data?.error || 'Failed to update order');
    }
  };

  const cancelOrder = async (id) => {
    if (!window.confirm('Cancel this order?')) return;
    try {
      await api.delete(`/orders/${id}`);
      fetchData();
    } catch (error) {
      console.error(error);
      alert(error.response?.data?.error || 'Failed to cancel order');
    }
  };

  const metrics = useMemo(() => {
    const activeOrders = orders.filter((order) => ['pending', 'preparing', 'served'].includes(order.status));
    const pendingReservations = reservations.filter((reservation) => reservation.status === 'booked');
    const occupiedTables = tables.filter((table) => table.status === 'occupied').length;

    return {
      activeOrders: activeOrders.length,
      revenueReady: orders.filter((order) => order.status === 'served').length,
      pendingReservations: pendingReservations.length,
      occupiedTables,
    };
  }, [orders, reservations, tables]);

  const upcomingReservations = [...reservations]
    .filter((reservation) => reservation.status === 'booked')
    .sort((a, b) => new Date(a.reservation_time) - new Date(b.reservation_time))
    .slice(0, 4);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending':
        return <span className="tag tag-warning"><Clock size={12} style={{ display: 'inline', marginRight: '4px' }} /> Pending</span>;
      case 'preparing':
        return <span className="tag tag-primary"><ChefHat size={12} style={{ display: 'inline', marginRight: '4px' }} /> Preparing</span>;
      case 'served':
        return <span className="tag tag-success"><CheckCircle2 size={12} style={{ display: 'inline', marginRight: '4px' }} /> Served</span>;
      case 'paid':
        return <span className="tag tag-success"><CheckCircle size={12} style={{ display: 'inline', marginRight: '4px' }} /> Paid</span>;
      case 'cancelled':
        return <span className="tag tag-danger">Cancelled</span>;
      default:
        return <span className="tag">{status}</span>;
    }
  };

  if (loading) return <div>Loading dashboard...</div>;

  return (
    <div style={{ display: 'grid', gap: '2rem' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Service Dashboard</h1>
          <p className="section-subtitle">Track live orders, table occupancy, and upcoming reservations from one place.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={fetchData} className="btn btn-outline">
            <RefreshCw size={16} /> Refresh
          </button>
          <button onClick={() => navigate('/place-order')} className="btn btn-primary">
            <ChefHat size={16} /> New Order
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4">
        <div className="stat-card">
          <span className="eyebrow">Orders</span>
          <strong>{metrics.activeOrders}</strong>
          <span className="stat-caption">Active right now</span>
        </div>
        <div className="stat-card">
          <span className="eyebrow">Ready To Pay</span>
          <strong>{metrics.revenueReady}</strong>
          <span className="stat-caption">Served orders awaiting payment</span>
        </div>
        <div className="stat-card">
          <span className="eyebrow">Reservations</span>
          <strong>{metrics.pendingReservations}</strong>
          <span className="stat-caption">Booked upcoming reservations</span>
        </div>
        <div className="stat-card">
          <span className="eyebrow">Tables</span>
          <strong>{metrics.occupiedTables}</strong>
          <span className="stat-caption">Currently occupied tables</span>
        </div>
      </div>

      <div className="grid grid-cols-3">
        <div className="card" style={{ gridColumn: 'span 2' }}>
          <div className="panel-header">
            <div>
              <h2>Live Orders</h2>
              <p>Browser reviewers can place, advance, bill, and pay from this flow.</p>
            </div>
          </div>

          <div className="grid grid-cols-2">
            {orders.map((order) => (
              <div key={order.id} className="card order-card">
                <div className="order-card-top">
                  <div>
                    <div className="order-card-title">Table {order.table_number}</div>
                    <div className="order-card-subtitle">{order.customer_name || 'Walk-in Guest'}</div>
                  </div>
                  <div>{getStatusBadge(order.status)}</div>
                </div>

                <div className="order-metadata">
                  <span>Order #{order.id}</span>
                  <span>{new Date(order.created_at).toLocaleString()}</span>
                </div>

                <div className="order-total">${Number(order.total_amount || 0).toFixed(2)}</div>

                {order.payment_method && (
                  <div className="muted-line">Paid via {order.payment_method.toUpperCase()}</div>
                )}

                <div className="action-wrap">
                  {order.status === 'pending' && (
                    <button onClick={() => updateStatus(order.id, 'preparing')} className="btn btn-primary" style={{ flex: 1 }}>
                      Prepare
                    </button>
                  )}
                  {order.status === 'preparing' && (
                    <button onClick={() => updateStatus(order.id, 'served')} className="btn btn-success" style={{ flex: 1 }}>
                      Serve
                    </button>
                  )}
                  {order.status === 'served' && (
                    <button onClick={() => navigate(`/bill/${order.id}`)} className="btn btn-success" style={{ flex: 1 }}>
                      <CreditCard size={16} /> Take Payment
                    </button>
                  )}
                  <button onClick={() => navigate(`/bill/${order.id}`)} className="btn btn-outline" style={{ flex: 1 }}>
                    <FileText size={16} /> Bill
                  </button>
                  {(order.status === 'pending' || order.status === 'preparing') && (
                    <button
                      onClick={() => cancelOrder(order.id)}
                      className="btn btn-outline"
                      style={{ color: 'var(--danger)' }}
                      title="Cancel Order"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}

            {orders.length === 0 && <div className="empty-state" style={{ gridColumn: '1 / -1' }}>No orders yet.</div>}
          </div>
        </div>

        <div className="card">
          <div className="panel-header">
            <div>
              <h2>Upcoming Reservations</h2>
              <p>Quick glance for front-desk flow.</p>
            </div>
          </div>

          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {upcomingReservations.length === 0 ? (
              <div className="empty-state">No upcoming reservations.</div>
            ) : upcomingReservations.map((reservation) => (
              <div key={reservation.id} className="list-card">
                <div className="list-card-title">
                  <CalendarClock size={16} />
                  <span>{reservation.customer_name}</span>
                </div>
                <div className="muted-line">Table {reservation.table_number} · {reservation.guest_count} guests</div>
                <div className="muted-line">{new Date(reservation.reservation_time).toLocaleString()}</div>
              </div>
            ))}
          </div>

          <div className="divider" />

          <div style={{ display: 'grid', gap: '0.75rem' }}>
            <h3 className="mini-heading">Table Status Snapshot</h3>
            {tables.slice(0, 6).map((table) => (
              <div key={table.id} className="list-row">
                <span>Table {table.table_number}</span>
                <span className={`tag ${table.status === 'available' ? 'tag-success' : table.status === 'maintenance' ? 'tag-danger' : 'tag-warning'}`}>
                  {table.status}
                </span>
              </div>
            ))}
            {tables.length > 6 && (
              <button className="btn btn-outline" onClick={() => navigate('/operations')}>
                <Users size={16} /> Open Operations
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default OrderDashboard;

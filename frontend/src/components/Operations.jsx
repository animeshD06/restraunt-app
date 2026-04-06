import { useEffect, useMemo, useState } from 'react';
import { Calendar, CheckCircle2, Clock3, Hammer, RefreshCw, Utensils } from 'lucide-react';
import api from '../api';

const initialReservationForm = {
  customer_name: '',
  customer_phone: '',
  table_id: '',
  guest_count: '2',
  reservation_time: '',
  notes: '',
};

function Operations() {
  const [tables, setTables] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reservationForm, setReservationForm] = useState(initialReservationForm);
  const [savingReservation, setSavingReservation] = useState(false);

  const fetchData = async () => {
    try {
      const [tablesRes, reservationsRes] = await Promise.all([
        api.get('/tables'),
        api.get('/reservations'),
      ]);
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
  }, []);

  const reservationStats = useMemo(() => ({
    booked: reservations.filter((reservation) => reservation.status === 'booked').length,
    completed: reservations.filter((reservation) => reservation.status === 'completed').length,
    availableTables: tables.filter((table) => table.status === 'available').length,
  }), [reservations, tables]);

  const setTableMaintenance = async (tableId, nextStatus) => {
    try {
      await api.put(`/tables/${tableId}/status`, { status: nextStatus });
      fetchData();
    } catch (error) {
      console.error(error);
      alert(error.response?.data?.error || 'Failed to update table');
    }
  };

  const submitReservation = async () => {
    if (!reservationForm.customer_name || !reservationForm.table_id || !reservationForm.reservation_time) {
      return alert('Customer name, table, and reservation time are required');
    }

    setSavingReservation(true);
    try {
      await api.post('/reservations', {
        ...reservationForm,
        table_id: Number(reservationForm.table_id),
        guest_count: Number(reservationForm.guest_count),
      });
      setReservationForm(initialReservationForm);
      fetchData();
    } catch (error) {
      console.error(error);
      alert(error.response?.data?.error || 'Failed to create reservation');
    } finally {
      setSavingReservation(false);
    }
  };

  const updateReservationStatus = async (reservationId, status) => {
    try {
      await api.put(`/reservations/${reservationId}/status`, { status });
      fetchData();
    } catch (error) {
      console.error(error);
      alert(error.response?.data?.error || 'Failed to update reservation');
    }
  };

  const getTableIcon = (status) => {
    if (status === 'occupied') return <Utensils size={16} />;
    if (status === 'reserved') return <Clock3 size={16} />;
    if (status === 'maintenance') return <Hammer size={16} />;
    return <CheckCircle2 size={16} />;
  };

  if (loading) return <div>Loading operations...</div>;

  return (
    <div style={{ display: 'grid', gap: '2rem' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Operations Console</h1>
          <p className="section-subtitle">Review tables, maintenance states, and reservation activity in one screen.</p>
        </div>
        <button className="btn btn-outline" onClick={fetchData}>
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-3">
        <div className="stat-card">
          <span className="eyebrow">Tables Open</span>
          <strong>{reservationStats.availableTables}</strong>
          <span className="stat-caption">Available tables now</span>
        </div>
        <div className="stat-card">
          <span className="eyebrow">Booked</span>
          <strong>{reservationStats.booked}</strong>
          <span className="stat-caption">Upcoming reservations</span>
        </div>
        <div className="stat-card">
          <span className="eyebrow">Completed</span>
          <strong>{reservationStats.completed}</strong>
          <span className="stat-caption">Reservations served</span>
        </div>
      </div>

      <div className="grid grid-cols-3 operations-layout">
        <div className="card" style={{ gridColumn: 'span 2' }}>
          <div className="panel-header">
            <div>
              <h2>Tables</h2>
              <p>Status changes here should immediately affect order and reservation flows.</p>
            </div>
          </div>

          <div className="grid grid-cols-2">
            {tables.map((table) => (
              <div key={table.id} className="card list-card" style={{ gap: '0.85rem' }}>
                <div className="list-row">
                  <strong>Table {table.table_number}</strong>
                  <span className={`tag ${table.status === 'available' ? 'tag-success' : table.status === 'maintenance' ? 'tag-danger' : 'tag-warning'}`}>
                    {getTableIcon(table.status)} {table.status}
                  </span>
                </div>
                <div className="muted-line">Capacity {table.capacity} · Active orders {table.active_order_count}</div>
                <div className="muted-line">
                  {table.next_reservation_time
                    ? `Next reservation ${new Date(table.next_reservation_time).toLocaleString()}`
                    : 'No upcoming reservation'}
                </div>
                <div className="action-wrap">
                  {table.status === 'maintenance' ? (
                    <button className="btn btn-outline" onClick={() => setTableMaintenance(table.id, 'available')}>Reopen</button>
                  ) : (
                    <button className="btn btn-outline" onClick={() => setTableMaintenance(table.id, 'maintenance')}>Maintenance</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="panel-header">
            <div>
              <h2>New Reservation</h2>
              <p>Create a browser-visible reservation record.</p>
            </div>
          </div>

          <div className="stack-form">
            <input
              value={reservationForm.customer_name}
              onChange={(event) => setReservationForm((current) => ({ ...current, customer_name: event.target.value }))}
              placeholder="Customer name"
            />
            <input
              value={reservationForm.customer_phone}
              onChange={(event) => setReservationForm((current) => ({ ...current, customer_phone: event.target.value }))}
              placeholder="Phone number"
            />
            <select
              value={reservationForm.table_id}
              onChange={(event) => setReservationForm((current) => ({ ...current, table_id: event.target.value }))}
            >
              <option value="">Select table</option>
              {tables.filter((table) => table.status !== 'maintenance').map((table) => (
                <option key={table.id} value={table.id}>
                  Table {table.table_number} · Capacity {table.capacity}
                </option>
              ))}
            </select>
            <input
              type="number"
              min="1"
              value={reservationForm.guest_count}
              onChange={(event) => setReservationForm((current) => ({ ...current, guest_count: event.target.value }))}
              placeholder="Guest count"
            />
            <input
              type="datetime-local"
              value={reservationForm.reservation_time}
              onChange={(event) => setReservationForm((current) => ({ ...current, reservation_time: event.target.value }))}
            />
            <input
              value={reservationForm.notes}
              onChange={(event) => setReservationForm((current) => ({ ...current, notes: event.target.value }))}
              placeholder="Notes"
            />
            <button className="btn btn-primary" onClick={submitReservation} disabled={savingReservation}>
              <Calendar size={16} /> {savingReservation ? 'Saving...' : 'Create Reservation'}
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="panel-header">
          <div>
            <h2>Reservation Queue</h2>
            <p>Complete or cancel reservations from the browser.</p>
          </div>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Table</th>
                <th>Guests</th>
                <th>Time</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {reservations.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No reservations yet.</td>
                </tr>
              ) : reservations.map((reservation) => (
                <tr key={reservation.id}>
                  <td>{reservation.customer_name}</td>
                  <td>Table {reservation.table_number}</td>
                  <td>{reservation.guest_count}</td>
                  <td>{new Date(reservation.reservation_time).toLocaleString()}</td>
                  <td>
                    <span className={`tag ${reservation.status === 'completed' ? 'tag-success' : reservation.status === 'cancelled' ? 'tag-danger' : 'tag-warning'}`}>
                      {reservation.status}
                    </span>
                  </td>
                  <td>
                    <div className="action-wrap">
                      {reservation.status === 'booked' && (
                        <>
                          <button className="btn btn-outline" onClick={() => updateReservationStatus(reservation.id, 'completed')}>Complete</button>
                          <button className="btn btn-outline" onClick={() => updateReservationStatus(reservation.id, 'cancelled')}>Cancel</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default Operations;

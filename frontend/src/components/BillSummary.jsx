import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CreditCard, FileText, Printer, Receipt } from 'lucide-react';
import api from '../api';

function BillSummary() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [bill, setBill] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [submittingPayment, setSubmittingPayment] = useState(false);

  const fetchBill = async () => {
    try {
      const response = await api.get(`/orders/${id}/bill`);
      setBill(response.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBill();
  }, [id]);

  const recordPayment = async () => {
    setSubmittingPayment(true);
    try {
      await api.post(`/orders/${id}/payment`, { payment_method: paymentMethod });
      await fetchBill();
      alert('Payment recorded successfully');
    } catch (error) {
      console.error(error);
      alert(error.response?.data?.error || 'Failed to record payment');
    } finally {
      setSubmittingPayment(false);
    }
  };

  if (loading) return <div>Generating bill...</div>;
  if (!bill) return <div>Failed to load bill.</div>;

  const isPaid = bill.order?.status === 'paid';

  return (
    <div style={{ maxWidth: '860px', margin: '0 auto', display: 'grid', gap: '1.5rem' }}>
      <div className="page-header" style={{ marginBottom: 0 }}>
        <button className="btn btn-outline" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} /> Back
        </button>
        <button className="btn btn-primary" onClick={() => window.print()}>
          <Printer size={16} /> Print
        </button>
      </div>

      <div className="grid grid-cols-3">
        <div className="stat-card">
          <span className="eyebrow">Order</span>
          <strong>#{bill.order?.id}</strong>
          <span className="stat-caption">{bill.order?.status}</span>
        </div>
        <div className="stat-card">
          <span className="eyebrow">Table</span>
          <strong>{bill.order?.table_number}</strong>
          <span className="stat-caption">{bill.order?.customer_name || 'Walk-in Guest'}</span>
        </div>
        <div className="stat-card">
          <span className="eyebrow">Total</span>
          <strong>${Number(bill.total).toFixed(2)}</strong>
          <span className="stat-caption">{bill.items.length} line items</span>
        </div>
      </div>

      <div className="card" style={{ padding: '2rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem', borderBottom: '2px dashed var(--border)', paddingBottom: '1.5rem' }}>
          <Receipt size={48} style={{ color: 'var(--primary)', marginBottom: '1rem' }} />
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Receipt #{id}</h1>
          <p className="section-subtitle">
            Table {bill.order?.table_number} · {bill.order?.customer_name || 'Walk-in Guest'}
          </p>
        </div>

        <div className="table-container">
          <table style={{ width: '100%', marginBottom: '2rem' }}>
            <thead>
              <tr>
                <th style={{ padding: '0.5rem 0' }}>Item</th>
                <th style={{ padding: '0.5rem 0', textAlign: 'center' }}>Qty</th>
                <th style={{ padding: '0.5rem 0', textAlign: 'right' }}>Price</th>
                <th style={{ padding: '0.5rem 0', textAlign: 'right' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {bill.items.map((item, index) => (
                <tr key={index} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '0.75rem 0', fontWeight: 500 }}>{item.name}</td>
                  <td style={{ padding: '0.75rem 0', textAlign: 'center' }}>x{item.quantity}</td>
                  <td style={{ padding: '0.75rem 0', textAlign: 'right' }}>${Number(item.price).toFixed(2)}</td>
                  <td style={{ padding: '0.75rem 0', textAlign: 'right' }}>${Number(item.subtotal).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ borderTop: '2px solid var(--border)', paddingTop: '1.5rem', display: 'flex', justifyContent: 'space-between', fontSize: '1.5rem', fontWeight: 700 }}>
          <span>Grand Total</span>
          <span style={{ color: 'var(--primary)' }}>${Number(bill.total).toFixed(2)}</span>
        </div>

        <div className="muted-line" style={{ justifyContent: 'center', marginTop: '1rem' }}>
          Status: {bill.order?.status}
          {bill.order?.payment_method ? ` · ${bill.order.payment_method.toUpperCase()}` : ''}
        </div>
      </div>

      {!isPaid && bill.order?.status === 'served' && (
        <div className="card">
          <div className="panel-header">
            <div>
              <h2>Record Payment</h2>
              <p>This moves the order to paid and releases the table.</p>
            </div>
          </div>

          <div className="payment-strip">
            <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="upi">UPI</option>
            </select>
            <button className="btn btn-success" onClick={recordPayment} disabled={submittingPayment}>
              <CreditCard size={16} />
              {submittingPayment ? 'Saving...' : 'Confirm Payment'}
            </button>
          </div>
        </div>
      )}

      {isPaid && (
        <div className="notice notice-success">
          <FileText size={16} />
          Payment recorded. This order is complete and reflected in reports.
        </div>
      )}
    </div>
  );
}

export default BillSummary;

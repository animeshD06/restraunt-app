import { useState, useEffect } from 'react';
import { ShoppingCart, Plus, Minus, Trash2, User } from 'lucide-react';
import api from '../api';
import { useNavigate } from 'react-router-dom';

function OrderForm() {
  const [menuItems, setMenuItems] = useState([]);
  const [tables, setTables] = useState([]);
  const [cart, setCart] = useState([]);
  const [orderMeta, setOrderMeta] = useState({
    table_id: '',
    customer_name: '',
    customer_phone: '',
    notes: '',
  });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([api.get('/menu'), api.get('/tables')]).then(([menuRes, tableRes]) => {
      setMenuItems(menuRes.data.filter((item) => item.available));
      setTables(tableRes.data.filter((table) => table.status !== 'maintenance' && table.status !== 'occupied'));
    }).catch((error) => console.error(error));
  }, []);

  const addToCart = (item) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      if (existing) {
        return prev.map((i) => (i.id === item.id ? { ...i, qty: i.qty + 1 } : i));
      }
      return [...prev, { ...item, qty: 1 }];
    });
  };

  const updateQty = (id, delta) => {
    setCart((prev) => prev.map((item) => {
      if (item.id === id) {
        return { ...item, qty: Math.max(1, item.qty + delta) };
      }
      return item;
    }));
  };

  const removeFromCart = (id) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  };

  const placeOrder = async () => {
    if (!orderMeta.table_id) return alert('Select a table');
    if (cart.length === 0) return alert('Cart is empty');

    setLoading(true);
    try {
      const payload = {
        table_id: Number(orderMeta.table_id),
        customer_name: orderMeta.customer_name,
        customer_phone: orderMeta.customer_phone,
        notes: orderMeta.notes,
        items: cart.map((item) => ({ menu_item_id: item.id, quantity: item.qty })),
      };
      await api.post('/orders', payload);
      alert('Order placed successfully');
      navigate('/');
    } catch (error) {
      console.error(error);
      alert(error.response?.data?.error || 'Failed to place order');
    } finally {
      setLoading(false);
    }
  };

  const categories = menuItems.reduce((acc, item) => {
    if (!acc[item.category_name]) acc[item.category_name] = [];
    acc[item.category_name].push(item);
    return acc;
  }, {});

  const total = cart.reduce((sum, item) => sum + item.price * item.qty, 0);

  return (
    <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start' }}>
      <div style={{ flex: 2 }}>
        <h1 className="page-title">Place New Order</h1>

        {Object.keys(categories).map((category) => (
          <div key={category}>
            <h2 className="category-title">{category}</h2>
            <div className="grid grid-cols-2">
              {categories[category].map((item) => (
                <div
                  key={item.id}
                  className="card menu-item"
                  style={{ padding: '1rem', cursor: 'pointer' }}
                  onClick={() => addToCart(item)}
                >
                  <div className="menu-item-info">
                    <h3 style={{ fontSize: '1rem' }}>{item.name}</h3>
                    <div className="menu-item-price">${Number(item.price).toFixed(2)}</div>
                  </div>
                  <div className="btn btn-outline" style={{ padding: '0.25rem 0.5rem' }}>
                    <Plus size={16} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div style={{ flex: 1 }}>
        <div className="card" style={{ position: 'sticky', top: '2rem', display: 'grid', gap: '1rem' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShoppingCart size={20} /> Current Order
          </h2>

          <div style={{ display: 'grid', gap: '0.75rem' }}>
            <select
              value={orderMeta.table_id}
              onChange={(e) => setOrderMeta((prev) => ({ ...prev, table_id: e.target.value }))}
            >
              <option value="">Select table</option>
              {tables.map((table) => (
                <option key={table.id} value={table.id}>
                  Table {table.table_number} · Capacity {table.capacity} · {table.status}
                </option>
              ))}
            </select>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <User size={16} />
              <input
                value={orderMeta.customer_name}
                onChange={(e) => setOrderMeta((prev) => ({ ...prev, customer_name: e.target.value }))}
                placeholder="Customer name"
                style={{ width: '100%' }}
              />
            </div>
            <input
              value={orderMeta.customer_phone}
              onChange={(e) => setOrderMeta((prev) => ({ ...prev, customer_phone: e.target.value }))}
              placeholder="Customer phone"
            />
            <input
              value={orderMeta.notes}
              onChange={(e) => setOrderMeta((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder="Order notes"
            />
          </div>

          <div style={{ minHeight: '200px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {cart.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '2rem' }}>Cart is empty</div>
            ) : (
              cart.map((item) => (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
                  <div>
                    <div style={{ fontWeight: 500 }}>{item.name}</div>
                    <div style={{ color: 'var(--primary)', fontSize: '0.875rem' }}>${Number(item.price).toFixed(2)}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <button onClick={() => updateQty(item.id, -1)} className="btn btn-outline" style={{ padding: '0.25rem' }}><Minus size={14} /></button>
                    <span style={{ width: '1.5rem', textAlign: 'center' }}>{item.qty}</span>
                    <button onClick={() => updateQty(item.id, 1)} className="btn btn-outline" style={{ padding: '0.25rem' }}><Plus size={14} /></button>
                    <button onClick={() => removeFromCart(item.id)} className="btn btn-outline" style={{ padding: '0.25rem', color: 'var(--danger)' }}><Trash2 size={14} /></button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem' }}>
              <span>Total:</span>
              <span>${total.toFixed(2)}</span>
            </div>
            <button
              className="btn btn-primary"
              style={{ width: '100%', padding: '0.75rem', fontSize: '1rem' }}
              onClick={placeOrder}
              disabled={loading}
            >
              {loading ? 'Processing...' : 'Submit Order'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default OrderForm;

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle, PlusCircle, Search, XCircle } from 'lucide-react';
import api from '../api';

const initialForm = {
  name: '',
  price: '',
  category_id: '',
  available: true,
};

function MenuList() {
  const [menuItems, setMenuItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState('');

  const fetchData = async () => {
    try {
      setError('');
      const [menuRes, categoriesRes] = await Promise.all([
        api.get('/menu'),
        api.get('/menu/categories'),
      ]);
      setMenuItems(menuRes.data);
      setCategories(categoriesRes.data);
      setForm((current) => ({
        ...current,
        category_id: current.category_id || String(categoriesRes.data[0]?.id || ''),
      }));
    } catch (fetchError) {
      console.error(fetchError);
      setError('Failed to load menu data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const toggleAvailability = async (id, currentStatus) => {
    try {
      await api.put(`/menu/${id}`, { available: !currentStatus });
      fetchData();
    } catch (toggleError) {
      console.error(toggleError);
      alert(toggleError.response?.data?.error || 'Failed to update menu item');
    }
  };

  const createMenuItem = async (event) => {
    event.preventDefault();
    setSaving(true);

    try {
      await api.post('/menu', {
        name: form.name,
        price: Number(form.price),
        category_id: Number(form.category_id),
        available: form.available,
      });
      setForm({
        ...initialForm,
        category_id: String(categories[0]?.id || ''),
      });
      fetchData();
    } catch (saveError) {
      console.error(saveError);
      alert(saveError.response?.data?.error || 'Failed to add menu item');
    } finally {
      setSaving(false);
    }
  };

  const filteredMenuItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return menuItems;
    return menuItems.filter((item) =>
      item.name.toLowerCase().includes(query) || item.category_name.toLowerCase().includes(query)
    );
  }, [menuItems, search]);

  const groupedCategories = filteredMenuItems.reduce((acc, item) => {
    if (!acc[item.category_name]) acc[item.category_name] = [];
    acc[item.category_name].push(item);
    return acc;
  }, {});

  const availableCount = menuItems.filter((item) => item.available).length;
  const unavailableCount = menuItems.length - availableCount;

  if (loading) return <div>Loading menu...</div>;

  return (
    <div style={{ display: 'grid', gap: '2rem' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Menu Management</h1>
          <p className="section-subtitle">Create items, organize categories, and control dish availability.</p>
        </div>
      </div>

      <div className="grid grid-cols-3">
        <div className="stat-card">
          <span className="eyebrow">Catalog</span>
          <strong>{menuItems.length}</strong>
          <span className="stat-caption">Total menu items</span>
        </div>
        <div className="stat-card">
          <span className="eyebrow">Live</span>
          <strong>{availableCount}</strong>
          <span className="stat-caption">Available now</span>
        </div>
        <div className="stat-card">
          <span className="eyebrow">Paused</span>
          <strong>{unavailableCount}</strong>
          <span className="stat-caption">Marked unavailable</span>
        </div>
      </div>

      <div className="grid grid-cols-3 menu-layout">
        <div className="card" style={{ gridColumn: 'span 2' }}>
          <div className="panel-header">
            <div>
              <h2>Browse Menu</h2>
              <p>Search across items and categories.</p>
            </div>
            <label className="search-field">
              <Search size={16} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search menu items"
              />
            </label>
          </div>

          {error && <div className="notice notice-danger">{error}</div>}

          {Object.keys(groupedCategories).length === 0 ? (
            <div className="empty-state">No menu items match your search.</div>
          ) : Object.keys(groupedCategories).map((category) => (
            <div key={category}>
              <h2 className="category-title">{category}</h2>
              <div className="grid grid-cols-2">
                {groupedCategories[category].map((item) => (
                  <div key={item.id} className="card menu-item">
                    <div className="menu-item-info">
                      <h3>{item.name}</h3>
                      <div className="menu-item-price">${Number(item.price).toFixed(2)}</div>
                      <div style={{ marginTop: '0.5rem' }}>
                        {item.available ? (
                          <span className="tag tag-success">Available</span>
                        ) : (
                          <span className="tag tag-danger">Unavailable</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <button
                        onClick={() => toggleAvailability(item.id, item.available)}
                        className={item.available ? 'btn btn-outline' : 'btn btn-success'}
                      >
                        {item.available ? <XCircle size={16} /> : <CheckCircle size={16} />}
                        {item.available ? 'Mark Out' : 'Restore'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="card">
          <div className="panel-header">
            <div>
              <h2>Add Item</h2>
              <p>Use the backend-powered menu creation flow.</p>
            </div>
          </div>

          <form onSubmit={createMenuItem} className="stack-form">
            <input
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="Item name"
              required
            />
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={form.price}
              onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))}
              placeholder="Price"
              required
            />
            <select
              value={form.category_id}
              onChange={(event) => setForm((current) => ({ ...current, category_id: event.target.value }))}
              required
            >
              <option value="">Select category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={form.available}
                onChange={(event) => setForm((current) => ({ ...current, available: event.target.checked }))}
              />
              Add as available immediately
            </label>
            <button className="btn btn-primary" type="submit" disabled={saving}>
              <PlusCircle size={16} />
              {saving ? 'Saving...' : 'Create Menu Item'}
            </button>
          </form>

          <div className="divider" />

          <div style={{ display: 'grid', gap: '0.75rem' }}>
            <h3 className="mini-heading">Categories</h3>
            {categories.map((category) => (
              <div key={category.id} className="list-row">
                <span>{category.name}</span>
                <span className="tag tag-primary">
                  {menuItems.filter((item) => item.category_id === category.id).length}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default MenuList;

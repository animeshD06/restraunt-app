import { useEffect, useMemo, useState } from 'react';
import { Database, RefreshCw } from 'lucide-react';
import api from '../api';

function formatCellValue(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function DatabaseViewer() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTable, setActiveTable] = useState('menu_items');
  const [error, setError] = useState('');

  const fetchDatabase = async () => {
    try {
      setError('');
      const response = await api.get('/debug/database');
      setData(response.data);
      const firstTable = Object.keys(response.data.tables)[0];
      setActiveTable((current) => current || firstTable);
    } catch (error) {
      console.error(error);
      setError(
        error.response?.status === 404
          ? 'Database viewer API not found. Restart the backend so the new /debug/database route is loaded.'
          : (error.response?.data?.error || 'Failed to load database viewer')
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDatabase();
  }, []);

  const tableNames = useMemo(() => Object.keys(data?.tables || {}), [data]);
  const rows = data?.tables?.[activeTable] || [];
  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

  if (loading) return <div>Loading database viewer...</div>;
  if (error) {
    return (
      <div style={{ display: 'grid', gap: '1.5rem' }}>
        <div className="page-header">
          <div>
            <h1 className="page-title">Database Viewer</h1>
            <p className="section-subtitle">Current backend data inspector.</p>
          </div>
          <button className="btn btn-outline" onClick={fetchDatabase}>
            <RefreshCw size={16} /> Retry
          </button>
        </div>
        <div className="notice notice-danger">{error}</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: '2rem' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Database Viewer</h1>
          <p className="section-subtitle">
            Current mode: <strong>{data?.mode}</strong>. This view reads the live backend data directly.
          </p>
        </div>
        <button className="btn btn-outline" onClick={fetchDatabase}>
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-4">
        <div className="card">
          <div className="panel-header">
            <div>
              <h2><Database size={18} /> Tables</h2>
              <p>Select a table to inspect its rows.</p>
            </div>
          </div>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {tableNames.map((tableName) => (
              <button
                key={tableName}
                className={activeTable === tableName ? 'btn btn-primary' : 'btn btn-outline'}
                onClick={() => setActiveTable(tableName)}
                style={{ justifyContent: 'space-between' }}
              >
                <span>{tableName}</span>
                <span>{data.tables[tableName].length}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="card" style={{ gridColumn: 'span 3' }}>
          <div className="panel-header">
            <div>
              <h2>{activeTable}</h2>
              <p>{rows.length} row(s) in the current table.</p>
            </div>
          </div>

          {rows.length === 0 ? (
            <div className="empty-state">No rows found in this table.</div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    {columns.map((column) => (
                      <th key={column}>{column}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={row.id ?? index}>
                      {columns.map((column) => (
                        <td key={`${row.id ?? index}-${column}`}>{formatCellValue(row[column])}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default DatabaseViewer;

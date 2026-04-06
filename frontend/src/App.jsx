import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import { Home, Utensils, ClipboardList, PieChart, Calendar, Sparkles, Database } from 'lucide-react';

import MenuList from './components/MenuList';
import OrderForm from './components/OrderForm';
import OrderDashboard from './components/OrderDashboard';
import Reports from './components/Reports';
import BillSummary from './components/BillSummary';
import Operations from './components/Operations';
import DatabaseViewer from './components/DatabaseViewer';

function App() {
  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <div className="app-container">
        <aside className="sidebar">
          <div className="sidebar-brand">
            <div className="sidebar-logo">
              <Utensils size={28} />
              RestoApp
            </div>
            <p className="sidebar-tagline">Restaurant DBMS control center</p>
          </div>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <NavLink to="/" className={({isActive}) => isActive ? 'nav-link active' : 'nav-link'}>
              <Home size={20} /> Dashboard
            </NavLink>
            <NavLink to="/menu" className={({isActive}) => isActive ? 'nav-link active' : 'nav-link'}>
              <Utensils size={20} /> Menu
            </NavLink>
            <NavLink to="/place-order" className={({isActive}) => isActive ? 'nav-link active' : 'nav-link'}>
              <ClipboardList size={20} /> Place Order
            </NavLink>
            <NavLink to="/reports" className={({isActive}) => isActive ? 'nav-link active' : 'nav-link'}>
              <PieChart size={20} /> Reports
            </NavLink>
            <NavLink to="/operations" className={({isActive}) => isActive ? 'nav-link active' : 'nav-link'}>
              <Calendar size={20} /> Operations
            </NavLink>
            <NavLink to="/database" className={({isActive}) => isActive ? 'nav-link active' : 'nav-link'}>
              <Database size={20} /> Database
            </NavLink>
          </nav>
        </aside>
        
        <main className="main-content">
          <div className="top-banner">
            <div>
              <span className="eyebrow">Live Workspace</span>
              <h1 className="banner-title">Operations, billing, reservations, and reports in one browser flow.</h1>
            </div>
            <div className="banner-badge">
              <Sparkles size={16} />
              Demo Ready
            </div>
          </div>
          <Routes>
            <Route path="/" element={<OrderDashboard />} />
            <Route path="/menu" element={<MenuList />} />
            <Route path="/place-order" element={<OrderForm />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/operations" element={<Operations />} />
            <Route path="/database" element={<DatabaseViewer />} />
            <Route path="/bill/:id" element={<BillSummary />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;

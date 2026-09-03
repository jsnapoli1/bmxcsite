import React from 'react';
import ReactDOM from 'react-dom/client';
import AdminApp from './AdminApp.jsx';
import '../styles/tokens.css';
import './styles/shell.css';
import './styles/controls.css';
import './styles/tables.css';
import './styles/pages.css';

ReactDOM.createRoot(document.getElementById('admin-root')).render(
  <React.StrictMode>
    <AdminApp />
  </React.StrictMode>,
);

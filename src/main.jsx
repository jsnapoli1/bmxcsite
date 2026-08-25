import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import VisualEditor from './lib/visual-editor.jsx';
import './styles/tokens.css';
import './styles/global.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <VisualEditor>
        <App />
      </VisualEditor>
    </BrowserRouter>
  </React.StrictMode>,
);

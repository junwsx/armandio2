import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

try {
  const t = localStorage.getItem('armadio-theme');
  if (t && t !== 'auto') document.documentElement.setAttribute('data-theme', t);
} catch { /* storage non disponibile */ }

createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>);

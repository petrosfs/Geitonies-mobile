import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/commissioner/400.css';
import '@fontsource/commissioner/600.css';
import '@fontsource/commissioner/800.css';
import './styles.css';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

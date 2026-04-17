import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Apply saved theme before render to avoid flash
const savedTheme = localStorage.getItem('xtream-theme');
if (savedTheme) {
  document.documentElement.setAttribute('data-theme', savedTheme);
}
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

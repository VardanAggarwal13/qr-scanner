import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { loadPdfjs } from './utils/pdfjsLoader'

// A scanned PDF link: start loading PDF.js now, in parallel with React rendering
if (/[#?&]t=pdf(&|$)/.test(window.location.hash + window.location.search)) {
  loadPdfjs().catch(() => {})
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

import React, { Suspense, lazy, useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import DocumentViewer from './components/DocumentViewer';
import ErrorBoundary from './components/ErrorBoundary';
import { parseViewerLinkSync, unpackMediaFromURL } from './utils/mediaCompressor';
import { addScanToHistory } from './utils/storage';

// The creator / scanner screens (QR styling, camera, supabase, jsQR...) are big and a person
// who only scanned a QR never needs them, so they are downloaded only when that tab is opened.
const QRStudio = lazy(() => import('./components/QRStudio'));
const LiveScanner = lazy(() => import('./components/LiveScanner'));
const MediaScanner = lazy(() => import('./components/MediaScanner'));
const HistoryView = lazy(() => import('./components/HistoryView'));
const ScanResultModal = lazy(() => import('./components/ScanResultModal'));

function looksLikeViewerLink() {
  const hash = window.location.hash || window.location.search || '';
  return hash.includes('/view') || hash.includes('url=') || hash.includes('id=') || hash.includes('v=');
}

function PageLoader() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 16px', color: 'var(--text-secondary)' }}>
      Loading…
    </div>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState('create');
  const [theme, setTheme] = useState('dark');
  const [activeScanResult, setActiveScanResult] = useState(null);
  // A link with a public file URL is understood immediately, so the very first paint is already the
  // viewer (no dashboard flash, no waiting on an effect or on IndexedDB).
  const [activeDocumentView, setActiveDocumentView] = useState(() =>
    looksLikeViewerLink() ? parseViewerLinkSync(window.location.hash || window.location.search) : null
  );
  const [resolvingLink, setResolvingLink] = useState(() => looksLikeViewerLink() && !activeDocumentView);

  // Check URL hash / parameters for shared document payloads (#/view?url=... or ?id=...)
  useEffect(() => {
    const handleHashChange = async () => {
      const hash = window.location.hash || window.location.search || '';
      if (looksLikeViewerLink()) {
        const quick = parseViewerLinkSync(hash);
        if (quick) {
          setActiveDocumentView(quick);
          setResolvingLink(false);
          return;
        }
        try {
          const media = await unpackMediaFromURL(hash);
          if (media) {
            setActiveDocumentView(media);
          }
        } catch (e) {
          console.error('Failed to unpack media from hash:', e);
        }
      }
      setResolvingLink(false);
    };

    if (!activeDocumentView) handleHashChange();
    else setResolvingLink(false);
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Theme switcher
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(t => t === 'dark' ? 'light' : 'dark');
  };

  // Handle successful QR scan
  const handleScanSuccess = (scanData) => {
    addScanToHistory(scanData);
    setActiveScanResult(scanData);
  };

  // =========================================================================
  // 📱 DIRECT RECEIVER MODE (When anyone scans the QR code from their phone)
  // Completely hides creator dashboard/tabs so receiver ONLY sees the document!
  // =========================================================================
  if (activeDocumentView) {
    return (
      <ErrorBoundary>
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)' }}>
          <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <DocumentViewer 
              mediaData={activeDocumentView} 
              onBack={() => {
                setActiveDocumentView(null);
                window.location.hash = '';
              }} 
            />
          </main>
        </div>
      </ErrorBoundary>
    );
  }

  if (resolvingLink) {
    return <PageLoader />;
  }

  // =========================================================================
  // 🛠️ CREATOR & SCANNER DASHBOARD (When opening the root home website)
  // =========================================================================
  return (
    <ErrorBoundary>
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        {/* Top Navigation */}
        <Navbar 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          theme={theme} 
          toggleTheme={toggleTheme} 
        />

        {/* Main Content View based on Tab */}
        <main style={{ flex: 1 }}>
          <Suspense fallback={<PageLoader />}>
          {activeTab === 'create' && (
            <QRStudio 
              onPreviewDocument={(doc) => setActiveDocumentView(doc)} 
            />
          )}

          {activeTab === 'camera' && (
            <LiveScanner 
              onScanSuccess={handleScanSuccess} 
            />
          )}

          {activeTab === 'media' && (
            <MediaScanner 
              onScanSuccess={handleScanSuccess} 
            />
          )}

          {activeTab === 'history' && (
            <HistoryView 
              onOpenResult={(scan) => setActiveScanResult(scan)}
              onOpenDocument={(doc) => setActiveDocumentView(doc)}
            />
          )}
          </Suspense>
        </main>

        {/* Result Modal when QR is detected */}
        {activeScanResult && (
          <Suspense fallback={null}>
            <ScanResultModal
              scanResult={activeScanResult}
              onClose={() => setActiveScanResult(null)}
              onOpenDocument={(doc) => {
                setActiveScanResult(null);
                setActiveDocumentView(doc);
              }}
            />
          </Suspense>
        )}

        {/* Footer */}
        <footer style={{
          textAlign: 'center',
          padding: '24px 16px',
          borderTop: '1px solid var(--border-glass)',
          color: 'var(--text-muted)',
          fontSize: '0.82rem',
          marginTop: 'auto'
        }}>
          <p style={{ marginBottom: '4px' }}>
            <strong>QRNova</strong> • High-Performance Document & Media QR Scanner Platform
          </p>
          <p>100% Client-Side In-Browser Processing • Zero Data Stored on Servers</p>
        </footer>
      </div>
    </ErrorBoundary>
  );
}

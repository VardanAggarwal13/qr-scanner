import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import QRStudio from './components/QRStudio';
import LiveScanner from './components/LiveScanner';
import MediaScanner from './components/MediaScanner';
import HistoryView from './components/HistoryView';
import ScanResultModal from './components/ScanResultModal';
import DocumentViewer from './components/DocumentViewer';
import ErrorBoundary from './components/ErrorBoundary';
import { unpackMediaFromURL } from './utils/mediaCompressor';
import { addScanToHistory } from './utils/storage';

export default function App() {
  const [activeTab, setActiveTab] = useState('create'); // 'create' | 'camera' | 'media' | 'history'
  const [theme, setTheme] = useState('dark');
  const [activeScanResult, setActiveScanResult] = useState(null);
  const [activeDocumentView, setActiveDocumentView] = useState(null);

  // Check URL hash for shared document viewer payloads (#/view?id=... or #/view?v=...)
  useEffect(() => {
    const handleHashChange = async () => {
      const hash = window.location.hash || '';
      if (hash.includes('/view') || hash.includes('id=') || hash.includes('v=')) {
        try {
          const media = await unpackMediaFromURL(hash);
          if (media) {
            setActiveDocumentView(media);
          }
        } catch (e) {
          console.error('Failed to unpack media from hash:', e);
        }
      }
    };

    handleHashChange();
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

  // If a document viewer URL is loaded directly (Receiver screen mode)
  if (activeDocumentView) {
    return (
      <ErrorBoundary>
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
          <Navbar 
            activeTab={activeTab} 
            setActiveTab={(tab) => {
              setActiveDocumentView(null);
              window.location.hash = '';
              setActiveTab(tab);
            }} 
            theme={theme} 
            toggleTheme={toggleTheme} 
          />
          <main style={{ flex: 1 }}>
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
        </main>

        {/* Result Modal when QR is detected */}
        {activeScanResult && (
          <ScanResultModal 
            scanResult={activeScanResult}
            onClose={() => setActiveScanResult(null)}
            onOpenDocument={(doc) => {
              setActiveScanResult(null);
              setActiveDocumentView(doc);
            }}
          />
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

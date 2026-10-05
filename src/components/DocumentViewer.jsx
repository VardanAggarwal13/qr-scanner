import React, { useState, useEffect, useRef } from 'react';
import { 
  FileText, Image as ImageIcon, Video, Music, Link as LinkIcon, 
  Download, Share2, Printer, ArrowLeft, ZoomIn, ZoomOut, RotateCw, 
  ChevronLeft, ChevronRight, Eye, Shield, Lock, CheckCircle2, Copy, ExternalLink
} from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';

export default function DocumentViewer({ mediaData, onBack }) {
  const [activePin, setActivePin] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(!mediaData?.pin);
  const [pinError, setPinError] = useState(false);
  const [copied, setCopied] = useState(false);

  // PDF Viewer State
  const [pdfDoc, setPdfDoc] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [numPages, setNumPages] = useState(1);
  const [pdfScale, setPdfScale] = useState(1.4);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [useIframeView, setUseIframeView] = useState(false);
  const pdfCanvasRef = useRef(null);

  // Image Viewer State
  const [imgZoom, setImgZoom] = useState(1);
  const [imgRotation, setImgRotation] = useState(0);

  // Unlock check
  const handleUnlock = (e) => {
    e.preventDefault();
    if (activePin === mediaData.pin) {
      setIsUnlocked(true);
      setPinError(false);
    } else {
      setPinError(true);
    }
  };

  const pdfUrl = mediaData?.dataUrl || mediaData?.url || mediaData?.cloudUrl;

  // Load PDF if type is PDF
  useEffect(() => {
    if (!mediaData || mediaData.type !== 'pdf' || !isUnlocked || !pdfUrl) return;

    let isMounted = true;
    setPdfLoading(true);

    const loadPdf = async () => {
      try {
        const loadingTask = pdfjsLib.getDocument(pdfUrl);
        const doc = await loadingTask.promise;
        if (isMounted) {
          setPdfDoc(doc);
          setNumPages(doc.numPages);
          setCurrentPage(1);
          setPdfLoading(false);
        }
      } catch (err) {
        console.warn('PDF.js canvas render fallback, switching to native embedded viewer:', err);
        if (isMounted) {
          setUseIframeView(true);
          setPdfLoading(false);
        }
      }
    };

    loadPdf();
    return () => { isMounted = false; };
  }, [mediaData, isUnlocked, pdfUrl]);

  // Render current PDF page
  useEffect(() => {
    if (!pdfDoc || !pdfCanvasRef.current) return;

    let renderTask = null;
    const renderPage = async () => {
      try {
        const page = await pdfDoc.getPage(currentPage);
        const viewport = page.getViewport({ scale: pdfScale });
        const canvas = pdfCanvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
          canvasContext: context,
          viewport: viewport
        };
        renderTask = page.render(renderContext);
        await renderTask.promise;
      } catch (err) {
        if (err.name !== 'RenderingCancelledException') {
          console.error('Error rendering page:', err);
        }
      }
    };

    renderPage();
    return () => {
      if (renderTask) renderTask.cancel();
    };
  }, [pdfDoc, currentPage, pdfScale]);

  const handleDownload = () => {
    const fileSource = mediaData?.dataUrl || mediaData?.url || mediaData?.cloudUrl;
    if (!fileSource) return;
    const link = document.createElement('a');
    link.href = fileSource;
    link.target = '_blank';
    link.download = mediaData.fileName || `${mediaData.title || 'document'}.${mediaData.type === 'pdf' ? 'pdf' : 'png'}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: mediaData.title,
          text: mediaData.description || `Attached Document: ${mediaData.title}`,
          url: window.location.href
        });
      } catch (e) {}
    } else {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (!mediaData) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '12px' }}>No Document Attached</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
          This link does not contain an attached media payload.
        </p>
        {onBack && (
          <button className="btn-primary" onClick={onBack}>
            <ArrowLeft size={18} /> Return to Home
          </button>
        )}
      </div>
    );
  }

  // Password Lock Screen
  if (!isUnlocked) {
    return (
      <div style={{ maxWidth: '440px', margin: '60px auto', padding: '0 16px' }}>
        <div className="glass-panel" style={{ padding: '36px 28px', textAlign: 'center' }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'rgba(99, 102, 241, 0.15)',
            border: '1px solid rgba(99, 102, 241, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px auto',
            color: 'var(--accent-primary)'
          }}>
            <Lock size={30} />
          </div>

          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '8px' }}>
            Protected Document
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '24px' }}>
            Please enter the passcode to view "<strong>{mediaData.title}</strong>".
          </p>

          <form onSubmit={handleUnlock}>
            <input 
              type="password"
              className="glass-input"
              placeholder="Enter Passcode"
              value={activePin}
              onChange={(e) => setActivePin(e.target.value)}
              style={{
                textAlign: 'center',
                letterSpacing: '0.2em',
                fontSize: '1.1rem',
                marginBottom: '14px',
                borderColor: pinError ? 'var(--danger)' : undefined
              }}
              autoFocus
            />

            {pinError && (
              <p style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '14px' }}>
                Incorrect passcode. Please try again.
              </p>
            )}

            <button type="submit" className="btn-primary" style={{ width: '100%', marginBottom: '12px' }}>
              <Shield size={18} /> Unlock Document
            </button>

            {onBack && (
              <button type="button" className="btn-ghost" onClick={onBack} style={{ width: '100%' }}>
                <ArrowLeft size={16} /> Go Back
              </button>
            )}
          </form>
        </div>
      </div>
    );
  }

  const getTypeIcon = () => {
    switch (mediaData.type) {
      case 'pdf': return <FileText size={24} color="#ef4444" />;
      case 'image': return <ImageIcon size={24} color="#10b981" />;
      case 'video': return <Video size={24} color="#3b82f6" />;
      case 'audio': return <Music size={24} color="#a855f7" />;
      default: return <LinkIcon size={24} color="#06b6d4" />;
    }
  };

  return (
    <div style={{ maxWidth: '1050px', margin: '0 auto', padding: '20px 16px 80px 16px' }}>
      
      {/* Top Header Card */}
      <div className="glass-panel" style={{ padding: '24px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1, minWidth: '260px' }}>
            <div style={{
              width: '50px',
              height: '50px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--border-glass)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              {getTypeIcon()}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span className="badge badge-primary">{mediaData.type?.toUpperCase()}</span>
                {mediaData.pin && <span className="badge badge-warning"><Lock size={10} /> Protected</span>}
              </div>
              <h1 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                {mediaData.title || 'Attached Document'}
              </h1>
              {mediaData.author && (
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  By {mediaData.author}
                </p>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <button className="btn-secondary" onClick={handleShare} title="Share link">
              {copied ? <CheckCircle2 size={18} color="var(--success)" /> : <Share2 size={18} />}
              <span>{copied ? 'Copied Link!' : 'Share'}</span>
            </button>
            <button className="btn-secondary" onClick={handlePrint} title="Print Document">
              <Printer size={18} />
              <span>Print</span>
            </button>
            <button className="btn-primary" onClick={handleDownload} title="Download File">
              <Download size={18} />
              <span>Download</span>
            </button>
          </div>
        </div>

        {mediaData.description && (
          <div style={{
            marginTop: '16px',
            paddingTop: '16px',
            borderTop: '1px solid var(--border-glass)',
            color: 'var(--text-secondary)',
            fontSize: '0.95rem',
            lineHeight: 1.6
          }}>
            {mediaData.description}
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="glass-panel" style={{ padding: '20px', minHeight: '450px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        
        {/* --- 1. PDF VIEWER --- */}
        {mediaData.type === 'pdf' && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            
            {/* PDF Toolbar */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              maxWidth: '850px',
              padding: '10px 16px',
              background: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-glass)',
              marginBottom: '16px',
              flexWrap: 'wrap',
              gap: '10px'
            }}>
              {/* Pagination */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button 
                  className="btn-ghost" 
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  style={{ opacity: currentPage <= 1 ? 0.4 : 1 }}
                >
                  <ChevronLeft size={20} />
                </button>
                <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                  Page {currentPage} of {numPages}
                </span>
                <button 
                  className="btn-ghost" 
                  disabled={currentPage >= numPages}
                  onClick={() => setCurrentPage(p => Math.min(numPages, p + 1))}
                  style={{ opacity: currentPage >= numPages ? 0.4 : 1 }}
                >
                  <ChevronRight size={20} />
                </button>
              </div>

              {/* Zoom Controls */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button className="btn-ghost" onClick={() => setPdfScale(s => Math.max(0.6, s - 0.2))}>
                  <ZoomOut size={18} />
                </button>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', minWidth: '45px', textAlign: 'center' }}>
                  {Math.round(pdfScale * 100)}%
                </span>
                <button className="btn-ghost" onClick={() => setPdfScale(s => Math.min(2.5, s + 0.2))}>
                  <ZoomIn size={18} />
                </button>
              </div>
            </div>

            {/* Document Render Container */}
            <div style={{
              width: '100%',
              maxWidth: '850px',
              overflow: 'auto',
              display: 'flex',
              justifyContent: 'center',
              padding: '14px 0',
              background: 'rgba(0, 0, 0, 0.25)',
              borderRadius: 'var(--radius-md)'
            }}>
              {useIframeView ? (
                <iframe 
                  src={pdfUrl} 
                  title={mediaData.title}
                  style={{ width: '100%', height: '75vh', border: 'none', borderRadius: '8px' }}
                />
              ) : pdfLoading ? (
                <div style={{ padding: '80px 0', color: 'var(--text-secondary)' }}>
                  Loading document pages...
                </div>
              ) : (
                <canvas 
                  ref={pdfCanvasRef} 
                  style={{ 
                    maxWidth: '100%', 
                    height: 'auto', 
                    borderRadius: '4px', 
                    boxShadow: '0 8px 30px rgba(0,0,0,0.4)',
                    background: '#ffffff'
                  }} 
                />
              )}
            </div>
          </div>
        )}

        {/* --- 2. IMAGE VIEWER --- */}
        {mediaData.type === 'image' && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '16px',
              padding: '8px 16px',
              background: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-glass)'
            }}>
              <button className="btn-ghost" onClick={() => setImgZoom(z => Math.max(0.5, z - 0.2))}>
                <ZoomOut size={18} /> Zoom Out
              </button>
              <button className="btn-ghost" onClick={() => { setImgZoom(1); setImgRotation(0); }}>
                Reset
              </button>
              <button className="btn-ghost" onClick={() => setImgZoom(z => Math.min(3, z + 0.2))}>
                <ZoomIn size={18} /> Zoom In
              </button>
              <button className="btn-ghost" onClick={() => setImgRotation(r => (r + 90) % 360)}>
                <RotateCw size={18} /> Rotate
              </button>
            </div>

            <div style={{
              overflow: 'auto',
              maxWidth: '100%',
              maxHeight: '70vh',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(0, 0, 0, 0.3)'
            }}>
              <img 
                src={mediaData.dataUrl || mediaData.url || mediaData.cloudUrl} 
                alt={mediaData.title}
                style={{
                  transform: `scale(${imgZoom}) rotate(${imgRotation}deg)`,
                  transition: 'transform 0.2s ease',
                  maxWidth: '100%',
                  maxHeight: '65vh',
                  objectFit: 'contain',
                  borderRadius: 'var(--radius-sm)',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
                }}
              />
            </div>
          </div>
        )}

        {/* --- 3. VIDEO VIEWER --- */}
        {mediaData.type === 'video' && (
          <div style={{ width: '100%', maxWidth: '800px' }}>
            <video 
              controls 
              autoPlay 
              playsInline 
              src={mediaData.dataUrl || mediaData.url || mediaData.cloudUrl}
              style={{
                width: '100%',
                maxHeight: '70vh',
                borderRadius: 'var(--radius-md)',
                boxShadow: '0 10px 40px rgba(0,0,0,0.6)',
                background: '#000'
              }}
            />
          </div>
        )}

        {/* --- 4. AUDIO VIEWER --- */}
        {mediaData.type === 'audio' && (
          <div style={{ width: '100%', maxWidth: '600px', textAlign: 'center', padding: '40px 20px' }}>
            <div style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #a855f7, #6366f1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 24px auto',
              boxShadow: '0 0 30px rgba(168, 85, 247, 0.4)'
            }}>
              <Music size={40} color="#fff" />
            </div>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>{mediaData.title}</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>Audio Voice Note / Track</p>
            <audio 
              controls 
              src={mediaData.dataUrl || mediaData.url || mediaData.cloudUrl} 
              style={{ width: '100%', outline: 'none' }}
            />
          </div>
        )}

        {/* --- 5. TEXT / MARKDOWN / NOTE VIEWER --- */}
        {(mediaData.type === 'text' || mediaData.type === 'link') && (
          <div style={{
            width: '100%',
            maxWidth: '800px',
            background: 'var(--bg-secondary)',
            padding: '24px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-glass)'
          }}>
            <div style={{
              whiteSpace: 'pre-wrap',
              lineHeight: 1.7,
              color: 'var(--text-primary)',
              fontSize: '1rem',
              userSelect: 'text'
            }}>
              {mediaData.dataUrl || mediaData.url || mediaData.description}
            </div>

            {mediaData.type === 'link' && (
              <div style={{ marginTop: '20px' }}>
                <a 
                  href={mediaData.dataUrl || mediaData.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="btn-primary"
                >
                  <LinkIcon size={18} /> Open Destination
                </a>
              </div>
            )}
          </div>
        )}

      </div>

      {onBack && (
        <div style={{ marginTop: '24px', textAlign: 'center' }}>
          <button className="btn-secondary" onClick={onBack}>
            <ArrowLeft size={18} /> Return to QR Studio & Scanner
          </button>
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import { 
  FileText, Image as ImageIcon, Video, Music, Link as LinkIcon, 
  Download, Share2, Printer, ArrowLeft, ZoomIn, ZoomOut, RotateCw, 
  ChevronLeft, ChevronRight, Eye, Shield, Lock, CheckCircle2, Copy, ExternalLink, QrCode
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

  const pdfUrl = mediaData?.cloudUrl || mediaData?.url || mediaData?.dataUrl;

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
    const fileSource = mediaData?.cloudUrl || mediaData?.url || mediaData?.dataUrl;
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
      <div style={{ maxWidth: '420px', margin: '80px auto', padding: '0 16px' }}>
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
          </form>
        </div>
      </div>
    );
  }

  const getTypeIcon = () => {
    switch (mediaData.type) {
      case 'pdf': return <FileText size={22} color="#ef4444" />;
      case 'image': return <ImageIcon size={22} color="#10b981" />;
      case 'video': return <Video size={22} color="#3b82f6" />;
      case 'audio': return <Music size={22} color="#a855f7" />;
      default: return <LinkIcon size={22} color="#06b6d4" />;
    }
  };

  return (
    <div style={{ maxWidth: '1100px', width: '100%', margin: '0 auto', padding: '16px 16px 60px 16px' }}>
      
      {/* Sleek Minimal Header Bar for Receiver */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 20px',
        background: 'var(--bg-glass)',
        backdropFilter: 'blur(16px)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-glass)',
        marginBottom: '18px',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '10px',
            background: 'rgba(255, 255, 255, 0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {getTypeIcon()}
          </div>
          <div>
            <h1 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2 }}>
              {mediaData.title || 'Attached Document'}
            </h1>
            {mediaData.author && (
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                By {mediaData.author}
              </p>
            )}
          </div>
        </div>

        {/* 1-Click Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button className="btn-secondary" onClick={handleShare} style={{ padding: '8px 12px' }} title="Share Link">
            {copied ? <CheckCircle2 size={16} color="var(--success)" /> : <Share2 size={16} />}
            <span style={{ fontSize: '0.85rem' }}>{copied ? 'Copied' : 'Share'}</span>
          </button>
          
          <button className="btn-secondary" onClick={handlePrint} style={{ padding: '8px 12px' }} title="Print">
            <Printer size={16} />
            <span style={{ fontSize: '0.85rem' }}>Print</span>
          </button>

          <button className="btn-primary" onClick={handleDownload} style={{ padding: '8px 16px' }} title="Download Original">
            <Download size={16} />
            <span style={{ fontSize: '0.85rem' }}>Download</span>
          </button>
        </div>
      </div>

      {mediaData.description && (
        <div style={{
          padding: '12px 18px',
          background: 'var(--bg-card)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-glass)',
          marginBottom: '16px',
          color: 'var(--text-secondary)',
          fontSize: '0.9rem',
          lineHeight: 1.5
        }}>
          {mediaData.description}
        </div>
      )}

      {/* Main Content Presentation */}
      <div className="glass-panel" style={{ padding: '16px', minHeight: '500px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        
        {/* --- 1. PDF VIEWER --- */}
        {mediaData.type === 'pdf' && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            
            {/* Toolbar */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              maxWidth: '900px',
              padding: '8px 16px',
              background: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-glass)',
              marginBottom: '14px',
              flexWrap: 'wrap',
              gap: '10px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button 
                  className="btn-ghost" 
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  style={{ opacity: currentPage <= 1 ? 0.4 : 1, padding: '4px 8px' }}
                >
                  <ChevronLeft size={18} />
                </button>
                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                  Page {currentPage} of {numPages}
                </span>
                <button 
                  className="btn-ghost" 
                  disabled={currentPage >= numPages}
                  onClick={() => setCurrentPage(p => Math.min(numPages, p + 1))}
                  style={{ opacity: currentPage >= numPages ? 0.4 : 1, padding: '4px 8px' }}
                >
                  <ChevronRight size={18} />
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button className="btn-ghost" onClick={() => setPdfScale(s => Math.max(0.6, s - 0.2))}>
                  <ZoomOut size={16} />
                </button>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', minWidth: '40px', textAlign: 'center' }}>
                  {Math.round(pdfScale * 100)}%
                </span>
                <button className="btn-ghost" onClick={() => setPdfScale(s => Math.min(2.5, s + 0.2))}>
                  <ZoomIn size={16} />
                </button>
              </div>
            </div>

            {/* Document Render Container */}
            <div style={{
              width: '100%',
              maxWidth: '900px',
              overflow: 'auto',
              display: 'flex',
              justifyContent: 'center',
              padding: '10px 0',
              background: 'rgba(0, 0, 0, 0.25)',
              borderRadius: 'var(--radius-md)'
            }}>
              {useIframeView ? (
                <iframe 
                  src={pdfUrl} 
                  title={mediaData.title}
                  style={{ width: '100%', height: '80vh', border: 'none', borderRadius: '8px' }}
                />
              ) : pdfLoading ? (
                <div style={{ padding: '80px 0', color: 'var(--text-secondary)' }}>
                  Loading document...
                </div>
              ) : (
                <canvas 
                  ref={pdfCanvasRef} 
                  style={{ 
                    maxWidth: '100%', 
                    height: 'auto', 
                    borderRadius: '4px', 
                    boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
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
              gap: '10px',
              marginBottom: '14px',
              padding: '6px 14px',
              background: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-glass)'
            }}>
              <button className="btn-ghost" onClick={() => setImgZoom(z => Math.max(0.5, z - 0.2))}>
                <ZoomOut size={16} />
              </button>
              <button className="btn-ghost" onClick={() => { setImgZoom(1); setImgRotation(0); }} style={{ fontSize: '0.8rem' }}>
                Reset
              </button>
              <button className="btn-ghost" onClick={() => setImgZoom(z => Math.min(3, z + 0.2))}>
                <ZoomIn size={16} />
              </button>
              <button className="btn-ghost" onClick={() => setImgRotation(r => (r + 90) % 360)}>
                <RotateCw size={16} />
              </button>
            </div>

            <div style={{
              overflow: 'auto',
              maxWidth: '100%',
              maxHeight: '75vh',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(0, 0, 0, 0.3)'
            }}>
              <img 
                src={mediaData.cloudUrl || mediaData.url || mediaData.dataUrl} 
                alt={mediaData.title}
                style={{
                  transform: `scale(${imgZoom}) rotate(${imgRotation}deg)`,
                  transition: 'transform 0.2s ease',
                  maxWidth: '100%',
                  maxHeight: '70vh',
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
          <div style={{ width: '100%', maxWidth: '850px' }}>
            <video 
              controls 
              autoPlay 
              playsInline 
              src={mediaData.cloudUrl || mediaData.url || mediaData.dataUrl}
              style={{
                width: '100%',
                maxHeight: '75vh',
                borderRadius: 'var(--radius-md)',
                boxShadow: '0 10px 40px rgba(0,0,0,0.6)',
                background: '#000'
              }}
            />
          </div>
        )}

        {/* --- 4. AUDIO VIEWER --- */}
        {mediaData.type === 'audio' && (
          <div style={{ width: '100%', maxWidth: '550px', textAlign: 'center', padding: '40px 20px' }}>
            <div style={{
              width: '72px',
              height: '72px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #a855f7, #6366f1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px auto',
              boxShadow: '0 0 30px rgba(168, 85, 247, 0.4)'
            }}>
              <Music size={36} color="#fff" />
            </div>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>{mediaData.title}</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '0.85rem' }}>Audio Voice Recording</p>
            <audio 
              controls 
              src={mediaData.cloudUrl || mediaData.url || mediaData.dataUrl} 
              style={{ width: '100%', outline: 'none' }}
            />
          </div>
        )}

        {/* --- 5. TEXT / MARKDOWN / NOTE VIEWER --- */}
        {(mediaData.type === 'text' || mediaData.type === 'link') && (
          <div style={{
            width: '100%',
            maxWidth: '850px',
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
              {mediaData.cloudUrl || mediaData.url || mediaData.dataUrl || mediaData.description}
            </div>

            {mediaData.type === 'link' && (
              <div style={{ marginTop: '20px' }}>
                <a 
                  href={mediaData.cloudUrl || mediaData.url || mediaData.dataUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="btn-primary"
                >
                  <LinkIcon size={16} /> Open Destination
                </a>
              </div>
            )}
          </div>
        )}

      </div>

    </div>
  );
}

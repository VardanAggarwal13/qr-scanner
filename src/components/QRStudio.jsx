import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { 
  FileText, Image as ImageIcon, Video, Music, Link as LinkIcon, 
  Upload, Sparkles, Download, Copy, Share2, Eye, Lock, CheckCircle2, 
  Palette, Sliders, Layers, RefreshCw, Smartphone, Printer, ExternalLink, AlertCircle, Cloud
} from 'lucide-react';
import QRCanvas from './QRCanvas';
import { getShareProblems, packMediaToViewerURL, fileToDataURL, compressImageFile } from '../utils/mediaCompressor';
import { saveCreatedDocument } from '../utils/storage';
import { uploadMediaToCloud } from '../utils/cloudStorage';

const GRADIENT_PRESETS = [
  { name: 'Electric Violet', color1: '#6366f1', color2: '#a855f7' },
  { name: 'Cyber Neon', color1: '#06b6d4', color2: '#3b82f6' },
  { name: 'Sunset Glow', color1: '#f43f5e', color2: '#fb923c' },
  { name: 'Emerald Forest', color1: '#10b981', color2: '#059669' },
  { name: 'Midnight Onyx', color1: '#1e293b', color2: '#0f172a' },
  { name: 'Pure Classic', color1: '#000000', color2: '#000000' },
];

export default function QRStudio({ onPreviewDocument }) {
  // Attached Media State
  const [currentDocId] = useState(() => `doc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`);
  const [mediaType, setMediaType] = useState('pdf'); // 'pdf' | 'image' | 'text' | 'audio' | 'video' | 'link'
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [author, setAuthor] = useState('');
  const [pin, setPin] = useState('');
  const [directOpen, setDirectOpen] = useState(true);
  const [fileDataUrl, setFileDataUrl] = useState('');
  const [cloudUrl, setCloudUrl] = useState('');
  const [cloudProvider, setCloudProvider] = useState('');
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState(0);
  const [externalUrl, setExternalUrl] = useState('');
  const [textContent, setTextContent] = useState('');
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [pendingFile, setPendingFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  // QR Styling State
  const [dotsStyle, setDotsStyle] = useState('rounded');
  const [selectedGradient, setSelectedGradient] = useState(GRADIENT_PRESETS[0]);
  const [bgColor, setBgColor] = useState('#ffffff');
  const [cornersStyle, setCornersStyle] = useState('extra-rounded');
  const [centerLogo, setCenterLogo] = useState(true);
  const [frameText, setFrameText] = useState('Scan to View Document');
  const [hasFrame, setHasFrame] = useState(true);

  // Result & Sharing
  const [generatedUrl, setGeneratedUrl] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);

  const fileInputRef = useRef(null);
  const needsUpload = ['pdf', 'image', 'audio', 'video'].includes(mediaType) && !cloudUrl;

  // Compute public QR target URL whenever inputs change
  useEffect(() => {
    let currentPublicUrl = cloudUrl;
    if (mediaType === 'link') currentPublicUrl = externalUrl;

    const mediaObj = {
      id: currentDocId,
      type: mediaType,
      title: title || (fileName ? fileName.replace(/\.[^/.]+$/, '') : `Attached ${mediaType.toUpperCase()}`),
      description,
      author,
      pin,
      fileName,
      mimeType: mediaType === 'pdf' ? 'application/pdf' : 'image/jpeg',
      cloudUrl: currentPublicUrl,
      dataUrl: fileDataUrl || currentPublicUrl || textContent,
      url: currentPublicUrl || fileDataUrl || textContent,
      timestamp: Date.now()
    };

    const targetUrl = packMediaToViewerURL(mediaObj);
    // Direct mode: the QR holds the raw file URL, so phones open the PDF/image itself instead of this site
    const isFileType = ['pdf', 'image', 'video', 'audio'].includes(mediaType);
    const useDirect = directOpen && !pin && isFileType && cloudUrl.startsWith('http');
    setGeneratedUrl(useDirect ? cloudUrl : targetUrl);
  }, [currentDocId, directOpen, mediaType, title, description, author, pin, fileDataUrl, cloudUrl, fileName, externalUrl, textContent]);

  // Handle File Upload & Cloud Sync
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingFile(true);
    setUploadError('');
    setCloudUrl('');
    setPendingFile(file);
    setFileName(file.name);
    setFileSize(file.size);
    if (!title) setTitle(file.name.replace(/\.[^/.]+$/, ''));

    try {
      // 1. Local Preview DataURL
      setUploadStatus('Preparing local preview...');
      if (file.type.startsWith('image/')) {
        setMediaType('image');
        const compressedData = await compressImageFile(file, 1200, 0.85);
        setFileDataUrl(compressedData);
      } else if (file.type === 'application/pdf') {
        setMediaType('pdf');
        const dataUrl = await fileToDataURL(file);
        setFileDataUrl(dataUrl);
      } else if (file.type.startsWith('video/')) {
        setMediaType('video');
        const dataUrl = await fileToDataURL(file);
        setFileDataUrl(dataUrl);
      } else if (file.type.startsWith('audio/')) {
        setMediaType('audio');
        const dataUrl = await fileToDataURL(file);
        setFileDataUrl(dataUrl);
      } else {
        const dataUrl = await fileToDataURL(file);
        setFileDataUrl(dataUrl);
      }

    } catch (err) {
      console.warn('Could not prepare local preview:', err);
    } finally {
      setIsProcessingFile(false);
      setUploadStatus('');
    }
  };

  // Explicit upload to the storage bucket, triggered by the Upload button
  const handleCloudUpload = async () => {
    if (!pendingFile || isUploading) return;
    setIsUploading(true);
    setUploadError('');
    try {
      const uploadRes = await uploadMediaToCloud(pendingFile, pendingFile.name);
      if (uploadRes?.url) {
        setCloudUrl(uploadRes.url);
        setCloudProvider(uploadRes.provider);
        try {
          confetti({ particleCount: 35, spread: 65, origin: { y: 0.7 } });
        } catch (e) {}
      }
    } catch (err) {
      console.warn('Cloud upload failed:', err);
      setUploadError(err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownloadQR = () => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return;

    saveCreatedDocument({
      id: currentDocId,
      type: mediaType,
      title: title || `Attached ${mediaType.toUpperCase()}`,
      description,
      author,
      fileName,
      url: generatedUrl,
      cloudUrl: cloudUrl,
      timestamp: Date.now()
    });

    const link = document.createElement('a');
    link.download = `${(title || 'qr-code').toLowerCase().replace(/\s+/g, '-')}-qr.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();

    try {
      confetti({ particleCount: 60, spread: 80, origin: { y: 0.6 } });
    } catch (e) {}
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(generatedUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleTestViewer = () => {
    const mediaObj = {
      id: currentDocId,
      type: mediaType,
      title: title || `Attached ${mediaType.toUpperCase()}`,
      description,
      author,
      pin,
      fileName,
      dataUrl: cloudUrl || fileDataUrl || externalUrl || textContent,
      url: cloudUrl || fileDataUrl || externalUrl || textContent,
      cloudUrl: cloudUrl,
      timestamp: Date.now()
    };
    if (onPreviewDocument) {
      onPreviewDocument(mediaObj);
    }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 16px 80px 16px' }}>
      {/* Intro Header */}
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <div className="badge badge-primary" style={{ marginBottom: '12px' }}>
          <Sparkles size={13} /> Document & Media to QR Studio
        </div>
        <h1 style={{ fontSize: '2.2rem', fontWeight: 800, marginBottom: '10px' }}>
          Attach Any Media & Generate a <span className="gradient-text">Smart QR</span>
        </h1>
        <p style={{ color: 'var(--text-secondary)', maxWidth: '640px', margin: '0 auto', fontSize: '1rem', lineHeight: 1.6 }}>
          Attach a PDF document, image, video, audio note, or custom link. Anyone who scans the QR code from their phone camera will instantly view your attached file!
        </p>
      </div>

      {/* Grid Layout: Left Configuration, Right Live QR & Simulator */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '28px', alignItems: 'start' }}>
        
        {/* === LEFT COLUMN: Step 1 & Step 2 === */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Step 1: Media Selection & Upload */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: 'var(--accent-primary)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '0.9rem'
              }}>1</div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Choose Media / Document Type</h2>
            </div>

            {/* Type selector tabs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '20px' }}>
              {[
                { id: 'pdf', label: 'PDF Doc', icon: FileText, color: '#ef4444' },
                { id: 'image', label: 'Image/Photo', icon: ImageIcon, color: '#10b981' },
                { id: 'video', label: 'Video Clip', icon: Video, color: '#3b82f6' },
                { id: 'audio', label: 'Audio/Voice', icon: Music, color: '#a855f7' },
                { id: 'link', label: 'Web Link', icon: LinkIcon, color: '#06b6d4' },
                { id: 'text', label: 'Rich Note', icon: FileText, color: '#f59e0b' },
              ].map(item => {
                const Icon = item.icon;
                const isActive = mediaType === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setMediaType(item.id)}
                    style={{
                      padding: '12px 8px',
                      borderRadius: 'var(--radius-md)',
                      border: isActive ? `2px solid ${item.color}` : '1px solid var(--border-glass)',
                      background: isActive ? 'rgba(255, 255, 255, 0.08)' : 'var(--bg-secondary)',
                      color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '8px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      boxShadow: isActive ? `0 0 15px ${item.color}33` : 'none'
                    }}
                  >
                    <Icon size={22} color={item.color} />
                    <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>{item.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Upload Zone for Files */}
            {(mediaType === 'pdf' || mediaType === 'image' || mediaType === 'audio' || mediaType === 'video') && (
              <div 
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: '2px dashed var(--border-glass-bright)',
                  borderRadius: 'var(--radius-md)',
                  padding: '30px 20px',
                  textAlign: 'center',
                  background: 'rgba(99, 102, 241, 0.04)',
                  cursor: 'pointer',
                  marginBottom: '20px',
                  transition: 'all 0.2s ease'
                }}
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  style={{ display: 'none' }}
                  accept={
                    mediaType === 'pdf' ? '.pdf,application/pdf' :
                    mediaType === 'image' ? 'image/*' :
                    mediaType === 'video' ? 'video/*' : 'audio/*'
                  }
                  onChange={handleFileUpload}
                />
                <div style={{
                  width: '54px',
                  height: '54px',
                  borderRadius: '50%',
                  background: 'rgba(99, 102, 241, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 14px auto',
                  color: 'var(--accent-primary)'
                }}>
                  {isProcessingFile ? <RefreshCw className="animate-spin" size={24} /> : <Upload size={24} />}
                </div>

                {fileName ? (
                  <div>
                    <p style={{ fontWeight: 700, color: 'var(--success)', marginBottom: '4px' }}>
                      {cloudUrl ? '✓' : '•'} File Selected: {fileName}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      <span>{(fileSize / 1024 / 1024).toFixed(2)} MB • {cloudUrl ? 'Uploaded' : 'Not uploaded yet'}</span>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p style={{ fontWeight: 600, marginBottom: '4px' }}>
                      Click to upload {mediaType.toUpperCase()} file
                    </p>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {mediaType === 'pdf' ? 'PDF brochures, menus, passes, invoices' :
                       mediaType === 'image' ? 'JPG, PNG, WEBP, SVG graphics' :
                       mediaType === 'video' ? 'MP4, WEBM clips' : 'MP3, WAV voice recordings'}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Upload button: sends the attached file to the storage bucket */}
            {(mediaType === 'pdf' || mediaType === 'image' || mediaType === 'audio' || mediaType === 'video') && pendingFile && (
              <div style={{ marginBottom: '20px' }}>
                {cloudUrl ? (
                  <p style={{ color: 'var(--success)', fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CheckCircle2 size={16} /> Uploaded{cloudProvider ? ` to ${cloudProvider}` : ''}. Your QR is ready to scan.
                  </p>
                ) : (
                  <button className="btn-primary" onClick={handleCloudUpload} disabled={isUploading || isProcessingFile} style={{ width: '100%' }}>
                    {isUploading ? <RefreshCw className="animate-spin" size={18} /> : <Upload size={18} />}
                    {isUploading ? 'Uploading…' : 'Upload to Cloud & Create QR'}
                  </button>
                )}
              </div>
            )}

            {/* External URL Input for 'link' */}
            {mediaType === 'link' && (
              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                  Target Web URL
                </label>
                <input 
                  type="url"
                  className="glass-input"
                  placeholder="https://example.com/my-portfolio"
                  value={externalUrl}
                  onChange={(e) => setExternalUrl(e.target.value)}
                />
              </div>
            )}

            {/* Rich Text / Note Input for 'text' */}
            {mediaType === 'text' && (
              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                  Document / Note Content
                </label>
                <textarea 
                  className="glass-input"
                  rows={5}
                  placeholder="Type or paste your notice, event guidelines, instructions, or secret note here..."
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  style={{ resize: 'vertical' }}
                />
              </div>
            )}

            {/* Document Metadata Fields */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                  Document Title
                </label>
                <input 
                  type="text"
                  className="glass-input"
                  placeholder="e.g. Summer Menu 2026"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                  Author / Organization
                </label>
                <input 
                  type="text"
                  className="glass-input"
                  placeholder="e.g. Acme Cafe"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                />
              </div>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                Brief Description (Optional)
              </label>
              <input 
                type="text"
                className="glass-input"
                placeholder="e.g. Scan this code to view today's special chef dishes"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {/* Passcode Security */}
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                <Lock size={14} color="var(--warning)" /> Passcode Protection (Optional)
              </label>
              <input 
                type="text"
                className="glass-input"
                placeholder="Leave blank for public access, or set 4-digit PIN"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                maxLength={8}
              />
            </div>

            {/* Direct open */}
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginTop: '14px', fontSize: '0.85rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={directOpen} onChange={(e) => setDirectOpen(e.target.checked)} style={{ marginTop: '3px' }} />
              <span>
                <strong>Open the file directly when scanned</strong>
                <span style={{ display: 'block', color: 'var(--text-secondary)' }}>
                  Phones go straight to the PDF/image instead of this website. Not used when a passcode is set.
                </span>
              </span>
            </label>
          </div>

          {/* Step 2: Custom QR Design & Styling */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: 'var(--accent-secondary)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '0.9rem'
              }}>2</div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Custom QR Branding & Style</h2>
            </div>

            {/* Gradient Theme Selector */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '8px' }}>
                Color Palette Gradient
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                {GRADIENT_PRESETS.map((grad, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedGradient(grad)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                      background: `linear-gradient(135deg, ${grad.color1}, ${grad.color2})`,
                      color: '#fff',
                      border: selectedGradient.name === grad.name ? '2px solid #fff' : '1px solid rgba(255,255,255,0.2)',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      textAlign: 'center',
                      textShadow: '0 1px 3px rgba(0,0,0,0.5)',
                      boxShadow: selectedGradient.name === grad.name ? '0 0 10px rgba(255,255,255,0.5)' : 'none'
                    }}
                  >
                    {grad.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Dot & Corner Matrix Styles */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '18px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                  QR Pattern Style
                </label>
                <select 
                  className="glass-input" 
                  value={dotsStyle} 
                  onChange={(e) => setDotsStyle(e.target.value)}
                >
                  <option value="rounded" style={{ background: '#0f172a' }}>Rounded Smooth</option>
                  <option value="dots" style={{ background: '#0f172a' }}>Circular Dots</option>
                  <option value="classy-rounded" style={{ background: '#0f172a' }}>Classy Modern</option>
                  <option value="square" style={{ background: '#0f172a' }}>Classic Square</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                  Corner Eyes
                </label>
                <select 
                  className="glass-input" 
                  value={cornersStyle} 
                  onChange={(e) => setCornersStyle(e.target.value)}
                >
                  <option value="extra-rounded" style={{ background: '#0f172a' }}>Extra Rounded</option>
                  <option value="dot" style={{ background: '#0f172a' }}>Target Dot</option>
                  <option value="square" style={{ background: '#0f172a' }}>Solid Square</option>
                </select>
              </div>
            </div>

            {/* Logo in Center & Poster Frame Options */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.9rem' }}>
                <input 
                  type="checkbox" 
                  checked={centerLogo} 
                  onChange={(e) => setCenterLogo(e.target.checked)}
                  style={{ width: '18px', height: '18px', accentColor: 'var(--accent-primary)' }}
                />
                <span>Embed Document Type Badge in Center</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.9rem' }}>
                <input 
                  type="checkbox" 
                  checked={hasFrame} 
                  onChange={(e) => setHasFrame(e.target.checked)}
                  style={{ width: '18px', height: '18px', accentColor: 'var(--accent-primary)' }}
                />
                <span>Include Call-To-Action Standee Frame</span>
              </label>

              {hasFrame && (
                <input 
                  type="text"
                  className="glass-input"
                  placeholder="e.g. Scan to View Document"
                  value={frameText}
                  onChange={(e) => setFrameText(e.target.value)}
                  style={{ marginTop: '4px' }}
                />
              )}
            </div>

          </div>

        </div>

        {/* === RIGHT COLUMN: Live QR Code Standee & Action Suite === */}
        <div style={{ position: 'sticky', top: '24px' }}>
          
          <div className="glass-panel" style={{ padding: '28px', textAlign: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
              <span className="badge badge-success">
                <CheckCircle2 size={12} /> Live Render
              </span>
              <button className="btn-ghost" onClick={handleTestViewer} title="Simulate scanning on phone">
                <Smartphone size={16} /> Test Mobile Screen
              </button>
            </div>

            {/* Printable Frame / Standee Card */}
            <div style={{
              background: '#ffffff',
              borderRadius: 'var(--radius-lg)',
              padding: hasFrame ? '24px 20px 20px 20px' : '20px',
              display: 'inline-block',
              boxShadow: '0 20px 45px rgba(0,0,0,0.5)',
              border: '4px solid #f1f5f9',
              margin: '0 auto 24px auto',
              maxWidth: '320px',
              color: '#0f172a'
            }}>
              {hasFrame && (
                <div style={{ marginBottom: '14px', fontWeight: 800, fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: selectedGradient.color1 }}>
                  {frameText || 'Scan to View'}
                </div>
              )}

              {/* QR Canvas */}
              <div style={{ minHeight: '260px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <QRCanvas 
                  value={generatedUrl || window.location.href}
                  size={260}
                  gradient={selectedGradient}
                  bgColor={bgColor}
                  dotsStyle={dotsStyle}
                  cornersStyle={cornersStyle}
                  centerIconType={mediaType}
                  showCenterIcon={centerLogo}
                />
              </div>

              {hasFrame && (
                <div style={{ marginTop: '12px', borderTop: '1px dashed #cbd5e1', paddingTop: '10px' }}>
                  <p style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b' }}>
                    {title || (fileName ? fileName.replace(/\.[^/.]+$/, '') : 'Attached Media')}
                  </p>
                  {author && (
                    <p style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      By {author}
                    </p>
                  )}
                </div>
              )}
            </div>

            {uploadError && (
              <div style={{ padding: '10px 12px', marginBottom: '12px', borderRadius: 'var(--radius-md)', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#fca5a5', fontSize: '0.8rem', textAlign: 'left', wordBreak: 'break-word' }}>
                <strong>Upload error:</strong> {uploadError}
              </div>
            )}

            {generatedUrl && getShareProblems(generatedUrl).map((msg, i) => (
              <div key={i} style={{ display: 'flex', gap: '8px', padding: '10px 12px', marginBottom: '12px', borderRadius: 'var(--radius-md)', background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.4)', color: '#fbbf24', fontSize: '0.82rem', textAlign: 'left' }}>
                <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>{msg}</span>
              </div>
            ))}

            {/* Action Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button className="btn-primary" onClick={handleDownloadQR} disabled={needsUpload} style={{ width: '100%', opacity: needsUpload ? 0.5 : 1 }}>
                <Download size={18} /> Download High-Res QR (PNG)
              </button>

              <button className="btn-secondary" onClick={handleCopyLink} disabled={needsUpload} style={{ width: '100%', opacity: needsUpload ? 0.5 : 1 }}>
                {copiedLink ? <CheckCircle2 size={16} color="var(--success)" /> : <Copy size={16} />}
                <span>{copiedLink ? 'Copied Link!' : 'Copy Direct Link'}</span>
              </button>

              <button className="btn-ghost" onClick={handleTestViewer} style={{ width: '100%', marginTop: '6px' }}>
                <Eye size={16} /> Open Receiver View ({mediaType.toUpperCase()})
              </button>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}

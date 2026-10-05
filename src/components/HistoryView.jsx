import React, { useState, useEffect } from 'react';
import { 
  History, Star, Trash2, Download, Search, ExternalLink, 
  Copy, CheckCircle2, FileText, ArrowRight, Eye, ShieldAlert, Sparkles
} from 'lucide-react';
import { 
  getScanHistory, toggleScanFavorite, deleteScanFromHistory, 
  clearScanHistory, getCreatedDocuments, deleteCreatedDocument 
} from '../utils/storage';
import { parseQRContent } from '../utils/contentParser';

export default function HistoryView({ onOpenResult, onOpenDocument }) {
  const [activeTab, setActiveTab] = useState('scans'); // 'scans' | 'created'
  const [scans, setScans] = useState([]);
  const [createdDocs, setCreatedDocs] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterFavorites, setFilterFavorites] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  const loadData = () => {
    setScans(getScanHistory());
    setCreatedDocs(getCreatedDocuments());
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggleFavorite = (id) => {
    const updated = toggleScanFavorite(id);
    setScans(updated);
  };

  const handleDeleteScan = (id) => {
    const updated = deleteScanFromHistory(id);
    setScans(updated);
  };

  const handleDeleteCreated = (id) => {
    const updated = deleteCreatedDocument(id);
    setCreatedDocs(updated);
  };

  const handleClearAll = () => {
    if (confirm('Are you sure you want to clear all scan history?')) {
      clearScanHistory();
      setScans([]);
    }
  };

  const handleCopy = (id, text) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Export to CSV
  const handleExportCSV = () => {
    const dataToExport = activeTab === 'scans' ? scans : createdDocs;
    if (dataToExport.length === 0) return;

    let csv = 'ID,Type,Content,Date\n';
    dataToExport.forEach(item => {
      const date = new Date(item.timestamp).toISOString();
      const content = (item.rawValue || item.url || item.title || '').replace(/"/g, '""');
      const type = item.type || item.format || 'qr_code';
      csv += `"${item.id}","${type}","${content}","${date}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `qr-${activeTab}-export-${Date.now()}.csv`;
    a.click();
  };

  // Filtered scans
  const filteredScans = scans.filter(item => {
    const matchesSearch = item.rawValue.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFav = filterFavorites ? item.favorite : true;
    return matchesSearch && matchesFav;
  });

  const filteredCreated = createdDocs.filter(item => {
    return (item.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
           (item.description || '').toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '0 16px 80px 16px' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div className="badge badge-primary" style={{ marginBottom: '6px' }}>
            <History size={12} /> Local Storage Vault
          </div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 800 }}>Activity & Document History</h2>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button className="btn-secondary" onClick={handleExportCSV}>
            <Download size={16} /> Export CSV
          </button>
          {activeTab === 'scans' && scans.length > 0 && (
            <button className="btn-ghost" onClick={handleClearAll} style={{ color: 'var(--danger)' }}>
              <Trash2 size={16} /> Clear All
            </button>
          )}
        </div>
      </div>

      {/* Main Tabs (Scanned QRs vs. Created Documents) */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        borderBottom: '1px solid var(--border-glass)',
        paddingBottom: '12px',
        marginBottom: '20px'
      }}>
        <button
          onClick={() => setActiveTab('scans')}
          className={`btn-ghost ${activeTab === 'scans' ? 'active' : ''}`}
          style={{
            fontWeight: activeTab === 'scans' ? 700 : 500,
            color: activeTab === 'scans' ? 'var(--accent-primary)' : 'var(--text-secondary)',
            borderBottom: activeTab === 'scans' ? '2px solid var(--accent-primary)' : 'none',
            borderRadius: 0,
            padding: '8px 16px',
            fontSize: '0.95rem'
          }}
        >
          Scanned QRs ({scans.length})
        </button>

        <button
          onClick={() => setActiveTab('created')}
          className={`btn-ghost ${activeTab === 'created' ? 'active' : ''}`}
          style={{
            fontWeight: activeTab === 'created' ? 700 : 500,
            color: activeTab === 'created' ? 'var(--accent-primary)' : 'var(--text-secondary)',
            borderBottom: activeTab === 'created' ? '2px solid var(--accent-primary)' : 'none',
            borderRadius: 0,
            padding: '8px 16px',
            fontSize: '0.95rem'
          }}
        >
          Created Document QRs ({createdDocs.length})
        </button>
      </div>

      {/* Filter Bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input 
            type="text"
            className="glass-input"
            placeholder="Search content or title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '38px' }}
          />
        </div>

        {activeTab === 'scans' && (
          <button 
            className={`btn-secondary ${filterFavorites ? 'active' : ''}`}
            onClick={() => setFilterFavorites(!filterFavorites)}
            style={{ color: filterFavorites ? '#f59e0b' : undefined, borderColor: filterFavorites ? '#f59e0b' : undefined }}
          >
            <Star size={16} fill={filterFavorites ? '#f59e0b' : 'none'} />
            <span>Favorites Only</span>
          </button>
        )}
      </div>

      {/* Scans List */}
      {activeTab === 'scans' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filteredScans.length === 0 ? (
            <div className="glass-panel" style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              No scan records found. Scan any QR code with camera or file upload to see history here!
            </div>
          ) : (
            filteredScans.map(item => {
              const parsed = parseQRContent(item.rawValue);
              return (
                <div key={item.id} className="glass-card" style={{ padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: '260px' }}>
                    {item.thumbnail && (
                      <div style={{ width: '48px', height: '48px', borderRadius: 'var(--radius-sm)', background: '#000', overflow: 'hidden', flexShrink: 0 }}>
                        <img src={item.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                      </div>
                    )}
                    <div style={{ overflow: 'hidden' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span className="badge badge-primary">{parsed.type.toUpperCase()}</span>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          {new Date(item.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <p style={{ fontWeight: 600, fontSize: '0.92rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {parsed.title}
                      </p>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.rawValue}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button 
                      className="btn-ghost" 
                      onClick={() => handleToggleFavorite(item.id)} 
                      title="Favorite"
                      style={{ color: item.favorite ? '#f59e0b' : undefined }}
                    >
                      <Star size={18} fill={item.favorite ? '#f59e0b' : 'none'} />
                    </button>
                    <button 
                      className="btn-ghost" 
                      onClick={() => handleCopy(item.id, item.rawValue)} 
                      title="Copy"
                    >
                      {copiedId === item.id ? <CheckCircle2 size={18} color="var(--success)" /> : <Copy size={18} />}
                    </button>
                    <button 
                      className="btn-secondary" 
                      onClick={() => onOpenResult(item)}
                      style={{ padding: '6px 12px', fontSize: '0.82rem' }}
                    >
                      Inspect <ArrowRight size={14} />
                    </button>
                    <button 
                      className="btn-ghost" 
                      onClick={() => handleDeleteScan(item.id)} 
                      title="Delete"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Created Documents List */}
      {activeTab === 'created' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filteredCreated.length === 0 ? (
            <div className="glass-panel" style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              No created document QR codes yet. Use the "Create & Attach" tab to generate branded QRs for your documents!
            </div>
          ) : (
            filteredCreated.map(doc => (
              <div key={doc.id} className="glass-card" style={{ padding: '18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: '260px' }}>
                  <div style={{
                    width: '46px',
                    height: '46px',
                    borderRadius: 'var(--radius-md)',
                    background: 'rgba(99, 102, 241, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--accent-primary)',
                    flexShrink: 0
                  }}>
                    <FileText size={22} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span className="badge badge-success">{doc.type?.toUpperCase() || 'DOCUMENT'}</span>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        {new Date(doc.timestamp).toLocaleDateString()}
                      </span>
                    </div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>{doc.title}</h3>
                    {doc.description && (
                      <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{doc.description}</p>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button 
                    className="btn-ghost" 
                    onClick={() => handleCopy(doc.id, doc.url)} 
                    title="Copy QR Link"
                  >
                    {copiedId === doc.id ? <CheckCircle2 size={18} color="var(--success)" /> : <Copy size={18} />}
                  </button>
                  <button 
                    className="btn-secondary" 
                    onClick={() => onOpenDocument(doc)}
                    style={{ padding: '6px 12px', fontSize: '0.82rem' }}
                  >
                    <Eye size={14} /> Open Viewer
                  </button>
                  <button 
                    className="btn-ghost" 
                    onClick={() => handleDeleteCreated(doc.id)} 
                    title="Delete"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

    </div>
  );
}

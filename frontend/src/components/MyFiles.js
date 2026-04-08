import React, { useState, useEffect, useCallback } from 'react';
import API_BASE from '../apiConfig';
import ConfirmModal from './ConfirmModal';
import '../styles/MyFiles.css';
import '../styles/ConfirmModal.css';

function MyFiles({ userAddress, onSelectFile }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  
  // Modal State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [fileIdToDelete, setFileIdToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchFiles = useCallback(async () => {
    if (!userAddress) return;
    
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/my-files/${userAddress}`);
      
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await res.json();
        if (res.ok) {
          setFiles(data.files || []);
        } else {
          throw new Error(data.error || 'Failed to fetch files');
        }
      } else {
        throw new Error('Server returned invalid response');
      }
    } catch (err) {
      console.error('Fetch files error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [userAddress]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles, refreshKey]);

  const openDeleteModal = (fileId) => {
    setFileIdToDelete(fileId);
    setIsDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    setIsDeleteModalOpen(false);
    setFileIdToDelete(null);
  };

  const handleDelete = async () => {
    if (!fileIdToDelete) return;

    setIsDeleting(true);
    setError(null);
    setSuccessMessage('');

    try {
      const res = await fetch(`${API_BASE}/file/${fileIdToDelete}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ownerAddress: userAddress })
      });

      if (res.ok) {
        setRefreshKey(prev => prev + 1);
        setSuccessMessage(`✓ File ${fileIdToDelete.slice(-6)} deleted successfully`);
        closeDeleteModal();
        
        // Clear message after 5 seconds
        setTimeout(() => setSuccessMessage(''), 5000);
      } else {
        const data = await res.json();
        throw new Error(data.error || 'Delete failed');
      }
    } catch (err) {
      console.error('Delete error:', err);
      setError(`Failed to delete file: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const calculateTimeLeft = (expiryDate) => {
    const difference = new Date(expiryDate) - new Date();
    if (difference <= 0) return 'Expired';

    const days = Math.floor(difference / (1000 * 60 * 60 * 24));
    const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) return `${days}d ${hours}h`;
    return `${hours}h remaining`;
  };

  const formatSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (loading && files.length === 0) {
    return <div className="loading-state">✨ Discovering your secured files...</div>;
  }

  return (
    <div className="my-files-container">
      <div className="dashboard-header">
        <h2>📂 My Secured Files</h2>
        <button className="refresh-btn" onClick={() => setRefreshKey(prev => prev + 1)}>🔄 Refresh</button>
      </div>

      {error && <div className="error-message">❌ {error}</div>}
      {successMessage && <div className="success-banner-inline">✅ {successMessage}</div>}

      {files.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📁</div>
          <h3>No files found</h3>
          <p>Files you upload will appear here with their auto-deletion status.</p>
        </div>
      ) : (
        <div className="files-grid">
          {files.map((file) => {
            const timeLeft = calculateTimeLeft(file.expiresAt);
            const isExpiringSoon = timeLeft.includes('h remaining') || (timeLeft.startsWith('0d'));

            return (
              <div key={file.fileId} className="file-card">
                <div className="file-icon-wrapper">
                  <span className="file-type-icon">📄</span>
                </div>
                
                <div className="file-details">
                  <h4 title={file.fileName}>{file.fileName}</h4>
                  <div className="file-meta">
                    <span className="file-size">{formatSize(file.fileSize)}</span>
                    <span className="dot">•</span>
                    <span className="file-id">ID: {file.fileId.slice(-6)}</span>
                  </div>
                </div>

                <div className="file-status">
                  <div className={`expiry-badge ${isExpiringSoon ? 'warning' : ''}`}>
                    <span className="clock-icon">🕒</span> 
                    {timeLeft}
                  </div>
                </div>

                <div className="file-actions">
                  <button 
                    className="action-btn manage-btn" 
                    onClick={() => onSelectFile(file.fileId)}
                    title="Manage Access"
                  >
                    🔐
                  </button>
                  <button 
                    className="action-btn delete-btn" 
                    onClick={() => openDeleteModal(file.fileId)}
                    title="Delete Permanently"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="cleanup-info">
        <p>💡 <strong>Note:</strong> Files are automatically purged from the server 8 days after upload to ensure privacy and storage efficiency.</p>
      </div>

      <ConfirmModal 
        isOpen={isDeleteModalOpen}
        title="Permanently Delete File?"
        message={`This action cannot be undone. You are about to delete file ${fileIdToDelete?.slice(-6)}. Are you absolutely sure?`}
        confirmText={isDeleting ? 'Deleting...' : 'Permanently Delete'}
        cancelText="Keep File"
        onConfirm={handleDelete}
        onCancel={closeDeleteModal}
        type="danger"
      />
    </div>
  );
}

export default MyFiles;

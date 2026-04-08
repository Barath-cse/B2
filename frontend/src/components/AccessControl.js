import React, { useState, useEffect, useCallback } from 'react';
import '../styles/AccessControl.css';
import API_BASE from '../apiConfig';


// Access control panel with improved UI for managing file permissions
function AccessControl({ userAddress, provider, contract, abi, initialFileId, refreshToken }) {
  const [fileId, setFileId] = useState(initialFileId || '');
  const [metadata, setMetadata] = useState(null);
  const [addressInput, setAddressInput] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [loading, setLoading] = useState(false);
  const [accessList, setAccessList] = useState([]);
  const [showConfirmDialog, setShowConfirmDialog] = useState(null);

  // Key sharing states
  const [shareKeyRecipient, setShareKeyRecipient] = useState('');
  const [encryptionKeyInput, setEncryptionKeyInput] = useState('');
  const [showShareKeySection, setShowShareKeySection] = useState(false);


  // Sync fileId with initialFileId prop if it changes
  useEffect(() => {
    if (initialFileId) {
      setFileId(initialFileId);
    }
  }, [initialFileId]);

  // Handle first-time load when fileId and userAddress are both present
  useEffect(() => {
    if (initialFileId && userAddress && !metadata) {
      checkFile();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFileId, userAddress]);

  // Handle refreshToken
  useEffect(() => {
    if (refreshToken > 0 && fileId && metadata) {
      checkFile();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshToken]);

  const showMessage = (text, type = 'success') => {

    setMessage(text);
    setMessageType(type);
    setTimeout(() => setMessage(''), 5000);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    showMessage('✓ Copied to clipboard');
  };


  const checkFile = async () => {
    if (!fileId.trim()) {
      showMessage('Enter a file ID', 'error');
      return;
    }
    if (!userAddress) {
      showMessage('Please connect your wallet first', 'error');
      return;
    }
    
    setLoading(true);
    try {
      // First get file metadata
      console.log('Checking file:', fileId);
      const res = await fetch(`${API_BASE}/file-metadata/${fileId}`);
      
      const contentType = res.headers.get('content-type');
      let data;
      if (contentType && contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        throw new Error(res.ok ? 'Server returned success but not JSON' : `Server Error (${res.status}): ${text.slice(0, 100)}`);
      }

      if (!res.ok) throw new Error('File not found');
      setMetadata(data);

      
      console.log('File metadata loaded:', data);
      console.log('File owner:', data.owner, 'Current user:', userAddress);
      
      // Then get access list from shared keys
      try {
        const accessUrl = `${API_BASE}/access-list/${fileId}/${data.owner}`;
        console.log('Fetching access list from:', accessUrl);
        console.log('Owner from metadata:', data.owner);
        
        const accessRes = await fetch(accessUrl);
        console.log('Access list response status:', accessRes.status);
        
        if (accessRes.ok) {
          const accessData = await accessRes.json();
          console.log('Access list raw response:', accessData);
          
          if (accessData && accessData.accessList && Array.isArray(accessData.accessList)) {
            const usersList = accessData.accessList.map(access => access.userAddress).filter(addr => addr !== undefined);
            console.log('Extracted users list:', usersList);
            console.log(`Setting accessList to ${usersList.length} users`);
            setAccessList(usersList);
          } else {
            console.warn('No valid accessList in response, got:', accessData);
            setAccessList([]);
          }
        } else {
          console.warn('Access list endpoint error:', accessRes.status);
          const errorData = await accessRes.json();
          console.warn('Error details:', errorData);
          // Fallback to metadata.allowedUsers if available
          setAccessList(data.allowedUsers || []);
        }
      } catch (accessErr) {
        console.error('Error fetching access list:', accessErr);
        setAccessList(data.allowedUsers || []);
      }
      
      showMessage('File metadata loaded successfully');
    } catch (err) {
      console.error('Error in checkFile:', err);
      setMetadata(null);
      setAccessList([]);
      showMessage(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Auto-refresh access list to show users until expiry, then auto-revoke
  const refreshAccessListSilent = useCallback(async () => {
    if (!fileId.trim() || !metadata) {
      return;
    }

    try {
      const accessUrl = `${API_BASE}/access-list/${fileId}/${metadata.owner}`;
      const accessRes = await fetch(accessUrl);
      
      if (accessRes.ok) {
        const accessData = await accessRes.json();
        
        if (accessData && accessData.accessList && Array.isArray(accessData.accessList)) {
          const usersList = accessData.accessList.map(access => access.userAddress).filter(addr => addr !== undefined);
          console.log(`[Auto-Refresh] Access list updated: ${usersList.length} users`);
          
          // Update access list using functional update to avoid dependency on accessList itself
          setAccessList(prevList => {
            // Log if any users were removed (expired)
            const removedUsers = prevList.filter(user => !usersList.includes(user));
            if (removedUsers.length > 0) {
              console.log(`[Auto-Revoke] Expired keys detected for: ${removedUsers.map(u => u.slice(0, 6) + '...' + u.slice(-4)).join(', ')}`);
            }
            return usersList;
          });
        } else {
          setAccessList([]);
        }
      }
    } catch (err) {
      console.warn('[Auto-Refresh] Error updating access list:', err.message);
    }
  }, [fileId, metadata]); // Removed accessList and API_BASE dependencies



  // Set up auto-refresh interval when file is loaded
  useEffect(() => {
    if (!fileId.trim() || !metadata) {
      return;
    }

    console.log(`[Auto-Refresh] Starting 30-second refresh interval for file ${fileId}`);
    const interval = setInterval(() => {
      refreshAccessListSilent();
    }, 30000); // Refresh every 30 seconds

    return () => {
      clearInterval(interval);
      console.log(`[Auto-Refresh] Cleared refresh interval`);
    };
  }, [fileId, metadata, refreshAccessListSilent]);

  const grantAccess = async () => {
    if (!metadata) return;
    if (metadata.owner.toLowerCase() !== userAddress.toLowerCase()) {
      showMessage('Only owner can grant access', 'error');
      return;
    }
    if (!addressInput.trim()) {
      showMessage('Enter a valid address', 'error');
      return;
    }
    if (!addressInput.match(/^0x[a-fA-F0-9]{40}$/)) {
      showMessage('Invalid Ethereum address format', 'error');
      return;
    }
    
    setShowConfirmDialog({
      action: 'grant',
      address: addressInput,
      message: `Grant access to ${addressInput.slice(0, 6)}...${addressInput.slice(-4)}?`
    });
  };

  const confirmGrant = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/grant-access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          fileId, 
          ownerAddress: userAddress,
          userAddress: addressInput 
        })
      });
      
      const contentType = res.headers.get('content-type');
      let data;
      if (contentType && contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        throw new Error(res.ok ? 'Server returned success but not JSON' : `Server Error (${res.status}): ${text.slice(0, 100)}`);
      }

      if (!res.ok) throw new Error(data.error || 'Grant failed');
      showMessage(`✓ Access granted to ${addressInput.slice(0, 6)}...${addressInput.slice(-4)}`);
      setAddressInput('');
      setShowConfirmDialog(null);

      // Refresh access list
      if (!accessList.includes(addressInput)) {
        setAccessList([...accessList, addressInput]);
      }
    } catch (err) {
      console.error(err);
      showMessage(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const revokeAccess = async () => {
    if (!metadata) return;
    if (metadata.owner.toLowerCase() !== userAddress.toLowerCase()) {
      showMessage('Only owner can revoke access', 'error');
      return;
    }
    if (!addressInput.trim()) {
      showMessage('Enter a valid address', 'error');
      return;
    }
    if (!addressInput.match(/^0x[a-fA-F0-9]{40}$/)) {
      showMessage('Invalid Ethereum address format', 'error');
      return;
    }

    setShowConfirmDialog({
      action: 'revoke',
      address: addressInput,
      message: `Revoke access from ${addressInput.slice(0, 6)}...${addressInput.slice(-4)}?`
    });
  };

  const confirmRevoke = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/revoke-access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          fileId, 
          ownerAddress: userAddress,
          userAddress: addressInput 
        })
      });

      const contentType = res.headers.get('content-type');
      let data;
      if (contentType && contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        throw new Error(res.ok ? 'Server returned success but not JSON' : `Server Error (${res.status}): ${text.slice(0, 100)}`);
      }

      if (!res.ok) throw new Error(data.error || 'Revoke failed');
      showMessage(`✓ Access revoked from ${addressInput.slice(0, 6)}...${addressInput.slice(-4)}`);
      setAddressInput('');
      setShowConfirmDialog(null);

      // Update access list
      setAccessList(accessList.filter(addr => addr.toLowerCase() !== addressInput.toLowerCase()));
    } catch (err) {
      console.error(err);
      showMessage(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Share encryption key with another wallet
  const shareKey = async () => {
    if (!metadata) return;
    if (metadata.owner.toLowerCase() !== userAddress.toLowerCase()) {
      showMessage('Only owner can share encryption keys', 'error');
      return;
    }
    if (!shareKeyRecipient.trim()) {
      showMessage('Enter a valid recipient address', 'error');
      return;
    }
    if (!encryptionKeyInput.trim()) {
      showMessage('Enter the encryption key', 'error');
      return;
    }
    if (!shareKeyRecipient.match(/^0x[a-fA-F0-9]{40}$/)) {
      showMessage('Invalid Ethereum address format', 'error');
      return;
    }

    setShowConfirmDialog({
      action: 'shareKey',
      address: shareKeyRecipient,
      message: `Share encryption key with ${shareKeyRecipient.slice(0, 6)}...${shareKeyRecipient.slice(-4)}? They will be able to decrypt the file.`
    });
  };

  const confirmShareKey = async () => {
    setLoading(true);
    try {
      const shareKeyPayload = { 
        fileId, 
        encryptionKey: encryptionKeyInput, 
        recipientAddress: shareKeyRecipient,
        ownerAddress: userAddress,
        originalFilename: metadata?.originalName || metadata?.fileName || `file-${fileId}`
      };
      
      console.log('Sharing key with payload:', shareKeyPayload);
      
      const res = await fetch(`${API_BASE}/share-key`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(shareKeyPayload)
      });
      
      const contentType = res.headers.get('content-type');
      let data;
      if (contentType && contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        throw new Error(res.ok ? 'Server returned success but not JSON' : `Server Error (${res.status}): ${text.slice(0, 100)}`);
      }

      console.log('Share key response:', data);
      
      if (!res.ok) throw new Error(data.error || 'Share failed');
      
      showMessage(`✓ Encryption key shared with ${shareKeyRecipient.slice(0, 6)}...${shareKeyRecipient.slice(-4)}!\nExpires: ${new Date(data.expiresAt).toLocaleDateString()}`);
      setShareKeyRecipient('');
      setEncryptionKeyInput('');
      setShowConfirmDialog(null);

      
      // Refresh the access list to show newly shared user
      await new Promise(resolve => setTimeout(resolve, 300));
      await checkFile();
    } catch (err) {
      console.error('Error sharing key:', err);
      showMessage(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Revoke a key share
  const revokeKeyShare = async () => {
    if (!metadata) return;
    if (metadata.owner.toLowerCase() !== userAddress.toLowerCase()) {
      showMessage('Only owner can revoke key shares', 'error');
      return;
    }
    if (!shareKeyRecipient.trim()) {
      showMessage('Enter a valid recipient address', 'error');
      return;
    }
    if (!shareKeyRecipient.match(/^0x[a-fA-F0-9]{40}$/)) {
      showMessage('Invalid Ethereum address format', 'error');
      return;
    }

    setShowConfirmDialog({
      action: 'revokeKeyShare',
      address: shareKeyRecipient,
      message: `Revoke key share from ${shareKeyRecipient.slice(0, 6)}...${shareKeyRecipient.slice(-4)}?`
    });
  };

  const confirmRevokeKeyShare = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/revoke-key-share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          fileId, 
          recipientAddress: shareKeyRecipient,
          ownerAddress: userAddress
        })
      });

      const contentType = res.headers.get('content-type');
      let data;
      if (contentType && contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        throw new Error(res.ok ? 'Server returned success but not JSON' : `Server Error (${res.status}): ${text.slice(0, 100)}`);
      }

      if (!res.ok) throw new Error(data.error || 'Revoke failed');
      showMessage(`✓ Key share revoked from ${shareKeyRecipient.slice(0, 6)}...${shareKeyRecipient.slice(-4)}`);
      setShareKeyRecipient('');
      setEncryptionKeyInput('');
      setShowConfirmDialog(null);

    } catch (err) {
      console.error(err);
      showMessage(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Manual file deletion
  const deleteFile = async () => {
    if (!metadata) return;
    if (metadata.owner.toLowerCase() !== userAddress.toLowerCase()) {
      showMessage('Only owner can delete files', 'error');
      return;
    }

    setShowConfirmDialog({
      action: 'deleteFile',
      message: `🚨 PERMANENT DELETE: Are you sure you want to delete "${metadata.originalName || fileId}"? This action cannot be undone and will revoke access for all users.`
    });
  };

  const confirmDeleteFile = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/file/${fileId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ownerAddress: userAddress })
      });
      
      const contentType = res.headers.get('content-type');
      let data;
      if (contentType && contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        throw new Error(res.ok ? 'Server returned success but not JSON' : `Server Error (${res.status}): ${text.slice(0, 100)}`);
      }

      if (!res.ok) throw new Error(data.error || 'Delete failed');
      
      showMessage('💥 File and all metadata deleted successfully', 'success');
      setMetadata(null);
      setAccessList([]);
      setFileId('');
      setShowConfirmDialog(null);

    } catch (err) {
      console.error('Error deleting file:', err);
      showMessage(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="access-control-container">
      <div className="access-card">
        <h2>🔐 Access Control Panel</h2>
        
        {/* File Lookup Section */}
        <div className="section lookup-section">
          <h3>
            <span className="section-icon">📄</span> 
            Lookup File
          </h3>
          <div className="input-group">
            <input
              type="text"
              id="lookupFileId"
              name="lookupFileId"
              placeholder="Enter unique file ID..."
              value={fileId}
              onChange={e => setFileId(e.target.value)}
              disabled={loading}
              className="input-field"
              aria-label="Enter unique file ID for lookup"
            />
            <button onClick={checkFile} disabled={loading} className="btn btn-primary">
              {loading ? '🔄' : '🔍'} 
              <span className="btn-text">{loading ? 'Loading...' : 'Lookup'}</span>
            </button>
          </div>
        </div>

        {/* File Metadata Section */}
        {metadata && (
          <div className="section metadata-section">
            <h3>
              <span className="section-icon">📋</span> 
              File Details
            </h3>
            <div className="metadata-grid">
              <div className="metadata-item">
                <label htmlFor="ownerAddressMetadata">Owner Address</label>
                <div className="metadata-value">
                  <span className="badge-owner" id="ownerAddressMetadata">{metadata.owner.slice(0, 8)}...{metadata.owner.slice(-6)}</span>
                  <button 
                    className="copy-btn" 
                    onClick={() => copyToClipboard(metadata.owner)}
                    title="Copy address"
                  >
                    <span role="img" aria-label="copy">📋</span>
                  </button>
                </div>
              </div>
              <div className="metadata-item">
                <label htmlFor="fileHashMetadata">Cryptographic Hash (SHA-256)</label>
                <div className="metadata-value truncated">
                  <code className="hash-code" id="fileHashMetadata">{metadata.fileHash.slice(0, 16)}...{metadata.fileHash.slice(-16)}</code>
                  <button 
                    className="copy-btn" 
                    onClick={() => copyToClipboard(metadata.fileHash)}
                    title="Copy hash"
                  >
                    <span role="img" aria-label="copy">📋</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Access Users List */}
            {metadata.owner.toLowerCase() === userAddress.toLowerCase() && (
              <div className="access-users">
                <h4>
                  <span className="section-icon">👥</span> 
                  Authorized Users ({accessList.length})
                </h4>
                {accessList.length > 0 ? (
                  <div className="user-list">
                    {accessList.map((addr, idx) => (
                      <div key={idx} className="user-item">
                        <span className="user-address">{addr.slice(0, 10)}...{addr.slice(-8)}</span>
                        <button 
                          className="copy-btn" 
                          onClick={() => copyToClipboard(addr)}
                          title="Copy address"
                        >
                          <span role="img" aria-label="copy">📋</span>
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    <p className="empty-text">No users have been granted access yet.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Access Control Actions */}
        {metadata && metadata.owner.toLowerCase() === userAddress.toLowerCase() && (
          <>
            <div className="section action-section">
              <h3>
                <span className="section-icon">➕</span> 
                Manage Access
              </h3>
              <div className="input-group">
                <input
                  type="text"
                  id="grantRecipient"
                  name="grantRecipient"
                  placeholder="Recipient's wallet address (0x...)"
                  value={addressInput}
                  onChange={e => setAddressInput(e.target.value)}
                  disabled={loading}
                  className="input-field"
                  aria-label="Recipient wallet address for access management"
                />
                <button onClick={grantAccess} disabled={loading} className="btn btn-success">
                  <span className="btn-icon">✓</span> Grant
                </button>
                <button onClick={revokeAccess} disabled={loading} className="btn btn-danger">
                  <span className="btn-icon">✕</span> Revoke
                </button>
              </div>
            </div>

            <div className="section share-key-section">
              <h3>
                <span className="section-icon">🔑</span> 
                Secure Key Sharing
              </h3>
              <button 
                onClick={() => setShowShareKeySection(!showShareKeySection)}
                className="btn btn-info"
              >
                {showShareKeySection ? '▲' : '▼'} 
                <span className="btn-text">{showShareKeySection ? 'Hide Sharing Dashboard' : 'Show Sharing Dashboard'}</span>
              </button>

              {showShareKeySection && (
                <div className="share-key-form">
                  <p className="section-info">
                    <strong>Notice:</strong> This key allows direct decryption of the file. Only share with individuals who have already been granted blockchain access.
                  </p>
                  
                  <div className="form-group">
                    <label htmlFor="shareRecipient">Recipient Address</label>
                    <input
                      type="text"
                      id="shareRecipient"
                      name="shareRecipient"
                      placeholder="0x..."
                      value={shareKeyRecipient}
                      onChange={e => setShareKeyRecipient(e.target.value)}
                      disabled={loading}
                      className="input-field"
                    />
                  </div>

                  <div className="form-group password-group">
                    <label htmlFor="shareEncryptionKey">Encryption Key</label>
                    <div className="input-group">
                      <input
                        type="text"
                        id="shareEncryptionKey"
                        name="shareEncryptionKey"
                        placeholder="Enter the master encryption key..."
                        value={encryptionKeyInput}
                        onChange={e => setEncryptionKeyInput(e.target.value)}
                        disabled={loading}
                        className="input-field"
                      />
                    </div>
                    <small className="help-text">This is the unique key generated during the initial upload.</small>
                  </div>

                  <div className="button-group">
                    <button 
                      onClick={shareKey} 
                      disabled={loading} 
                      className="btn btn-success"
                    >
                      {loading ? '⏳' : '🔐'} 
                      <span className="btn-text">{loading ? 'Sharing...' : 'Share Key'}</span>
                    </button>
                    <button 
                      onClick={revokeKeyShare} 
                      disabled={loading} 
                      className="btn btn-danger"
                    >
                      {loading ? '⏳' : '❌'} 
                      <span className="btn-text">{loading ? 'Revoking...' : 'Revoke Key'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
 
            {/* Danger Zone */}
            <div className="section danger-section">
              <h3>
                <span className="section-icon">🚨</span> 
                Danger Zone
              </h3>
              <p className="section-info danger">
                Manual deletion is permanent. All metadata and linked access permissions will be destroyed instantly.
              </p>
              <button 
                onClick={deleteFile} 
                disabled={loading} 
                className="btn btn-danger btn-delete"
              >
                <span className="btn-icon">🗑️</span>
                <span className="btn-text">
                  {loading && showConfirmDialog?.action === 'deleteFile' ? 'Purging Data...' : 'Permanently Destroy File'}
                </span>
              </button>
            </div>
          </>
        )}


        {/* Messages */}
        {message && <div className={`message ${messageType}`}>{message}</div>}

        {/* Confirmation Dialog */}
        {showConfirmDialog && (
          <div className="modal-overlay" onClick={() => setShowConfirmDialog(null)}>
            <div className="modal-dialog" onClick={e => e.stopPropagation()}>
              <h3>Confirm Action</h3>
              <p>{showConfirmDialog.message}</p>
              <div className="modal-buttons">
                <button 
                  onClick={() => setShowConfirmDialog(null)}
                  className="btn btn-secondary"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    if (showConfirmDialog.action === 'grant') confirmGrant();
                    else if (showConfirmDialog.action === 'revoke') confirmRevoke();

                    else if (showConfirmDialog.action === 'shareKey') confirmShareKey();
                    else if (showConfirmDialog.action === 'revokeKeyShare') confirmRevokeKeyShare();
                    else if (showConfirmDialog.action === 'deleteFile') confirmDeleteFile();
                  }}

                  className="btn btn-primary"
                  disabled={loading}
                >
                  {loading ? '⏳ Processing...' : 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AccessControl;
import React, { useState } from 'react';
import { encryptFile, calculateHash } from '../utils/crypto';
import axios from 'axios';
import '../styles/FileUpload.css';
import API_BASE from '../apiConfig';


function FileUpload({ userAddress, provider, contract, onUploadSuccess }) {
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStep, setUploadStep] = useState(0); // 0=ready, 1=hashing, 2=encrypting, 3=uploading, 4=blockchain, 5=complete
  const [dragActive, setDragActive] = useState(false);
  const [uploadSuccessData, setUploadSuccessData] = useState(null);


  const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB

  const validateFile = (selectedFile) => {
    if (!selectedFile) return null;

    if (selectedFile.size > MAX_FILE_SIZE) {
      return `❌ File too large. Max size: ${MAX_FILE_SIZE / (1024 * 1024)}MB`;
    }

    // Allow all file types for now, but log unsupported types
    console.log(`File type: ${selectedFile.type}`);

    return null; // File is valid
  };

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      const error = validateFile(selectedFile);
      if (error) {
        setMessage(error);
        setMessageType('error');
        setFile(null);
        return;
      }
      setFile(selectedFile);
      setFileName(selectedFile.name);
      setMessage('');
      setUploadStep(0);
      setUploadSuccessData(null);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      const error = validateFile(droppedFile);
      if (error) {
        setMessage(error);
        setMessageType('error');
        setFile(null);
        return;
      }
      setFile(droppedFile);
      setFileName(droppedFile.name);
      setMessage('');
      setUploadStep(0);
      setUploadSuccessData(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setMessage('Please select a file');
      setMessageType('error');
      return;
    }

    if (!userAddress) {
      setMessage('❌ Please connect your wallet first');
      setMessageType('error');
      return;
    }

    setLoading(true);
    setUploadStep(1);
    setUploadProgress(0);

    try {
      // Step 1: Calculate hash of ORIGINAL file (for integrity)
      setMessage('📊 Calculating original file hash...');
      setUploadStep(1);
      const originalFileHash = await calculateHash(file);
      console.log('Original File Hash:', originalFileHash);
      setUploadProgress(20);

      // Step 2: Encrypt file using wallet-derived key
      setMessage('🔒 Encrypting file...');
      setUploadStep(2);
      const fileId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const encryptedData = await encryptFile(file, userAddress, fileId);
      console.log('File encrypted with wallet-derived key');
      setUploadProgress(40);

      // Step 3: Prepare FormData for upload
      setUploadStep(3);
      setMessage('☁️ Uploading encrypted file...');
      const encryptedBlob = new Blob([encryptedData.encryptedFile], { type: 'application/octet-stream' });
      const formData = new FormData();
      formData.append('file', encryptedBlob);
      formData.append('fileName', fileName);
      formData.append('owner', userAddress);
      formData.append('fileHash', originalFileHash); // Using ORIGINAL hash for metadata
      formData.append('fileId', fileId);

      const response = await axios.post(`${API_BASE}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const progress = 40 + Math.round((progressEvent.loaded * 40) / progressEvent.total);
          setUploadProgress(progress);
        }
      });
      console.log('Backend upload response:', response.data);
      setUploadProgress(80);

      // Step 4: Register on blockchain (NO CHARGE VERSION - via Backend)
      setUploadStep(4);
      setMessage('⛓️ Registering on blockchain (Gasless)...');
      try {
        const bcResponse = await axios.post(`${API_BASE}/store-hash`, {
          fileHash: originalFileHash,
          userAddress: userAddress
        });
        console.log('Blockchain registration response:', bcResponse.data);
      } catch (bcErr) {
        console.warn('Blockchain registration failed (server-side):', bcErr.message);
        // We don't fail the whole upload if blockchain fails, but we log it
      }

      setUploadProgress(100);
      setUploadStep(5);
      
      const successData = { 
        fileId, 
        fileName, 
        owner: userAddress, 
        hash: originalFileHash, 
        encryptionKey: encryptedData.key 
      };
      setUploadSuccessData(successData);
      setMessage(`✅ File uploaded successfully!\nFile ID: ${fileId}\nHash: ${originalFileHash}\nEncryption Key: ${encryptedData.key}`);
      setMessageType('success');

      if (typeof onUploadSuccess === 'function') {
        onUploadSuccess(successData);
      }

      // Reset form after 8 seconds (give user time to copy keys)
      setTimeout(() => {
        setFile(null);
        setFileName('');
        setUploadProgress(0);
        setUploadStep(0);
      }, 8000);
    } catch (err) {
      console.error('Upload error:', err);
      setMessage(`❌ Error : ${err.message || 'Action failed'}`);
      setMessageType('error');
      setUploadStep(0);
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="file-upload-container">
      <div className="upload-card">
        <h3>📤 Upload & Encrypt File</h3>

        <div 
          className={`file-input-wrapper ${dragActive ? 'drag-active' : ''}`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            type="file"
            id="fileInput"
            name="fileInput"
            onChange={handleFileSelect}
            disabled={loading}
            className="file-input"
          />
          <label htmlFor="fileInput" className="file-label">
            {fileName ? (
              <>
                <span className="file-icon">📄</span>
                <span className="file-name">{fileName}</span>
              </>
            ) : (
              <>
                <span className="drag-icon">📁</span>
                <span>Drag & drop your file here, or click to select</span>
              </>
            )}
          </label>
        </div>

        {file && (
          <div className="file-info-card entrance-anim">
            <div className="info-item">
              <span className="label">📄 File Name:</span>
              <span className="value">{file.name}</span>
            </div>
            <div className="info-item">
              <span className="label">📊 Size:</span>
              <span className="value">{(file.size / 1024).toFixed(2)} KB</span>
            </div>
            <div className="info-item">
              <span className="label">✓ Status:</span>
              <span className="value status-ready">Ready to upload</span>
            </div>
          </div>
        )}

        {loading && uploadStep > 0 && (
          <div className="upload-progress-panel entrance-anim">
            <div className="progress-status-row">
              <span className="progress-percent">{uploadProgress}% Complete</span>
            </div>
            
            <div className="progress-container">
              <div className="progress-bar" style={{ width: `${uploadProgress}%` }}></div>
            </div>

            <div className="steps-indicator">
              <div className={`step-item ${uploadStep >= 1 ? 'complete' : ''} ${uploadStep === 1 ? 'active' : ''}`}>
                <div className="step-point">{uploadStep > 1 ? '✓' : (uploadStep === 1 ? '⏳' : '○')}</div>
                <label>Hash</label>
              </div>
              <div className={`step-item ${uploadStep >= 2 ? 'complete' : ''} ${uploadStep === 2 ? 'active' : ''}`}>
                <div className="step-point">{uploadStep > 2 ? '✓' : (uploadStep === 2 ? '⏳' : '○')}</div>
                <label>Encrypt</label>
              </div>
              <div className={`step-item ${uploadStep >= 3 ? 'complete' : ''} ${uploadStep === 3 ? 'active' : ''}`}>
                <div className="step-point">{uploadStep > 3 ? '✓' : (uploadStep === 3 ? '⏳' : '○')}</div>
                <label>Upload</label>
              </div>
              <div className={`step-item ${uploadStep >= 4 ? 'complete' : ''} ${uploadStep === 4 ? 'active' : ''}`}>
                <div className="step-point">{uploadStep > 4 ? '✓' : (uploadStep === 4 ? '⏳' : '○')}</div>
                <label>Blockchain</label>
              </div>
            </div>
          </div>
        )}

        {message && !uploadSuccessData && (
          <div className={`system-message-console ${messageType} entrance-anim`}>
            {message}
          </div>
        )}

        <button
          className="upload-button"
          onClick={handleUpload}
          disabled={loading || !file}
        >
          {loading ? (
            <>
              <span className="btn-loader">⏳</span>
              {uploadStep === 1 && 'Calculating Hash...'}
              {uploadStep === 2 && 'Encrypting...'}
              {uploadStep === 3 && 'Uploading...'}
              {uploadStep === 4 && 'Registering...'}
              {uploadStep === 0 && 'Processing...'}
            </>
          ) : (
            <>🚀 Upload & Encrypt</>
          )}
        </button>

        {uploadSuccessData && (
          <div className="success-mission-card entrance-anim">
            <div className="success-header">
              <h4>📋 CRYPTOGRAPHIC RECEIPT</h4>
            </div>
            
            <div className="receipt-grid">
              <div className="receipt-item">
                <label>FILE ID</label>
                <div className="receipt-value-box">
                  <code>{uploadSuccessData.fileId}</code>
                  <button className="copy-btn" onClick={() => navigator.clipboard.writeText(uploadSuccessData.fileId)}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                  </button>
                </div>
              </div>
              
              <div className="receipt-item">
                <label>ENCRYPTION KEY</label>
                <div className="receipt-value-box">
                  <code>{uploadSuccessData.encryptionKey}</code>
                  <button className="copy-btn" onClick={() => navigator.clipboard.writeText(uploadSuccessData.encryptionKey)}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                  </button>
                </div>
              </div>
              
              {/* <div className="receipt-item">
                <label>FILE HASH (SHA-256)</label>
                <div className="receipt-value-box">
                  <code>{uploadSuccessData.hash}</code>
                  <button className="copy-btn" onClick={() => navigator.clipboard.writeText(uploadSuccessData.hash)}>COPY</button>
                </div>
              </div> */}
            </div>
          </div>
        )}

        <div className="onboarding-sections">
          <div className="refinement-feature-card">
            <div className="panel-title">
              
              <h4>🔒 Security Process</h4>
            </div>
            <div className="process-flow">
              <div className="flow-step">
                <span className="flow-num">1</span>
                <div className="flow-content">
                  <label>Hash Calculation:</label>
                  <p>SHA-256 fingerprint of original file</p>
                </div>
              </div>
              <div className="flow-step">
                <span className="flow-num">2</span>
                <div className="flow-content">
                  <label>Encryption:</label>
                  <p>AES-256-GCM with wallet-derived key</p>
                </div>
              </div>
              <div className="flow-step">
                <span className="flow-num">3</span>
                <div className="flow-content">
                  <label>Upload:</label>
                  <p>Encrypted file stored securely in decentralized storage</p>
                </div>
              </div>
              <div className="flow-step">
                <span className="flow-num">4</span>
                <div className="flow-content">
                  <label>Blockchain:</label>
                  <p>File proof & hash registered for permanent verification</p>
                </div>
              </div>
              <div className="flow-step">
                <span className="flow-num">5</span>
                <div className="flow-content">
                  <label>Safe Access:</label>
                  <p>Only you can decrypt and access with your wallet</p>
                </div>
              </div>
            </div>
          </div>

          <div className="refinement-feature-card requirements-panel">
            <div className="panel-title">
              
              <h4>📋 Requirements</h4>
            </div>
            <ul className="feature-list-minimal">
              <li>Maximum file size: 100MB</li>
              <li>Wallet must be connected (MetaMask)</li>
              <li>Any file type supported (.txt, .pdf, .jpg, etc.)</li>
              <li>Files are encrypted end-to-end (Client-Side)</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default FileUpload;

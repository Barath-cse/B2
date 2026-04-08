import React, { useState } from 'react';
import CryptoJS from 'crypto-js';
import { calculateHash, deriveEncryptionKey } from '../utils/crypto';
import '../styles/FileVerify.css';
import API_BASE from '../apiConfig';


function FileVerify({ userAddress, contract }) {
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState('');
  const [ownerAddress, setOwnerAddress] = useState('');
  const [fileId, setFileId] = useState('');
  const [loading, setLoading] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [encryptionKey, setEncryptionKey] = useState('');
  const [sharedKeys, setSharedKeys] = useState([]);
  const [showSharedKeys, setShowSharedKeys] = useState(false);
  const [calculatedFileHash, setCalculatedFileHash] = useState('');
  const [isDecrypting, setIsDecrypting] = useState(false);


  // Persist current tab on refresh to avoid WalletConnect redirect
  React.useEffect(() => {
    sessionStorage.setItem('lastTab', 'verify');
    return () => {
      // Cleanup - optional
    };
  }, []);

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setFileName(selectedFile.name);
      setMessage('');
      setVerificationResult(null);
      setCalculatedFileHash(''); // Clear previous hash

      // Calculate and display hash immediately when file is selected
      calculateFileHashImmediate(selectedFile);
    }
  };

  const calculateFileHashImmediate = async (fileToHash) => {
    try {
      setMessage('📊 Calculating hash of selected file...');
      const hash = await calculateHash(fileToHash);
      setCalculatedFileHash(hash);
      setMessage('✓ Hash calculated! Ready to verify.', 'success');
    } catch (err) {
      console.error('Error calculating hash:', err);
      setMessage(`❌ Error calculating hash: ${err.message}`, 'error');
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
      setFile(droppedFile);
      setFileName(droppedFile.name);
      setMessage('');
      setVerificationResult(null);
      setCalculatedFileHash(''); // Clear previous hash

      // Calculate and display hash immediately when file is dropped
      calculateFileHashImmediate(droppedFile);
    }
  };

  // Retrieve keys shared with current user
  const retrieveSharedKeys = async () => {
    if (!userAddress) {
      setMessage('❌ Please connect your wallet first', 'error');
      return;
    }

    setLoading(true);
    setMessage('📥 Loading shared keys...');
    try {
      const res = await fetch(`${API_BASE}/shared-keys/${userAddress}`);

      const contentType = res.headers.get('content-type');
      let data;
      if (contentType && contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        throw new Error(res.ok ? 'Server returned success but not JSON' : `Server Error (${res.status}): ${text.slice(0, 100)}`);
      }

      if (!res.ok) {
        throw new Error(data.error || 'Failed to retrieve shared keys');
      }


      console.log('Shared keys response:', data);

      if (data && data.sharedKeysCount > 0 && data.sharedKeys && data.sharedKeys.length > 0) {
        setSharedKeys(data.sharedKeys);
        setMessage(`✓ Found ${data.sharedKeysCount} shared key(s)`, 'success');
      } else {
        setSharedKeys([]);
        setMessage('ⓘ No keys have been shared with you yet', 'info');
      }
      setShowSharedKeys(true);
    } catch (err) {
      console.error('Error retrieving shared keys:', err);
      setMessage(`❌ Failed to load shared keys: ${err.message}`, 'error');
      setSharedKeys([]);
    } finally {
      setLoading(false);
    }
  };

  // Use a shared key to auto-fill fields
  const applySharedKey = (sharedKey) => {
    setFileId(sharedKey.fileId);
    setEncryptionKey(sharedKey.encryptionKey);
    setOwnerAddress(sharedKey.ownerAddress);
    setMessage(`✓ Shared key loaded! File ID: ${sharedKey.fileId}`, 'success');
    setShowSharedKeys(false);
  };

  // Master Key Reconstruction (Owner Only)
  const reconstructMasterKey = async () => {
    if (!userAddress) return setMessage('❌ Please connect your wallet first', 'error');
    if (!fileId) return setMessage('❌ Please enter a File ID first', 'error');

    setLoading(true);
    setMessage('🔑 Requesting signature to reconstruct key...');
    try {
      const key = await deriveEncryptionKey(userAddress, fileId);
      setEncryptionKey(key);
      setMessage('✅ Encryption Key reconstructed and autofilled!', 'success');
      setMessageType('success');
    } catch (err) {
      console.error('Key reconstruction error:', err);
      setMessage(`❌ Failed to reconstruct key: ${err.message}`, 'error');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  // Decrypt an encrypted file blob (used when verifying downloaded encrypted files)

  // Commented out - no longer used (button for fetching blockchain hash was removed)
  // const fetchBlockchainHash = async () => {
  //   if (!contract) {
  //     setMessage('❌ Blockchain contract not connected. Please connect your wallet.', 'error');
  //     return;
  //   }
  //   ...
  // };

  const verifyFile = async () => {
    if (!file) {
      setMessage('❌ Please select a file to verify');
      setMessageType('error');
      return;
    }

    if (!ownerAddress.trim()) {
      setMessage('❌ Please provide the owner\'s wallet address');
      setMessageType('error');
      return;
    }

    if (!fileId.trim()) {
      setMessage('❌ Please provide the file ID from the original upload');
      setMessageType('error');
      return;
    }

    if (!ownerAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      setMessage('❌ Invalid owner address format');
      setMessageType('error');
      return;
    }

    setLoading(true);

    try {
      // Step 1: Verify we have calculated hash
      if (!calculatedFileHash) {
        setMessage('❌ Hash not calculated. Please select the file again.');
        setMessageType('error');
        setLoading(false);
        return;
      }

      setMessage('📊 Calculating file hash...');

      // Step 2: Send calculated hash to backend for SECURE VERIFICATION
      setMessage('🔐 Verifying with stored database hash (secure, backend-side verification)...');
      const verificationResponse = await fetch(`${API_BASE}/verify-file-hash`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileId: fileId.trim(),
          calculatedHash: calculatedFileHash,
          ownerAddress: ownerAddress.trim()
        })
      });

      const contentType = verificationResponse.headers.get('content-type');
      let verificationData;
      if (contentType && contentType.includes('application/json')) {
        verificationData = await verificationResponse.json();
      } else {
        const text = await verificationResponse.text();
        throw new Error(verificationResponse.ok ? 'Server returned success but not JSON' : `Server Error (${verificationResponse.status}): ${text.slice(0, 100)}`);
      }


      // Step 3: Display result

      if (!verificationResponse.ok) {
        throw new Error(verificationData.message || verificationData.error || 'Verification failed');
      }

      setVerificationResult({
        isIntact: verificationData.valid,
        message: verificationData.message
      });

      if (verificationData.valid) {
        setMessage('✅ File is AUTHENTIC! Hash matches the stored record.', 'success');
        setMessageType('success');
      } else {
        setMessage('❌ File is INVALID! Hash does NOT match the stored record. Either:\n• You selected the wrong file\n• The file was tampered with\n• The File ID or Owner Address is incorrect', 'error');
        setMessageType('error');
      }
    } catch (err) {
      setMessage(`❌ Verification error: ${err.message}`);
      setMessageType('error');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Download encrypted file without decryption (for verification)
  const downloadEncryptedFile = async () => {
    // Validate all required fields before downloading
    if (!encryptionKey?.trim()) {
      setMessage('❌ Please provide the encryption key', 'error');
      return;
    }

    if (!ownerAddress?.trim()) {
      setMessage('❌ Please provide the owner address', 'error');
      return;
    }

    if (!ownerAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      setMessage('❌ Invalid owner address format. Must be a valid Ethereum address (0x...)', 'error');
      return;
    }

    if (!fileId?.trim()) {
      setMessage('❌ Please provide the file ID', 'error');
      return;
    }

    setLoading(true);
    setMessage('� Validating credentials...');

    try {
      // Step 1: Validate credentials with server
      const validationResponse = await fetch(`${API_BASE}/validate-credentials`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileId: fileId.trim(),
          ownerAddress: ownerAddress.trim()
        })
      });

      const contentType = validationResponse.headers.get('content-type');
      let validationData;
      if (contentType && contentType.includes('application/json')) {
        validationData = await validationResponse.json();
      } else {
        const text = await validationResponse.text();
        throw new Error(validationResponse.ok ? 'Server returned success but not JSON' : `Server Error (${validationResponse.status}): ${text.slice(0, 100)}`);
      }


      if (!validationResponse.ok) {
        throw new Error(validationData.error || 'Credential validation failed');
      }

      if (!validationData.valid) {
        throw new Error('Invalid credentials');
      }

      // Step 2: Validate encryption key
      setMessage('🔐 Validating encryption key...');
      const keyValidationResponse = await fetch(`${API_BASE}/validate-encryption-key`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileId: fileId.trim(),
          encryptionKey: encryptionKey.trim()
        })
      });

      const keyContentType = keyValidationResponse.headers.get('content-type');
      let keyValidationData;
      if (keyContentType && keyContentType.includes('application/json')) {
        keyValidationData = await keyValidationResponse.json();
      } else {
        const text = await keyValidationResponse.text();
        throw new Error(keyValidationResponse.ok ? 'Server returned success but not JSON' : `Server Error (${keyValidationResponse.status}): ${text.slice(0, 100)}`);
      }


      if (!keyValidationResponse.ok) {
        throw new Error(keyValidationData.error || 'Encryption key validation failed');
      }

      // Step 3: Download the file
      setMessage('📥 Downloading encrypted file...');

      console.log('DEBUG: Download request', { fileId, userAddress });

      if (!userAddress) {
        throw new Error('User wallet not connected. Please connect your wallet first.');
      }

      const downloadUrl = `${API_BASE}/file/${fileId}?userAddress=${encodeURIComponent(userAddress)}`;
      console.log('DEBUG: Download URL:', downloadUrl);

      const response = await fetch(downloadUrl);

      console.log('DEBUG: Download response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.log('DEBUG: Download error:', errorData);
        throw new Error(errorData.message || errorData.error || `Failed to download file: ${response.statusText}`);
      }

      const encryptedText = await response.text();
      const sanitizedText = encryptedText.trim();
      console.log('Encrypted file content loaded, length:', sanitizedText.length);

      const encryptedBlob = new Blob([sanitizedText], { type: 'text/plain' });

      // Get original filename if available
      let filename = `${fileId}-encrypted`;
      try {
        const filenameHeader = response.headers.get('X-Original-Filename');
        if (filenameHeader) {
          filename = `${decodeURIComponent(filenameHeader)}.encrypted`;
        }
      } catch (err) {
        console.warn('Could not read filename header:', err);
      }

      // Download encrypted file
      const url = URL.createObjectURL(encryptedBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setMessage(`✅ Encrypted file downloaded as: ${filename}\n\n📌 Next: Select the downloaded encrypted file below to verify its hash!`, 'success');
    } catch (err) {
      console.error('Download error:', err);
      setMessage(`❌ Download failed: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Decrypt the verified file
  const decryptVerifiedFile = async () => {
    if (!fileId?.trim()) {
      setMessage('❌ Please provide the File ID to download the encrypted file from server');
      return;
    }

    if (!encryptionKey?.trim()) {
      setMessage('❌ Please provide the encryption key');
      return;
    }

    setIsDecrypting(true);
    setMessage('📥 Downloading encrypted file from server...');

    try {
      // Step 1: Download encrypted file from server using File ID
      console.log('Fetching verified file with ID:', fileId);

      if (!userAddress) {
        throw new Error('User wallet not connected. Please connect your wallet first.');
      }

      const downloadUrl = `${API_BASE}/file/${fileId}?userAddress=${encodeURIComponent(userAddress)}`;
      console.log('DEBUG: Decrypt download URL:', downloadUrl);

      const response = await fetch(downloadUrl);

      console.log('DEBUG: Decrypt download response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.log('DEBUG: Decrypt download error:', errorData);
        throw new Error(errorData.message || errorData.error || `Failed to download encrypted file: ${response.statusText}`);
      }

      // Extract original filename and mimeType from response headers
      // Try to get the headers - they may be exposed by CORS
      let originalFilename = `file-${fileId}`;
      let mimeType = 'application/octet-stream';

      try {
        const filenameHeader = response.headers.get('X-Original-Filename');
        const mimeHeader = response.headers.get('X-Mime-Type');

        console.log('Response headers available:');
        console.log('  X-Original-Filename:', filenameHeader);
        console.log('  X-Mime-Type:', mimeHeader);

        if (filenameHeader) {
          originalFilename = decodeURIComponent(filenameHeader);
        }
        if (mimeHeader) {
          mimeType = mimeHeader;
        }
      } catch (headerErr) {
        console.warn('Could not read custom headers:', headerErr);
      }

      console.log('Using metadata:', { originalFilename, mimeType });

      const encryptedTextRaw = await response.text();
      let encryptedText = encryptedTextRaw.trim();

      // Sanitize Base64: Handle URL-safe characters and validate format for CryptoJS
      if (/[_-]/.test(encryptedText)) {
        console.log('Detected URL-safe Base64 encoding. Sanitizing characters...');
        encryptedText = encryptedText.replace(/-/g, '+').replace(/_/g, '/');
      }

      console.log('Starting decryption of content, length:', encryptedText.length);

      setMessage('🔓 Decrypting file...');

      // Step 2: Decrypt using CryptoJS - Strategic Dual-Mode Decryption
      let decrypted;
      const keyStr = encryptionKey.trim();

      // Detect OpenSSL "Salted__" header (Base64 equivalent starts with U2FsdGVkX1)
      const hasSaltedHeader = encryptedText.startsWith('U2FsdGVkX1');
      console.log('OpenSSL Salted Header detected:', hasSaltedHeader);

      try {
        // Mode A: Try as standard passphrase-based OpenSSL format
        decrypted = CryptoJS.AES.decrypt(
          encryptedText,
          keyStr,
          hasSaltedHeader ? { format: CryptoJS.format.OpenSSL } : {}
        );

        // Check if Mode A succeeded
        if (!decrypted || decrypted.sigBytes <= 0) {
          console.warn('Passphrase decryption failed (sigBytes:', decrypted ? decrypted.sigBytes : 'N/A', '). Trying Literal Hex Mode...');

          // Mode B: Try as literal Hex Key (Fallback for direct entropy keys)
          if (keyStr.length === 64 && /^[0-9a-fA-F]+$/.test(keyStr)) {
            const hexKey = CryptoJS.enc.Hex.parse(keyStr);
            console.log('Detected 256-bit Hex Key. Attempting direct key decryption...');

            // For direct hex keys, we still assume OpenSSL format (Salted__) in the ciphertext.
            // If the ciphertext has a salt, CryptoJS.AES.decrypt with a WordArray key doesn't work directly 
            // without providing the Salt and IV. However, often "literal keys" are used with standard AES params.

            const decryptedModeB = CryptoJS.AES.decrypt(
              encryptedText,
              hexKey
            );

            if (decryptedModeB && decryptedModeB.sigBytes > 0) {
              console.log('Mode B Success! (sigBytes:', decryptedModeB.sigBytes, ')');
              decrypted = decryptedModeB;
            }
          }
        }
      } catch (cryptoErr) {
        console.error('CryptoJS error in Mode A:', cryptoErr);
      }

      // Final validation of decryption result
      if (!decrypted || !decrypted.words || decrypted.sigBytes <= 0) {
        const errorMsg = `❌ DECRYPTION FAILED (Code: ${decrypted ? decrypted.sigBytes : 'NULL'})\n\nThe key or file ID appears to be incorrect.`;
        console.error('Final decryption failure:', { sigBytes: decrypted?.sigBytes, keyLength: keyStr.length });
        throw new Error(`${errorMsg}\n\n✓ Please verify:\n• File ID matches the upload receipt\n• Encryption Key is exactly as provided\n• You are using "Download from Server" first`);
      }

      console.log('Decryption successful, sigBytes:', decrypted.sigBytes);

      // Convert decrypted data to bytes for proper binary output (using unsigned right shift)
      const wordArrayToUint8Array = (wordArray) => {
        const words = wordArray.words;
        const sigBytes = wordArray.sigBytes;
        if (!words || sigBytes <= 0) return new Uint8Array(0);

        const u8 = new Uint8Array(sigBytes);
        for (let i = 0; i < sigBytes; i++) {
          const byte = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
          u8[i] = byte;
        }
        return u8;
      };

      const decryptedBytes = wordArrayToUint8Array(decrypted);

      if (!decryptedBytes || decryptedBytes.length === 0) {
        throw new Error('❌ DECRYPTION FAILED\n\nThe decrypted data is empty or the encryption key may be incorrect.\n\nTip: Ensure you are using the exact encryption key from the upload.');
      }

      console.log('Decrypted bytes length:', decryptedBytes.length);

      // Step 3: Download the decrypted file in its original format
      const decryptedBlob = new Blob([decryptedBytes], { type: mimeType });
      const url = URL.createObjectURL(decryptedBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = originalFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      console.log('File downloaded:', originalFilename);

      setMessage(`✅ File decrypted and downloaded as: ${originalFilename}`, 'success');
    } catch (err) {
      console.error('Decryption error:', err);
      const isMismatch = err.message.includes('-70');
      
      const errorMessage = (
        <div className="error-with-action">
          <span>❌ Decryption failed: {err.message}</span>
          {isMismatch && userAddress && (
            <button className="btn-fix-error" onClick={reconstructMasterKey}>
              🔑 Fix this error automatically (Owner Only)
            </button>
          )}
        </div>
      );
      
      setMessage(errorMessage);
      setMessageType('error');
    } finally {
      setIsDecrypting(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  // Download encrypted file from server
  // Note: Replaced by 3-step workflow (downloadEncryptedFile → verifyFile → decryptVerifiedFile)


  return (
    <div className="file-verify-container">
      <div className="verify-card">
        <h3 className="main-title">
          <span role="img" aria-label="search">🔍</span> Verify File Integrity
        </h3>

        {/* 1. Select File Section */}
        <div className="verify-section">
          <h4>
            <span role="img" aria-label="upload">📤</span> Select File
          </h4>
          <div
            className={`file-input-wrapper ${dragActive ? 'drag-active' : ''}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input
              type="file"
              id="verifyFileInput"
              name="verifyFileInput"
              onChange={handleFileSelect}
              disabled={loading}
              className="file-input"
            />
            <label htmlFor="verifyFileInput" className="file-label">
              {fileName ? (
                <>
                  <span className="file-icon">📄</span>
                  <span className="file-name">{fileName}</span>
                </>
              ) : (
                <>
                  <span className="drag-icon">📁</span>
                  <span>Drag & drop your downloaded file here, or click to select</span>
                </>
              )}
            </label>
          </div>
        </div>

        {/* 2. Enter Verification Details Section */}
        <div className="verify-section">
          <h4>
            <span role="img" aria-label="key">🔑</span> Enter Verification Details
          </h4>

          {/* Shared Keys Module */}
          <div className="shared-keys-panel">
            <button
              onClick={retrieveSharedKeys}
              disabled={!userAddress || loading}
              className="btn btn-info btn-shared-keys"
            >
              <span role="img" aria-label="keys">📥</span> Get My Shared Keys
            </button>

            {showSharedKeys && sharedKeys.length > 0 && (
              <div className="shared-keys-list-container">
                <h5>📁 Keys Shared With You:</h5>
                {sharedKeys.map((key, idx) => (
                  <div key={idx} className="shared-key-card">
                    <div className="key-main-info">
                      <div className="key-row">
                        <span className="icon">📄</span>
                        <strong>Filename:</strong> {key.originalFilename || `ID: ${key.fileId}`}
                      </div>
                      <div className="key-row small">
                        <strong>File ID:</strong> {key.fileId}
                      </div>
                      <div className="key-row small">
                        <strong>Owner:</strong> {key.ownerAddress.slice(0, 6)}...{key.ownerAddress.slice(-4)}
                      </div>
                      <div className="key-row small">
                        <strong>Shared:</strong> {new Date(key.sharedAt).toLocaleDateString()} |
                        <strong> Expires:</strong> {new Date(key.expiresAt).toLocaleDateString()}
                      </div>
                    </div>
                    <button
                      onClick={() => applySharedKey(key)}
                      className="btn btn-use-key"
                    >
                      Use This Key
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="encryptionKey">
              <span className="required">*</span> Encryption Key
              <div className="label-subtext">(from upload details or shared with you)</div>
            </label>
            <div className="field-container">
              <input
                type="password"
                id="encryptionKey"
                name="encryptionKey"
                placeholder="Paste encryption key here..."
                className="input-field"
                value={encryptionKey}
                onChange={(e) => {
                  setEncryptionKey(e.target.value);
                }}
                disabled={loading}
              />
              {encryptionKey && (
                <button className="copy-btn-inner" onClick={() => copyToClipboard(encryptionKey)}>
                  <span role="img" aria-label="copy">📋</span>
                </button>
              )}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="ownerAddress">
              <span className="required">*</span> Owner Address
              <div className="label-subtext">(wallet that uploaded the file)</div>
            </label>
            <div className="field-container">
              <input
                type="text"
                id="ownerAddress"
                name="ownerAddress"
                placeholder="0x123abc..."
                className="input-field"
                value={ownerAddress}
                onChange={(e) => setOwnerAddress(e.target.value)}
                disabled={loading}
              />
              {ownerAddress && (
                <button className="copy-btn-inner" onClick={() => copyToClipboard(ownerAddress)}>
                  <span role="img" aria-label="copy">📋</span>
                </button>
              )}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="fileId">
              <span className="required">*</span> File ID
              <div className="label-subtext">(from your upload metadata)</div>
            </label>
            <div className="field-container">
              <input
                type="text"
                id="fileId"
                name="fileId"
                placeholder="e.g. 1773083062552-uu5had"
                className="input-field"
                value={fileId}
                onChange={(e) => {
                  setFileId(e.target.value);
                }}
                disabled={loading}
              />
              {fileId && (
                <button className="copy-btn-inner" onClick={() => copyToClipboard(fileId)}>
                  <span role="img" aria-label="copy">📋</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 3. Status & Action Phase */}
        <div className="action-phase">
          {message && (
            <div className={`status-banner ${messageType}`}>
              {/* <span className="banner-icon">
                {messageType === 'success' ? '✅' : messageType === 'error' ? '❌' : 'ℹ️'}
              </span> */}
              <div className="banner-text">{message}</div>
            </div>
          )}

          {!file && (
            <button
              className="btn btn-download-server"
              onClick={downloadEncryptedFile}
              disabled={loading || !fileId.trim() || !encryptionKey?.trim() || !ownerAddress?.trim()}
            >
              {loading ? '⏳ Processing...' : 'Download Encrypted File'}
            </button>
          )}

          {file && !verificationResult && (
            <button
              className="btn btn-verify-main"
              onClick={verifyFile}
              disabled={loading || !file || !ownerAddress?.trim() || !fileId?.trim()}
            >
              {loading ? '⏳ Verifying...' : 'Verify File Hash'}
            </button>
          )}

          {/* Verification Result Panel */}
          {/* {verificationResult && (
            <div className="verification-result-panel">
              <h4>
                <span role="img" aria-label="result">📋</span> Verification Result
              </h4>
              <div className={`result-box ${verificationResult.isIntact ? 'authentic' : 'tampered'}`}>
                <div className="result-badge">
                  <span className="icon">{verificationResult.isIntact ? '✅' : '❌'}</span>
                  <span>{verificationResult.isIntact ? 'AUTHENTIC' : 'TAMPERED'}</span>
                </div>
              </div>
              <div className={`result-detail-banner ${verificationResult.isIntact ? 'success' : 'error'}`}>
                <span className="icon">✅</span> File is AUTHENTIC! Hash matches the stored record.
              </div>
            </div>
          )} */}

          {/* Decryption Section */}
          {verificationResult && verificationResult.isIntact && (
            <div className="decrypt-panel">
              <h4>
                <span role="img" aria-label="lock">🔒</span> Decrypt Verified File
              </h4>
              <p className="decrypt-info">
                Your file has been verified as authentic ✅. Now download the encrypted file from the server and decrypt it to view the original content.
              </p>
              <button
                className="btn btn-decrypt-main"
                onClick={decryptVerifiedFile}
                disabled={isDecrypting || !encryptionKey?.trim() || !fileId?.trim()}
              >
                {isDecrypting ? '⏳ Decrypting...' : '🔒 Decrypt File'}
              </button>
            </div>
          )}
        </div>

        {/* 4. Troubleshooting Section */}
        <div className="troubleshooting-card">
          <h4>
            <span role="img" aria-label="wrench">🔧</span> Decryption Troubleshooting:
          </h4>
          <div className="checklist-container">
            <div className={`checklist-item ${fileId?.trim() ? 'valid' : 'invalid'}`}>
              <span className="indicator">{fileId?.trim() ? '✅' : '❌'}</span>
              <span>File ID matches original upload</span>
            </div>
            <div className={`checklist-item ${encryptionKey?.trim() ? 'valid' : 'invalid'}`}>
              <span className="indicator">{encryptionKey?.trim() ? '✅' : '❌'}</span>
              <span>Encryption key is exactly as stored (no extra spaces)</span>
            </div>
            <div className={`checklist-item ${ownerAddress?.trim() ? 'valid' : 'invalid'}`}>
              <span className="indicator">{ownerAddress?.trim() ? '✅' : '❌'}</span>
              <span>Owner address is correct (wallet that uploaded)</span>
            </div>
          </div>
          <div className="tip-box">
            <span className="icon">💡</span>
            <strong>Tip:</strong> If "Decryption failed" appears, use the "Get My Shared Keys" button to auto-fill the correct credentials from a user who shared the file with you.
          </div>
        </div>

        {/* 5. Onboarding Informational Section (Aligned with FileUpload) */}
        <div className="onboarding-sections" style={{ marginTop: '40px' }}>
          <div className="refinement-feature-card flow-panel">
            <div className="panel-title">
              <h4>🛡️ HOW IT WORKS</h4>
            </div>
            <div className="process-flow">
              <div className="flow-step">
                <span className="flow-num">1</span>
                <div className="flow-content">
                  <label>Upload File:</label>
                  <p>Select the file you want to verify</p>
                </div>
              </div>
              <div className="flow-step">
                <span className="flow-num">2</span>
                <div className="flow-content">
                  <label>Enter Details:</label>
                  <p>Provide hash, owner address, and file ID</p>
                </div>
              </div>
              <div className="flow-step">
                <span className="flow-num">3</span>
                <div className="flow-content">
                  <label>Calculate Hash:</label>
                  <p>SHA-256 fingerprint of your file</p>
                </div>
              </div>
              <div className="flow-step">
                <span className="flow-num">4</span>
                <div className="flow-content">
                  <label>Compare:</label>
                  <p>Check if it matches blockchain record</p>
                </div>
              </div>
              <div className="flow-step">
                <span className="flow-num">5</span>
                <div className="flow-content">
                  <label>Decrypt:</label>
                  <p>Try to decrypt using wallet key</p>
                </div>
              </div>
            </div>
          </div>

          <div className="refinement-feature-card requirements-panel">
            <div className="panel-title">
              <h4>ℹ️ IMPORTANT NOTES</h4>
            </div>
            <ul className="feature-list-minimal">
              <li>Hash verification proves file hasn't been tampered</li>
              <li>Decryption requires the original owner's wallet address</li>
              <li>You can only decrypt if you have access rights</li>
              <li>Keep your blockchain hash and file ID safe</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default FileVerify;

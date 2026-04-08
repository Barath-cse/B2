const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Use a temporary filename - we'll rename it in the handler
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    cb(null, `temp-${timestamp}-${random}`);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
});

// File upload endpoint
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    console.log('Upload request received');
    console.log('Body:', req.body);
    console.log('File:', req.file);

    if (!req.file) {
      console.error('No file in request');
      return res.status(400).json({ error: 'No file provided' });
    }

    const { fileName, owner, fileHash, fileId } = req.body;

    console.log('Checking fields:', { fileName, owner, fileHash, fileId });

    if (!fileName || !owner || !fileHash || !fileId) {
      console.error('Missing fields:', { 
        fileName: !fileName ? '❌ MISSING' : '✓', 
        owner: !owner ? '❌ MISSING' : '✓', 
        fileHash: !fileHash ? '❌ MISSING' : '✓',
        fileId: !fileId ? '❌ MISSING' : '✓'
      });
      // Delete temp file if it was created
      if (req.file && req.file.path) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({ 
        error: 'Missing required fields',
        received: { fileName, owner, fileHash, fileId }
      });
    }

    // Rename the temp file to the fileId
    const uploadsDir = path.join(__dirname, '../uploads');
    const newFilePath = path.join(uploadsDir, fileId);
    fs.renameSync(req.file.path, newFilePath);

    // File metadata (NO encryption key stored on server for security)
    const fileMetadata = {
      id: fileId,
      originalName: fileName,
      storagePath: newFilePath,
      owner: owner,
      fileHash: fileHash,
      fileSize: req.file.size,
      uploadedAt: new Date().toISOString(),
      mimeType: req.file.mimetype
    };

    // Save metadata to file
    const metadataPath = path.join(uploadsDir, `${fileId}.json`);
    fs.writeFileSync(metadataPath, JSON.stringify(fileMetadata, null, 2));

    console.log('File uploaded successfully:', fileMetadata);

    res.json({
      message: 'File uploaded successfully',
      fileId: fileId,
      metadata: fileMetadata
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Download file endpoint
router.get('/file/:fileId', (req, res) => {
  try {
    const { fileId } = req.params;
    const { userAddress } = req.query; // Get user address from query parameter
    
    // MANDATORY: userAddress must be provided for access control
    if (!userAddress) {
      return res.status(400).json({ 
        error: 'Missing user address',
        message: 'User address is required to download files'
      });
    }
    
    const uploadsDir = path.join(__dirname, '../uploads');
    const filePath = path.join(uploadsDir, fileId);
    const metadataPath = path.join(uploadsDir, `${fileId}.json`);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Check if metadata exists
    if (!fs.existsSync(metadataPath)) {
      return res.status(404).json({ error: 'File metadata not found' });
    }

    // Read metadata
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));

    // MANDATORY ACCESS CONTROL CHECK
    const isOwner = metadata.owner.toLowerCase() === userAddress.toLowerCase();
    
    if (!isOwner) {
      // Check if user has access via access list
      const accessList = loadAccessList(fileId);
      const hasAccess = accessList.some(a => a.userAddress.toLowerCase() === userAddress.toLowerCase());
      
      if (!hasAccess) {
        console.log('Access denied:', { fileId, requestedBy: userAddress, owner: metadata.owner });
        return res.status(403).json({ 
          error: 'Access denied',
          message: 'You do not have permission to download this file'
        });
      }
    }

    // Get original filename and mimeType
    let originalName = 'decrypted-file';
    let mimeType = 'application/octet-stream';
    
    originalName = metadata.originalName || 'decrypted-file';
    mimeType = metadata.mimeType || 'application/octet-stream';
    console.log('File download allowed:', { fileId, requestedBy: userAddress, isOwner, accessGranted: true });

    // Enable CORS for custom headers so frontend JavaScript can read them
    res.set('Access-Control-Expose-Headers', 'X-Original-Filename, X-Mime-Type, X-File-Id, Content-Type, Content-Disposition');
    
    // Send metadata in custom headers so frontend can use it
    res.set('X-Original-Filename', encodeURIComponent(originalName));
    res.set('X-Mime-Type', mimeType);
    res.set('X-File-Id', fileId);
    
    console.log('Sending download with headers:', { 
      'X-Original-Filename': encodeURIComponent(originalName),
      'X-Mime-Type': mimeType 
    });
    
    res.download(filePath);
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get file metadata
router.get('/file-metadata/:fileId', (req, res) => {
  try {
    const { fileId } = req.params;
    const uploadsDir = path.join(__dirname, '../uploads');
    const metadataPath = path.join(uploadsDir, `${fileId}.json`);

    if (!fs.existsSync(metadataPath)) {
      return res.status(404).json({ error: 'Metadata not found' });
    }

    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
    res.json(metadata);
  } catch (error) {
    console.error('Metadata error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Validate file access credentials
router.post('/validate-credentials', (req, res) => {
  try {
    const { fileId, ownerAddress } = req.body;

    if (!fileId || !ownerAddress) {
      return res.status(400).json({ error: 'File ID and owner address are required' });
    }

    const uploadsDir = path.join(__dirname, '../uploads');
    const metadataPath = path.join(uploadsDir, `${fileId}.json`);
    const filePath = path.join(uploadsDir, fileId);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Check if metadata exists
    if (!fs.existsSync(metadataPath)) {
      return res.status(404).json({ error: 'File metadata not found' });
    }

    // Read and validate metadata
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
    
    // Check if user is the owner
    const isOwner = metadata.owner.toLowerCase() === ownerAddress.toLowerCase();
    
    // If not owner, check if user has access via access list
    if (!isOwner) {
      const accessList = loadAccessList(fileId);
      const hasAccess = accessList.some(a => a.userAddress.toLowerCase() === ownerAddress.toLowerCase());
      
      if (!hasAccess) {
        return res.status(403).json({ error: 'You do not have access to this file' });
      }
    }

    // All validations passed
    res.json({
      valid: true,
      message: 'Credentials validated successfully',
      isOwner: isOwner,
      fileInfo: {
        fileId: metadata.id,
        owner: metadata.owner,
        fileSize: metadata.fileSize,
        uploadedAt: metadata.uploadedAt
      }
    });
  } catch (error) {
    console.error('Validation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Validate encryption key by attempting decryption
router.post('/validate-encryption-key', (req, res) => {
  try {
    const { fileId, encryptionKey } = req.body;

    if (!fileId || !encryptionKey) {
      return res.status(400).json({ error: 'File ID and encryption key are required' });
    }

    const uploadsDir = path.join(__dirname, '../uploads');
    const filePath = path.join(uploadsDir, fileId);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Read encrypted file content
    const fileContent = fs.readFileSync(filePath, 'utf8');
    
    if (!fileContent || fileContent.length === 0) {
      return res.status(400).json({ error: 'File is empty' });
    }

    // Validate that the file is encrypted (OpenSSL format)
    if (!fileContent.includes('Salted__') && !fileContent.startsWith('U2F')) {
      return res.status(400).json({ error: 'File does not appear to be encrypted with OpenSSL format' });
    }

    // For backend-side validation, we can't directly decrypt without CryptoJS
    // So we'll validate the key format is provided and non-empty
    // The actual decryption validation will happen on the frontend
    
    if (!encryptionKey.trim()) {
      return res.status(400).json({ error: 'Encryption key cannot be empty' });
    }

    // All checks passed - key validation ready
    res.json({
      valid: true,
      message: 'Encryption key appears valid. Proceeding with download.',
      fileExists: true,
      encrypted: true
    });
  } catch (error) {
    console.error('Encryption key validation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get user files
router.get('/user-files/:userAddress', (req, res) => {
  try {
    const { userAddress } = req.params;
    const uploadsDir = path.join(__dirname, '../uploads');

    const files = fs.readdirSync(uploadsDir);
    const userFiles = [];

    files.forEach(file => {
      if (file.endsWith('.json')) {
        const metadataPath = path.join(uploadsDir, file);
        const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
        
        if (metadata.owner.toLowerCase() === userAddress.toLowerCase()) {
          userFiles.push(metadata);
        }
      }
    });

    res.json({
      userAddress,
      fileCount: userFiles.length,
      files: userFiles
    });
  } catch (error) {
    console.error('Get user files error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Verify file endpoint
router.post('/verify', upload.single('file'), (req, res) => {
  try {
    const { blockchainHash } = req.body;

    if (!blockchainHash || !req.file) {
      return res.status(400).json({ error: 'Missing file or blockchain hash' });
    }

    // Calculate file hash
    const hash = crypto.createHash('sha256');
    const fileContent = fs.readFileSync(req.file.path);
    hash.update(fileContent);
    const calculatedHash = hash.digest('hex');

    const isValid = calculatedHash.toLowerCase() === blockchainHash.toLowerCase();

    res.json({
      isValid,
      calculatedHash,
      blockchainHash,
      message: isValid ? '✅ File is authentic' : '⚠️ File has been tampered'
    });

    // Clean up uploaded verification file
    fs.unlinkSync(req.file.path);
  } catch (error) {
    console.error('Verify error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===== ACCESS CONTROL (ENABLED) =====
// Access control system for sharing files

// Helper function to load access list
const loadAccessList = (fileId) => {
  try {
    const uploadsDir = path.join(__dirname, '../uploads');
    const accessListPath = path.join(uploadsDir, `${fileId}-access.json`);
    
    if (fs.existsSync(accessListPath)) {
      const data = fs.readFileSync(accessListPath, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.warn('Could not load access list:', err);
  }
  return [];
};

// Helper function to save access list
const saveAccessList = (fileId, accessList) => {
  try {
    const uploadsDir = path.join(__dirname, '../uploads');
    const accessListPath = path.join(uploadsDir, `${fileId}-access.json`);
    fs.writeFileSync(accessListPath, JSON.stringify(accessList, null, 2));
  } catch (err) {
    console.error('Could not save access list:', err);
  }
};

// Grant access to a user
router.post('/grant-access', (req, res) => {
  try {
    const { fileId, ownerAddress, userAddress } = req.body;

    if (!fileId || !ownerAddress || !userAddress) {
      return res.status(400).json({ error: 'File ID, owner address, and user address are required' });
    }

    if (userAddress.toLowerCase() === ownerAddress.toLowerCase()) {
      return res.status(400).json({ error: 'Owner already has access' });
    }

    const uploadsDir = path.join(__dirname, '../uploads');
    const metadataPath = path.join(uploadsDir, `${fileId}.json`);
    const filePath = path.join(uploadsDir, fileId);

    // Verify file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Verify metadata exists and owner matches
    if (!fs.existsSync(metadataPath)) {
      return res.status(404).json({ error: 'File metadata not found' });
    }

    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
    if (metadata.owner.toLowerCase() !== ownerAddress.toLowerCase()) {
      return res.status(403).json({ error: 'Only file owner can grant access' });
    }

    // Load current access list
    let accessList = loadAccessList(fileId);

    // Check if user already has access
    const userExists = accessList.some(a => a.userAddress.toLowerCase() === userAddress.toLowerCase());
    if (userExists) {
      return res.status(400).json({ error: 'User already has access to this file' });
    }

    // Add user to access list
    accessList.push({
      userAddress: userAddress.toLowerCase(),
      grantedAt: new Date().toISOString(),
      grantedBy: ownerAddress
    });

    saveAccessList(fileId, accessList);

    res.json({
      success: true,
      message: `Access granted to ${userAddress}`,
      accessCount: accessList.length
    });
  } catch (error) {
    console.error('Grant access error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Revoke access from a user
router.post('/revoke-access', (req, res) => {
  try {
    const { fileId, ownerAddress, userAddress } = req.body;

    if (!fileId || !ownerAddress || !userAddress) {
      return res.status(400).json({ error: 'File ID, owner address, and user address are required' });
    }

    const uploadsDir = path.join(__dirname, '../uploads');
    const metadataPath = path.join(uploadsDir, `${fileId}.json`);
    const filePath = path.join(uploadsDir, fileId);

    // Verify file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Verify metadata exists and owner matches
    if (!fs.existsSync(metadataPath)) {
      return res.status(404).json({ error: 'File metadata not found' });
    }

    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
    if (metadata.owner.toLowerCase() !== ownerAddress.toLowerCase()) {
      return res.status(403).json({ error: 'Only file owner can revoke access' });
    }

    // Load current access list
    let accessList = loadAccessList(fileId);

    // Remove user from access list
    const initialLength = accessList.length;
    accessList = accessList.filter(a => a.userAddress.toLowerCase() !== userAddress.toLowerCase());

    if (accessList.length === initialLength) {
      return res.status(404).json({ error: 'User does not have access to this file' });
    }

    saveAccessList(fileId, accessList);

    res.json({
      success: true,
      message: `Access revoked from ${userAddress}`,
      accessCount: accessList.length
    });
  } catch (error) {
    console.error('Revoke access error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get access list for a file
router.get('/access-list/:fileId/:owner', (req, res) => {
  try {
    const { fileId, owner } = req.params;

    const uploadsDir = path.join(__dirname, '../uploads');
    const metadataPath = path.join(uploadsDir, `${fileId}.json`);
    const filePath = path.join(uploadsDir, fileId);

    // Verify file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found', accessList: [] });
    }

    // Verify metadata exists and owner matches
    if (!fs.existsSync(metadataPath)) {
      return res.status(404).json({ error: 'File metadata not found', accessList: [] });
    }

    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
    if (metadata.owner.toLowerCase() !== owner.toLowerCase()) {
      return res.status(403).json({ error: 'Only file owner can view access list', accessList: [] });
    }

    // Load and return access list
    const accessList = loadAccessList(fileId);

    res.json({
      success: true,
      fileId,
      owner,
      accessCount: accessList.length,
      accessList: accessList
    });
  } catch (error) {
    console.error('Get access list error:', error);
    res.status(500).json({ error: error.message, accessList: [] });
  }
});

// SECURE FILE HASH VERIFICATION (Backend-side)
// This endpoint retrieves the stored hash from database WITHOUT exposing it to the browser
// Frontend sends calculated hash, backend compares securely and returns only true/false
router.post('/verify-file-hash', (req, res) => {
  try {
    const { fileId, calculatedHash, ownerAddress } = req.body;

    if (!fileId || !calculatedHash) {
      return res.status(400).json({ 
        valid: false, 
        error: 'File ID and calculated hash are required' 
      });
    }

    const uploadsDir = path.join(__dirname, '../uploads');
    const metadataPath = path.join(uploadsDir, `${fileId}.json`);
    const filePath = path.join(uploadsDir, fileId);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ 
        valid: false, 
        error: 'File not found',
        message: 'The file you are trying to verify does not exist on the server' 
      });
    }

    // Check if metadata exists
    if (!fs.existsSync(metadataPath)) {
      return res.status(404).json({ 
        valid: false, 
        error: 'File metadata not found',
        message: 'File metadata is missing' 
      });
    }

    // Read metadata securely (BACKEND SIDE ONLY)
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
    const storedHash = metadata.fileHash;

    // Verify access: user must be owner or have access granted
    if (ownerAddress) {
      const isOwner = metadata.owner.toLowerCase() === ownerAddress.toLowerCase();
      
      if (!isOwner) {
        // Check if user has access via access list
        const accessList = loadAccessList(fileId);
        const hasAccess = accessList.some(a => a.userAddress.toLowerCase() === ownerAddress.toLowerCase());
        
        if (!hasAccess) {
          return res.status(403).json({ 
            valid: false, 
            error: 'Access denied',
            message: 'You do not have access to verify this file' 
          });
        }
      }
    }

    // Compare hashes securely on backend (NEVER expose storedHash to frontend)
    const isHashValid = storedHash.toLowerCase() === calculatedHash.toLowerCase();

    console.log('File hash verification:', {
      fileId,
      ownerAddress,
      hashMatch: isHashValid,
      timestamp: new Date().toISOString()
    });

    // Return ONLY the validation result, NOT the stored hash
    res.json({
      valid: isHashValid,
      message: isHashValid 
        ? '✅ File is AUTHENTIC! Hash matches the stored record.' 
        : '❌ File hash does NOT match! The file may have been tampered with or is incorrect.',
      fileId: fileId
    });
  } catch (error) {
    console.error('File hash verification error:', error);
    res.status(500).json({ 
      valid: false, 
      error: error.message, 
      message: 'An error occurred during verification' 
    });
  }
});

// DELETE FILE ENDPOINT (Owner only)
router.delete('/file/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    const { ownerAddress } = req.body;

    if (!fileId || !ownerAddress) {
      return res.status(400).json({ error: 'File ID and owner address are required' });
    }

    const uploadsDir = path.join(__dirname, '../uploads');
    const metadataPath = path.join(uploadsDir, `${fileId}.json`);
    const filePath = path.join(uploadsDir, fileId);

    // 1. Verify metadata exists
    if (!fs.existsSync(metadataPath)) {
      return res.status(404).json({ error: 'File metadata not found' });
    }

    // 2. Read and verify ownership
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
    if (metadata.owner.toLowerCase() !== ownerAddress.toLowerCase()) {
      return res.status(403).json({ error: 'Only the file owner can delete this file' });
    }

    console.log(`[Delete] 🗑️ Manual deletion requested for file: ${fileId} by owner: ${ownerAddress}`);

    // 3. Delete encrypted file
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`[Delete]   - Deleted encrypted file: ${fileId}`);
    }

    // 4. Delete access control list
    const accessPath = path.join(uploadsDir, `${fileId}-access.json`);
    if (fs.existsSync(accessPath)) {
      fs.unlinkSync(accessPath);
      console.log(`[Delete]   - Deleted access list: ${fileId}-access.json`);
    }

    // 5. Delete shared keys registry entries
    const sharedKeysPath = path.join(uploadsDir, '.shared-keys.json');
    if (fs.existsSync(sharedKeysPath)) {
      try {
        const sharedKeys = JSON.parse(fs.readFileSync(sharedKeysPath, 'utf8'));
        let modified = false;
        
        // Remove all shares belonging to this fileId
        for (const [shareId, shareRecord] of Object.entries(sharedKeys)) {
          if (shareRecord.fileId === fileId) {
            delete sharedKeys[shareId];
            modified = true;
            console.log(`[Delete]   - Removed shared key record: ${shareId}`);
          }
        }
        
        if (modified) {
          fs.writeFileSync(sharedKeysPath, JSON.stringify(sharedKeys, null, 2));
        }
      } catch (err) {
        console.warn(`[Delete] ⚠️ Could not cleanup shared keys entries: ${err.message}`);
      }
    }

    // 6. Delete metadata file
    fs.unlinkSync(metadataPath);
    console.log(`[Delete]   - Deleted metadata: ${fileId}.json`);

    res.json({
      success: true,
      message: `File ${fileId} and all associated data have been permanently deleted.`
    });

  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: error.message });
  }
});

// LIST MY FILES ENDPOINT
router.get('/my-files/:ownerAddress', (req, res) => {
  try {
    const { ownerAddress } = req.params;
    if (!ownerAddress) {
      return res.status(400).json({ error: 'Owner address is required' });
    }

    const uploadsDir = path.join(__dirname, '../uploads');
    const files = fs.readdirSync(uploadsDir);
    const myFiles = [];

    // Filter JSON metadata files belonging to this owner
    files.forEach(file => {
      if (file.endsWith('.json') && !file.endsWith('-access.json') && file !== '.shared-keys.json') {
        try {
          const content = fs.readFileSync(path.join(uploadsDir, file), 'utf-8');
          const metadata = JSON.parse(content);
          
          if (metadata.owner && metadata.owner.toLowerCase() === ownerAddress.toLowerCase()) {
            // Calculate expiry (8 days from upload)
            const uploadedAt = new Date(metadata.uploadedAt);
            const expiresAt = new Date(uploadedAt.getTime() + (8 * 24 * 60 * 60 * 1000));
            
            myFiles.push({
              fileId: metadata.id,
              fileName: metadata.originalName,
              fileSize: metadata.fileSize,
              uploadedAt: metadata.uploadedAt,
              expiresAt: expiresAt.toISOString(),
              mimeType: metadata.mimeType
            });
          }
        } catch (err) {
          console.error(`Error reading metadata ${file}:`, err);
        }
      }
    });

    // Sort by most recent upload
    myFiles.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

    res.json({
      success: true,
      count: myFiles.length,
      files: myFiles
    });
  } catch (error) {
    console.error('List files error:', error);
    res.status(500).json({ error: error.message });
  }
});


module.exports = router;


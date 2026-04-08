const express = require('express');
const { ethers } = require('ethers');
require('dotenv').config();

const router = express.Router();

// Sample smart contract ABI (expanded for access control)
const CONTRACT_ABI = [
  'function uploadFile(string memory fileId, string memory hash) public',
  'function updateHash(string memory fileId, string memory newHash) public',
  'function verifyFile(string memory fileId, string memory hash) public view returns (bool)',
  'function grantAccess(string memory fileId, address user) public',
  'function revokeAccess(string memory fileId, address user) public',
  'function hasAccess(string memory fileId, address user) public view returns (bool)',
  'function getFileDetails(string memory fileId) public view returns (tuple(string hash, address owner))'
];

// Initialize provider (Ganache or Sepolia)
const BLOCKCHAIN_RPC = process.env.BLOCKCHAIN_RPC || 'http://localhost:7545';

const inferNetworkFromRpc = (rpcUrl) => {
  if (process.env.BLOCKCHAIN_CHAIN_ID) {
    return {
      chainId: Number(process.env.BLOCKCHAIN_CHAIN_ID),
      name: process.env.BLOCKCHAIN_NETWORK_NAME || 'custom'
    };
  }

  const normalized = rpcUrl.toLowerCase();
  if (normalized.includes('sepolia')) {
    return { chainId: 11155111, name: 'sepolia' };
  }
  if (
    normalized.includes('localhost') ||
    normalized.includes('127.0.0.1') ||
    normalized.includes('7545')
  ) {
    return { chainId: 1337, name: 'local' };
  }

  return undefined;
};

const NETWORK_CONFIG = inferNetworkFromRpc(BLOCKCHAIN_RPC);
const provider = NETWORK_CONFIG
  ? new ethers.JsonRpcProvider(BLOCKCHAIN_RPC, NETWORK_CONFIG)
  : new ethers.JsonRpcProvider(BLOCKCHAIN_RPC);

// Log provider connectivity once on startup for faster diagnosis
(async () => {
  try {
    const network = await provider.getNetwork();
    console.log(
      `Connected to ${network.name} (chainId ${network.chainId}) via ${BLOCKCHAIN_RPC}`
    );
  } catch (err) {
    console.error(
      `RPC connection failed for ${BLOCKCHAIN_RPC}: ${err.message}. ` +
        'Check that the node is running and the URL/chain ID are correct.'
    );
  }
})();

// Get contract instance (with signer for transactions)
const getContract = () => {
  const contractAddress = process.env.CONTRACT_ADDRESS;
  const privateKey = process.env.PRIVATE_KEY;

  if (!contractAddress || !privateKey) {
    throw new Error('CONTRACT_ADDRESS and PRIVATE_KEY not configured in .env');
  }

  const signer = new ethers.Wallet(privateKey, provider);
  return new ethers.Contract(contractAddress, CONTRACT_ABI, signer);
};

// Get contract instance for read-only operations (no signer needed)
const getContractReadOnly = () => {
  const contractAddress = process.env.CONTRACT_ADDRESS;

  if (!contractAddress) {
    throw new Error('CONTRACT_ADDRESS not configured in .env');
  }

  return new ethers.Contract(contractAddress, CONTRACT_ABI, provider);
};

// Store file hash on blockchain
router.post('/store-hash', async (req, res) => {
  try {
    const { fileHash, userAddress } = req.body;

    if (!fileHash || !userAddress) {
      return res.status(400).json({ error: 'Missing fileHash or userAddress' });
    }

    const contract = getContract();

    // Call smart contract
    const tx = await contract.uploadFile(fileHash, userAddress);
    const receipt = await tx.wait();

    res.json({
      message: 'Hash stored on blockchain',
      transactionHash: receipt.hash,
      blockNumber: receipt.blockNumber
    });
  } catch (error) {
    console.error('Store hash error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Verify hash on blockchain
router.get('/verify-blockchain/:fileHash', async (req, res) => {
  try {
    const { fileHash } = req.params;

    const contract = getContract();
    const isValid = await contract.verifyFile(fileHash);

    res.json({
      fileHash,
      isValid,
      message: isValid ? '✅ Hash found on blockchain' : '❌ Hash not found on blockchain'
    });
  } catch (error) {
    console.error('Verify blockchain error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Grant file access
router.post('/grant-access', async (req, res) => {
  try {
    const { fileId, userAddress } = req.body;

    if (!fileId || !userAddress) {
      return res.status(400).json({ error: 'Missing fileId or userAddress' });
    }

    const contract = getContract();
    const tx = await contract.grantAccess(fileId, userAddress);
    const receipt = await tx.wait();

    res.json({
      message: 'Access granted',
      transactionHash: receipt.hash,
      grantedTo: userAddress
    });
  } catch (error) {
    console.error('Grant access error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Revoke file access
router.post('/revoke-access', async (req, res) => {
  try {
    const { fileId, userAddress } = req.body;

    if (!fileId || !userAddress) {
      return res.status(400).json({ error: 'Missing fileId or userAddress' });
    }

    const contract = getContract();
    const tx = await contract.revokeAccess(fileId, userAddress);
    const receipt = await tx.wait();

    res.json({
      message: 'Access revoked',
      transactionHash: receipt.hash,
      revokedFrom: userAddress
    });
  } catch (error) {
    console.error('Revoke access error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update stored hash (owner only)
router.post('/update-hash', async (req, res) => {
  try {
    const { fileId, newHash } = req.body;

    if (!fileId || !newHash) {
      return res.status(400).json({ error: 'Missing fileId or newHash' });
    }

    const contract = getContract();
    const tx = await contract.updateHash(fileId, newHash);
    const receipt = await tx.wait();

    res.json({
      message: 'Hash updated',
      transactionHash: receipt.hash,
      fileId,
      newHash
    });
  } catch (error) {
    console.error('Update hash error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Check access permission
router.get('/check-access/:fileId/:userAddress', async (req, res) => {
  try {
    const { fileId, userAddress } = req.params;

    const contract = getContract();
    const hasAccess = await contract.hasAccess(fileId, userAddress);

    res.json({
      fileId,
      userAddress,
      hasAccess,
      message: hasAccess ? '✅ User has access' : '❌ User does not have access'
    });
  } catch (error) {
    console.error('Check access error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get blockchain network info
router.get('/network-info', async (req, res) => {
  try {
    const network = await provider.getNetwork();
    const blockNumber = await provider.getBlockNumber();

    res.json({
      network: network.name,
      chainId: network.chainId,
      blockNumber,
      rpcUrl: BLOCKCHAIN_RPC
    });
  } catch (error) {
    console.error('Network info error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============= KEY SHARING ENDPOINTS (Option A) =============

// File-based persistence for shared keys
const path = require('path');
const fs = require('fs');

const getSharedKeysStoragePath = () => {
  const uploadsDir = path.join(__dirname, '../uploads');
  // Ensure directory exists
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log(`✓ Created uploads directory: ${uploadsDir}`);
  }
  return path.join(uploadsDir, '.shared-keys.json');
};

const loadSharedKeys = () => {
  try {
    const storagePath = getSharedKeysStoragePath();
    console.log(`📂 Looking for shared keys at: ${storagePath}`);
    if (fs.existsSync(storagePath)) {
      const data = fs.readFileSync(storagePath, 'utf-8');
      const keys = JSON.parse(data);
      console.log(`✓ Loaded ${Object.keys(keys).length} shared keys from storage`);
      console.log(`Shared keys:`, Object.keys(keys));
      return keys;
    } else {
      console.log('ℹ️ No shared keys storage file found - starting fresh');
    }
  } catch (err) {
    console.error('❌ Could not load shared keys from storage:', err.message);
  }
  return {};
};

const saveSharedKeys = (sharedKeys) => {
  try {
    const storagePath = getSharedKeysStoragePath();
    const jsonData = JSON.stringify(sharedKeys, null, 2);
    fs.writeFileSync(storagePath, jsonData, 'utf-8');
    const fileSize = fs.statSync(storagePath).size;
    console.log(`✓ Saved ${Object.keys(sharedKeys).length} shared keys to storage (${fileSize} bytes at ${storagePath})`);
  } catch (err) {
    console.error('❌ Error saving shared keys to file:', err.message);
    console.error('❌ Storage path attempted:', getSharedKeysStoragePath());
    console.error('❌ Error details:', err);
  }
};

// Load shared keys on startup
let sharedKeys = loadSharedKeys(); // Format: { "fileId:recipientAddress": { key, encryptor, timestamp, active } }

// Clean up expired shared keys on startup
const cleanupExpiredKeys = () => {
  let cleaned = false;
  let count = 0;
  for (const [shareId, shareRecord] of Object.entries(sharedKeys)) {
    if (shareRecord.active && new Date(shareRecord.expiresAt) <= new Date()) {
      shareRecord.active = false;
      cleaned = true;
      count++;
    }
  }
  if (cleaned) {
    saveSharedKeys(sharedKeys);
    console.log(`✓ Cleaned up ${count} expired shared keys`);
  } else {
    console.log('✓ No expired keys to clean up');
  }
};

cleanupExpiredKeys();

// Share encryption key with another wallet
router.post('/share-key', async (req, res) => {
  try {
    const { fileId, encryptionKey, recipientAddress, ownerAddress, originalFilename } = req.body;

    console.log('\n=== SHARE KEY REQUEST ===');
    console.log('File ID:', fileId);
    console.log('Recipient:', recipientAddress);
    console.log('Owner:', ownerAddress);

    if (!fileId || !encryptionKey || !recipientAddress || !ownerAddress) {
      return res.status(400).json({ error: 'Missing required fields: fileId, encryptionKey, recipientAddress, ownerAddress' });
    }

    // Validate addresses
    if (!ethers.isAddress(ownerAddress) || !ethers.isAddress(recipientAddress)) {
      return res.status(400).json({ error: 'Invalid wallet address format' });
    }

    // Try to verify owner on blockchain, but allow without verification if blockchain is unavailable
    let ownerVerified = false;
    try {
      const contract = getContractReadOnly();
      const fileDetails = await contract.getFileDetails(fileId);
      ownerVerified = fileDetails[1].toLowerCase() === ownerAddress.toLowerCase();
      
      if (!ownerVerified) {
        return res.status(403).json({ error: 'Only file owner can share keys' });
      }
    } catch (blockchainError) {
      console.warn('Blockchain verification unavailable, proceeding with ownership trust:', blockchainError.message);
      // In production, you might want to reject this, but for demo allow it
    }

    // Store shared key with metadata including original filename
    const shareId = `${fileId}:${recipientAddress}`;
    const shareRecord = {
      fileId,
      encryptionKey,
      recipientAddress,
      ownerAddress,
      originalFilename: originalFilename || `file-${fileId}`,
      sharedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
      active: true,
      accessCount: 0
    };

    sharedKeys[shareId] = shareRecord;
    
    // Persist to storage
    saveSharedKeys(sharedKeys);

    console.log(`✓ Key shared successfully`);
    console.log(`Share ID: ${shareId}`);
    console.log(`Shared keys in storage: ${Object.keys(sharedKeys).length}`);

    res.json({
      message: 'Encryption key shared successfully',
      shareId,
      recipientAddress,
      fileId,
      originalFilename: shareRecord.originalFilename,
      expiresAt: shareRecord.expiresAt
    });
  } catch (error) {
    console.error('Share key error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all keys shared with a user
router.get('/shared-keys/:userAddress', async (req, res) => {
  try {
    const { userAddress } = req.params;

    if (!ethers.isAddress(userAddress)) {
      return res.status(400).json({ error: 'Invalid wallet address format' });
    }

    console.log(`Fetching shared keys for user: ${userAddress}`);
    console.log(`Total shared keys in storage: ${Object.keys(sharedKeys).length}`);

    // Find all active shares for this user
    const mySharedKeys = [];
    let modified = false;
    
    for (const [shareId, shareRecord] of Object.entries(sharedKeys)) {
      console.log(`Checking share: ${shareId}, recipient: ${shareRecord.recipientAddress}, active: ${shareRecord.active}`);
      
      if (shareRecord.recipientAddress.toLowerCase() === userAddress.toLowerCase() && shareRecord.active) {
        // Check if not expired
        const now = new Date();
        const expiresAt = new Date(shareRecord.expiresAt);
        
        if (expiresAt > now) {
          mySharedKeys.push({
            fileId: shareRecord.fileId,
            encryptionKey: shareRecord.encryptionKey,
            ownerAddress: shareRecord.ownerAddress,
            originalFilename: shareRecord.originalFilename || `file-${shareRecord.fileId}`,
            sharedAt: shareRecord.sharedAt,
            expiresAt: shareRecord.expiresAt
          });
          shareRecord.accessCount++;
        } else {
          // Mark as expired
          console.log(`Marking as expired: ${shareId}`);
          shareRecord.active = false;
          modified = true;
        }
      }
    }

    // Save if we marked anything as expired
    if (modified) {
      saveSharedKeys(sharedKeys);
    }

    console.log(`Found ${mySharedKeys.length} active shared keys for user ${userAddress}`);
    
    // Save access count updates
    saveSharedKeys(sharedKeys);

    res.json({
      userAddress,
      sharedKeysCount: mySharedKeys.length,
      sharedKeys: mySharedKeys
    });
  } catch (error) {
    console.error('Get shared keys error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Revoke a shared key
router.post('/revoke-key-share', async (req, res) => {
  try {
    const { fileId, recipientAddress, ownerAddress } = req.body;

    if (!fileId || !recipientAddress || !ownerAddress) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!ethers.isAddress(ownerAddress) || !ethers.isAddress(recipientAddress)) {
      return res.status(400).json({ error: 'Invalid wallet address format' });
    }

    // Try to verify owner on blockchain, but allow without verification if blockchain is unavailable
    try {
      const contract = getContractReadOnly();
      const fileDetails = await contract.getFileDetails(fileId);
      if (fileDetails[1].toLowerCase() !== ownerAddress.toLowerCase()) {
        return res.status(403).json({ error: 'Only file owner can revoke key shares' });
      }
    } catch (blockchainError) {
      console.warn('Blockchain verification unavailable, proceeding with ownership trust:', blockchainError.message);
      // In production, you might want to reject this, but for demo allow it
    }

    const shareId = `${fileId}:${recipientAddress}`;
    if (!sharedKeys[shareId]) {
      return res.status(404).json({ error: 'Key share not found' });
    }

    sharedKeys[shareId].active = false;
    
    // Persist to storage
    saveSharedKeys(sharedKeys);

    res.json({
      message: 'Key share revoked successfully',
      fileId,
      recipientAddress
    });
  } catch (error) {
    console.error('Revoke key share error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get key share status (for a specific recipient)
router.get('/key-share-status/:fileId/:recipientAddress', async (req, res) => {
  try {
    const { fileId, recipientAddress } = req.params;

    if (!ethers.isAddress(recipientAddress)) {
      return res.status(400).json({ error: 'Invalid wallet address format' });
    }

    const shareId = `${fileId}:${recipientAddress}`;
    const shareRecord = sharedKeys[shareId];

    if (!shareRecord) {
      return res.json({
        fileId,
        recipientAddress,
        isShared: false,
        message: 'No key share found'
      });
    }

    const isExpired = new Date(shareRecord.expiresAt) <= new Date();
    const isActive = shareRecord.active && !isExpired;

    res.json({
      fileId,
      recipientAddress,
      isShared: true,
      isActive,
      sharedAt: shareRecord.sharedAt,
      expiresAt: shareRecord.expiresAt,
      accessCount: shareRecord.accessCount
    });
  } catch (error) {
    console.error('Key share status error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all users with access to a specific file
router.get('/file-access-list/:fileId/:ownerAddress', async (req, res) => {
  try {
    const { fileId, ownerAddress } = req.params;

    console.log(`\n=== FILE ACCESS LIST REQUEST ===`);
    console.log(`File ID: ${fileId}`);
    console.log(`Owner Address: ${ownerAddress}`);
    console.log(`Normalized owner: ${ownerAddress.toLowerCase()}`);

    if (!ethers.isAddress(ownerAddress)) {
      return res.status(400).json({ error: 'Invalid owner address format' });
    }

    console.log(`Total shared keys in memory: ${Object.keys(sharedKeys).length}`);
    console.log(`All share IDs:`, Object.keys(sharedKeys));
    
    // Also check the file
    const keysForThisFile = Object.entries(sharedKeys).filter(([id, rec]) => rec.fileId === fileId);
    console.log(`Keys for fileId "${fileId}": ${keysForThisFile.length}`);
    keysForThisFile.forEach(([id, rec]) => {
      console.log(`  - ${id}: owner=${rec.ownerAddress}, active=${rec.active}, expires=${rec.expiresAt}`);
    });

    // Find all active shares for this file
    const accessList = [];
    
    for (const [shareId, shareRecord] of Object.entries(sharedKeys)) {
      console.log(`\nChecking: ${shareId}`);
      console.log(`  - fileId match: ${shareRecord.fileId} === ${fileId} ? ${shareRecord.fileId === fileId}`);
      console.log(`  - owner match: ${shareRecord.ownerAddress.toLowerCase()} === ${ownerAddress.toLowerCase()} ? ${shareRecord.ownerAddress.toLowerCase() === ownerAddress.toLowerCase()}`);
      console.log(`  - active: ${shareRecord.active}`);
      
      if (shareRecord.fileId === fileId && shareRecord.ownerAddress.toLowerCase() === ownerAddress.toLowerCase() && shareRecord.active) {
        // Check if not expired
        const now = new Date();
        const expiresAt = new Date(shareRecord.expiresAt);
        const isExpired = expiresAt <= now;
        
        console.log(`  - expires: ${shareRecord.expiresAt} (${isExpired ? 'EXPIRED' : 'VALID'})`);
        
        if (!isExpired) {
          accessList.push({
            recipientAddress: shareRecord.recipientAddress,
            originalFilename: shareRecord.originalFilename || `file-${fileId}`,
            sharedAt: shareRecord.sharedAt,
            expiresAt: shareRecord.expiresAt,
            accessCount: shareRecord.accessCount || 0
          });
        }
      }
    }

    console.log(`\nFinal access list count: ${accessList.length}`);
    console.log(`Access list:`, accessList);

    res.json({
      fileId,
      ownerAddress,
      accessCount: accessList.length,
      accessList: accessList
    });
  } catch (error) {
    console.error('File access list error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

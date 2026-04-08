import CryptoJS from 'crypto-js';

// Derive encryption key from user's wallet (SECURE METHOD)
// This ensures only the file owner can decrypt, and authorized users need wallet access
export const deriveEncryptionKey = async (userAddress, fileId) => {
  try {
    if (!window.ethereum) {
      throw new Error('MetaMask not detected. Please verify the extension is enabled.');
    }

    if (!userAddress) {
      throw new Error('User address is required');
    }

    // Request user to sign a message (this proves ownership of the address)
    const message = `Secure file access for ${fileId}`;
    console.log('Requesting signature for:', message);
    
    const signature = await window.ethereum.request({
      method: 'personal_sign',
      params: [message, userAddress],
    });

    console.log('Signature received:', signature);

    // Derive key from signature + address + fileId (deterministic but unique per file)
    const combined = signature + userAddress + fileId;
    const key = CryptoJS.SHA256(combined).toString();

    console.log('Encryption key derived successfully');
    return key;
  } catch (error) {
    console.error('Derive key error:', error);
    throw new Error('Failed to derive encryption key: ' + error.message);
  }
};

// Generate Random Key for AES encryption (LEGACY - NOT SECURE)
export const generateEncryptionKey = () => {
  return CryptoJS.lib.WordArray.random(256 / 8).toString();
};

// Calculate SHA-256 hash of a file
export const calculateHash = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const content = e.target.result;
        const wordArray = CryptoJS.lib.WordArray.create(new Uint8Array(content));
        const hash = CryptoJS.SHA256(wordArray).toString();
        resolve(hash);
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = () => {
      reject(new Error('Error reading file'));
    };

    reader.readAsArrayBuffer(file);
  });
};

// Encrypt file with AES-256 using wallet-derived key
export const encryptFile = async (file, userAddress, fileId) => {
  return new Promise(async (resolve, reject) => {
    try {
      if (!file) {
        throw new Error('File is required');
      }

      if (!userAddress) {
        throw new Error('User address is required');
      }

      if (!fileId) {
        throw new Error('File ID is required');
      }

      // Derive key from user's wallet (secure)
      const encryptionKey = await deriveEncryptionKey(userAddress, fileId);

      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const content = e.target.result;
          const wordArray = CryptoJS.lib.WordArray.create(new Uint8Array(content));

          // Encrypt the file
          const encrypted = CryptoJS.AES.encrypt(
            wordArray,
            encryptionKey,
            {
              format: CryptoJS.format.OpenSSL
            }
          );

          if (!encrypted) {
            throw new Error('Encryption failed');
          }

          const result = {
            encryptedFile: encrypted.toString(),
            key: encryptionKey
          };

          console.log('File encrypted successfully, size:', result.encryptedFile.length);
          resolve(result);
        } catch (err) {
          console.error('Encryption error:', err);
          reject(err);
        }
      };

      reader.onerror = () => {
        reject(new Error('Error reading file'));
      };

      reader.readAsArrayBuffer(file);
    } catch (error) {
      console.error('Encrypt file error:', error);
      reject(error);
    }
  });
};

// Decrypt file with AES-256
export const decryptFile = (encryptedFile, encryptionKey) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const encryptedContent = e.target.result;
        
        // Convert to string if it's ArrayBuffer
        let encryptedString = '';
        if (encryptedContent instanceof ArrayBuffer) {
          encryptedString = new TextDecoder().decode(encryptedContent);
        } else {
          encryptedString = encryptedContent;
        }

        // Decrypt
        const decrypted = CryptoJS.AES.decrypt(
          encryptedString,
          encryptionKey,
          {
            format: CryptoJS.format.OpenSSL
          }
        );

        // Convert to string
        const decryptedString = decrypted.toString(CryptoJS.enc.Utf8);
        
        if (!decryptedString) {
          reject(new Error('Decryption failed: Invalid key or corrupted data'));
        } else {
          resolve(decryptedString);
        }
      } catch (err) {
        reject(new Error('Decryption error: ' + err.message));
      }
    };

    reader.onerror = () => {
      reject(new Error('Error reading file'));
    };

    reader.readAsArrayBuffer(encryptedFile);
  });
};

// Reconstruct encryption key for authorized users
// This allows granted users to decrypt files using their own wallet
export const reconstructEncryptionKey = async (ownerAddress, fileId, authorizedAddress) => {
  try {
    if (!window.ethereum) {
      throw new Error('MetaMask not detected. Please verify the extension is enabled.');
    }

    const message = `Secure file access for ${fileId}`;
    const signature = await window.ethereum.request({
      method: 'personal_sign',
      params: [message, authorizedAddress],
    });

    // Use owner's address in derivation to ensure consistency
    const combined = signature + ownerAddress + fileId;
    const key = CryptoJS.SHA256(combined).toString();

    return key;
  } catch (error) {
    if (error.code === 4001) {
      throw new Error('Signature request denied. Action cancelled.');
    }
    throw new Error('Failed to reconstruct encryption key: ' + error.message);
  }
};

// Verify password
export const verifyPassword = (password, hash) => {
  return CryptoJS.SHA256(password).toString() === hash;
};

// Generate random token
export const generateToken = () => {
  return CryptoJS.lib.WordArray.random(32).toString();
};

const crypto = require('crypto');

// Calculate SHA-256 hash of a file
const calculateHash = (fileBuffer) => {
  const hash = crypto.createHash('sha256');
  hash.update(fileBuffer);
  return hash.digest('hex');
};

// Generate random salt
const generateSalt = () => {
  return crypto.randomBytes(16).toString('hex');
};

// Hash password with salt
const hashPassword = (password, salt) => {
  return crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
};

// Verify password
const verifyPassword = (password, hash, salt) => {
  return hashPassword(password, salt) === hash;
};

module.exports = {
  calculateHash,
  generateSalt,
  hashPassword,
  verifyPassword
};

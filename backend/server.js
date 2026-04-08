const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();
const { cleanupExpiredFiles } = require('./utils/cleanup');


const fileRoutes = require('./routes/fileRoutes');
const blockchainRoutes = require('./routes/blockchainRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
const allowedOrigins = [
  process.env.CORS_ORIGIN,
  'https://b-securefile-frontend.onrender.com',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
].filter(Boolean);


app.use(cors({
  origin: function(origin, callback) {
    // allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      // For development, you might want to allow all or log warning
      console.warn(`[CORS] Blocked request from origin: ${origin}`);
      // return callback(new Error(msg), false); // Uncomment to strictly enforce
    }
    return callback(null, true);
  },
  credentials: true,
  exposedHeaders: ['X-Original-Filename', 'X-Mime-Type', 'X-File-Id', 'Content-Type', 'Content-Disposition']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API routes
app.use('/api', fileRoutes);
app.use('/api', blockchainRoutes);

// Ensure uploads folder exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Health check route (VERY useful)
app.get('/', (req, res) => {
  res.send('Backend is running 🚀');
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📁 Uploads directory: ${uploadsDir}`);

  // Auto-Cleanup Task: Check for expired files (8 days)
  const ONE_HOUR = 60 * 60 * 1000;
  setInterval(cleanupExpiredFiles, ONE_HOUR);
  // Run once immediately on startup to catch anything that expired while server was offline
  cleanupExpiredFiles();
});
/**
 * Centralized API configuration for BlockSecure.
 * 
 * In production (e.g., Render), set the REACT_APP_API_BASE environment variable
 * to your backend URL (e.g., https://your-backend.onrender.com/api).
 * 
 * For local development, this defaults to 'http://localhost:5000/api'.
 */
const API_BASE = process.env.REACT_APP_API_BASE || 
  (process.env.NODE_ENV === 'development' 
    ? 'http://localhost:5000/api' 
    : '/api'); 

export default API_BASE;





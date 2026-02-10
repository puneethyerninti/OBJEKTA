// Entry point for Render when root is used; delegates to backend/server.js
const path = require('path');
// Ensure backend .env is loaded even when cwd is repo root
require('dotenv').config({ path: path.join(__dirname, 'backend', '.env') });
// Start backend server
require('./backend/server');

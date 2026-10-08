// All settings come from environment variables (or server/.env), with safe local defaults.
const fs = require('fs');
const path = require('path');

// Minimal .env loader: KEY=value lines, # comments. Real environment variables win.
const envFile = path.join(__dirname, '..', '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const siteRoot = path.resolve(__dirname, '..', '..');

module.exports = {
  port: Number(process.env.PORT) || 3000,
  production: process.env.NODE_ENV === 'production',
  siteRoot,                                                         // folder holding index.html, css/, js/, images/, videos/
  dataDir: path.resolve(process.env.DATA_DIR || path.join(siteRoot, 'server', 'data')),
  uploadsDir: path.resolve(process.env.UPLOADS_DIR || path.join(siteRoot, 'uploads')),
  sessionHours: Number(process.env.SESSION_HOURS) || 12,
  // When true, cookies are marked Secure (HTTPS only). Set COOKIE_SECURE=false only for plain-HTTP testing.
  cookieSecure: process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === 'true' : process.env.NODE_ENV === 'production'
};

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
  // Public address of the site, used in job links and Google Jobs data, e.g. https://new.avanamedical.com
  siteUrl: (process.env.SITE_URL || '').replace(/\/+$/, ''),
  // NOINDEX=true keeps a test site (e.g. test.avanamedical.com) out of Google and other search engines
  noindex: process.env.NOINDEX === 'true',
  // When true, cookies are marked Secure (HTTPS only). Set COOKIE_SECURE=false only for plain-HTTP testing.
  cookieSecure: process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === 'true' : process.env.NODE_ENV === 'production',
  // Outgoing email (the openings link sent to job seekers). Without SMTP_HOST, emails are saved to DATA_DIR/outbox instead.
  mail: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',                     // true for port 465; 587 and 2525 use STARTTLS
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.MAIL_FROM || 'Avana Medical Devices <noreply@avanamedical.com>',
    replyTo: process.env.MAIL_REPLY_TO || 'info@avanamedical.com',
    hrNotify: process.env.HR_NOTIFY_EMAIL || ''                     // optional: also tell HR about each new request
  },
  // How long the emailed "current openings" link keeps working
  openingsLinkDays: Number(process.env.OPENINGS_LINK_DAYS) || 30
};

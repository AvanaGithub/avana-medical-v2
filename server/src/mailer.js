// Sends email through the SMTP server set in .env (SMTP_HOST etc.).
// Without SMTP_HOST (local development, or before email is set up) nothing is sent: each message is saved
// as an .html file in DATA_DIR/outbox so it can be checked, and the result says 'not_configured'.
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const config = require('./config');

let transport = null;
function getTransport() {
  if (!transport) {
    transport = nodemailer.createTransport({
      host: config.mail.host, port: config.mail.port, secure: config.mail.secure,
      auth: config.mail.user ? { user: config.mail.user, pass: config.mail.pass } : undefined,
      connectionTimeout: 15e3, greetingTimeout: 15e3, socketTimeout: 30e3
    });
  }
  return transport;
}

const configured = () => !!config.mail.host;

function saveToOutbox(msg) {
  const dir = path.join(config.dataDir, 'outbox');
  fs.mkdirSync(dir, { recursive: true });
  const name = `${new Date().toISOString().replace(/[:.]/g, '-')}-${String(msg.to).replace(/[^\w.@-]/g, '_')}.html`;
  const head = `<!-- To: ${msg.to}\n     Subject: ${msg.subject} -->\n`;
  fs.writeFileSync(path.join(dir, name), head + (msg.html || `<pre>${msg.text}</pre>`));
}

// Returns { status: 'sent' | 'failed' | 'not_configured', error? }. Never throws.
async function send({ to, subject, text, html }) {
  const msg = { from: config.mail.from, replyTo: config.mail.replyTo, to, subject, text, html };
  if (!configured()) {
    try { saveToOutbox(msg); } catch (e) { console.error('outbox:', e.message); }
    return { status: 'not_configured' };
  }
  try {
    await getTransport().sendMail(msg);
    return { status: 'sent' };
  } catch (e) {
    console.error(new Date().toISOString(), 'email to', to, 'failed:', e.message);
    return { status: 'failed', error: String(e.message || e).slice(0, 300) };
  }
}

module.exports = { send, configured };

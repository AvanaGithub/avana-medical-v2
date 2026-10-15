// Sends one test email with the SMTP settings in .env, to check email works before candidates rely on it.
// Usage: npm run test-email -- you@example.com
const config = require('../src/config');
const mailer = require('../src/mailer');

const to = process.argv[2];
if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(to)) {
  console.error('Usage: npm run test-email -- you@example.com');
  process.exit(1);
}
if (!mailer.configured()) {
  console.error('SMTP_HOST is not set in server/.env, so nothing can be sent. See deploy/DEPLOY.md, "Set up email".');
  process.exit(1);
}

(async () => {
  console.log(`Sending through ${config.mail.host}:${config.mail.port} as ${config.mail.from} …`);
  const r = await mailer.send({
    to,
    subject: 'Test email from the Avana Medical website',
    text: 'This is a test. If it reached your inbox (not spam), the website can email candidates their openings link.',
    html: '<p>This is a test. If it reached your inbox (not spam), the website can email candidates their openings link.</p>'
  });
  if (r.status === 'sent') console.log('Sent. Check the inbox (and the spam folder) of ' + to);
  else { console.error('Not sent: ' + (r.error || r.status)); process.exit(1); }
})();

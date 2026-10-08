// Creates (or resets) an admin account from the command line. Used once on a new server.
//   npm run create-admin -- you@avanamedical.com "Your Name"
// Prompts for the password so it never appears in shell history.
const readline = require('readline');
const { db } = require('../src/db');
const auth = require('../src/auth');

const [email, ...nameParts] = process.argv.slice(2);
const name = nameParts.join(' ').trim();
if (!email || !name) {
  console.error('Usage: npm run create-admin -- email@example.com "Full Name"');
  process.exit(1);
}

function askHidden(question) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = s => { if (!rl.stdoutMuted) rl.output.write(s); };
    rl.question(question, answer => { rl.close(); process.stdout.write('\n'); resolve(answer); });
    rl.stdoutMuted = true;
  });
}

(async () => {
  const password = process.env.ADMIN_PASSWORD || await askHidden('Password (min 10 chars, letters + numbers): ');
  const problem = auth.passwordProblem(password);
  if (problem) { console.error(problem); process.exit(1); }
  const hash = auth.hashPassword(password);
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (existing) {
    db.prepare("UPDATE users SET name = ?, password_hash = ?, role = 'admin', active = 1 WHERE id = ?").run(name, hash, existing.id);
    console.log(`Updated ${email}: admin, password reset.`);
  } else {
    db.prepare("INSERT INTO users (email, name, role, password_hash) VALUES (?,?, 'admin', ?)").run(email.toLowerCase(), name, hash);
    console.log(`Created admin ${email}.`);
  }
})();

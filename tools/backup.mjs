// Backup des Essensplans aus Firestore als JSON-Datei (z. B. in den Google-Drive-Ordner).
// Läuft wöchentlich über die Windows-Aufgabenplanung. Die Datei lässt sich in der App
// unter „Mehr → Importieren“ wieder einspielen.
//
// Braucht einen Dienstkonto-Schlüssel mit reinen Leserechten (Rolle „Cloud Datastore-Betrachter“).
// Der Schlüssel gehört NICHT in dieses Repository.

import { readFileSync, writeFileSync, mkdirSync, appendFileSync } from 'node:fs';
import { createSign } from 'node:crypto';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';

const KEY_FILE = process.env.ESSENSPLAN_KEY || join(homedir(), '.essensplan', 'backup-key.json');
const TARGET_DIR = process.env.ESSENSPLAN_BACKUP_DIR || 'G:\\Meine Ablage\\Essensplan-Backups';
const LOG_FILE = join(homedir(), '.essensplan', 'backup.log');
const DOC_PATH = 'haushalte/familie';

const b64url = s => Buffer.from(s).toString('base64url');

// Meldet sich mit dem Dienstkonto bei Google an (signiertes JWT → Zugriffstoken).
async function accessToken(key) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(JSON.stringify({
    iss: key.client_email,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }));
  const signature = createSign('RSA-SHA256').update(`${header}.${claims}`).sign(key.private_key, 'base64url');
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${header}.${claims}.${signature}`,
    }),
  });
  if (!res.ok) throw new Error(`Anmeldung fehlgeschlagen (${res.status}): ${await res.text()}`);
  return (await res.json()).access_token;
}

// Firestore liefert typisierte Werte ({ stringValue: … }) – hier zurück in normales JSON.
function plain(v) {
  if ('mapValue' in v) return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, plain(x)]));
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(plain);
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('stringValue' in v) return v.stringValue;
  if ('timestampValue' in v) return v.timestampValue;
  return null;
}

function log(msg) {
  mkdirSync(dirname(LOG_FILE), { recursive: true });
  appendFileSync(LOG_FILE, `${new Date().toLocaleString('de-DE')}  ${msg}\n`);
  console.log(msg);
}

try {
  const key = JSON.parse(readFileSync(KEY_FILE, 'utf8'));
  const token = await accessToken(key);
  const url = `https://firestore.googleapis.com/v1/projects/${key.project_id}/databases/(default)/documents/${DOC_PATH}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Lesen fehlgeschlagen (${res.status}): ${await res.text()}`);
  const data = plain({ mapValue: { fields: (await res.json()).fields } });

  mkdirSync(TARGET_DIR, { recursive: true });
  const date = new Date().toLocaleDateString('sv-SE'); // JJJJ-MM-TT
  const file = join(TARGET_DIR, `essensplan-${date}.json`);
  writeFileSync(file, JSON.stringify(data, null, 2));
  log(`OK: ${file} (${data.recipes?.length ?? 0} Rezepte)`);
} catch (err) {
  log(`FEHLER: ${err.message}`);
  process.exitCode = 1;
}

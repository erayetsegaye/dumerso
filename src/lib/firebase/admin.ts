import fs from 'fs';
import path from 'path';
import { App, applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { Auth, getAuth } from 'firebase-admin/auth';
import { Firestore, getFirestore } from 'firebase-admin/firestore';

type ServiceAccount = {
  project_id?: string;
  client_email?: string;
  private_key?: string;
};

/**
 * On Google infrastructure (App Hosting / Cloud Run) the runtime service
 * account is available as Application Default Credentials, so no key file is
 * needed - and shipping one would be worse security.
 */
function hasApplicationDefaultCredentials(): boolean {
  return Boolean(
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
      process.env.K_SERVICE || // Cloud Run / App Hosting
      process.env.FUNCTION_TARGET ||
      process.env.GOOGLE_CLOUD_PROJECT ||
      process.env.GCLOUD_PROJECT
  );
}

function defaultProjectId(): string | undefined {
  return (
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCLOUD_PROJECT ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  );
}

/**
 * Service account credentials are read, in order, from:
 *   1. FIREBASE_SERVICE_ACCOUNT_JSON  (raw JSON or base64, good for hosting)
 *   2. FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY
 *   3. ./firebase-service-account.json  (local development; gitignored)
 *   4. Application Default Credentials (App Hosting / Cloud Run)
 */
function loadServiceAccount(): ServiceAccount | null {
  const inline = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (inline) {
    const raw = inline.startsWith('{')
      ? inline
      : Buffer.from(inline, 'base64').toString('utf8');
    try {
      return JSON.parse(raw) as ServiceAccount;
    } catch {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON or base64-encoded JSON.');
    }
  }

  const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;
  if (FIREBASE_PROJECT_ID && FIREBASE_CLIENT_EMAIL && FIREBASE_PRIVATE_KEY) {
    return {
      project_id: FIREBASE_PROJECT_ID,
      client_email: FIREBASE_CLIENT_EMAIL,
      // Env vars keep "\n" as two characters; the SDK needs real newlines.
      private_key: FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    };
  }

  const filePath = path.join(process.cwd(), 'firebase-service-account.json');
  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as ServiceAccount;
  }

  return null;
}

let cachedApp: App | null = null;

function getAdminApp(): App {
  if (cachedApp) return cachedApp;
  if (getApps().length) {
    cachedApp = getApps()[0];
    return cachedApp;
  }

  const serviceAccount = loadServiceAccount();

  if (!serviceAccount?.project_id || !serviceAccount.client_email || !serviceAccount.private_key) {
    if (hasApplicationDefaultCredentials()) {
      cachedApp = initializeApp({
        credential: applicationDefault(),
        projectId: defaultProjectId(),
      });
      return cachedApp;
    }

    throw new Error(
      'Firebase Admin credentials are missing. Save firebase-service-account.json in the project ' +
        'root, or set FIREBASE_SERVICE_ACCOUNT_JSON (see .env.example).'
    );
  }

  cachedApp = initializeApp({
    credential: cert({
      projectId: serviceAccount.project_id,
      clientEmail: serviceAccount.client_email,
      privateKey: serviceAccount.private_key,
    }),
  });

  return cachedApp;
}

/** True when the server can verify tokens — lets routes degrade gracefully. */
export function isFirebaseAdminConfigured(): boolean {
  try {
    return Boolean(loadServiceAccount()) || hasApplicationDefaultCredentials();
  } catch {
    return hasApplicationDefaultCredentials();
  }
}

export function getAdminAuth(): Auth {
  return getAuth(getAdminApp());
}

export function getAdminDb(): Firestore {
  return getFirestore(getAdminApp());
}

'use client';

import { FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app';
import {
  Auth,
  GoogleAuthProvider,
  browserLocalPersistence,
  getAuth,
  setPersistence,
  signInWithPopup,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
};

/**
 * These NEXT_PUBLIC_* values are public by design (they identify the project,
 * they do not authorise anything). Access is controlled by Firebase rules and
 * by the server routes in this app.
 */
export function isFirebaseConfigured(): boolean {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId);
}

function getFirebaseApp(): FirebaseApp {
  if (!isFirebaseConfigured()) {
    throw new Error(
      'Firebase is not configured. Add the NEXT_PUBLIC_FIREBASE_* values to .env (see .env.example).'
    );
  }
  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

export function getFirebaseAuth(): Auth {
  return getAuth(getFirebaseApp());
}

/**
 * Opens the Google account chooser and returns a fresh ID token, which the
 * caller exchanges for a server session cookie via POST /api/auth/session.
 */
export async function signInWithGoogle(): Promise<{ idToken: string; email: string | null }> {
  const auth = getFirebaseAuth();
  await setPersistence(auth, browserLocalPersistence);

  const provider = new GoogleAuthProvider();
  // Always show the chooser so a shared till device can switch staff accounts.
  provider.setCustomParameters({ prompt: 'select_account' });

  const credential = await signInWithPopup(auth, provider);
  const idToken = await credential.user.getIdToken(true);

  return { idToken, email: credential.user.email };
}

/** Human-readable messages for the Firebase auth error codes we can hit. */
export function describeAuthError(error: unknown): string {
  const code = (error as { code?: string })?.code || '';

  switch (code) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Sign-in window was closed before finishing.';
    case 'auth/popup-blocked':
      return 'Your browser blocked the sign-in popup. Allow popups for this site and try again.';
    case 'auth/operation-not-allowed':
      return 'Google sign-in is not enabled on this Firebase project yet.';
    case 'auth/unauthorized-domain':
      return 'This domain is not in the Firebase authorised domains list.';
    case 'auth/network-request-failed':
      return 'Network error reaching Firebase. Check your connection.';
    default:
      return error instanceof Error ? error.message : 'Google sign-in failed. Please try again.';
  }
}

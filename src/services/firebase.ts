import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';
import { AppSettings } from '../types';

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;

export function initFirebase(settings: AppSettings) {
  if (!settings.useFirebase || !settings.firebaseConfig || !settings.firebaseConfig.apiKey) {
    return { app: null, db: null, auth: null };
  }

  try {
    if (getApps().length === 0) {
      app = initializeApp(settings.firebaseConfig);
    } else {
      app = getApps()[0];
    }
    db = getFirestore(app);
    auth = getAuth(app);
    return { app, db, auth };
  } catch (error) {
    console.error('Firebase initialization error:', error);
    return { app: null, db: null, auth: null };
  }
}

export function getFirebaseInstance() {
  return { app, db, auth };
}

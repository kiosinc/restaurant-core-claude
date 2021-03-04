// Google Auth
import * as admin from 'firebase-admin';

export const authApp = admin.auth();
export const firestoreApp = admin.firestore();
export const { FieldValue } = admin.firestore;

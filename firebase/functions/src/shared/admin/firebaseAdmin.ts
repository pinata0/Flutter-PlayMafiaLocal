// Auth, Firestore를 초기화합니다.
import {getApps, initializeApp} from "firebase-admin/app";
import {getAuth} from "firebase-admin/auth";
import {getFirestore} from "firebase-admin/firestore";

const app = getApps().length > 0 ? getApps()[0] : initializeApp();

const db = getFirestore(app);
const auth = getAuth(app);

// Prevent undefined fields from causing Firestore write errors.
db.settings({ignoreUndefinedProperties: true});

export {app, db, auth};
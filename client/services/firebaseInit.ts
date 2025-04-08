import { initializeApp, getApp, getApps } from '@firebase/app';
import { getDatabase } from '@firebase/database';
import { firebaseConfig } from '@/constants/FirebaseConfig';

// Initialize Firebase with modular API
export const initializeFirebase = () => {
    if (getApps().length === 0) {
        const sanitizedConfig = {
            apiKey: firebaseConfig.apiKey || '',
            authDomain: firebaseConfig.authDomain || '',
            databaseURL: firebaseConfig.databaseURL || '',
            projectId: firebaseConfig.projectId || '',
            messagingSenderId: firebaseConfig.messagingSenderId || '',
            appId: firebaseConfig.appId || '',
            storageBucket: '' // Added to fix previous error
        };

        // Check if all required fields have actual values
        if (
            sanitizedConfig.apiKey &&
            sanitizedConfig.authDomain &&
            sanitizedConfig.databaseURL &&
            sanitizedConfig.projectId &&
            sanitizedConfig.messagingSenderId &&
            sanitizedConfig.appId
        ) {
            try {
                initializeApp(sanitizedConfig);
                console.log('Firebase initialized successfully');
                return true;
            } catch (error) {
                console.error('Firebase initialization error:', error);
                return false;
            }
        } else {
            console.error("Firebase config is missing required fields");
            return false;
        }
    }
    return true; // Firebase already initialized
};

// Helper to get the Firebase app instance
export const getFirebaseApp = () => {
    try {
        return getApp();
    } catch (error) {
        initializeFirebase();
        return getApp();
    }
};

// Helper to get the database instance
export const getFirebaseDatabase = () => {
    return getDatabase(getFirebaseApp());
};
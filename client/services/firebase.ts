import { ref, set, onValue, off } from '@firebase/database';
import { getFirebaseDatabase } from './firebaseInit';
import { Alert } from 'react-native';

// Constants
const ESP32_DEVICE_ID = process.env.EXPO_PUBLIC_ESP32_DEVICE_ID || 'esp32';
const BASE_PATH = `/devices/${ESP32_DEVICE_ID}`;

// Offline detection settings - device is considered offline if no timestamp updates in this period
const OFFLINE_THRESHOLD_MS = 60000; // 60 seconds

// Check if Firebase is initialized
export const isFirebaseInitialized = () => {
    try {
        getFirebaseDatabase();
        return true;
    } catch (error) {
        return false;
    }
};

// LED Control Functions - with improved error handling
export const turnLedOn = async (): Promise<boolean> => {
    try {
        const db = getFirebaseDatabase();
        await set(ref(db, `${BASE_PATH}/led`), true);
        return true;
    } catch (error) {
        console.error('🔥 Error turning LED on:', error);
        Alert.alert('Connection Error', 'Failed to turn on LED. Check your connection.');
        return false;
    }
};

export const turnLedOff = async (): Promise<boolean> => {
    try {
        const db = getFirebaseDatabase();
        await set(ref(db, `${BASE_PATH}/led`), false);
        return true;
    } catch (error) {
        console.error('🔥 Error turning LED off:', error);
        Alert.alert('Connection Error', 'Failed to turn off LED. Check your connection.');
        return false;
    }
};

export const toggleLed = async (currentState: boolean): Promise<boolean> => {
    try {
        const db = getFirebaseDatabase();
        await set(ref(db, `${BASE_PATH}/led`), !currentState);
        return true;
    } catch (error) {
        console.error('🔥 Error toggling LED:', error);
        Alert.alert('Connection Error', 'Failed to toggle LED. Check your connection.');
        return false;
    }
};

// Helper function to create listeners safely with better error handling
const createListener = <T>(
    path: string,
    callback: (data: T) => void
): (() => void) => {
    try {
        const db = getFirebaseDatabase();
        const reference = ref(db, `${BASE_PATH}/${path}`);

        const listener = (snapshot: any) => {
            const value = snapshot.val();
            callback(value !== null ? value : (path === 'status' ? 'offline' : {}));
        };

        onValue(reference, listener, (error) => {
            console.error(`Error in listener for ${path}:`, error);
            callback(path === 'status' ? 'offline' as any : {} as any);
        });

        // Return unsubscribe function
        return () => off(reference, 'value', listener);
    } catch (error) {
        console.error(`Error creating listener for ${path}:`, error);
        // Return a no-op unsubscribe function
        return () => { };
    }
};

// Device Status Listeners with intelligent offline detection
export const subscribeToDeviceStatus = (callback: (status: string) => void) => {
    let lastTimestamp = 0;
    let lastStatus = 'unknown';
    let timestampUpdated = false;

    // Subscribe to timestamps to detect device offline state
    const timestampUnsubscribe = subscribeToLastSeen((timestamp: number) => {
        if (timestamp > 0) {
            lastTimestamp = timestamp;
            timestampUpdated = true;
        }
    });

    // Subscribe to status updates
    const statusUnsubscribe = createListener<string>('status', (status) => {
        lastStatus = status;

        // If we have a timestamp, check if the device might be offline based on timestamp
        if (timestampUpdated) {
            const msSinceLastUpdate = Date.now() - (lastTimestamp * 1000);
            if (msSinceLastUpdate > OFFLINE_THRESHOLD_MS) {
                callback('offline');
            } else {
                callback(status);
            }
        } else {
            callback(status);
        }
    });

    // Start a timer to regularly check if device might be offline based on timestamp
    const interval = setInterval(() => {
        if (timestampUpdated && lastTimestamp > 0) {
            const msSinceLastUpdate = Date.now() - (lastTimestamp * 1000);
            if (msSinceLastUpdate > OFFLINE_THRESHOLD_MS && lastStatus !== 'offline') {
                callback('offline');
            }
        }
    }, 5000);

    // Return combined unsubscribe function
    return () => {
        statusUnsubscribe();
        timestampUnsubscribe();
        clearInterval(interval);
    };
};

export const subscribeToDiagnostics = (callback: (data: any) => void) =>
    createListener<any>('diagnostics', callback);

export const subscribeToLedState = (callback: (isOn: boolean) => void) =>
    createListener<boolean>('led', callback);

export const subscribeToLastSeen = (callback: (timestamp: number) => void) =>
    createListener<number>('timestamp', callback);
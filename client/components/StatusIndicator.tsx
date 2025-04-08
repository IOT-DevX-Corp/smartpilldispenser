import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { subscribeToDeviceStatus, subscribeToLastSeen, isFirebaseInitialized } from '@/services/firebase';

// Time threshold in milliseconds - device is considered offline after this much time without updates
const OFFLINE_THRESHOLD_MS = 60000; // 60 seconds

const StatusIndicator = () => {
    const [deviceStatus, setDeviceStatus] = useState('unknown');
    const [lastSeen, setLastSeen] = useState(0);
    const [timeAgo, setTimeAgo] = useState('');
    const [isFirebaseReady, setIsFirebaseReady] = useState(false);
    const [isOffline, setIsOffline] = useState(false);

    // Subscribe to device status changes with improved offline detection
    useEffect(() => {
        // Check if Firebase is initialized
        const checkFirebase = () => {
            if (!isFirebaseInitialized()) {
                console.warn('Firebase not initialized yet');
                setTimeout(checkFirebase, 1000); // Try again in 1 second
                return;
            }

            setIsFirebaseReady(true);

            const unsubscribeStatus = subscribeToDeviceStatus((status) => {
                setDeviceStatus(status);

                // If status explicitly reports offline, make sure our local state matches
                if (status === 'offline') {
                    setIsOffline(true);
                } else if (status === 'online') {
                    setIsOffline(false);
                }
            });

            const unsubscribeLastSeen = subscribeToLastSeen((timestamp) => {
                if (timestamp > 0) {
                    setLastSeen(timestamp * 1000); // Convert to milliseconds
                }
            });

            // Update the "time ago" text and check offline status every second
            const interval = setInterval(() => {
                if (lastSeen > 0) {
                    const now = Date.now();
                    const msSinceLastUpdate = now - lastSeen;

                    // Update the time ago text
                    if (msSinceLastUpdate < 60000) {
                        setTimeAgo(`${Math.floor(msSinceLastUpdate / 1000)} seconds ago`);
                    } else if (msSinceLastUpdate < 3600000) {
                        setTimeAgo(`${Math.floor(msSinceLastUpdate / 60000)} minutes ago`);
                    } else {
                        setTimeAgo(`${Math.floor(msSinceLastUpdate / 3600000)} hours ago`);
                    }

                    // Set offline status if no updates for too long
                    if (msSinceLastUpdate > OFFLINE_THRESHOLD_MS) {
                        setIsOffline(true);
                    } else {
                        // Only set back online if the reported status was online
                        if (deviceStatus === 'online') {
                            setIsOffline(false);
                        }
                    }
                }
            }, 1000);

            // Return cleanup function
            return () => {
                unsubscribeStatus();
                unsubscribeLastSeen();
                clearInterval(interval);
            };
        };

        // Start the check
        const cleanup = checkFirebase();

        // Cleanup on unmount
        return () => {
            if (typeof cleanup === 'function') {
                cleanup();
            }
        };
    }, [lastSeen, deviceStatus]);

    // Determine icon and color based on status
    const getStatusIcon = () => {
        if (isOffline || deviceStatus === 'offline') {
            return <Feather name="wifi-off" size={24} color="#F44336" />;
        } else if (deviceStatus === 'online') {
            return <Feather name="wifi" size={24} color="#4CAF50" />;
        } else {
            return <Feather name="help-circle" size={24} color="#FFC107" />;
        }
    };

    // Get effective status text
    const getStatusText = () => {
        if (isOffline) {
            return 'OFFLINE';
        } else {
            return deviceStatus.toUpperCase();
        }
    };

    // Get status color
    const getStatusColor = () => {
        if (isOffline || deviceStatus === 'offline') {
            return '#F44336';
        } else if (deviceStatus === 'online') {
            return '#4CAF50';
        } else {
            return '#FFC107';
        }
    };

    if (!isFirebaseReady) {
        return (
            <View style={styles.container}>
                <View style={styles.card}>
                    <View style={styles.statusRow}>
                        <ActivityIndicator size="small" color="#FFC107" />
                        <Text style={styles.statusText}>
                            Connecting to device...
                        </Text>
                    </View>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.card}>
                <View style={styles.statusRow}>
                    {getStatusIcon()}
                    <Text style={styles.statusText}>
                        ESP32 is <Text style={{
                            color: getStatusColor(),
                            fontWeight: 'bold'
                        }}>
                            {getStatusText()}
                        </Text>
                    </Text>
                </View>

                {lastSeen > 0 && (
                    <Text style={styles.lastSeen}>
                        Last activity: {timeAgo}
                    </Text>
                )}
            </View>
        </View>
    );
};

interface StatusIndicatorStyles {
    container: object;
    card: object;
    statusRow: object;
    statusText: object;
    lastSeen: object;
}

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 8,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    statusText: {
        fontSize: 16,
        marginLeft: 8,
    },
    lastSeen: {
        fontSize: 14,
        color: '#666',
        marginTop: 8,
    }
}) as StatusIndicatorStyles;

export default StatusIndicator;
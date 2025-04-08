import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { subscribeToLedState, subscribeToDeviceStatus, toggleLed, turnLedOn, turnLedOff, isFirebaseInitialized } from '@/services/firebase';
import { useColorScheme } from '@/hooks/useColorScheme';
import Colors from '@/constants/Colors';

const FirebaseControl = () => {
    const [isLedOn, setIsLedOn] = useState(false);
    const [deviceStatus, setDeviceStatus] = useState('unknown');
    const [isFirebaseReady, setIsFirebaseReady] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const colorScheme = useColorScheme();
    const theme = Colors[colorScheme ?? 'light'];

    useEffect(() => {
        // Check if Firebase is initialized
        const checkFirebase = () => {
            if (!isFirebaseInitialized()) {
                console.warn('Firebase not initialized yet');
                setTimeout(checkFirebase, 1000); // Try again in 1 second
                return;
            }

            setIsFirebaseReady(true);

            // Subscribe to LED state changes
            const unsubscribeLed = subscribeToLedState((state) => {
                setIsLedOn(state);
                setIsProcessing(false); // Stop processing indicator when state updates
            });

            // Subscribe to device status
            const unsubscribeStatus = subscribeToDeviceStatus((status) => {
                setDeviceStatus(status);
            });

            // Return cleanup function
            return () => {
                unsubscribeLed();
                unsubscribeStatus();
            };
        };

        // Start the check
        const unsubscribe = checkFirebase();

        // Cleanup on unmount
        return () => {
            if (typeof unsubscribe === 'function') {
                unsubscribe();
            }
        };
    }, []);

    // Check if device is online
    const isDeviceOnline = deviceStatus === 'online';

    // Wrapper function for toggling LED with UI feedback
    const handleToggleLed = async () => {
        if (!isFirebaseReady) {
            Alert.alert('Error', 'Firebase not initialized yet');
            return;
        }

        if (!isDeviceOnline) {
            Alert.alert('Device Offline', 'The ESP32 device appears to be offline. Please check your device connection.');
            return;
        }

        setIsProcessing(true);

        // Optimistically update UI for better responsiveness
        setIsLedOn(!isLedOn);

        // Attempt the actual toggle operation
        const success = await toggleLed(isLedOn);

        if (!success) {
            // Revert if failed
            setIsLedOn(isLedOn);
            setIsProcessing(false);
        }
        // If successful, the subscription will update the state
    };

    const handleTurnOn = async () => {
        if (!isFirebaseReady) {
            Alert.alert('Error', 'Firebase not initialized yet');
            return;
        }

        if (!isDeviceOnline) {
            Alert.alert('Device Offline', 'The ESP32 device appears to be offline. Please check your device connection.');
            return;
        }

        setIsProcessing(true);

        // Optimistically update UI
        setIsLedOn(true);

        const success = await turnLedOn();

        if (!success) {
            setIsLedOn(isLedOn);
            setIsProcessing(false);
        }
    };

    const handleTurnOff = async () => {
        if (!isFirebaseReady) {
            Alert.alert('Error', 'Firebase not initialized yet');
            return;
        }

        if (!isDeviceOnline) {
            Alert.alert('Device Offline', 'The ESP32 device appears to be offline. Please check your device connection.');
            return;
        }

        setIsProcessing(true);

        // Optimistically update UI
        setIsLedOn(false);

        const success = await turnLedOff();

        if (!success) {
            setIsLedOn(isLedOn);
            setIsProcessing(false);
        }
    };

    if (!isFirebaseReady) {
        return (
            <View style={styles.container}>
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>LED Control</Text>
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="small" color={theme.tint} />
                        <Text style={{ textAlign: 'center', marginTop: 10 }}>Initializing connection...</Text>
                    </View>
                </View>
            </View>
        );
    }

    // Show offline message if device is detected as offline
    if (!isDeviceOnline) {
        return (
            <View style={styles.container}>
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>LED Control</Text>
                    <View style={styles.offlineContainer}>
                        <Feather name="wifi-off" size={32} color="#F44336" />
                        <Text style={styles.offlineText}>
                            Device is offline
                        </Text>
                        <Text style={styles.offlineSubText}>
                            Please check your ESP32 connection
                        </Text>
                    </View>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.card}>
                <Text style={styles.cardTitle}>LED Control</Text>

                <View style={styles.controlRow}>
                    <Text style={styles.label}>LED Status:</Text>
                    <View style={styles.statusIndicator}>
                        {isProcessing ? (
                            <ActivityIndicator size="small" color={theme.tint} />
                        ) : (
                            <Text
                                style={[
                                    styles.statusText,
                                    { color: isLedOn ? '#4CAF50' : '#F44336' }
                                ]}
                            >
                                {isLedOn ? 'ON' : 'OFF'}
                            </Text>
                        )}
                    </View>
                </View>

                {/* Toggle Switch */}
                <View style={styles.switchContainer}>
                    <Text style={styles.switchLabel}>Toggle LED</Text>
                    <Switch
                        value={isLedOn}
                        onValueChange={handleToggleLed}
                        trackColor={{ false: "#767577", true: theme.tint }}
                        thumbColor={isLedOn ? theme.tint : "#f4f3f4"}
                        disabled={isProcessing}
                    />
                </View>

                {/* Control Buttons */}
                <View style={styles.buttonContainer}>
                    <TouchableOpacity
                        style={[
                            styles.button,
                            styles.onButton,
                            isProcessing || isLedOn ? styles.disabledButton : {}
                        ]}
                        onPress={handleTurnOn}
                        disabled={isProcessing || isLedOn}
                    >
                        <Feather name="sun" size={24} color="white" />
                        <Text style={styles.buttonText}>Turn ON</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[
                            styles.button,
                            styles.offButton,
                            isProcessing || !isLedOn ? styles.disabledButton : {}
                        ]}
                        onPress={handleTurnOff}
                        disabled={isProcessing || !isLedOn}
                    >
                        <Feather name="moon" size={24} color="white" />
                        <Text style={styles.buttonText}>Turn OFF</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
};

// Expanded styles for better UI
interface FirebaseControlStyles {
    container: object;
    card: object;
    cardTitle: object;
    controlRow: object;
    label: object;
    statusText: object;
    switchContainer: object;
    switchLabel: object;
    buttonContainer: object;
    button: object;
    onButton: object;
    offButton: object;
    buttonText: object;
    disabledButton: object;
    loadingContainer: object;
    offlineContainer: object;
    offlineText: object;
    offlineSubText: object;
    statusIndicator: object;
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
    cardTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 16,
        textAlign: 'center',
    },
    controlRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    label: {
        fontSize: 16,
    },
    statusText: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    switchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 24,
    },
    switchLabel: {
        fontSize: 16,
    },
    buttonContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        width: '48%',
    },
    onButton: {
        backgroundColor: '#4CAF50',
    },
    offButton: {
        backgroundColor: '#F44336',
    },
    buttonText: {
        color: 'white',
        fontWeight: 'bold',
        marginLeft: 8,
    },
    disabledButton: {
        opacity: 0.5,
    },
    loadingContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    offlineContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    offlineText: {
        fontSize: 16,
        fontWeight: 'bold',
        marginTop: 12,
        color: '#F44336',
    },
    offlineSubText: {
        fontSize: 14,
        marginTop: 4,
        textAlign: 'center',
        color: '#757575',
    },
    statusIndicator: {
        minWidth: 40,
        alignItems: 'center',
        justifyContent: 'center',
    }
}) as FirebaseControlStyles;

export default FirebaseControl;
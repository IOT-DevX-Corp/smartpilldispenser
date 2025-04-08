import React from 'react';
import { ScrollView, StyleSheet, View, Text, Switch } from 'react-native';
import { Collapsible } from '@/components/Collapsible';
import { ExternalLink } from '@/components/ExternalLink';
import { useColorScheme } from '@/hooks/useColorScheme';
import Colors from '@/constants/Colors';

export default function SettingsScreen() {
    const colorScheme = useColorScheme();
    const theme = Colors[colorScheme ?? 'light'];

    return (
        <ScrollView style={styles.container}>
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>ESP32 Remote Control</Text>

                <Collapsible title="About this app">
                    <Text style={styles.paragraph}>
                        This application allows you to remotely control an ESP32 device using Firebase Realtime Database.
                        You can toggle the built-in LED and monitor the device status.
                    </Text>
                </Collapsible>

                <Collapsible title="Troubleshooting">
                    <Text style={styles.paragraph}>
                        If you're experiencing connection issues:
                    </Text>
                    <Text style={styles.listItem}>• Check your ESP32's power and WiFi connection</Text>
                    <Text style={styles.listItem}>• Verify your Firebase credentials</Text>
                    <Text style={styles.listItem}>• Restart the application</Text>
                </Collapsible>

                <Collapsible title="Resources">
                    <Text style={styles.paragraph}>
                        More information:
                    </Text>
                    <View style={styles.linkContainer}>
                        <ExternalLink href="https://firebase.google.com/docs" style={styles.link}>
                            Firebase Documentation
                        </ExternalLink>
                    </View>
                    <View style={styles.linkContainer}>
                        <ExternalLink href="https://docs.espressif.com" style={styles.link}>
                            ESP32 Documentation
                        </ExternalLink>
                    </View>
                </Collapsible>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 16,
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 16,
    },
    paragraph: {
        fontSize: 16,
        lineHeight: 24,
        marginBottom: 8,
    },
    listItem: {
        fontSize: 16,
        lineHeight: 24,
        marginLeft: 8,
        marginBottom: 4,
    },
    linkContainer: {
        marginVertical: 4,
    },
    link: {
        color: '#0066cc',
        fontSize: 16,
    },
});
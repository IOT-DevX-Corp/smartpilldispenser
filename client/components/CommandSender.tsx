import React from 'react';
import { View, Button, Text, Alert } from 'react-native';

const ESP32_IP = "http://192.168.4.1";  // ESP32 local IP

const CommandSender = () => {
    const sendCommand = async (command: string) => {
        try {
            const response = await fetch(`${ESP32_IP}/led/${command}`, {
                method: 'GET',
            });
            const result = await response.text();
            Alert.alert("Response", result);
        } catch (error) {
            Alert.alert("Error", "Could not connect to ESP32");
        }
    };

    return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <Text>Control LED with ESP32</Text>
            <Button title="Turn On LED" onPress={() => sendCommand("on")} />
            <Button title="Turn Off LED" onPress={() => sendCommand("off")} />
        </View>
    );
};

export default CommandSender;

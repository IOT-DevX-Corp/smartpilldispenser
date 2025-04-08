import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import StatusIndicator from '@/components/StatusIndicator';
import FirebaseControl from '@/components/FirebaseControl';

export default function ControlScreen() {
  return (
    <ScrollView style={styles.container}>
      <StatusIndicator />
      <FirebaseControl />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
  },
});
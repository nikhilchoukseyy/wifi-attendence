import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Snackbar, Text, Button } from 'react-native-paper';
import { useNetworkStatus } from '../lib/errorHandling';

export const NetworkOfflineBanner = () => {
  const { isOnline } = useNetworkStatus();

  if (isOnline) return null;

  return (
    <View style={styles.banner}>
      <Text style={styles.text}>📡 No internet connection</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#d32f2f',
    paddingVertical: 8,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  text: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: '600',
  },
});

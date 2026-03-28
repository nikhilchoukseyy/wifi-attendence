import React, { useState, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { CameraView, useCameraPermissions } from 'expo-camera';

// Get device screen dimensions — so camera fills the screen properly
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface FaceCameraProps {
  instruction: string;
  onCapture: (uri: string) => void;
  onError: (message: string) => void;
}

export default function FaceCamera({ instruction, onCapture, onError }: FaceCameraProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [capturing, setCapturing] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  // ── Permission loading ──
  if (!permission) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
        <Text style={styles.statusText}>Loading camera...</Text>
      </View>
    );
  }

  // ── Permission denied ──
  if (!permission.granted) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorIcon}>📷</Text>
        <Text style={styles.errorTitle}>Camera Permission Required</Text>
        <Text style={styles.errorSubtitle}>
          Camera access is needed for face verification.
        </Text>
        <TouchableOpacity
          style={styles.permissionButton}
          onPress={async () => {
            const result = await requestPermission();
            if (!result.granted) {
              onError('Camera permission denied. Please enable it in device settings.');
            }
          }}
        >
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Capture ──
  const handleCapture = async () => {
    if (!cameraRef.current || capturing) return;
    try {
      setCapturing(true);
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: false,
        skipProcessing: false,
      });
      if (!photo?.uri) throw new Error('Failed to capture photo. Try again.');
      onCapture(photo.uri);
    } catch (err: any) {
      onError(err.message ?? 'Camera capture failed. Try again.');
    } finally {
      setCapturing(false);
    }
  };

  return (
    <View style={styles.container}>

      {/* Instruction */}
      <View style={styles.instructionBox}>
        <Text style={styles.instructionText}>{instruction}</Text>
      </View>

      {/* Camera — explicit pixel dimensions, NOT flex:1 */}
      {/* WHY: flex:1 inside ScrollView = 0 height. Fixed dimensions always work. */}
      <View style={styles.cameraWrapper}>

        {/* CameraView — no children (native component restriction) */}
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing="front"
        />

        {/* Oval overlay — absolute positioned SIBLING of CameraView */}
        {/* WHY: CameraView doesn't support children on Android */}
        <View style={styles.overlay} pointerEvents="none">
          <View style={styles.faceOval} />
        </View>

      </View>

      {/* Capture button */}
      {capturing ? (
        <View style={styles.capturingBox}>
          <ActivityIndicator size="small" color="#fff" />
          <Text style={styles.capturingText}>Capturing...</Text>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.captureButton}
          onPress={handleCapture}
          activeOpacity={0.8}
        >
          <View style={styles.captureInner} />
        </TouchableOpacity>
      )}

      <Text style={styles.hintText}>
        Position your face inside the oval, then tap the button
      </Text>

    </View>
  );
}

const styles = StyleSheet.create({
  // ── Permission / loading states ──
  centered: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.7,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#0a0a0a',
  },
  statusText: { color: '#fff', marginTop: 12, fontSize: 14 },
  errorIcon: { fontSize: 48, marginBottom: 12 },
  errorTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  errorSubtitle: { color: '#94a3b8', fontSize: 13, textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  permissionButton: { backgroundColor: '#3b82f6', paddingHorizontal: 28, paddingVertical: 12, borderRadius: 8 },
  permissionButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  // ── Main UI ──
  // FIX: Use explicit width/height instead of flex:1
  // flex:1 inside ScrollView gives 0 height — camera becomes invisible
  container: {
    width: SCREEN_WIDTH,          // full screen width
    backgroundColor: '#0a0a0a',
    alignItems: 'center',
    paddingVertical: 12,
    paddingBottom: 8,
  },
  instructionBox: {
    backgroundColor: '#1e3a5f',
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginBottom: 20,
    marginHorizontal: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6',
    width: SCREEN_WIDTH - 40,     // full width minus padding
  },
  instructionText: {
    color: '#93c5fd',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },

  // Camera wrapper — explicit height, not flex
  cameraWrapper: {
    width: SCREEN_WIDTH - 40,     // full width minus padding
    height: SCREEN_HEIGHT * 0.38, // 45% of screen height — visible on all devices
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#3b82f6',
    position: 'relative',         // so absolute children are positioned inside this
  },
  camera: {
    width: '100%',
    height: '100%',               // fills the cameraWrapper completely
  },

  // Oval overlay — sits ON TOP of camera using absolute position
  overlay: {
    position: 'absolute',         // doesn't affect layout, floats above camera
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  faceOval: {
    width: 200,
    height: 260,
    borderRadius: 130,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.6)',
    borderStyle: 'dashed',
  },

  // ── Capture button ──
  captureButton: {
    marginTop: 28,
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'transparent',
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureInner: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#fff',
  },
  capturingBox: {
    marginTop: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#1e293b',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 36,
  },
  capturingText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  hintText: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 16,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});
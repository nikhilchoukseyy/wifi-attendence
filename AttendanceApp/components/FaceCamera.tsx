import React, { useState, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';

// ─── Props ───────────────────────────────────────────────────────────────────
interface FaceCameraProps {
  instruction: string;       // Text shown to user — "Look at camera" / "Now blink"
  onCapture: (uri: string) => void;  // Called with photo URI after capture
  onError: (message: string) => void; // Called on permission deny or camera error
}
// ─────────────────────────────────────────────────────────────────────────────

export default function FaceCamera({ instruction, onCapture, onError }: FaceCameraProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [capturing, setCapturing] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  // ── Permission not yet determined ──
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

  // ── Capture photo ──
  const handleCapture = async () => {
    if (!cameraRef.current || capturing) return;
    try {
      setCapturing(true);
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,          // 80% quality — enough for face match, not too heavy
        base64: false,
        skipProcessing: false,
      });
      if (!photo?.uri) throw new Error('Failed to capture photo. Try again.');
      onCapture(photo.uri);   // pass URI back to parent
    } catch (err: any) {
      onError(err.message ?? 'Camera capture failed. Try again.');
    } finally {
      setCapturing(false);
    }
  };

  // ── Camera UI ──
  return (
    <View style={styles.container}>

      {/* Instruction text — shown above camera */}
      <View style={styles.instructionBox}>
        <Text style={styles.instructionText}>{instruction}</Text>
      </View>

      {/* Camera preview */}
      <View style={styles.cameraWrapper}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing={'front'}   // always front camera for face scan
        >
          {/* Face guide overlay — oval shape hint */}
          <View style={styles.overlay}>
            <View style={styles.faceOval} />
          </View>
        </CameraView>
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
  // ── Loading / Error states ──
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#0a0a0a',
  },
  statusText: {
    color: '#fff',
    marginTop: 12,
    fontSize: 14,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  errorTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorSubtitle: {
    color: '#94a3b8',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  permissionButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 8,
  },
  permissionButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },

  // ── Main camera UI ──
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    alignItems: 'center',
    paddingVertical: 24,
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
  },
  instructionText: {
    color: '#93c5fd',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  cameraWrapper: {
    width: 300,
    height: 380,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#3b82f6',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
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
  capturingText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  hintText: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 16,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});
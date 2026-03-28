import React, { useState, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { checkEyeState } from '../lib/livenessCheck';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Liveness phases in order
type Phase = 'open' | 'blink' | 'done' | 'failed';

interface FaceCameraProps {
  instruction: string;
  onCapture: (uri: string) => void;
  onError: (message: string) => void;
}

export default function FaceCamera({ instruction, onCapture, onError }: FaceCameraProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [capturing, setCapturing] = useState(false);
  const [phase, setPhase] = useState<Phase>('open'); // liveness phase
  const [phaseStatus, setPhaseStatus] = useState('👁️ Keep eyes OPEN and tap check');
  const [livenessLoading, setLivenessLoading] = useState(false);
  const [livenessPassed, setLivenessPassed] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  if (!permission) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
        <Text style={styles.statusText}>Loading camera...</Text>
      </View>
    );
  }

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

  // ── Silent capture helper ──────────────────────────────────────────────────
  const silentCapture = async (): Promise<string> => {
    const photo = await cameraRef.current!.takePictureAsync({
      quality: 0.5,       // lower quality is fine for liveness — faster
      base64: false,
      skipProcessing: true,
    });
    if (!photo?.uri) throw new Error('Capture failed');
    return photo.uri;
  };

  // ── Phase 1: Check eyes open ───────────────────────────────────────────────
  const handleCheckOpen = async () => {
    if (!cameraRef.current || livenessLoading) return;
    setLivenessLoading(true);
    try {
      const uri = await silentCapture();
      const result = await checkEyeState(uri, 'open');
      if (result.passed) {
        setPhase('blink');
        setPhaseStatus('😌 Now CLOSE your eyes (blink) and tap check');
      } else {
        setPhaseStatus(`⚠️ ${result.reason} — Try again`);
      }
    } catch (e: any) {
      setPhaseStatus('⚠️ Error — Try again');
    } finally {
      setLivenessLoading(false);
    }
  };

  // ── Phase 2: Check eyes closed ─────────────────────────────────────────────
  const handleCheckBlink = async () => {
    if (!cameraRef.current || livenessLoading) return;
    setLivenessLoading(true);
    try {
      const uri = await silentCapture();
      const result = await checkEyeState(uri, 'closed');
      if (result.passed) {
        setPhase('done');
        setPhaseStatus('✅ Liveness verified! Now tap capture.');
        setLivenessPassed(true);
      } else {
        setPhaseStatus(`⚠️ ${result.reason} — Try again`);
      }
    } catch (e: any) {
      setPhaseStatus('⚠️ Error — Try again');
    } finally {
      setLivenessLoading(false);
    }
  };

  // ── Final capture (only after liveness) ───────────────────────────────────
  const handleCapture = async () => {
    if (!cameraRef.current || capturing || !livenessPassed) return;
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

  // ── Liveness action button ─────────────────────────────────────────────────
  const renderLivenessButton = () => {
    if (phase === 'done') return null; // liveness done, show main capture button

    return (
      <TouchableOpacity
        style={[styles.livenessButton, livenessLoading && { opacity: 0.6 }]}
        onPress={phase === 'open' ? handleCheckOpen : handleCheckBlink}
        disabled={livenessLoading}
      >
        {livenessLoading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.livenessButtonText}>
            {phase === 'open' ? '👁️ Check Eyes Open' : '😌 Check Eyes Closed'}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>

      {/* Instruction */}
      <View style={styles.instructionBox}>
        <Text style={styles.instructionText}>{instruction}</Text>
      </View>

      {/* Camera */}
      <View style={styles.cameraWrapper}>
        <CameraView ref={cameraRef} style={styles.camera} facing="front" />
        <View style={styles.overlay} pointerEvents="none">
          <View style={[
            styles.faceOval,
            livenessPassed && { borderColor: '#4CAF50' } // green when passed
          ]} />
        </View>
      </View>

      {/* Liveness status */}
      <View style={styles.livenessStatus}>
        <Text style={styles.livenessStatusText}>{phaseStatus}</Text>

        {/* Step dots */}
        <View style={styles.stepDots}>
          <View style={[styles.dot, phase !== 'open' && styles.dotDone]} />
          <View style={[styles.dot, phase === 'done' && styles.dotDone]} />
        </View>
      </View>

      {/* Liveness check button OR capture button */}
      {renderLivenessButton()}

      {phase === 'done' && (
        capturing ? (
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
        )
      )}

      <Text style={styles.hintText}>
        {phase === 'done'
          ? 'Tap the button to capture your face'
          : 'Complete liveness check first, then capture'}
      </Text>

    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    width: SCREEN_WIDTH, height: SCREEN_HEIGHT * 0.7,
    alignItems: 'center', justifyContent: 'center',
    padding: 24, backgroundColor: '#0a0a0a',
  },
  statusText: { color: '#fff', marginTop: 12, fontSize: 14 },
  errorIcon: { fontSize: 48, marginBottom: 12 },
  errorTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  errorSubtitle: { color: '#94a3b8', fontSize: 13, textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  permissionButton: { backgroundColor: '#3b82f6', paddingHorizontal: 28, paddingVertical: 12, borderRadius: 8 },
  permissionButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  container: {
    width: SCREEN_WIDTH, backgroundColor: '#0a0a0a',
    alignItems: 'center', paddingVertical: 12, paddingBottom: 8,
  },
  instructionBox: {
    backgroundColor: '#1e3a5f', borderRadius: 10,
    paddingHorizontal: 20, paddingVertical: 12,
    marginBottom: 20, marginHorizontal: 20,
    borderLeftWidth: 4, borderLeftColor: '#3b82f6',
    width: SCREEN_WIDTH - 40,
  },
  instructionText: { color: '#93c5fd', fontSize: 15, fontWeight: '700', textAlign: 'center' },
  cameraWrapper: {
    width: SCREEN_WIDTH - 40, height: SCREEN_HEIGHT * 0.38,
    borderRadius: 16, overflow: 'hidden',
    borderWidth: 2, borderColor: '#3b82f6', position: 'relative',
  },
  camera: { width: '100%', height: '100%' },
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  faceOval: {
    width: 200, height: 260, borderRadius: 130,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.6)', borderStyle: 'dashed',
  },

  // Liveness status area
  livenessStatus: { marginTop: 14, alignItems: 'center', paddingHorizontal: 20 },
  livenessStatusText: { color: '#e2e8f0', fontSize: 13, textAlign: 'center', marginBottom: 8 },
  stepDots: { flexDirection: 'row', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#334155' },
  dotDone: { backgroundColor: '#4CAF50' },

  // Liveness check button
  livenessButton: {
    marginTop: 16, backgroundColor: '#3b82f6',
    paddingHorizontal: 28, paddingVertical: 12,
    borderRadius: 10, minWidth: 200, alignItems: 'center',
  },
  livenessButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  // Capture button (same as before)
  captureButton: {
    marginTop: 20, width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'transparent', borderWidth: 4, borderColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  captureInner: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#fff' },
  capturingBox: {
    marginTop: 20, flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#1e293b', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 36,
  },
  capturingText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  hintText: { color: '#64748b', fontSize: 12, marginTop: 12, textAlign: 'center', paddingHorizontal: 32 },
});
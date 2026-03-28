import FaceDetection from '@react-native-ml-kit/face-detection';

export type LivenessPhase = 'open' | 'closed';

export interface LivenessResult {
  passed: boolean;
  reason?: string;
}

export const checkEyeState = async (
  uri: string,
  expectedPhase: LivenessPhase
): Promise<LivenessResult> => {
  const faces = await FaceDetection.detect(uri, {
    performanceMode: 'fast',
    classificationMode: 'all', // ← required for eye probability
    landmarkMode: 'none',
    contourMode: 'none',
  });

  if (faces.length === 0) {
    return { passed: false, reason: 'No face detected. Stay inside the oval.' };
  }

  const face = faces[0];
  const left = face.leftEyeOpenProbability ?? 0.5;
  const right = face.rightEyeOpenProbability ?? 0.5;
  const avg = (left + right) / 2;

  if (expectedPhase === 'open') {
    return avg > 0.75
      ? { passed: true }
      : { passed: false, reason: 'Eyes not detected as open. Look at camera.' };
  } else {
    return avg < 0.25
      ? { passed: true }
      : { passed: false, reason: 'Eyes not detected as closed. Blink fully.' };
  }
};
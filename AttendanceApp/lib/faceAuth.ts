import AsyncStorage from "@react-native-async-storage/async-storage";
import FaceDetection, { FaceDetectionOptions } from "@react-native-ml-kit/face-detection";
import * as ImageManipulator from "expo-image-manipulator";


let isInitialized = false;

const DETECTION_OPTIONS: FaceDetectionOptions = {
  performanceMode: "fast",      
  landmarkMode: "all",          
  classificationMode: "all",   
  minFaceSize: 0.15,          
};

export const isFaceModelReady = (): boolean => {
  return isInitialized;
};


export const initFaceModel = async (): Promise<void> => {
  if (isInitialized) return;
  isInitialized = true;
};


export const getFaceEmbedding = async (imageUri: string): Promise<number[]> => {
  try {
    
    const resized = await ImageManipulator.manipulateAsync(
      imageUri,
      [{ resize: { width: 480, height: 480 } }],
      { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
    );


    const faces = await FaceDetection.detect(resized.uri, DETECTION_OPTIONS);


    if (!faces || faces.length === 0) {
      throw new Error("No face detected. Look directly at the camera in good lighting.");
    }
    if (faces.length > 1) {
      throw new Error("Multiple faces detected. Only your face should be visible.");
    }

    const face = faces[0];


    const embedding: number[] = [
      
      face.frame.left / 480,
      face.frame.top / 480,
      face.frame.width / 480,
      face.frame.height / 480,
     
      (face.landmarks?.leftEye?.position?.x ?? 0) / 480,
      (face.landmarks?.leftEye?.position?.y ?? 0) / 480,
      (face.landmarks?.rightEye?.position?.x ?? 0) / 480,
      (face.landmarks?.rightEye?.position?.y ?? 0) / 480,
      (face.landmarks?.noseBase?.position?.x ?? 0) / 480,
      (face.landmarks?.noseBase?.position?.y ?? 0) / 480,
      (face.landmarks?.mouthBottom?.position?.x ?? 0) / 480,
      (face.landmarks?.mouthBottom?.position?.y ?? 0) / 480,
      (face.landmarks?.mouthLeft?.position?.x ?? 0) / 480,
      (face.landmarks?.mouthLeft?.position?.y ?? 0) / 480,
      (face.landmarks?.mouthRight?.position?.x ?? 0) / 480,
      (face.landmarks?.mouthRight?.position?.y ?? 0) / 480,
    ];

    console.log(`✓ Face embedding extracted: ${embedding.length} features`);
    return embedding;

  } catch (err: any) {
    console.error("getFaceEmbedding error:", err);
    throw new Error(`Face recognition failed: ${err.message}`);
  }
};


export const isSamePerson = (
  stored: number[],
  live: number[],
  threshold = 0.85
): boolean => {
  try {
    if (stored.length !== live.length) {
      console.warn(`Embedding length mismatch: ${stored.length} vs ${live.length}`);
      return false;
    }

    const dot = stored.reduce((sum, v, i) => sum + v * live[i], 0);
    const magA = Math.sqrt(stored.reduce((s, v) => s + v * v, 0));
    const magB = Math.sqrt(live.reduce((s, v) => s + v * v, 0));

    if (magA === 0 || magB === 0) {
      console.warn("Zero magnitude — likely no face detected");
      return false;
    }

    const similarity = dot / (magA * magB);
    console.log(`Face similarity: ${(similarity * 100).toFixed(1)}% (threshold: ${threshold * 100}%)`);

    return similarity >= threshold;
  } catch (err: any) {
    console.error("isSamePerson error:", err);
    return false;
  }
};


export const storeFaceEmbedding = async (
  studentId: string,
  embedding: number[]
): Promise<void> => {
  await AsyncStorage.setItem(`face_embed_${studentId}`, JSON.stringify(embedding));
  console.log(`✓ Embedding saved for student ${studentId}`);
};

export const loadFaceEmbedding = async (
  studentId: string
): Promise<number[] | null> => {
  const raw = await AsyncStorage.getItem(`face_embed_${studentId}`);
  if (!raw) return null;
  return JSON.parse(raw);
};

export const hasFaceEmbedding = async (studentId: string): Promise<boolean> => {
  const e = await loadFaceEmbedding(studentId);
  return e !== null && e.length > 0;
};

export const verifyLiveness = async (
  frame1Uri: string,   
  frame2Uri: string    
): Promise<boolean> => {
  try {
  
    const resized = await ImageManipulator.manipulateAsync(
      frame2Uri,
      [{ resize: { width: 480, height: 480 } }],
      { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
    );

    const faces = await FaceDetection.detect(resized.uri, DETECTION_OPTIONS);

    if (!faces || faces.length === 0) {
      console.log("Liveness failed: no face in frame2");
      return false;
    }

    const face = faces[0];

    
    const smilingProb = face.smilingProbability ?? 0;
    const leftEyeOpen = face.leftEyeOpenProbability ?? 1;
    const rightEyeOpen = face.rightEyeOpenProbability ?? 1;

    console.log(`Liveness — smile: ${(smilingProb * 100).toFixed(0)}%, leftEye: ${(leftEyeOpen * 100).toFixed(0)}%, rightEye: ${(rightEyeOpen * 100).toFixed(0)}%`);

   
    return true;

  } catch (err) {
    console.error("Liveness check failed:", err);
    return false;
  }
};


export const getLivenessChallenge = (): {
  instruction: string;
  action: "blink" | "smile" | "turn_left";
} => {
  const challenges = [
    { instruction: "Slowly blink your eyes", action: "blink" as const },
    { instruction: "Smile for the camera", action: "smile" as const },
    { instruction: "Slightly turn your head left", action: "turn_left" as const },
  ];
  return challenges[Math.floor(Math.random() * challenges.length)];
};
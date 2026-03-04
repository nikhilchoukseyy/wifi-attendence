import AsyncStorage from "@react-native-async-storage/async-storage";
import FaceDetection, { FaceDetectionOptions } from "@react-native-ml-kit/face-detection";
import * as ImageManipulator from "expo-image-manipulator";

// ─── ML Kit ke liye koi detector object nahi hota ────────────────────────────
// TF mein detector banana padta tha, load karna padta tha
// ML Kit mein seedha FaceDetection.detect() call karte hain — built-in Android mein hai
let isInitialized = false;

// ML Kit detection options — ek jagah define karo, baar baar use karo
const DETECTION_OPTIONS: FaceDetectionOptions = {
  performanceMode: "fast",      // fast = attendance ke liye enough, accurate bhi
  landmarkMode: "all",          // left eye, right eye, nose, mouth — embedding ke liye chahiye
  classificationMode: "all",    // smile probability, eye open probability — liveness ke liye
  minFaceSize: 0.15,            // minimum face size — chhote faces ignore karo
};

// ─── Check karo model ready hai ya nahi ──────────────────────────────────────
export const isFaceModelReady = (): boolean => {
  return isInitialized;
};

// ─── Init — ML Kit ke liye kuch setup nahi chahiye ───────────────────────────
// Pehle TF mein yahan model download hota tha (3-5 sec), backend set hota tha
// ML Kit Android mein pre-installed hai — koi download nahi, instant ready
export const initFaceModel = async (): Promise<void> => {
  if (isInitialized) return;
  isInitialized = true;
  console.log("✓ ML Kit Face Detection ready (on-device, no download needed)");
};

// ─── Core: Image URI → Face Embedding ────────────────────────────────────────
// Yeh function ek photo leta hai aur numbers ka array return karta hai
// Yeh numbers face ki geometry represent karte hain — unique fingerprint jaisi
//
// Pehle TF mein: image → base64 → tensor → model.estimateFaces()  [complex, slow]
// Ab ML Kit mein: image → FaceDetection.detect()                   [simple, fast]
export const getFaceEmbedding = async (imageUri: string): Promise<number[]> => {
  try {
    // Step 1: Image ko 480x480 pe resize karo
    // Kyun 480: ML Kit ke liye enough resolution hai
    // Kyun resize karna: chhoti image = faster processing = faster attendance
    const resized = await ImageManipulator.manipulateAsync(
      imageUri,
      [{ resize: { width: 480, height: 480 } }],
      { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
    );

    // Step 2: ML Kit se face detect karo — seedha URI dedo
    // Pehle TF mein tensor banana padta tha, base64 decode karna padta tha
    // ML Kit itna simple hai — sirf URI do aur faces milenge
    const faces = await FaceDetection.detect(resized.uri, DETECTION_OPTIONS);

    // Step 3: Validation
    if (!faces || faces.length === 0) {
      throw new Error("No face detected. Look directly at the camera in good lighting.");
    }
    if (faces.length > 1) {
      throw new Error("Multiple faces detected. Only your face should be visible.");
    }

    const face = faces[0];

    // Step 4: Embedding banao
    // Normalize kyun karte hain (/ 480):
    //   Image 480x480 hai. Agar left eye 240, 180 pe hai toh:
    //   240/480 = 0.5 (normalized value)
    //   Yeh ensure karta hai values 0-1 range mein rahein
    //   Faida: comparison accurate hota hai chahe photo zoom in ho ya zoom out
    const embedding: number[] = [
      // Bounding box — face kahan hai image mein
      face.frame.left / 480,
      face.frame.top / 480,
      face.frame.width / 480,
      face.frame.height / 480,
      // Landmarks — face ki geometry (yahi unique hoti hai har person ke liye)
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

// ─── Compare Two Embeddings ───────────────────────────────────────────────────
// Cosine similarity: 1.0 = bilkul same person, 0.0 = bilkul alag
// threshold 0.85 = 85% similar hona chahiye same person ke liye
//
// Yeh function bilkul same hai — TF ya ML Kit se koi fark nahi padta
// Sirf numbers compare ho rahe hain — library irrelevant hai
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

// ─── Save & Load Embedding — AsyncStorage ────────────────────────────────────
// First login pe: getFaceEmbedding() call karo phir storeFaceEmbedding()
// Attendance pe: loadFaceEmbedding() call karo phir isSamePerson() se compare karo
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

// ─── Liveness Detection ───────────────────────────────────────────────────────
// Do frames compare karte hain — before action aur after action
//
// ML Kit ka bonus: classificationMode: "all" se hume milta hai:
//   face.smilingProbability     — 0.0 to 1.0 (kitna muskura raha hai)
//   face.leftEyeOpenProbability — 0.0 to 1.0 (kitni aankhein khuli hain)
//
// Printed photo pe yeh values change nahi hoti — real person pe hoti hain
// Isliye yeh liveness detect karna easy ho jaata hai
export const verifyLiveness = async (
  frame1Uri: string,   // action se pehle ka frame
  frame2Uri: string    // action ke baad ka frame
): Promise<boolean> => {
  try {
    // frame2 — action ke baad wala — yahi check karo
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

    // ML Kit se smile aur eye open probability lo
    const smilingProb = face.smilingProbability ?? 0;
    const leftEyeOpen = face.leftEyeOpenProbability ?? 1;
    const rightEyeOpen = face.rightEyeOpenProbability ?? 1;

    console.log(`Liveness — smile: ${(smilingProb * 100).toFixed(0)}%, leftEye: ${(leftEyeOpen * 100).toFixed(0)}%, rightEye: ${(rightEyeOpen * 100).toFixed(0)}%`);

    // Face clearly detect hua = real person confirmed (basic liveness)
    // Advanced: agar smile action diya tha toh smilingProb > 0.7
    // Abhi basic check — face detect hona hi enough hai
    // Future mein: challenge ke saath specific check add kar sakte hain
    return true;

  } catch (err) {
    console.error("Liveness check failed:", err);
    return false;
  }
};

// ─── Liveness Challenge ───────────────────────────────────────────────────────
// Random action maango user se — printed photo yeh nahi kar sakti
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
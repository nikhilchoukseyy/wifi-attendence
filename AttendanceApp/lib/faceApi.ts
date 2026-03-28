const FACEPP_API_KEY = process.env.EXPO_PUBLIC_FACEPP_API_KEY!;
const FACEPP_API_SECRET = process.env.EXPO_PUBLIC_FACEPP_API_SECRET!;
const FACEPP_URL = 'https://api-us.faceplusplus.com/facepp/v3/compare';

export const verifyFaceWithBackend = async (
  capturedUri: string,
  referenceUrl: string
): Promise<boolean> => {

  // Step 1: Live photo → base64
  const capturedBase64 = await uriToBase64(capturedUri);

  // Step 2: Reference photo (Supabase URL) → base64
  const refResponse = await fetch(referenceUrl);
  const refBlob = await refResponse.blob();
  const refBase64 = await blobToBase64(refBlob);

  // Step 3: Face++ Compare API call
  const formData = new FormData();
  formData.append('api_key', FACEPP_API_KEY);
  formData.append('api_secret', FACEPP_API_SECRET);
  formData.append('image_base64_1', refBase64);
  formData.append('image_base64_2', capturedBase64);

  const res = await fetch(FACEPP_URL, {
    method: 'POST',
    body: formData,
  });

  const data = await res.json();

  // Error handle karo
  if (data.error_message) {
    throw new Error(`Face verification error: ${data.error_message}`);
  }

  // confidence 0-100 hota hai Face++ mein
  // 70+ = same person (safe threshold for attendance)
  console.log(`Face similarity: ${data.confidence?.toFixed(1)}%`);
  return data.confidence >= 70;
};

// ─── Helpers ────────────────────────────────────────────

const uriToBase64 = async (uri: string): Promise<string> => {
  const response = await fetch(uri);
  const blob = await response.blob();
  return blobToBase64(blob);
};

const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = () => reject(new Error('Failed to convert image'));
    reader.readAsDataURL(blob);
  });
};
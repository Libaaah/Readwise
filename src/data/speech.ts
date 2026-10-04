export type WhisperTranscription = {
  text: string;
  language?: string;
};

export async function transcribeWithWhisper(blob: Blob): Promise<WhisperTranscription | null> {
  const baseUrl = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000").replace(/\/$/, "");
  if (!navigator.onLine) return null;

  const form = new FormData();
  form.append("file", blob, "reading.webm");
  try {
    const response = await fetch(`${baseUrl}/api/transcribe`, { method: "POST", body: form });
    if (!response.ok) return null;
    const result = await response.json() as Partial<WhisperTranscription>;
    return typeof result.text === "string" ? { text: result.text, language: result.language } : null;
  } catch {
    return null;
  }
}

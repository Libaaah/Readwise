import os
import tempfile
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="ReadWise Speech Assessment API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("READWISE_ALLOWED_ORIGINS", "*").split(","),
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)

MODEL_SIZE = os.getenv("WHISPER_MODEL", "small")
_model = None


def whisper_model():
    global _model
    if _model is None:
        try:
            from faster_whisper import WhisperModel
        except ImportError as exc:
            raise HTTPException(status_code=503, detail="Whisper dependencies are not installed") from exc
        _model = WhisperModel(MODEL_SIZE, device="cpu", compute_type="int8")
    return _model


@app.get("/health")
def health():
    return {"ok": True, "service": "readwise-speech"}


@app.post("/api/transcribe")
async def transcribe(file: UploadFile = File(...)):
    suffix = Path(file.filename or "reading.webm").suffix or ".webm"
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="The uploaded recording is empty")
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temporary:
        temporary.write(content)
        temporary_path = temporary.name
    try:
        segments, info = whisper_model().transcribe(temporary_path, beam_size=5, vad_filter=True)
        text = " ".join(segment.text.strip() for segment in segments).strip()
        return {"text": text, "language": info.language}
    finally:
        Path(temporary_path).unlink(missing_ok=True)


@app.post("/api/progress")
async def sync_progress(payload: dict):
    # The frontend keeps the local queue as the source of truth until a database is configured.
    return {"accepted": True, "lessonId": payload.get("progress", {}).get("lessonId")}

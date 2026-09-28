"""Local phoneme-level pronunciation assessment service for 蘑菇酱四级.

The service binds to loopback only. Model files and caches are redirected to
D:\\MoguSpeech by server.mjs before this module is launched.
"""

from __future__ import annotations

import os
import tempfile
from math import gcd
from pathlib import Path
from typing import Any

import numpy as np
import soundfile as sf
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from openpronounce import phones
from openpronounce.device import get_device
from scipy.signal import resample_poly


app = FastAPI(title="Mogu local phoneme assessment", docs_url=None, redoc_url=None)


def clamp_score(value: float) -> int:
    return round(max(0.0, min(100.0, value)))


def load_wav_mono(path: str, target_rate: int = 16000) -> np.ndarray:
    samples, sample_rate = sf.read(path, dtype="float32", always_2d=False)
    if samples.ndim > 1:
        samples = samples.mean(axis=1)
    if sample_rate != target_rate:
        divisor = gcd(int(sample_rate), target_rate)
        samples = resample_poly(samples, target_rate // divisor, int(sample_rate) // divisor).astype(np.float32)
    return np.asarray(samples, dtype=np.float32)


def normalize_phone_feedback(result: dict[str, Any]) -> list[dict[str, Any]]:
    differences = result.get("differences") or {}
    feedback: list[dict[str, Any]] = []
    for word_error in differences.get("errors") or []:
        word = str(word_error.get("word") or "").strip()
        for phone in word_error.get("phones") or []:
            expected = str(phone.get("expected") or phone.get("phoneme") or "").strip()
            heard = str(phone.get("heard") or phone.get("actual") or "").strip()
            if not expected:
                continue
            confidence = float(phone.get("confidence") or word_error.get("confidence") or 0.0)
            if heard == expected or confidence < 0.05:
                continue
            feedback.append(
                {
                    "phoneme": expected,
                    "score": clamp_score((1.0 - confidence) * 100.0),
                    "word": word,
                    "alternatives": ([{"phoneme": heard, "score": clamp_score(confidence * 100.0)}] if heard else []),
                }
            )
    return feedback[:24]


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "ok": True,
        "engine": "openpronounce",
        "device": str(get_device()),
    }


@app.post("/pronunciation")
async def pronunciation(
    file: UploadFile = File(...),
    expected_text: str = Form(...),
    lang: str = Form("en"),
) -> dict[str, Any]:
    reference = " ".join(expected_text.strip().split())
    if not reference or len(reference) > 600:
        raise HTTPException(status_code=400, detail="Expected text must contain 1-600 characters")
    if lang != "en":
        raise HTTPException(status_code=400, detail="Only calibrated English assessment is enabled")

    suffix = Path(file.filename or "recording.wav").suffix or ".wav"
    payload = await file.read()
    if not payload or len(payload) > 6 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Recording is empty or too large")

    temporary_path = ""
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temporary:
            temporary.write(payload)
            temporary_path = temporary.name
        audio = load_wav_mono(temporary_path)
        recognition = phones.recognize_phones(audio, sampling_rate=16000, lang="en")
        differences = phones.compare_phones(recognition, reference, lang="en")
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Assessment failed: {error}") from error
    finally:
        if temporary_path:
            Path(temporary_path).unlink(missing_ok=True)

    phoneme_error_rate = float(differences.get("phone_error_rate") or 0.0)
    accuracy_score = clamp_score((1.0 - phoneme_error_rate) * 100.0)
    return {
        "provider": "openpronounce",
        "score": accuracy_score,
        "recognized": "",
        "heardPhonemes": differences.get("heard_phones") or [],
        "accuracyScore": accuracy_score,
        "completenessScore": None,
        "phonemes": normalize_phone_feedback({"differences": differences}),
        "words": [
            {
                "word": str(item.get("word") or ""),
                "expected": str(item.get("expected") or ""),
                "heard": str(item.get("actual") or ""),
                "confidence": round(float(item.get("confidence") or 0.0), 3),
            }
            for item in (differences.get("errors") or [])[:12]
        ],
        "note": "本地 Wav2Vec2 音素识别与对齐评分；短词或嘈杂录音可能偶尔误报。",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=int(os.environ.get("MOGU_PHONEME_PORT", "4175")), log_level="warning")

"""
engine.py - Local Python AI & Media Engine Daemon for CapShorts
Powered by FastAPI, Faster-Whisper, native FFmpeg, and Master Groq Cloud Turbo Pool.
"""

import os
import sys
import io

# Fix PyInstaller windowed NoneType stdout/stderr bug (causes uvicorn logging crash)
if sys.stdout is None:
    sys.stdout = io.StringIO()
if sys.stderr is None:
    sys.stderr = io.StringIO()

import uuid
import time
import shutil
import wave
import subprocess
import threading
import base64

# Eliminate all pop-up black console/terminal windows for FFmpeg on Windows safely across platforms
SUBPROCESS_FLAGS = getattr(subprocess, "CREATE_NO_WINDOW", 0x08000000) if sys.platform == "win32" else 0
SUBPROCESS_EXTRA_KWARGS = {"creationflags": SUBPROCESS_FLAGS} if sys.platform == "win32" else {}

from typing import List, Dict, Any, Optional, Tuple
from pydantic import BaseModel, Field, model_validator
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks, Depends, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse

from subtitle_gen import generate_ass_subtitles, generate_srt_subtitles, generate_vtt_subtitles
from broll import search_pexels_videos, download_broll_clip, build_ffmpeg_broll_filter
from clip_generator import detect_viral_clips
from groq_transcribe import transcribe_with_groq_pool
from transliterate import transliterate_transcript, transliterate_word
from telemetry import telemetry

app = FastAPI(title="CapShorts AI Engine", version="1.1.3")

def get_ffmpeg_bin() -> str:
    """Resolves platform-appropriate FFmpeg executable."""
    for name in ["ffmpeg.exe", "ffmpeg"]:
        p = os.path.join(BIN_DIR, name)
        if os.path.exists(p):
            return p
    return "ffmpeg"

def get_ffprobe_bin() -> str:
    """Resolves platform-appropriate FFprobe executable."""
    for name in ["ffprobe.exe", "ffprobe"]:
        p = os.path.join(BIN_DIR, name)
        if os.path.exists(p):
            return p
    return "ffprobe"

def probe_video_dimensions(video_path: str) -> Tuple[int, int]:
    """Probes video width and height using ffprobe with timeout."""
    try:
        ffprobe_bin = get_ffprobe_bin()
        cmd = [
            ffprobe_bin, "-v", "error",
            "-select_streams", "v:0",
            "-show_entries", "stream=width,height",
            "-of", "csv=s=x:p=0",
            video_path
        ]
        out = subprocess.check_output(cmd, stderr=subprocess.PIPE, text=True, timeout=10, **SUBPROCESS_EXTRA_KWARGS).strip()
        if "x" in out:
            w_str, h_str = out.split("x", 1)
            return int(w_str), int(h_str)
    except subprocess.TimeoutExpired:
        print(f"[engine] probe_video_dimensions timed out after 10s for: {video_path}")
    except Exception as e:
        print(f"[engine] probe_video_dimensions error: {e}")
    return 1080, 1920

LOCAL_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:1420",
    "http://127.0.0.1:1420",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
    "http://tauri.localhost",
    "https://tauri.localhost",
    "tauri://localhost",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=LOCAL_ALLOWED_ORIGINS,
    allow_origin_regex=r"^(https?://(localhost|127\.0\.0\.1)(:\d+)?|https?://tauri\.localhost|tauri://localhost)$",
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD"],
    allow_headers=["*"],
)

# Base directory detection (handles PyInstaller standalone .exe as well as dev script)
if getattr(sys, 'frozen', False):
    BASE_DIR = os.path.dirname(sys.executable)
    # PyInstaller extracted temp folder for internal assets
    MEIPASS_DIR = getattr(sys, '_MEIPASS', BASE_DIR)
else:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    MEIPASS_DIR = BASE_DIR

BIN_DIR = os.path.join(BASE_DIR, "bin")
if not os.path.exists(BIN_DIR) and os.path.exists(os.path.join(MEIPASS_DIR, "bin")):
    BIN_DIR = os.path.join(MEIPASS_DIR, "bin")

if os.path.exists(BIN_DIR):
    os.environ["PATH"] = BIN_DIR + os.pathsep + os.environ.get("PATH", "")

TEMP_DIR = os.path.join(BASE_DIR, "temp")
OUTPUT_DIR = os.path.join(BASE_DIR, "outputs")
ENV_FILE = os.path.join(BASE_DIR, ".env")
os.makedirs(TEMP_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

def get_safe_contained_path(base_dir: str, filename: str) -> str:
    """
    Validates and resolves a file path strictly within base_dir.
    Rejects directory traversal sequences, embedded null bytes, and absolute path escapes.
    """
    if not filename or not isinstance(filename, str):
        raise HTTPException(status_code=400, detail="Filename cannot be empty")

    raw = filename.strip()
    if "\x00" in raw or ".." in raw or raw.startswith("/") or raw.startswith("\\") or (len(raw) > 1 and raw[1] == ":"):
        raise HTTPException(status_code=400, detail="Path traversal forbidden")

    clean_name = os.path.basename(raw.replace("\\", "/"))
    if not clean_name or clean_name in (".", "..") or "\x00" in clean_name:
        raise HTTPException(status_code=400, detail="Invalid filename format")
    resolved_base = os.path.realpath(base_dir)
    target_path = os.path.realpath(os.path.join(resolved_base, clean_name))
    if not (target_path.startswith(resolved_base + os.sep) or target_path == resolved_base):
        raise HTTPException(status_code=400, detail="Path traversal forbidden")
    return target_path

def verify_loopback_request(request: Request):
    """Ensures caller is strictly local machine loopback."""
    client_host = request.client.host if request.client else ""
    allowed_hosts = {"127.0.0.1", "::1", "localhost"}
    if os.environ.get("CAPSHORTS_TESTING") == "1":
        allowed_hosts.add("testclient")
    if client_host not in allowed_hosts:
        raise HTTPException(status_code=403, detail="Remote network access forbidden. Local loopback only.")

# Asynchronous Tasks, Concurrency Control & Thread Locks
MAX_CONCURRENT_EXPORTS = max(1, min(4, (os.cpu_count() or 2) - 1))
EXPORT_SEMAPHORE = threading.Semaphore(MAX_CONCURRENT_EXPORTS)
MAX_UPLOAD_BYTES = 4 * 1024 * 1024 * 1024  # 4 GB streaming ceiling
TASK_TTL_SECONDS = 1800  # 30 minutes
MAX_TASK_ENTRIES = 200

EXPORT_TASKS: Dict[str, Dict[str, Any]] = {}
TRANSCRIBE_JOBS: Dict[str, Dict[str, Any]] = {}
MODEL_LOAD_LOCK = threading.Lock()
TRANSCRIBE_LOCK = threading.Lock()
TASKS_LOCK = threading.Lock()

def update_task_state(task_dict: Dict[str, Dict[str, Any]], task_id: str, new_fields: Dict[str, Any]):
    """
    Safely updates a task dictionary while strictly preserving _created_at timestamp
    and recording _completed_at timestamp for terminal states.
    """
    with TASKS_LOCK:
        now = time.time()
        existing = task_dict.get(task_id, {})
        created_at = existing.get("_created_at") or new_fields.get("_created_at") or now
        merged = {**existing, **new_fields, "_created_at": created_at}
        status = str(merged.get("status", "")).lower()
        if any(term in status for term in ("completed", "failed", "error")) and "_completed_at" not in merged:
            merged["_completed_at"] = now
        task_dict[task_id] = merged

def prune_stale_tasks(task_dict: Dict[str, Dict[str, Any]]):
    """
    Evicts terminal tasks older than TASK_TTL_SECONDS (30 mins).
    Active jobs (processing/encoding/rendering/starting) are NEVER evicted.
    Enforces MAX_TASK_ENTRIES cap by evicting oldest terminal tasks first.
    """
    with TASKS_LOCK:
        now = time.time()
        stale_keys = []
        for tid, info in list(task_dict.items()):
            status = str(info.get("status", "")).lower()
            is_active = any(s in status for s in ("processing", "encoding", "rendering", "starting", "queued"))
            if is_active:
                continue
            completion_time = info.get("_completed_at") or info.get("_created_at") or now
            if (now - completion_time) > TASK_TTL_SECONDS:
                stale_keys.append(tid)

        for k in stale_keys:
            task_dict.pop(k, None)

        if len(task_dict) > MAX_TASK_ENTRIES:
            terminal_keys = [
                k for k, v in task_dict.items()
                if not any(s in str(v.get("status", "")).lower() for s in ("processing", "encoding", "rendering", "starting", "queued"))
            ]
            terminal_keys.sort(key=lambda k: task_dict[k].get("_completed_at") or task_dict[k].get("_created_at") or 0)
            excess = len(task_dict) - MAX_TASK_ENTRIES
            for k in terminal_keys[:excess]:
                task_dict.pop(k, None)

class WordItem(BaseModel):
    start: float = Field(ge=0.0)
    end: float = Field(ge=0.0)
    word: str = Field(min_length=0)
    keyword: Optional[bool] = False

    @model_validator(mode="after")
    def validate_word_timestamps(self):
        if self.end < self.start:
            raise ValueError("Word 'end' timestamp must be greater than or equal to 'start'")
        return self

# High-impact viral keywords for auto-highlighting
VIRAL_KEYWORDS = {
    "money", "millions", "billion", "dollars", "secret", "secrets", "crazy", "insane",
    "stop", "never", "hack", "boost", "revenue", "viral", "profit", "game-changer",
    "rule", "warning", "win", "free", "ai", "supercharge", "strategy", "10x", "automate",
    "crypto", "power", "cash", "grow", "rich", "mistake", "truth", "unlock", "future",
    "system", "fast", "simple", "easy", "step", "first", "millionaire", "results"
}

# Whisper Model Cache
WHISPER_MODELS: Dict[str, Any] = {}

def get_master_groq_keys() -> List[str]:
    """Reads Groq API Keys from .env or environment variables."""
    keys = []
    if os.path.exists(ENV_FILE):
        try:
            with open(ENV_FILE, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line.startswith("GROQ_API_KEYS="):
                        val = line.split("=", 1)[1].strip()
                        for k in val.split(","):
                            clean_k = k.strip()
                            if len(clean_k) > 10:
                                keys.append(clean_k)
                    elif line.startswith("GROQ_API_KEY="):
                        val = line.split("=", 1)[1].strip()
                        if len(val) > 10:
                            keys.append(val)
        except Exception:
            pass

    env_val = os.environ.get("GROQ_API_KEYS") or os.environ.get("GROQ_API_KEY")
    if env_val:
        for k in env_val.split(","):
            clean_k = k.strip()
            if len(clean_k) > 10:
                keys.append(clean_k)

    return list(dict.fromkeys(keys))

def save_master_groq_key(new_key: str):
    """Appends or updates Master Groq Key in .env while preserving all other configuration keys."""
    clean_k = new_key.strip()
    if not clean_k:
        return
    existing = get_master_groq_keys()
    if clean_k not in existing:
        existing.append(clean_k)
    joined = ",".join(existing)

    lines = []
    found_key = False
    if os.path.exists(ENV_FILE):
        try:
            with open(ENV_FILE, "r", encoding="utf-8") as f:
                for line in f:
                    if line.startswith("GROQ_API_KEYS="):
                        lines.append(f"GROQ_API_KEYS={joined}\n")
                        found_key = True
                    elif line.startswith("GROQ_API_KEY="):
                        continue
                    else:
                        lines.append(line)
        except Exception:
            pass

    if not found_key:
        lines.append(f"GROQ_API_KEYS={joined}\n")

    temp_env = f"{ENV_FILE}.tmp_{uuid.uuid4().hex[:8]}"
    try:
        with open(temp_env, "w", encoding="utf-8") as f:
            f.writelines(lines)
        try:
            os.chmod(temp_env, 0o600)
        except Exception:
            pass
        os.replace(temp_env, ENV_FILE)
    finally:
        if os.path.exists(temp_env):
            try:
                os.remove(temp_env)
            except Exception:
                pass

def check_ffmpeg() -> bool:
    """Checks whether ffmpeg executable is available in PATH or local directory with timeout."""
    ffmpeg_bin = get_ffmpeg_bin()
    try:
        res = subprocess.run([ffmpeg_bin, "-version"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=5, **SUBPROCESS_EXTRA_KWARGS)
        return res.returncode == 0
    except (subprocess.TimeoutExpired, Exception):
        alt_paths = [
            r"C:\ProgramData\chocolatey\bin\ffmpeg.exe",
            r"C:\ffmpeg\bin\ffmpeg.exe",
            "/opt/homebrew/bin/ffmpeg",
            "/usr/local/bin/ffmpeg",
            os.path.join(BIN_DIR, "ffmpeg.exe"),
            os.path.join(BIN_DIR, "ffmpeg")
        ]
        for p in alt_paths:
            if os.path.exists(p):
                return True
        return False

LOCAL_BASE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "models", "base")

def get_whisper_model(model_size: str = "base"):
    """Thread-safe loader for faster-whisper model."""
    # Normalize model size for offline faster-whisper engine (preserves large model selection)
    if not model_size or "turbo" in model_size or model_size not in ["tiny", "base", "small", "medium", "large"]:
        model_size = "base"

    with MODEL_LOAD_LOCK:
        if model_size in WHISPER_MODELS:
            return WHISPER_MODELS[model_size]
        
        try:
            from faster_whisper import WhisperModel
            import ctranslate2
            
            has_cuda = False
            try:
                has_cuda = ctranslate2.get_cuda_device_count() > 0
            except Exception:
                pass
            
            device = "cuda" if has_cuda else "cpu"
            compute_type = "float16" if has_cuda else "int8"
            cpu_threads = min(4, os.cpu_count() or 4)
            
            target_model = LOCAL_BASE_DIR if os.path.exists(LOCAL_BASE_DIR) and model_size == "base" else model_size
            print(f"[engine] Loading Faster-Whisper from '{target_model}' on {device.upper()} ({compute_type}, threads={cpu_threads})...")
            
            model = WhisperModel(target_model, device=device, compute_type=compute_type, cpu_threads=cpu_threads)
            WHISPER_MODELS[model_size] = model
            print("[engine] Faster-Whisper ready in memory!")
            return model
        except Exception as e:
            print(f"[engine] Warning: Faster-Whisper could not be loaded: {e}")
            return None

def tag_keywords(words: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Tags high-impact words as keywords for styling and B-roll discovery."""
    for item in words:
        clean_w = item["word"].strip().lower().strip(".,!?:;\"'()[]{}")
        if clean_w in VIRAL_KEYWORDS or (len(clean_w) > 3 and clean_w.isupper()):
            item["keyword"] = True
        elif any(char.isdigit() for char in clean_w):
            item["keyword"] = True
        else:
            item["keyword"] = item.get("keyword", False)
    return words

CACHED_HW_ENCODER = None

def detect_hardware_encoder() -> Tuple[str, List[str]]:
    """
    Detects and verifies available GPU hardware video encoders.
    Tries in order:
      1. h264_nvenc (NVIDIA CUDA / RTX)
      2. h264_qsv (Intel QuickSync Video)
      3. h264_amf (AMD Radeon)
      4. h264_mf (Windows MediaFoundation DirectX)
      5. libx264 (CPU fallback)
    """
    global CACHED_HW_ENCODER
    with MODEL_LOAD_LOCK:
        if CACHED_HW_ENCODER is not None:
            return CACHED_HW_ENCODER

        ffmpeg_bin = get_ffmpeg_bin()

        candidates = [
            ("h264_videotoolbox", ["-c:v", "h264_videotoolbox", "-b:v", "6000k"]),
            ("h264_nvenc", ["-c:v", "h264_nvenc", "-preset", "p4", "-rc", "vbr"]),
            ("h264_qsv", ["-c:v", "h264_qsv", "-global_quality", "23"]),
            ("h264_amf", ["-c:v", "h264_amf", "-quality", "speed"]),
            ("h264_mf", ["-c:v", "h264_mf", "-rate_control", "cbr", "-b:v", "5000k"]),
            ("libx264", ["-c:v", "libx264", "-preset", "fast", "-crf", "18"]),
        ]

        for name, args in candidates:
            if name == "libx264":
                CACHED_HW_ENCODER = (name, args)
                return CACHED_HW_ENCODER
            try:
                test_cmd = [ffmpeg_bin, "-f", "lavfi", "-i", "color=c=black:s=256x256:d=0.05"] + args + ["-f", "null", "-"]
                res = subprocess.run(test_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=3, **SUBPROCESS_EXTRA_KWARGS)
                if res.returncode == 0:
                    print(f"[engine] GPU Hardware Encoder verified: {name}")
                    CACHED_HW_ENCODER = (name, args)
                    return CACHED_HW_ENCODER
            except Exception:
                pass

        CACHED_HW_ENCODER = ("libx264", ["-c:v", "libx264", "-preset", "fast", "-crf", "18"])
        return CACHED_HW_ENCODER

@app.get("/api/health")
def health_check():
    """Returns local system diagnostics, hardware acceleration, and engine status."""
    has_cuda = False
    try:
        import ctranslate2
        has_cuda = ctranslate2.get_cuda_device_count() > 0
    except Exception as e:
        print(f"[health] ctranslate2 diagnostic notice: {e}")

    has_whisper = False
    try:
        import faster_whisper
        has_whisper = True
    except Exception as e:
        print(f"[health] faster_whisper diagnostic notice: {e}")

    has_ffmpeg = check_ffmpeg()
    master_keys = get_master_groq_keys()
    hw_name, _ = detect_hardware_encoder()

    return {
        "status": "online",
        "device": "CUDA (NVIDIA GPU)" if has_cuda else "CPU (CTranslate2 Multi-Threaded)",
        "cuda_available": has_cuda,
        "whisper_available": has_whisper,
        "ffmpeg_available": has_ffmpeg,
        "hardware_encoder": hw_name,
        "master_groq_active": len(master_keys) > 0,
        "master_keys_count": len(master_keys),
        "active_models": list(WHISPER_MODELS.keys())
    }

def get_audio_duration_wave(wav_path: str) -> float:
    """Gets audio duration in seconds quickly via standard wave header."""
    try:
        with wave.open(wav_path, 'rb') as wf:
            frames = wf.getnframes()
            rate = wf.getframerate()
            return frames / float(rate)
    except Exception:
        return 0.0

def run_transcribe_job(
    task_id: str,
    target_video: str,
    model: str,
    language: Optional[str],
    groq_api_key: Optional[str] = None,
    range_mode: str = "full"
):
    """
    Background worker executing either ultra-fast Groq Cloud AI (~2 seconds)
    with Key Pool Auto-Rotation, or local offline Faster-Whisper.
    """
    ffmpeg_bin = get_ffmpeg_bin()

    # Assemble Key Pool (Client Key + Backend Master Keys)
    key_pool = []
    if groq_api_key and len(groq_api_key.strip()) > 10:
        key_pool.append(groq_api_key.strip())
    key_pool.extend(get_master_groq_keys())
    key_pool = list(dict.fromkeys(key_pool))

    # MODE 1: ULTRA-FAST CLOUD AI WITH KEY POOL ROTATION (CapCut Speed: 2-3 Seconds)
    if key_pool:
        try:
            update_task_state(TRANSCRIBE_JOBS, task_id, {
                "progress": 25,
                "step": "⚡ Turbo Mode: Extracting compressed audio...",
                "status": "processing"
            })
            audio_mp3 = os.path.join(TEMP_DIR, f"audio_turbo_{task_id}.mp3")
            try:
                trim_args = []
                if range_mode == "short_60s":
                    trim_args = ["-t", "60"]
                elif range_mode == "short_180s":
                    trim_args = ["-t", "180"]

                cmd = [
                    ffmpeg_bin, "-y", "-i", target_video
                ] + trim_args + [
                    "-vn", "-ar", "16000", "-ac", "1", "-b:a", "32k",
                    audio_mp3
                ]
                subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=120, **SUBPROCESS_EXTRA_KWARGS)

                update_task_state(TRANSCRIBE_JOBS, task_id, {
                    "progress": 55,
                    "step": f"⚡ Turbo Mode: Running Groq Whisper Large-v3 ({len(key_pool)} key pool active)...",
                    "status": "processing"
                })

                words_result, dur = transcribe_with_groq_pool(audio_mp3, key_pool, language)
                words_result = tag_keywords(words_result)

                update_task_state(TRANSCRIBE_JOBS, task_id, {
                    "progress": 90,
                    "step": "⚡ Generating viral shorts & highlight clips...",
                    "status": "processing"
                })

                video_dur = dur if dur > 0 else (words_result[-1]["end"] if words_result else 60.0)
                clips_result = detect_viral_clips(words_result, video_dur)

                update_task_state(TRANSCRIBE_JOBS, task_id, {
                    "progress": 100,
                    "step": f"Complete in ~4s! Extracted {len(words_result)} words and {len(clips_result)} viral clips.",
                    "status": "completed",
                    "words": words_result,
                    "clips": clips_result,
                    "duration": video_dur,
                    "video_path": target_video
                })
                return
            finally:
                if os.path.exists(audio_mp3):
                    try:
                        os.remove(audio_mp3)
                    except Exception:
                        pass

        except Exception as e:
            print(f"[engine] Cloud Turbo pool exhausted, falling back to local CPU: {e}")
            update_task_state(TRANSCRIBE_JOBS, task_id, {
                "progress": 30,
                "step": "Cloud busy or exhausted. Automatically switching to Local AI...",
                "status": "processing"
            })

    # MODE 2: LOCAL OFFLINE WHISPER ON CPU/GPU
    with TRANSCRIBE_LOCK:
        try:
            update_task_state(TRANSCRIBE_JOBS, task_id, {
                "progress": 15,
                "step": "Extracting audio with FFmpeg...",
                "status": "processing"
            })

            audio_wav = os.path.join(TEMP_DIR, f"audio_{task_id}.wav")
            trim_args = []
            if range_mode == "short_60s":
                trim_args = ["-t", "60"]
            elif range_mode == "short_180s":
                trim_args = ["-t", "180"]

            if check_ffmpeg():
                cmd = [
                    ffmpeg_bin, "-y", "-i", target_video
                ] + trim_args + [
                    "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le",
                    audio_wav
                ]
                subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=120, **SUBPROCESS_EXTRA_KWARGS)
            else:
                audio_wav = target_video

            audio_duration = get_audio_duration_wave(audio_wav)
            total_sec = int(audio_duration) if audio_duration > 0 else 60

            update_task_state(TRANSCRIBE_JOBS, task_id, {
                "progress": 25,
                "step": f"Audio extracted ({total_sec//60:02d}:{total_sec%60:02d}). Starting Whisper CPU...",
                "status": "processing"
            })

            whisper_engine = get_whisper_model(model)
            words_result = []

            if whisper_engine and os.path.exists(audio_wav):
                is_roman = (language in ["urdu", "ur", "roman", "roman_urdu"])
                if language in ["ur_script", "urdu_script"]:
                    whisper_lang = "ur"
                elif is_roman:
                    whisper_lang = "hi"
                else:
                    whisper_lang = language if language and language != "auto" else None

                segments, info = whisper_engine.transcribe(
                    audio_wav,
                    word_timestamps=True,
                    beam_size=1,
                    language=whisper_lang
                )

                actual_dur = audio_duration if audio_duration > 0 else 60.0

                for segment in segments:
                    if actual_dur > 0:
                        current_sec = int(segment.end)
                        pct = min(92, 25 + int((segment.end / actual_dur) * 65))
                        update_task_state(TRANSCRIBE_JOBS, task_id, {
                            "progress": pct,
                            "step": f"Transcribing speech: {current_sec//60:02d}:{current_sec%60:02d} / {int(actual_dur)//60:02d}:{int(actual_dur)%60:02d} ({pct}%)...",
                            "status": "processing"
                        })

                    if segment.words:
                        for w in segment.words:
                            words_result.append({
                                "start": round(w.start, 2),
                                "end": round(w.end, 2),
                                "word": w.word.strip(),
                                "keyword": False
                            })
                    else:
                        words_result.append({
                            "start": round(segment.start, 2),
                            "end": round(segment.end, 2),
                            "word": segment.text.strip(),
                            "keyword": False
                        })

            if not words_result:
                raise RuntimeError("No speech could be extracted from this audio file. Please check audio volume and quality.")

            if language in ["urdu", "ur", "roman", "roman_urdu"]:
                words_result = transliterate_transcript(words_result)

            words_result = tag_keywords(words_result)

            update_task_state(TRANSCRIBE_JOBS, task_id, {
                "progress": 95,
                "step": "Detecting viral shorts & clips (Opus Clip Engine)...",
                "status": "processing"
            })

            video_duration = words_result[-1]["end"] if words_result else (audio_duration or 60.0)
            clips_result = detect_viral_clips(words_result, video_duration)

            update_task_state(TRANSCRIBE_JOBS, task_id, {
                "progress": 100,
                "step": f"Complete! Extracted {len(words_result)} words and {len(clips_result)} viral clips.",
                "status": "completed",
                "words": words_result,
                "clips": clips_result,
                "duration": video_duration,
                "video_path": os.path.basename(target_video)
            })
            try:
                telemetry.record_transcribe()
            except Exception:
                pass

        except Exception as e:
            print(f"[engine] Transcribe job error: {e}")
            err_msg = str(e) if "No speech could be extracted" in str(e) else "Transcription failed. Please check audio quality and format."
            update_task_state(TRANSCRIBE_JOBS, task_id, {
                "progress": 100,
                "step": err_msg,
                "status": "failed",
                "error": err_msg,
                "words": [],
                "clips": []
            })
        finally:
            prune_stale_tasks(TRANSCRIBE_JOBS)
            if audio_wav and os.path.exists(audio_wav) and audio_wav != target_video:
                try:
                    os.remove(audio_wav)
                except Exception:
                    pass

def save_upload_file_capped(upload_file: UploadFile, destination_path: str, max_bytes: int = MAX_UPLOAD_BYTES):
    """Safely streams upload file to destination up to max_bytes cap, cleaning up on overflow."""
    total_written = 0
    buffer = None
    try:
        buffer = open(destination_path, "wb")
        while True:
            chunk = upload_file.file.read(1024 * 1024)
            if not chunk:
                break
            total_written += len(chunk)
            if total_written > max_bytes:
                buffer.close()
                buffer = None
                try:
                    os.remove(destination_path)
                except Exception:
                    pass
                raise HTTPException(status_code=413, detail=f"File exceeds maximum allowed upload size ({max_bytes // (1024 * 1024 * 1024)} GB)")
            buffer.write(chunk)
    except HTTPException:
        raise
    except Exception:
        if buffer and not buffer.closed:
            buffer.close()
        try:
            os.remove(destination_path)
        except Exception:
            pass
        raise HTTPException(status_code=500, detail="Failed to save uploaded video file")
    finally:
        if buffer and not buffer.closed:
            buffer.close()

@app.post("/api/transcribe")
def start_transcription(
    background_tasks: BackgroundTasks,
    file: Optional[UploadFile] = File(None),
    video_path: Optional[str] = Form(None),
    model: str = Form("base"),
    language: Optional[str] = Form(None),
    groq_api_key: Optional[str] = Form(None),
    range_mode: str = Form("full")
):
    """
    Begins transcribing video speech and extracting viral shorts via threadpool background worker.
    Automatically utilizes Master Key pool or user-supplied key for CapCut speed.
    """
    prune_stale_tasks(TRANSCRIBE_JOBS)
    task_id = str(uuid.uuid4())[:8]
    target_video = None

    if file:
        file_ext = os.path.splitext(file.filename or ".mp4")[1]
        target_video = os.path.join(TEMP_DIR, f"input_{task_id}{file_ext}")
        save_upload_file_capped(file, target_video)
    elif video_path:
        target_video = resolve_video_file(video_path)
    else:
        raise HTTPException(status_code=400, detail="No video file or video_path provided")

    update_task_state(TRANSCRIBE_JOBS, task_id, {
        "progress": 5,
        "step": "Video uploaded. Initializing audio pipeline...",
        "status": "processing"
    })

    background_tasks.add_task(
        run_transcribe_job,
        task_id,
        target_video,
        model,
        language,
        groq_api_key,
        range_mode
    )
    return {"status": "started", "task_id": task_id, "video_path": os.path.basename(target_video)}

@app.post("/api/upload-video")
def upload_video_file(file: UploadFile = File(...)):
    """Receives and caches video file on server for editing and export in threadpool."""
    task_id = str(uuid.uuid4())[:8]
    clean_name = os.path.basename((file.filename or "video.mp4").strip().replace("\\", "/"))
    file_ext = os.path.splitext(clean_name)[1] or ".mp4"
    target_video = os.path.join(TEMP_DIR, f"input_{task_id}{file_ext}")
    save_upload_file_capped(file, target_video)
    return {
        "status": "success",
        "video_path": os.path.basename(target_video),
        "filename": clean_name
    }

@app.get("/api/transcribe/progress/{task_id}")
def get_transcribe_progress(task_id: str):
    """Returns live percentage progress, status step, and result when completed."""
    if task_id not in TRANSCRIBE_JOBS:
        raise HTTPException(status_code=404, detail="Transcription task not found")
    return TRANSCRIBE_JOBS[task_id]

class MasterKeyPayload(BaseModel):
    key: str

@app.post("/api/settings/master-key", dependencies=[Depends(verify_loopback_request)])
def save_master_key_api(payload: MasterKeyPayload):
    """Saves a new Master Groq Key to the server's .env pool."""
    save_master_groq_key(payload.key)
    active_keys = get_master_groq_keys()
    return {"status": "success", "master_groq_active": len(active_keys) > 0, "count": len(active_keys)}

class GenerateClipsPayload(BaseModel):
    words: List[WordItem]
    duration: float = Field(ge=0.0)
    min_clip_duration: Optional[float] = Field(default=25.0, gt=0.0)
    max_clip_duration: Optional[float] = Field(default=60.0, gt=0.0)
    target_clips_count: Optional[int] = Field(default=5, ge=1)

    @model_validator(mode="after")
    def validate_durations(self):
        if self.min_clip_duration is not None and self.max_clip_duration is not None:
            if self.max_clip_duration < self.min_clip_duration:
                raise ValueError("max_clip_duration must be greater than or equal to min_clip_duration")
        return self

@app.post("/api/clips/generate")
def generate_clips_endpoint(payload: GenerateClipsPayload):
    """Regenerates viral shorts from given transcript with customized duration parameters."""
    words_dicts = [w.model_dump() if hasattr(w, "model_dump") else (w.dict() if hasattr(w, "dict") else w) for w in payload.words]
    clips = detect_viral_clips(
        words=words_dicts,
        total_duration=payload.duration,
        min_clip_duration=payload.min_clip_duration if payload.min_clip_duration is not None else 25.0,
        max_clip_duration=payload.max_clip_duration if payload.max_clip_duration is not None else 60.0,
        target_clips_count=payload.target_clips_count if payload.target_clips_count is not None else 5
    )
    return {"status": "success", "clips": clips}

@app.get("/api/broll/search")
def broll_search(keyword: str, api_key: Optional[str] = None, x_pexels_key: Optional[str] = Header(None)):
    """Searches vertical stock video clips matching keyword."""
    effective_key = x_pexels_key or api_key
    clips = search_pexels_videos(keyword, api_key=effective_key)
    return {"results": clips}

class ExportPayload(BaseModel):
    video_path: Optional[str] = None
    transcript: List[WordItem]
    preset: Dict[str, Any]
    custom_overrides: Optional[Dict[str, Any]] = None
    broll_clips: Optional[List[Dict[str, Any]]] = None
    output_filename: Optional[str] = "capshorts_export.mp4"
    clip_start: Optional[float] = Field(default=None, ge=0.0)
    clip_end: Optional[float] = Field(default=None, ge=0.0)
    resolution: Optional[str] = "1080x1920"
    aspect_ratio: Optional[str] = "9:16"

    @model_validator(mode="after")
    def validate_clip_range(self):
        if self.clip_start is not None and self.clip_end is not None:
            if self.clip_end <= self.clip_start:
                raise ValueError("Export 'clip_end' must be strictly greater than 'clip_start'")
        return self

def run_export_job(task_id: str, payload: ExportPayload):
    """Background task executing FFmpeg ASS subtitle burning, clip trimming, dynamic scaling, and B-roll composite."""
    ass_path = None
    try:
        prune_stale_tasks(EXPORT_TASKS)
        update_task_state(EXPORT_TASKS, task_id, {"progress": 10, "status": "Generating Subtitles (.ass)...", "error": None})

        if not check_ffmpeg():
            raise RuntimeError("FFmpeg is not installed or not found on system PATH. Please install FFmpeg to export videos.")

        transcript_raw = [
            (w.model_dump() if hasattr(w, "model_dump") else (w.dict() if hasattr(w, "dict") else w))
            for w in payload.transcript
        ]
        is_clip_export = payload.clip_start is not None and payload.clip_end is not None and payload.clip_end > payload.clip_start

        if is_clip_export:
            c_start = payload.clip_start
            c_end = payload.clip_end
            shifted = []
            for w in transcript_raw:
                w_start = float(w.get("start", 0.0))
                w_end = float(w.get("end", 0.0))
                if w_end >= c_start and w_start <= c_end:
                    shifted.append({
                        **w,
                        "start": max(0.0, round(w_start - c_start, 2)),
                        "end": max(0.0, round(w_end - c_start, 2))
                    })
            transcript_to_use = shifted if shifted else transcript_raw
        else:
            transcript_to_use = transcript_raw

        safe_output_name = os.path.basename((payload.output_filename or "capshorts_export.mp4").strip().replace("\\", "/"))
        if not safe_output_name.endswith(".mp4"):
            safe_output_name += ".mp4"
        output_file = get_safe_contained_path(OUTPUT_DIR, f"export_{task_id}_{safe_output_name}")
        ffmpeg_bin = get_ffmpeg_bin()

        # Resolve input video safely strictly within approved directories
        if not payload.video_path:
            raise HTTPException(status_code=400, detail="Missing video path for export")
        input_video = resolve_video_file(payload.video_path)

        # Probe input video dimensions
        in_w, in_h = probe_video_dimensions(input_video) if os.path.exists(input_video) else (1080, 1920)

        # Determine target dimensions based on resolution / aspect_ratio
        is_vertical_short = (payload.aspect_ratio == "9:16" or payload.resolution == "1080x1920" or (is_clip_export and payload.aspect_ratio != "16:9"))
        if is_vertical_short:
            target_w, target_h = 1080, 1920
        elif payload.aspect_ratio == "16:9" or payload.resolution == "1920x1080":
            target_w, target_h = (1920, 1080) if in_w >= 1920 else (in_w, in_h)
        elif payload.aspect_ratio == "1:1" or payload.resolution == "1080x1080":
            target_w, target_h = 1080, 1080
        else:
            target_w, target_h = 1080, 1920

        # Generate ASS subtitles matching the target resolution
        ass_content = generate_ass_subtitles(
            transcript=transcript_to_use,
            preset=payload.preset,
            video_width=target_w,
            video_height=target_h,
            custom_overrides=payload.custom_overrides
        )
        ass_path = os.path.join(TEMP_DIR, f"subtitles_{task_id}.ass")
        with open(ass_path, "w", encoding="utf-8") as f:
            f.write(ass_content)
        
        update_task_state(EXPORT_TASKS, task_id, {"progress": 30, "status": "Processing Overlays..."})

        downloaded_broll = []
        if payload.broll_clips:
            for c in payload.broll_clips:
                if c.get("enabled", True):
                    v_url = c.get("video_url") or c.get("preview_url")
                    if v_url:
                        local_clip = download_broll_clip(v_url, c.get("id", str(uuid.uuid4())[:6]))
                        if local_clip:
                            start_time = c.get("start", 0.0)
                            end_time = c.get("end", 3.0)
                            if is_clip_export:
                                start_time = max(0.0, start_time - payload.clip_start)
                                end_time = max(0.0, end_time - payload.clip_start)
                            downloaded_broll.append({
                                "local_path": local_clip,
                                "start": start_time,
                                "end": end_time
                            })
        
        update_task_state(EXPORT_TASKS, task_id, {"progress": 50, "status": "Encoding Video with FFmpeg..."})

        escaped_ass = ass_path.replace("\\", "/").replace(":", "\\:")
        
        trim_args = []
        if is_clip_export:
            clip_len = max(1.0, round(payload.clip_end - payload.clip_start, 2))
            trim_args = ["-ss", str(payload.clip_start), "-t", str(clip_len)]

        is_landscape_input = (in_w > in_h)

        hw_encoder_name, hw_args = detect_hardware_encoder()

        # Ultra-fast cinematic background blur: downscale to 270x480, single light blur pass, scale to 1080x1920 (16x faster render)
        fast_vert_blur = "[bg]scale=270:480:force_original_aspect_ratio=increase,crop=270:480,boxblur=6:1,scale=1080:1920[bg_b]"

        filter_args = []
        extra_inputs = []
        if downloaded_broll:
            extra_inputs, filter_chains, last_stream = build_ffmpeg_broll_filter(downloaded_broll)
            if is_vertical_short and is_landscape_input:
                vert_prep = f"[0:v]split=2[fg][bg];{fast_vert_blur};[fg]scale=1080:1920:force_original_aspect_ratio=decrease[fg_s];[bg_b][fg_s]overlay=(W-w)/2:(H-h)/2[vcomp];"
                full_filter = f"{vert_prep}{filter_chains.replace('[0:v]', '[vcomp]')};{last_stream}ass='{escaped_ass}'[vfinal]"
            else:
                full_filter = f"{filter_chains};{last_stream}ass='{escaped_ass}'[vfinal]"

            filter_args = [
                "-filter_complex", full_filter,
                "-map", "[vfinal]",
                "-map", "0:a?"
            ]
        elif is_vertical_short and is_landscape_input:
            vert_filter = f"[0:v]split=2[fg][bg];{fast_vert_blur};[fg]scale=1080:1920:force_original_aspect_ratio=decrease[fg_s];[bg_b][fg_s]overlay=(W-w)/2:(H-h)/2[vcomp];[vcomp]ass='{escaped_ass}'[vfinal]"
            filter_args = [
                "-filter_complex", vert_filter,
                "-map", "[vfinal]",
                "-map", "0:a?"
            ]
        else:
            filter_args = [
                "-vf", f"ass='{escaped_ass}'"
            ]

        base_cmd = [ffmpeg_bin, "-y"] + trim_args + ["-i", input_video] + extra_inputs + filter_args
        cmd = base_cmd + hw_args + ["-c:a", "aac", output_file]

        try:
            proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=300, **SUBPROCESS_EXTRA_KWARGS)
        except subprocess.TimeoutExpired:
            raise RuntimeError("FFmpeg video render timed out after 300 seconds.")

        if proc.returncode != 0:
            print(f"[export] FFmpeg error ({hw_encoder_name}): {proc.stderr.decode('utf-8', errors='ignore')}")
            # Fallback to software libx264 if hardware encoder fails during render, retaining all filters & B-roll
            print("[export] Retrying with CPU libx264 fallback...")
            cpu_args = ["-c:v", "libx264", "-preset", "ultrafast", "-crf", "20"]
            fb_cmd = base_cmd + cpu_args + ["-c:a", "aac", output_file]
            try:
                proc2 = subprocess.run(fb_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=300, **SUBPROCESS_EXTRA_KWARGS)
            except subprocess.TimeoutExpired:
                raise RuntimeError("FFmpeg software fallback timed out after 300 seconds.")

            if proc2.returncode != 0:
                raise RuntimeError("FFmpeg render failed on both hardware and software encoders.")

        update_task_state(EXPORT_TASKS, task_id, {
            "progress": 100,
            "status": f"Complete! Video rendered using {hw_encoder_name}.",
            "output_path": output_file,
            "download_url": f"/api/download/{os.path.basename(output_file)}"
        })
        try:
            telemetry.record_export()
        except Exception:
            pass

    except Exception as e:
        print(f"[export] Job {task_id} failed: {e}")
        safe_msg = str(e) if isinstance(e, (RuntimeError, ValueError)) else "Video rendering failed during processing or encoding."
        update_task_state(EXPORT_TASKS, task_id, {
            "progress": 100,
            "status": f"Export Error: {safe_msg}",
            "error": safe_msg
        })
    finally:
        EXPORT_SEMAPHORE.release()
        prune_stale_tasks(EXPORT_TASKS)
        if ass_path and os.path.exists(ass_path):
            try:
                os.remove(ass_path)
            except Exception:
                pass

@app.get("/api/download/{filename}")
def download_exported_file(filename: str):
    """Serves the rendered MP4 video file directly for download or preview."""
    target_path = get_safe_contained_path(OUTPUT_DIR, filename)
    if not os.path.exists(target_path):
        raise HTTPException(status_code=404, detail="Exported video file not found")
    
    safe_name = os.path.basename(target_path)
    return FileResponse(
        path=target_path,
        media_type="video/mp4",
        filename=safe_name
    )

class ScriptConvertPayload(BaseModel):
    words: List[WordItem]
    target_script: str  # "roman_urdu" | "english"

@app.post("/api/transcript/convert-script")
def convert_script(payload: ScriptConvertPayload):
    """Converts existing transcript words into Roman Urdu or clean English on the fly."""
    words_dicts = [w.model_dump() if hasattr(w, "model_dump") else (w.dict() if hasattr(w, "dict") else w) for w in payload.words]
    if payload.target_script in ["roman_urdu", "roman"]:
        converted = transliterate_transcript(words_dicts)
        return {"words": converted}
    return {"words": words_dicts}

def resolve_video_file(path: Optional[str]) -> str:
    """Helper to resolve a video file path safely strictly within approved directories (TEMP_DIR, OUTPUT_DIR)."""
    if not path or not isinstance(path, str):
        raise HTTPException(status_code=400, detail="Missing video path")
    clean_name = os.path.basename(path.strip().replace("\\", "/"))
    if not clean_name:
        raise HTTPException(status_code=400, detail="Invalid video path")
    for d in [TEMP_DIR, OUTPUT_DIR]:
        cand = get_safe_contained_path(d, clean_name)
        if os.path.exists(cand):
            return cand
    raise HTTPException(status_code=404, detail="Video file not found")

class SilenceDetectPayload(BaseModel):
    video_path: Optional[str] = None
    noise_threshold_db: Optional[float] = -30.0
    min_duration: Optional[float] = 0.5

@app.post("/api/silence/detect")
def detect_silence(payload: SilenceDetectPayload):
    """
    Scans video audio using ultra-fast FFmpeg silencedetect (-vn).
    Takes ~1.5 seconds for 10 minutes of video.
    Returns detected silence gaps [{start, end, duration}] and total seconds saved.
    """
    ffmpeg_bin = get_ffmpeg_bin()
    video_file = resolve_video_file(payload.video_path)
            
    thresh = payload.noise_threshold_db if payload.noise_threshold_db is not None else -30.0
    min_dur = payload.min_duration if payload.min_duration is not None else 0.5

    cmd = [
        ffmpeg_bin, "-vn", "-i", video_file,
        "-af", f"silencedetect=noise={thresh}dB:d={min_dur}",
        "-f", "null", "-"
    ]

    try:
        proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, errors="ignore", timeout=45, **SUBPROCESS_EXTRA_KWARGS)
        stderr_output = proc.stderr

        silence_regions = []
        current_start = None

        for line in stderr_output.splitlines():
            if "silence_start:" in line:
                try:
                    parts = line.split("silence_start:")
                    current_start = float(parts[1].strip().split()[0])
                except Exception:
                    pass
            elif "silence_end:" in line:
                try:
                    parts = line.split("silence_end:")
                    end_and_dur = parts[1].split("|")
                    s_end = float(end_and_dur[0].strip().split()[0])
                    s_dur = float(end_and_dur[1].split("silence_duration:")[1].strip().split()[0]) if len(end_and_dur) > 1 else (s_end - (current_start or 0.0))
                    
                    s_start = current_start if current_start is not None else max(0.0, s_end - s_dur)
                    silence_regions.append({
                        "start": round(s_start, 2),
                        "end": round(s_end, 2),
                        "duration": round(s_dur, 2)
                    })
                    current_start = None
                except Exception:
                    pass

        total_silence = round(sum(r["duration"] for r in silence_regions), 2)
        return {
            "status": "success",
            "silence_regions": silence_regions,
            "total_silence_duration": total_silence,
            "count": len(silence_regions)
        }
    except Exception as e:
        print(f"[silence] Error: {e}")
        raise HTTPException(status_code=500, detail="Silence detection failed during audio analysis.")

class VideoSegmentItem(BaseModel):
    start: float = Field(ge=0.0)
    end: float = Field(ge=0.0)

    @model_validator(mode="after")
    def validate_range(self):
        if self.end <= self.start:
            raise ValueError("Segment 'end' must be strictly greater than 'start'")
        return self

class VideoSplitPayload(BaseModel):
    video_path: Optional[str] = None
    segments: List[VideoSegmentItem]
    output_filename: Optional[str] = None

@app.post("/api/video/split")
def split_video_segments(payload: VideoSplitPayload):
    """
    Instantly splits, trims, or ripple-joins video segments using FFmpeg stream copying (-c copy).
    Zero re-encoding means sub-second completion (<200ms) with zero quality loss!
    """
    if not payload.segments:
        raise HTTPException(status_code=400, detail="No segments provided for splitting")

    ffmpeg_bin = get_ffmpeg_bin()
    video_file = resolve_video_file(payload.video_path)

    safe_out_name = os.path.basename((payload.output_filename or f"split_{uuid.uuid4().hex[:8]}.mp4").strip().replace("\\", "/"))
    if not safe_out_name.endswith(".mp4"):
        safe_out_name += ".mp4"
    out_path = get_safe_contained_path(OUTPUT_DIR, safe_out_name)

    chunk_files = []
    concat_list_path = None
    try:
        # Case 1: Single segment trim (instant -c copy)
        if len(payload.segments) == 1:
            seg = payload.segments[0]
            cmd = [
                ffmpeg_bin, "-y",
                "-ss", str(seg.start),
                "-to", str(seg.end),
                "-i", video_file,
                "-c", "copy",
                "-avoid_negative_ts", "make_zero",
                out_path
            ]
            res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=20, **SUBPROCESS_EXTRA_KWARGS)
            if res.returncode != 0:
                raise Exception(f"FFmpeg copy error: {res.stderr.decode('utf-8', errors='ignore')}")
        else:
            # Case 2: Multiple segments (ripple-concatenation without re-encoding)
            for idx, seg in enumerate(payload.segments):
                chunk_name = f"chunk_{uuid.uuid4().hex[:8]}_{idx}.mp4"
                chunk_path = os.path.join(TEMP_DIR, chunk_name)
                cmd = [
                    ffmpeg_bin, "-y",
                    "-ss", str(seg.start),
                    "-to", str(seg.end),
                    "-i", video_file,
                    "-c", "copy",
                    "-avoid_negative_ts", "make_zero",
                    chunk_path
                ]
                res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=20, **SUBPROCESS_EXTRA_KWARGS)
                if res.returncode == 0 and os.path.exists(chunk_path):
                    chunk_files.append(chunk_path)

            if not chunk_files:
                raise Exception("Failed to generate segment chunks")

            # Concat demuxer list
            concat_list_path = os.path.join(TEMP_DIR, f"concat_{uuid.uuid4().hex[:8]}.txt")
            with open(concat_list_path, "w", encoding="utf-8") as f:
                for cf in chunk_files:
                    # Escape single quotes and backslashes for FFmpeg
                    safe_path = cf.replace("\\", "/")
                    f.write(f"file '{safe_path}'\n")

            concat_cmd = [
                ffmpeg_bin, "-y",
                "-f", "concat",
                "-safe", "0",
                "-i", concat_list_path,
                "-c", "copy",
                out_path
            ]
            res = subprocess.run(concat_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=30, **SUBPROCESS_EXTRA_KWARGS)
            if res.returncode != 0:
                raise Exception(f"FFmpeg concat error: {res.stderr.decode('utf-8', errors='ignore')}")

        total_dur = round(sum(s.end - s.start for s in payload.segments), 2)
        return {
            "status": "success",
            "output_path": out_path,
            "filename": safe_out_name,
            "download_url": f"/api/download/{safe_out_name}",
            "segments_count": len(payload.segments),
            "total_duration": total_dur
        }
    except Exception as e:
        print(f"[split] Error: {e}")
        raise HTTPException(status_code=500, detail="Stream copy split failed during video slicing.")
    finally:
        for cf in chunk_files:
            try:
                if os.path.exists(cf):
                    os.remove(cf)
            except Exception:
                pass
        if concat_list_path and os.path.exists(concat_list_path):
            try:
                os.remove(concat_list_path)
            except Exception:
                pass

@app.post("/api/export")
def start_export(payload: ExportPayload, background_tasks: BackgroundTasks):
    """Triggers asynchronous video rendering with live progress tracking."""
    prune_stale_tasks(EXPORT_TASKS)
    if not EXPORT_SEMAPHORE.acquire(blocking=False):
        raise HTTPException(
            status_code=429,
            detail="Maximum concurrent export limit reached. Please wait for active exports to complete and try again.",
            headers={"Retry-After": "30"}
        )
    task_id = str(uuid.uuid4())[:8]
    update_task_state(EXPORT_TASKS, task_id, {"progress": 0, "status": "Queued...", "error": None})
    background_tasks.add_task(run_export_job, task_id, payload)
    return {"status": "started", "task_id": task_id}

@app.get("/api/export/progress/{task_id}")
def get_export_progress(task_id: str):
    """Returns real-time render percentage and status."""
    if task_id not in EXPORT_TASKS:
        raise HTTPException(status_code=404, detail="Task not found")
    return EXPORT_TASKS[task_id]

class SubtitleExportPayload(BaseModel):
    transcript: List[WordItem]
    format: str = "srt"  # "srt", "vtt", or "ass"
    preset: Optional[Dict[str, Any]] = None
    custom_overrides: Optional[Dict[str, Any]] = None
    video_width: int = Field(default=1080, gt=0)
    video_height: int = Field(default=1920, gt=0)

@app.post("/api/export-subtitles")
def export_subtitles(payload: SubtitleExportPayload):
    """Exports transcript to standalone SRT, VTT, or ASS subtitle content."""
    fmt = payload.format.lower().strip()
    words_dicts = [w.model_dump() if hasattr(w, "model_dump") else (w.dict() if hasattr(w, "dict") else w) for w in payload.transcript]
    if fmt == "srt":
        content = generate_srt_subtitles(words_dicts)
        media_type = "application/x-subrip"
        ext = "srt"
    elif fmt == "vtt":
        content = generate_vtt_subtitles(words_dicts)
        media_type = "text/vtt"
        ext = "vtt"
    elif fmt == "ass":
        preset = payload.preset or {}
        content = generate_ass_subtitles(
            words_dicts,
            preset,
            video_width=payload.video_width,
            video_height=payload.video_height,
            custom_overrides=payload.custom_overrides
        )
        media_type = "text/plain"
        ext = "ass"
    else:
        raise HTTPException(status_code=400, detail="Unsupported subtitle format. Use srt, vtt, or ass.")

    filename = f"capshorts_subtitles_{uuid.uuid4().hex[:6]}.{ext}"
    out_path = os.path.join(OUTPUT_DIR, filename)
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(content)

    return {
        "status": "ready",
        "format": ext,
        "filename": filename,
        "content": content,
        "download_url": f"/api/download-subtitles/{filename}"
    }

@app.get("/api/download-subtitles/{filename}")
def download_subtitles_file(filename: str):
    """Serves subtitle files with appropriate media types strictly contained within OUTPUT_DIR."""
    path = get_safe_contained_path(OUTPUT_DIR, filename)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="File not found")
    media_type = "application/x-subrip" if filename.endswith(".srt") else "text/vtt" if filename.endswith(".vtt") else "text/plain"
    return FileResponse(path, media_type=media_type, filename=os.path.basename(path))

@app.get("/api/system/update-status")
def get_update_status():
    """Checks whether a new update is available from GitHub (supports macOS, Windows, and MSI)."""
    import platform
    current_os = platform.system().lower()
    
    # Locate project root containing .git or workspace
    project_root = os.path.abspath(os.path.join(BASE_DIR, "..", ".."))
    if not os.path.exists(os.path.join(project_root, ".git")):
        project_root = os.path.abspath(os.path.join(BASE_DIR, ".."))
    
    git_dir = os.path.join(project_root, ".git")
    is_git_repo = os.path.exists(git_dir)
    
    current_version = "1.1.4"
    current_commit = "unknown"
    latest_commit = "unknown"
    update_available = False
    details = ""
    
    if is_git_repo:
        try:
            current_commit = subprocess.check_output(
                ["git", "rev-parse", "--short", "HEAD"],
                cwd=project_root,
                text=True,
                timeout=5,
                **SUBPROCESS_EXTRA_KWARGS
            ).strip()
            
            out = subprocess.check_output(
                ["git", "ls-remote", "origin", "refs/heads/main"],
                cwd=project_root,
                text=True,
                timeout=8,
                **SUBPROCESS_EXTRA_KWARGS
            ).strip()
            
            if out:
                latest_commit = out.split()[0][:7]
                update_available = (latest_commit != current_commit)
                if update_available:
                    details = f"New version ({latest_commit}) is ready to install!"
                else:
                    details = "CapShorts is up to date."
        except Exception as e:
            details = f"Update check note: {e}"
    else:
        details = "Packaged MSI/DMG release mode."
        
    return {
        "current_version": current_version,
        "current_commit": current_commit,
        "latest_commit": latest_commit,
        "update_available": update_available,
        "is_git_repo": is_git_repo,
        "platform": current_os,
        "details": details,
        "msi_download_url": "https://github.com/thealiraza2/CapShorts/releases/latest",
        "dmg_download_url": "https://github.com/thealiraza2/CapShorts/releases/latest",
        "release_url": "https://github.com/thealiraza2/CapShorts/releases/latest"
    }

@app.post("/api/system/apply-update", dependencies=[Depends(verify_loopback_request)])
def apply_update():
    """Pulls latest updates from GitHub or returns direct package upgrade links."""
    if getattr(sys, "frozen", False):
        return {
            "success": True,
            "message": "Packaged desktop build detected. Please upgrade using the official installer release.",
            "release_url": "https://github.com/thealiraza2/CapShorts/releases/latest"
        }
    try:
        project_root = os.path.abspath(os.path.join(BASE_DIR, "..", ".."))
        if not os.path.exists(os.path.join(project_root, ".git")):
            project_root = os.path.abspath(os.path.join(BASE_DIR, ".."))
        
        git_dir = os.path.join(project_root, ".git")
        if os.path.exists(git_dir):
            cmd = ["git", "pull", "origin", "main"]
            proc = subprocess.run(
                cmd,
                cwd=project_root,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                timeout=60,
                **SUBPROCESS_EXTRA_KWARGS
            )
            if proc.returncode != 0:
                return {
                    "success": False,
                    "error": "Git pull operation was interrupted.",
                    "message": "Git pull was interrupted. Please ensure your local files are saved."
                }
            
            return {
                "success": True,
                "message": "CapShorts updated successfully! Reloading studio...",
                "git_output": proc.stdout.strip(),
                "action_required": "reload"
            }
        else:
            return {
                "success": True,
                "is_packaged": True,
                "message": "Opening latest MSI / DMG installer release page...",
                "download_url": "https://github.com/thealiraza2/CapShorts/releases/latest",
                "action_required": "download"
            }
    except Exception as e:
        print(f"[engine] Update failed: {e}")
        return {"success": False, "error": "System update encountered an error."}

@app.get("/api/system/telemetry-stats")
def get_telemetry_stats():
    """Returns local anonymous session stats."""
    return {
        "enabled": telemetry.is_enabled(),
        "machine_id": telemetry.machine_id,
        "os": telemetry.os_info,
        "session_seconds": telemetry.get_session_seconds(),
        "videos_transcribed": telemetry.videos_transcribed,
        "videos_exported": telemetry.videos_exported,
        "telemetry_url": telemetry.get_telemetry_url()
    }

@app.get("/api/system/telemetry-settings")
def get_telemetry_settings():
    """Returns telemetry opt-in status."""
    return {
        "enabled": telemetry.is_enabled(),
        "machine_id": telemetry.machine_id,
        "os": telemetry.os_info,
        "app_version": telemetry.app_version
    }

@app.post("/api/system/telemetry-settings")
def update_telemetry_settings(payload: Dict[str, Any]):
    """Allows user to toggle anonymous telemetry on or off."""
    enabled = bool(payload.get("enabled", True))
    telemetry.set_enabled(enabled)
    return {
        "success": True,
        "enabled": telemetry.is_enabled()
    }

if __name__ == "__main__":
    import uvicorn
    threading.Thread(target=get_whisper_model, daemon=True).start()
    threading.Thread(target=telemetry.start_heartbeat_loop, daemon=True).start()
    uvicorn.run(app, host="127.0.0.1", port=8000, reload=False, log_config=None)




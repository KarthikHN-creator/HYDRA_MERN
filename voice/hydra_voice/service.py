import json
import os
import queue
import tempfile
import threading
import time
import uuid
import wave
from pathlib import Path

import socketio
import sounddevice as sd
import whisper

from .commands import evaluate_transcription


class VoiceService:
    def __init__(self):
        self._lock = threading.Lock()
        self._stop_requested = threading.Event()
        self._worker = None
        self._model = None
        self._state = "idle"
        self._error = None
        self._result = None
        self._socket_url = os.getenv("HYDRA_SOCKET_URL", "http://localhost:5000")
        self._sample_rate = int(os.getenv("VOICE_SAMPLE_RATE", "16000"))
        self._max_seconds = min(max(float(os.getenv("VOICE_MAX_SECONDS", "8")), 1), 15)
        self._model_name = os.getenv("WHISPER_MODEL", "base")
        self._min_logprob = float(os.getenv("WHISPER_MIN_AVG_LOGPROB", "-0.8"))
        self._max_no_speech = float(os.getenv("WHISPER_MAX_NO_SPEECH_PROB", "0.6"))

    def snapshot(self):
        with self._lock:
            return {
                "success": True,
                "data": {
                    "state": self._state,
                    "error": self._error,
                    "result": self._result,
                    "microphone": "inactive" if self._state in ("idle", "error") else "requested by user",
                },
            }

    def start(self):
        with self._lock:
            if self._worker is not None and self._worker.is_alive():
                return False
            self._stop_requested.clear()
            self._error = None
            self._result = None
            self._state = "loading_model" if self._model is None else "listening"
            self._worker = threading.Thread(target=self._run, name="hydra-voice-listener", daemon=True)
            self._worker.start()
            return True

    def stop(self):
        with self._lock:
            if self._worker is None or not self._worker.is_alive():
                return False
            self._stop_requested.set()
            self._state = "stopping"
            return True

    def _set_state(self, state, *, error=None, result=None):
        with self._lock:
            self._state = state
            self._error = error
            if result is not None:
                self._result = result

    def _capture_audio(self):
        chunks = queue.Queue(maxsize=256)

        def on_audio(indata, frames, timing, status):
            if status:
                print(f"Microphone stream status: {status}")
            try:
                chunks.put_nowait(indata.copy().tobytes())
            except queue.Full:
                print("Microphone buffer full; dropping an audio block")

        captured = []
        start_time = time.monotonic()
        with sd.InputStream(
            samplerate=self._sample_rate,
            channels=1,
            dtype="int16",
            callback=on_audio,
            blocksize=1024,
        ):
            self._set_state("listening")
            while not self._stop_requested.is_set() and time.monotonic() - start_time < self._max_seconds:
                try:
                    captured.append(chunks.get(timeout=0.1))
                except queue.Empty:
                    continue
        return b"".join(captured)

    def _transcribe(self, audio_bytes):
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as audio_file:
            audio_path = Path(audio_file.name)
        try:
            with wave.open(str(audio_path), "wb") as wave_file:
                wave_file.setnchannels(1)
                wave_file.setsampwidth(2)
                wave_file.setframerate(self._sample_rate)
                wave_file.writeframes(audio_bytes)
            self._set_state("recognizing")
            return self._model.transcribe(
                str(audio_path),
                language="en",
                fp16=False,
                temperature=0,
                condition_on_previous_text=False,
                word_timestamps=False,
            )
        finally:
            audio_path.unlink(missing_ok=True)

    def _send_action(self, action):
        message_id = f"voice-{uuid.uuid4()}"
        command = {"type": "action", "messageId": message_id, "command": action}
        result = {"messageId": message_id, "status": "not_sent", "error": None}
        response_ready = threading.Event()

        client = socketio.Client(reconnection=False, logger=False, engineio_logger=False)

        @client.on("ack")
        def on_ack(ack):
            if isinstance(ack, dict) and ack.get("messageId") == message_id:
                result["status"] = ack.get("status", "unknown")
                result["error"] = ack.get("error")
                response_ready.set()

        try:
            client.connect(self._socket_url, auth={"role": "client", "source": "voice"}, transports=["websocket"])
            client.emit("client:source", "voice")
            client.emit("command", command)
            response_ready.wait(timeout=5)
            if result["status"] == "not_sent":
                result["status"] = "acknowledgement_timeout"
                result["error"] = "No backend acknowledgement received; command was not retried"
        except Exception as error:  # Network and Socket.IO client failures are shown to the user.
            result["status"] = "network_error"
            result["error"] = str(error)
        finally:
            if client.connected:
                client.disconnect()
        return result

    def _run(self):
        try:
            if self._model is None:
                self._model = whisper.load_model(self._model_name)
            audio_bytes = self._capture_audio()
            if len(audio_bytes) < self._sample_rate // 2:
                self._set_state("idle", error="No audio was captured. Check the selected microphone and try again.")
                return

            transcription = self._transcribe(audio_bytes)
            decision = evaluate_transcription(transcription, self._min_logprob, self._max_no_speech)
            result = {
                "recognizedText": decision["text"],
                "action": decision["action"],
                "accepted": decision["accepted"],
                "avgLogprob": decision["avgLogprob"],
                "reason": decision["reason"],
                "backend": None,
            }
            if decision["accepted"] and decision["action"]:
                result["backend"] = self._send_action(decision["action"])
            self._set_state("idle", result=result)
        except Exception as error:  # Device, model, audio, and file errors are surfaced through /status.
            self._set_state("error", error=str(error))


voice_service = VoiceService()

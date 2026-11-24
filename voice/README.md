# HYDRA laptop voice service

The voice service captures audio from the laptop microphone only after the user presses **Start Listening** in the PWA. It uses local OpenAI Whisper transcription, exact phrase matching, Whisper segment confidence checks, and the backend Socket.IO interface. It does not require an OpenAI API key.

## Setup

Use Python 3.10 or newer. In PowerShell from `voice/`:

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
```

Install FFmpeg separately and ensure `ffmpeg.exe` is available on `PATH` (verify with `ffmpeg -version`). Whisper uses FFmpeg to read recorded audio. This is a system prerequisite, not a Python package in this project.

Set `HYDRA_SOCKET_URL` to the backend URL. The service binds to `127.0.0.1:8765` by default and accepts browser requests from the configured `FRONTEND_ORIGIN`. Whisper model files are downloaded by the local Whisper package on first use; model choice and confidence thresholds are configurable through environment variables. `sounddevice` requires a working PortAudio-compatible microphone input.

Start it with:

```powershell
python -m hydra_voice.http_api
```

The service starts idle and does not request microphone access until `POST /listen/start`. `POST /listen/stop` ends the current capture; `GET /status` provides the transcript and backend acknowledgement result. It binds to loopback only.

## Supported phrases

| Exact spoken phrase | Protocol action |
|---|---|
| Move left / More left | `MOVE_LEFT` |
| Move right / More right | `MOVE_RIGHT` |
| Move up | `MOVE_UP` |
| Move down | `MOVE_DOWN` |
| Start | `START` |
| Drink water | `DRINK_WATER` |
| Stop | `STOP` |

Matching is exact after lowercasing and punctuation removal; there is no fuzzy matching. The service rejects missing segments, `avg_logprob` below `WHISPER_MIN_AVG_LOGPROB`, `no_speech_prob` above `WHISPER_MAX_NO_SPEECH_PROB`, or unlisted phrases. These Whisper scores are screening signals, not calibrated probabilities of a correct command. Rejected or unclear speech is never sent.

Backend commands remain subject to controller connection, server gating, and firmware behavior. The current firmware rejects action semantics because they are not defined. The PWA displays the backend acknowledgement; accepted does not mean movement completed. No microphone test was run in this environment.

Run offline mapping/confidence tests with:

```powershell
python -m unittest discover -s tests
```

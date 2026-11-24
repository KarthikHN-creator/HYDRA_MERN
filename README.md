# HYDRA Robotic Arm Project

HYDRA is a React/Vite PWA, Express/Mongoose API and Socket.IO relay, optional laptop voice service, and ESP32 Arduino firmware scaffold. See [`specs.md`](specs.md) for the project plan and [`docs/communication-protocol.md`](docs/communication-protocol.md) for the draft payload contract.

## Components

- `frontend/` — responsive React control dashboard, object-picking simulation, system settings/history, REST and Socket.IO clients, and installable PWA shell.
- `backend/` — Express REST API, Mongoose configuration/history models, Socket.IO browser/controller relay, and offline tests.
- `voice/` — opt-in local laptop microphone service using Whisper and an authenticated backend client.
- `firmware/hydra/` — Arduino sketch for ESP32-WROOM-32E, protocol scaffold, and disabled-by-default actuator/sensor outputs.
- `docs/` — transport integration notes and physical bring-up checklist.

## Software prerequisites

- Node.js 20.19+ or 22.12+ (Vite 8 requirement), npm, and MongoDB for database-backed settings, calibration, and history.
- Python 3.10+ for the optional voice service. FFmpeg on `PATH` is required by Whisper. Microphone hardware and OS permission are needed only to capture audio.
- Arduino IDE/CLI and ESP32 board support are only needed for a later manual firmware compile/upload. See the firmware README.

## Local startup

Start MongoDB locally, then configure and launch the API:

```powershell
cd backend
Copy-Item .env.example .env
# Edit .env: set a private HYDRA_DEVICE_TOKEN (32+ characters).
npm install
npm start
```

The backend defaults to `http://localhost:5000`; health is `GET http://localhost:5000/api/health`. Keep `HYDRA_DEVICE_COMMANDS_ENABLED=false` until all physical safety checks are complete. The API uses `MONGODB_URI`, `PORT`, `FRONTEND_ORIGIN`, `HYDRA_DEVICE_TOKEN`, and `HYDRA_DEVICE_COMMANDS_ENABLED`.

In another terminal, configure and launch the PWA:

```powershell
cd frontend
Copy-Item .env.example .env
npm install
npm run dev
```

The default Vite URL is `http://localhost:5173`. Set `VITE_API_URL` and `VITE_SOCKET_URL` in `frontend/.env` if the backend is hosted elsewhere. The production build registers a service worker; run it over HTTPS or localhost for browser PWA features. The offline shell never caches API routes or command responses.

### Optional voice service

Follow [`voice/README.md`](voice/README.md): install Python requirements and FFmpeg, configure `voice/.env`, then run `python -m hydra_voice.http_api`. It binds to loopback and remains idle until Start Listening is selected. Voice capture and command transmission are opt-in. Whisper model download occurs on first transcription.

## REST and realtime API

- `GET /api/health` — actual HTTP server, MongoDB, and controller status.
- `GET /api/servos`, `GET /api/servos/:servoNumber`, `PATCH /api/servos/:servoNumber` — servo calibration/configuration.
- `GET /api/settings`, `PATCH /api/settings` — user preferences.
- `GET /api/history?page=1&limit=20` — paginated recent command history.
- `GET /api/robot/status` — controller connectivity and known telemetry (`null` where unknown).
- Socket.IO events and validation rules are in [`docs/realtime-communication.md`](docs/realtime-communication.md).

Servo limits are uncalibrated until the user supplies measured values. Backend and firmware both gate command forwarding/output. Protocol action semantics are not yet defined, and software `STOP` is not a physical emergency stop. Requested or commanded positions are never represented as independent servo feedback.

## Validation and test commands

```powershell
cd backend; npm test
cd ../frontend; npm run lint; npm run build
cd ../voice; python -m unittest discover -s tests
```

Backend automated tests use local HTTP and a mock Socket.IO controller. They do not require MongoDB for API/transport checks, but successful persistence and calibration reads need a running MongoDB and are not proven by the offline suite. Voice unit tests cover phrase mapping and score thresholds; microphone, Whisper model download, and live backend transmission need local dependencies and are not covered by those tests.

## Hardware status and safety

No ESP32, camera, microphone, sensors, or servos were connected or operated as part of this software work. Firmware has not been compiled or uploaded. All physical bring-up items remain **Not Tested**; follow [`docs/hardware-checklist.md`](docs/hardware-checklist.md) with a qualified operator before enabling outputs. Keep firmware outputs and backend forwarding disabled. Do not treat software STOP as an emergency stop.

The example configuration files contain placeholders only. Never commit local `.env`, `hydra_config.h`, credentials, or calibration data. If a real credential has ever been committed or pasted into project files, rotate it before use.

# HYDRA ESP32 firmware

Arduino/C++ firmware for the ESP32-WROOM-32E. The sketch is a communication and validation scaffold; it has not been compiled for or uploaded to the physical controller in this workspace.

## Safe defaults

- Servo output is compile-disabled (`HYDRA_SERVO_OUTPUT_ENABLED 0`). No servo is attached or given a target at startup.
- Per-servo minimum, maximum, and startup estimate values are unset (`NAN`). The firmware rejects movement unless each is explicitly configured and `HYDRA_SERVO_LIMITS_CONFIRMED` is enabled.
- The IR sensor is disabled and reports `null` until its voltage and active polarity are verified.
- Servo telemetry always reports six `null` values because the planned servos do not provide independent position feedback.
- All action identifiers are recognized, but their physical behavior is undefined. They are rejected. Software STOP is not a physical emergency stop.
- On controller disconnect, pending firmware motion state is discarded and never replayed. The last emitted servo pulse remains in effect; this physical response has not been validated.

Do not enable servo output until the separate servo supply, current capability, wiring, common ground, USB/external power isolation, fuse, and emergency stop have been physically inspected. Never power servos from ESP32 3.3V or apply 12V directly to servos or ESP32. These checks have not been performed here.

## Pin mapping

| Function | GPIO |
|---|---:|
| Servo 1–6 | 13, 14, 25, 26, 27, 32 |
| MPU6050 SDA/SCL | 21 / 22 (not read by this sketch) |
| IR output | 34 (disabled by default) |
| INMP441 SCK/WS/SD | 18 / 19 / 16 (not read by this sketch) |
| Buzzer transistor control | 23 (not driven by this sketch) |

GPIO34 is input-only. Check that any sensor output connected there is ESP32-safe and provide the required external bias; do not assume a 5V output is safe.

## Libraries and setup

Install the ESP32 Arduino board core and these Arduino libraries:

- ArduinoJson 6.x
- ESP32Servo
- Links2004 `arduinoWebSockets` (its `SocketIOclient` supports the Socket.IO v4 Engine.IO endpoint used here)

1. Copy `hydra_config.example.h` to `hydra_config.h` in this folder.
2. Enter local Wi-Fi credentials, the backend computer's LAN IP, and the same private controller token configured in `backend/.env`.
3. Leave output and sensor flags disabled for communication-only checks.
4. Open `hydra.ino` in Arduino IDE and select the ESP32-WROOM-32E board.
5. Compile before connecting or powering the board. Uploading is a separate manual step and is not automated.

For later supervised calibration only, enter actual measured per-servo limits and startup estimates in `hydra_config.h`, verify them against the backend database, and review the power/mechanical setup. Never substitute a generic 0–180 degree range. The first command in an enabled build moves from a manually configured startup estimate; that estimate must be established for the real arm.

## Message and transport behavior

The firmware uses an authenticated Socket.IO v4 connection to the backend's `/socket.io/` endpoint. It sends protocol `ack` and `telemetry` events and validates received protocol `servo` and `action` commands. Target angles must be whole degrees in this firmware build. A valid servo request is processed one degree per 20 ms and a `completed` acknowledgement means the output command was processed; it does not verify physical angle. Only one movement is processed at a time. No queue is kept across a disconnect.

The backend must also have `HYDRA_DEVICE_COMMANDS_ENABLED=true` before forwarding commands. Keep both backend forwarding and firmware output disabled until all safety checks are complete. No real controller connection, sensor reading, compile, upload, or movement test has been performed.

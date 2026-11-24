# HYDRA realtime communication

This document describes the backend Socket.IO transport added alongside the draft JSON contract in [`communication-protocol.md`](communication-protocol.md). The JSON command, acknowledgement, and telemetry fields remain unchanged. Transport event names and implementation-level validation details below are backend integration details, not a finalized hardware contract.

## Start and configuration

From `backend/`, copy `.env.example` to `.env`, set a local MongoDB URI, and replace the controller token with a private random value at least 32 characters long. Keep `HYDRA_DEVICE_COMMANDS_ENABLED=false` during development and communication-only checks.

```powershell
Copy-Item .env.example .env
npm install
npm start
```

The HTTP API and Socket.IO share the same HTTP server and port. `FRONTEND_ORIGIN` is a comma-separated allowlist for browser origins. Controller-role sockets must present the device token in the Socket.IO `auth.token` field or as an `Authorization: Bearer ...` handshake header. Browser clients do not receive the device token.

## Socket events

| Direction | Event | Payload |
|---|---|---|
| Browser → backend | `command` | A protocol `servo` or `action` JSON object. |
| Backend → controller | `command` | The validated protocol command, unchanged. |
| Backend → browser | `ack` | A protocol acknowledgement correlated by `messageId`. |
| Controller → backend | `ack` | A protocol acknowledgement for a pending command. |
| Controller → backend | `telemetry` | A protocol telemetry object. |
| Backend → browser | `telemetry` | The last validated telemetry object received from the authenticated controller. |
| Backend → browser | `robot:status` | Current controller connection and telemetry availability; sent on browser connect and status changes. |
| Backend → socket | `protocol:error` | `{ "code": "...", "message": "..." }` when an acknowledgement cannot be correlated to a valid command ID. |

The `command`, `ack`, and `telemetry` payload fields follow the examples in the communication protocol. Example servo command:

```json
{"type":"servo","messageId":"cmd-7a62f449-...","servo":1,"angle":45}
```

Example acknowledgement:

```json
{"type":"ack","messageId":"cmd-7a62f449-...","status":"accepted","error":null}
```

`accepted` only means the command passed checks and was forwarded to a connected controller. It does not indicate that movement completed or that a physical position was reached. A later `completed`, `failed`, or `rejected` acknowledgement is relayed separately.

## Validation and command gating

- Message IDs are required, 1–128 safe ASCII characters (`A-Z`, `a-z`, digits, `.`, `_`, `:`, `-`), and unique. The ID format was not specified by the draft; this is an implementation constraint. The backend rejects duplicate IDs, persists them uniquely when MongoDB is connected, and keeps a bounded in-memory deduplication set that fails closed when full.
- Servo numbers must be integers 1–6; angles must be finite numbers and must be within that servo's configured calibration limits. An unavailable database or uncalibrated servo causes rejection.
- This firmware build accepts whole-degree target angles because its servo output API uses integer degrees. The draft leaves fractional-degree support undecided; this implementation constraint is documented here and should be revisited before the protocol is finalized.
- Actions are checked against `MOVE_LEFT`, `MOVE_RIGHT`, `MOVE_UP`, `MOVE_DOWN`, `START`, `DRINK_WATER`, and `STOP`. The non-STOP action behaviors are not defined, so those commands are rejected as `ACTION_BEHAVIOR_UNDEFINED`. `STOP` may be relayed only when device command forwarding is explicitly enabled and a controller is authenticated; this does not make it a physical emergency stop, and its hardware behavior remains undefined.
- Controller command forwarding is disabled unless `HYDRA_DEVICE_COMMANDS_ENABLED=true`, even when a controller has authenticated. Do not enable it before calibration, wiring, power, and safety behavior are reviewed.
- Invalid messages with a valid `messageId` receive a `rejected` acknowledgement. Messages without a valid ID receive `protocol:error` because they cannot be correlated.
- A controller acknowledgement must refer to a pending command. `accepted` keeps the command pending; terminal statuses remove it and update command history when MongoDB is available.

## Connection loss and telemetry

Only a token-authenticated controller socket changes the ESP32 connection state. A client disconnect does not imply a controller disconnect. On controller disconnect, the backend clears the cached telemetry, marks the controller disconnected, fails outstanding commands, and discards them. No command is queued for replay after reconnection. Commands that receive no acknowledgement within 30 seconds are marked failed.

Telemetry is accepted only from the authenticated controller and must contain a boolean `connected`, `obstacleDetected` as boolean or `null`, and exactly six finite-number-or-`null` servo entries. Telemetry received over an active controller connection must say `connected: true`. The backend does not infer servo feedback from requested targets. After disconnect or before the first telemetry packet, sensor readings and all six servo angles are `null`.

Connection loss is reported to software clients; no physical stop behavior is claimed. The mechanical response to loss of controller connectivity remains a hardware decision that must be reviewed before operation.

## Tests

Run `npm test` from `backend/`. Tests cover HTTP health and status reporting, Socket.IO role authentication, protocol rejection, calibrated target validation using synthetic test-only bounds, acknowledgement correlation, telemetry forwarding, and pending-command discard on disconnect. They use an in-process mock controller, not an ESP32. No hardware movement or physical feedback is tested. Database-backed successful persistence requires MongoDB and is not covered by the offline test run.

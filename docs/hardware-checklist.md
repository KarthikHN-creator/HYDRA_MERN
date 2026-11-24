# HYDRA physical bring-up checklist

**Status for this project pass: every item below is Not Tested.** No physical hardware was connected, powered, compiled, uploaded, or moved. Record measured values and operator/date on a separate controlled commissioning record before changing these statuses.

| Check | Status | Required verification before operation |
|---|---|---|
| ESP32 board identity and pin mapping | Not Tested | Confirm ESP32-WROOM-32E board and GPIO assignments against the actual wiring. |
| Servo supply voltage/current capacity | Not Tested | Verify servo datasheets and supply rating under simultaneous load. |
| Power isolation, fuse, and wiring | Not Tested | Inspect polarity, conductor sizing, fuse, isolation, strain relief, and connector ratings. |
| Common ground and logic levels | Not Tested | Verify reference ground and ensure no sensor signal exceeds ESP32-safe input voltage. |
| Mechanical clearances and safe workspace | Not Tested | Secure arm/load, clear pinch/crush zones, and provide a guarded test area. |
| Independent physical emergency stop | Not Tested | Verify it physically removes actuator energy and is reachable. Software STOP is not this device. |
| Servo min/max calibration | Not Tested | Calibrate each joint individually, away from hard stops, with current limits and measured bounds. Do not assume 0-180 degrees. |
| Servo attach/start pulse position | Not Tested | Establish actual position at the servo library's initial pulse before enabling outputs; an incorrect estimate can cause motion. |
| IR sensor voltage and active polarity | Not Tested | Verify sensor output electrically and configure only after measurement. |
| MPU6050 and INMP441 wiring/function | Not Tested | Check bus/audio wiring and expected supply/logic levels. Firmware does not consume these inputs yet. |
| Wi-Fi, token authentication, and controller telemetry | Not Tested | Test on an isolated local network using a rotated private token; verify reconnect and stale telemetry behavior. |
| Command loss, disconnect, and physical stop response | Not Tested | Verify actuator behavior under link loss and emergency-stop use with energy-limited testing. |
| End-to-end movement and feedback | Not Tested | Only after all checks pass, test one joint at a time; this design has no independent servo position sensors. |

Do not enable `HYDRA_DEVICE_COMMANDS_ENABLED` or `HYDRA_SERVO_OUTPUT_ENABLED` based on this checklist alone. The undefined action semantics, physical response to connection loss, and actual actuator calibration still need project-level decisions and documented verification.

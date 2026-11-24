# HYDRA Robotic Arm --- Technical Specification

**Document:** `specs.md`\
**Project:** HYDRA Robotic Arm\
**Version:** 1.0\
**Status:** Planning specification

------------------------------------------------------------------------

## 1. Project Overview

HYDRA is a six-servo robotic arm controlled by an ESP32-WROOM-32E
controller. The planned system includes a mobile-friendly control
application, voice commands, manual servo control, gesture-based
interaction, object-picking workflows, and basic obstacle monitoring.

The initial application is being rebuilt using the MERN stack.

## 2. System Architecture

### Mobile application

-   React responsive Progressive Web App (PWA).
-   Designed for mobile screens and installable on Android through a
    supported browser.
-   Provides manual control, voice-control interface, gesture interface,
    object-picking interface, and safety status.

### Backend

-   Node.js and Express.
-   Socket.IO or WebSocket communication for real-time commands and
    telemetry.
-   MongoDB may be used for settings and command history. It is optional
    for the first hardware test.

### Robot controller

-   ESP32-WROOM-32E.
-   Runs Arduino/C++ firmware.
-   Receives commands, controls servos, reads sensors, and reports
    status.

### Voice processing

-   Initial speech recognition runs on the laptop using Python and
    Whisper.
-   Recognized English phrases are mapped to robot command identifiers.
-   The ESP32 executes the received command; it does not run Whisper.

### Communication plan

-   Start with direct local Wi-Fi communication between the PWA and
    ESP32 for the first hardware test.
-   Add a Node.js backend relay later for authentication, logging, and
    expansion.
-   Bluetooth is an optional future transport; compatibility must be
    checked before selecting it.

## 3. Hardware Inventory

  ------------------------------------------------------------------------
  Component                                 Quantity Purpose
  --------------------- ---------------------------- ---------------------
  ESP32-WROOM-32E                                  1 Main robot controller

  MG996R servo motors                         6 used Arm joint movement

  MPU6050 GY-521                                   1 Motion/orientation
                                                     sensing

  IR obstacle sensor                               1 Basic obstacle
                                                     detection

  INMP441 microphone                               1 Digital I²S audio
                                                     input

  LM2596 buck converter                            1 Power conversion;
  module                                             suitability depends
                                                     on load

  AP63203 3.3V                                     1 Logic supply
  regulator module                                   

  5V active buzzer                                 1 Audible alerts

  BC337 NPN transistor                             1 Buzzer switching

  LED and series                               1 set Status indication
  resistor                                           

  BOOT and RESET                                   2 ESP32
  buttons                                            programming/reset

  USB-C connector and                          1 set USB-to-UART
  CP2102N                                            programming interface

  12V, 5A adapter                                  1 Available input power
                                                     source
  ------------------------------------------------------------------------

**Assembly note:** The USB-C connector and CP2102N were still awaiting
assembly at the last confirmed project update. Do not attempt USB
uploading until the programming interface is assembled and checked.

## 4. ESP32 Pin Assignment

### Servo outputs

  Servo       ESP32 GPIO
  --------- ------------
  Servo 1         GPIO13
  Servo 2         GPIO14
  Servo 3         GPIO25
  Servo 4         GPIO26
  Servo 5         GPIO27
  Servo 6         GPIO32
  Servo 7         Unused

### Sensors and other I/O

  Device signal               ESP32 GPIO / connection
  --------------------------- -------------------------
  MPU6050 SDA                 GPIO21
  MPU6050 SCL                 GPIO22
  IR sensor OUT               GPIO34
  INMP441 SCK/BCLK            GPIO18
  INMP441 WS/LRCLK            GPIO19
  INMP441 SD                  GPIO16
  INMP441 L/R                 GND for left channel
  Buzzer transistor control   GPIO23

GPIO34 is input-only. Confirm that the IR sensor output voltage is safe
for the ESP32; do not apply 5V logic directly to an ESP32 GPIO.

## 5. Servo Requirements

-   Six MG996R servos are planned for use.
-   The seventh PCB servo output is unused.
-   Initial neutral position for each servo is 90 degrees.
-   Firmware should support individual servo positioning and a safe home
    position.
-   Servo movement limits must be calibrated mechanically before normal
    operation.
-   Avoid abrupt movements; use controlled movement steps where
    appropriate.

### Servo power warning

MG996R servos can draw high current, especially under load or stall. A
12V, 5A adapter and a small LM2596 module must not be assumed capable of
powering six servos.

Use a separate regulated 5--6V servo supply sized for the actual servo
load. A high-current supply in roughly the 15--20A range is an initial
planning estimate for six servos, not a substitute for checking the
actual servo specifications and mechanical load. Use suitable wiring,
connectors, PCB traces, and fusing. Join the servo supply ground and
ESP32 ground.

Never connect 12V directly to a servo or ESP32 power pin. Verify all
power rails and polarity with a multimeter before energizing the board.
Check for USB/external-supply backfeeding.

## 6. Voice Command Interface

Voice recognition initially runs on a Windows laptop using Python and
Whisper. The recognized phrases map to these command identifiers:

  Spoken phrase   Command identifier
  --------------- --------------------
  Move left       `MOVE_LEFT`
  Move right      `MOVE_RIGHT`
  Move up         `MOVE_UP`
  Move down       `MOVE_DOWN`
  Start           `START`
  Drink water     `DRINK_WATER`
  Stop            `STOP`

The phrase variants "more left" and "more right" are also accepted by
the current local command mapping.

The current voice software recognizes and maps commands locally. It has
not yet been connected to the ESP32.

## 7. Sensor Behaviour --- Planned

### MPU6050

-   Read accelerometer and gyroscope data over I²C.
-   Use the data for planned motion/orientation features.
-   Calibrate and validate readings before using them for control.

### IR obstacle sensor

-   Read the digital output on GPIO34.
-   Use detection to pause or inhibit movement as configured.
-   The IR sensor provides basic obstacle detection; it does not
    identify objects or determine their location.

### INMP441 microphone

-   Connect using I²S.
-   The microphone captures digital audio; it does not perform speech
    recognition itself.
-   Initial speech recognition remains on the laptop.

## 8. Proposed Application Features

1.  **Dashboard:** connection status, operating modes, and safety
    status.
2.  **Manual control:** six servo controls, home action, and stop
    action.
3.  **Voice control:** show listening state and recognized commands.
4.  **Gesture control:** future camera-based gesture interface.
5.  **Object picking:** future object-detection and pick/release
    workflow.
6.  **Safety monitoring:** ESP32 status, obstacle sensor status, power
    status, and servo status.

Features that are not connected to real hardware must be clearly shown
as simulated or unavailable.

## 9. Proposed Command and Telemetry Interface

The following is a proposed application-level message format, not an
implemented or verified firmware protocol.

Example command:

``` json
{
  "type": "servo",
  "servo": 1,
  "angle": 90
}
```

Example action command:

``` json
{
  "type": "action",
  "command": "STOP"
}
```

Example telemetry:

``` json
{
  "type": "telemetry",
  "connected": true,
  "obstacleDetected": false,
  "servoAngles": [90, 90, 90, 90, 90, 90]
}
```

The frontend, backend, and ESP32 firmware must use the same agreed
message schema before integration.

## 10. Safety Requirements

-   Provide a physical emergency-stop method independent of voice
    recognition or the mobile application.
-   A software STOP command is not a replacement for a physical
    emergency stop.
-   Stop or inhibit movement when an obstacle is detected, according to
    the finalized safety logic.
-   Define safe servo limits and a safe startup state.
-   Do not move servos automatically on boot unless explicitly required
    and tested.
-   Use a properly rated servo power supply, fuse, wiring, and
    connectors.
-   Keep servo power separate from the logic regulator output; connect
    grounds appropriately.
-   Check voltage polarity and rail levels before connecting the ESP32
    or servos.
-   Do not power servos from ESP32 GPIO pins or the ESP32 3.3V rail.
-   Test one servo at a time before testing coordinated movement.

## 11. Firmware and Software Separation

The specification is a planning document. It is not executable firmware.

-   ESP32 firmware is written in Arduino/C++ and compiled for the ESP32.
-   The compiled firmware binary is uploaded to the ESP32.
-   The React PWA runs in a browser or as an installed PWA.
-   The Node.js/Express backend runs separately on a computer or server.
-   Python/Whisper runs separately on the laptop during the initial
    voice-control phase.
-   The React application, Node.js backend, Python voice program, and
    this Markdown specification are not uploaded to the ESP32.

## 12. Development and Validation Plan

### Stage 1 --- Application foundation

-   Create the MERN project structure.
-   Build the responsive React PWA interface.
-   Add the Node.js/Express service.
-   Agree on the command and telemetry message schema.

### Stage 2 --- Controller preparation

-   Complete USB-C and CP2102N assembly.
-   Inspect soldering, power connections, and programming interface.
-   Verify logic power rails and USB connections before powering the
    controller.
-   Upload a basic ESP32 serial test firmware.

### Stage 3 --- Safe hardware tests

-   Verify ESP32 communication.
-   Test one servo with a suitable external servo supply.
-   Confirm servo direction, limits, and home position.
-   Test remaining servos individually.
-   Test MPU6050 and IR sensor readings.
-   Test buzzer and LED outputs.

### Stage 4 --- Application integration

-   Establish local Wi-Fi communication.
-   Send a limited servo command from the PWA.
-   Return basic telemetry from the ESP32.
-   Add stop handling and connection-loss behaviour.
-   Add backend relay and logging after direct communication is stable.

### Stage 5 --- Advanced features

-   Connect laptop voice recognition to the command interface.
-   Develop and validate gesture recognition.
-   Develop object detection and picking only after basic arm control is
    reliable.
-   Validate obstacle handling and emergency-stop behaviour.

## 13. Current Known Status

-   Arduino IDE is installed.
-   ESP32 board support and ESP32Servo library are installed.
-   The basic HYDRA ESP32 serial test sketch compiled successfully.
-   Firmware has not yet been uploaded to the physical board.
-   The voice-recognition program has successfully recognized and mapped
    the listed commands locally.
-   Voice recognition is not yet connected to the ESP32.
-   The MERN application is the selected direction for the new mobile
    application.
-   Hardware communication and real sensor/servo integration remain to
    be completed.

## 14. Open Items

-   Confirm final USB-C connector footprint and mechanical fit.
-   Complete and inspect CP2102N and USB-C assembly.
-   Confirm the final servo power supply based on actual servo current
    requirements.
-   Confirm the final command/telemetry schema.
-   Implement and test ESP32 Wi-Fi communication.
-   Calibrate servo movement limits and mechanical home positions.
-   Define exact obstacle-stop and recovery behaviour.
-   Select and validate a gesture-recognition approach.
-   Select and validate an object-detection and picking approach.

------------------------------------------------------------------------

**End of specification**

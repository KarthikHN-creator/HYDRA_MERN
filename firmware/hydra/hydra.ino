#include <Arduino.h>
#include <ArduinoJson.h>
#include <ESP32Servo.h>
#include <SocketIOclient.h>
#include <WiFi.h>
#include <math.h>

#include "hydra_config.h"

static const uint8_t SERVO_PINS[6] = {13, 14, 25, 26, 27, 32};
static const uint8_t IR_SENSOR_PIN = 34;
static const uint32_t TELEMETRY_INTERVAL_MS = 5000;
static const uint32_t SERVO_STEP_INTERVAL_MS = 20;
static const float SERVO_STEP_DEGREES = 1.0f;

SocketIOclient socketIO;
Servo servos[6];
bool servoAttached[6] = {false, false, false, false, false, false};
float estimatedAngles[6] = {NAN, NAN, NAN, NAN, NAN, NAN};
bool controllerConnected = false;
uint32_t lastTelemetryAt = 0;

struct MotionState {
  bool active = false;
  uint8_t servoIndex = 0;
  float target = 0;
  String messageId;
  uint32_t nextStepAt = 0;
};

MotionState motion;

bool isValidMessageId(const char *messageId) {
  if (messageId == nullptr) return false;
  const size_t length = strlen(messageId);
  if (length == 0 || length > 128) return false;
  for (size_t index = 0; index < length; index++) {
    const char value = messageId[index];
    const bool safe = (value >= 'A' && value <= 'Z') || (value >= 'a' && value <= 'z')
      || (value >= '0' && value <= '9') || value == '.' || value == '_' || value == ':' || value == '-';
    if (!safe || (index == 0 && !isalnum(static_cast<unsigned char>(value)))) return false;
  }
  return true;
}

void sendProtocolError(const char *code, const char *message) {
  StaticJsonDocument<256> document;
  JsonArray event = document.to<JsonArray>();
  event.add("protocol:error");
  JsonObject payload = event.createNestedObject();
  payload["code"] = code;
  payload["message"] = message;
  String serialized;
  serializeJson(document, serialized);
  socketIO.sendEVENT(serialized);
}

void sendAcknowledgement(const char *messageId, const char *status, const char *error = nullptr) {
  if (!isValidMessageId(messageId) || !socketIO.isConnected()) return;
  StaticJsonDocument<320> document;
  JsonArray event = document.to<JsonArray>();
  event.add("ack");
  JsonObject ack = event.createNestedObject();
  ack["type"] = "ack";
  ack["messageId"] = messageId;
  ack["status"] = status;
  if (error == nullptr) ack["error"] = nullptr;
  else ack["error"] = error;
  String serialized;
  serializeJson(document, serialized);
  socketIO.sendEVENT(serialized);
}

bool servoCalibrationIsUsable(uint8_t index) {
  if (index >= 6 || HYDRA_SERVO_LIMITS_CONFIRMED != 1) return false;
  const float minimum = HYDRA_SERVO_MIN_ANGLE[index];
  const float maximum = HYDRA_SERVO_MAX_ANGLE[index];
  const float startupEstimate = HYDRA_SERVO_START_ESTIMATE[index];
  return isfinite(minimum) && isfinite(maximum) && minimum < maximum
    && isfinite(startupEstimate) && startupEstimate >= minimum && startupEstimate <= maximum;
}

void rejectCommand(const char *messageId, const char *code, const char *message) {
  Serial.printf("Rejected command (%s): %s\n", code, message);
  sendAcknowledgement(messageId, "rejected", message);
}

void handleServoCommand(JsonObjectConst command) {
  if (command.size() != 4 || !command["type"].is<const char *>() || strcmp(command["type"].as<const char *>(), "servo") != 0) {
    const char *messageId = command["messageId"] | nullptr;
    rejectCommand(messageId, "INVALID_MESSAGE", "servo message has missing or unsupported fields");
    return;
  }
  const char *messageId = command["messageId"] | nullptr;
  if (!isValidMessageId(messageId)) {
    sendProtocolError("INVALID_MESSAGE_ID", "A valid messageId is required");
    return;
  }
  if (!command["servo"].is<int>()) {
    rejectCommand(messageId, "INVALID_SERVO", "servo must be an integer from 1 to 6");
    return;
  }
  const int servoNumber = command["servo"].as<int>();
  if (servoNumber < 1 || servoNumber > 6) {
    rejectCommand(messageId, "INVALID_SERVO", "servo must be an integer from 1 to 6");
    return;
  }
  if (!command["angle"].is<double>() && !command["angle"].is<int>()) {
    rejectCommand(messageId, "INVALID_ANGLE", "angle must be a finite number");
    return;
  }
  const double angle = command["angle"].as<double>();
  if (!isfinite(angle) || floor(angle) != angle) {
    rejectCommand(messageId, "INVALID_ANGLE", "This firmware accepts finite whole-degree targets only");
    return;
  }
  if (motion.active) {
    rejectCommand(messageId, "SERVO_BUSY", "Another servo request is still being processed");
    return;
  }

  const uint8_t index = static_cast<uint8_t>(servoNumber - 1);
  if (HYDRA_SERVO_OUTPUT_ENABLED != 1) {
    rejectCommand(messageId, "SERVO_OUTPUT_DISABLED", "Servo output is compile-disabled");
    return;
  }
  if (!servoCalibrationIsUsable(index)) {
    rejectCommand(messageId, "UNCALIBRATED_SERVO", "Verified per-servo limits and a startup estimate are required");
    return;
  }
  if (angle < HYDRA_SERVO_MIN_ANGLE[index] || angle > HYDRA_SERVO_MAX_ANGLE[index]) {
    rejectCommand(messageId, "ANGLE_OUT_OF_RANGE", "angle is outside this servo's configured limits");
    return;
  }

  if (!servoAttached[index]) {
    servos[index].attach(SERVO_PINS[index]);
    if (!servos[index].attached()) {
      rejectCommand(messageId, "SERVO_ATTACH_FAILED", "Servo output could not be initialized");
      return;
    }
    servoAttached[index] = true;
    estimatedAngles[index] = HYDRA_SERVO_START_ESTIMATE[index];
    // Do not write an angle at attach time; startup must not move the arm automatically.
  }

  motion.active = true;
  motion.servoIndex = index;
  motion.target = static_cast<float>(angle);
  motion.messageId = messageId;
  motion.nextStepAt = millis();
  sendAcknowledgement(messageId, "accepted");
}

bool isSupportedAction(const char *action) {
  if (action == nullptr) return false;
  const char *supported[] = {"MOVE_LEFT", "MOVE_RIGHT", "MOVE_UP", "MOVE_DOWN", "START", "DRINK_WATER", "STOP"};
  for (const char *value : supported) {
    if (strcmp(action, value) == 0) return true;
  }
  return false;
}

void handleActionCommand(JsonObjectConst command) {
  if (command.size() != 3 || !command["type"].is<const char *>() || strcmp(command["type"].as<const char *>(), "action") != 0) {
    const char *messageId = command["messageId"] | nullptr;
    rejectCommand(messageId, "INVALID_MESSAGE", "action message has missing or unsupported fields");
    return;
  }
  const char *messageId = command["messageId"] | nullptr;
  if (!isValidMessageId(messageId)) {
    sendProtocolError("INVALID_MESSAGE_ID", "A valid messageId is required");
    return;
  }
  const char *action = command["command"] | nullptr;
  if (!isSupportedAction(action)) {
    rejectCommand(messageId, "UNSUPPORTED_ACTION", "Action identifier is not in the approved list");
    return;
  }
  if (strcmp(action, "STOP") == 0) {
    rejectCommand(messageId, "STOP_BEHAVIOR_UNDEFINED", "Software STOP behavior is not finalized; use the independent physical emergency stop");
    return;
  }
  rejectCommand(messageId, "ACTION_BEHAVIOR_UNDEFINED", "This approved action has no defined physical behavior");
}

void handleSocketEvent(socketIOmessageType_t type, uint8_t *payload, size_t length) {
  if (type == sIOtype_CONNECT) {
    controllerConnected = true;
    Serial.println("Authenticated backend controller session connected");
    return;
  }
  if (type == sIOtype_DISCONNECT) {
    controllerConnected = false;
    if (motion.active) {
      Serial.println("Controller connection lost; motion software state discarded; last emitted servo pulse remains in effect");
      motion.active = false;
      motion.messageId = "";
    }
    return;
  }
  if (type != sIOtype_EVENT || payload == nullptr) return;

  StaticJsonDocument<640> document;
  const DeserializationError parseError = deserializeJson(document, payload, length);
  if (parseError) {
    sendProtocolError("INVALID_MESSAGE", "Socket event was not valid JSON");
    return;
  }
  JsonArrayConst event = document.as<JsonArrayConst>();
  if (event.size() != 2 || !event[0].is<const char *>()) {
    sendProtocolError("INVALID_MESSAGE", "Socket event must contain an event name and one JSON object");
    return;
  }
  const char *eventName = event[0].as<const char *>();
  JsonObjectConst data = event[1].as<JsonObjectConst>();
  if (strcmp(eventName, "command") != 0 || data.isNull()) {
    sendProtocolError("UNSUPPORTED_EVENT", "Only command events with JSON objects are supported");
    return;
  }

  const char *commandType = data["type"] | nullptr;
  if (commandType == nullptr) {
    const char *messageId = data["messageId"] | nullptr;
    rejectCommand(messageId, "INVALID_MESSAGE_TYPE", "type must be servo or action");
  } else if (strcmp(commandType, "servo") == 0) {
    handleServoCommand(data);
  } else if (strcmp(commandType, "action") == 0) {
    handleActionCommand(data);
  } else {
    const char *messageId = data["messageId"] | nullptr;
    rejectCommand(messageId, "UNSUPPORTED_MESSAGE_TYPE", "type must be servo or action");
  }
}

void sendTelemetry() {
  if (!socketIO.isConnected()) return;
  StaticJsonDocument<320> document;
  JsonArray event = document.to<JsonArray>();
  event.add("telemetry");
  JsonObject telemetry = event.createNestedObject();
  telemetry["type"] = "telemetry";
  telemetry["connected"] = true;
  if (HYDRA_IR_SENSOR_ENABLED == 1 && (HYDRA_IR_ACTIVE_LEVEL == HIGH || HYDRA_IR_ACTIVE_LEVEL == LOW)) {
    telemetry["obstacleDetected"] = digitalRead(IR_SENSOR_PIN) == HYDRA_IR_ACTIVE_LEVEL;
  } else {
    telemetry["obstacleDetected"] = nullptr;
  }
  JsonArray angles = telemetry.createNestedArray("servoAngles");
  for (uint8_t index = 0; index < 6; index++) {
    // MG996R servos do not provide independent position feedback in this wiring plan.
    angles.add(nullptr);
  }
  String serialized;
  serializeJson(document, serialized);
  socketIO.sendEVENT(serialized);
}

void serviceMotion() {
  if (!motion.active || static_cast<int32_t>(millis() - motion.nextStepAt) < 0) return;
  const uint8_t index = motion.servoIndex;
  const float difference = motion.target - estimatedAngles[index];
  if (fabsf(difference) <= SERVO_STEP_DEGREES) {
    estimatedAngles[index] = motion.target;
  } else {
    estimatedAngles[index] += difference > 0 ? SERVO_STEP_DEGREES : -SERVO_STEP_DEGREES;
  }
  servos[index].write(static_cast<int>(estimatedAngles[index]));
  motion.nextStepAt = millis() + SERVO_STEP_INTERVAL_MS;

  if (estimatedAngles[index] == motion.target) {
    sendAcknowledgement(motion.messageId.c_str(), "completed");
    motion.active = false;
    motion.messageId = "";
  }
}

void setup() {
  Serial.begin(115200);
  delay(100);
  Serial.println("HYDRA firmware started; servo output is not initialized at boot");

  if (HYDRA_IR_SENSOR_ENABLED == 1 && (HYDRA_IR_ACTIVE_LEVEL == HIGH || HYDRA_IR_ACTIVE_LEVEL == LOW)) {
    pinMode(IR_SENSOR_PIN, INPUT);
  }

  WiFi.mode(WIFI_STA);
  WiFi.begin(HYDRA_WIFI_SSID, HYDRA_WIFI_PASSWORD);
  Serial.println("Connecting to configured Wi-Fi; no servo motion is initiated");

  socketIO.onEvent(handleSocketEvent);
  const String authorization = String("Authorization: Bearer ") + HYDRA_DEVICE_TOKEN + "\r\n";
  socketIO.setExtraHeaders(authorization.c_str());
  socketIO.setReconnectInterval(5000);
  socketIO.begin(HYDRA_BACKEND_HOST, HYDRA_BACKEND_PORT, "/socket.io/?EIO=4&transport=websocket");
}

void loop() {
  socketIO.loop();
  serviceMotion();

  const uint32_t now = millis();
  if (controllerConnected && now - lastTelemetryAt >= TELEMETRY_INTERVAL_MS) {
    lastTelemetryAt = now;
    sendTelemetry();
  }
  delay(1);
}

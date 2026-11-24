#pragma once

// Copy this file to hydra_config.h and enter local values. Never commit hydra_config.h.
// Keep output disabled until wiring, power, and mechanical calibration are verified.
#define HYDRA_WIFI_SSID "replace-with-local-wifi-name"
#define HYDRA_WIFI_PASSWORD "replace-with-local-wifi-password"
#define HYDRA_BACKEND_HOST "192.168.1.10" // Computer running the backend; do not use localhost here.
#define HYDRA_BACKEND_PORT 5000
#define HYDRA_DEVICE_TOKEN "replace-with-the-same-private-backend-token"

#define HYDRA_SERVO_OUTPUT_ENABLED 0
#define HYDRA_SERVO_LIMITS_CONFIRMED 0

// Populate only from measured mechanical calibration data.
// Do not copy generic 0-180 degree limits into these arrays.
static const float HYDRA_SERVO_MIN_ANGLE[6] = {NAN, NAN, NAN, NAN, NAN, NAN};
static const float HYDRA_SERVO_MAX_ANGLE[6] = {NAN, NAN, NAN, NAN, NAN, NAN};
// Estimates must match each servo's physical position when attach() applies its
// library default 1500 us pulse. A wrong estimate can cause an unexpected move
// when output is enabled. Keep output disabled until this is measured and reviewed.
static const float HYDRA_SERVO_START_ESTIMATE[6] = {NAN, NAN, NAN, NAN, NAN, NAN};

// Keep disabled until the sensor output voltage and active polarity are verified.
#define HYDRA_IR_SENSOR_ENABLED 0
#define HYDRA_IR_ACTIVE_LEVEL -1 // Set to LOW or HIGH only after electrical verification.

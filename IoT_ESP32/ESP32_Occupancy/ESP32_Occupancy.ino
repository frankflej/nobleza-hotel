#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include "secrets.h"

// Primary sketch for Vercel (HTTPS). Same occupancy contract as the local HTTP variant:
// POST /api/iot/occupancy
// Header: x-device-key
// Body:   {"roomNumber": "101", "occupied": true|false}
// Sends only on state change (occupied on motion, unoccupied after 10s with no motion).

int pirPin = 14;
bool lastState = LOW;
unsigned long lastMotionTime = 0;
bool isCurrentlyOccupied = false;
const unsigned long motionTimeout = 10000;

void setup() {
  Serial.begin(115200);
  pinMode(pirPin, INPUT);

  Serial.println();
  Serial.println("Nobleza Hotel occupancy sensor starting (HTTPS)...");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int count = 0;
  while (WiFi.status() != WL_CONNECTED && count < 20) {
    delay(1000);
    Serial.print(".");
    count++;
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("WiFi connected");
    Serial.print("IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("WiFi failed to connect");
    Serial.print("WiFi status: ");
    Serial.println(WiFi.status());
  }

  Serial.println("Waiting 30s for the PIR sensor to settle...");
  delay(30000);
  Serial.println("Sensor ready");
}

void loop() {
  bool sensorReading = digitalRead(pirPin);

  if (sensorReading == HIGH) {
    lastMotionTime = millis();
    if (!isCurrentlyOccupied) {
      isCurrentlyOccupied = true;
      Serial.println("Motion Detected!");
      sendOccupancyUpdate(true);
    }
  } else if (isCurrentlyOccupied && (millis() - lastMotionTime > motionTimeout)) {
    isCurrentlyOccupied = false;
    Serial.println("No Motion (Timeout Reached)");
    sendOccupancyUpdate(false);
  }

  delay(100);
}

void sendOccupancyUpdate(bool isOccupied) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi not connected. Cannot send data.");
    return;
  }

  WiFiClientSecure client;
  if (ROOT_CA[0] != '\0') {
    client.setCACert(ROOT_CA);
  } else {
    // Fallback only. Prefer the ISRG Root X1 cert in secrets.h so the board
    // verifies the Vercel certificate.
    client.setInsecure();
    Serial.println("Warning: ROOT_CA is empty; TLS verification is disabled.");
  }

  HTTPClient http;
  http.begin(client, SERVER_URL);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-device-key", DEVICE_KEY);
  if (VERCEL_PROTECTION_BYPASS[0] != '\0') {
    http.addHeader("x-vercel-protection-bypass", VERCEL_PROTECTION_BYPASS);
  }

  String occupancyStr = isOccupied ? "true" : "false";
  String jsonPayload = String("{\"roomNumber\": \"") + ROOM_NUMBER + "\", \"occupied\": " + occupancyStr + "}";

  int httpResponseCode = http.POST(jsonPayload);
  if (httpResponseCode > 0) {
    Serial.print("Data Sent to Server! Response code: ");
    Serial.println(httpResponseCode);
  } else {
    Serial.print("Failed to send data. HTTP error code: ");
    Serial.println(httpResponseCode);
  }
  http.end();
}

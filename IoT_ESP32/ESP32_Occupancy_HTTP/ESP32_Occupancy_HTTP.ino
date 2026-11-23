#include <WiFi.h>
#include <HTTPClient.h>
#include "secrets.h"

// Local/LAN variant. Same contract as the primary HTTPS sketch, but uses
// plain HTTP (WiFiClient). Use this against the Next.js app on your network,
// e.g. http://YOUR_LAN_IP:3001/api/iot/occupancy — not for Vercel.

int pirPin = 14;
bool lastState = LOW;
unsigned long lastMotionTime = 0;
bool isCurrentlyOccupied = false;
const unsigned long motionTimeout = 10000;

void setup() {
  Serial.begin(115200);
  pinMode(pirPin, INPUT);

  Serial.println();
  Serial.println("Nobleza Hotel occupancy sensor starting (HTTP / local)...");
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

  WiFiClient client;
  HTTPClient http;
  http.begin(client, SERVER_URL);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-device-key", DEVICE_KEY);

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

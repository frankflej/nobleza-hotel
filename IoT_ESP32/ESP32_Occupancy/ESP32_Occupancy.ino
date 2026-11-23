#include <WiFi.h>
#include <HTTPClient.h>
#include "secrets.h"

// PIR motion sensor on GPIO 14. Wire OUT to 14, VCC to 5V, GND to GND.
int pirPin = 14;
bool lastState = LOW;
unsigned long lastMotionTime = 0;
bool isCurrentlyOccupied = false;
const unsigned long motionTimeout = 10000;

void setup() {
  Serial.begin(115200);
  pinMode(pirPin, INPUT);

  Serial.println();
  Serial.println("Nobleza Hotel occupancy sensor starting...");
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
      Serial.println("Motion detected");
      sendOccupancyUpdate(true);
    }
  } else if (isCurrentlyOccupied && (millis() - lastMotionTime > motionTimeout)) {
    isCurrentlyOccupied = false;
    Serial.println("No motion (timeout)");
    sendOccupancyUpdate(false);
  }

  delay(100);
}

void sendOccupancyUpdate(bool isOccupied) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi not connected; cannot send");
    return;
  }

  WiFiClient client;
  HTTPClient http;
  http.begin(client, SERVER_URL);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-device-key", DEVICE_KEY);

  String occupancyStr = isOccupied ? "true" : "false";
  String jsonPayload = String("{\"roomNumber\":\"") + ROOM_NUMBER + "\",\"occupied\":" + occupancyStr + "}";

  int httpResponseCode = http.POST(jsonPayload);
  if (httpResponseCode > 0) {
    Serial.print("Server response: ");
    Serial.println(httpResponseCode);
  } else {
    Serial.print("Send failed: ");
    Serial.println(httpResponseCode);
  }
  http.end();
}

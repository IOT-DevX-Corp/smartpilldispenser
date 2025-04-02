#include <Arduino.h> // Required for PlatformIO
#include <WiFi.h>
#include <WebServer.h>

const char *ssid = "ESP32_AP";     // WiFi AP Name
const char *password = "12345678"; // WiFi Password

WebServer server(80); // Start web server on port 80

#define LED_PIN 2 // Change to your LED pin

void handleRoot()
{
  server.send(200, "text/plain", "ESP32 is Running...");
}

void handleLEDOn()
{
  digitalWrite(LED_PIN, HIGH);
  server.send(200, "text/plain", "LED is ON");
}

void handleLEDOff()
{
  digitalWrite(LED_PIN, LOW);
  server.send(200, "text/plain", "LED is OFF");
}

void setup()
{
  Serial.begin(115200);

  WiFi.softAP(ssid, password);
  Serial.println("ESP32 Access Point Started");

  pinMode(LED_PIN, OUTPUT);

  server.on("/", handleRoot);
  server.on("/led/on", handleLEDOn);
  server.on("/led/off", handleLEDOff);

  server.begin();
  Serial.println("Web Server Started");
}

void loop()
{
  server.handleClient();
}

#include <WiFi.h>
#include <FirebaseESP32.h>
#include <ESP32Servo.h> // Changed from Servo to ESP32Servo
#include <TimeLib.h>
#include <ArduinoJson.h>
#include <NTPClient.h>
#include <WiFiUdp.h>

// WiFi credentials
#define WIFI_SSID "Hydra_Wlan$0"
#define WIFI_PASSWORD "Scienhac01"

// Firebase credentials
#define FIREBASE_HOST "iot-prj-ac910-default-rtdb.firebaseio.com"
#define FIREBASE_AUTH "Cq5IBCXLVwPfUnZDNakDMW1SrfHTYEaRpQDGJLH2"

// Pin definitions
#define IR_SENSOR_PIN 13
#define SERVO_PIN 12
#define MOTOR_PIN 14
#define MOTOR_DIR_PIN 27

// Constants
#define CHAMBER_COUNT 6
#define SERVO_DROP_ANGLE 90
#define SERVO_REST_ANGLE 0
#define MAX_WIFI_RETRY 20
#define MAX_NTP_RETRY 5
#define MAX_FIREBASE_RETRY 5

// Global objects
FirebaseData firebaseData;
FirebaseConfig firebaseConfig;
FirebaseAuth firebaseAuth;
Servo dispenserServo;
WiFiUDP ntpUDP;
NTPClient timeClient(ntpUDP);

// Time variables
unsigned long lastTimeSync = 0;
const unsigned long TIME_SYNC_INTERVAL = 3600000; // Sync time every hour
time_t currentEpochTime = 0;
const int GMT_OFFSET_SEC = 0; // Adjust based on your timezone (in seconds)

// Medication schedule
struct Medication
{
  String name;
  int hour;
  int minute;
  int chamber;
  bool dispensed;
  String lastDispensed;
};

Medication medications[10]; // Maximum 10 medications
int medicationCount = 0;

// Current position of dispenser (which chamber)
int currentChamber = 1;
bool isOnline = false;

// Forward declarations for functions - FIXED to match return types
bool updateOnlineStatus(bool online);
bool loadMedicationSchedule();
void checkForTimeUpdate();
void checkMedicationSchedule();
void dispenseMedication(int chamber);
void moveToSelectedChamber(int targetChamber);
bool syncTimeFromFirebase();
bool syncTimeFromNTP();
String getCurrentDateStr();
String getCurrentTimeStr();
bool connectToWiFi();

void setup()
{
  Serial.begin(115200);
  delay(1000); // Wait for serial monitor to stabilize

  Serial.println("Starting Smart Pill Dispenser");

  // Initialize pins
  pinMode(IR_SENSOR_PIN, INPUT);
  pinMode(MOTOR_PIN, OUTPUT);
  pinMode(MOTOR_DIR_PIN, OUTPUT);

  // Initialize servo
  dispenserServo.attach(SERVO_PIN);
  dispenserServo.write(SERVO_REST_ANGLE);

  // Connect to WiFi with retry
  if (connectToWiFi())
  {
    Serial.println("WiFi connected successfully");

    // Set static DNS servers
    IPAddress dns1(8, 8, 8, 8); // Google DNS
    IPAddress dns2(1, 1, 1, 1); // Cloudflare DNS
    WiFi.config(WiFi.localIP(), WiFi.gatewayIP(), WiFi.subnetMask(), dns1, dns2);
    delay(1000);

    // Initialize NTP Client with specific servers
    timeClient.setPoolServerName("pool.ntp.org"); // Using a reliable NTP server
    timeClient.begin();
    timeClient.setTimeOffset(GMT_OFFSET_SEC);

    // Try multiple NTP sync attempts
    bool ntpSynced = false;
    for (int i = 0; i < MAX_NTP_RETRY && !ntpSynced; i++)
    {
      Serial.print("NTP sync attempt ");
      Serial.print(i + 1);
      Serial.print(" of ");
      Serial.println(MAX_NTP_RETRY);

      ntpSynced = syncTimeFromNTP();
      if (!ntpSynced)
      {
        delay(1000);
      }
    }

    // Initialize Firebase with retry mechanism
    firebaseConfig.host = FIREBASE_HOST;
    firebaseConfig.signer.tokens.legacy_token = FIREBASE_AUTH;

    Firebase.begin(&firebaseConfig, &firebaseAuth);
    Firebase.reconnectWiFi(true);

    // Set timeout options
    firebaseData.setResponseSize(4096);
    Firebase.setReadTimeout(firebaseData, 1000 * 60);

    // Try to get time from Firebase as backup
    if (!ntpSynced)
    {
      for (int i = 0; i < MAX_FIREBASE_RETRY; i++)
      {
        Serial.print("Firebase time sync attempt ");
        Serial.print(i + 1);
        Serial.print(" of ");
        Serial.println(MAX_FIREBASE_RETRY);

        if (syncTimeFromFirebase())
        {
          break;
        }
        delay(1000);
      }
    }

    // Update online status
    for (int i = 0; i < MAX_FIREBASE_RETRY; i++)
    {
      if (updateOnlineStatus(true))
      {
        isOnline = true;
        break;
      }
      delay(1000);
    }

    // Load medication schedule from Firebase with retry
    for (int i = 0; i < MAX_FIREBASE_RETRY; i++)
    {
      if (loadMedicationSchedule())
      {
        break;
      }
      delay(1000);
    }
  }
  else
  {
    Serial.println("WiFi connection failed after maximum retries.");
    // Set offline mode
    isOnline = false;
  }

  Serial.println("Setup complete");
}

void loop()
{
  // Check WiFi connection and try to reconnect if disconnected
  if (WiFi.status() != WL_CONNECTED)
  {
    if (isOnline)
    {
      Serial.println("WiFi disconnected. Attempting to reconnect...");
      isOnline = false;
    }

    // Try to reconnect
    if (connectToWiFi())
    {
      Serial.println("WiFi reconnected");
      isOnline = true;

      // Sync time when we reconnect
      syncTimeFromNTP();

      // Update online status
      updateOnlineStatus(true);
    }
  }
  else if (!isOnline)
  {
    // Just reconnected
    isOnline = true;
    updateOnlineStatus(true);

    // Sync time when we reconnect
    syncTimeFromNTP();
  }

  // Sync time periodically
  if (isOnline && (millis() - lastTimeSync > TIME_SYNC_INTERVAL))
  {
    syncTimeFromNTP();
  }

  // Update current time if NTP client is available
  if (isOnline)
  {
    if (timeClient.update())
    {
      currentEpochTime = timeClient.getEpochTime();
    }
  }

  // Check if it's time to dispense medication
  checkMedicationSchedule();

  // Check if there are any new medications added to Firebase
  if (isOnline)
  {
    // Only try to update from Firebase every 30 seconds to avoid too many requests
    static unsigned long lastFirebaseCheck = 0;
    if (millis() - lastFirebaseCheck > 30000)
    {
      loadMedicationSchedule();
      lastFirebaseCheck = millis();
    }
  }

  // Check if a time has been updated from the app
  if (isOnline)
  {
    checkForTimeUpdate();
  }

  delay(1000); // Check every second
}

bool connectToWiFi()
{
  Serial.print("Connecting to WiFi SSID: ");
  Serial.println(WIFI_SSID);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < MAX_WIFI_RETRY)
  {
    Serial.print(".");
    delay(500);
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED)
  {
    Serial.println();
    Serial.print("Connected with IP: ");
    Serial.println(WiFi.localIP());
    return true;
  }
  else
  {
    Serial.println();
    Serial.println("Failed to connect to WiFi");
    return false;
  }
}

bool syncTimeFromNTP()
{
  if (WiFi.status() == WL_CONNECTED)
  {
    Serial.println("Syncing time from NTP server...");
    timeClient.forceUpdate();

    if (timeClient.isTimeSet())
    {
      currentEpochTime = timeClient.getEpochTime();
      lastTimeSync = millis();

      // Log the current time to serial
      time_t rawTime = currentEpochTime;
      struct tm *timeInfo;
      timeInfo = localtime(&rawTime);

      char buffer[25];
      strftime(buffer, 25, "%Y-%m-%d %H:%M:%S", timeInfo);
      Serial.print("Current time set to: ");
      Serial.println(buffer);

      // Update time in Firebase
      if (WiFi.status() == WL_CONNECTED)
      {
        for (int i = 0; i < 3; i++)
        { // Try up to 3 times
          if (Firebase.setString(firebaseData, "/pillDispenser/currentTime", buffer))
          {
            break;
          }
          delay(500);
        }
      }
      return true;
    }
    else
    {
      Serial.println("Failed to get time from NTP server");
      return false;
    }
  }
  return false;
}

bool syncTimeFromFirebase()
{
  Serial.println("Attempting to get time from Firebase...");
  if (Firebase.getString(firebaseData, "/time/current"))
  {
    String timeStr = firebaseData.stringData();
    Serial.print("Time from Firebase: ");
    Serial.println(timeStr);

    // Parse time string (expected format: "YYYY-MM-DD HH:MM:SS")
    int year, month, day, hour, minute, second;
    if (sscanf(timeStr.c_str(), "%d-%d-%d %d:%d:%d", &year, &month, &day, &hour, &minute, &second) == 6)
    {
      // Set time using TimeLib
      setTime(hour, minute, second, day, month, year);
      currentEpochTime = now();

      Serial.println("Time synchronized from Firebase");
      return true;
    }
    else
    {
      Serial.println("Failed to parse time string from Firebase");
      return false;
    }
  }
  else
  {
    Serial.print("Failed to get time from Firebase: ");
    Serial.println(firebaseData.errorReason());
    return false;
  }
}

String getCurrentDateStr()
{
  time_t rawTime = currentEpochTime;
  struct tm *timeInfo;
  timeInfo = localtime(&rawTime);

  char dateStr[11];
  strftime(dateStr, 11, "%Y-%m-%d", timeInfo);
  return String(dateStr);
}

String getCurrentTimeStr()
{
  time_t rawTime = currentEpochTime;
  struct tm *timeInfo;
  timeInfo = localtime(&rawTime);

  char timeStr[25];
  strftime(timeStr, 25, "%Y-%m-%d %H:%M:%S", timeInfo);
  return String(timeStr);
}

bool updateOnlineStatus(bool online)
{
  if (WiFi.status() == WL_CONNECTED)
  {
    bool success = true;
    if (!Firebase.setBool(firebaseData, "/pillDispenser/isOnline", online))
    {
      Serial.print("Failed to update online status: ");
      Serial.println(firebaseData.errorReason());
      success = false;
    }

    if (!Firebase.setString(firebaseData, "/pillDispenser/lastSeen", getCurrentTimeStr()))
    {
      Serial.print("Failed to update last seen: ");
      Serial.println(firebaseData.errorReason());
      success = false;
    }

    return success;
  }
  return false;
}

bool loadMedicationSchedule()
{
  Serial.println("Loading medication schedule from Firebase...");
  if (Firebase.getJSON(firebaseData, "/medications"))
  {
    Serial.println("Firebase data received successfully");

    DynamicJsonDocument doc(4096);
    DeserializationError error = deserializeJson(doc, firebaseData.jsonString());

    if (error)
    {
      Serial.print("deserializeJson() failed: ");
      Serial.println(error.c_str());
      return false;
    }

    // Clear existing schedule
    medicationCount = 0;

    // Parse each medication entry
    JsonObject obj = doc.as<JsonObject>();
    for (JsonPair p : obj)
    {
      if (medicationCount < 10)
      { // Safety check
        String id = p.key().c_str();
        JsonObject medData = p.value().as<JsonObject>();

        medications[medicationCount].name = medData["name"].as<String>();
        medications[medicationCount].hour = medData["hour"].as<int>();
        medications[medicationCount].minute = medData["minute"].as<int>();
        medications[medicationCount].chamber = medData["chamber"].as<int>();
        medications[medicationCount].dispensed = medData["dispensed"].as<bool>();
        medications[medicationCount].lastDispensed = medData["lastDispensed"].as<String>();

        medicationCount++;
      }
    }

    Serial.print("Loaded ");
    Serial.print(medicationCount);
    Serial.println(" medications from Firebase");
    return true;
  }
  else
  {
    Serial.print("Failed to get medications from Firebase: ");
    Serial.println(firebaseData.errorReason());
    return false;
  }
}

void checkForTimeUpdate()
{
  if (Firebase.getJSON(firebaseData, "/timeUpdate"))
  {
    DynamicJsonDocument doc(1024);
    DeserializationError error = deserializeJson(doc, firebaseData.jsonString());

    if (error)
    {
      Serial.print("deserializeJson() failed: ");
      Serial.println(error.c_str());
      return;
    }

    if (doc["updateRequired"].as<bool>())
    {
      int year = doc["year"].as<int>();
      int month = doc["month"].as<int>();
      int day = doc["day"].as<int>();
      int hour = doc["hour"].as<int>();
      int minute = doc["minute"].as<int>();
      int second = doc["second"].as<int>();

      // Update time
      setTime(hour, minute, second, day, month, year);
      currentEpochTime = now();

      // Reset the update flag
      Firebase.setBool(firebaseData, "/timeUpdate/updateRequired", false);

      Serial.println("Time updated from Firebase");
    }
  }
}

void checkMedicationSchedule()
{
  // Get current hour and minute from current epoch time
  time_t rawTime = currentEpochTime;
  struct tm *timeInfo;
  timeInfo = localtime(&rawTime);

  int currentHour = timeInfo->tm_hour;
  int currentMinute = timeInfo->tm_min;
  int currentSecond = timeInfo->tm_sec;

  for (int i = 0; i < medicationCount; i++)
  {
    // Check if it's time to dispense this medication
    if (currentHour == medications[i].hour &&
        currentMinute == medications[i].minute &&
        currentSecond < 10)
    { // Give a 10-second window to avoid multiple dispensing

      String currentDateStr = getCurrentDateStr();

      // Check if already dispensed today
      if (medications[i].lastDispensed != currentDateStr)
      {
        dispenseMedication(medications[i].chamber);

        // Update Firebase if online
        if (isOnline)
        {
          String path = "/medications/";
          path += String(i);
          path += "/lastDispensed";
          Firebase.setString(firebaseData, path, currentDateStr);

          path = "/medications/";
          path += String(i);
          path += "/dispensed";
          Firebase.setBool(firebaseData, path, true);
        }

        // Update local record regardless of Firebase success
        medications[i].lastDispensed = currentDateStr;
        medications[i].dispensed = true;

        Serial.print("Dispensed medication: ");
        Serial.println(medications[i].name);
      }
    }
  }
}

void dispenseMedication(int chamber)
{
  // Move to the correct chamber using rack and pinion mechanism
  moveToSelectedChamber(chamber);

  // Release medication using servo
  dispenserServo.write(SERVO_DROP_ANGLE);
  delay(1000);
  dispenserServo.write(SERVO_REST_ANGLE);

  // Check with IR sensor if medication was dispensed
  delay(500);
  bool medicationDetected = digitalRead(IR_SENSOR_PIN);

  // Record result in Firebase if online
  if (isOnline)
  {
    Firebase.setBool(firebaseData, "/pillDispenser/lastDispenseSuccessful", medicationDetected);
    Firebase.setString(firebaseData, "/pillDispenser/lastDispenseTime", getCurrentTimeStr());
  }

  Serial.print("Medication dispensed, detected by sensor: ");
  Serial.println(medicationDetected ? "Yes" : "No");
}

void moveToSelectedChamber(int targetChamber)
{
  // Ensure target chamber is valid
  if (targetChamber < 1 || targetChamber > CHAMBER_COUNT)
  {
    Serial.println("Invalid chamber number");
    return;
  }

  // Calculate steps needed to move
  int steps;
  if (targetChamber > currentChamber)
  {
    // Move forward
    steps = targetChamber - currentChamber;
    digitalWrite(MOTOR_DIR_PIN, HIGH); // Set direction forward
  }
  else if (targetChamber < currentChamber)
  {
    // Move backward
    steps = currentChamber - targetChamber;
    digitalWrite(MOTOR_DIR_PIN, LOW); // Set direction backward
  }
  else
  {
    // Already at target chamber
    Serial.println("Already at target chamber");
    return;
  }

  Serial.print("Moving from chamber ");
  Serial.print(currentChamber);
  Serial.print(" to chamber ");
  Serial.println(targetChamber);

  // Move the motor - simple implementation
  // In real application, you might want to use stepper motor library for more precise control
  for (int i = 0; i < steps; i++)
  {
    digitalWrite(MOTOR_PIN, HIGH);
    delay(500); // Adjust delay based on your motor and mechanism
    digitalWrite(MOTOR_PIN, LOW);
    delay(500);
  }

  // Update current chamber
  currentChamber = targetChamber;
  Serial.print("Now at chamber: ");
  Serial.println(currentChamber);
}
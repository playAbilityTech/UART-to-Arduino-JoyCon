// Program used to test the Nintento Switch Joystick object on the
// Arduino Leonardo or Arduino Micro.
//
// Jorand for Hackerloop
//------------------------------------------------------------
//

#include "I2Cdev.h"
#include "MPU6050_6Axis_MotionApps20.h"
#include "Wire.h"
#include "SwitchJoystick.h"

SwitchJoystick_ Joystick;

#define USE_SERIAL

// MPU6050
//----------------------------------

MPU6050 mpu;

const int ADC_Max = 1023;  // 10 bit

#define SCALING 4        // max Joystick value  at 90deg/SCALING.

#define INTERRUPT_PIN 7  // use pin 2 on Arduino Uno & most boards

// MPU control/status vars
bool dmpReady = false;  // set true if DMP init was successful
uint8_t mpuIntStatus;   // holds actual interrupt status byte from MPU
uint8_t devStatus;      // return status after each device operation (0 = success, !0 = error)
uint16_t packetSize;    // expected DMP packet size (default is 42 bytes)
uint16_t fifoCount;     // count of all bytes currently in FIFO
uint8_t fifoBuffer[64]; // FIFO storage buffer

// orientation/motion vars
Quaternion q;           // [w, x, y, z]         quaternion container
VectorFloat gravity;    // [x, y, z]            gravity vector
float ypr[3];           // [yaw, pitch, roll]   yaw/pitch/roll container and gravity vector

float pitchOffset = 0;
float rollOffset = 0;

volatile bool mpuInterrupt = false;     // indicates whether MPU interrupt pin has gone high
void dmpDataReady() { mpuInterrupt = true; }

int leftJoyX = 128;
int leftJoyY = 128;

unsigned long onTime = 0;
unsigned long releaseTime = 0;

void getIMUData() {
  if (!dmpReady) return;

  if (!mpuInterrupt && fifoCount < packetSize) {
    return;
  }

  mpuInterrupt = false;
  mpuIntStatus = mpu.getIntStatus();
  fifoCount = mpu.getFIFOCount();
  if ((mpuIntStatus & _BV(MPU6050_INTERRUPT_FIFO_OFLOW_BIT)) || fifoCount >= 1024) {
    mpu.resetFIFO();
    fifoCount = mpu.getFIFOCount();
    //Serial.println(F("FIFO overflow!"));

  } else if (mpuIntStatus & _BV(MPU6050_INTERRUPT_DMP_INT_BIT)) {
    while (fifoCount < packetSize) fifoCount = mpu.getFIFOCount();
    mpu.getFIFOBytes(fifoBuffer, packetSize);
    fifoCount -= packetSize;
    mpu.dmpGetQuaternion(&q, fifoBuffer);
    mpu.dmpGetGravity(&gravity, &q);
    mpu.dmpGetYawPitchRoll(ypr, &q, &gravity);

    // Set left joystick
    leftJoyX = (ypr[2]-rollOffset) * ADC_Max/M_PI*SCALING;
    leftJoyY = (ypr[1]-pitchOffset) * ADC_Max/M_PI*SCALING;

    leftJoyX = map(leftJoyX, -512, 511, 255, 0);
    leftJoyY = map(leftJoyY, -512, 511, 255, 0);

    leftJoyX = constrain(leftJoyX, 0, 255);
    leftJoyY = constrain(leftJoyY, 0, 255);
  }
}


// SERIAL UART
//----------------------------------
#ifdef USE_SERIAL

typedef struct {
  uint8_t button[16];
  int8_t analog[4];
  uint8_t hat[1];
  uint8_t mode = 0;
} gamepad_t;

gamepad_t gamepad;

uint32_t timer = 0;

#define FRAME_SIZE_RX (sizeof(gamepad)+2)

uint8_t rx_buffer[FRAME_SIZE_RX];
uint8_t rx_buffer_index = 0;

void push_rx_buffer(uint8_t d) {
  rx_buffer[rx_buffer_index] = d;
  rx_buffer_index = (rx_buffer_index+1) % FRAME_SIZE_RX;
}

uint8_t get_rx_buffer(uint8_t i) {
  return (rx_buffer[(i + rx_buffer_index) % FRAME_SIZE_RX]);
}

uint8_t check_rx_buffer() {
  if (get_rx_buffer(0) == 42 && get_rx_buffer(sizeof(gamepad)+1) == 43) {
    return 1;
  }
  return 0;
}

#endif


// SERIAL
//----------------------------------

void getSerialData() {
  if (Serial1.available()) {
    byte c = Serial1.read();
    //Serial.print(c);
    //Serial.print(",");

    #ifdef USE_SERIAL
      push_rx_buffer(c);
      if (check_rx_buffer()) {
        for (int i = 0; i <= FRAME_SIZE_RX; i++) {
          Serial.print(get_rx_buffer(i));
          Serial.print(",");
        }
        Serial.println(" RX:END");
        uint8_t *ptr = (uint8_t *)&gamepad;
        for (int i = 0; i < sizeof(gamepad); i++)
          ptr[i] = get_rx_buffer(i+1);
      }
    #endif
  }
}


void fail() {
  while (1) {
    RXLED0;
    delay(250);
    RXLED1;
    delay(250);
  }
}

void setup(){
  Serial.begin(115200);
  #ifdef USE_SERIAL
    Serial1.begin(115200);
  #endif
  Joystick.begin(false);

  pinMode(A0, INPUT_PULLUP);
  pinMode(A1, INPUT_PULLUP);
  pinMode(A2, INPUT_PULLUP);
  pinMode(A3, INPUT_PULLUP); // onboard button

  //pinMode(0, INPUT_PULLUP); TX0
  //pinMode(1, INPUT_PULLUP); RX1
  //pinMode(2, INPUT_PULLUP); SDA
  //pinMode(3, INPUT_PULLUP); SCL
  pinMode(4, INPUT_PULLUP);
  pinMode(5, INPUT_PULLUP);
  pinMode(6, INPUT_PULLUP);
  //pinMode(7, INPUT_PULLUP); INT MPU
  //pinMode(8, INPUT_PULLUP); Wierd
  pinMode(9, INPUT_PULLUP);
  pinMode(10, INPUT_PULLUP);
  pinMode(16, INPUT_PULLUP);
  pinMode(14, INPUT_PULLUP);
  pinMode(15, INPUT_PULLUP);

  Joystick.setXAxis(128);
  Joystick.setYAxis(128);
  Joystick.setZAxis(128);
  Joystick.setRzAxis(128);
  Joystick.sendState();

  // set up MPU6050
  Wire.begin();
  Wire.setClock(400000);
  mpu.initialize();
  pinMode(INTERRUPT_PIN, INPUT);

  devStatus = mpu.dmpInitialize();

  if (devStatus == 0) {
    mpu.setDMPEnabled(true);

    attachInterrupt(digitalPinToInterrupt(INTERRUPT_PIN), dmpDataReady, RISING);
    mpuIntStatus = mpu.getIntStatus();
    dmpReady = true;
    packetSize = mpu.dmpGetFIFOPacketSize();
  } else {
    //fail();
  }
}

void loop() {
  getSerialData();

  getIMUData();

  // reset offset
  if (digitalRead(A3)) {
    onTime = millis();
  }
  else {
    // Long press Set offset IMU
    if ((millis() - onTime) > 1000) {
      pitchOffset = ypr[1];
      rollOffset = ypr[2];
    }
  }


  // USB

  if (millis() > timer) {
    timer = millis() + 10; // 10 ms = 1/0.010 == 100Hz

    #ifdef USE_SERIAL
      for (uint8_t i=0; i<sizeof(gamepad.button); i++) {
        Joystick.setButton(i, gamepad.button[i]);
      }
      if (gamepad.mode == 1) {
        // Disable IMU joystick for uart
        Joystick.setXAxis(gamepad.analog[0]);
        Joystick.setYAxis(gamepad.analog[1]);
      }
      else if (gamepad.mode == 2) {
        // reverse X axis
        Joystick.setXAxis(map(leftJoyX, 0, 255, 255, 0));
        Joystick.setYAxis(leftJoyY);
      }
      else if (gamepad.mode == 3) {
        // reverse X & Y axis
        Joystick.setXAxis(map(leftJoyX, 0, 255, 255, 0));
        Joystick.setYAxis(map(leftJoyY, 0, 255, 255, 0));
      }
      else {
        // USE IMU AXIS
        Joystick.setXAxis(leftJoyX);
        Joystick.setYAxis(leftJoyY);
      }

      Joystick.setZAxis(gamepad.analog[2]);
      Joystick.setRzAxis(gamepad.analog[3]);
      Joystick.setHatSwitch(gamepad.hat[0] == 255 ? -1 : gamepad.hat[0]*45);
    #endif

    if (!digitalRead(10)) {
      Joystick.pressButton(2); // A
    }
    if (!digitalRead(16)) {
      Joystick.pressButton(1); // B
    }
    if (!digitalRead(14)) {
      Joystick.pressButton(3); // X
    }
    if (!digitalRead(15)) {
      Joystick.pressButton(0); // Y
    }
    if (!digitalRead(A0)) {
      Joystick.pressButton(4); // L
    }
    if (!digitalRead(A1)) {
      Joystick.pressButton(5); // R
    }
    if (!digitalRead(A2)) {
      Joystick.pressButton(10); // LEFT_STICK_CLICK
    }

    if (!digitalRead(A3)) { // OnBoard Button
      Joystick.pressButton(2); // A
    }

    if (gamepad.mode == 4) {
      // disable pads
      Joystick.setButton(0, 0); // Y
      Joystick.setButton(1, 0); // B
      Joystick.setButton(2, 0); // A
      Joystick.setButton(3, 0); // X
    }

    Joystick.sendState();
  }
}

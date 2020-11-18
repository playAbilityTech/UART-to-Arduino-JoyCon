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

  while (!mpuInterrupt && fifoCount < packetSize) {
    if (mpuInterrupt && fifoCount < packetSize) {
      fifoCount = mpu.getFIFOCount();
    }
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

typedef struct {
  uint8_t button[16];
  int8_t analog[4];
  int8_t hat[1];
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
  uint8_t crc = 0;
  if (get_rx_buffer(0) == 42 && get_rx_buffer(sizeof(gamepad)+1) == 43) {
    return 1;
  }
  return 0;
}


// SERIAL MIDI
//----------------------------------

typedef struct {
  int8_t channel;
  int8_t type;
  int8_t note;
  int8_t velocity;
} midi_t;

midi_t midi;
#define FRAME_SIZE_MIDI (3)

uint8_t midi_buffer[FRAME_SIZE_MIDI];
uint8_t midi_buffer_index = 0;

void push_midi_buffer(uint8_t d) {
  midi_buffer[midi_buffer_index] = d;
  midi_buffer_index = (midi_buffer_index+1) % FRAME_SIZE_MIDI;
}

uint8_t get_midi_buffer(uint8_t i) {
  return (midi_buffer[(i + midi_buffer_index) % FRAME_SIZE_MIDI]);
}

uint8_t check_midi_buffer() {
  uint8_t crc = 0;
  if (get_midi_buffer(0) & 0b10000000) {
    return 1;
  }
  return 0;
}


// SERIAL
//----------------------------------

void getSerialData() {
  if (Serial1.available()) {
    char c = Serial1.read();
    Serial.print(c, HEX);
    Serial.print(",");
    
    push_rx_buffer(c);
    if (check_rx_buffer()) {
      Serial.println(" RX:END");
      uint8_t *ptr = (uint8_t *)&gamepad; 
      for (int i = 0; i < sizeof(gamepad); i++)
        ptr[i] = get_rx_buffer(i+1);
    }

    push_midi_buffer(c);
    if (check_midi_buffer()) {
      Serial.print(" MIDI:");
      for (int i = 0; i <= sizeof(FRAME_SIZE_MIDI); i++) {
        Serial.print((byte) get_midi_buffer(i));
        Serial.print(",");
      }
      Serial.print("END \t ");

      if ((get_midi_buffer(0) & 0xF0) == 0x80) {
        midi.type = 0;
      } 
      else if ((get_midi_buffer(0) & 0xF0) == 0x90){
        midi.type = 1;
      }

      midi.channel = get_midi_buffer(0) & 0x0F;
      midi.note = get_midi_buffer(1);
      midi.velocity = get_midi_buffer(2);

      Serial.print("[MIDI in] channel:");
      Serial.print(midi.channel + 1);
      Serial.print(" note:");
      Serial.print(midi.note);
      Serial.print(" type:");
      Serial.print(midi.type);
      Serial.print(" velocity:");
      Serial.println(midi.velocity);
    }
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
  Serial1.begin(115200);
  Joystick.begin(false);

  pinMode(A0, INPUT_PULLUP);
  pinMode(A1, INPUT_PULLUP);
  pinMode(A2, INPUT_PULLUP);
  pinMode(A3, INPUT_PULLUP);

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
    fail();
  }
}

void loop() {
  getSerialData();

  getIMUData();

  // reset offset
  if (digitalRead(A0)) {
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
   
    for (uint8_t i=0; i<sizeof(gamepad.button); i++) {
      Joystick.setButton(i, gamepad.button[i]);
    }

    switch (midi.note) {
      case 36:
        Joystick.setButton(1, midi.type);
        break;
      case 62:
        Joystick.setButton(4, midi.type);
        break;
    }

    if (!digitalRead(14)) {
      Joystick.pressButton(1); // B
    }
    if (!digitalRead(15)) {
      Joystick.pressButton(2); // A
    }
    if (!digitalRead(16)) {
      Joystick.pressButton(4); // L
    }
    if (!digitalRead(10)) {
      Joystick.pressButton(5); // R
    }
    if (!digitalRead(A0)) {
      Joystick.pressButton(10); // Lstick
    }

    if (gamepad.mode == 1) {
      Joystick.setXAxis(gamepad.analog[0]);
      Joystick.setYAxis(gamepad.analog[1]);
    }
    else {
      Joystick.setXAxis(leftJoyX);
      Joystick.setYAxis(leftJoyY);
    }

    Joystick.setZAxis(gamepad.analog[2]);
    Joystick.setRzAxis(gamepad.analog[3]);
    Joystick.setHatSwitch(gamepad.hat[0]);

    Joystick.sendState();
  }
}

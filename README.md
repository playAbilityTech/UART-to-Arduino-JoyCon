# UART-to-Arduino-JoyCon
Program used to test the Nintento Switch Arduino Joystick with a UART interface.

## Dependencies
 - You need to install [SwitchJoystick](https://github.com/HackerLoop/Arduino-JoyCon-Library-for-Nintendo-Switch)

## Usage
### Client
In the `/client` folder.
1. `npm install`
2. `npm run dev` or `npm start`

### Arduino
Falsh the `.ino` file on a Arduino Leonardo,  Arduino Micro or ATmega32U4 based microcontroller.

## Todo
- Input Protocol
  - [x] UART
  - [ ] MIDI Serial Bridge (Hairless MIDI)
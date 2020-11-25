# UART-to-Arduino-JoyCon
Program used to test the Nintento Switch Arduino Joystick with a UART interface.

## Dependencies
 - You need to install [SwitchJoystick](https://github.com/HackerLoop/Arduino-JoyCon-Library-for-Nintendo-Switch)

## Usage
### Client
In the `/client` folder.
1. `npm install`
2. `npm run dev` or `npm start`
3. open `http://localhost:3000/`

### Arduino
Falsh the `.ino` file on a Arduino Leonardo,  Arduino Micro or ATmega32U4 based microcontroller.

### esp-link

#### Flash with esptool
Download the latest [release](https://github.com/jeelabs/esp-link/releases).

```
esptool.py --port /dev/tty.wchusbserial14130 --baud 230400 write_flash -fs 32m -ff 80m \
    0x00000 boot_v1.7.bin 0x1000 user1.bin \
    0x3FC000 esp_init_data_default.bin 0x3FE000 blank.bin
```

for more infos see [esp-link](https://github.com/jeelabs/esp-link)

#### Connect to arduino
- RX: connect to TX of microcontroller
- TX: connect to RX of microcontroller
- GND: connect to GND of microcontroller

## Thanks to
 - [spectrenoir06](https://github.com/spectrenoir06)

## Todo
- Input Protocol
  - [x] UART
  - [x] MIDI
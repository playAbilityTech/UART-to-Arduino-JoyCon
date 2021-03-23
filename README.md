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

##### Options:
- PLAYER: `PLAYER=1 npm run dev` will set PORT to 3000 + PLAYER ID. It will listen on MIDI channel of the same number to. Settings will be saved in its own config for each player id.
- PORT: `PORT=3031 PLAYER=1 npm run dev` will run client with the specified port.

- CONFIG file `npm start --config-file-path ./config_prod.json`

### Arduino
Falsh the `.ino` file on a Arduino Leonardo,  Arduino Micro or ATmega32U4 based microcontroller.

[MPU Change default axes orientation](https://www.i2cdevlib.com/forums/topic/397-change-default-axes-orientation/)
[MPU Change default axes orientation - Git](https://github.com/HackerLoop/Arduino-JoyCon-Library-for-Nintendo-Switch/commit/3c321113653655978776fa2f8fed0acfff2f7dc4)

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
# Client

## GamepadHandler API

### GamepadHandler()
Constructor used to initialize and setup the Gamepad.

### Gamepad.connect({portPath: String, initAutoSendState: bool})
Connect to the Serial port of the arduino connected to a Nintendo Switch. By default, all methods update the game controller state immediately. If `initAutoSendState` is set to `false`, the `sendState` method must be called to update the game controller state.

### Gamepad.close()
Close the Serial connection.

### Gamepad.setLeftAxis(x, y)
Sets the X axis value. The range is

### Gamepad.setRightAxis(x, y)
Sets the Z axis value.

### Gamepad.setLeftAxisDirection(direction)
Sets the Z axis value.

### Gamepad.setRightAxisDirection(direction)
Sets the Z axis value.

### Gamepad.setButton(button, value)
Sets the state (`0` or `1`) of the specified button (range: `0` - `15`). The button can be a number or a mapping reference string. (i.e. `Y` is `0`, `B` is `1`, etc.).

| MAPPING | `Y` | `B` | `A` | `X` | `L` | `R` | `ZL` | `ZR` | `MINUS` | `PLUS` | `LSTICK` | `RSTICK` | `HOME` | `CAPTURE` |
| ------- | - | - | - | - | - | - | - | - | - | - | -- | -- | -- | -- |
| button  | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 |

The value is `1` if the button is pressed and `0` if the button is released.

### Gamepad.pressButton(button)
Press the indicated button. The button is a number or a mapping reference string (see Gamepad.setButton for the mapping).

### Gamepad.releaseButton(button)
Release the indicated button. The button is a number or a mapping reference string (see Gamepad.setButton for the mapping).

### Gamepad.setHat(value)
Sets the value of the hat switch. The value is from 0° to 360°, but in 45° increments.
Set the value from `0` to `8` or a mapping reference string below.
(i.e. Set the value to `RELEASE` or `255` to release the hat switch.)

| MAPPING | `UP` | `RIGHT` | `DOWN` | `LEFT` | `RELEASE` |
| ------- | - | - | - | - | - |
| value   | 0 | 2 | 4 | 6 | 255 |

### Gamepad.sendState()
Send the current gamepad state to the Arduino. Only needs to be called if `AutoSendState` is `false` (see `Gamepad.connect` for more details).

### Gamepad.getState()
Get the current gamepad state.

### Gamepad.setState(obj)
Set all current gamepad state. If `AutoSendState` is `false` you need to call `Gamepad.sendState()` after.

const { EventEmitter } = require('events');
const SerialPort = require("serialport");
const jspack = require("jspack").jspack;

const { BUTTONS, HAT, JOYSTICK } = require('./mapping');


class GamepadHandler extends EventEmitter {
  constructor() {
    super();
    this.portPath = '';
    this.serial = {};
    this.autoSendState = true;
    this.triggerTimers = {};

    this.gamepad = {
      button: [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      joyLeft: {
        x: 128,
        y: 128,
      },
      joyRight: {
        x: 128,
        y: 128,
      },
      hat: 255,
      mode: 0,
    };
  }

  /**
   * Connect to the Arduino JoyCon Serial and setup the event handlers
   * @param {Object} options
   * @param {string} options.portPath
   * @param {bool} [options.initAutoSendState = true] By default, all methods update the game controller state immediately. If set to false, the sendState method must be called to update the game controller state.
   * @event open
   * @event close
   * @event error
   * @event data
   */
  connect({portPath, initAutoSendState = true}) {
    if (!portPath) return;
    if (this.serial.isOpen) this.close();

    this.portPath = portPath;
    this.autoSendState = initAutoSendState;
    // Create the serial connection
    this.serial = new SerialPort(this.portPath, {
      baudRate: 115200,
      stopBits: 2
    });

    this.serial.on('open', (err) => {
      if (err) {
        return console.log('Error opening port: ', err.message)
      }
      console.log(`Serial port '${this.portPath}' is opened.`);
      this.emit('open', err);
    });

    this.serial.on('close', function(port) {
      console.log(`Serial port '${port}' closed.`);
      this.emit('close', port);
    }.bind(this, this.portPath));

    this.serial.on('error', (err) => {
      console.log('error', err.toString());
      this.emit('error', err);
    });

    this.serial.on('data', (data) => {
      this.emit('data', data);
    });
  }

  //erialPort.prototype.open = function (openCallback) {

  /**
   * Close serial
   */
  close() {
    if (this.serial.isOpen) {
      this.serial.close();
    }
  }

  /**
   * Send data to Serial
   * @private
   * @param {Object} obj Gamepad object
   * @callback [next]
   */
  _sendSerial(obj, next = (p) => {}) {
    if (this.serial.isOpen) {
      var payload = this._pack(obj);
      this.serial.write(payload);
      console.log('SEND: ' + payload);
      next(payload);
    }
  }

  /**
   * Prep data ready to send
   * @private
   * @param {Object} obj Gamepad object
   * @return {Object[]|false|undefined} Return an octet array containing the packed values array. If there are fewer values supplied, Pack() will return false. If any value is of an inappropriate type, the results are undefined.
   */
  _pack(obj) {
    return jspack.Pack(
      `B${obj.button.length}ABBBBBBB`, [
        42,
        obj.button,
        obj.joyLeft.x, obj.joyLeft.y,
        obj.joyRight.x, obj.joyRight.y,
        obj.hat,
        obj.mode,
        43
      ]);
  }

  /**
   * Get Current Gamepad state
   * @return {Object} Gamepad object
   */
  getState() {
    return this.gamepad;
  }

  /**
   * Set Current Gamepad state
   * @param {Object} obj Gamepad object
   */
  setState(obj) {
    this.gamepad = obj;
    this._stateUpdated();
    if (this.autoSendState) this.sendState();
  }

  /**
   * Set Button state
   * @param {int|String} button
   * @param {int} value (0 or 1)
   */
  setButton(button, value = 1) {
    var id = this._getButtonMappingValue(button);
    if (id >= this.gamepad.button.length) return;
    this.gamepad.button[id] = this._safe_Uint8_t(value);
    this._stateUpdated();
    if (this.autoSendState) this.sendState();
  }

  /**
   * Set Button state to press (1)
   * @param {int|String} button
   */
  pressButton(button) {
    this.setButton(button, 1);
  }

  /**
   * Set Button state to release (0)
   * @param {int|String} button
   */
  releaseButton(button) {
    this.setButton(button, 0);
  }

  /**
   * Set Button state to press and release with a delay between
   * @param {int|String} button
   * @callback [onRelease]
   * @param {int} [delay=200]
   */
  deprecated_triggerButton(button, onRelease, delay = 200) {
    clearTimeout(this.triggerTimers[button]);
    this.setButton(button, 1);
    if (this.autoSendState) this.sendState();
    var callback = (onRelease && typeof onRelease === 'function') ? onRelease : () => {
      this.sendState();
    }
    this.triggerTimers[button] = setTimeout((value, next) => {
      this.setButton(value, 0);
      next();
    }, delay, button, callback);
  }

  /**
   * Set Left Joystick Axis
   * @param {int} x (0---128---255)
   * @param {int} y (0---128---255)
   */
  setLeftAxis(x = 128, y = 128) {
    this.gamepad.joyLeft.x = this._safe_Uint8_t(x);
    this.gamepad.joyLeft.y = this._safe_Uint8_t(y);
    this._stateUpdated();
    if (this.autoSendState) this.sendState();
  }
  setLeftAxisX(value) {
    this.gamepad.joyLeft.x = this._safe_Uint8_t(value);
    this._stateUpdated();
    if (this.autoSendState) this.sendState();
  }
  setLeftAxisY(value) {
    this.gamepad.joyLeft.y = this._safe_Uint8_t(value);
    this._stateUpdated();
    if (this.autoSendState) this.sendState();
  }

  /**
   * Set Right Joystick Axis
   * @param {int} x (0---128---255)
   * @param {int} y (0---128---255)
   */
  setRightAxis(x = 128, y = 128) {
    this.gamepad.joyRight.x = this._safe_Uint8_t(x);
    this.gamepad.joyRight.y = this._safe_Uint8_t(y);
    this._stateUpdated();
    if (this.autoSendState) this.sendState();
  }
  setRightAxisX(value) {
    this.gamepad.joyRight.x = this._safe_Uint8_t(value);
    this._stateUpdated();
    if (this.autoSendState) this.sendState();
  }
  setRightAxisY(value) {
    this.gamepad.joyRight.y = this._safe_Uint8_t(value);
    this._stateUpdated();
    if (this.autoSendState) this.sendState();
  }

  /**
   * Set Left Joystick direction
   * @param {String} direction
   */
  setLeftAxisDirection(direction) {
    var axis = this._getJoystickMappingValue(direction);
    this.setLeftAxis(axis.x, axis.y);
  }

  /**
   * Set Right Joystick direction
   * @param {String} direction
   */
  setRightAxisDirection(direction) {
    var axis = this._getJoystickMappingValue(direction);
    this.setRightAxis(axis.x, axis.y);
  }

  /**
   * Set Hat value
   * @param {int|String} value id of the button or mapping key
   *
   * The value of the hat switch is from 0° to 360°,
   * but in 45° increments so we use a multiplier of 45.
   * Send value from 0 to 8.
   * Set the value to 255 to release the hat switch
   *
   * ex: 4 = 4 * 45 = 180° = ⇩
   */
  setHat(value = 255) {
    var val = this._getHatMappingValue(value);
    this.gamepad.hat = this._safe_Uint8_t(val);
    this._stateUpdated();
    if (this.autoSendState) this.sendState();
  }

  /**
   * Set Mode
   * @param {int} value
   */
  setMode(value = 0) {
    this.gamepad.mode = this._safe_Uint8_t(value);
    this._stateUpdated();
    if (this.autoSendState) this.sendState();
  }

  /**
   * Set State
   * @callback [next] callback
   */
  sendState(next = (p) => {}) {
    this._sendSerial(this.gamepad, next);
  }

  /**
   * Send stateChange event
   * @private
   * @event stateChange
   */
  _stateUpdated() {
    this.emit('stateChange', this.gamepad);
  }

  /**
   * Get value from the JOYSTICK object
   * @private
   * @param {String} value
   */
  _getJoystickMappingValue(value) {
    var axis = {x: 128, y: 128};
    if (value.toUpperCase() in JOYSTICK) {
      axis = JOYSTICK[value.toUpperCase()];
    }
    return axis;
  }

  /**
   * Get value from the HAT object
   * @private
   * @param {String} value
   */
  _getHatMappingValue(value) {
    var id = value;
    if (id.toUpperCase() in HAT) {
      id = HAT[id.toUpperCase()];
    }
    return id;
  }

  /**
   * Get value from the MAPPING object
   * @private
   * @param {String} value
   */
  _getButtonMappingValue(value) {
    var id = value;
    if (id.toUpperCase() in BUTTONS) {
      id = BUTTONS[id.toUpperCase()];
    }
    return id;
  }

  /**
   * Get the MAPPING object
   * @return {Object}
   */
  getButtonsMapping() {
    return BUTTONS;
  }

  /**
   * Constrain value in 0 to 255 range
   * @private
   * @param {String} value
   */
  _safe_Uint8_t(value) {
    return Math.min(Math.max(parseInt(value), 0), 255) || 0;
  }
}

module.exports = GamepadHandler;
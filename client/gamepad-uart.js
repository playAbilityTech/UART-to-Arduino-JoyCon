const { EventEmitter } = require('events');
const SerialPort = require("serialport");
const jspack = require("jspack").jspack;
const net = require('net');
const Utils = require('./utils');

const { BUTTONS, HAT, JOYSTICK, STICKS } = require('./mapping');


class GamepadHandler extends EventEmitter {
  constructor() {
    super();
    this.portPath = '';
    this.serial = {};
    this.tcpClient = {};
    this.autoSendState = true;
    this.triggerTimers = {};
    this.lastPayload = "";
    this.lastState = "";
    this.mappingValue = {...BUTTONS, ...STICKS};
    this.gamepad_set = {};

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
      mode: 2,
    };

    this.modifiers = {
      button: {},
      axis: {}
    }
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
  connect({portPath, initAutoSendState = true, reconnect = false}) {
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
      reconnect = false;
      console.log(`Serial port '${this.portPath}' is opened.`);
      this.emit('open', this.portPath);
    });

    this.serial.on('close', function(port, err) {
      console.log(port, err);
      console.log(`Serial port '${port}' closed.`);
      this.emit('close', port, err);
      reconnect = false;
      if (err) {
        this.reconnect();
      }
    }.bind(this, this.portPath));

    this.serial.on('error', (err) => {
      if (!reconnect) {
        var error = err.toString().replace(/Error: /g, '');
        console.log('error:', error);
        this.emit('error', error);
      }
      this.reconnect();
    });

    this.serial.on('data', (data) => {
      this.emit('data', data);
    });
  }

  reconnect() {
    //console.log('INITIATING RECONNECT');
    setTimeout(() => {
      //console.log('RECONNECTING TO ARDUINO');
      this.connect({
        portPath: this.portPath,
        initAutoSendState: this.autoSendState,
        reconnect: true
      });
    }, 2000);
  }


  /**
   * Close serial
   */
  close() {
    if (this.serial.isOpen) {
      this.serial.close();
    }
  }

  /**
   * Connect to the tcp and setup the event handlers
   * @param {Object} options
   * @param {string} options.ip
   * @param {int} [options.port = 2323]
   * @event tcp:connect
   * @event tcp:close
   * @event tcp:error
   * @event tcp:data
   */
  connectTCP({ip, port = 2323}) {
    if (ip === undefined) return;
    if (this.tcpClient.readyState) this.closeTCP();

    // TCP
    this.tcpClient = new net.Socket();

    this.tcpClient.setKeepAlive(true, 1000);

    this.tcpClient.connect(port, ip, () => {
      console.log('TCP Connected');
      this.tcpClient.write('Hello, server! Love, Client.');
      this.emit('tcp:connect', 'connected');
    });

    this.tcpClient.on('data', (data) => {
      console.log('TCP Received: ' + data);
      //this.tcpClient.destroy(); // kill client after server's response
      this.emit('tcp:data', data);
    });

    this.tcpClient.on('error', (err) => {
      var msg = '';
      if (err.code == "ENOTFOUND") {
        msg = "[ERROR] No device found at this address!";
        this.tcpClient.destroy();
      }
      else if (err.code == "ECONNREFUSED") {
        msg = "[ERROR] Connection refused! Please check the IP.";
        this.tcpClient.destroy();
      }
      else {
        msg = "[CONNECTION] Unexpected error! " + err.message + "     RESTARTING SERVER";
      }
      console.log(msg);
      this.emit('tcp:error', msg);
    });

    this.tcpClient.on('close', (err) => {
      console.log('[TCP] close', err);
      if (err) {
        this.emit('tcp:close', 'Connection failed');
      }
      else {
        this.emit('tcp:close', 'Connection closed');
      }
    });
  }

  /**
   * Close TCP
   */
  closeTCP() {
    if (this.tcpClient.readyState !== "closed") {
      this.tcpClient.destroy();
    }
  }


  /**
   * Send data to Serial
   * @private
   * @param {Object} obj Gamepad object
   * @callback [next]
   * @param {bool} force Send state anyway
   */
  _sendSerial(obj, next = (p, senders) => {}, force = false) {
    var senders = [];
    var clone = {...obj};
    clone.mode = (clone.mode[0] || clone.mode) - 1;
    var payload = this._pack(clone);

    // check if data didin't changed
    if (!force && payload.join(",") == this.lastPayload) return;
    this.lastPayload = payload.join(",");

    if (this.serial.isOpen) {
      this.serial.write(payload);
      senders.push("UART");
    }
    if (this.tcpClient.readyState == "open") {
      var buffer = Buffer.from(payload);
      this.tcpClient.write(buffer, (err) => {
        if (err) {
          this.emit('tcp:error', err);
        }
      });
      senders.push("TCP");
    }
    if (senders.length) {
      next(payload, senders);
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
    value = value ? 1 : 0;
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
   * Set Joystick Axis
   * @param {int|String} axis
   * @param {int} value (0---128---255)
   */
  setAxis(axis, value) {
    //console.log(axis, value);
    var {key, id} = this._getAxisMappingValue(axis);
    if (!this.gamepad.hasOwnProperty(key)) return;
    this.gamepad[key][id] = this._safe_Uint8_t(value);
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
  sendState(next = (p) => {}, force) {
    // apply modifier before send
    var obj = this._handleModifiers();
    this._sendSerial(obj, next, force);
  }

  /**
   * Set Current Gamepad set
   * @param {Object} set Gamepad set
   */
  saveGamepadSet(set) {
    this.gamepad_set = set;
  }

  /**
   * Get Current Gamepad set
   * @return {Object} Gamepad set
   */
  getGamepadSet() {
    return this.gamepad_set;
  }

  /**
   * Set Modifier to gamepad state
   * @param {String} modifier
   * @param {String} type Input type button or axis
   * @param {String} key Input key ex:"SHOULDER_LEFT"
   * @param {int} id Input id
   * @param {int} value modifier value
   */
  setModifier(modifier, type, key, id, value) {
    if (!this.modifiers[type][id]) this.modifiers[type][id] = {};
    this.modifiers[type][id][modifier] = value;
    this.modifiers[type][id].key = key;
    this._stateUpdated();
  }
  
  /**
   * Apply modifier to gamepad state
   * @private
   * @return {Object}
   */
  _handleModifiers() {
    var clone = JSON.parse(JSON.stringify(this.gamepad));
    for (const type in this.modifiers) {
      var modifier = this.modifiers[type];
      for (const id in modifier) {
        var element = modifier[id];
        var map = this._getMappingValue(element.key)
        //console.log(map, type, element);
        if (element.disable) {
          clone[type][map] = 0;
        }
        if (element.hold) {
          clone[type][map] = 1;
        }
        if (element.reverse) {
          clone[map[0]][map[1]] = 255 - clone[map[0]][map[1]];
        }
      }
    }
    return clone;
  }

  /**
   * Send stateChange event
   * @private
   * @event stateChange
   */
  _stateUpdated() {
    //this._handleModifiers();
    // clone state to preserve it and apply modifiers
    var obj = this._handleModifiers();
    // var obj = this.gamepad;
    let data = this._pack(obj);
    if (data.join(",") == this.lastState) return;
    this.lastState = data.join(",");
    this.emit('stateChange', obj);
  }

  /**
   * Get value from the JOYSTICK object
   * @private
   * @param {String} value
   * @return {Object}
   */
  _getJoystickMappingValue(value) {
    var axis = {x: 128, y: 128};
    if (value.toUpperCase() in JOYSTICK) {
      axis = JOYSTICK[value.toUpperCase()];
    }
    return axis;
  }

  /**
   * Get value from the JOYSTICK KEY
   * @private
   * @param {String} value
   * @return {Object}
   */
  _getAxisMappingValue(value) {
    var key, id;
    if (value.toUpperCase() in STICKS) {
      var obj = STICKS[value.toUpperCase()];
      key = obj[0];
      id = obj[1];
    }
    return {key, id};
  }

  /**
   * Get value from the HAT object
   * @private
   * @param {String} value
   * @return {id}
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
   * @return {int}
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
   * Get value from key
   * @private
   * @param {String} value
   * @return {id}
   */
  _getMappingValue(value) {
    var id = value;
    if (id.toUpperCase() in this.mappingValue) {
      id = this.mappingValue[id.toUpperCase()];
    }
    return id;
  }

  /**
   * Constrain value in 0 to 255 range
   * @private
   * @param {String} value
   * @return {int}
   */
  _safe_Uint8_t(value) {
    return Math.min(Math.max(parseInt(value), 0), 255) || 0;
  }
}

module.exports = GamepadHandler;
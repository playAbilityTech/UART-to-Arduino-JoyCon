const { delay } = require('../utils');

/**
 * Handle Mapping Midi message to Gamepad Serial Arduino
 * @param {Object} obj Gamepad object
 * @param {string} inputName
 * @param {Object} msg Midi message
 * @callback sendState Trigger if state need to be updated
 */
const DemoMidiMapping = (gamepadSerial, inputName, msg, sendState = () => {}) => {
  console.log(inputName, msg);
  var send_state = true;

  switch (msg.note) {
    case 50:
      gamepadSerial.setButton("A", +(msg._type == 'noteon'));
      break;
    case 62:
      gamepadSerial.setButton("R", 1);
      delay(1000).then(() => {
        gamepadSerial.setButton("R", 0);
        sendState();
      });

      gamepadSerial.setLeftAxisDirection("UP");
      delay(200).then(() => {
        gamepadSerial.setLeftAxisDirection("RELEASE");
        sendState();
      });
      break;
    case 53:
      gamepadSerial.setHat(msg._type == 'noteon' ? "DOWN" : "RELEASE");
      break;
    default:
      send_state = false;
  }

  if (send_state) sendState();
}

module.exports = DemoMidiMapping;
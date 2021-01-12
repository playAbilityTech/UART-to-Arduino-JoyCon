const { delay } = require('../utils');

/**
 * Handle Mapping Midi message to Gamepad Serial Arduino
 * @param {Object} obj Gamepad object
 * @param {string} inputName
 * @param {Object} msg Midi message
 * @callback sendState Trigger if state need to be updated
 */
const DemoMidiMapping = (gamepadSerial, inputName, msg, sendState = () => {}) => {
  //if (msg._type == 'noteoff') return;
  console.log(inputName, msg);
  var send_state = true;

  //gamepadSerial.setMode(1); // Disable IMU and use Serial Joystick

  switch (msg.note) {
    //Bouton B (51) et Bouton A (42)
    case 51:
      gamepadSerial.pressButton("B");
      delay(500).then(() => {
        gamepadSerial.releaseButton("B");
        sendState();
      });
      break;
    case 42:
      gamepadSerial.pressButton("A");
      delay(500).then(() => {
        gamepadSerial.releaseButton("A");
        sendState();
      });
      break;
    //gachettes gauche (49) et droite  (57)
    case 49:
      gamepadSerial.pressButton("ZL");
      delay(500).then(() => {
        gamepadSerial.releaseButton("ZL");
        sendState();
      });
      break;
    case 57:
      gamepadSerial.pressButton("ZR");
      delay(500).then(() => {
        gamepadSerial.releaseButton("ZR");
        sendState();
      });
      break;
    //gauche (50) devant (36) droite (48) reculer (44)
    case 50:
      gamepadSerial.setLeftAxisX(0);
      delay(500).then(() => {
        gamepadSerial.setLeftAxisX(128);
        sendState();
      });
      break;
    case 36:
      gamepadSerial.setLeftAxisY(0);
      delay(500).then(() => {
        gamepadSerial.setLeftAxisY(128);
        sendState();
      });
      break;
    case 48:
      gamepadSerial.setLeftAxisX(255);
      delay(500).then(() => {
        gamepadSerial.setLeftAxisX(128);
        sendState();
      });
      break;
    case 44:
      gamepadSerial.setLeftAxisY(255);
      delay(500).then(() => {
        gamepadSerial.setLeftAxisY(128);
        sendState();
      });
      break;
    // coups X(38) et Y (45)
    case 38:
      gamepadSerial.pressButton("X");
      delay(500).then(() => {
        gamepadSerial.releaseButton("X");
        sendState();
      });
      break;
    case 45:
      gamepadSerial.pressButton("Y");
      delay(500).then(() => {
        gamepadSerial.releaseButton("Y");
        sendState();
      });
      break;
    default:
      send_state = false;
  }

  if (send_state) sendState();
}

module.exports = DemoMidiMapping;
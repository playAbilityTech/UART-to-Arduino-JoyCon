//https://xaviergeerinck.com/post/coding/javascript/xbox-controller
const puppeteer = require('puppeteer');
const EventEmitter = require('events').EventEmitter;
const buttons = require('./mapping.json');
class GameController {
  constructor() {
    this.eventEmitter = new EventEmitter();
    this.SIGNAL_POLL_INTERVAL_MS = 10; // 10 = 100hz
    this.THUMBSTICK_NOISE_THRESHOLD = 0.15;
    this.gp_input_mapping = null;
  }
  on(event, cb) {
    this.eventEmitter.on(event, cb);
  }
  off(event, cb) {
    this.eventEmitter.off(event, cb);
  }
  offAll(event) {
    this.eventEmitter.removeAllListeners(event);
  }
  updateMapping(obj) {
    //this.gp_input_mapping = obj;
  }
  async init() {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    // Expose a handler to the page
    await page.exposeFunction('sendEventToProcessHandle', (event, msg) => {
      this.eventEmitter.emit(event, msg);
    });
    await page.exposeFunction('sendEventToJoyHandle', (id, type, index, value) => {
      var output = id;
      if (this.gp_input_mapping != null) {
        var key = `JOY_INPUT_${id}`;
        if (key in this.gp_input_mapping) {
          output = this.gp_input_mapping[key];
          this.eventEmitter.emit(`joy:${output}:${type}:${index}`, value);
        }
        else {
          return;
        }
      }
      this.eventEmitter.emit(`joy:${output}:${type}:${index}`, value);
    });
    await page.exposeFunction('consoleLog', (e) => {
      console.log(e);
    });
    // listen for events of type 'status' and
    // pass 'type' and 'detail' attributes to our exposed function
    await page.evaluate(([ buttons, SIGNAL_POLL_INTERVAL_MS, THUMBSTICK_NOISE_THRESHOLD ]) => {
      function map(value, in_min, in_max, out_min, out_max) {
        return (value - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
      }

      window.consoleLog("[INFO] To detect gamepad press buttons to wake it up.");

      let interval = {};
      window.addEventListener("gamepadconnected", (e) => {
        // e.gamepad.vibrationActuator.playEffect("dual-rumble", {
        //   startDelay: 0,
        //   duration: 1000,
        //   weakMagnitude: 1.0,
        //   strongMagnitude: 1.0
        // });

        let gp = navigator.getGamepads()[e.gamepad.index];
        window.sendEventToProcessHandle('GAMEPAD_CONNECTED', {
          index: gp.index,
          id: gp.id,
          buttons: gp.buttons,
          axes: gp.axes
        });
        var lastState = "";
        var lastAxisState = "";
        var buttonsStatus = [];
        interval[e.gamepad.index] = setInterval(() => {
          gp = navigator.getGamepads()[e.gamepad.index];
          // [
          //    0 = THUMBSTICK_LEFT_LEFT_RIGHT,
          //    1 = THUMBSTICK_LEFT_UP_DOWN,
          //    2 = THUMBSTICK_RIGHT_LEFT_RIGHT,
          //    3 = THUMBSTICK_RIGHT_UP_DOWN
          // ]
          // let sum = gp.axes.reduce((a, b) => a + b, 0);
          // if (Math.abs(sum) > THUMBSTICK_NOISE_THRESHOLD) {
          //   window.sendEventToProcessHandle('thumbsticks', {
          //     gpIndex: e.gamepad.index,
          //     axis: gp.axes
          //   });
          // }
          var axis = [...gp.axes];
          for (var i = 0; i < axis.length; i++) {
            // remove Deadzone
            if (Math.abs(axis[i]) <= THUMBSTICK_NOISE_THRESHOLD) {
              axis[i] = map(0, -0.95, 0.94, -1, 1);
            }
            else if (axis[i] > THUMBSTICK_NOISE_THRESHOLD) {
              axis[i] = map(axis[i], THUMBSTICK_NOISE_THRESHOLD, 0.95, 0, 1);
            }
            else if (axis[i] < THUMBSTICK_NOISE_THRESHOLD) {
              axis[i] = map(axis[i], -THUMBSTICK_NOISE_THRESHOLD, -0.95, -0, -1);
            }
            //window.sendEventToProcessHandle(`joy:${gp.index}:axis:${i}`, axis[i]);
            if (lastAxisState[i] != axis[i])
              window.sendEventToJoyHandle(gp.index, 'axis', i, axis[i]);
          }

          lastAxisState = axis

          for (let i = 0; i < gp.buttons.length; i++) {
            // status changed
            if (gp.buttons[i].pressed !== buttonsStatus[i] && buttonsStatus.length >= gp.buttons.length) {
              // window.sendEventToProcessHandle(buttons[i]);
              //window.sendEventToProcessHandle(`joy:${gp.index}:button:${i}`, gp.buttons[i].pressed);
              window.sendEventToJoyHandle(gp.index, 'button', i, gp.buttons[i].pressed);
            }
            buttonsStatus[i] = gp.buttons[i].pressed;
          }

          var stateString = axis.join(',') + ',' + gp.buttons.map(a => a.pressed).join(',');

          if (lastState != stateString) {
            window.sendEventToJoyHandle(gp.index, 'update', 0, {
              index: gp.index,
              id: gp.id,
              axes: axis,
              buttons: gp.buttons.map(a => a.pressed)
            });
            // window.sendEventToProcessHandle(`joy:update`, {
            //   index: gp.index,
            //   id: gp.id,
            //   axes: axis,
            //   buttons: gp.buttons.map(a => a.pressed)
            // });
          }
          lastState = stateString;
        }, SIGNAL_POLL_INTERVAL_MS);
      });
      window.addEventListener("gamepaddisconnected", (e) => {
        window.sendEventToProcessHandle('GAMEPAD_DISCONNECTED', {
          index: e.gamepad.index,
          id: e.gamepad.id
        });
        //window.consoleLog("Gamepad disconnected at index " + e.gamepad.index);
        clearInterval(interval[e.gamepad.index]);
      });
    }, [ buttons, this.SIGNAL_POLL_INTERVAL_MS, this.THUMBSTICK_NOISE_THRESHOLD ]);
  }
}
module.exports = GameController;
//https://xaviergeerinck.com/post/coding/javascript/xbox-controller
const puppeteer = require('puppeteer');
const EventEmitter = require('events').EventEmitter;
const buttons = require('./mapping.json');
class GameController {
  constructor() {
    this.eventEmitter = new EventEmitter();
    this.SIGNAL_POLL_INTERVAL_MS = 10; // 10 = 100hz
    this.THUMBSTICK_NOISE_THRESHOLD = 0.15;
  }
  on(event, cb) {
    this.eventEmitter.on(event, cb);
  }
  async init() {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    // Expose a handler to the page
    await page.exposeFunction('sendEventToProcessHandle', (event, msg) => {
      this.eventEmitter.emit(event, msg);
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

      let interval = {};
      window.addEventListener("gamepadconnected", (e) => {
        // e.gamepad.vibrationActuator.playEffect("dual-rumble", {
        //   startDelay: 0,
        //   duration: 1000,
        //   weakMagnitude: 1.0,
        //   strongMagnitude: 1.0
        // });
        let gp = navigator.getGamepads()[e.gamepad.index];
        window.sendEventToProcessHandle('GAMEPAD_CONNECTED');
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
              axis[i] = map(0, -0.99, 0.98, -1, 1);
            }
            else if (axis[i] > THUMBSTICK_NOISE_THRESHOLD) {
              axis[i] = map(axis[i], THUMBSTICK_NOISE_THRESHOLD, 0.98, 0, 1);
            }
            else if (axis[i] < THUMBSTICK_NOISE_THRESHOLD) {
              axis[i] = map(axis[i], -THUMBSTICK_NOISE_THRESHOLD, -0.99, -0, -1);
            }
            window.sendEventToProcessHandle(`joy:${e.gamepad.index}:axis:${i}`, axis[i]);
          }

          for (let i = 0; i < gp.buttons.length; i++) {
            // status changed
            if (gp.buttons[i].pressed !== buttonsStatus[i] && buttonsStatus.length >= gp.buttons.length) {
              // window.sendEventToProcessHandle(buttons[i]);
              window.sendEventToProcessHandle(`joy:${e.gamepad.index}:button:${i}`, gp.buttons[i].pressed);
            }
            buttonsStatus[i] = gp.buttons[i].pressed;
          }

          window.sendEventToProcessHandle(`joy:update`, {
            index: gp.index,
            id: gp.id,
            axes: axis,
            buttons: gp.buttons.map(a => a.pressed)
          });
        }, SIGNAL_POLL_INTERVAL_MS);
      });
      window.addEventListener("gamepaddisconnected", (e) => {
        window.sendEventToProcessHandle('GAMEPAD_DISCONNECTED');
        window.consoleLog("Gamepad disconnected at index " + gp.index);
        clearInterval(interval[e.gamepad.index]);
      });
    }, [ buttons, this.SIGNAL_POLL_INTERVAL_MS, this.THUMBSTICK_NOISE_THRESHOLD ]);
  }
}
module.exports = GameController;
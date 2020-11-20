const BUTTONS = {
  Y: 0,
  B: 1,
  A: 2,
  X: 3,
  L: 4,
  R: 5,
  ZL: 6,
  ZR: 7,
  MINUS: 8,
  PLUS: 9,
  LSTICK: 10,
  RSTICK: 11,
  HOME: 12,
  CAPTURE: 13,
};
const HAT = {
  UP: 0,
  RIGHT: 2,
  DOWN: 4,
  LEFT: 6,
  RELEASE: 255,
};
const JOYSTICK = {
  UP: {x: 128, y: 0},
  RIGHT: {x: 255, y: 128},
  DOWN: {x: 128, y: 255},
  LEFT: {x: 0, y: 128},
  RELEASE: {x: 128, y: 128}
};

module.exports = {
  BUTTONS,
  HAT,
  JOYSTICK,
}
const BUTTONS = {
  Y: 0,
  B: 1,
  A: 2,
  X: 3,
  SHOULDER_LEFT: 4,
  SHOULDER_RIGHT: 5,
  TRIGGER_LEFT: 6,
  TRIGGER_RIGHT: 7,
  BACK: 8,
  START: 9,
  STICK_L_CLICK: 10,
  STICK_R_CLICK: 11,
  HOME: 12,
  CAPTURE: 13,
};
const HAT = {
  D_PAD_UP: 0,
  D_PAD_RIGHT: 2,
  D_PAD_DOWN: 4,
  D_PAD_LEFT: 6,
  RELEASE: 255,
};
const JOYSTICK = {
  UP: {x: 128, y: 0},
  RIGHT: {x: 255, y: 128},
  DOWN: {x: 128, y: 255},
  LEFT: {x: 0, y: 128},
  RELEASE: {x: 128, y: 128}
};
const STICKS = {
  LEFT_STICK_X: ['joyLeft', 'x'],
  LEFT_STICK_Y: ['joyLeft', 'y'],
  RIGHT_STICK_X: ['joyRight', 'x'],
  RIGHT_STICK_Y: ['joyRight', 'y']
};

module.exports = {
  BUTTONS,
  HAT,
  JOYSTICK,
  STICKS,
}
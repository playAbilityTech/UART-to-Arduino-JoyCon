const express = require('express');
const app = express();
const SerialPort = require("serialport");
const jspack = require("jspack").jspack;

var gamepad = {
  button: [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  joyLeft: {
    x: 128,
    y: 128,
  },
  joyRight: {
    x: 128,
    y: 128,
  },
  hat: 0,
  mode: 0,
};

const port = 3000;

const arduinoCOMPort = "/dev/tty.SLAB_USBtoUART";

SerialPort.list().then(
  ports => ports.forEach(port => console.log(port.path)),
  err => console.error(err)
)

const arduinoSerialPort = new SerialPort(arduinoCOMPort, {
  baudRate: 115200
})

arduinoSerialPort.on('open',function() {
  console.log('Serial Port ' + arduinoCOMPort + ' is opened.');
});

app.get('/', function (req, res) {
  return res.send('Working');
})

app.get('/button/:id', function (req, res) {
  var id = req.params.id || req.param('id');

  var result = pressButton(id);
  return res.send(result);
});

app.listen(port, function () {
  console.log('Example app listening on port http://0.0.0.0:' + port + '!');
});

function pressButton(id) {
  if(gamepad.button[id] !== undefined) {
    gamepad.button[id] = 1;
    arduinoSerialPort.write(gamepad2String(gamepad));
    setTimeout(() => {
      gamepad.button[id] = 0;
      arduinoSerialPort.write(gamepad2String(gamepad));
    }, 500);

    return `Button ${id} pressed !`;
  }
  else {
    return 'Wrong Button id !';
  }
}

function gamepad2String(g) {
  return jspack.Pack(
    `B${g.button.length}ABBBBBBB`, [
      42,
      g.button,
      g.joyLeft.x, g.joyLeft.y,
      g.joyRight.x, g.joyRight.y,
      g.hat,
      g.mode,
      43
    ]);
}
const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http, {
  pingInterval: 25000,
  pingTimeout: 60000,
});
const bodyParser = require('body-parser');
const cors = require('cors');

const nconf = require('nconf');
nconf.use('file', { file: './config.json' });
nconf.load();

// APP

const PORT = 3000;
let ip = require('ip').address();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());

app.get('/', function (req, res) {
  res.sendFile(__dirname + '/index.html');
});

io.on('connection', (socket) => {
  console.log('a user connected');

  socket.on('message', function(msg) {
    console.log('message', msg);
  });

  socket.on('error', function(error) {
    console.log('error', error);
  });

  socket.on('disconnect', (error) => {
    console.log('user disconnected', error);
  });

  io.sockets.emit("GAMEPAD", gamepad);

  socket.on('UPDATE_GAMEPAD', function(payload) {
    sendToArduino(payload);
  });

  socket.on('CHANGE_SERIAL_PORT', function(port) {
    arduinoPort = port;
    saveConf();
    io.sockets.emit("UPDATE_PORT", arduinoPort);
  });

  socket.on('OPEN_SERIAL', function() {
    openSerial();
  });

  socket.on('CLOSE_SERIAL', function() {
    closeSerial();
  });

  socket.on('GET_PORT_LIST', function() {
    getPortList();
  });

  getPortList();

  io.sockets.emit("MESSAGE", messages);

  io.sockets.emit("UPDATE_PORT", arduinoPort);

  io.sockets.emit("MAPPING", mapping);
});

var server = http.listen(PORT, () => {
  console.log(`App running on port ${PORT}!`);
  console.log(`listening to server on: http://${ip}:${PORT}`);
});


/*** SERIAL UART ***/

const SerialPort = require("serialport");
const jspack = require("jspack").jspack;

const mapping = BTN = require('./mapping.js').switchProController;

// UART package structre
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
  hat: 10,
  mode: 0,
};

var arduinoPort = nconf.get('port') || '';
var arduinoSerial = {};

const MAX_DEBUG_OUTPUT_LINES = 60;
var messages = [];

function closeSerial() {
  if (arduinoSerial.isOpen) {
    arduinoSerial.close();
  }
}

function openSerial() {
  messages = [];
  closeSerial();
  if (!arduinoPort) return;
  try {
    sendLog('Opening port…');
    arduinoSerial = new SerialPort(arduinoPort, {
      baudRate: 115200,
      stopBits: 2
    });
    arduinoSerial.on('open',function() {
      sendLog(`Serial port '${arduinoPort}' is opened.`);
    });

    arduinoSerial.on('close', () => {
      sendLog(`Serial port '${arduinoPort}' closed.`);
    });

    arduinoSerial.on('error', (err) => {
      sendLog(err.toString());
    });
  } catch (err) {
    sendLog("ERROR opening port " + err);
  }
}

openSerial();

function sendToArduino(obj) {
  if (arduinoSerial.isOpen) {
    arduinoSerial.write(gamepad2String(obj));
    sendLog('SEND RX: ' + gamepad2String(obj));
  }
}

function getPortList() {
  SerialPort.list().then(
    ports => {
      //console.log(ports);
      io.sockets.emit("PORT_LIST", ports);
    },
    err => {
      console.error(err);
      io.sockets.emit("MESSAGE", err);
    }
  );
}

function sendLog(msg, logit = true) {
  if (logit) console.log(msg);
  messages.push(msg);
  if (messages.length >= MAX_DEBUG_OUTPUT_LINES) {
    messages.shift();
  }
  io.sockets.emit("MESSAGE", messages);
}

function saveConf() {
  nconf.set('port', arduinoPort);

  nconf.save(function (err) {
    if (err) {
      console.error(err.message);
      return;
    }
    console.log('Configuration saved successfully.');
  });
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


/*** MIDI ***/

const easymidi = require('easymidi');
var midi_received = false;

easymidi.getInputs().forEach((inputName) => {
  const input = new easymidi.Input(inputName);
  input.on('message', (msg) => {
    handleMIDI(inputName, msg);
    midi_received = true;
  });
});

function handleMIDI(inputName, msg) {
  console.log(inputName, msg);
  sendLog(`MIDI In (${inputName}): Ch ${msg.channel+1}: Note ${msg.note} ${msg._type} velocity ${msg.velocity}`, false);

  switch (msg.note) {
    //Bouton B (51) et Bouton A (42)
    case 51:
    gamepad.button[BTN.B] = 1;
      setTimeout(() => {
        gamepad.button[BTN.B] = 0;
        midi_received = true;
      }, 500);
      break;
    case 42:
    gamepad.button[BTN.A] = 1;
      setTimeout(() => {
        gamepad.button[BTN.A] = 0;
        midi_received = true;
      }, 500);
      break;
    //gachettes gauche (49) et droite  (57)
    case 49:
    gamepad.button[BTN.ZL] = 1;
      setTimeout(() => {
        gamepad.button[BTN.ZL] = 0;
        midi_received = true;
      }, 500);
      break;
    case 57:
      gamepad.button[BTN.ZR] = 1;
        setTimeout(() => {
          gamepad.button[BTN.ZR] = 0;
          midi_received = true;
        }, 500);
        break;
    //gauche (50) devant (36) droite (48) reculer (44)
    case 50:
      gamepad.joyLeft.x = 0;
        setTimeout(() => {
          gamepad.joyLeft.x = 128;
          midi_received = true;
        }, 500);
        break;
    case 36:
      gamepad.joyLeft.y = 0;
        setTimeout(() => {
          gamepad.joyLeft.y = 128;
          midi_received = true;
        }, 500);
        break;
    case 48:
      gamepad.joyLeft.x = 255;
        setTimeout(() => {
          gamepad.joyLeft.x = 128;
          midi_received = true;
        }, 500);
        break;
    case 44:
      gamepad.joyLeft.y = 255;
        setTimeout(() => {
          gamepad.joyLeft.y = 128;
          midi_received = true;
        }, 500);
        break;
    // coups X(38) et Y (45)
    case 38:
    gamepad.button[BTN.X] = 1;
      setTimeout(() => {
        gamepad.button[BTN.X] = 0;
        midi_received = true;
      }, 500);
      break;
    case 45:
      gamepad.button[BTN.Y] = 1;
        setTimeout(() => {
          gamepad.button[BTN.Y] = 0;
          midi_received = true;
        }, 500);
        break;

    case 53:
      // the value of the hat switch is from 0° to 360°, but in 45° increments.
      // so we use a multiplier of 45
      // send value from 0 to 8. Set the value to 255 to release the hat switch
      gamepad.hat = msg._type == 'noteon' ? 4 : 255; // ex: 4 = 4*45 = 180° = ⇩
      break;
  }
}

setInterval(() => {
  if (midi_received) {
    sendToArduino(gamepad);
    midi_received = false;
  }
}, 10);

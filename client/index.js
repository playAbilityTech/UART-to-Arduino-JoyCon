const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http, {
  pingInterval: 25000,
  pingTimeout: 60000,
});
const bodyParser = require('body-parser');
const cors = require('cors');

const PORT = 3000;
let ip = require('ip').address();

var arduinoPort = '';


/*** APP ***/

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());

app.get('/', function (req, res) {
  res.sendFile(__dirname + '/index.html');
});

io.on('connection', (socket) => {
  console.log('a user connected');

  socket.on('message', (msg) => {
    console.log(msg);
  });

  socket.on('disconnect', (error) => {
    console.log('user disconnected', error);
  });

  socket.on('UPDATE_GAMEPAD', function(data) {
    gamepadSerial.setState(data);
    gamepadSerial.sendState((payload) => {
      sendLog('SEND: ' + payload, false);
    });
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
    sendLog(`Serial port closed.`, false);
    gamepadSerial.close();
  });

  socket.on('GET_PORT_LIST', function() {
    getPortList();
  });

  getPortList();

  io.sockets.emit("GAMEPAD", gamepadSerial.getState());
  io.sockets.emit("MESSAGE", messages);
  io.sockets.emit("UPDATE_PORT", arduinoPort);
  io.sockets.emit("MAPPING", gamepadSerial.getButtonsMapping());
});

var server = http.listen(PORT, () => {
  console.log(`App running on port ${PORT}!`);
  console.log(`listening to server on: http://${ip}:${PORT}`);
});


/*** LOG MESSAGES ***/

const MAX_DEBUG_OUTPUT_LINES = 60;
var messages = [];

function sendLog(msg, logit = true) {
  if (logit) console.log(msg);
  messages.push(msg);
  if (messages.length >= MAX_DEBUG_OUTPUT_LINES) {
    messages.shift();
  }
  io.sockets.emit("MESSAGE", messages);
}


/*** CONFIG ***/

const nconf = require('nconf');
nconf.use('file', { file: './config.json' });
nconf.load();
arduinoPort = nconf.get('port') || '';

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


/*** SERIAL UART ***/

const SerialPort = require("serialport");
const GamepadHandler = require("./gamepad-uart");
var gamepadSerial = new GamepadHandler();

gamepadSerial.on('open', () => {
  sendLog(`Serial port is opened.`, false);
});
gamepadSerial.on('close', (port) => {
  //sendLog(`Serial port ${port} closed.`, false);
});
gamepadSerial.on('error', (err) => {
  sendLog('error' + err.toString(), false);
});

gamepadSerial.on('stateChange', (state) => {
  io.sockets.emit("GAMEPAD", state);
});

function openSerial() {
  messages = [];
  io.sockets.emit("MESSAGE", messages);
  gamepadSerial.connect({
    portPath: arduinoPort,
    initAutoSendState: false
  });
}
openSerial();

function getPortList() {
  SerialPort.list().then(
    ports => {
      //console.log(ports);
      io.sockets.emit("PORT_LIST", ports);
    },
    err => {
      sendLog(err);
    }
  );
}


/*** MIDI ***/

const easymidi = require('easymidi');
var midi_received = false;

const midiHandler = require('./midiHandlers/demo');

// Get message from all midi input and all channels
easymidi.getInputs().forEach((inputName) => {
  const input = new easymidi.Input(inputName);
  input.on('message', (msg) => {
    sendLog(`MIDI In (${inputName}): Ch ${msg.channel+1}: Note ${msg.note} ${msg._type} velocity ${msg.velocity}`, false);
    midiHandler(gamepadSerial, inputName, msg, () => {
      midi_received = true;
    });
  });
});

// Send state outside off the MIDI loop
// for better performance.
setInterval(() => {
  if (midi_received) {
    gamepadSerial.sendState((payload) => {
      sendLog('SEND: ' + payload, false);
    });
    midi_received = false;
  }
}, 10);
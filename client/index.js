const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http, {
  pingInterval: 25000,
  pingTimeout: 60000,
});
const bodyParser = require('body-parser');
const cors = require('cors');

if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const PlayerID = process.env["PLAYER"] || 0;

var PORT = 3000;
if (process.env["PORT"]) {
  PORT = process.env["PORT"];
} else if (!isNaN(PlayerID)) {
  PORT = PORT + parseInt(PlayerID);
}
let ip = require('ip').address();

var arduinoPort = '';
var tcpHostIP = '';
var tcpHostPort = '';
var useTCP = false;
var useSerial = false;


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
    gamepadSerial.sendState((payload, senders) => {
      sendLog(`SEND: (${senders.toString()}) ${payload}`, false);
    });
  });

  socket.on('CHANGE_SERIAL_PORT', function(port) {
    arduinoPort = port || '';
    saveConf();
    io.sockets.emit("UPDATE_PORT", arduinoPort);
  });

  socket.on('OPEN_SERIAL', function() {
    useSerial = true;
    saveConf();
    openSerial();
  });

  socket.on('CLOSE_SERIAL', function() {
    sendLog(`Serial port closed.`, false);
    useSerial = false;
    saveConf();
    gamepadSerial.close();
  });

  socket.on('GET_PORT_LIST', function() {
    getPortList();
  });

  getPortList();

  socket.on('CHANGE_TCP_HOST', function(hostIp, HostPort) {
    tcpHostIP = hostIp;
    tcpHostPort = HostPort;
    saveConf();
    //io.sockets.emit("UPDATE_TCP_HOST", tcpHostIP, tcpHostPort);
  });

  socket.on('OPEN_TCP', function() {
    useTCP = true;
    saveConf();
    openTCP();
  });
  socket.on('CLOSE_TCP', function() {
    useTCP = false;
    saveConf();
    gamepadSerial.closeTCP();
  });

  io.sockets.emit("PLAYER_ID", PlayerID);
  io.sockets.emit("GAMEPAD", gamepadSerial.getState());
  io.sockets.emit("MESSAGE", messages);
  io.sockets.emit("UPDATE_PORT", arduinoPort);
  io.sockets.emit("UPDATE_TCP_HOST", tcpHostIP, tcpHostPort);
  io.sockets.emit("MAPPING", gamepadSerial.getButtonsMapping());
  io.sockets.emit("UPDATE_CONFIG", {
    useTCP: useTCP,
    useSerial: useSerial
  });
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
arduinoPort = nconf.get(`Config${PlayerID}:port`) || '';
tcpHostIP = nconf.get(`Config${PlayerID}:tcp-ip`) || '';
tcpHostPort = nconf.get(`Config${PlayerID}:tcp-port`) || '2323';
useSerial = nconf.get(`Config${PlayerID}:useSerial`) || false;
useTCP = nconf.get(`Config${PlayerID}:useTCP`) || false;

function saveConf() {
  //nconf.load();
  nconf.set(`Config${PlayerID}:useSerial`, useSerial);
  nconf.set(`Config${PlayerID}:port`, arduinoPort);
  nconf.set(`Config${PlayerID}:useTCP`, useTCP);
  nconf.set(`Config${PlayerID}:tcp-ip`, tcpHostIP);
  nconf.set(`Config${PlayerID}:tcp-port`, tcpHostPort);

  nconf.save(function (err) {
    if (err) {
      console.error(err.message);
      return;
    }
    console.log('Configuration saved successfully.');
  });
}


/*** GAMEPAD ***/

const GamepadHandler = require("./gamepad-uart");
var gamepadSerial = new GamepadHandler();


/*** SERIAL UART ***/

const SerialPort = require("serialport");

gamepadSerial.on('open', () => {
  sendLog(`[Serial] port is opened.`, false);
});
gamepadSerial.on('close', (port) => {
  //sendLog(`Serial port ${port} closed.`, false);
});
gamepadSerial.on('error', (err) => {
  sendLog('[Serial] ' + err.toString(), false);
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


/*** TCP ***/

gamepadSerial.on('tcp:connect', () => {
  sendLog('[TCP] connected', false);
});

gamepadSerial.on('tcp:close', (msg) => {
  sendLog('[TCP] ' + msg, false);
});

gamepadSerial.on('tcp:error', (err) => {
  sendLog('[TCP] ' + err, false);
});

function openTCP() {
  if (!tcpHostIP) return;
  sendLog('[TCP] connecting…');
  gamepadSerial.connectTCP({
    ip: tcpHostIP,
    port: tcpHostPort
  });
}
openTCP();

/*** MIDI ***/

const easymidi = require('easymidi');
var midi_received = false;

const midiHandler = require('./midiHandlers/hyruleBasic');

// Get message from all midi input and all channels
easymidi.getInputs().forEach((inputName) => {
  const input = new easymidi.Input(inputName);
  input.on('message', (msg) => {
    if (PlayerID && !isNaN(PlayerID) && msg.channel+1 != PlayerID) return;
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
    gamepadSerial.sendState((payload, senders) => {
      sendLog(`SEND: (${senders.toString()}) ${payload}`, false);
      io.sockets.emit("GAMEPAD", gamepadSerial.getState());
    });
    midi_received = false;
  }
}, 10);


/*** HID ***/

const Gamecontroller = require('./lib/gamecontroller');
const ctrl = new Gamecontroller('xbox360');
// const Vendors = require('./lib/vendors.js');
// ctrl._vendor = Vendors['xbox360'];
/*
var dev = Gamecontroller.getDevices();

try {
  ctrl.connect(function() {
      console.log('Game On!');
      ctrl.setLed(0x08);
  });
} catch (e) {
  console.log("[HID] cannot open device !");
}

ctrl.on('X:press', function() {
    console.log('X was pressed');
});

ctrl.on('X:release', function() {
    console.log('X was released');
});

ctrl.on('data', function(data) {
console.log(data);
  gamepadSerial.sendState((payload, senders) => {
    sendLog(`SEND: (${senders.toString()}) ${payload}`, false);
    io.sockets.emit("GAMEPAD", gamepadSerial.getState());
  });
});
*/
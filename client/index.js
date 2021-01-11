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

const PORT = process.env["PORT"] || 3000;
let ip = require('ip').address();

/*** APP ***/

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());

app.get('/', function (req, res) {
  res.sendFile(__dirname + '/index.html');
});

app.get('/:id', function (req, res) {
  res.sendFile(__dirname + '/controls.html');
});

io.on('connection', (socket) => {
  console.log('a user connected');

  socket.on('message', (msg) => {
    console.log(msg);
  });

  socket.on('disconnect', (error) => {
    console.log('user disconnected', error);
  });

  socket.on('UPDATE_GAMEPAD', function(index, data) {
    console.log(index, data);
    gamepads[index].setState(data);
    gamepads[index].sendState((payload, senders) => {
      sendLog(`SEND: (${senders.toString()} ${index}) ${payload}`, false);
    });
  });

  socket.on('CHANGE_SERIAL_PORT', function(index, port) {
    gamepadsConfig[index].serial_port = port || '';
    saveConf();
    io.sockets.emit("UPDATE_PORT", index, gamepadsConfig[index].serial_port);
  });

  socket.on('OPEN_SERIAL', function(index) {
    gamepadsConfig[index].serial_enabled = true;
    saveConf();
    gamepads[index].openSerial();
  });

  socket.on('CLOSE_SERIAL', function(index) {
    gamepadsConfig[index].serial_enabled = false;
    saveConf();
    gamepads[index].close();
  });

  socket.on('GET_PORT_LIST', function() {
    getPortList();
  });

  getPortList();

  socket.on('CHANGE_TCP_HOST', function(index, hostIp, HostPort) {
    gamepadsConfig[index].tcp_ip = hostIp;
    gamepadsConfig[index].tcp_port = HostPort;
    saveConf();
    io.sockets.emit("UPDATE_TCP_HOST", index, tcpHostIP, tcpHostPort);
  });

  socket.on('OPEN_TCP', function(index) {
    gamepadsConfig[index].tcp_enabled = true;
    saveConf();
    gamepads[index].openTCP();
  });
  socket.on('CLOSE_TCP', function(index) {
    gamepadsConfig[index].tcp_enabled = false;
    saveConf();
    gamepads[index].closeTCP();
  });

  io.sockets.emit("MESSAGE", messages);

  for (var i = 0; i < gamepads.length; i++) {
    io.sockets.emit("GAMEPAD", i, gamepads[i].getState());

    io.sockets.emit("MAPPING", i, gamepads[i].getButtonsMapping());
    io.sockets.emit("UPDATE_CONFIG", i, {
      useTCP: gamepadsConfig[i].tcp_enabled,
      useSerial: gamepadsConfig[i].serial_enabled
    });
    io.sockets.emit("UPDATE_TCP_HOST", i, gamepadsConfig[i].tcp_ip, gamepadsConfig[i].tcp_port);

    io.sockets.emit("UPDATE_PORT", i, gamepadsConfig[i].serial_port);
  }
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
nconf.env().argv();
nconf.use('file', { file: './config.json' });
nconf.load();
var gamepadSetConfig = nconf.get(`gamepad_set`) || {};
var JoyMappingConfig = nconf.get(`joy_input_mapping`) || [];
var gamepadsConfig = nconf.get(`gamepads`) || [{}];

function saveConf() {
  //nconf.load();
  nconf.set(`gamepads`, gamepadsConfig);
  nconf.set(`joy_input_mapping`, JoyMappingConfig);

  nconf.save(function (err) {
    if (err) {
      console.error(err.message);
      return;
    }
    console.log('Configuration saved successfully.');
  });
}


/*** MIDI ***/

const easymidi = require('easymidi');
const EventEmitter = require('events').EventEmitter;
var EventMIDI = new EventEmitter();
var midi_received = [];

// Get message from all midi input and all channels
easymidi.getInputs().forEach((inputName) => {
  console.log('MIDI', inputName);
  const input = new easymidi.Input(inputName);
  input.on('message', (msg) => {
    sendLog(`MIDI In (${inputName}): Ch ${msg.channel+1}: Note ${msg.note} ${msg._type} velocity ${msg.velocity}`, false);
    EventMIDI.emit('note', {
      inputName: inputName,
      msg: msg
    });
    // midiHandler(gamepadSerial, inputName, msg, () => {
    //   midi_received = true;
    // });
  });
});

// Send state outside off the MIDI loop
// for better performance.
setInterval(() => {
  for (var i = 0; i < midi_received.length; i++) {
    if (gamepadsConfig[i].midi_handler != null && midi_received[i]) {
      gamepads[i].sendState((payload, senders) => {
        sendLog(`SEND: (${senders.toString()} ${i}) ${payload}`, false);
        //io.sockets.emit("GAMEPAD", gamepadSerial.getState());
      });
      midi_received[i] = false;
    }
  }
}, 10);


/*** GAMEPADS ***/

const GamepadsHandler = require("./gamepad-uart");
var gamepads = [];

for (var i = 0; i < gamepadsConfig.length; i++) {
  //console.log(gamepadsConfig[i]);
  gamepads[i] = new GamepadsHandler();


  /*** SERIAL UART ***/

  gamepads[i].on('open', (path) => {
    sendLog(`[Serial] port '${path}' is opened.`, false);
  });
  gamepads[i].on('close', (port, err) => {
    if (!err) {
      sendLog(`[Serial] port ${port} closed.`, false);
    }
  });
  gamepads[i].on('error', (err) => {
    sendLog(`[Serial] ${err.toString()}`, false);
  });

  gamepads[i].on('stateChange', function(index, state) {
    io.sockets.emit("GAMEPAD", index, state);
  }.bind(null, i));

  gamepads[i].openSerial = function(i) {
    if (!gamepadsConfig[i].serial_port || !gamepadsConfig[i].serial_enabled) return;
    messages = [];
    io.sockets.emit("MESSAGE", messages);
    gamepads[i].connect({
      portPath: gamepadsConfig[i].serial_port,
      initAutoSendState: false
    });
  }.bind(null, i);
  gamepads[i].openSerial();


  /*** TCP ***/

  gamepads[i].on('tcp:connect', () => {
    sendLog('[TCP] connected', false);
  });

  gamepads[i].on('tcp:close', (msg) => {
    sendLog('[TCP] ' + msg, false);
  });

  gamepads[i].on('tcp:error', (err) => {
    sendLog('[TCP] ' + err, false);
  });

  gamepads[i].openTCP = function(i) {
    if (!gamepadsConfig[i].tcp_ip || !gamepadsConfig[i].tcp_enabled) return;
    sendLog('[TCP] connecting…');
    gamepads[i].connectTCP({
      ip: gamepadsConfig[i].tcp_ip,
      port: gamepadsConfig[i].tcp_port
    });
  }.bind(null, i);
  gamepads[i].openTCP();


  /*** MIDI ***/

  if (gamepadsConfig[i].midi_handler) {
    let midiHandler = require(`./midiHandlers/${gamepadsConfig[i].midi_handler}`);
    EventMIDI.on('note', function(index, data) {
      midiHandler(gamepads[index], data.inputName, data.msg, () => {
        midi_received[index] = true;
      });
    }.bind(null, i));
  }

}


/*** SERIAL UART ***/
const SerialPort = require("serialport");

function getPortList(log=false) {
  SerialPort.list().then(
    ports => {
      if (log) console.log("Serial ports available:", ports.map(a => a.path));
      io.sockets.emit("PORT_LIST", ports);
    },
    err => {
      sendLog(err);
    }
  );
}
getPortList(true);


/*** HID ***/
const Utils = require('./utils');
const GameController = require('./gamepadHandlers/GameController');

const loadConfig = async () => {
  const gameController = new GameController();
  await gameController.init();

  for (var i = 0; i < gamepadsConfig.length; i++) {
    var set = gamepadsConfig[i].gamepad_set || "default";
    var joy = 'joy_input' in gamepadsConfig[i] ? gamepadsConfig[i].joy_input : 0;
    if (typeof set == "string") {
      set = set in gamepadSetConfig ? gamepadSetConfig[set] : gamepadSetConfig["default"];
    }
    var joy_listeners = [];
    for (var key in set) {
      if (set.hasOwnProperty(key)) {
        var action = set[key];
        var id = 'joy' in action ? action.joy : joy;
        joy_listeners[id] = true;
        gameController.on(`joy:${id}:${action.type}:${action.value}`, triggerAction.bind(null, i, key, action));
      }
    }
    if (joy_listeners.length <= 0) {
      joy_listeners[joy] = true;
    }

    for (let j = 0; j < joy_listeners.length; j++) {
      if (joy_listeners[j]) {
        gameController.on(`joy:${j}:update:0`, function(index, gp) {
          //if (!gamepadsConfig[index].gamepad_set == null) return;
          //if (gamepadsConfig[index].joy_listeners[index]) {
            //update if listening on the gamepad
            gamepads[index].sendState( function(index, payload, senders) {
              sendLog(`SEND: (${senders.toString()} ${index}) ${payload}`, false);
            }.bind(null, index));
          //}
        }.bind(null, i));
      }
    }
  }

  //saveConf();

  gameController.updateMapping(JoyMappingConfig);

  gameController.on(`GAMEPAD_CONNECTED`, (gp) => {
    console.log("Gamepad connected at index %d: %s. %d buttons, %d axes.",
    gp.index, gp.id,
    gp.buttons.length, gp.axes.length);
  });

  gameController.on(`GAMEPAD_DISCONNECTED`, (id) => {

  });
};
loadConfig();

function triggerAction(index, key, action, value) {
  // console.log(key, action, value);
  if (action.type == 'button') {
    if (key.startsWith('D_PAD_')) {
      gamepads[index].setHat(value ? key : "RELEASE");
    }
    else {
      gamepads[index].setButton(key, value);
    }
  }
  if (action.type == 'axis') {
    gamepads[index].setAxis(key, Utils.map(value, -1, 1, 0, 255));
    //gamepads[index].setMode(1);
  }
}

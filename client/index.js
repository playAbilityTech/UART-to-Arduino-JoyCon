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

  //io.sockets.emit("GAMEPAD", gamepadSerial.getState());
  io.sockets.emit("MESSAGE", messages);

  //io.sockets.emit("MAPPING", gamepadSerial.getButtonsMapping());
  // io.sockets.emit("UPDATE_CONFIG", {
  //   useTCP: useTCP,
  //   useSerial: useSerial
  // });
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
nconf.argv();
nconf.env();
nconf.use('file', { file: './config.json' });
nconf.load();
var defaultGamepadsConfig = nconf.get(`default_gamepad_set`) || {};
var JoyMappingConfig = nconf.get(`joy_input_mapping`) || [];
var gamepadsConfig = nconf.get(`gamepads`) || [{}];

function saveConf() {
  //nconf.load();
  nconf.set(`gamepads`, gamepadsConfig);

  nconf.save(function (err) {
    if (err) {
      console.error(err.message);
      return;
    }
    console.log('Configuration saved successfully.');
  });
}


/*** GAMEPADS ***/

const GamepadsHandler = require("./gamepad-uart");
var gamepads = [];

for (var i = 0; i < gamepadsConfig.length; i++) {
  //console.log(gamepadsConfig[i]);
  gamepads[i] = new GamepadsHandler();

  gamepads[i].on('open', () => {
    sendLog(`[Serial ${i}] port is opened.`, false);
  });
  gamepads[i].on('close', (port) => {
    //sendLog(`Serial port ${port} closed.`, false);
  });
  gamepads[i].on('error', (err) => {
    sendLog(`[Serial ${i}] ${err.toString()}`, false);
  });

  gamepads[i].on('stateChange', (state) => {
    io.sockets.emit("GAMEPAD", i, state);
  });

  gamepads[i].openSerial = () => {
    if (!gamepadsConfig[i].serial_port || !gamepadsConfig[i].serial_enabled) return;
    messages = [];
    io.sockets.emit("MESSAGE", messages);
    gamepads[i].connect({
      portPath: gamepadsConfig[i].serial_port,
      initAutoSendState: false
    });
  }

  gamepads[i].openSerial();
}


/*** SERIAL UART ***/
const SerialPort = require("serialport");

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
//getPortList();


/*** TCP ***

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
  if (!tcpHostIP || !useTCP) return;
  sendLog('[TCP] connecting…');
  gamepadSerial.connectTCP({
    ip: tcpHostIP,
    port: tcpHostPort
  });
}
openTCP();

/*** MIDI ***

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
const Utils = require('./utils');
const GameController = require('./gamepadHandlers/GameController');

const loadConfig = async () => {
  const gameController = new GameController();
  await gameController.init();

  for (var i = 0; i < gamepadsConfig.length; i++) {
    var set = gamepadsConfig[i].gamepad_set;
    var joy = 0;
    if (Number.isInteger(set)) { //use default_gamepad_set
      joy = parseInt(set);
      set = defaultGamepadsConfig;
    }
    for (var key in set) {
      if (set.hasOwnProperty(key)) {
        var action = set[key];
        var id = action.joy || joy;
        gameController.on(`joy:${id}:${action.type}:${action.value}`, triggerAction.bind(null, i, key, action));
      }
    }
  }

  gameController.updateMapping(JoyMappingConfig);

  gameController.on(`GAMEPAD_CONNECTED`, (gp) => {
    console.log("Gamepad connected at index %d: %s. %d buttons, %d axes.",
    gp.index, gp.id,
    gp.buttons.length, gp.axes.length);
  });

  gameController.on(`GAMEPAD_DISCONNECTED`, (id) => {

  });

  gameController.on(`joy:update`, (gp) => {
    // console.log(gp);
    for (var i = 0; i < gamepads.length; i++) {
      gamepads[i].sendState((payload, senders) => {
        sendLog(`SEND: (${senders.toString()} ${i}) ${payload}`, false);
      });
    }
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
    gamepads[index].setMode(1);
  }
}
/*
    gameController.on('button', (btn) => {
      console.log(btn);
      for (var i = 0; i < gamepadsConfig.length; i++) {
        var set = gamepadsConfig[i].gamepad_set;
        let data = gamepads[i].getState();
        let send = false;
        for (var key in set) {
          if (set.hasOwnProperty(key)) {
            var action = set[key];
            if (action.type == 'button' && action.value == btn.index && action.joy == btn.gpIndex) {
              gamepads[i].setButton(key, btn.pressed);
              send = true;
            }
            if (action.type == 'hat' && action.value == btn.index && action.joy == btn.gpIndex) {
              gamepads[i].setHat(btn.pressed ? key : "RELEASE");
              send = true;
            }
            if (action.type == 'axis' && action.value == btn.index && action.joy == btn.gpIndex) {
              gamepads[i].setAxis(key, btn.pressed);
              send = true;
            }
          }
        }
        //console.log(data);
        if (send) {
          gamepads[i].setState(data);
          gamepads[i].sendState((payload, senders) => {
            sendLog(`SEND: (${senders.toString()}) ${payload}`, false);
          });
        }
      }
    })

    gameController.on('thumbsticks', (msg) => {
      // console.log(msg);
      for (var i = 0; i < gamepadsConfig.length; i++) {
        var set = gamepadsConfig[i].gamepad_set;
        let data = gamepads[i].getState();
        let send = false;
        for (var key in set) {
          if (set.hasOwnProperty(key)) {
            var action = set[key];
            if (action.type == 'axis' && action.value == btn.index && action.joy == btn.gpIndex) {
              //gamepads[i].setButton(key, btn.pressed);
              send = true;
            }
          }
        }
        //console.log(data);
        if (send) {
          gamepads[i].setState(data);
          gamepads[i].sendState((payload, senders) => {
            sendLog(`SEND: (${senders.toString()}) ${payload}`, false);
          });
        }
      }

      var data = gamepadSerial.getState();
      data.joyLeft.x = Utils.map(msg.axis[0], -1, 1, 0, 255);
      data.joyLeft.y = Utils.map(msg.axis[1], -1, 1, 0, 255);
      data.joyRight.x = Utils.map(msg.axis[2], -1, 1, 0, 255);
      data.joyRight.y = Utils.map(msg.axis[3], -1, 1, 0, 255);
      data.mode = 1;
      //console.log(data);
      gamepadSerial.setState(data);
      gamepadSerial.sendState((payload, senders) => {
        sendLog(`SEND: (${senders.toString()}) ${payload}`, false);
      });
    })
    */

//})();
/**/
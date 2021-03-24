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
    //console.log(index, data);
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

  socket.on('SET_MODIFIER', function(index, obj) {
    setModifier(index, obj.modifier, obj.value, obj.key);
  });

  socket.on('CHANGE_JOY', function(index, joyIndex) {
    console.log('CHANGE_JOY', index);
    detachGamepadListeners(index);
    gamepadsConfig[index].joy_input = !isNaN(parseInt(joyIndex)) ? parseInt(joyIndex) : "";
    saveConf();
    loadGamepadConfig(index);
    io.sockets.emit("UPDATE_JOY", joyIndex, gamepadsConfig[index].joy_input);
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

  socket.on('GET_PORT_LIST', function() {
    getPortList();
  });

  io.sockets.emit("MESSAGE", messages);
  io.sockets.emit("JOY_LIST", joyList);

  for (var i = 0; i < gamepads.length; i++) {
    io.sockets.emit("GAMEPAD", i, gamepads[i].getState());

    io.sockets.emit("MAPPING", i, gamepads[i].getButtonsMapping());
    io.sockets.emit("UPDATE_CONFIG", i, {
      useTCP: gamepadsConfig[i].tcp_enabled,
      useSerial: gamepadsConfig[i].serial_enabled
    });
    io.sockets.emit("UPDATE_TCP_HOST", i, gamepadsConfig[i].tcp_ip, gamepadsConfig[i].tcp_port);

    io.sockets.emit("UPDATE_PORT", i, gamepadsConfig[i].serial_port);
    io.sockets.emit("UPDATE_JOY", i, isNaN(gamepadsConfig[i].joy_input) ? "" : gamepadsConfig[i].joy_input);
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
  console.log('MIDI input', inputName);
  const input = new easymidi.Input(inputName);
  input.on('message', (msg) => {
    sendLog(`MIDI In (${inputName}): Ch ${msg.channel+1}: Note ${msg.note} ${msg._type} velocity ${msg.velocity}`, false);
    EventMIDI.emit('note', {
      inputName: inputName,
      msg: msg
    });
    // if (msg._type == "noteon")
    //   midiHandler(gamepads[1], inputName, msg, () => {
    //     midi_received = true;
    //   });
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
    if (!err || err.disconnected) {
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
    // messages = [];
    // io.sockets.emit("MESSAGE", messages);
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

  if (gamepadsConfig[i].midi_handler != null) {
    let midiHandler = require(`./midiHandlers/${gamepadsConfig[i].midi_handler}`);
    console.log(`Player ${i} is listening MIDI notes`);

    EventMIDI.on('note', function(index, data) {
      if (data.msg._type == 'noteoff') return;
      //console.log("note");
      midiHandler(gamepads[index], data.inputName, data.msg, function(index) {
        // gamepads[index].sendState(function(index, payload, senders) {
        //   sendLog(`SEND: (${senders.toString()} ${index}) ${payload}`, true);
        //   // io.sockets.emit("GAMEPAD", gamepads[index].getState());
        // }.bind(null, index));
        //console.log("midiHandler done");
        midi_received[index] = true;
      }.bind(null, index));

    }.bind(null, i));
  }
  /**/

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
var joyList = {};
var gameController;
var ctrlListeners = [];

function detachGamepadListeners(i) {
  for (var j = 0; j < ctrlListeners[i].length; j++) {
    gameController.off(ctrlListeners[i][j].eventName, ctrlListeners[i][j].listener);
  }
}

const os = require('os');

function loadGamepadConfig(i) {
  console.log("loadGamepadConfig", i);
  var set = gamepadsConfig[i].gamepad_set || "default";
  var joy = 'joy_input' in gamepadsConfig[i] ? gamepadsConfig[i].joy_input : '';
  //console.log("joy", joy, gamepadsConfig[i]);
  if (typeof set == "string") {
    var set_name = set in gamepadSetConfig ? set : "default";
    var os_set = set+"_"+os.platform();
    set_name = os_set in gamepadSetConfig ? os_set : set_name;
    console.log("loding set", i, set_name);
    set = gamepadSetConfig[set_name];
  }
  gamepads[i].saveGamepadSet(set);
  var joy_listeners = [];
  ctrlListeners[i] = [];
  for (var key in set) {
    if (set.hasOwnProperty(key)) {
      var action = set[key];
      var id = 'joy' in action ? action.joy : joy;
      var reverse = 'reverse' in action ? action.reverse : false;
      var disable = 'disable' in action ? action.disable : false;
      gamepads[i].setModifier("reverse", action.type, key, action.value, reverse);
      gamepads[i].setModifier("disable", action.type, key, action.value, disable);
      if (id !== "") {
        joy_listeners[id] = true;

        var eventName = `joy:${id}:${action.type}:${action.value}`;
        var listener = triggerAction.bind(null, i, key, action);
        ctrlListeners[i].push({
          eventName: eventName,
          listener: listener
        })
        //console.log(eventName);
        gameController.on(eventName, listener);
      }
    }
  }
  if (joy_listeners.length <= 0) {
    joy_listeners[joy] = true;
  }

  var listeners_string = joy_listeners.reduce((output, value, index) => {
    if (value) output.push(index);
    return output;
  }, []).join(',');
  console.log(`Player ${i} is listening joy ${listeners_string}`);

  for (let j = 0; j < joy_listeners.length; j++) {
    if (joy_listeners[j]) {
      var eventName = `joy:${j}:update:0`;
      var listener = updateJoy.bind(null, i);
      ctrlListeners[i].push({
        eventName: eventName,
        listener: listener
      })
      // console.log(eventName);
      gameController.on(eventName, listener);
    }
  }
}

function updateJoy(index, gp, force) {
  //console.log("updateJoy", index, gp.index);
  //if (!gamepadsConfig[index].gamepad_set == null) return;
  //if (gamepadsConfig[index].joy_listeners[index]) {
    //update if listening on the gamepad
    gamepads[index].sendState( function(index, payload, senders) {
      sendLog(`SEND: (${senders.toString()} ${index}) ${payload}`, false);
    }.bind(null, index), force);
  //}
}

const loadConfig = async () => {
  gameController = new GameController();
  await gameController.init();

  for (var i = 0; i < gamepadsConfig.length; i++) {
    loadGamepadConfig(i);
  }

  //gameController.updateMapping(JoyMappingConfig);

  gameController.on(`GAMEPAD_CONNECTED`, (gp) => {
    console.log("Gamepad connected at index %d: %s. %d buttons, %d axes.",
    gp.index, gp.id,
    gp.buttons.length, gp.axes.length);
    joyList[gp.index] = gp;
    io.sockets.emit("JOY_LIST", joyList);
  });

  gameController.on(`GAMEPAD_DISCONNECTED`, (gp) => {
    console.log("Gamepad disconnected at index %d: %s.", gp.index, gp.id);
    delete joyList[gp.index];
    io.sockets.emit("JOY_LIST", joyList);
  });
};
loadConfig();

function triggerAction(index, key, action, value) {
  console.log(key, action, value);
  if (action.type == 'button') {
    if (key.startsWith('D_PAD_')) {
      gamepads[index].setHat(value ? key : "RELEASE");
    }
    else {
      gamepads[index].setButton(key, value);
    }
  }
  if (action.type == 'axis') {
    if (action.action == 'button') {
      var v = Math.min(Math.max(parseInt(value), 0), 1) || 0;
      var v = v == action.active ? 1 : 0;
      gamepads[index].setButton(key, v);
    }
    else if (action.action == 'button_hat') {
      console.log('button_hat');
      //console.log(action);
      //var v = Math.min(Math.max(parseInt(value), 0), 1) || 0;
      //var v = Math.round(parseFloat(value) * 10) / 10;
      var v = parseFloat(value);
      console.log(action.min, v, action.max);
      if (v > action.release_min) {
        console.log("RELEASE", action);
        gamepads[index].setHat("RELEASE");
      }
      else if (v >= action.min && v < action.max) {
        console.log("vrai", action);
        gamepads[index].setHat(key);
      }
    }
    else {
      value = smooth(value, action.deadzone);
      gamepads[index].setAxis(key, Utils.map(value, action.min, action.max, 0, 255));
    }
  }
}

function smooth(x, deadzone) {
  return Math.abs(x) <= deadzone ? Math.pow(x,3)/Math.pow(deadzone,2) : x;
}

function setModifier(index, modifier, value, key) {
  let set = gamepads[index].getGamepadSet();
  gamepads[index].setModifier(modifier, set[key].action || set[key].type, key, set[key].value, value);
  updateJoy(index, null, true);
}
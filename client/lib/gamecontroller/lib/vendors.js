
module.exports = {
  "xbox360": {
    "vendorId": 1118,
    "productId": 654,
    "state": {
      "button:A": 0,
      "button:B": 0,
      "button:X": 0,
      "button:Y": 0,

      "button:LB": 0,
      "button:RB": 0,

      "axis:LT": 0,
      "axis:RT": 0,

      "axis:LY": 0,
      "axis:LX": 0,
      "axis:RY": 0,
      "axis:RX": 0,

      "button:LS": 0,
      "button:RS": 0,

      "button:Up": 0,
      "button:Right": 0,
      "button:Down": 0,
      "button:Left": 0,

      "button:Start": 0,
      "button:Back": 0,
      "button:Guide": 0,
    },
    "prev": {// Simple copy of state
      "button:A": 0,
      "button:B": 0,
      "button:X": 0,
      "button:Y": 0,

      "button:LB": 0,
      "button:RB": 0,

      "axis:LT": 0,
      "axis:RT": 0,

      "axis:LY": 0,
      "axis:LX": 0,
      "axis:RY": 0,
      "axis:RX": 0,

      "button:LS": 0,
      "button:RS": 0,

      "button:Up": 0,
      "button:Right": 0,
      "button:Down": 0,
      "button:Left": 0,

      "button:Start": 0,
      "button:Back": 0,
      "button:Guide": 0,
    },
    "update": function(data) {

      var state = this.state;
      console.log(data);

      state["button:LB"] = data[3] >> 0 & 1; //ok
      state["button:RB"] = data[3] >> 1 & 1; //ok
      state["button:Guide"] = data[3] >> 2 & 1; //ok

      state["button:A"] = data[3] >> 4 & 1; //ok
      state["button:B"] = data[3] >> 5 & 1; //ok
      state["button:X"] = data[3] >> 6 & 1; //ok
      state["button:Y"] = data[3] >> 7 & 1; //ok

      state["button:LS"] = data[2] >> 6 & 1; //ok
      state["button:RS"] = data[2] >> 7 & 1; //ok

      state['axis:LT'] = data[4];
      state['axis:RT'] = data[5];

      state['axis:LY'] = data.readInt16LE(8);
      state['axis:LX'] = data.readInt16LE(6);

      state['axis:RY'] = data.readInt16LE(12);
      state['axis:RX'] = data.readInt16LE(10);

      state["button:Left"] = data[2] >> 2 & 1;
      state["button:Right"] = data[2] >> 3 & 1;
      state["button:Up"] = data[2] >> 0 & 1;
      state["button:Down"] = data[2] >> 1 & 1;

      state["button:Start"] = data[2] >> 4 & 1;
      state["button:Back"] = data[2] >> 5 & 1;

      return state;
    },
    "setRumble": function(leftStrength, rightStrength) {

    },
    "setLED": function(led, val) {

    }
  }
};


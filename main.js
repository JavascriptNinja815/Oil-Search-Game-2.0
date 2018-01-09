var db = null;
var express = require('express');
var app = express();
var serv = require('http').Server(app);
var _ = require('lodash');

app.get('/',function(req, res) {
    res.sendFile(__dirname + '/client/index.html');
});
app.use('/client',express.static(__dirname + '/client'));

serv.listen(process.env.PORT || 2000);
console.log("Server started.");

// var map, oil, adjacent, empty, cities; //initial map data
var prospect_empty = []; //grey x
var prospect_adjacent = []; //green x
var installed_pump = []; //pump array
var refinery = []; //refinery array
var pending_pump = {}; //while drilling
var pending_refinery = {}; //while installing refinery
var pending_remove = {}; //while removing block

var Map = function() {
  var self = {
    oil: [], //7
    available: [], //196
    adjacent: [], //56
    empty: [], //first:256 last:191
    cities: [] //2
  };
  self.initializingMap = function() {
    for (var i = 0; i < 16; i++)
      for (var j = 0; j < 16; j++) {
          self.empty.push(i + j*16);
      }
  };
  self.plantingOil = function() {
    for (var i = 1; i < 15; i++)
      for (var j = 1; j < 15; j++)
        self.available.push(i*16 + j);

    while (self.oil.length < 7) {
      var index = Math.floor(Math.random()*self.available.length); //choosing random number from 1 to 196
        self.oil.push(self.available[index]);
      var x = self.available[index]%16;
      var y = parseInt(self.available[index]/16);
      
      self.available = self.available.filter(num => {
        x1 = num%16;
        y1 = parseInt(num/16);
        return (x1 < (x-2) || x1 > (x+2) ) || (y1 < (y-2) || (y1 > y+2));
      });
    }
  };
  self.plantingCities = function() {
    while (self.cities.length < 2) {
      index = Math.floor(Math.random()* self.available.length);
      self.cities.push(self.available[index]);

      var x = self.available[index]%16;
      var y = parseInt(self.available[index]/16);

      self.available = self.available.filter(num => {
          x1 = num%16;
          y1 = parseInt(num/16);
              return (x1 != x && y1 != y);
      });
    }
  };
  self.plantingAdjacent = function() {
    for (var i = 0; i < self.oil.length; i++) {
      self.adjacent.push(self.oil[i]-1);
      self.adjacent.push(self.oil[i]-15);
      self.adjacent.push(self.oil[i]-16);
      self.adjacent.push(self.oil[i]-17);
      self.adjacent.push(self.oil[i]+1);
      self.adjacent.push(self.oil[i]+15);
      self.adjacent.push(self.oil[i]+16);
      self.adjacent.push(self.oil[i]+17);
    }
};
  self.plantingEmpty = function() {
    _.pullAll(self.empty, self.oil);
    _.pullAll(self.empty, self.adjacent);
    _.pullAll(self.empty, self.cities);
  };
  self.countDown_drilling = function(pos) {
    if(pending_pump[pos] == null)
      return;
    pending_pump[pos].sec--;
    if (self.oil.indexOf(pos) == -1) {
      if(pending_pump[pos].sec <= 0) {
        pending_pump[pos].square = pending_pump[pos].callback(pos);
        pending_pump[pos].callback = null;  
      } else {
        setTimeout(() => {
          self.countDown_drilling(pos);
        }, 1000);
      }
    } else {
      if(pending_pump[pos].sec <= -5) {
        pending_pump[pos].square = pending_pump[pos].callback(pos);
        pending_pump[pos].callback = null;  
      } else {
        setTimeout(() => {
          self.countDown_drilling(pos);
        }, 1000);
      }
    }
  };
  self.countDown_refinery = function(pos) {
    if (pending_refinery[pos] == null)
        return;
    pending_refinery[pos].sec--;
    if(pending_refinery[pos].sec <= 0) {
      pending_refinery[pos].square = pending_refinery[pos].callback(pos);
      pending_refinery[pos].callback = null;  
    } else {
      setTimeout(() => {
        self.countDown_refinery(pos);
      }, 1000);
    }
  };
  self.countDown_remove = function(mousePos) {
    if (pending_remove[mousePos] == null) {
      return;
    }
    pending_remove[mousePos].sec--;
    if (pending_remove[mousePos].sec <= 0) {
      pending_remove[mousePos].callback(mousePos);
      pending_remove[mousePos].callback = null;  
    } else {
      setTimeout(() => {
        self.countDown_remove(mousePos);
      }, 1000);
    }
  };
  return self;
}

map = Map();
map.initializingMap();
map.plantingOil();
map.plantingCities();
map.plantingAdjacent();
map.plantingEmpty();

var SOCKET_LIST = {};
var PLAYER_LIST = {};

var Player = function(id) {
  var self = {
      old_pos: 46,
      new_pos: 46,
      capacity: 20,
      speed_x: 1,
      speed_y: 16,
      old_x: 565,
      old_y: 85,
      new_x: 565,
      new_y: 85,
      id: id,
  };
  self.updatePosition = function(direction) {
    self.detectOldPos = "";
    switch (direction) {
      case 'left':
        self.old_pos = self.new_pos;
        self.new_pos -= self.speed_x;
        self.detectMove(self.old_pos, self.new_pos, direction, self.id);
        break;
      case 'right':
        self.old_pos = self.new_pos; 
        self.new_pos += self.speed_x;
        self.detectMove(self.old_pos, self.new_pos, direction);
        break;
      case 'up':
        self.old_pos = self.new_pos;
        self.new_pos -= self.speed_y;
        self.detectMove(self.old_pos, self.new_pos, direction);
        break;
      case 'down':
        self.old_pos = self.new_pos;
        self.new_pos += self.speed_y;
        self.detectMove(self.old_pos, self.new_pos, direction);
        break;
    }
  }
  self.detectMove = function(old_pos, new_pos, direction, id) {
    if (map.cities.indexOf(old_pos) > -1)
      self.detectOldPos = 8;
    if (refinery.indexOf(old_pos) > -1)

      self.detectOldPos = 9;
    if (installed_pump.indexOf(old_pos) > -1)
      self.detectOldPos = installed_pump.indexOf(old_pos) + 1;
      
    if (prospect_empty.indexOf(new_pos) > -1 ||
      prospect_adjacent.indexOf(new_pos) > -1) {
        switch (direction) {
          case 'left':
            self.new_pos += self.speed_x;
            break;
          case 'right':
            self.new_pos -= self.speed_x;
            break;
          case 'up':
            self.new_pos += self.speed_y;
            break;
          case 'down':
            self.new_pos -=self.speed_y;
            break;
        }
        self.old_pos = self.new_pos;
    }
    if ((new_pos%16 == 0 && old_pos == new_pos - 1) ||
      (new_pos%16 == 15 && old_pos == new_pos + 1) ||
      (new_pos < 0) || (new_pos > 256)) {
      self.new_pos = self.old_pos;
    }
  }
  self.newPosition = function(x) {
    self.new_x = x%16*40+5;
    self.new_y = parseInt(x/16)*40+5;
  }
  self.oldPosition = function(x) {
    self.old_x = x%16*40+5;
    self.old_y = parseInt(x/16)*40+5;   
  }
  self.drilling = function(pos) {
    if (map.cities.indexOf(pos) > -1 ||
      refinery.indexOf(pos) > -1 ||
      installed_pump.indexOf(pos) > -1) {
      return
    }
    delete pending_remove[pos];
    var prospect = ProspectMap();
    pending_pump[pos] = {
      sec: 6,
      callback: prospect.detectStatus
    }
    map.countDown_drilling(pos);
  }
  self.refinery = function(pos) {
    if (map.cities.indexOf(pos) > -1 ||
      refinery.indexOf(pos) > -1) {
        return;
    }
    delete pending_remove[pos];
    var prospect = ProspectMap();
    pending_refinery[pos] = {
      sec: 6,
      callback: prospect.install_refinery
    }
    map.countDown_refinery(pos);
  }
  return self;
}

var ProspectMap = function() {
  self = map;
  self.curren0t_square = 0; //0:initial, 1-7: oil, 8:adjacent, 9:empty
  self.detectStatus = function(current_pos) {
    if (map.oil.indexOf(current_pos) > -1) {
      if (installed_pump.indexOf(current_pos) === -1)
        installed_pump.push(current_pos);
      self.current_square = installed_pump.length;
    }
    if (map.adjacent.indexOf(current_pos) > -1) {
      if (prospect_adjacent.indexOf(current_pos) === -1)
        prospect_adjacent.push(current_pos);
      self.current_square = 8;
    }
    if (map.empty.indexOf(current_pos) > -1){
      if (prospect_empty.indexOf(current_pos) === -1)
        prospect_empty.push(current_pos);
      self.current_square = 9;
    }
    return self.current_square;
  }
  self.install_refinery = function(current_pos) {
    if (refinery.indexOf(current_pos) == -1 
      && map.cities.indexOf(current_pos) == -1)
      refinery.push(current_pos);
  }
  self.remove = function(mousePos) {
    var empty = prospect_empty.indexOf(mousePos);
    var adjacent = prospect_adjacent.indexOf(mousePos);
    if (empty > -1) {
      prospect_empty.splice(empty, 1);
    }
    if (adjacent > -1) {
      prospect_adjacent.splice(adjacent, 1);
    }
  }
  return self;
}

var removeClick = function(mousePos) {
  delete pending_pump[mousePos];
  if (prospect_empty.indexOf(mousePos) == -1 &&
    prospect_adjacent.indexOf(mousePos) == -1) {
    return;
  }
  var prospect = ProspectMap();
  pending_remove[mousePos] = {
    sec: 6,
    callback: prospect.remove
  }
  map.countDown_remove(mousePos);
}

var sendCurrentPosition = function(){
  var pack = [];
  for (var i in PLAYER_LIST){
    var player = PLAYER_LIST[i];
    pack.push({
      detectOldPos: player.detectOldPos,
      new_x: player.new_x,
      new_y: player.new_y,
      old_x: player.old_x,
      old_y: player.old_y
    });
  }
  for (var i in SOCKET_LIST){
    var socket = SOCKET_LIST[i];
    socket.emit('newPositions',{ 
      pack: pack
    });
  }
}

var sendPendingPump = function() {
  for (var i in SOCKET_LIST){
    var socket = SOCKET_LIST[i];
    socket.emit('pending_pump',{ 
      pending_pump: pending_pump
    });
  }
}

var sendPendingRefinery = function() {
  for (var i in SOCKET_LIST){
    var socket = SOCKET_LIST[i];
    socket.emit('pending_refinery',{ 
      pending_refinery: pending_refinery
    });
  }
}

var sendPendingRemove = function() {
  for (var i in SOCKET_LIST){
    var socket = SOCKET_LIST[i];
    socket.emit('pending_remove',{ 
      pending_remove: pending_remove
    });
  }
}

var currentMap = [];
var drawMap = function() {
  var j = 1;
  for (var i = 0; i < 256; i++) {
    if (installed_pump.indexOf(i) > -1) {
      currentMap[i] = j; //pump
      j ++;
    }
    else if (prospect_adjacent.indexOf(i) > -1) {
      currentMap[i] = 8; //green x
    }
    else if (prospect_empty.indexOf(i) > -1) {
      currentMap[i] = 9; //grey x
    }
    else if (map.cities.indexOf(i) > -1)
      currentMap[i] = 10; //cities
    else if (refinery.indexOf(i) > -1)
      currentMap[i] = 11;
    else 
    currentMap[i] = 0;  
  }
}

var pumpCount = []; 
for (var i = 0; i < 7; i++) {
  pumpCount.push({id: "", count: 0});
}

var startCount = function(data) {
  pumpCount[data.pumpNumber - 1].count ++;
  pumpCount[data.pumpNumber - 1].id = data.id;
  if (pumpCount[data.pumpNumber - 1].count < 30)
    var myfunc = setTimeout(function(){
      startCount(data);
    }, 5000);
  else {
    clearTimeout(myfunc);
  }
}
var sendStartCount = function() {
  for (var i in SOCKET_LIST){
    var socket = SOCKET_LIST[i];
    socket.emit('countingPump',{ 
      pumpCount: pumpCount,
      playerList: playerList
    });
  }
}

setInterval(sendStartCount, 1000)
setInterval(sendPendingPump, 1000);
setInterval(sendPendingRefinery, 50);
setInterval(sendPendingRemove, 1000);

var playerList = [];
var io = require('socket.io')(serv,{});
io.sockets.on('connection', function(socket){
  SOCKET_LIST[socket.id] = socket;
  var player = Player(socket.id);
  PLAYER_LIST[socket.id] = player;
console.log(socket.id);
  socket.on("playerList", function(data) {
    if (playerList.indexOf(data.time) < 0 &&
      playerList.length < 3) {
      playerList.push(data.time);
    }
  });

  drawMap();
  socket.emit('MapData', currentMap);

  socket.on('drillClick', function(data) {
    player.drilling(player.new_pos);
  });

  socket.on('refineryClick', function(data) {
    player.refinery(player.new_pos);
  });

  socket.on('removeClick', function(data) {
    removeClick(data.mousePos);
  });

  socket.on('stopPending', function(data) {
    delete pending_pump[data.pos];
    data.id = socket.id;
    startCount(data);
  });

  socket.on('disconnect',function(){
    delete SOCKET_LIST[socket.id];
    socket.emit('remove', {
        removePack: PLAYER_LIST[socket.id]
    });
    delete PLAYER_LIST[socket.id];
  });

  socket.on('keyPress',function(data) {
    player.updatePosition(data.inputId);
    player.newPosition(player.new_pos);
    player.oldPosition(player.old_pos);
    sendCurrentPosition();
  });
});

setInterval(sendCurrentPosition, 40);

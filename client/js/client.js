var socket = io();
var width = 640;
var height = 640;
var cellSize = 40;
var img_width = 30;
var img_height = 30;

var Img = {};
Img.player = new Image();
Img.player.src = '/client/img/truck.png';
Img.pump = new Image();
Img.pump.src = '/client/img/pump1.png';
Img.empty = new Image();
Img.empty.src = '/client/img/empty.png';
Img.adjacent = new Image();
Img.adjacent.src = '/client/img/adjacent.png';
Img.city = new Image();
Img.city.src = '/client/img/city.png';
Img.refinery = new Image();
Img.refinery.src = '/client/img/refinery.png';
var current_x, current_y;

/*drawing gird*/
var ctx = document.getElementById("scene").getContext("2d");
	ctx.clearRect(0,0,width,height);
	ctx.strokeStyle = "#ddd";
	for(i=0; i<=width; i+=cellSize) {
	ctx.moveTo(i,0); ctx.lineTo(i, height);ctx.stroke();
}
for(i=0; i<=height; i+=cellSize) {
	ctx.moveTo(0,i); ctx.lineTo(width, i);ctx.stroke();
}

/*detect position of mouse*/
// $("#scene").onclick(functioin(event) {
// 	mouseX = e
// });

/*drawing Map*/
socket.on('MapData', function(data) {
	var images = {
		1: '/client/img/pump1.png',
		2: '/client/img/adjacent.png',
		3: '/client/img/empty.png',
		4: '/client/img/city.png',
		5: 'client/img/refinery.png'
	}
	for (let i = 0; i < data.length; i++) {
		let x = i%16*40+5;
		let y = parseInt(i/16)*40+5;
		if(images[data[i]]) {
			let img = new Image();
			img.src = images[data[i]];
			img.onload = () => {
				ctx.drawImage(img, x, y, img_width, img_height);
			}
		}
	}
});

/*when the drill button is clicked*/
var drillBtnClick = document.getElementById('drill_btn'); 
drillBtnClick.onclick = function() {
	socket.emit('drillClick', {inputId: 'dirllClick'});
}
socket.on('drillClickResponse', function(data){
	switch (data.current_square) {
		case 1:
			ctx.drawImage(Img.pump, data.new_x, data.new_y, img_width, img_height);
			break;
		case 2:
			ctx.drawImage(Img.adjacent, data.new_x, data.new_y, img_width, img_height);
			break;
		case 3:
		  ctx.drawImage(Img.empty, data.new_x, data.new_y, img_width, img_height);
		  break;
	}
});

var refineryBtnClick = document.getElementById('refinery_btn');
refineryBtnClick.onclick = function() {
	if (document.getElementById('total').innerHTML >= 500) {
		alert("If you install refinery, total collection will be reduced as 500.");
		socket.emit('refineryClick', {inputId: 'refineryClick'});
	}
	else {
		alert("You can't install refinery because total collection is less than 500.")
		return	
	}
}
socket.on('refineryClickResponse', function (data) {
	ctx.drawImage(Img.refinery, data.new_x, data.new_y, img_width, img_height);
})
socket.on('newPositions',function(res){
	data = res.pack;
  for(let i = 0 ; i < data.length; i++) {
  	ctx.clearRect(data[i].old_x, data[i].old_y, img_width, img_height);
		if (data[i].detectOldPos == "city")
			ctx.drawImage(Img.city, data[i].old_x, data[i].old_y, img_width, img_height);
		if (data[i].detectOldPos == "refinery")
			ctx.drawImage(Img.refinery, data[i].old_x, data[i].old_y, img_width, img_height);
  	ctx.drawImage(Img.player, data[i].new_x, data[i].new_y, img_width, img_height);
  }
  pending_pump = res.pending_pump;
  for(var k in pending_pump) {
		let x = k%16*40 + 5;
		let y = parseInt(k/16)*40 + 5;
  	ctx.clearRect(x, y, img_width, img_height);

  	if(pending_pump[k].sec > 0) {
			ctx.fillText(pending_pump[k].sec, x + 10, y + 18);
  	} else {
    	if (pending_pump[k].square == 1) {
    		ctx.drawImage(Img.pump, x, y, img_width, img_height);
    		}	
  		if (pending_pump[k].square == 2)
  			ctx.drawImage(Img.adjacent, x, y, img_width, img_height);
  		if (pending_pump[k].square == 3)
  			ctx.drawImage(Img.empty, x, y, img_width, img_height);
  		if (pending_pump[k].square == 4)
  			ctx.drawImage(Img.city, x, y, img_width, img_height);
  	}
  }

  pending_refinery = res.pending_refinery;
  for (var i in pending_refinery) {
  	let x = i%16*40 + 5;
		let y = parseInt(i/16)*40 + 5;
  	ctx.clearRect(x, y, img_width, img_height);

  	if (pending_refinery[i].sec > 0) {
  		ctx.fillText(pending_refinery[i].sec, x + 10, y + 18, img_width, img_height);
  	} else {
  		ctx.drawImage(Img.refinery, x, y, img_width, img_height);
  	}
  }
});
  
socket.on('remove', function(data) {
	ctx.clearRect(Img.player, data.new_x, data.new_y, img_width, img_height);
});

document.onkeydown = function(event){
  if(event.keyCode === 39)   
    socket.emit('keyPress',{inputId:'right'});
  else if(event.keyCode === 40) 
    socket.emit('keyPress',{inputId:'down'});
  else if(event.keyCode === 37) 
    socket.emit('keyPress',{inputId:'left'});
  else if(event.keyCode === 38) 
    socket.emit('keyPress',{inputId:'up'});
}
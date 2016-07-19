var tutorial = ["tutorials/ex010_hello.ceu", "tutorials/ex020_events.ceu", "tutorials/ex030_parand.ceu",
				"tutorials/ex040_paror.ceu", "tutorials/ex050_term.ceu", "tutorials/ex060_par.ceu",
				"tutorials/ex070_AB.ceu", "tutorials/ex080_tight.ceu", "tutorials/ex090_det01.ceu", 
				"tutorials/ex100_atomic.ceu", "tutorials/ex120_inthello.ceu", "tutorials/ex140_intstack.ceu", 
				"tutorials/ex150_async10.ceu", "tutorials/ex160_async0.ceu", "tutorials/ex170_simul.ceu", 
				"tutorials/ex180_cblock.ceu", "tutorials/ex190_fin.ceu", "tutorials/sdl1.ceu", "tutorials/sdl2.ceu",
				"tutorials/sdl6.ceu", "tutorials/square.ceu"];


var Module={};
var printing = false;
var length = tutorial.length;

//Calls Module which will intercept the console log and print the message in output
function call_module() {
	Module = {
		print: function (text) { 
			var element = document.getElementById('output');
			console.log(text); 
			element.value += text + "\n"; 
			element.scrollTop = element.scrollHeight;
		},

		canvas: (function() {
          var canvas = document.getElementById('canvas');

          // As a default initial behavior, pop up an alert when webgl context is lost. To make your
          // application robust, you may want to override this behavior before shipping!
          // See http://www.khronos.org/registry/webgl/specs/latest/1.0/#5.15.2
          canvas.addEventListener("webglcontextlost", function(e) { alert('WebGL context lost. You will need to reload the page.'); e.preventDefault(); }, false);
          canvas.focus();
document.getElementById( "canvas" ).onmousedown = function(event){
    event.preventDefault();
};
          return canvas;
        })()
	};
}

//Sends the ceu code to the server and will receive javascript code that will interpret and print in output
function compile_code() {
		printing = false;
	var send = document.getElementById('code').value;
	$.ajax({ type: "POST",   
		url: "server.php",
		data: { 'code' : send}
	}).done(function(text) {

		document.getElementById('output').value ='';

		call_module();

		window.eval(text);

		Module.ccall('begin', // name of C function
  					'void', // return type
  					[], // argument types
  					[]);

		printing = true;
		//requestAnimationFrame(handle_time);

	});
}


var diff;
var start = null;
var next;
var elapsed = 0;

//Function that handles time for 5 seconds
function handle_time(timestamp) {
	if (!start) {
		start = timestamp;
		diff = timestamp - start;
	}
	else {
		diff = (timestamp - next) * 1000;
	}

	if (printing == true) {
		_update(diff);
		async_call();
	}

	elapsed += diff;
	next = timestamp;

	requestAnimationFrame(handle_time);

}


var nr = 0;
//Function for going to the next tutorial lesson
function inc_nr() {
	nr = nr + 1;
	if (nr == length)
		nr = 0;
	get_tutorial()
	document.getElementById('log').innerHTML = "";
	document.getElementById('log').innerHTML += nr;
}

//Function for going to the previous tutorial lesson
function dec_nr() {
	nr = nr - 1;
	if (nr < 0)
		nr = length - 1;
	get_tutorial()
	document.getElementById('log').innerHTML = "";
	document.getElementById('log').innerHTML += nr;
}

//Function for going to a specific tutorial lesson
function set_nr(x) {
	nr = x;
	get_tutorial()
	document.getElementById('log').innerHTML = "";
	document.getElementById('log').innerHTML += nr;
}

//Function that prints the content of a certain tutorial in the code textbox
function get_tutorial() {
	$.ajax({ type: "GET",
		mimeType: 'text/plain; charset=x-user-defined',
		url: tutorial[nr],
		dataType: "text"
	}).done(function(text) {
		document.getElementById("code").value = text;
	});

}

//Sends an asynchronous call to the ceu code
function async_call() {
	if ( Module.ccall('async_call', 'number', [], []) == 1 ) {
		setTimeout(async_call, 0)
	}
}

//Checks if an asynchronous call can be made
function async_check() {
	if (Module.ccall('async_check', 'number', [], []) == 1) {
		console.log('true');
	}
	else {
		console.log('false');
	}
}
var canvas = document.getElementById('canvas');

function stopDefAction(evt) {
	document.getElementById('canvas').focus();
	evt.preventDefault();
}
document.getElementById('canvas').addEventListener( 'click', stopDefAction, false );



var canvas = document.getElementById('canvas');
window.addEventListener('keydown', check_keydown, false);
window.addEventListener('keyup', check_keyup, false);
window.addEventListener('mousedown', check_mousedown, false);
window.addEventListener('mouseup', this.check_mouseup, false);

var tagName;

function checkElement() {
	tagName = document.activeElement.tagName;
	console.log(tagName);
	if (tagName == "TEXTAREA") {
		console.log("T");
		document.getElementById('code').focus();
		Module.ccall('disable_events', // name of C function
  					'void', // return type
  					[], // argument types
  					[]);
	}
	else if (tagName == "CANVAS") {
		console.log("C");
		document.getElementById('code').focus();
		Module.ccall('enable_events', // name of C function
  					'void', // return type
  					[], // argument types
  					[]);
	}
}


function getCursorPosition(canvas, event) {
	var rect = canvas.getBoundingClientRect();
	var x = event.clientX - rect.left;
	var y = event.clientY - rect.top;
	return {'x': x, 'y': y};
}


function check_keydown(e) {
	if (tagName == "CANVAS")
		Module.ccall('key_down', 'void', ['number'], [e.keyCode]);
}

function check_keyup(e) {
	if (tagName == "CANVAS")
		Module.ccall('key_up', 'void', ['number'], [e.keyCode]);
}

function check_mousedown(e) {
	var c = getCursorPosition(canvas, e);
	Module.ccall('mouse_down', 'void', ['number', 'number', 'number'], [e.which, c.x, c.y]);
}

function check_mouseup(e) {
	var c = getCursorPosition(canvas, e);
	Module.ccall('mouse_up', 'void', ['number', 'number', 'number'], [e.which, c.x, c.y]);
}

function check_onmousemove(e) {
	var c = getCursorPosition(canvas, e);
	Module.ccall('mouse_move', 'void', ['number', 'number'], [c.x, c.y]);
}

//Gets the first tutorial when the page is first loaded
get_tutorial();

//Start requestAnimationFrame
requestAnimationFrame(handle_time);
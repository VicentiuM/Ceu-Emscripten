var tutorial = ["tutorials/ex000_intro.ceu", "tutorials/ex010_hello.ceu", "tutorials/ex020_events.ceu", "tutorials/ex030_parand.ceu",
				"tutorials/ex040_paror.ceu", "tutorials/ex050_term.ceu", "tutorials/ex060_par.ceu",
				"tutorials/ex070_AB.ceu", "tutorials/ex080_tight.ceu", "tutorials/ex090_det01.ceu", 
				"tutorials/ex100_atomic.ceu", "tutorials/ex120_inthello.ceu", 
				"tutorials/ex150_async10.ceu", "tutorials/ex170_simul.ceu", 
				"tutorials/ex180_cblock.ceu", "tutorials/ex190_fin.ceu", "tutorials/sdl000_intro.ceu", "tutorials/sdl010_helloworld.ceu",
				"tutorials/sdl020_quit.ceu", "tutorials/sdl030_animation.ceu", "tutorials/sdl040_keyboard.ceu", "tutorials/sdl050_mouse.ceu"];

var explanation = ["tutorials/ex000_intro.html", "tutorials/ex010_hello.html", "tutorials/ex020_events.html", "tutorials/ex030_parand.html",
				"tutorials/ex040_paror.html", "tutorials/ex050_term.html", "tutorials/ex060_par.html",
				"tutorials/ex070_AB.html", "tutorials/ex080_tight.html", "tutorials/ex090_det01.html", 
				"tutorials/ex100_atomic.html", "tutorials/ex120_inthello.html",
				"tutorials/ex150_async10.html", "tutorials/ex170_simul.html", 
				"tutorials/ex180_cblock.html", "tutorials/ex190_fin.html", "tutorials/sdl000_intro.html", "tutorials/sdl010_helloworld.html",
				"tutorials/sdl020_quit.html", "tutorials/sdl030_animation.html", "tutorials/sdl040_keyboard.html", "tutorials/sdl050_mouse.html"];


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
		data: { 'code' : send},
		success: function(data) {
			var data = $.parseJSON(data);
			if (data.status == "success") {
				document.getElementById('output').value ='';
				//Clear canvas
				var canvas = document.getElementById('canvas');
				canvas.width  = window.innerWidth * 0.55;
				canvas.height = window.innerHeight * 0.32;
				var context = canvas.getContext('2d');
				console.log(canvas.width + ' ' + canvas.height);
				context.clearRect(0, 0, canvas.width, canvas.height);

				call_module();

				window.eval(data.message);

				Module.ccall('begin', // name of C function
		  					'void', // return type
		  					[], // argument types
		  					[]);

				printing = true;
			}
			else {
				document.getElementById('output').value ='';
				document.getElementById('output').value = data.message;
			}

		}
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

//Function to reset the tutorial
function reset_tutorial() {
	get_tutorial();
}


var nr = 0;
//Function for going to the next tutorial lesson
function inc_nr() {
	nr = nr + 1;
	if (nr == length)
		nr = 0;
	get_tutorial()
	document.getElementById('ceu-slide-number').innerHTML = "";
	document.getElementById('ceu-slide-number').innerHTML += nr;
}

//Function for going to the previous tutorial lesson
function dec_nr() {
	nr = nr - 1;
	if (nr < 0)
		nr = length - 1;
	get_tutorial()
	document.getElementById('ceu-slide-number').innerHTML = "";
	document.getElementById('ceu-slide-number').innerHTML += nr;
}

//Function for going to a specific tutorial lesson
function set_nr(x) {
	nr = x;
	get_tutorial()
	document.getElementById('ceu-slide-number').innerHTML = "";
	document.getElementById('ceu-slide-number').innerHTML += nr;
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

	$(function(){
      $("#ceu-slide-text").load(explanation[nr]); 
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

// Increase/decrease font size by diff px
function change_font_size(diff){
  var $body = $('body'),
      cur_font_size = $body.css('font-size');
  
  cur_font_size = parseFloat(cur_font_size, 10) + diff;
  
  if(cur_font_size > 0){
    $body.css('font-size', cur_font_size);
  }
}



var canvas = document.getElementById('canvas');
window.addEventListener('keydown', check_keydown, false);
window.addEventListener('keyup', check_keyup, false);
window.addEventListener('mousedown', check_mousedown, false);
window.addEventListener('mouseup', this.check_mouseup, false);

var tagName;

function checkElement() {
	tagName = document.activeElement.tagName;
	console.log(tagName);
	//document.getElementById('code').disabled = false;
	if (tagName == "TEXTAREA") {
		console.log("T");
		document.getElementById('code').focus();
		Module.ccall('disable_events', // name of C function
  					'void', // return type
  					[], // argument types
  					[]);
	}
	else if (tagName == "CANVAS") {
		document.getElementById('code').readonly = true;
		//document.getElementById('code').focus();
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
	if (tagName == "CANVAS") {
		console.log(e.keyCode);
		Module.ccall('key_down', 'void', ['number'], [e.keyCode]);
	}
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
document.title = "Try & Learn C&eacute;u";


//Allow TAB in Textarea
$(document).delegate('#code', 'keydown', function(e) {
  var keyCode = e.keyCode || e.which;

  if (keyCode == 9) {
    e.preventDefault();
    var start = $(this).get(0).selectionStart;
    var end = $(this).get(0).selectionEnd;

    // set textarea value to: text before caret + tab + text after caret
    $(this).val($(this).val().substring(0, start)
                + "\t"
                + $(this).val().substring(end));

    // put caret at right position again
    $(this).get(0).selectionStart =
    $(this).get(0).selectionEnd = start + 1;
  }
});

//Allow Fullscreen
function fullscreen(){
	var canvas = document.getElementById('canvas');
 
	if(canvas.webkitRequestFullScreen) {
		canvas.webkitRequestFullScreen();
		canvas.width  = window.innerWidth;
		canvas.height = window.innerHeight;
	}
	else {
		canvas.mozRequestFullScreen();
		canvas.width  = window.innerWidth * 0.55;
		canvas.height = window.innerHeight * 0.32;
	}            
}
 
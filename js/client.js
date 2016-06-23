var tutorial = ["tutorials/ex010_hello.ceu", "tutorials/ex020_events.ceu", "tutorials/ex030_parand.ceu",
				"tutorials/ex040_paror.ceu", "tutorials/ex050_term.ceu", "tutorials/ex060_par.ceu",
				"tutorials/ex070_AB.ceu", "tutorials/ex080_tight.ceu", "tutorials/ex090_det01.ceu", 
				"tutorials/ex100_atomic.ceu", "tutorials/ex120_inthello.ceu", "tutorials/ex140_intstack.ceu", 
				"tutorials/ex150_async10.ceu", "tutorials/ex160_async0.ceu", "tutorials/ex170_simul.ceu", 
				"tutorials/ex180_cblock.ceu", "tutorials/ex190_fin.ceu"];


var Module={};

function call_module() {
	Module = {
		print: function (text) { 
			var element = document.getElementById('output');
			//element.value = ''; // clear browser cache 
			console.log(text); 
			element.value += text + "\n"; 
			element.scrollTop = element.scrollHeight;
		}
	};
}

function compile_code() {

	var send = document.getElementById('code').value;
	$.ajax({ type: "POST",   
		url: "server.php",
		data: { 'code' : send}
	}).done(function(text) {
		//Module.print(text);
		document.getElementById('output').value ='';

		call_module();
		window.eval(text);

		Module.ccall('begin', // name of C function
  					'void', // return type
  					[], // argument types
  					[]);


		requestAnimationFrame(draw);

	});
}


var diff;
var start = null;
var next;
var elapsed = 0;

function draw(timestamp) {
	if (!start) {
		start = timestamp;
		diff = timestamp - start;
	}
	else {
		diff = (timestamp - next) * 1000;
	}

	_update(diff);

	elapsed += diff;
	next = timestamp;


	if (elapsed <= 5000000) {
		requestAnimationFrame(draw);
		async_call();
	}
	else {
		start = null;
		elapsed = 0;
	}

}


var nr = 0;
function inc_nr() {
	nr = nr + 1;
	if (nr == 17)
		nr = 0;
	get_tutorial()
	document.getElementById('log').innerHTML = "";
	document.getElementById('log').innerHTML += nr;
}

function dec_nr() {
	nr = nr - 1;
	if (nr < 0)
		nr = 16;
	get_tutorial()
	document.getElementById('log').innerHTML = "";
	document.getElementById('log').innerHTML += nr;
}

function set_nr(x) {
	nr = x;
	get_tutorial()
	document.getElementById('log').innerHTML = "";
	document.getElementById('log').innerHTML += nr;
}

function get_tutorial() {
	$.ajax({ type: "GET",
		mimeType: 'text/plain; charset=x-user-defined',
		url: tutorial[nr],
		dataType: "text"
	}).done(function(text) {
		document.getElementById("code").value = text;
	});

}

function async_call() {
	Module.ccall('async_call', // name of C function
  				'void', // return type
  				[], // argument types
  				[]);
}

function async_check() {
	if (Module.ccall('async_check', 'number', [], []) == 1) {
		console.log('true');
	}
	else {
		console.log('false');
	}
}

get_tutorial();

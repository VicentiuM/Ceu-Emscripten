var tutorial = ["tutorials/ex010_hello.ceu", "tutorials/ex020_events.ceu", "tutorials/ex030_parand.ceu",
				"tutorials/ex040_paror.ceu", "tutorials/ex050_term.ceu", "tutorials/ex060_par.ceu",
				"tutorials/ex070_AB.ceu", "tutorials/ex080_tight.ceu", "tutorials/ex090_det01.ceu", 
				"tutorials/ex100_atomic.ceu", "tutorials/ex120_inthello.ceu", "tutorials/ex140_intstack.ceu", 
				"tutorials/ex150_async10.ceu", "tutorials/ex160_async0.ceu", "tutorials/ex170_simul.ceu", 
				"tutorials/ex180_cblock.ceu", "tutorials/ex190_fin.ceu"];

var Module = {};

function compile_code() {

	var send = document.getElementById('code').value;
	$.ajax({ type: "POST",   
		url: "server.php",
		data: { 'code' : send}
	}).done(function(text) {
		Module = {
			print: (function() {
				var element = document.getElementById('output');
				if (element) element.value = ''; // clear browser cache
				return function(text) {
					if (arguments.length > 1) text = Array.prototype.slice.call(arguments).join(' ');
					console.log(text);
					if (element) {
						element.value += text + "\n";
						element.scrollTop = element.scrollHeight; // focus on bottom
					}
				};
			})()     
		};

		js_file = text;
		eval(text);

		Module.ccall('begin', // name of C function
  					'void', // return type
  					[], // argument types
  					[]);


		requestAnimationFrame(draw);

	});
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
	Module._async_call();
}

function async_check() {
	if (Module._async_check() == 1) {
		console.log('true');
	}
	else {
		console.log('false');
	}
}

get_tutorial();

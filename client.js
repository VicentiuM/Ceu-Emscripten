function compile_code() {

	var send = document.getElementById('code').value;
	$.ajax({ type: "POST",   
		url: "server.php",
		data: { 'code' : send}
	}).done(function(text) {

		var Module = {
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

		eval(text);
	});
}

var nr = 0;
function inc_nr() {
	nr = nr + 1;
	if (nr == 8)
		nr = 1;
	get_tutorial()
}

function dec_nr() {
	nr = nr - 1;
	if (nr <= 0)
		nr = 7;
	get_tutorial()
}

function set_nr(x) {
	nr = x;
	get_tutorial()
}

function get_tutorial() {
	$.ajax({ type: "POST",   
		url: "server.php",
		data: { 'code-tutorial' : nr }
	}).done(function(text) {
		document.getElementById("code").value = text;
	});

}

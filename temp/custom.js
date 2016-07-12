var diff;
var start = null;
var next;
var elapsed = 0;

function draw(timestamp) {
	if (!start) {
		start = timestamp;
		diff = timestamp - start;
		_begin();
	}
	else {
		diff = (timestamp - next) * 1000;
	}

	//_update(diff);
	

	elapsed += diff;
	next = timestamp;

console.log(diff);

		requestAnimationFrame(draw);
		//_ceu_draw(diff);
		//_update(diff);
		_new_draw(diff);


		
}
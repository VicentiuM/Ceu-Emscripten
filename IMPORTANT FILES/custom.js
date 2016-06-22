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

	if (elapsed <= 5000000)
		requestAnimationFrame(draw);

		
}

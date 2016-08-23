mergeInto(LibraryManager.library, {
	arcColor: function(dst, x, y, rad, start, end, color) {
		var c = document.getElementById('canvas');
		var ctx = c.getContext("2d");

		if (color < 0) {
			color = 4294967296 + color;
		}
		var a = color % 256;
		color = ~~(color / 256);
		var b = color % 256;
		color = ~~(color / 256);
		var g = color % 256;
		color = ~~(color / 256);
		var r = color % 256;

		ctx.beginPath();
		ctx.arc(x, y, rad, start, end);
		ctx.strokeStyle = "rgba("+ r + ", " + g + ", " + b + ", " + a + ")";
		ctx.stroke();
	},
	arcRGBA: function(dst, x, y, rad, start, end, r, g, b, a) {
		var c = document.getElementById('canvas');
		var ctx = c.getContext("2d");
		if (r < 0) {
			r = 256 + r;
		}
		if (g < 0) {
			g = 256 + g;
		}
		if (b < 0) {
			b = 256 + b;
		}
		if (a < 0) {
			a = 256 + a;
		}

		ctx.beginPath();
		ctx.arc(x, y, rad, start, end);
		ctx.strokeStyle = "rgba("+ r + ", " + g + ", " + b + ", " + a + ")";
		ctx.stroke();
	},
	boxColor: function(dst, x1, y1, x2, y2, color) {
		var c = document.getElementById('canvas');
		var ctx = c.getContext("2d");

		if (color < 0) {
			color = 4294967296 + color;
		}
		var a = color % 256;
		color = ~~(color / 256);
		var b = color % 256;
		color = ~~(color / 256);
		var g = color % 256;
		color = ~~(color / 256);
		var r = color % 256;

		ctx.fillStyle = "rgba("+ r + ", " + g + ", " + b + ", " + a + ")";
		ctx.fillRect(x1, y1, x2, y2);
	},
	boxRGBA: function(dst, x1, y1, x2, y2, r, g, b, a) {
		var c = document.getElementById('canvas');
		var ctx = c.getContext("2d");
		if (r < 0) {
			r = 256 + r;
		}
		if (g < 0) {
			g = 256 + g;
		}
		if (b < 0) {
			b = 256 + b;
		}
		if (a < 0) {
			a = 256 + a;
		}
		ctx.fillStyle = "rgba("+ r + ", " + g + ", " + b + ", " + a + ")";
		ctx.fillRect(x1, y1, x2, y2);
	},
	characterColor: function(dst, x, y, chr, color) {
		var c = document.getElementById('canvas');
		var ctx = c.getContext("2d");

		if (color < 0) {
			color = 4294967296 + color;
		}
		var a = color % 256;
		color = ~~(color / 256);
		var b = color % 256;
		color = ~~(color / 256);
		var g = color % 256;
		color = ~~(color / 256);
		var r = color % 256;

		ctx.fillStyle = "rgba("+ r + ", " + g + ", " + b + ", " + a + ")";
		ctx.fillText(String.fromCharCode(chr), x, y);
	},
	characterRGBA: function(dst, x, y, chr, r, g, b, a) {
		var c = document.getElementById('canvas');
		var ctx = c.getContext("2d");
		if (r < 0) {
			r = 256 + r;
		}
		if (g < 0) {
			g = 256 + g;
		}
		if (b < 0) {
			b = 256 + b;
		}
		if (a < 0) {
			a = 256 + a;
		}

		ctx.fillStyle = "rgba("+ r + ", " + g + ", " + b + ", " + a + ")";
		ctx.font="20px Georgia";
		ctx.fillText(String.fromCharCode(chr), x, y);
	},
	circleColor: function(dst, x, y, rad, color) {
		var c = document.getElementById('canvas');
		var ctx = c.getContext("2d");

		if (color < 0) {
			color = 4294967296 + color;
		}
		var a = color % 256;
		color = ~~(color / 256);
		var b = color % 256;
		color = ~~(color / 256);
		var g = color % 256;
		color = ~~(color / 256);
		var r = color % 256;

		ctx.beginPath();
		ctx.strokeStyle = "rgba("+ r + ", " + g + ", " + b + ", " + a + ")";
		ctx.arc(x, y, rad, 0, 6.28);
		ctx.stroke();
	},
	circleRGBA: function(dst, x, y, rad, r, g, b, a) {
		var c = document.getElementById('canvas');
		var ctx = c.getContext("2d");
		if (r < 0) {
			r = 256 + r;
		}
		if (g < 0) {
			g = 256 + g;
		}
		if (b < 0) {
			b = 256 + b;
		}
		if (a < 0) {
			a = 256 + a;
		}

		ctx.beginPath();
		ctx.strokeStyle = "rgba("+ r + ", " + g + ", " + b + ", " + a + ")";
		ctx.arc(x, y, rad, 0, 6.28);
		ctx.stroke();
	},
	filledCircleColor: function(dst, x, y, rad, color) {
		var c = document.getElementById('canvas');
		var ctx = c.getContext("2d");

		if (color < 0) {
			color = 4294967296 + color;
		}
		var a = color % 256;
		color = ~~(color / 256);
		var b = color % 256;
		color = ~~(color / 256);
		var g = color % 256;
		color = ~~(color / 256);
		var r = color % 256;

		ctx.beginPath();
		ctx.fillStyle = "rgba("+ r + ", " + g + ", " + b + ", " + a + ")";
		ctx.arc(x, y, rad, 0, 6.28);
		ctx.fill();
	},
	filledCircleRGBA: function(dst, x, y, rad, r, g, b, a) {
		var c = document.getElementById('canvas');
		var ctx = c.getContext("2d");
		if (r < 0) {
			r = 256 + r;
		}
		if (g < 0) {
			g = 256 + g;
		}
		if (b < 0) {
			b = 256 + b;
		}
		if (a < 0) {
			a = 256 + a;
		}

		ctx.beginPath();
		ctx.fillStyle = "rgba("+ r + ", " + g + ", " + b + ", " + a + ")";
		ctx.arc(x, y, rad, 0, 6.28);
		ctx.fill();
	},
	lineColor: function(dst, x1, y1, x2, y2, color) {
		var c = document.getElementById('canvas');
		var ctx = c.getContext("2d");

		if (color < 0) {
			color = 4294967296 + color;
		}
		var a = color % 256;
		color = ~~(color / 256);
		var b = color % 256;
		color = ~~(color / 256);
		var g = color % 256;
		color = ~~(color / 256);
		var r = color % 256;

		ctx.beginPath();
		ctx.strokeStyle = "rgba("+ r + ", " + g + ", " + b + ", " + a + ")";
		ctx.moveTo(x1, y1);
		ctx.lineTo(x2, y2);
		ctx.stroke();
	},
	lineRGBA: function(dst, x1, y1, x2, y2, r, g, b, a) {
		var c = document.getElementById('canvas');
		var ctx = c.getContext("2d");

		var ctx = c.getContext("2d");
		if (r < 0) {
			r = 256 + r;
		}
		if (g < 0) {
			g = 256 + g;
		}
		if (b < 0) {
			b = 256 + b;
		}
		if (a < 0) {
			a = 256 + a;
		}

		ctx.beginPath();
		ctx.strokeStyle = "rgba("+ r + ", " + g + ", " + b + ", " + a + ")";
		ctx.moveTo(x1, y1);
		ctx.lineTo(x2, y2);
		ctx.stroke();
	},
	pixelColor: function(dst, x, y, color) {
		var c = document.getElementById('canvas');
		var ctx = c.getContext("2d");

		if (color < 0) {
			color = 4294967296 + color;
		}
		var a = color % 256;
		color = ~~(color / 256);
		var b = color % 256;
		color = ~~(color / 256);
		var g = color % 256;
		color = ~~(color / 256);
		var r = color % 256;

		ctx.filleStyle = "rgba("+ r + ", " + g + ", " + b + ", " + a + ")";
		ctx.fillRect(x, y, 1, 1);
	},
	pixelRGBA: function(dst, x, y, r, g, b, a) {
		var c = document.getElementById('canvas');
		var ctx = c.getContext("2d");

		var ctx = c.getContext("2d");
		if (r < 0) {
			r = 256 + r;
		}
		if (g < 0) {
			g = 256 + g;
		}
		if (b < 0) {
			b = 256 + b;
		}
		if (a < 0) {
			a = 256 + a;
		}

		ctx.filleStyle = "rgba("+ r + ", " + g + ", " + b + ", " + a + ")";
		ctx.fillRect(x, y, 1, 1);
	},
	rectangleColor: function(dst, x1, y1, x2, y2, color) {
		var c = document.getElementById('canvas');
		var ctx = c.getContext("2d");

		if (color < 0) {
			color = 4294967296 + color;
		}
		var a = color % 256;
		color = ~~(color / 256);
		var b = color % 256;
		color = ~~(color / 256);
		var g = color % 256;
		color = ~~(color / 256);
		var r = color % 256;

		ctx.strokeStyle = "rgba("+ r + ", " + g + ", " + b + ", " + a + ")";
		ctx.strokeRect(x1, y1, x2, y2);
	},
	rectangleRGBA: function(dst, x1, y1, x2, y2, r, g, b, a) {
		var c = document.getElementById('canvas');
		var ctx = c.getContext("2d");

		var ctx = c.getContext("2d");
		if (r < 0) {
			r = 256 + r;
		}
		if (g < 0) {
			g = 256 + g;
		}
		if (b < 0) {
			b = 256 + b;
		}
		if (a < 0) {
			a = 256 + a;
		}

		ctx.strokeStyle = "rgba("+ r + ", " + g + ", " + b + ", " + a + ")";
		ctx.strokeRect(x1, y1, x2, y2);
	},
	SDL_UpdateRect: function(dst, x, y, w, h) {
		
	}
});

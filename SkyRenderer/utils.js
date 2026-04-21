function clamp(v, min, max) {
	return Math.max(min, Math.min(max, v));
}

function lerp(a, b, t) {
	return a + (b - a) * t;
}

function smoothstep(a, b, x) {
	const t = clamp((x - a) / (b - a), 0, 1);
	return t * t * (3 - 2 * t);
}

function rand(min, max) {
	return Math.random() * (max - min) + min;
}

function degToRad(deg) {
	return (deg * Math.PI) / 180;
}

function hexToRgb(hex) {
	const clean = hex.replace("#", "");
	const n = parseInt(clean, 16);
	return {
		r: (n >> 16) & 255,
		g: (n >> 8) & 255,
		b: n & 255
	};
}

function rgbToHex(c) {
	const toHex = (n) => n.toString(16).padStart(2, "0");
	return `#${toHex(c.r)}${toHex(c.g)}${toHex(c.b)}`;
}

function mixColor(a, b, t) {
	const c1 = typeof a === "string" ? hexToRgb(a) : a;
	const c2 = typeof b === "string" ? hexToRgb(b) : b;
	return {
		r: Math.round(lerp(c1.r, c2.r, t)),
		g: Math.round(lerp(c1.g, c2.g, t)),
		b: Math.round(lerp(c1.b, c2.b, t))
	};
}

function rgb(c, a = 1) {
	if (a === 1) return `rgb(${c.r},${c.g},${c.b})`;
	return `rgba(${c.r},${c.g},${c.b},${a})`;
}

function fillCircle(ctx, cx, cy, r, color) {
	ctx.fillStyle = color;
	for (let y = -r; y <= r; y++) {
		for (let x = -r; x <= r; x++) {
			if (x * x + y * y <= r * r) {
				ctx.fillRect(cx + x, cy + y, 1, 1);
			}
		}
	}
}

function fillGlow(ctx, cx, cy, innerR, outerR, color, alphaMax) {
	const c = typeof color === "string" ? hexToRgb(color) : color;
	for (let r = outerR; r > innerR; r -= 2) {
		const t = 1 - (r - innerR) / Math.max(1, outerR - innerR);
		fillCircle(ctx, cx, cy, r, `rgba(${c.r},${c.g},${c.b},${alphaMax * t * t})`);
	}
}
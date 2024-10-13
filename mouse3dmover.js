export function initMouse3DMover(app, hostEl) {
	let isDragging = false;
	let lastX = 0;
	let lastY = 0;

	hostEl.addEventListener('mousedown', e => {
		isDragging = true;
		lastX = e.clientX;
		lastY = e.clientY;
	});
	hostEl.addEventListener('mouseup', e => {
		if (isDragging) e.preventDefault();
		setTimeout(() => isDragging = false, 100);
	});
	hostEl.addEventListener('contextmenu', e => isDragging ? e.preventDefault() : null);
	hostEl.addEventListener('mousemove', e => {
		if (!isDragging) return;
		if (!e.buttons) return isDragging = false;
		const isPanning = e.buttons >= 2;
		const dx = e.clientX - lastX;
		const dy = e.clientY - lastY;
		lastX = e.clientX;
		lastY = e.clientY;
		if (dx + dy > 0) e.preventDefault();
		if (!app.svgGroup) return
		if (isPanning) {
			app.scene.position.x += dx * 0.08 * app.cfg.sensitivity.pan;
			app.scene.position.y -= dy * 0.08 * app.cfg.sensitivity.pan;
		}
		else {
			app.scene.rotation.y += dx * 0.004 * app.cfg.sensitivity.rotate;
			app.scene.rotation.x += dy * 0.004 * app.cfg.sensitivity.rotate;
		}
	});

	hostEl.addEventListener('wheel', e => {
		app.scene.position.z -= e.deltaY * 0.05 * app.cfg.sensitivity.zoom;
	}, { passive: true });
}

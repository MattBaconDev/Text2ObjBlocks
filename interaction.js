import * as THREE from 'three';

export default class Interaction {
	constructor(app) {
		this.app = app;
		this.raycaster = new THREE.Raycaster();
		this.mouse = new THREE.Vector2();
		this.overChar = null;
		this.selectedChar = null;
		this.mouseDownChar = null;
	}
	clearSelection() {
		if (!this.selectedChar) return;
		this.applySelection(this.selectedChar, false);
		this.selectedChar = null;
	}
	init() {
		this.app.canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
		this.app.canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
		this.app.canvas.addEventListener('click', this.onClick.bind(this));
		this.app.canvas.addEventListener('keydown', this.onKeyDown.bind(this));
	}
	onMouseMove(ev) {
		this.#_updateMouse(ev);
		const char = this.#_charUnderMouse();
		if (char !== this.overChar) {
			this.overChar = char;
		}
	}
	onMouseDown(ev) {
		this.#_updateMouse(ev);
		this.mouseDownChar = this.overChar;
	}
	onClick(ev) {
		this.#_updateMouse(ev);
		const char = this.#_charUnderMouse();
		if (char !== this.selectedChar && char === this.mouseDownChar) {
			const prevSelection = this.selectedChar;
			this.selectedChar = char;
			if (prevSelection) {
				this.applySelection(prevSelection, false);
			}
			if (!char) return;
			this.applySelection(char, true);
		}
	}
	applySelection(char, force = null) {
		const selected = typeof force === 'boolean' ? force : char.name === this.selectedChar?.name;
		if (selected && char !== this.selectedChar && char.name === this.selectedChar.name) {
			this.selectedChar = char;
		}
		char.material.color.set(selected ? this.app.cfg.selectedColour : this.app.cfg.defaultColour);
		const block = this.app.getMeshByName('block_' + char.name);
		if (block) {
			block.material.color.set(selected ? this.app.cfg.selectedColour : this.app.cfg.defaultColour);
		}
		this.app.needsRedraw = true;
	}
	#_updateMouse(ev) {
		this.mouse.x = (ev.clientX / this.app.canvas.clientWidth) * 2 - 1;
		this.mouse.y = -(ev.clientY / this.app.canvas.clientHeight) * 2 + 1;
	}
	#_rayCast(maxDepth = 1) {
		this.raycaster.setFromCamera(this.mouse, this.app.camera);
		const intersects = this.raycaster.intersectObjects(this.app.scene.children);
		return intersects.slice(0, maxDepth);
	}
	#_meshUnderMouse() {
		return this.#_rayCast()[0]?.object;
	}
	#_charUnderMouse() {
		let mesh = this.#_meshUnderMouse();
		if (!mesh) return null;
		if (mesh.userData.type === 'block') {
			mesh = this.app.getMeshByName(mesh.name.replace('block_', ''));
		}
		if (!mesh ||mesh.userData.type !== 'char') return null;
		return mesh;
	}
	onKeyDown(ev) {
		if (ev.key === 'Backspace') {
			this.resetChanges(this.selectedChar);
		}
		if (!this.selectedChar) return;
		if (ev.key === 'Escape') return this.clearSelection();
		if (ev.key === ']') {
			this.selectedChar.scale.z += 0.1;
			this.app.needsRedraw = true;
		}
		if (ev.key === '[') {
			this.selectedChar.scale.z -= 0.1;
			this.app.needsRedraw = true;
		}
		if (ev.key === 'ArrowUp') {
			this.selectedChar.position.y -= 0.1;
			this.app.needsRedraw = true;
		}
		if (ev.key === 'ArrowDown') {
			this.selectedChar.position.y += 0.1;
			this.app.needsRedraw = true;
		}
		if (ev.key === 'ArrowLeft') {
			this.selectedChar.position.x += 0.1 * (this.app.cfg.mirror ? 1 : -1);
			this.app.needsRedraw = true;
		}
		if (ev.key === 'ArrowRight') {
			this.selectedChar.position.x -= 0.1 * (this.app.cfg.mirror ? 1 : -1);
			this.app.needsRedraw = true;
		}
	}
	resetChanges(mesh = null) {
		if (!mesh) {
			this.app.getMeshByType('char').forEach(mesh => this.resetChanges(mesh));
			return;
		}
		mesh.scale.copy(mesh.userData.originalScale);
		mesh.position.copy(mesh.userData.originalPosition);
		this.app.needsRedraw = true;
	}
}

import * as THREE from 'three';
import { getBox, getCenter, getSize } from './utils.js';

export default class Interaction {
	constructor(app) {
		this.app = app;
		this.raycaster = new THREE.Raycaster();
		this.mouse = new THREE.Vector2();
		this.overChar = null;
		this.selectedChar = null;
		this.mouseDownChar = null;
	}
	get selectedBlock() {
		return this.selectedChar ? this.#_getCharBlock(this.selectedChar) : null;
	}
	#_getCharBlock(char) {
		return this.app.getMeshByName('block_' + char.name);
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
		const char = this.#_charUnderMouse(false);
		if (char !== this.overChar) {
			this.overChar = char;
		}
	}
	onMouseDown(ev) {
		this.#_updateMouse(ev);
		const char = this.#_charUnderMouse(true);
		this.mouseDownChar = char;
	}
	onClick(ev) {
		this.#_updateMouse(ev);
		const char = this.#_charUnderMouse(true);
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
		if (this.app.cfg.editMode !== 'mesh') return;
		char.material.color.set(selected ? this.app.cfg.selectedColour : this.app.cfg.defaultColour);
		const block = this.#_getCharBlock(char);
		if (block) {
			block.material.color.set(selected ? this.app.cfg.selectedColour : this.app.cfg.defaultColour);
		}
		this.app.needsRedraw = true;
	}
	#_updateMouse(ev) {
		const renderSize = new THREE.Vector2()
		this.app.renderer.getSize(renderSize);
		this.mouse.x = (ev.offsetX / renderSize.x) * 2 - 1;
		this.mouse.y = -(ev.offsetY / renderSize.y) * 2 + 1;
	}
	#_rayCast(maxDepth = 1) {
		this.raycaster.setFromCamera(this.mouse, this.app.camera);
		const intersects = this.raycaster.intersectObjects(this.app.scene.children);
		return intersects.slice(0, maxDepth);
	}
	#_meshUnderMouse() {
		const { object, point } = this.#_rayCast()[0] ?? {};
		return { object, point };
	}
	#_charUnderMouse(allowNearby = false) {
		let { point, object: mesh } = this.#_meshUnderMouse();
		if (!mesh) return null;
		if (mesh.userData.type === 'block') {
			mesh = this.app.getMeshByName(mesh.name.replace('block_', ''));
			if (!mesh && allowNearby) {
				mesh = this.app.meshes.find(m => getBox(m, 0.5).containsPoint(point));
			}
		}
		if (!mesh || mesh.userData.type !== 'char') return null;
		return mesh;
	}
	onKeyDown(ev) {
		if (this.app.cfg.editMode !== 'mesh') return;
		if (ev.key === 'Backspace') {
			this.resetChanges(this.selectedChar);
			if (this.selectedBlock) this.resetChanges(this.selectedBlock);
		}
		if (!this.selectedChar) return;
		if (ev.key === 'Escape') return this.clearSelection();
		const editMeshes = [this.selectedChar];
		const selBlock = this.selectedBlock;
		if (ev.shiftKey && selBlock) editMeshes.push(selBlock);
		if (ev.ctrlKey && selBlock) editMeshes.splice(0, 1, selBlock);
		if (ev.key === ']') {
			editMeshes.forEach(m => m.scale.z += 0.1);
			this.app.needsRedraw = true;
		}
		if (ev.key === '[') {
			editMeshes.forEach(m => m.scale.z -= 0.1);
			this.app.needsRedraw = true;
		}
		if (ev.key === 'ArrowUp') {
			editMeshes.forEach(m => m.position.y -= 0.1);
			this.app.needsRedraw = true;
		}
		if (ev.key === 'ArrowDown') {
			editMeshes.forEach(m => m.position.y += 0.1);
			this.app.needsRedraw = true;
		}
		if (ev.key === 'ArrowLeft') {
			editMeshes.forEach(m => m.position.x += 0.1 * (this.app.cfg.mirror ? 1 : -1));
			this.app.needsRedraw = true;
		}
		if (ev.key === 'ArrowRight') {
			editMeshes.forEach(m => m.position.x -= 0.1 * (this.app.cfg.mirror ? 1 : -1));
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

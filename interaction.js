import * as THREE from 'three';

export default class Interaction {
	constructor(app) {
		this.app = app;
		this.raycaster = new THREE.Raycaster();
		this.mouse = new THREE.Vector2();
		this.overGroup = null;
		this.selectedGroup = null;
	}
	get selectedLetter() {
		return this.selectedGroup?.name.split('_')[1];
	}
	get selectedLetterMesh() {
		return this.selectedGroup?.children[0];
	}
	get selectedPlateMesh() {
		return this.selectedGroup?.children[1];
	}
	clearSelection() {
		if (!this.selectedGroup) return;
		this.applySelection(this.selectedGroup, false);
		this.selectedGroup = null;
	}
	init() {
		this.app.canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
		this.app.canvas.addEventListener('click', this.onClick.bind(this));
		this.app.canvas.addEventListener('keydown', this.onKeyDown.bind(this));
	}
	onMouseMove(ev) {
		this.#_updateMouse(ev);
		const group = this.#_groupUnderMouse();
		if (group !== this.overGroup) {
			this.overGroup = group;
		}
	}
	onClick(ev) {
		this.#_updateMouse(ev);
		const group = this.#_groupUnderMouse();
		if (group !== this.selectedGroup) {
			const prevSelection = this.selectedGroup;
			this.selectedGroup = group;
			if (prevSelection) {
				this.applySelection(prevSelection, false);
			}
			if (!group) return;
			this.applySelection(group);
		}
	}
	applySelection(group, force = null) {
		const selected = typeof force === 'boolean' ? force : group.name === this.selectedGroup?.name;
		if (selected && group !== this.selectedGroup && group.name === this.selectedGroup.name) {
			this.selectedGroup = group;
		}
		group.children.forEach(child => {
			child.material.color.set(selected ? this.app.cfg.selectedColour : this.app.cfg.defaultColour);
		});
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
	#_groupUnderMouse() {
		const mesh = this.#_meshUnderMouse();
		const parent = mesh?.parent;
		if (!parent) return null;
		if (parent.name.startsWith('letter_')) return parent;
	}
	onKeyDown(ev) {
		if (ev.key === 'Backspace') {
			this.resetChanges(this.selectedLetterMesh);
		}
		if (!this.selectedGroup) return;
		if (ev.key === 'Escape') return this.clearSelection();
		if (ev.key === ']') {
			this.selectedLetterMesh.scale.z += 0.1;
		}
		if (ev.key === '[') {
			this.selectedLetterMesh.scale.z -= 0.1;
		}
		if (ev.key === 'ArrowUp') {
			this.selectedLetterMesh.position.y -= 0.1;
		}
		if (ev.key === 'ArrowDown') {
			this.selectedLetterMesh.position.y += 0.1;
		}
	}
	resetChanges(mesh = null) {
		if (!mesh) {
			this.app.svgGroup.children.forEach(group => {
				group.children.forEach(child => {
					this.resetChanges(child);
				});
			});
			return;
		}
		mesh.scale.copy(mesh.userData.originalScale);
		mesh.position.copy(mesh.userData.originalPosition);
	}
}

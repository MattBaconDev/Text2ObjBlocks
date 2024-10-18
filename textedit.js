import * as THREE from 'three';

const clock = new THREE.Clock();

class TextCursor {
	lineIdx = -1;
	lineCharIdx = -1;
	visible = true;
	size = null;
	placement = 'after';
	constructor(app) {
		this.app = app;
		const geo = new THREE.BoxGeometry(app.cfg.fontSize/4, app.cfg.fontSize, 1);
		const mat = new THREE.MeshBasicMaterial({ color: 0x66CCFF });
		this.obj = new THREE.Mesh(geo, mat);
	}
	reset() {
		this.lineIdx = -1;
		this.lineCharIdx = -1;
	}
	setSize(width, height, depth) {
		this.obj.scale.x = width;
		this.obj.scale.y = height;
		this.obj.scale.z = depth;
		this.obj.position.z = depth/2;
		this.size = getObjSize(this.obj);
	}
	setLinePos(lineIdx, lineCharIdx) {
		this.lineIdx = lineIdx;
		this.lineCharIdx = lineCharIdx;
		this.checkPosition();
	}
	forChar(char) {
		this.setLinePos(char.userData.lineIdx, char.userData.lineCharIdx);
	}
	checkPosition() {
		const prevPos = this.obj.position.clone();
		const line = this.app.lines[this.lineIdx];
		let hookIdx = this.lineCharIdx;
		let hookType = 'before';
		if (hookIdx === line.length) {
			hookIdx -= 1;
			hookType = 'after';
		}
		const letterMesh = this.app.meshes.find(m => m.userData.type === 'char' && m.userData.lineIdx === this.lineIdx && m.userData.lineCharIdx === hookIdx);
		if (!letterMesh) return;
		const usrData = letterMesh.userData;
		const letterCenter = getObjCenter(letterMesh);
		const letterSize = getObjSize(letterMesh);
		this.lineIdx = usrData.lineIdx;
		this.lineCharIdx = usrData.lineCharIdx;
		if (hookType === 'after') {
			this.lineCharIdx += 1;
		}
		const lineCenter = -(this.app.blockHeight/2) + (this.lineIdx * this.app.lineHeight * -1) + (getObjSize(this.app.svgGroup).y/2);
		const xShift = ((letterSize.x/2) + (this.size.x/3)) * (hookType === 'after' ? 1 : -1);
		this.obj.position.x = letterCenter.x + xShift;
		this.obj.position.y = lineCenter;
		if (prevPos.distanceTo(this.obj.position) > 0.01) {
			this.resetBlink();
			return true;
		}
		return false;
	}
	toggle(force = null) {
		const nowVisible = typeof force === 'boolean' ? force : !this.visible;
		this.visible = nowVisible;
		this.obj.visible = nowVisible;
	}
	moveLeft() {
		if (this.lineCharIdx === 0) {
			if (this.lineIdx === 0) return;
			this.setLinePos(this.lineIdx - 1, this.app.lines[this.lineIdx - 1].length);
		}
		else {
			this.setLinePos(this.lineIdx, this.lineCharIdx - 1);
		}
	}
	moveRight() {
		if (this.lineCharIdx === this.app.lines[this.lineIdx].length) {
			if (this.lineIdx === this.app.lines.length - 1) return;
			this.setLinePos(this.lineIdx + 1, 0);
		}
		else {
			this.setLinePos(this.lineIdx, this.lineCharIdx + 1);
		}
	}
	moveUp() {
		if (this.lineIdx === 0) return;
		const prevLine = this.app.lines[this.lineIdx - 1];
		if (this.lineCharIdx >= prevLine.length) this.lineCharIdx = prevLine.length;
		this.setLinePos(this.lineIdx - 1, this.lineCharIdx);
	}
	moveDown() {
		if (this.lineIdx === this.app.lines.length - 1) return;
		const nextLine = this.app.lines[this.lineIdx + 1];
		if (this.lineCharIdx >= nextLine.length) this.lineCharIdx = nextLine.length;
		this.setLinePos(this.lineIdx + 1, this.lineCharIdx);
	}
	toStartOfLine(lineIdx = -1) {
		if (typeof lineIdx !== 'number' || lineIdx < 0) lineIdx = this.lineIdx;
		this.setLinePos(lineIdx, 0);
	}
	toEndOfLine(lineIdx = -1) {
		if (typeof lineIdx !== 'number' || lineIdx < 0) lineIdx = this.lineIdx;
		this.setLinePos(lineIdx, this.app.lines[lineIdx].length);
	}
	toEnd(ofWholeText = false) {
		if (ofWholeText) {
			this.setLinePos(this.app.lines.length - 1, this.app.lines[this.app.lines.length - 1].length);
		}
		else {
			this.setLinePos(this.lineIdx, this.app.lines[this.lineIdx].length);
		}
	}
	moveEnd() {
		this.toEnd(false);
	}
	moveHome() {
		this.setLinePos(this.lineIdx, 0);
	}
	resetBlink() {
		this.toggle(true);
		clock.start();
		this.app.needsRedraw = true;
	}
}

export default class TextEdit {
	cursorShowTime = 0.8;
	cursorHideTime = 0.2;
	constructor(app) {
		this.app = app;
		this.cursor = new TextCursor(app);
	}
	init() {
		this.app.scene.add(this.cursor.obj);
		this.app.canvas.addEventListener('keydown', this.onKeyDown.bind(this));
		this.onRender();
		clock.start();
	}
	// Called after a full re-render
	onRender() {
		const depth = this.app.cfg.letterDepth + this.app.cfg.plateDepth;
		if (this.cursor.size === null && this.app.meshes.length) {
			this.cursor.setSize(this.app.meshes[0].scale.x, this.app.meshes[0].scale.y, depth);
		}
		if (this.cursor.lineIdx === -1) {
			this.cursor.toEnd(true);
		}
		else if (!this.app.lines[this.cursor.lineIdx]) {
			this.cursor.toEnd(true);
		}
		else {
			this.cursor.checkPosition();
		}
		this.app.scene.add(this.cursor.obj);
	}
	// Called every animation frame - returns whether app needs to redraw
	renderCheck() {
		const [ cursor, app ] = [ this.cursor, this.app ];
		if (cursor.size === null && app.meshes.length) {
			const depth = app.cfg.letterDepth + app.cfg.plateDepth;
			cursor.setSize(app.meshes[0].scale.x, app.meshes[0].scale.y, depth);
		}
		else if (cursor.size !== null) {
			cursor.checkPosition();
		}
		if (app.cfg.editMode !== 'text') {
			const wasVisible = cursor.visible;
			cursor.toggle(false);
			return wasVisible;
		}
		const cursorTime = cursor.visible ? this.cursorShowTime : this.cursorHideTime;
		if (clock.getElapsedTime() > cursorTime) {
			cursor.toggle();
			clock.start();
			return true;
		}
		return false;
	}
	#_updateTextFromLines() {
		this.app.text = this.app.lines.join('\n');
		this.app.elements.textInput.value = this.app.text;
		this.app.render();
	}
	insert(char) {
		const [ appLines, cursor ] = [ this.app.lines, this.cursor ];
		const lineArr = appLines[cursor.lineIdx].split('');
		lineArr.splice(cursor.lineCharIdx, 0, char);
		appLines[cursor.lineIdx] = lineArr.join('');
		this.#_updateTextFromLines();
		cursor.moveRight();
	}
	backspace() {
		const [ appLines, cursor ] = [ this.app.lines, this.cursor ];
		if (cursor.lineCharIdx === 0) {
			if (cursor.lineIdx === 0) return;
			const prevLineLen = appLines[cursor.lineIdx - 1].length;
			appLines[cursor.lineIdx - 1] += appLines[cursor.lineIdx];
			appLines.splice(cursor.lineIdx, 1);
			this.#_updateTextFromLines();
			cursor.setLinePos(cursor.lineIdx - 1, prevLineLen);
		}
		else {
			const lineArr = appLines[cursor.lineIdx].split('');
			lineArr.splice(cursor.lineCharIdx - 1, 1);
			appLines[cursor.lineIdx] = lineArr.join('');
			this.#_updateTextFromLines();
			cursor.moveLeft();
		}
	}
	delete() {
		const [ appLines, cursor ] = [ this.app.lines, this.cursor ];
		const line = appLines[cursor.lineIdx];
		if (cursor.lineCharIdx === line.length) {
			if (cursor.lineIdx === appLines.length - 1) return;
			appLines[cursor.lineIdx] += appLines[cursor.lineIdx + 1];
			appLines.splice(cursor.lineIdx + 1, 1);
			this.#_updateTextFromLines();
		}
		else {
			const lineArr = line.split('');
			lineArr.splice(cursor.lineCharIdx, 1);
			appLines[cursor.lineIdx] = lineArr.join('');
			this.#_updateTextFromLines();
		}
	}
	onKeyDown(ev) {
		if (this.app.cfg.editMode !== 'text') return;
		if (this.cursor.lineIdx === -1) return;
		if (typeof ev.key === 'string' && ev.key.length === 1) {
			this.insert(ev.key);
		}
		if (ev.key === 'Backspace') this.backspace();
		if (ev.key === 'Delete') this.delete();
		if (ev.key === 'ArrowLeft') this.cursor.moveLeft();
		if (ev.key === 'ArrowRight') this.cursor.moveRight();
		if (ev.key === 'ArrowUp') this.cursor.moveUp();
		if (ev.key === 'ArrowDown') this.cursor.moveDown();
		if (ev.key === 'End') this.cursor.moveEnd();
		if (ev.key === 'Home') this.cursor.moveHome();
		if (ev.key === 'Enter') this.newline();
	}
	newline() {
		const [ appLines, cursor ] = [ this.app.lines, this.cursor ];
		const line = appLines[cursor.lineIdx];
		if (cursor.lineCharIdx === 0) return cursor.moveDown();
		if (cursor.lineCharIdx === line.length && cursor.lineIdx < appLines.length - 1) return cursor.moveRight();
		if (cursor.lineCharIdx === line.length) return;
		appLines.splice(cursor.lineIdx + 1, 0, line.slice(cursor.lineCharIdx));
		appLines[cursor.lineIdx] = line.slice(0, cursor.lineCharIdx);
		this.#_updateTextFromLines();
		cursor.moveRight();
	}
}

function getObjCenter(obj) {
	const box = new THREE.Box3().setFromObject(obj);
	return box.getCenter(new THREE.Vector3());
}
function getObjSize(obj) {
	const box = new THREE.Box3().setFromObject(obj);
	return box.getSize(new THREE.Vector3());
}
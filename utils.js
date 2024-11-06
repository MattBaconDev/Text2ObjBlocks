import * as THREE from 'three';

export function getBox(obj, expandBy = 0) {
	const box = new THREE.Box3().setFromObject(obj);
	if (expandBy) box.expandByScalar(expandBy);
	return box;
}
export function getCenter(obj) {
	const box = getBox(obj);
	return box.getCenter(new THREE.Vector3());
}
export function getSize(obj) {
	const box = getBox(obj);
	return box.getSize(new THREE.Vector3());
}

export function setObjectPath(obj, path, value) {
	const pathParts = path.split('.');
	const last = pathParts.pop();
	let current = obj;
	pathParts.forEach(key => {
		current = current[key];
	});
	current[last] = value;
}
export function getObjectPath(obj, path) {
	const pathParts = path.split('.');
	let current = obj;
	pathParts.forEach(key => {
		current = current[key];
	});
	return current;
}

export function targetThrottle(callback, limit) {
	let waiting = new Set();
	let blocked = new Set();
	return function tryCall(ev, ...args) {
		const key = ev.target;
		if (waiting.has(key)) {
			blocked.add(key);
			return;
		}
		callback.apply(this, [ ev, ...args ]);
		blocked.delete(key);
		waiting.add(key);
		setTimeout(() => {
			waiting.delete(key);
			if (blocked.has(key)) tryCall(ev, ...args);
		}, limit);
	}
}
export function throttle(callback, limit) {
	let waiting = false;
	let blocked = false;
	return function tryCall(...args) {
		if (waiting) {
			blocked = true;
			return;
		}
		callback.apply(this, args);
		blocked = false;
		waiting = true;
		setTimeout(() => { waiting = false; if (blocked) tryCall(...args) }, limit);
	}
}

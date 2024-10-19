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

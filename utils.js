import * as THREE from 'three';

export function getBox(obj, expandBy = 0.5) {
	const box = new THREE.Box3().setFromObject(obj);
	box.expandByScalar(expandBy);
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

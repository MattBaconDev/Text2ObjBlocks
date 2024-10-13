import * as THREE from 'three';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import FontProvider from './fonts.js';
import { enableExportScene } from './export.js';
import RenderController from './RenderController.js';
import Interaction from './interaction.js';
import { CSG } from './libs/CSGMesh.js';

await import('opentype');

const cfg = {
	defaultFontPath: './fonts/Roboto-Regular.ttf',
	autoRotate: false,
	mirrored: true,
	fontSize: 15,
	plateOverlap: 0.1,
	letterSpacing: 1,
	letterDepth: 2,
	plateDepth: 21.318,
	plateXPadding: 0,
	plateYPadding: 0,
	centreAlign: false,
	linoMode: false,
	defaultColour: 0x666666,
	selectedColour: 0x00ff00,
	orthCamera: false,
	sensitivity: {
		pan: 1,
		rotate: 1,
		zoom: 1
	}
};

function getElById(id) {
	return document.getElementById(id);
}

const elements = {
	canvas: getElById('viewer-canvas'),
	svg: getElById('svg'),
	currFont: getElById('curr-font'),
	fontInput: getElById('font-input'),
	textInput: getElById('text-input'),
	exportButton: getElById('export-button'),
	letterDepthInput: getElById('letter-depth'),
	blockDepthInput: getElById('block-depth'),
	resetViewBtn: getElById('reset-view-btn'),
	linoModeInput: getElById('lino-mode'),
	fontSizeInput: getElById('font-size'),
	fullDepth: getElById('full-depth'),
};

class App {
	elements = elements;
	cfg = cfg;
	get font() {
		return this.fontProvider.font;
	}
	text = '';
	scene = new THREE.Scene();
	svgGroup = new THREE.Group();
	initialised = false;
	groupRotation = new THREE.Euler(0, 0, 0);
	fontPath = cfg.defaultFontPath;
	fontProvider = new FontProvider(this);
	renderController = new RenderController(this);
	interaction = new Interaction(this);
	plateMat = makeMaterial(cfg.defaultColour, './textures/metal.jpg', 5);
	letterMat = makeMaterial(cfg.defaultColour);
	constructor(container) {
		if (!container) container = document.body;
		this.camera = new THREE.PerspectiveCamera(25, window.innerWidth / window.innerHeight, 0.1, 1000);
		if (cfg.orthCamera) this.camera = new THREE.OrthographicCamera(-100, 100, 100, -100, 0.1, 1000);
		this.canvas = elements.canvas;
		this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
		this.renderer.setSize(window.innerWidth, window.innerHeight);
		document.body.appendChild(this.renderer.domElement);
		this.camera.position.z = 150;
		this.camera.position.y = -275;
		this.text = '';
		if (cfg.orthCamera) this.camera.scale.multiplyScalar(0.2);
		this.orbitControls = new OrbitControls(this.camera, this.renderer.domElement);
		this.orbitControls.target = new THREE.Vector3(0, 0, 0);
		this.scene.background = new THREE.Color(0x053555);
	}
	emptyScene() {
		emptyObject(this.svgGroup);
		emptyObject(this.scene);
	}
	getSceneName() {
		return this.font.names.fullName.en + '_' + this.text.replace(/[^A-Za-z0-9]/g, '').substring(0, 5);
	}
	async render() {
		await this.fontProvider.load(this.fontPath);
		elements.currFont.textContent = this.font.names.fullName.en;
		if (this.initialised) {
			this.groupRotation = this.svgGroup.rotation.clone();
			this.emptyScene();
			this.#_render();
		}
		const text = elements.textInput.value.trim();
		this.text = text;
		const chars = text.replace(/\s+/g, '').split('');

		const svgData = buildSVGData(text, this.font, elements.svg);

		this.svgGroup = new THREE.Group();

		svgData.paths.forEach((path, i) => {
			const shapes = SVGLoader.createShapes(path);
			const letterGeos = [];
			shapes.forEach((shape, j) => {
				const geometry = new THREE.ExtrudeGeometry(shape, {
					depth: cfg.letterDepth + cfg.plateOverlap,
					bevelEnabled: false,
				});
				letterGeos.push(geometry);
			});
			const bufferGeo = BufferGeometryUtils.mergeGeometries(letterGeos, false);
			const letterMesh = new THREE.Mesh(bufferGeo, this.letterMat.clone());
			letterMesh.name = getMeshName(chars, i);
			this.svgGroup.add(letterMesh);
		});

		const letters = Array.from(this.svgGroup.children);

		const sizes = [];

		for (const letter of letters) {
			const size = getObjSize(letter);
			sizes.push(size);
		}

		const svgGroupBox = new THREE.Box3().setFromObject(this.svgGroup);
		const svgGroupCenter = new THREE.Vector3();
		svgGroupBox.getCenter(svgGroupCenter);
		const svgGroupSize = new THREE.Vector3();
		svgGroupBox.getSize(svgGroupSize);

		const groupHeight = svgGroupSize.y;

		this.svgGroup.scale.y *= -1;
		this.svgGroup.position.y = -10;
		this.svgGroup.rotation.copy(this.groupRotation);
		this.scene.add(this.svgGroup);

		if (cfg.linoMode) {
			const startLetter = letters[0];
			const endLetter = letters[letters.length - 1];
			const startLetterSize = sizes[0];
			const endLetterSize = sizes[sizes.length - 1];
			const { normPadLeft } = getGlyphInfo(startLetter.name, startLetterSize);
			const { normPadRight } = getGlyphInfo(endLetter.name, endLetterSize);
			const normPadding = normPadLeft + normPadRight;
			const plateGeo = new THREE.BoxGeometry(svgGroupSize.x + normPadding, groupHeight + cfg.plateYPadding, cfg.plateDepth);
			const plateMesh = new THREE.Mesh(plateGeo, this.plateMat.clone());
			const meshSize = getObjSize(plateMesh);
			plateMesh.position.x = svgGroupCenter.x + (normPadding / 2) - normPadLeft;
			plateMesh.position.y = svgGroupCenter.y;
			plateMesh.position.z = (-meshSize.z / 2) + cfg.plateOverlap;
			plateMesh.updateMatrix();

			const subbedPlateMesh = nickMesh(plateMesh, meshSize);

			const letterGroup = new THREE.Group();
			letterGroup.name = 'lino_' + text;
			letterGroup.add(...letters);
			letterGroup.add(subbedPlateMesh);
			if (cfg.mirrored) letterGroup.scale.multiply(new THREE.Vector3(-1, 1, 1));
			this.svgGroup.add(letterGroup);
			this.interaction.applySelection(letterGroup);
		}
		else {
			for (const letter of letters) {
				const i = letters.indexOf(letter);
				const center = getObjCenter(letter);
				const size = sizes[i];
				const { normPadLeft, normPadding } = getGlyphInfo(letter.name, size);
				const plateGeo = new THREE.BoxGeometry(size.x + normPadding, groupHeight + cfg.plateYPadding, cfg.plateDepth);
				const plateMesh = new THREE.Mesh(plateGeo, this.plateMat.clone());
				const meshSize = getObjSize(plateMesh);
				plateMesh.position.x = center.x + (normPadding / 2) - normPadLeft;
				plateMesh.position.y = svgGroupCenter.y;
				plateMesh.position.z = (-meshSize.z / 2) + cfg.plateOverlap;
				plateMesh.updateMatrix();

				const subbedPlateMesh = nickMesh(plateMesh, meshSize);

				const letterGroup = new THREE.Group();
				letterGroup.name = 'letter_' + letter.name;
				letterGroup.add(letter);
				letterGroup.add(subbedPlateMesh);
				if (cfg.mirrored) letterGroup.scale.multiply(new THREE.Vector3(-1, 1, 1));
				this.svgGroup.add(letterGroup);
				this.interaction.applySelection(letterGroup);
			}
		}

		// Center svgGroup children to the group
		const groupBox = new THREE.Box3().setFromObject(this.svgGroup);
		const groupCenter = new THREE.Vector3();
		groupBox.getCenter(groupCenter);

		this.svgGroup.children.forEach(child => {
			child.position.sub(groupCenter);
		});

		let prevXBounds = { left: 0, right: 0 };
		let shifted = 0;

		this.svgGroup.children.forEach((child, i) => {
			const centre = getObjCenter(child);
			const l = centre.x - sizes[i].x / 2;
			const r = centre.x + sizes[i].x / 2;
			const lPos = new THREE.Vector3(l, centre.y, centre.z);
			const rPos = new THREE.Vector3(r, centre.y, centre.z);
			const xBounds = { left: lPos.x, right: rPos.x };
			if (i > 0) {
				const dist = xBounds.left - prevXBounds.right;
				const shift = (-dist) + Math.max(2.5, ((cfg.fontSize / 4) * cfg.letterSpacing));
				child.translateX(shifted + shift);
				shifted += shift;
			}
			prevXBounds = xBounds;
		});

		groupBox.setFromObject(this.svgGroup);
		groupBox.getCenter(groupCenter);
		this.svgGroup.children.forEach(child => {
			child.position.sub(groupCenter);
		});
		this.svgGroup.position.set(0, 0, 0);

		const visWidth = visibleWidthAtZDepth(10, this.camera);
		const groupSize = getObjSize(this.svgGroup);
		if (groupSize.x > visWidth) {
			this.camera.position.z /= (visWidth / groupSize.x);
		}

		for (const group of this.svgGroup.children) {
			group.children[0].userData.originalScale = group.children[0].scale.clone();
			group.children[0].userData.originalPosition = group.children[0].position.clone();
			group.children[1].userData.originalScale = group.children[1].scale.clone();
			group.children[1].userData.originalPosition = group.children[1].position.clone();
		}

		const planeSize = 50;
		const quads = [[], []];
		for (let x = 0; x <= 1; x++) {
			for (let y = 0; y <= 1; y++) {
				const geometry = new THREE.PlaneGeometry(planeSize, planeSize);
				const material = new THREE.MeshBasicMaterial({ color: 0x66CCFF, side: THREE.DoubleSide, wireframe: true });
				const plane = new THREE.Mesh(geometry, material);
				plane.position.set(Math.sign(x - 0.5) * planeSize / 2, Math.sign(y - 0.5) * planeSize / 2, 0);
				this.scene.add(plane);
				quads[x][y] = plane;
			}
		}
		this.svgGroup.position.z += (cfg.plateDepth + cfg.letterDepth) / 2;

		const light = new THREE.AmbientLight(0xffffff, 0.5, 1);
		light.position.set(-50, 36, 15);
		this.scene.add(light);

		const directionalLight = new THREE.DirectionalLight(0xffffff, 3);
		directionalLight.position.set(30, 130, 120);
		directionalLight.target = this.svgGroup;
		this.scene.add(directionalLight);

		this.#_render();
		this.orbitControls.saveState();
		this.initialise();
	}
	#_render() {
		this.renderer.render(this.scene, this.camera);
	}
	initialise() {
		if (this.initialised) return;

		const animate = () => {
			requestAnimationFrame(animate);

			if (cfg.autoRotate) {
				this.svgGroup.rotation.y += 0.01;
			}
			this.#_render();
		};
		animate();

		window.addEventListener('resize', () => {
			app.camera.aspect = window.innerWidth / window.innerHeight;
			app.camera.updateProjectionMatrix();
			app.renderer.setSize(window.innerWidth, window.innerHeight);
		}, false);

		this.interaction.init();
		this.initialised = true;
	}
	resetView() {
		this.orbitControls.reset();
	}
}

const app = new App();

elements.textInput.addEventListener('input', () => {
	app.render();
});

enableExportScene(elements.exportButton, app);

app.render();

elements.resetViewBtn.addEventListener('click', () => app.resetView());

// helpers
function buildSVGData(text, font, previewEl = null) {
	const paths = font.getPaths(text, 0, 0, cfg.fontSize).filter(p => p.commands.length);
	const svgPaths = paths.map(p => p.toSVG()).join('');

	if (previewEl) {
		const path = font.getPath(text, 0, 0, cfg.fontSize);
		const bbox = path.getBoundingBox();
		previewEl.setAttribute('viewBox', `${bbox.x1} ${bbox.y1} ${bbox.x2 - bbox.x1} ${bbox.y2 - bbox.y1}`);
		previewEl.innerHTML = svgPaths;
	}

	const svgLoader = new SVGLoader();
	const svgData = svgLoader.parse('<g>' + svgPaths + '</g>');
	return svgData;
}
function getMeshName(chars, pathIdx) {
	const char = chars[pathIdx];
	let name = char;
	const multipleChars = chars.filter(c => c === char).length > 1;
	if (multipleChars) {
		const countSoFar = chars.slice(0, pathIdx).filter(c => c === char).length + 1;
		name += '-' + countSoFar;
	}
	return name;
}
function degreesToEuler(degrees) {
	return degrees * Math.PI / 180;
}
function getObjSize(obj) {
	const box = new THREE.Box3().setFromObject(obj);
	const size = new THREE.Vector3();
	box.getSize(size);
	return size;
}
function getObjCenter(obj) {
	const box = new THREE.Box3().setFromObject(obj);
	const center = new THREE.Vector3();
	box.getCenter(center);
	return center;
}
function getGlyphInfo(char, size) {
	const unicode = char.charCodeAt(0);
	const glyph = Object.values(app.font.glyphs.glyphs).find(g => g.unicode === unicode);
	if (!glyph.rightSideBearing) glyph.rightSideBearing = glyph.getMetrics().rightSideBearing;
	const normPadLeft = (glyph.leftSideBearing / (glyph.advanceWidth)) * size.x;
	const normPadRight = (glyph.rightSideBearing / (glyph.advanceWidth)) * size.x;
	const normPadding = normPadLeft + normPadRight;
	return { normPadLeft, normPadRight, normPadding };
}
function makeMaterial(colour = 0x666666, texture = '', bumpScale = 1) {
	let textureObj = null;
	if (texture) {
		textureObj = new THREE.TextureLoader().load(texture);
	}
	return new THREE.MeshStandardMaterial({ color: colour, map: textureObj, ...(textureObj ? { bumpMap: textureObj, bumpScale } : {}) });
}
function emptyObject(obj) {
	obj.children.forEach(child => obj.remove(child));
}
function debugCoord(coords, colour, size = 6) {
	const geom = new THREE.SphereGeometry(size);
	const mesh = new THREE.Mesh(geom, new THREE.MeshStandardMaterial({ color: colour }));
	mesh.position.copy(coords);
	app.scene.add(mesh);
	return mesh;
}
function debugBox(object, colour = 0xff0000) {
	const box = new THREE.BoxHelper(object, colour);
	app.scene.add(box);
	return box;
}
function nickMesh(mesh, meshSize, mat) {
	if (!mat) mat = mesh.material.clone();
	const rad = Math.min(1.5, meshSize.z / 8);
	const cylinder = new THREE.CylinderGeometry(rad, rad, meshSize.x * 1.1, 12);
	const cylinderMesh = new THREE.Mesh(cylinder, mat);
	cylinderMesh.position.copy(mesh.position);
	cylinderMesh.position.y += meshSize.y / 2;
	cylinderMesh.rotation.z = degreesToEuler(90);
	cylinderMesh.updateMatrix();

	const meshCSG = CSG.fromMesh(mesh, 0);
	const cylCSG = CSG.fromMesh(cylinderMesh, 1);
	const subbed = meshCSG.subtract(cylCSG);
	const subMesh = CSG.toMesh(subbed, mesh.matrix);
	subMesh.position.copy(mesh.position);
	subMesh.material = mat;
	return subMesh;
}
// Taken from user 'looeee' (https://discourse.threejs.org/t/functions-to-calculate-the-visible-width-height-at-a-given-z-depth-from-a-perspective-camera/269)
const visibleHeightAtZDepth = (depth, camera) => {
	// compensate for cameras not positioned at z=0
	const cameraOffset = camera.position.z;
	if (depth < cameraOffset) depth -= cameraOffset;
	else depth += cameraOffset;

	// vertical fov in radians
	const vFOV = camera.fov * Math.PI / 180;

	// Math.abs to ensure the result is always positive
	return 2 * Math.tan(vFOV / 2) * Math.abs(depth);
};
const visibleWidthAtZDepth = (depth, camera) => {
	const height = visibleHeightAtZDepth(depth, camera);
	return height * camera.aspect;
};
// End 'looeee' code

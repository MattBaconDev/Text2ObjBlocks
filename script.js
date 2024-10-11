import * as THREE from 'three';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import FontProvider from './fonts.js';
import { enableExportScene } from './export.js';
import { initMouse3DMover } from './mouse3dmover.js';
import RenderController from './RenderController.js';

await import('opentype');

const cfg = {
	defaultFontPath: './fonts/Gantry-Black.otf',
	autoRotate: false,
	fontSize: 22,
	letterDepth: 5,
	plateDepth: 7,
	plateXPadding: 3,
	plateYPadding: 3,
	centreAlign: false,
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
};

class App {
	elements = elements;
	cfg = cfg;
	get font() {
		return this.fontProvider.font;
	}
	scene = new THREE.Scene();
	svgGroup = new THREE.Group();
	initialised = false;
	groupRotation = new THREE.Euler(0.3, 0.3, 0.01);
	fontPath = cfg.defaultFontPath;
	fontProvider = new FontProvider(this);
	renderController = new RenderController(this);
	constructor(container) {
		if (!container) container = document.body;
		this.camera = new THREE.PerspectiveCamera(25, window.innerWidth / window.innerHeight, 0.1, 1000);
		this.canvas = document.getElementById('viewer-canvas');
		this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
		this.renderer.setSize(window.innerWidth, window.innerHeight);
		document.body.appendChild(this.renderer.domElement);
		this.camera.position.z = 150;
	}
	emptyScene() {
		emptyObject(this.svgGroup);
		emptyObject(this.scene);
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
		const chars = text.replace(/\s+/g, '').split('');

		const svgData = buildSVGData(text, this.font, elements.svg);

		this.svgGroup = new THREE.Group();
		const plateMat = makeMaterial(0x666666, './textures/metal.jpg', 5);
		const letterMat = makeMaterial(0x666666);

		svgData.paths.forEach((path, i) => {
			const shapes = SVGLoader.createShapes(path);
			const letterGeos = [];
			shapes.forEach((shape, j) => {
				const geometry = new THREE.ExtrudeGeometry(shape, {
					depth: cfg.letterDepth,
					bevelEnabled: false,
				});
				letterGeos.push(geometry);
			});
			const bufferGeo = BufferGeometryUtils.mergeGeometries(letterGeos, false);
			const letterMesh = new THREE.Mesh(bufferGeo, letterMat);
			letterMesh.name = getMeshName(chars, i);
			this.svgGroup.add(letterMesh);
		});

		const getObjSize = (obj) => {
			const box = new THREE.Box3().setFromObject(obj);
			const size = new THREE.Vector3();
			box.getSize(size);
			return size;
		};
		const getObjCenter = (obj) => {
			const box = new THREE.Box3().setFromObject(obj);
			const center = new THREE.Vector3();
			box.getCenter(center);
			return center;
		};

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

		for (const letter of letters) {
			const i = letters.indexOf(letter);
			const center = getObjCenter(letter);
			const size = sizes[i];
			const plateGeo = new THREE.BoxGeometry(size.x + cfg.plateXPadding, groupHeight + cfg.plateYPadding, cfg.plateDepth);
			const plateMesh = new THREE.Mesh(plateGeo, plateMat);
			const meshSize = getObjSize(plateMesh);
			plateMesh.position.x = center.x;
			plateMesh.position.y = svgGroupCenter.y;
			plateMesh.position.z = (-meshSize.z/2) + 0.1;

			const letterGroup = new THREE.Group();
			letterGroup.add(letter);
			letterGroup.add(plateMesh);
			this.svgGroup.add(letterGroup);
		}

		// Center svgGroup children to the group
		const groupBox = new THREE.Box3().setFromObject(this.svgGroup);
		const groupCenter = new THREE.Vector3();
		groupBox.getCenter(groupCenter);

		this.svgGroup.children.forEach(child => {
			child.position.sub(groupCenter);
		});

		this.svgGroup.position.add(groupCenter);

		this.camera.lookAt(this.svgGroup.position);

		const light = new THREE.AmbientLight(0xffffff, 0.5, 1);
		light.position.set(-50, 36, 15);
		this.scene.add(light);

		const directionalLight = new THREE.DirectionalLight(0xffffff, 3);
		directionalLight.position.set(30, 130, 120);
		directionalLight.target = this.svgGroup;
		this.scene.add(directionalLight);

		this.#_render();
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

		this.initialised = true;
	}
}

const app = new App();

elements.textInput.addEventListener('input', () => {
	app.render();
});

enableExportScene(elements.exportButton, app);

initMouse3DMover(app, elements.canvas);

app.render();

// helpers
function buildSVGData(text, font, previewEl = null) {
	const textSpaced = text.split('').join(' ');

	const paths = font.getPaths(textSpaced, 0, 0, cfg.fontSize).filter(p => p.commands.length);
	const svgPaths = paths.map(p => p.toSVG()).join('');

	if (previewEl) {
		const path = font.getPath(textSpaced, 0, 0, cfg.fontSize);
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

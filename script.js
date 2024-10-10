import * as THREE from 'three';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import FontProvider from './fonts.js';
import { enableExportScene } from './export.js';
import { initMouse3DMover } from './mouse3dmover.js';

await import('opentype');

const cfg = {
	defaultFontPath: './fonts/Gantry-Black.otf',
	autoRotate: false,
	fontSize: 22,
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
		const text = elements.textInput.value;

		// Create a path from the text
		const path = this.font.getPath(text, 0, 0, cfg.fontSize);
		const bbox = path.getBoundingBox();
		const svgPath = path.toSVG();

		elements.svg.setAttribute('viewBox', `${bbox.x1} ${bbox.y1} ${bbox.x2 - bbox.x1} ${bbox.y2 - bbox.y1}`);
		elements.svg.innerHTML = svgPath;

		const svgLoader = new SVGLoader();
		const svgData = svgLoader.parse(svgPath);

		this.svgGroup = new THREE.Group();
		const plateMat = makeMaterial(0x666666, './textures/metal.jpg', 5);
		const letterMat = makeMaterial(0x666666);

		svgData.paths.forEach((path, i) => {
			const shapes = SVGLoader.createShapes(path);

			shapes.forEach((shape, j) => {
				const geometry = new THREE.ExtrudeGeometry(shape, {
					depth: 5,
					bevelEnabled: false,
				});
				const mesh = new THREE.Mesh(geometry, letterMat);
				this.svgGroup.add(mesh);
			});
		});

		const box = new THREE.Box3().setFromObject(this.svgGroup);
		const size = new THREE.Vector3();
		box.getSize(size);

		const yOffset = size.y / -2;
		const xOffset = size.x / -2;

		const plateGeo = new THREE.BoxGeometry(size.x * 1.1, size.y * 1.3, 8);
		const mesh = new THREE.Mesh(plateGeo, plateMat);
		mesh.position.set(0, -(size.y / 1.1), -3);
		this.svgGroup.children.forEach(item => {
			item.position.x = xOffset;
			item.position.y = yOffset;
		});
		this.svgGroup.add(mesh);

		this.svgGroup.scale.y *= -1;
		this.svgGroup.position.y = -10;
		this.svgGroup.rotation.copy(this.groupRotation);
		this.scene.add(this.svgGroup);

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

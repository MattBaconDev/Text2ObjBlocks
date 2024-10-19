import * as THREE from 'three';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import FontProvider from './fonts.js';
import { enableExportScene } from './export.js';
import RenderController from './RenderController.js';
import Interaction from './interaction.js';
import { CSG } from './libs/CSGMesh.js';
import CameraControls from './libs/camera-controls.module.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import TextEdit from './textedit.js';
import { Events } from './events.js';

CameraControls.install({ THREE });
const clock = new THREE.Clock();

await import('opentype');

const cfg = {
	defaultFontPath: './fonts/Roboto-Regular.ttf',
	defaultValue: 'ABC',
	editMode: 'text',
	mirror: false,
	fontSize: 15,
	blockOverlap: 0.1,
	letterSpacing: 'auto',
	lineSpacing: 'auto',
	letterDepth: 2,
	blockDepth: 21.318,
	blockXPadding: 0,
	blockYPadding: 0,
	centreAlign: false,
	linoMode: false,
	defaultColour: 0x666666,
	selectedColour: 0x00ff00,
	orthCamera: false,
	targetRatio: 0.65,
	nickRadius: 'auto',
	nickDepth: 'auto',
	nickPosition: 'auto',
	sensitivity: {
		pan: 1,
		rotate: 1,
		zoom: 1
	}
};
cfg.defaultValue = `ABCDEFGHIJKLMN
OPQRSTUVWXYZ
abcdefghijklmn
opqrstuvwxyz
1234567890`;

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
	resetViewBtn: getElById('reset-view-btn'),
	zoomFitBtn: getElById('zoom-fit-btn'),
	editModeControl: getElById('edit-mode-control'),
};

class App {
	elements = elements;
	cfg = cfg;
	get font() {
		return this.fontProvider.font;
	}
	text = '';
	lines = [];
	meshes = [];
	blockHeight = 0;
	lineHeight = 0;
	scene = new THREE.Scene();
	svgGroup = new THREE.Group();
	initialised = false;
	fontPath = cfg.defaultFontPath;
	fontProvider = new FontProvider(this);
	renderController = new RenderController(this);
	interaction = new Interaction(this);
	blockMat = makeMaterial(cfg.defaultColour, './textures/metal.jpg', 5);
	letterMat = makeMaterial(cfg.defaultColour);
	savedOrbitState = false;
	plainFont = null;
	needsRedraw = true;
	events = Events.createScope('app');
	constructor(container) {
		if (!container) container = document.body;
		this.camera = new THREE.PerspectiveCamera(25, window.innerWidth / window.innerHeight, 0.1, 5000);
		if (cfg.orthCamera) this.camera = new THREE.OrthographicCamera(-100, 100, 100, -100, 0.1, 1000);
		this.canvas = elements.canvas;
		this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
		this.renderer.setSize(window.innerWidth, window.innerHeight);
		this.renderer.setPixelRatio(window.devicePixelRatio);
		document.body.appendChild(this.renderer.domElement);
		this.camera.position.z = 150;
		this.camera.position.y = -250;
		this.text = '';
		if (cfg.orthCamera) this.camera.scale.multiplyScalar(0.2);
		this.scene.background = new THREE.Color(0x053555);
		this.cameraControls = new CameraControls(this.camera, this.renderer.domElement);
		elements.textInput.value = cfg.defaultValue;
		this.textEdit = new TextEdit(this);
		document.querySelector(`input[name="edit-mode"][value="${cfg.editMode}"]`).checked = true;
	}
	emptyScene() {
		emptyObject(this.svgGroup);
		emptyObject(this.scene);
	}
	getSceneName() {
		return this.font.names.fullName.en + '_' + this.text.replace(/[^A-Za-z0-9]/g, '').substring(0, 5);
	}
	getMeshByName(name) {
		return this.meshes.find(m => m.name === name);
	}
	getMeshByType(type) {
		return this.meshes.filter(m => m.userData.type === type);
	}
	async loadPlainFont() {
		if (this.plainFont) return this.plainFont;
		const floader = new FontLoader();
		return new Promise((resolve, reject) => {
			floader.load('./fonts/Roboto_Regular.json', (font) => {
				this.plainFont = font;
				resolve(font);
			});
		});
	}
	async render() {
		/*
		 * SECTION: Prepare for rendering
		 */
		await this.fontProvider.load(this.fontPath);
		await this.loadPlainFont();
		elements.currFont.textContent = this.font.names.fullName.en;
		if (this.initialised) {
			this.emptyScene();
			this.#_render();
		}
		this.needsRedraw = true;

		/*
		 * SECTION: Prepare text
		 */
		const originalTextValue = elements.textInput.value;
		const lastChar = originalTextValue[originalTextValue.length - 1];
		const text = originalTextValue.trim();
		const lines = text.split(/(\r?\n)+/).map(line => line.trim()).filter(line => !!line);
		this.text = lines.join('\n');
		this.lines = lines;
		this.chars = lines.flatMap(line => line.split(''));
		elements.textInput.value = ['\n', ' '].includes(lastChar) ? this.text + lastChar : this.text;

		previewSVG(lines, elements.svg);

		this.svgGroup = new THREE.Group();
		const allLetters = Array.from(this.svgGroup.children).slice(0, 0);
		const allSizes = [];
		const lineGroups = allLetters.slice();

		/*
		 * SECTION: Create letters
		 */
		let tallestLetter = 0;
		let maxLetterY = 0;
		let minLetterY = 0;
		let charIdx = 0;
		lines.forEach((line, lineIdx) => {
			const svgData = buildSVGData(line.replace(/\s/g, '_'), this.font, elements.svg);
			const lineLetters = [];
			const lineGroup = new THREE.Group();
			lineGroup.name = 'line_' + lineIdx;
			svgData.paths.forEach((path, i) => {
				const shapes = SVGLoader.createShapes(path);
				const letterGeos = [];
				shapes.forEach((shape, j) => {
					const geometry = new THREE.ExtrudeGeometry(shape, {
						depth: cfg.letterDepth + cfg.blockOverlap,
						bevelEnabled: false,
					});
					letterGeos.push(geometry);
				});
				const bufferGeo = BufferGeometryUtils.mergeGeometries(letterGeos, false);
				const letterMesh = new THREE.Mesh(bufferGeo, this.letterMat.clone());
				const letterSize = getObjSize(letterMesh);
				letterMesh.name = getMeshName(this.chars, charIdx);
				letterMesh.userData.lineIdx = lineIdx;
				letterMesh.userData.lineCharIdx = i;
				letterMesh.userData.charIdx = charIdx;
				letterMesh.userData.type = 'char';
				letterMesh.userData.isStartOfLine = i === 0;
				letterMesh.userData.isEndOfLine = i === line.length - 1;
				if (line[i] === ' ') {
					letterMesh.userData.isSpace = true;
					letterMesh.material.visible = false;
					letterMesh.userData.excludeFromExport = true;
				}
				const letterHeight = letterSize.y;
				tallestLetter = Math.max(tallestLetter, letterHeight);
				lineLetters.push(letterMesh);
				charIdx++;
			});
			allLetters.push(...lineLetters);
			lineGroup.add(...lineLetters);
			let maxY = 0;
			let minY = 0;
			lineLetters.forEach(letter => {
				const size = getObjSize(letter);
				allSizes.push(size);
				const letterCenter = getObjCenter(letter).y;
				const letterHeight = size.y;
				const topY = letterCenter + (letterHeight / 2);
				const bottomY = letterCenter - (letterHeight / 2);
				maxY = Math.max(maxY, topY);
				minY = Math.min(minY, bottomY);
			});
			maxLetterY = Math.max(maxLetterY, maxY);
			minLetterY = Math.min(minLetterY, minY);
			lineGroups.push(lineGroup);
			this.svgGroup.add(lineGroup);
		});
		tallestLetter = maxLetterY - minLetterY;

		this.meshes = [...allLetters];

		/*
		 * SECTION: Block height and line height
		 */
		const blockHeight = tallestLetter + cfg.blockYPadding;
		const lineHeight = cfg.lineSpacing === 'auto' ? blockHeight * 1.15 : (blockHeight + cfg.lineSpacing);
		this.blockHeight = blockHeight;
		this.lineHeight = lineHeight;

		this.svgGroup.scale.y *= -1; // Correct text orientation
		this.scene.add(this.svgGroup);

		/*
		 * SECTION: Letter Spacing
		 */
		let shifted = 0;
		lineGroups.forEach((lineGroup, lgi) => {
			const letters = Array.from(lineGroup.children);
			shifted = 0;
			letters.forEach((letter, i) => {
				if (i === 0) return;
				let shift = cfg.letterSpacing === 'auto' ? getObjSize(letter).x / 20 : cfg.letterSpacing;
				if (!cfg.linoMode) shift += cfg.blockXPadding;
				letter.translateX(shifted + shift);
				shifted += shift;
			});
		});

		/*
		 * SECTION: Block creation
		 */
		const allCenter = getObjCenter(this.svgGroup);
		if (cfg.linoMode) {
			lineGroups.forEach((lineGroup, lgi) => {
				const lineSize = getObjSize(lineGroup);
				const lineCenter = getObjCenter(lineGroup);
				const letters = lineGroup.children;
				const startLetter = letters[0];
				const endLetter = letters[letters.length - 1];
				const startLetterSize = allSizes[0];
				const endLetterSize = allSizes[allSizes.length - 1];
				const { normPadLeft } = getGlyphInfo(startLetter.name, startLetterSize);
				const { normPadRight } = getGlyphInfo(endLetter.name, endLetterSize);
				let normPadding = normPadLeft + normPadRight;
				normPadding += cfg.blockXPadding;
				const blockGeo = new THREE.BoxGeometry(lineSize.x + normPadding, blockHeight, cfg.blockDepth);
				const blockMesh = new THREE.Mesh(blockGeo, this.blockMat.clone());
				const meshSize = getObjSize(blockMesh);
				blockMesh.position.x = lineCenter.x;
				blockMesh.position.y -= allCenter.y;
				blockMesh.position.z = (-meshSize.z / 2) + cfg.blockOverlap;
				blockMesh.updateMatrix();

				const subbedBlockMesh = nickMesh(blockMesh, meshSize);
				subbedBlockMesh.userData.type = 'block';
				subbedBlockMesh.name = 'block_' + lines[lgi];

				const letterGroup = new THREE.Group();
				letterGroup.name = 'line_' + lines[lgi];
				letters.forEach(letter => this.interaction.applySelection(letter));
				letterGroup.add(...letters);
				letterGroup.add(subbedBlockMesh);
				this.meshes.push(subbedBlockMesh);
				this.svgGroup.add(letterGroup);
				letterGroup.translateY(lgi * lineHeight);
				lineGroups[lgi] = letterGroup;
			});

			// Save original scale and position, to enable resetting when modifying
			for (const child of Array.from(lineGroups).flatMap(lg => lg.children)) {
				if (this.chars.includes(child.name.replace(/\-\d+$/, ''))) {
					child.userData.originalScale = child.scale.clone();
					child.userData.originalPosition = child.position.clone();
				}
			}
		}
		else {
			lineGroups.forEach((lineGroup, lgi) => {
				const letters = Array.from(lineGroup.children);
				for (const letter of letters) {
					const letterCenter = getObjCenter(letter);
					const i = allLetters.indexOf(letter);
					const size = allSizes[i];
					let { normPadLeft, normPadding } = getGlyphInfo(letter.name, size);
					normPadding += cfg.blockXPadding;
					const blockGeo = new THREE.BoxGeometry(size.x + normPadding, blockHeight, cfg.blockDepth);
					const blockMesh = new THREE.Mesh(blockGeo, this.blockMat.clone());
					const meshSize = getObjSize(blockMesh);
					blockMesh.position.x = letterCenter.x + (normPadding / 2) - normPadLeft - (cfg.blockXPadding / 2);
					blockMesh.position.z = (-meshSize.z / 2) + cfg.blockOverlap;
					blockMesh.updateMatrix();

					const subbedBlockMesh = nickMesh(blockMesh, meshSize);
					subbedBlockMesh.userData.type = 'block';
					subbedBlockMesh.name = 'block_' + letter.name;
					subbedBlockMesh.material.visible = letter.material.visible;
					if (letter.userData.excludeFromExport) subbedBlockMesh.userData.excludeFromExport = true;

					const letterGroup = new THREE.Group();
					letterGroup.name = 'letter_' + letter.name;
					letter.position.y = allCenter.y;
					letterGroup.add(letter);
					letterGroup.add(subbedBlockMesh);
					this.meshes.push(subbedBlockMesh);
					lineGroup.add(letterGroup);
					this.interaction.applySelection(letter);
				}
				lineGroup.translateY(lgi * lineHeight);
			});

			// Save original scale and position, to enable resetting when modifying
			for (const group of Array.from(lineGroups).flatMap(lg => lg.children)) {
				group.children[0].userData.originalScale = group.children[0].scale.clone();
				group.children[0].userData.originalPosition = group.children[0].position.clone();
				group.children[1].userData.originalScale = group.children[1].scale.clone();
				group.children[1].userData.originalPosition = group.children[1].position.clone();
			}
		}

		this.svgGroup.updateMatrix();

		/*
		 * SECTION: Mirroring and centering
		 */
		if (cfg.mirror) this.svgGroup.scale.multiply(new THREE.Vector3(-1, 1, 1));
		const groupCenter = getObjCenter(this.svgGroup);
		this.svgGroup.position.z += cfg.blockDepth;
		this.svgGroup.position.y -= groupCenter.y;
		this.svgGroup.position.x -= groupCenter.x;

		/*
		 * SECTION: Home grid
		 */
		drawGrid(200, 1, 0xAACCEE, 0x226699);
		drawGrid(200, 10, 0xAACCEE, 0x44CCFF);

		/*
		 * SECTION: Light source
		 */
		const directionalLight = new THREE.DirectionalLight(0xffffff, 3);
		directionalLight.lookAt(this.svgGroup.position);
		directionalLight.position.set(0, -25, 100);
		this.scene.add(directionalLight);


		this.svgGroup.updateMatrix();
		this.scene.updateMatrix();

		/*
		 * SECTION: Render and initialise
		 */
		this.#_render();
		this.textEdit.onRender();
		this.initialise();
	}
	#_render() {
		if (!this.needsRedraw) return;
		this.renderer.render(this.scene, this.camera);
		this.needsRedraw = false;
	}
	initialise() {
		if (this.initialised) return;
		this.textEdit.init();

		const animate = () => {
			const delta = clock.getDelta();
			this.needsRedraw = this.cameraControls.update(delta) || this.needsRedraw;
			this.needsRedraw = this.textEdit.renderCheck() || this.needsRedraw;
			requestAnimationFrame(animate);
			this.#_render();
		};
		animate();

		window.addEventListener('resize', () => {
			app.camera.aspect = window.innerWidth / window.innerHeight;
			app.camera.updateProjectionMatrix();
			app.renderer.setSize(window.innerWidth, window.innerHeight);
			app.needsRedraw = true;
		}, false);

		this.interaction.init();
		this.initialised = true;
		this.#_render();
		this.zoomToFit();
		this.cameraControls.saveState();
		this.cameraControls.draggingSmoothTime = 0.1;
		this.cameraControls.smoothTime = 0.1;
	}
	zoomToFit() {
		this.cameraControls.fitToSphere(this.svgGroup, true);
	}
	resetView() {
		this.cameraControls.reset(true);
	}
}

const app = new App();

elements.textInput.addEventListener('input', () => {
	app.render();
});

enableExportScene(elements.exportButton, app);

app.render();


elements.resetViewBtn.addEventListener('click', () => app.resetView());
elements.zoomFitBtn.addEventListener('click', () => app.zoomToFit());
elements.editModeControl.addEventListener('change', ev => {
	if (ev.target.value === 'text' && app.interaction.selectedChar) {
		app.interaction.applySelection(app.interaction.selectedChar, false);
	}
	app.cfg.editMode = ev.target.value;
	if (app.cfg.editMode !== 'textarea') {
		elements.editModeControl.classList.remove('show-text-input');
	}
	else {
		elements.editModeControl.classList.add('show-text-input');
		app.cfg.editMode = 'text';
	}
	app.canvas.focus();
	app.needsRedraw = true;
});
app.textEdit.cursor.syncWith(elements.textInput);

// helpers
function buildSVGData(text, font) {
	text = text.replace(/\s/g, ' ').trim();
	const paths = font.getPaths(text, 0, 0, cfg.fontSize).filter(p => p.commands.length);
	const svgPaths = paths.map(p => p.toSVG()).join('');

	const svgLoader = new SVGLoader();
	const svgData = svgLoader.parse('<g>' + svgPaths + '</g>');
	return svgData;
}
function previewSVG(lines, previewEl) {
	const paths = [];
	const bboxes = lines.map((line, i) => {
		line = line.replace(/\s/g, ' ');
		const path = app.font.getPath(line, 0, cfg.fontSize * i, cfg.fontSize);
		paths.push(path);
		return path.getBoundingBox();
	});
	const x1 = Math.min(...bboxes.map(b => b.x1));
	const y1 = Math.min(...bboxes.map(b => b.y1));
	const x2 = Math.max(...bboxes.map(b => b.x2));
	const y2 = Math.max(...bboxes.map(b => b.y2));
	previewEl.setAttribute('viewBox', `${x1} ${y1} ${x2 - x1} ${y2 - y1}`);
	previewEl.innerHTML = paths.map(p => p.toSVG()).join('');
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
function drawGrid(size, sqSize, axisColour = 0xFFCCFFCC, gridLineColour = 0x226699) {
	const divs = size / sqSize;
	const grid = new THREE.GridHelper(size, divs, axisColour, gridLineColour);
	grid.rotateX(degreesToEuler(90));
	app.scene.add(grid);
	return grid;
}
function drawText(text, position, size = 8) {
	const geometry = new TextGeometry(String(text), {
		font: app.plainFont,
		size: size,
		depth: 0.1,
		bevelEnabled: false
	});
	const textMesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0xffffff }));
	if (position instanceof Array) position = new THREE.Vector3(...position);
	textMesh.position.copy(position);
	app.scene.add(textMesh);
	return textMesh;
}
function degreesToEuler(degrees) {
	return degrees * Math.PI / 180;
}
function getObjSize(obj) {
	const box = getObjBox(obj);
	const size = new THREE.Vector3();
	box.getSize(size);
	return size;
}
function getObjCenter(obj) {
	const box = getObjBox(obj);
	const center = new THREE.Vector3();
	box.getCenter(center);
	return center;
}
function getObjBox(obj) {
	return new THREE.Box3().setFromObject(obj);
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
	while (obj.children.length > 0) obj.remove(obj.children[0]);
}
const debugColours = [0x0000ff, 0x00ff00, 0xff0000, 0xffff00, 0xff00ff, 0x00ffff, 0xffffff];
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
	const rad = cfg.nickRadius === 'auto' ? Math.min(1.5, meshSize.z / 8) : cfg.nickRadius;
	const cylinder = new THREE.CylinderGeometry(rad, rad, meshSize.x * 1.1, 32);
	const cylinderMesh = new THREE.Mesh(cylinder, mat);
	cylinderMesh.position.copy(mesh.position);
	cylinderMesh.position.z += cfg.nickPosition === 'auto' ? 0 : cfg.nickPosition;
	const depth = (meshSize.y / 2) - (cfg.nickDepth === 'auto' ? 0 : cfg.nickDepth);
	cylinderMesh.position.y += depth;
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
function edgeMesh(mesh, color = 0xffff00) {
	const geometry = new THREE.EdgesGeometry(mesh.geometry);
	const material = new THREE.LineBasicMaterial({ color, linewidth: 1 });
	const edges = new THREE.LineSegments(geometry, material);
	mesh.add(edges);
	return edges;
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

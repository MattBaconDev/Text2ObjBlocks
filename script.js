import * as THREE from 'three';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import FontProvider from './fonts.js';
import Interaction from './interaction.js';
import { CSG } from './libs/CSGMesh.js';
import CameraControls from './libs/camera-controls.module.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { Events } from './events.js';
import { getCenter, getSize, throttle } from './utils.js';
import { allFountSchemes, preloadSchemes } from './fount-schemes.js';
import { init as initControls } from './controls.js';

CameraControls.install({ THREE });
const clock = new THREE.Clock();

await import('opentype');

// TODO: BUG: Fix pt size scaling not working if no 'x' in the text

// TODO: Enable selection of 3D text (drag & create a box?)
// TODO: Fix typing text fast into meshes (cursor position)
// TODO: (low priority) See if can fix the splitting of the mesh around the nick

/*
Alpha chars
AaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQqRrSsTtUuVvWwXxYyZz
!"£$%^&*()-_=+'@;:#~\/,.[]{}
*/

const mmInPt = 0.352806;
const defaultFontPath = './fonts/Roboto-Regular.ttf';

const defaultConfig = {
	fontFileName: defaultFontPath.replace(/^(.*\/?.*\/)?([^\/]+)$/, '$2'),
	defaultValue: `ABCDEFGHIJKLMN
OPQRSTUVWXYZ
abcdefghijklmn
opqrstuvwxyz
1234567890`,
	editMode: 'mesh',
	mirror: true,
	fontSize: 15,
	measureChar: 'x',
	textBuilder: false,
	textOverride: '',
	spacing: {
		letterAuto: true,
		letter: 1,
		lineAuto: true,
		line: 1,
	},
	fountSchemes: {
		'capital-3A': true,
		'lower-3a': true,
		'num-Numbers-1': true,
		'other-Spaces-1': true,
	},
	depth: {
		letter: 2,
		block: 21.318,
		overlap: 0.1,
	},
	groove: {
		shape: 'none', // none, trapezoid, square, circle
		depthAuto: true,
		depth: 1,
		sizeAuto: true,
		size: 2.5,
		angleAuto: true,
		angle: 30,
		offsetAuto: true,
		offset: 0,
	},
	text: {
		charsUpper: true,
		charsLower: true,
		numbers: true,
		symbols: false,
		vowelMult: 1,
		yIsVowel: false,
	},
	blockXPadding: 'auto',
	blockYPadding: 'auto',
	linoMode: false,
	defaultColour: 0x666666,
	selectedColour: 0x00ff00,
	orthCamera: false,
	nick: {
		enabled: true,
		radiusAuto: true,
		radius: 2,
		depthAuto: true,
		depth: 0,
		offsetAuto: true,
		offset: 0,
	}
};
/** @type {typeof defaultConfig} */
let cfg = JSON.parse(JSON.stringify(defaultConfig));

function getElById(id) {
	return document.getElementById(id);
}

const elements = {
	viewport: getElById('viewport'),
	canvas: getElById('viewer-canvas'),
};

function getViewportDims() {
	return {
		width: elements.viewport.clientWidth,
		height: elements.viewport.clientHeight,
	};
}

class App {
	elements = elements;
	get cfg() { return cfg; }
	set cfg(val) { cfg = val; }
	get font() {
		return this.fontProvider.font;
	}
	builtText = '';
	text = '';
	lines = [];
	meshes = [];
	blockHeight = 0;
	lineHeight = 0;
	scene = new THREE.Scene();
	svgGroup = new THREE.Group();
	initialised = false;
	fontPath = defaultFontPath;
	blockMat = makeMaterial(cfg.defaultColour, './textures/metal.jpg', 5);
	letterMat = makeMaterial(cfg.defaultColour);
	savedOrbitState = false;
	plainFont = null;
	needsRedraw = true;
	events = Events.createScope('app');
	constructor(container) {
		if (!container) container = document.body;
		const { width, height } = getViewportDims();
		this.camera = new THREE.PerspectiveCamera(25, width / height, 0.1, 5000);
		if (cfg.orthCamera) this.camera = new THREE.OrthographicCamera(-100, 100, 100, -100, 0.1, 1000);
		this.canvas = elements.canvas;
		this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
		this.renderer.setSize(width, height);
		this.renderer.setPixelRatio(window.devicePixelRatio);
		elements.viewport.appendChild(this.renderer.domElement);
		this.camera.position.z = 150;
		this.camera.position.y = -250;
		this.text = '';
		if (cfg.orthCamera) this.camera.scale.multiplyScalar(0.2);
		this.scene.background = new THREE.Color(0x053555);
		this.cameraControls = new CameraControls(this.camera, this.renderer.domElement);
		this.fontProvider = new FontProvider(this);
		this.interaction = new Interaction(this);
		this.fountSchemes = allFountSchemes;
		initControls(this);
	}
	async initText() {
		if (this.cfg.textBuilder) buildTextFromCfg();
		else await buildTextFromSchemes();
	}
	async resetConfig() {
		cfg = JSON.parse(JSON.stringify(defaultConfig));
		this.cfg = cfg;
		await this.initText();
		this.events.trigger('cfg:reset');
		return this.render();
	}
	emptyScene() {
		emptyObject(this.svgGroup);
		emptyObject(this.scene);
	}
	getSceneName() {
		return this.fontProvider.getFontName() + '_' + this.text.replace(/[^A-Za-z0-9]/g, '').substring(0, 5);
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
		const renderCfgStr = JSON.stringify(app.cfg) + '|' + this.fontPath + '|' + this.builtText;
		if (renderCfgStr === app.lastRenderCfg) {
			console.log('no need to re-render, no cfg change');
			return;
		}
		app.lastRenderCfg = renderCfgStr;
		/*
		 * SECTION: Prepare for rendering
		 */
		await this.fontProvider.load(this.fontPath, this.cfg.fontFileName);
		await this.loadPlainFont();
		if (this.initialised) {
			this.emptyScene();
			this.#_render();
		}
		this.needsRedraw = true;

		const blockXPadding = cfg.blockXPadding === 'auto' ? 0 : cfg.blockXPadding;
		const blockYPadding = cfg.blockYPadding === 'auto' ? 0 : cfg.blockYPadding;

		/*
		 * SECTION: Prepare text
		 */
		if (this.cfg.textOverride.trim() == this.builtText.trim()) this.cfg.textOverride = '';
		const originalTextValue = this.cfg.textOverride || this.builtText;
		const text = originalTextValue.trim();
		const lines = text.split(/(\r?\n)+/).map(line => line.trim()).filter(line => !!line);
		const prevText = this.text.trim();
		this.text = lines.join('\n');
		this.lines = lines;
		this.chars = lines.flatMap(line => line.split(''));
		if (this.text.trim() !== prevText) app.events.trigger('text:changed', this.text);

		this.svgGroup = new THREE.Group();
		const allLetters = Array.from(this.svgGroup.children).slice(0, 0);
		const lineGroups = allLetters.slice();

		this.events.trigger('render:started');

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
						depth: cfg.depth.letter + cfg.depth.overlap,
						bevelEnabled: false,
					});
					letterGeos.push(geometry);
				});
				const bufferGeo = BufferGeometryUtils.mergeGeometries(letterGeos, false);
				const letterMesh = new THREE.Mesh(bufferGeo, this.letterMat.clone());
				const letterSize = getSize(letterMesh);
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
				const size = getSize(letter);
				const letterCenter = getCenter(letter).y;
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

		const sizeTestLetter = allLetters.find(l => l.name === cfg.measureChar) || allLetters.find(l => l.name.startsWith('x-'));
		let ptSizeScale = 1;
		if (sizeTestLetter) {
			const size = getSize(sizeTestLetter);
			// 1mm = 2.835pt
			// 1pt = 0.352778mm
			// mm = pt * 0.352778
			const currSizeY = size.y;
			const targetMM = cfg.fontSize * mmInPt;
			const multY = targetMM / currSizeY;
			ptSizeScale = multY;
		}

		tallestLetter *= ptSizeScale;
		allLetters.forEach(letter => letter.scale.set(ptSizeScale, ptSizeScale, 1));
		const allSizes = allLetters.map(letter => getSize(letter));

		/*
		 * SECTION: Block height and line height
		 */
		const blockHeight = tallestLetter + blockYPadding;
		const lineHeight = cfg.spacing.lineAuto ? blockHeight * 1.15 : (blockHeight + cfg.spacing.line);
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
				let shift = cfg.spacing.letterAuto ? getSize(letter).x / 20 : cfg.spacing.letter;
				if (!cfg.linoMode) shift += blockXPadding;
				letter.translateX(shifted + shift);
				shifted += shift;
			});
		});

		/*
		 * SECTION: Block creation
		 */
		const blockMesh_tpl = (() => {
			const geo = new THREE.BoxGeometry(1, blockHeight, cfg.depth.block);
			let mesh = new THREE.Mesh(geo, this.blockMat.clone());
			const size = getSize(mesh);
			if (cfg.nick.enabled) mesh = nickMesh(mesh, size);
			if (cfg.groove.shape !== 'none') mesh = grooveMesh(mesh, size);
			return mesh;
		})();
		const allCenter = getCenter(this.svgGroup);
		if (cfg.linoMode) {
			lineGroups.forEach((lineGroup, lgi) => {
				const lineSize = getSize(lineGroup);
				const lineCenter = getCenter(lineGroup);
				const letters = lineGroup.children;
				const startLetter = letters[0];
				const endLetter = letters[letters.length - 1];
				const startLetterSize = allSizes[0];
				const endLetterSize = allSizes[allSizes.length - 1];
				const { normPadLeft } = getGlyphInfo(startLetter.name, startLetterSize);
				const { normPadRight } = getGlyphInfo(endLetter.name, endLetterSize);
				let normPadding = normPadLeft + normPadRight;
				normPadding += blockXPadding;
				const blockMesh = blockMesh_tpl.clone();
				blockMesh.material = blockMesh_tpl.material.clone();
				blockMesh.scale.x = lineSize.x + normPadding;
				const meshSize = getSize(blockMesh);
				blockMesh.position.x = lineCenter.x;
				blockMesh.position.y -= allCenter.y;
				blockMesh.position.z = (-meshSize.z / 2);
				blockMesh.updateMatrix();

				blockMesh.userData.type = 'block';
				blockMesh.name = 'block_' + lines[lgi];

				const letterGroup = new THREE.Group();
				letterGroup.name = 'line_' + lines[lgi];
				letters.forEach(letter => {
					letter.position.z -= cfg.depth.overlap;
					this.interaction.applySelection(letter)
				});
				letterGroup.add(...letters);
				letterGroup.add(blockMesh);
				this.meshes.push(blockMesh);
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
					const letterCenter = getCenter(letter);
					const i = allLetters.indexOf(letter);
					const size = allSizes[i];
					let { normPadLeft, normPadding } = getGlyphInfo(letter.name, size);
					normPadding += blockXPadding;
					const blockMesh = blockMesh_tpl.clone();
					blockMesh.material = blockMesh_tpl.material.clone();
					blockMesh.scale.x = size.x + normPadding;
					const meshSize = getSize(blockMesh);
					blockMesh.position.x = letterCenter.x + (normPadding / 2) - normPadLeft - (blockXPadding / 2);
					blockMesh.position.z = (-meshSize.z / 2);
					blockMesh.updateMatrix();

					blockMesh.userData.type = 'block';
					blockMesh.name = 'block_' + letter.name;
					blockMesh.material.visible = letter.material.visible;
					if (letter.userData.excludeFromExport) blockMesh.userData.excludeFromExport = true;

					const letterGroup = new THREE.Group();
					letterGroup.name = 'letter_' + letter.name;
					letter.position.y = allCenter.y;
					letter.position.z -= cfg.depth.overlap;
					letterGroup.add(letter);
					letterGroup.add(blockMesh);
					this.meshes.push(blockMesh);
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
		const groupCenter = getCenter(this.svgGroup);
		this.svgGroup.position.z += cfg.depth.block;
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
		this.initialise();
		this.events.trigger('render:complete');
	}
	#_render() {
		if (!this.needsRedraw) return;
		this.renderer.render(this.scene, this.camera);
		this.needsRedraw = false;
	}
	initialise() {
		if (this.initialised) return;

		const animate = () => {
			const delta = clock.getDelta();
			this.needsRedraw = this.cameraControls.update(delta) || this.needsRedraw;
			requestAnimationFrame(animate);
			this.#_render();
		};
		animate();

		window.addEventListener('resize', () => this.recalculateSize(), false);

		this.interaction.init();
		this.initialised = true;
		this.#_render();
		this.zoomToFit();
		this.cameraControls.saveState();
		this.cameraControls.draggingSmoothTime = 0.1;
		this.cameraControls.smoothTime = 0.1;
	}
	recalculateSize() {
		const { width, height } = getViewportDims();
		this.camera.aspect = width / height;
		this.camera.updateProjectionMatrix();
		this.renderer.setSize(width, height);
		this.needsRedraw = true;
	}
	zoomToFit() {
		this.cameraControls.fitToSphere(this.svgGroup, true);
	}
	resetView() {
		this.cameraControls.reset(true);
	}
}

const app = new App();

const reRender = throttle(() => app.render(), 100);

app.events.on('cfg.updated', async ({ path, value }) => {
	if (app.cfg.textBuilder && path.startsWith('text.')) buildTextFromCfg() && reRender();
	else if (path.startsWith('fountSchemes.')) {
		await buildTextFromSchemes().then(() => reRender());
		app.events.trigger('fountSchemes:changed', app.cfg.fountSchemes);
	}
	else if (path === 'textOverride') {
		reRender();
	}
	else {
		reRender();
	}
});
app.events.on('text:changed', () => {
	const previewEl = document.querySelector('svg.preview');
	if (!previewEl) return;
	previewSVG(app.lines, previewEl);
});
app.events.on('control-pane:change', ({ action, name, container }) => {
	if (action === 'show' && name === 'text') {
		previewSVG(app.lines, container.querySelector('svg.preview'));
	}
});

app.initText();
app.render();

window.app = app;

// helpers
function vec2(x = 1, y = 1) { return new THREE.Vector2(x, y); }
function vec3(x = 1, y = 1, z = 1) { return new THREE.Vector3(x, y, z); }
function buildTextFromCfg() {
	const upper = ['ABCDEFGHIJKLM', 'NOPQRSTUVWXYZ'];
	const lower = ['abcdefghijklm', 'nopqrstuvwxyz'];
	const numbers = ['0123456789'];
	const symbols = ['!"£$%^&**();:_-=+#~,./<>?'];
	const lines = [];
	if (cfg.text.charsUpper) lines.push(...upper);
	if (cfg.text.charsLower) lines.push(...lower);
	if (cfg.text.numbers) lines.push(...numbers);
	if (cfg.text.symbols) lines.push(...symbols);
	let fullValue = lines.join('\n');
	if (cfg.text.vowelMult > 1) {
		const vowelRex = new RegExp('[aeiou' + (cfg.text.yIsVowel ? 'y' : '') + ']', 'ig');
		fullValue = fullValue.replace(vowelRex, ($0) => new Array(cfg.text.vowelMult).fill($0).join(''));
	}
	return app.builtText = fullValue;
}
async function buildTextFromSchemes() {
	const schemeSlugs = Object.keys(cfg.fountSchemes).filter(key => cfg.fountSchemes[key] === true);
	const schemes = app.fountSchemes.filter(sch => schemeSlugs.includes(sch.slug));
	await preloadSchemes();
	await Promise.all(schemes.map(s => s.load()));
	function charStr(char, count) {
		let str = '';
		while (str.length < count) str += char;
		return str;
	}
	const charCounts = [];
	schemes.forEach(scheme => {
		charCounts.push(...Object.entries(scheme.chars));
	});
	let str = '';
	const poundSymbol = decodeURIComponent('%C2%A3');
	for (const charCount of charCounts) {
		str += charStr(...charCount);
		if (charCount[0].toLowerCase() === 'm') str += '\n';
		if (charCount[0].toLowerCase() === 'z') str += '\n';
		if (charCount[0].toLowerCase() === ';') str += '\n';
		if (charCount[0].toLowerCase() === poundSymbol) str += '\n';
	}
	if (str.trim().length === 0) {
		str = cfg.defaultValue;
	}
	str = str.replace('9A', '9\nA');
	const lines = str.split(/\r?\n/);
	const fullValue = lines.join('\n');
	return app.builtText = fullValue;
}
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
function getGlyph(char) {
	const unicode = char.charCodeAt(0);
	let glyph = Object.values(app.font.glyphs.glyphs).find(g => g.unicode === unicode);
	if (!glyph && isSpace(char[0])) glyph = Object.values(app.font.glyphs.glyphs).find(g => g.unicode === 32);
	if (glyph && !glyph.rightSideBearing) glyph.rightSideBearing = glyph.getMetrics().rightSideBearing;
	return glyph;
}
function getGlyphInfo(char, size) {
	const glyph = getGlyph(char);
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
	// return new THREE.MeshStandardMaterial({ color: colour, wireframe: true, map: textureObj, ...(textureObj ? { bumpMap: textureObj, bumpScale } : {}) });
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
function grooveMesh(mesh, meshSize, mat) {
	if (!mat) mat = mesh.material.clone();
	let geo = new THREE.BoxGeometry();
	const size = cfg.groove.sizeAuto ? meshSize.y / 3 : cfg.groove.size;
	const depth = cfg.groove.depthAuto ? meshSize.z / 20 : cfg.groove.depth;
	const depthPadding = 1;
	let trapMult = 0;
	switch (cfg.groove.shape) {
		case 'square':
			geo = new THREE.BoxGeometry(size, meshSize.x + 2, depth + depthPadding);
			break;
		case 'circle':
			geo = new THREE.CylinderGeometry(size, size, meshSize.x + depthPadding, 32);
			break;
		case 'trapezoid':
			let angle = 30, angleRads = 0;
			if (cfg.groove.angleAuto) {
				angleRads = degreesToEuler(angle);
				let bottomSize = size + (2 * Math.tan(angleRads) * depth);
				if (bottomSize > app.blockHeight * 0.9) {
					while (bottomSize > app.blockHeight * 0.9) {
						angle -= 1;
						angleRads = degreesToEuler(angle);
						bottomSize = size + (2 * Math.tan(angleRads) * depth);
					}
				}
			}
			else {
				angle = cfg.groove.angle;
				angleRads = degreesToEuler(angle);
			}
			const bottomSize = size + (2 * Math.tan(angleRads) * (depth + depthPadding)); // Slightly arger, to avoid strange clipping issues
			trapMult = bottomSize / size;
			geo = new THREE.CylinderGeometry(size, bottomSize, depth + depthPadding, 4);
			geo.rotateY(degreesToEuler(45));
			break;
	}
	const cutoutMesh = new THREE.Mesh(geo, mat);
	let cutoutSize = getSize(cutoutMesh);
	cutoutMesh.position.copy(mesh.position);
	cutoutMesh.position.z -= meshSize.z / 2;
	const offset = cfg.groove.offsetAuto ? 0 : cfg.groove.offset;
	if (cfg.groove.shape === 'trapezoid') {
		const scaleDiffX = size / (cutoutSize.x / trapMult);
		const scaleDiffY = size / (cutoutSize.z / trapMult);
		cutoutMesh.scale.set(scaleDiffX, 1, scaleDiffY); // Y & X are swapped
		cutoutSize = getSize(cutoutMesh);
		cutoutMesh.position.z -= cutoutSize.y / 2;
		cutoutMesh.position.z += depth;
		cutoutMesh.position.y -= offset;
		cutoutMesh.rotation.x = degreesToEuler(90);
		const targetWidth = meshSize.x + 0.2;
		const widthDiff = targetWidth / size;
		cutoutMesh.scale.x *= widthDiff;
	}
	else {
		cutoutMesh.position.z -= cutoutSize.z / 2;
		cutoutMesh.position.z += depth;
		cutoutMesh.rotation.z = degreesToEuler(90);
		cutoutMesh.position.y -= offset;
	}
	cutoutMesh.updateMatrix();

	const meshCSG = CSG.fromMesh(mesh, 0);
	const cylCSG = CSG.fromMesh(cutoutMesh, 1);
	const subbed = meshCSG.subtract(cylCSG);
	const subMesh = CSG.toMesh(subbed, mesh.matrix);
	subMesh.position.copy(mesh.position);
	subMesh.material = mat;
	return subMesh;
}
function nickMesh(mesh, meshSize, mat) {
	if (!mat) mat = mesh.material.clone();
	const rad = cfg.nick.radiusAuto ? Math.min(1.5, meshSize.z / 8) : cfg.nick.radius;
	const cylinder = new THREE.CylinderGeometry(rad, rad, meshSize.x * 1.1, 32);
	const cylinderMesh = new THREE.Mesh(cylinder, mat);
	cylinderMesh.position.copy(mesh.position);
	cylinderMesh.position.z += cfg.nick.offsetAuto ? 0 : cfg.nick.offset;
	const depth = (meshSize.y / 2) - (cfg.nick.depthAuto ? 0 : cfg.nick.depth);
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

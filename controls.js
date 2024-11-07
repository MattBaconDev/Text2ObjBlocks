import { Events } from "./events.js";
import { exportScene } from "./export.js";
import { getObjectPath, setObjectPath, targetThrottle, throttle } from "./utils.js";

const sidePane = document.getElementById('side-pane');
const controlPane = document.getElementById('control-pane');
const evHub = Events.createScope('controls');

let currPane = null;

const cfgPresetsCacheKey = 'text2block:cfgpresets';
let cfgPresets = [];
function getCfgPresets() {
	cfgPresets = localStorage.getItem(cfgPresetsCacheKey);
	if (cfgPresets && typeof cfgPresets === 'string') cfgPresets = JSON.parse(cfgPresets);
	else cfgPresets = [];
	return cfgPresets;
}
function saveCfgPresets(presets = null) {
	presets ||= cfgPresets;
	localStorage.setItem(cfgPresetsCacheKey, JSON.stringify(presets));
}

export function init(app) {

	document.body.addEventListener('click', ev => {
		/** @type {HTMLButtonElement} */
		const btn = ev.target;
		if (!btn.matches('button')) return;
		if (btn.hasAttribute('data-action')) {
			runAction(btn.getAttribute('data-action'));
		}
	});
	function getMirroredInput(inputEl) {
		const cfg = inputEl.getAttribute('data-cfg');
		if (inputEl.type === 'range') {
			const nextEl = inputEl.nextElementSibling;
			if (nextEl?.type === 'number' && nextEl.getAttribute('data-cfg') === cfg) return nextEl;
		}
		if (inputEl.type === 'number') {
			const prevEl = inputEl.previousElementSibling;
			if (prevEl?.type === 'range' && prevEl.getAttribute('data-cfg') === cfg) return prevEl;
		}
	}

	const justHandled = new Map();
	function handledInputChange(input, value) {
		justHandled.set(input, value);
	}

	const handleChange = targetThrottle(function (ev) {
		/** @type {HTMLInputElement} */
		const input = ev.target;
		if (!input.matches('input,textarea')) return;
		if (ev.type === 'change' && ['radio', 'checkbox'].includes(input.type)) return;
		let value = input.type === 'checkbox' ? input.checked : input.value;
		if (input.type === 'range' || input.type === 'number') value = Number(value);
		if (justHandled.get(input) === value) return;
		if (input.matches('input[data-cfg], textarea[data-cfg]')) {
			const cfgName = input.getAttribute('data-cfg');
			setObjectPath(app.cfg, cfgName, value);
			app.events.trigger('cfg.updated', { path: cfgName, value });
			if (input.type !== 'radio') handledInputChange(input, value);
		}
		const mirrorInput = getMirroredInput(input);
		if (mirrorInput) mirrorInput.value = input.value;
	}, 50);

	document.body.addEventListener('input', handleChange);

	const bools = {
		darkTheme: true
	};

	evHub.on('toggle:darkTheme', dark => {
		document.body.classList.toggle('light', !dark);
	});
	evHub.on('pane:change', (data) => {
		app.recalculateSize();
		app.events.trigger('control-pane:change', data);
	});

	function updateCalc(el, path = '') {
		const calcStr = el.getAttribute('data-calc');
		if (!calcStr) return;
		const [expr, deps = ''] = calcStr.split('|');
		if (!path || (expr.includes(path) || deps.includes(path))) {
			try {
				const cfgs = Array.from(new Set(expr.match(/(?<=^|\s)([a-zA-Z]+)(?=\.|\s|$)/g)));
				const fnc = new Function(...cfgs, 'return ' + expr);
				const val = fnc.apply(null, cfgs.map(key => app.cfg[key]));
				el.textContent = val;
			}
			catch (err) {
				console.error('Failed executing calc: ' + expr, err);
			}
		}
	}

	app.events.on('cfg.updated', ({ path }) => {
		controlPane.querySelectorAll('[data-calc]').forEach(el => {
			updateCalc(el, path);
		});
	});

	const actions = {
		resetTextOverride() {
			app.cfg.textOverride = '';
			app.render();
		},
		reset() {
			app.resetConfig().then(() => {
				if (app.fontPath.includes(app.cfg.fontFileName) === false) {
					promptFontReselect(app.cfg.fontFileName);
				}
				const currPane = controlPane.querySelector('.pane-contents');
				if (currPane) applyConfig(currPane);
			});
		},
		resetView() {
			app.resetView();
		},
		zoomToFit() {
			app.zoomToFit();
		},
		exportScene() {
			exportScene(app);
		},
		saveConfig() {
			if (cfgPresets.length === 0) getCfgPresets();
			const name = prompt('Save config as:');
			if (!name) return alert('No name entered - config preset not saved');
			const existing = cfgPresets.find(p => p.name === name);
			if (existing) {
				if (confirm('A preset already exists with that name - overwrite?')) {
					existing.cfg = app.cfg;
					saveCfgPresets();
					return;
				}
				else return saveConfig();
			}
			const cfg = JSON.parse(JSON.stringify(app.cfg));
			const newPreset = { name, cfg };
			cfgPresets.push(newPreset);
			app.events.trigger('cfg-preset:added', newPreset);
			saveCfgPresets();
		}
	};

	function runAction(action) {
		const parts = action.split(':');
		if (parts.length === 1) {
			return actions[parts[0]]();
		}
		const type = parts[0];
		const arg1 = parts[1];
		const arg2 = parts[2];
		if (type === 'toggle') {
			bools[arg1] = typeof arg2 === 'boolean' ? arg2 : !bools[arg1];
			evHub.trigger('toggle:' + arg1, bools[arg1]);
		}
		else if (type === 'pane') {
			loadPane(arg1);
		}
	}

	function loadPane(name) {
		document.body.querySelectorAll('button[data-action^="pane"].active').forEach(btn => btn.classList.remove('active'));
		if (controlPane.getAttribute('data-pane') === name) {
			controlPane.classList.remove('show');
			controlPane.removeAttribute('data-pane');
			const container = controlPane.querySelector('.pane-contents');
			evHub.trigger('pane:hide', { name });
			evHub.trigger('pane:change', { action: 'hide', name, container });
			currPane = null;
			return;
		}
		let container = document.createElement('div');
		if (paneCache[name]) {
			container = paneCache[name];
		}
		else {
			const tpl = document.getElementById('tpl-pane-' + name);
			const contents = tpl.content.cloneNode(true);
			container.append(contents);
			container.id = 'pane-' + name;
			container.classList.add('pane-contents');
			paneCache[name] = container;
			panes[name]?.(container);
		}
		controlPane.innerHTML = '';
		applyConfig(container);
		controlPane.append(container);
		controlPane.setAttribute('data-pane', name);
		controlPane.classList.add('show');
		document.body.querySelectorAll('button[data-action="pane:' + name + '"]').forEach(btn => btn.classList.add('active'));
		currPane = name;
		evHub.trigger('pane:show', { name, container });
		evHub.trigger('pane:change', { action: 'show', name, container });
	}

	async function promptFontReselect(fontFileName) {
		const font = app.fontProvider.getCachedFont(fontFileName);
		if (font) {
			await app.fontProvider.load(font.fontPath, fontFileName);
			app.render();
		}
		else {
			alert('Font file cannot be loaded, please re-select ("' + (fontFileName || app.cfg.fontFileName) + '")');
			if (currPane !== 'text') loadPane('text');
			controlPane.querySelector('#font-input').click();
		}
	}

	const paneCache = {};
	const panes = {
		general(container) {
			const editModeControl = container.querySelector('#edit-mode-control');
			editModeControl?.addEventListener('change', ev => {
				if (ev.target.value === 'text' && app.interaction.selectedChar) {
					app.interaction.applySelection(app.interaction.selectedChar, false);
				}
				app.cfg.editMode = ev.target.value;
				// TODO: Redirect canvas focus to a hidden textarea when in text mode (not textarea?)
				// elements.canvas.contentEditable = app.cfg.editMode === 'text';
				app.canvas.focus();
				app.needsRedraw = true;
			});
		},
		export(container) {
			getCfgPresets();
			const presetSelector = container.querySelector('#cfg-presets');
			function addPresetOption(preset) {
				const opt = document.createElement('option');
				opt.value = preset.name;
				opt.textContent = preset.name;
				presetSelector.append(opt);
			}
			cfgPresets.forEach(addPresetOption);
			presetSelector.addEventListener('change', async ev => {
				const preset = cfgPresets.find(p => p.name === presetSelector.value);
				if (!preset) {
					await app.resetConfig();
					if (app.fontPath.includes(app.cfg.fontFileName) === false) promptFontReselect(app.cfg.fontFileName);
				}
				else if (app.cfg !== preset.cfg) {
					app.cfg = preset.cfg;
					if (app.fontPath.includes(app.cfg.fontFileName) === false) await promptFontReselect(app.cfg.fontFileName);
					app.render();
				}
				const currPane = controlPane.querySelector('.pane-contents');
				if (currPane) applyConfig(currPane);
			});
			app.events.on('cfg-preset:added', newPreset => {
				addPresetOption(newPreset);
				presetSelector.value = newPreset.name;
			});
			app.events.on('cfg:reset', () => {
				presetSelector.value = '';
			});
		},
		text(container) {
			const currFont = container.querySelector('#curr-font');
			const fontInput = container.querySelector('#font-input');
			fontInput.addEventListener('change', ev => {
				const file = ev.target.files[0];
				app.events.trigger('font-input:changed', file);
			});
			const textInput = container.querySelector('#text-input');
			if (textInput) {
				function checkAsBuilt() {
					const isAsBuilt = textInput.value.trim() === app.builtText.trim();
					textInput.classList.toggle('as-built', isAsBuilt);
				}
				app.events.on('text:changed', text => {
					if (text.trim() !== textInput.value.trim()) {
						textInput.value = text;
					}
					checkAsBuilt();
				});
				app.events.on('fountSchemes:changed', () => {
					checkAsBuilt();
				});
				textInput.addEventListener('input', ev => {
					checkAsBuilt();
				});
			}
			const helpEl = currFont.closest('.control').querySelector('.help');
			function updateFontVals() {
				if (helpEl) {
					const designVals = [app.font.names.designer?.en, app.font.names.designerURL?.en]
					const attrs = {
						'Designer': designVals.filter(v => !!v).join(', '),
						'': app.font.names.copyright?.en || '',
						'License': app.font.names.licenseURL?.en || app.font.names.license?.en || '',
						'Trademark': app.font.names.trademark?.en || '',
					};
					const tooltip = Object.keys(attrs).filter(key => attrs[key].trim() !== '')
						.map(key => (key ? key + ': ' : '') + attrs[key].trim())
						.join('\n');
					helpEl.setAttribute('data-tooltip', tooltip);
				}
				currFont.textContent = app.fontProvider.getFontName();
			}
			updateFontVals();
			app.events.on('font:changed', font => {
				updateFontVals();
			});
		}
	};

	function applyConfig(container) {
		container.querySelectorAll('input[type=checkbox][data-cfg]').forEach(input => {
			input.checked = getObjectPath(app.cfg, input.getAttribute('data-cfg'));
		});
		container.querySelectorAll('input[type=radio][data-cfg]').forEach(input => {
			input.checked = input.value === getObjectPath(app.cfg, input.getAttribute('data-cfg'));
		});
		container.querySelectorAll('input[data-cfg]:not([type=checkbox],[type=radio])').forEach(input => {
			input.value = getObjectPath(app.cfg, input.getAttribute('data-cfg'));
		});
		container.querySelectorAll('input[name="edit-mode"]').forEach(input => {
			input.checked = app.cfg.editMode === input.value;
		});
		const textInput = container.querySelector('#text-input');
		if (textInput && textInput.value !== app.text) app.events.trigger('text:changed', app.text);
		container.querySelectorAll('[data-calc]').forEach(el => {
			updateCalc(el);
		});
	}

}

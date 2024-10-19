const defaultControlOptions = {
	label: '',
	min: 0,
	max: 10,
	step: 0.25,
	postUpdate: null,
	autoValue: 1,
};

export class RenderControl {
	container = null;
	inputEl = null;
	constructor(app, name, type, options = defaultControlOptions) {
		options = { ...defaultControlOptions, ...options };
		this.app = app;
		this.name = name;
		this.defaultValue = app.cfg[name];
		this.canAuto = type.includes('/auto');
		this.type = type.replace('/auto', '');
		this.options = options;
		this.initialInputValue = this.canAuto && this.defaultValue === 'auto' && this.type === 'number' ? options.autoValue : this.defaultValue;
		if (!options.getter && this.type === 'checkbox') options.getter = (input) => input.checked;
		else options.getter = (input) => input.value;
	}
	updateCfg(value) {
		value = typeof value === 'undefined' ? this.options.getter(this.inputEl) : value;
		value = this.type === 'number' ? parseFloat(value) : value;
		if (this.type === 'number' && isNaN(value)) {
			value = this.defaultValue;
			this.inputEl.value = this.initialInputValue;
		}
		this.app.cfg[this.name] = value;
		if (this.options.postUpdate) this.options.postUpdate(this.app.cfg[this.name]);
		this.app.render();
	}
	getContainer() {
		return this.container || this.render();
	}
	getId() {
		return this.name.replace(/([A-Z])/g, '-$1').toLowerCase();
	}
	getLabel() {
		if (this.options.label) return this.options.label;
		return this.name.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
	}
	render() {
		const control = document.createElement('div');
		control.classList.add('render-control');
		const id = this.getId();
		const label = document.createElement('label');
		label.textContent = this.getLabel();
		label.setAttribute('for', id);
		const input = document.createElement('input');
		input.id = id;
		input.type = this.type;
		if (this.type === 'radio') input.type = 'hidden';
		if (this.type === 'number') {
			if (typeof this.options.min === 'number') input.min = this.options.min;
			if (typeof this.options.max === 'number') input.max = this.options.max;
			if (typeof this.options.step === 'number') input.step = this.options.step;
		}
		input.name = this.name;
		input.value = this.initialInputValue;
		input.addEventListener('input', () => this.updateCfg());
		input.addEventListener('keydown', (e) => {
			const step = parseFloat(input.step);
			const jumpVal = step === 1 ? 4 : (1 - step);
			if (e.key === 'ArrowUp' && e.shiftKey) {
				input.value = parseFloat(input.value) + jumpVal;
			}
			if (e.key === 'ArrowDown' && e.shiftKey) {
				input.value = parseFloat(input.value) - jumpVal;
			}
		});
		control.appendChild(label);
		if (this.canAuto) {
			const auto = document.createElement('input');
			auto.type = 'checkbox';
			auto.id = `${id}-auto`;
			auto.checked = this.defaultValue === 'auto';
			auto.addEventListener('change', () => {
				this.updateCfg(auto.checked ? 'auto' : this.options.getter(input));
				if (!auto.checked) input.focus();
			});
			control.appendChild(auto);
		}
		control.appendChild(input);
		this.container = control;
		this.inputEl = input;
		if (this.type === 'radio') {
			this.options.values.forEach(value => {
				const label = document.createElement('label');
				label.textContent = value.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
				const option = document.createElement('input');
				option.type = 'radio';
				option.name = this.name + '_option';
				option.value = value;
				option.checked = value === this.defaultValue;
				option.addEventListener('change', () => {
					if (option.checked) {
						this.inputEl.value = value;
						this.updateCfg();
					}
				});
				label.append(option);
				control.appendChild(label);
			});
		}
		if (this.options.postUpdate) this.options.postUpdate(this.app.cfg[this.name]);
		return control;
	}
}

function controlGroup(title, ...controls) {
	const container = document.createElement('div');
	container.classList.add('control-group', 'toggleable');
	const summary = document.createElement('div');
	summary.classList.add('label');
	summary.textContent = title;
	const controlsEl = document.createElement('div');
	controlsEl.classList.add('controls');
	container.appendChild(summary);
	controls.forEach(control => controlsEl.appendChild(control.getContainer()));
	container.appendChild(controlsEl);
	summary.addEventListener('click', () => {
		container.classList.toggle('expanded');
		if (!container.classList.contains('expanded')) return;
		document.querySelectorAll('.control-group.expanded').forEach(group => {
			if (group !== container) group.classList.remove('expanded');
		});
	});
	return container;
}

export default class RenderController {
	constructor(app) {
		this.app = app;
		const fontControlsEl = document.getElementById('font-controls');
		const fullDepth = document.getElementById('full-depth');
		const fontSize = new RenderControl(app, 'fontSize', 'number', { max: 100, step: 1 });
		const letterDepth = new RenderControl(app, 'letterDepth', 'number', { max: 10, postUpdate: (value) => fullDepth.textContent = value + app.cfg.plateDepth });
		const plateDepth = new RenderControl(app, 'plateDepth', 'number', { max: 30, postUpdate: (value) => fullDepth.textContent = app.cfg.letterDepth + value });
		const linoMode = new RenderControl(app, 'linoMode', 'checkbox');
		const mirrorMode = new RenderControl(app, 'mirror', 'checkbox');
		const lineSpacing = new RenderControl(app, 'lineSpacing', 'number/auto', { min: -5, max: 20 });
		const letterSpacing = new RenderControl(app, 'letterSpacing', 'number/auto', { min: -5, max: 20 });
		const plateXPadding = new RenderControl(app, 'plateXPadding', 'number', { min: -5, max: 20 });
		const plateYPadding = new RenderControl(app, 'plateYPadding', 'number', { min: -5, max: 20 });
		const depthsGroup = controlGroup('Depths', letterDepth, plateDepth);
		const fullDepthGroup = fullDepth.closest('.control-group');
		depthsGroup.append(fullDepthGroup.children[0]);
		fullDepthGroup.remove();
		fontControlsEl.after(depthsGroup);
		fontControlsEl.after(controlGroup('Padding', plateXPadding, plateYPadding));
		fontControlsEl.after(controlGroup('Spacing', lineSpacing, letterSpacing));
		fontControlsEl.after(controlGroup('General', fontSize, linoMode, mirrorMode));
	}
}

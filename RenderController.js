export default class RenderController {
    constructor(app) {
        this.app = app;
		this.app.elements.letterDepthInput.setAttribute('value', app.cfg.letterDepth);
		this.app.elements.blockDepthInput.setAttribute('value', app.cfg.plateDepth);
		this.app.elements.fontSizeInput.setAttribute('value', app.cfg.fontSize);
		this.app.elements.linoModeInput.checked = app.cfg.linoMode;
		this.app.elements.fullDepth.textContent = this.app.cfg.letterDepth + this.app.cfg.plateDepth;
		this.app.elements.mirrorModeInput.checked = app.cfg.mirror;
		this.app.elements.lineSpacingInput.setAttribute('value', app.cfg.lineSpacing === 'auto' ? 1 : app.cfg.lineSpacing);
		this.app.elements.letterSpacingInput.setAttribute('value', app.cfg.letterSpacing === 'auto' ? 1 : app.cfg.letterSpacing);
		this.app.elements.plateXPaddingInput.setAttribute('value', app.cfg.plateXPadding);
		this.app.elements.plateYPaddingInput.setAttribute('value', app.cfg.plateYPadding);
		this.app.elements.lineSpacingAuto.checked = app.cfg.lineSpacing === 'auto';
		this.app.elements.letterSpacingAuto.checked = app.cfg.letterSpacing === 'auto';
		this.app.elements.letterDepthInput.addEventListener('input', this.handleDepthChange.bind(this));
		this.app.elements.blockDepthInput.addEventListener('input', this.handleDepthChange.bind(this));
		this.app.elements.fontSizeInput.addEventListener('input', this.handleNumericCfgChange('fontSize'));
		this.app.elements.linoModeInput.addEventListener('change', this.handleBooleanCfgChange('linoMode'));
		this.app.elements.mirrorModeInput.addEventListener('change', this.handleBooleanCfgChange('mirror'));
		this.app.elements.lineSpacingInput.addEventListener('input', this.handleNumericCfgChange('lineSpacing'));
		this.app.elements.letterSpacingInput.addEventListener('input', this.handleNumericCfgChange('letterSpacing'));
		this.app.elements.plateXPaddingInput.addEventListener('input', this.handleNumericCfgChange('plateXPadding'));
		this.app.elements.plateYPaddingInput.addEventListener('input', this.handleNumericCfgChange('plateYPadding'));
		this.app.elements.lineSpacingAuto.addEventListener('change', this.handleBooleanCfgChange('lineSpacing', (el) => el.checked ? 'auto' : parseFloat(el.nextElementSibling.value)));
		this.app.elements.letterSpacingAuto.addEventListener('change', this.handleBooleanCfgChange('letterSpacing', (el) => el.checked ? 'auto' : parseFloat(el.nextElementSibling.value)));
    }

    handleDepthChange(event) {
        const { id, value } = event.target;
		event.target.setAttribute('value', value);
        if (id === 'letter-depth') {
            this.app.cfg.letterDepth = parseFloat(value);
        } else if (id === 'block-depth') {
            this.app.cfg.plateDepth = parseFloat(value);
        }
        this.app.render();
		this.app.elements.fullDepth.textContent = this.app.cfg.letterDepth + this.app.cfg.plateDepth;
    }

	handleBooleanCfgChange(name, valueGetter = null) {
		return this.handleCfgChange(name, valueGetter || ((el) => el.checked));
	}
	handleNumericCfgChange(name, valueGetter = null) {
		return this.handleCfgChange(name, valueGetter || ((el) => parseFloat(el.value)));
	}
	handleCfgChange(name, valueGetter = null) {
		return (event) => {
			const value = valueGetter ? valueGetter(event.target) : event.target.value;
			this.app.cfg[name] = value;
			this.app.render();
		}
	}
}

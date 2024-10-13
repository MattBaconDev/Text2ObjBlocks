export default class RenderController {
    constructor(app) {
        this.app = app;
		this.app.elements.letterDepthInput.setAttribute('value', app.cfg.letterDepth);
		this.app.elements.blockDepthInput.setAttribute('value', app.cfg.plateDepth);
		this.app.elements.fontSizeInput.setAttribute('value', app.cfg.fontSize);
		this.app.elements.linoModeInput.setAttribute('checked', app.cfg.linoMode);
		this.app.elements.fullDepth.textContent = this.app.cfg.letterDepth + this.app.cfg.plateDepth;
		this.app.elements.letterDepthInput.addEventListener('input', this.handleDepthChange.bind(this));
		this.app.elements.blockDepthInput.addEventListener('input', this.handleDepthChange.bind(this));
		this.app.elements.fontSizeInput.addEventListener('input', this.handleFontSizeChange.bind(this));
		this.app.elements.linoModeInput.addEventListener('change', this.handleLinoModeChange.bind(this));
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

	handleFontSizeChange(event) {
		this.app.cfg.fontSize = parseFloat(event.target.value);
		this.app.render();
	}

	handleLinoModeChange(event) {
		this.app.cfg.linoMode = event.target.checked;
		this.app.render();
	}
}

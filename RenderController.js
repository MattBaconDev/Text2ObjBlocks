export default class RenderController {
    constructor(app) {
        this.app = app;
		this.app.elements.letterDepthInput.value = app.cfg.letterDepth;
		this.app.elements.blockDepthInput.value = app.cfg.plateDepth;
		this.app.elements.letterDepthInput.addEventListener('input', this.handleDepthChange.bind(this));
		this.app.elements.blockDepthInput.addEventListener('input', this.handleDepthChange.bind(this));
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
    }
}

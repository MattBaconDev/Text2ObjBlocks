export default class FontProvider {
	#_fontCache = {};
	font = null;
	constructor(app) {
		this.app = app;
		app.elements.fontInput.addEventListener('change', async (e) => {
			const file = e.target.files[0];
			if (file) {
				const url = URL.createObjectURL(file);
				app.fontPath = url;
				await this.load(app.fontPath);
				app.render();
			}
		});
	}
	getCachedFonts() {
		return Object.values(this.#_fontCache);
	}
	getCachedFontNames() {
		return this.getCachedFonts().map(font => font.names.fullName.en);
	}
	async load(fontPath) {
		if (this.#_fontCache[fontPath]) return this.#_fontCache[fontPath];
		return new Promise((resolve, reject) => {
			opentype.load(fontPath, (err, font) => {
				if (err) return reject(err);
				this.#_fontCache[fontPath] = font;
				this.font = font;
				resolve(this.font);
			});
		});
	}
}

export default class FontProvider {
	#_fontCache = {};
	font = null;
	constructor(app) {
		this.app = app;
		this.styleEl = document.createElement('style');
		document.head.appendChild(this.styleEl);
		app.events.on('font-input:changed', async file => {
			if (file) {
				const url = URL.createObjectURL(file);
				app.fontPath = url;
				await this.load(app.fontPath, file.name);
				app.render();
			}
		});
	}
	getFontName() {
		if (!this.font) return '';
		return this.font.names.fullName.en;
	}
	getCachedFonts() {
		return Object.values(this.#_fontCache);
	}
	getCachedFontNames() {
		return this.getCachedFonts().map(font => font.names.fullName.en);
	}
	getCachedFont(pathOrName) {
		return this.#_fontCache[pathOrName];
	}
	async load(fontPath, fileName) {
		const initFont = (font) => {
			this.app.cfg.fontFileName = fileName;
			if (this.font === font) return;
			this.font = font;
			this.app.fontPath = fontPath;
			Object.values(font.glyphs.glyphs).forEach(glyph => {
				if (glyph.unicode >= 33 && glyph.unicode <= 126) {
					const metrics = glyph.getMetrics();
					glyph.rightSideBearing = metrics.rightSideBearing;
				}
			});
			this.styleEl.textContent = `
				@font-face {
					font-family: '${this.getFontName()}';
					src: url(${fontPath});
				}
			`;
			document.body.style.setProperty('--font-name', "'" + this.getFontName() + "'");
			this.app.events.trigger('font:changed', this.font);
			return font;
		}
		if (this.#_fontCache[fontPath]) {
			const font = this.#_fontCache[fontPath];
			return initFont(font);
		}
		return new Promise((resolve, reject) => {
			opentype.load(fontPath, (err, font) => {
				if (err) return reject(err);
				this.#_fontCache[fontPath] = font;
				this.#_fontCache[fileName] = { font, fontPath };
				initFont(font);
				resolve(this.font);
			});
		});
	}
}

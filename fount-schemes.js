/** @type {Array<FountScheme>} */
export const allFountSchemes = [];

let schemeData = null;

let fetchingSchemes = null;

export async function preloadSchemes() {
	if (schemeData) return;
	fetchingSchemes = fetch('fount-schemes.json');
	const res = await fetchingSchemes;
	const data = await res.json();
	Object.keys(data).forEach(key => data[key] = JSON.parse(data[key]));
	schemeData = data;
	fetchingSchemes = null;
}

class FountScheme {
	/** @type {Record<string,number>} */
	chars = null;
	totalChars = -1;
	constructor(category, name, totalChars) {
		this.category = category;
		this.name = name;
		this.slug = (this.category + '-' + this.name).replace(/\s+/g, '-');
		this.totalChars = totalChars;
		this.fullName = this.name + (this.category === 'num' ? '' : ' ' + this.category);
	}
	async load() {
		if (!schemeData) await preloadSchemes();
		if (this.chars) return this.chars;
		const data = schemeData[this.slug] || '{}';
		this.chars = data.chars;
		this.options = data.options;
		this.totalChars = Object.values(this.chars).reduce((tot, val) => tot + val, 0);
		return this.chars;
	}
}

const alnum = new FountScheme('basic', 'alnum', 62);
alnum.chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'.split('').reduce((obj, char) => (obj[char] = 1,obj), {});

const cap3A = new FountScheme('capital', '3A', 74);
const cap4A = new FountScheme('capital', '4A', 105);
const cap5A = new FountScheme('capital', '5A', 122);
const lower3a = new FountScheme('lower', '3a', 60);
const lower4a = new FountScheme('lower', '4a', 86);
const lower5a = new FountScheme('lower', '5a', 99);

const num1 = new FountScheme('num', 'Numbers 1', 27);
const num2 = new FountScheme('num', 'Numbers 2', 39);
const spaces1 = new FountScheme('other', 'Spaces 1', 6);

allFountSchemes.push(alnum);

allFountSchemes.push(cap3A, cap4A, cap5A);
allFountSchemes.push(lower3a, lower4a, lower5a);

allFountSchemes.push(num1, num2, spaces1);

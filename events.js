/** @type {Record<string, EventScope>} */
const scopes = {
};
class EventScope {
	_eventHost = new EventTarget();
	parentScope = null;
	bubbleDefault = false;
	constructor(name, bubbleDefault = false, parentScope = null) {
		this.name = name;
		this.bubbleDefault = bubbleDefault;
		this.parentScope = parentScope;
		scopes[name] = this;
	}
	trigger(name, data, bubble = null) {
		if (typeof bubble === 'number') bubble -= 1;
		this._eventHost.dispatchEvent(new CustomEvent(name, { detail: data }));
		if (typeof bubble !== 'number') bubble = typeof bubble === 'boolean' ? bubble : this.bubbleDefault;
		if (bubble && this.parentScope) {
			this.parentScope.trigger(name, data, bubble);
		}
	}
	on(name, callback) {
		const handler = (ev) => callback(ev.detail, ev);
		this._eventHost.addEventListener(name, handler);
	}
	childScope(name, bubbleDefault = false) {
		return new EventScope(name, bubbleDefault, this);
	}
}
export const Events = {
	createScope(name, bubbleDefault = false) {
		if (scopes[name]) throw new Error(`Scope ${name} already exists`);
		return new EventScope(name, bubbleDefault);
	},
	getScope(name) {
		if (scopes[name]) return scopes[name];
		return null;
	},
	trigger(scope, name, data, bubble = null) {
		this.getScope(scope).trigger(name, data, bubble);
	}
};

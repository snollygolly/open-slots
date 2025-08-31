export class EventBus {
	constructor() {
		this.handlers = {};
	}
	on(event, fn) {
		if (!this.handlers[event]) { this.handlers[event] = []; }
		this.handlers[event].push(fn);
	}
	emit(event, payload) {
		const list = this.handlers[event] || [];
		for (let i = 0; i < list.length; i += 1) {
			list[i](payload);
		}
	}
}

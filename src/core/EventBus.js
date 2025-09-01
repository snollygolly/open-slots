export class EventBus {
	constructor() { 
		this.handlers = {}; 
	}
	
	on(event, fn) { 
		(this.handlers[event] ||= []).push(fn); 
	}
	
	off(event, fn) {
		if (!this.handlers[event]) return;
		const index = this.handlers[event].indexOf(fn);
		if (index > -1) {
			this.handlers[event].splice(index, 1);
		}
	}
	
	once(event, fn) {
		const onceWrapper = (payload) => {
			this.off(event, onceWrapper);
			fn(payload);
		};
		this.on(event, onceWrapper);
	}
	
	emit(event, payload) { 
		(this.handlers[event] || []).forEach((fn) => fn(payload)); 
	}
}

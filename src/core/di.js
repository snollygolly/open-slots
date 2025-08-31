export const ServiceRegistry = {
	_services: {},
	register(name, instance) { this._services[name] = instance; },
	get(name) { return this._services[name]; }
};

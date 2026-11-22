import PocketBase from 'pocketbase';

let PB_URL = import.meta.env.VITE_PB_URL || 'http://localhost:8090';
let BOT_SERVICE_URL = import.meta.env.VITE_BOT_SERVICE_URL || 'http://localhost:3001';

export let pb = new PocketBase(PB_URL);

let _loaded = false;
let _loadPromise: Promise<void> | null = null;

export function loadRuntimeConfig(): Promise<void> {
	if (_loaded) return Promise.resolve();
	if (_loadPromise) return _loadPromise;

	_loadPromise = (async () => {
		try {
			const resp = await fetch('/config.json');
			if (resp.ok) {
				const cfg = await resp.json();
				// An empty value means "same origin": builder-ui's nginx proxies
				// PocketBase and bot-service behind the one public domain.
				const pbUrl = cfg.PB_URL || window.location.origin;
				if (pbUrl !== PB_URL) {
					PB_URL = pbUrl;
					// Recreate pb with correct URL, migrate auth store
					const oldStore = pb.authStore;
					pb = new PocketBase(PB_URL);
					pb.authStore = oldStore;
				}
				BOT_SERVICE_URL = cfg.BOT_SERVICE_URL || window.location.origin;
			}
		} catch {
			// fall back to build-time defaults
		}
		_loaded = true;
	})();

	return _loadPromise;
}

export function getPbUrl() { return PB_URL; }
export function getBotServiceUrl() { return BOT_SERVICE_URL; }

// fetch() against bot-service with the builder's PocketBase session attached.
// bot-service rejects /api/* calls without a valid session.
export function botFetch(path: string, init: RequestInit = {}) {
	const headers = new Headers(init.headers);
	if (pb.authStore.token) headers.set('Authorization', pb.authStore.token);
	return fetch(`${BOT_SERVICE_URL}${path}`, { ...init, headers });
}

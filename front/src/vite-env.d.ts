declare module 'virtual:pwa-info' {
	export interface PwaInfo {
		pwaInDevEnvironment: boolean;
		webManifest: {
			href: string;
			useCredentials: boolean;
			linkTag: string;
		};
	}
	export const pwaInfo: PwaInfo | undefined;
}

declare module 'virtual:pwa-register' {
	export function registerSW(options?: {
		immediate?: boolean;
		onRegistered?: (r: ServiceWorkerRegistration | undefined) => void;
		onRegisterError?: (error: unknown) => void;
	}): (reloadPage?: boolean) => Promise<void>;
}

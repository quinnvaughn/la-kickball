declare namespace NodeJS {
	interface ProcessEnv {
		VITE_TRPC_URL?: string;
		DATABASE_URL?: string;
	}
}

declare const process: {
	env: NodeJS.ProcessEnv;
};

declare namespace NodeJS {
	interface ProcessEnv {
		DATABASE_URL?: string;
	}
}

declare const process: {
	env: NodeJS.ProcessEnv;
};

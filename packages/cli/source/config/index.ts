import {SUPPORTED_CHAINS} from './chains.js';

const safelyGetEnvVar = <T = string>(key: keyof typeof process.env) => {
	const envVar = process.env[key];
	if (envVar !== undefined) {
		return envVar as T;
	}
	throw new Error(`${key} not defined in environment variables`);
};

const config = {
	network: safelyGetEnvVar('NETWORK') as SUPPORTED_CHAINS,
};

export default config;

/* eslint-disable no-unused-vars */
declare global {
	namespace NodeJS {
		interface ProcessEnv {
			NETWORK: 'bsctestnet' | 'bscmainnet';
		}
	}
}

// If this file has no import/export statements (i.e. is a script)
// convert it into a module by adding an empty export statement.
export {};

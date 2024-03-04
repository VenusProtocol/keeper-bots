const stringifyBigInt = (_: string, val: any) => {
	if (typeof val === 'bigint') {
		return val.toString();
	}
	return val;
};

export default stringifyBigInt;

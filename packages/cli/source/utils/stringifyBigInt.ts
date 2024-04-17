const stringifyBigInt = (_: string, val: unknown) => {
  if (typeof val === "bigint") {
    return val.toString();
  }
  return val;
};

export default stringifyBigInt;

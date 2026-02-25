export const bigIntConverter = {
  toBigInt(object: any) {
    return JSON.parse(JSON.stringify(object), (key, value) => (typeof value === 'number'
      ? BigInt(value)
      : value));
  },
  // Note: does not validate safe integer bounds
  fromBigInt(object: any) {
    if (typeof object === 'object') {
      return JSON.parse(JSON.stringify(object, (key, value) => (typeof value === 'bigint'
        ? Number(value.toString())
        : value)));
    }

    return typeof object === 'bigint'
      ? Number(object.toString())
      : object; // return everything else unchanged
  },
};

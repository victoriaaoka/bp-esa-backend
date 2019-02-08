class Utils {
  static loopSequentially(array, callback) {
    const resultArray = [];
    /* eslint-disable-next-line no-restricted-syntax */
    for (const [index, data] of array.entries()) {
      /* eslint-disable-next-line no-await-in-loop */
      const result = callback(data, index);
      resultArray.push(result);
    }
    return resultArray;
  }
}

export default Utils;

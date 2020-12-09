/**
 * Return a promise aftet the specified amount of milliseconds
 * @param {number} ms Milliseconds to wait in the promise
 * @callback next
 */
exports.delay = (t, next) => {
  return new Promise(function(resolve) {
    setTimeout(function() {
      resolve(next);
    }, t);
  });
}

/**
 * Javascript Map range of number to another range
 * https://gist.github.com/xposedbones/75ebaef3c10060a3ee3b246166caab56
 * @param {number} value
 * @param {number} in_min
 * @param {number} in_max
 * @param {number} out_min
 * @param {number} out_max
 */
exports.map = (value, in_min, in_max, out_min, out_max) => {
  return (value - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
}
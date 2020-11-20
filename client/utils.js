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
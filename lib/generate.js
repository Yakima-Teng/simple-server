const path = require('path')
// An extremely simple, pluggable static site generator.
const Metalsmith = require('metalsmith')

/**
 * Generate a template given a `src` and `dest`.
 *
 * @param {String} name
 * @param {String} src
 * @param {String} dest
 * @param {Function} done
 */

module.exports = function generate (name, src, dest, done) {
    Metalsmith(path.join(src))
        .clean(true)
        .source('.')
        .destination(dest)
        .build((err, files) => {
            done(err)
        })
}

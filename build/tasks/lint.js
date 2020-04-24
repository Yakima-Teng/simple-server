const gulp = require('gulp')
const eslint = require('gulp-eslint')
const friendlyFormatter = require('eslint-friendly-formatter')

const { join } = require('../utils')

module.exports = () => {
    return gulp.src([
        join('/app.js'),
        join('/bin/*'),
        join('/build/**/*.js'),
        join('/config/**/*.js'),
        join('/lib/**/*.js'),
        join('/src/**/*.js')
    ])
        .pipe(eslint(join('/.eslintrc.js')))
        .pipe(eslint.format(friendlyFormatter))
        .pipe(eslint.failAfterError())
}

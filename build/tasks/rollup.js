const { rollup } = require('rollup')
const typescript = require('rollup-plugin-typescript')
const { uglify } = require('rollup-plugin-uglify')

const pkg = require('../../package')
const { join } = require('../utils')

const name = pkg.name

const doWork = async ({ input, plugins, file, format, name, sourcemap }) => {
    const bundle = await rollup({
        input,
        plugins
    })
    await bundle.write({
        file,
        format,
        name,
        sourcemap
    })
}

module.exports = async () => {
    const configs = [
        {
            input: join('/src/main.ts'),
            plugins: [typescript()],
            file: join(`/dist/${name}.js`),
            format: 'umd',
            name,
            sourcemap: true
        },
        {
            input: join('/src/main.ts'),
            plugins: [typescript(), uglify()],
            file: join(`/dist/${name}.min.js`),
            format: 'umd',
            name,
            sourcemap: false
        }
    ]
    configs.forEach((config) => doWork(config))
}

const connect = require('gulp-connect')

const cors = (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', '*')
    next()
}

module.exports = () => {
    return connect.server({
        port: 8080,
        middleware (connect, options) {
            return [cors]
        }
    })
}

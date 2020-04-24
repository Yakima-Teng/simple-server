const http = require('http')
const path = require('path')
const fs = require('fs')
const express = require('express')
const favicon = require('serve-favicon')
const cookieParser = require('cookie-parser')
const bodyParser = require('body-parser')
const proxyMiddleware = require('http-proxy-middleware')
const md = new require('markdown-it')()
const opn = require('opn')
const body = require('stream-body')
const zlib = require('zlib')
const cors = require('cors')
const config = require('./config')

let app = express()

manufactureInfrastructure([
    'public',
    'mock/custom',
    'mock/json',
    'mock/proxy'
])

// allow cross-origin ajax request
app.use(cors())
app.all('*', (req, res, next) => {
    console.log(`[${req.method}] ${req.url} ${new Date()}`)
    res.header('Access-Control-Allow-Origin', '*')
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept')
    res.header('Access-Control-Allow-Methods','PUT,POST,GET,DELETE,OPTIONS')
    next()
})

// proxy api requests
Object.keys(config.proxyTable).forEach(function (context) {
    let options = config.proxyTable[context]
    if (typeof options === 'string') {
        options = { target: options }
    }
    options.proxyTimeout = 30000
    options.onProxyReq = (proxyReq, req, res) => {}
    options.onProxyRes = (proxyRes, req, res) => {
        const proxyHeaders = proxyRes.headers
        const chunks = []
        const fileName = `${req.url.split('#')[0].split('?')[0].split(/^\//)[1].replace(/\//g, '-')}.json`
        proxyRes.on('data', chunk => {
            chunks.push(chunk)
        })
        proxyRes.on('end', () => {
            const encoding = proxyHeaders['content-encoding']
            const buffer = Buffer.concat(chunks)
            if (encoding === 'gzip') {
                zlib.gunzip(buffer, function (err, decoded) {
                    if (err) {
                        console.log(err)
                        return
                    }
                    saveProxyData(fileName, decoded.toString())
                })
            } else if (encoding === 'deflate') {
                zlib.inflate(buffer, function (err, decoded) {
                    if (err) {
                        console.log(err)
                        return
                    }
                    saveProxyData(fileName, decoded.toString())
                })
            } else {
                saveProxyData(fileName, buffer.toString())
            }
        })
    }
    app.use(proxyMiddleware(context, options))
})

// app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')))

// enable uploading large file
app.use(bodyParser.json({ limit: '100000kb' }))
app.use(bodyParser.urlencoded({
    extended: false,
    limit: '100000kb'
}))

app.use(cookieParser())

app.get('/readme', (req, res, next) => {
    fs.readFile(path.join(__dirname, 'README.md'), (err, data) => {
        if (err) {
            console.log(err)
            return
        }
        const readme = md.render(data.toString())
        res.send(readme)
    })
})

// 301 moved permanently
Object.keys(config.redirect.movedPermanently).forEach(key => {
    app.all(key, (req, res, next) => {
        const targetLocation = config.redirect.movedPermanently[key]
        res.redirect(301, targetLocation)
    })
})

// 302 moved temporarily
Object.keys(config.redirect.movedTemporarily).forEach(key => {
    app.all(key, (req, res, next) => {
        const targetLocation = config.redirect.movedTemporarily[key]
        res.redirect(302, targetLocation)
    })
})

// response row json file content
config.jsonTable.forEach(context => {
    // 根据路径生成对应的文件名（不含文件后缀）
    const fileName = transferPathToFileName(context)
    if (!fileName) { return }

    // 若config.jsonTable数组中存在尚未建立对应json文件的路径，则创建之，免去手动创建的麻烦
    const filePathAndName = path.join(__dirname, 'mock', 'json', `${fileName}.json`)
    fs.access(filePathAndName, fs.F_OK, err => {
        if (err) {
            if (err.code === 'ENOENT') {
                fs.writeFile(filePathAndName, '{}', err => {
                    console.log(err ? `${filePathAndName}文件创建失败！` : `${filePathAndName}文件创建成功！`)
                })
            } else {
                console.log(err)
            }
        }
    })

    // 路由配置
    app.all(context, (req, res, next) => {
        fs.readFile(filePathAndName, (err, data) => {
            if (err) {
                res.json(err)
                return
            }
            res.json(JSON.parse(data.toString()))
        })
    })
})

// response custom content
config.customTable.forEach(context => {
    // 根据路径生成对应的文件名（不含文件后缀）
    const fileName = transferPathToFileName(context)
    if (!fileName) { return }

    // 若config.jsonTable数组中存在尚未建立对应json文件的路径，则创建之，免去手动创建的麻烦
    const filePathAndName = path.join(__dirname, 'mock', 'custom', `${fileName}.js`)
    fs.access(filePathAndName, fs.F_OK, err => {
        if (err) {
            if (err.code === 'ENOENT') {
                fs.writeFile(filePathAndName, 'module.exports = (req) => { return {} }', err => {
                    console.log(err ? `${filePathAndName}文件创建失败！` : `${filePathAndName}文件创建成功！`)
                })
            } else {
                console.log(err)
            }
        }
    })

    // 路由配置
    app.all(context, (req, res, next) => {
        const content = require(filePathAndName)(req)
        res.json(content)
    })
})

app.use(config.public, express.static(path.join(__dirname, 'public'), {
    index: 'index.html',
    maxAge: 60 * 60 * 1000
}))

// catch 404 and forward to error handler
app.use((req, res, next) => {
    const err = new Error('Not Found')
    err.status = 404
    next(err)
})

// error handlers (will print stacktrace)
app.use((err, req, res, next) => {
    res.status(err.status || 500).json({
        message: err.message,
        error: err
    })
})

app.set('port', config.port)

const server = http.createServer(app)

server.listen(config.port)
server.on('error', onError)
server.on('listening', onListening)

// Event listener for HTTP server "error" event.
function onError (error) {
    if (error.syscall !== 'listen') {
        throw error
    }

    const bind = typeof config.port === 'string'
        ? 'Pipe ' + config.port
        : 'Port ' + config.port

    // handle specific listen errors with friendly messages
    switch (error.code) {
        case 'EACCES':
            console.error(bind + ' requires elevated privileges')
            process.exit(1)
            break
        case 'EADDRINUSE':
            console.error(bind + ' is already in use')
            process.exit(1)
            break
        default:
            throw error
    }
}

// translate '/a/b-d/c#d?q=hello' to 'a-b-d-c'
function transferPathToFileName (path) {
    if (!/^\/.*$/.test(path)) {
        console.log(`[PATH ERROR]: path should start with symbol '/' instead of your ${path}`)
        return false
    }
    return path.split('#')[0].split(/^\//)[1].replace(/\//g, '-')
}

// 构建项目文件夹
function manufactureInfrastructure (arrPaths) {
    arrPaths.forEach((path) => { makePathSync(path) })
}

// 代码来源：https://github.com/joehewitt/mkdir/blob/master/lib/mkdir.js
function makePathSync (dirPath, mode) {
    dirPath = path.resolve(dirPath)

    if (typeof mode === 'undefined') {
        mode = parseInt('0777', 8) & (-process.umask())
    }

    try {
        if (!fs.statSync(dirPath).isDirectory()) {
            throw new Error(`${dirPath} exists and is not a directory`)
        }
    } catch (err) {
        if (err.code === 'ENOENT') {
            makePathSync(path.dirname(dirPath), mode)
            fs.mkdirSync(dirPath, mode)
        } else {
            throw err
        }
    }
}

// Event listener for HTTP server "listening" event.
function onListening () {
    const addr = server.address()
    const bind = typeof addr === 'string'
        ? 'pipe ' + addr
        : 'port ' + addr.port

    console.log(`[MAIN] Listening on ${bind}`)

    if (config.showReadMe) {
        opn(`http://localhost:${config.port}/readme`)
    }
}

function saveProxyData (fileName, fileData) {
    const filePathAndName = path.join(__dirname, 'mock', 'proxy', fileName)
    fs.access(filePathAndName, fs.F_OK, err => {
        if (err) {
            if (err.code === 'ENOENT') {
                fs.writeFile(filePathAndName, (() => {
                    try {
                        return JSON.stringify(JSON.parse(fileData), null, 4)
                    } catch (e) {
                        console.log(e)
                    }
                })(), err => {
                    if (err) { console.log(err) }
                })
            } else {
                console.log(err)
            }
        }
    })
}

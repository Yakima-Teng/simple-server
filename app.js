const http = require('http')
const path = require('path')
const fs = require('fs')
const express = require('express')
// const favicon = require('serve-favicon')
const cookieParser = require('cookie-parser')
const bodyParser = require('body-parser')
const proxyMiddleware = require('http-proxy-middleware')

const md = new require('markdown-it')() // eslint-disable-line no-new-require, new-cap
// const body = require('stream-body')
const zlib = require('zlib')
const cors = require('cors')
const uuid = require('uuid')
const config = require('./config')
const utils = require('./utils')

const shouldPrintMoreInfo = config.logLevel === 'normal'
const printLog = utils.printLog

const app = express()

utils.manufactureInfrastructure([ // 若无对应目录则创建之
    'public',
    'data/mock/custom',
    'data/mock/json',
    'data/mock/proxy',
])

// allow cross-origin ajax request
app.use(cors())
app.all('*', (req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*')
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept')
    res.header('Access-Control-Allow-Methods', 'PUT,POST,GET,DELETE,OPTIONS')
    next()
})

// proxy api requests
Object.keys(config.proxyTable).forEach((context) => {
    let options = config.proxyTable[context]
    if (typeof options === 'string') {
        options = { target: options }
    }
    options.proxyTimeout = 30000 // 30ms超时，一般足够了
    options.onProxyReq = (proxyReq, req) => {
        req.simpleServer = { // 在req.simpleServer对象上挂载我们自定义的数据
            startTime: +new Date(),
            requestId: uuid.v1(), // requestId的作用是用来关联请求和对应的响应
        }
        printLog('  ')
        printLog('************* request start *************')
        printLog(`[${req.method}] ${req.url.replace(/\?.*$/, '')}`)
        printLog(`requestId: ${req.simpleServer.requestId}`)
        shouldPrintMoreInfo && printLog(`httpVersion: ${req.httpVersion}`) // eslint-disable-line no-unused-expressions
        if (req.query && Object.keys(req.query).length > 0) {
            const queryObj = JSON.parse(JSON.stringify(req.query))
            Object.entries(queryObj).forEach(([key, value]) => {
                if (typeof value === 'string' && value.length > 100) { // 如果值太长就去掉中间部分
                    queryObj[key] = `${value.substring(0, 10)}...${value.substring(value.length - 10)}`
                }
            })
            printLog(`query: ${JSON.stringify(queryObj, null, 2)}`)
        }
        shouldPrintMoreInfo && Object.keys(req.headers).forEach((key) => { // eslint-disable-line no-unused-expressions, max-len
            printLog(`header.${key}: ${req.headers[key]}`)
        })
        !shouldPrintMoreInfo && ['cookie', 'Cookie'].forEach((key) => { // eslint-disable-line no-unused-expressions
            req.headers[key] && printLog(`header.${key}: ${req.headers[key]}`) // eslint-disable-line no-unused-expressions
        })
        printLog('************* request end *************')
        printLog('  ')
    }
    options.onProxyRes = (proxyRes, req) => {
        const proxyHeaders = proxyRes.headers
        const chunks = []
        proxyRes.on('data', (chunk) => {
            chunks.push(chunk)
        })
        proxyRes.on('end', () => {
            const buffer = Buffer.concat(chunks)

            const consumedTime = +new Date() - req.simpleServer.startTime // 从发起请求到响应结束的耗时，单位毫秒
            printLog('  ')
            printLog('************* response start *************')
            printLog(`[${req.method}] ${req.url.replace(/\?.*$/, '')}`)
            printLog(`requestId: ${req.simpleServer.requestId}`)
            shouldPrintMoreInfo && printLog(`httpVersion: ${proxyRes.httpVersion}`) // eslint-disable-line no-unused-expressions
            printLog(`consume time: ${consumedTime}ms`) // eslint-disable-line no-unused-expressions
            shouldPrintMoreInfo && Object.keys(proxyRes.headers).forEach((key) => { // eslint-disable-line no-unused-expressions, max-len
                printLog(`header.${key}: ${proxyRes.headers[key]}`)
            })

            // 服务端设置cookie的信息比较重要（一般是的登录等场景），所以简化模式下也打印
            // 有时候碰到服务端设置了cookie，但是本地一直提示未登录，跳转登录页去，可能就是因为服务端set-cookie时，限制了Domain
            // 而你的web页码在开发时使用的是与服务端限定Domain不同的其他域，这时候就可以利用日志里的set-cookie信息帮助排查
            !shouldPrintMoreInfo && ['set-cookie', 'Set-Cookie'].forEach((key) => { // eslint-disable-line no-unused-expressions
                proxyRes.headers[key] && printLog(`header.${key}: ${proxyRes.headers[key]}`) // eslint-disable-line no-unused-expressions
            })

            // 返回的是否是图片等文件/流，是的话不需要打印responseText，但是打印下content-type信息提示读者当前响应的是媒体文件
            const isMedia = proxyRes.headers['content-type'] && (
                proxyRes.headers['content-type'].indexOf('image') !== -1 ||
                proxyRes.headers['content-type'].indexOf('video') !== -1 ||
                proxyRes.headers['content-type'].indexOf('audio') !== -1 ||
                proxyRes.headers['content-type'].indexOf('audio') !== -1 ||
                proxyRes.headers['content-type'].indexOf('application') !== -1
            )
            if (isMedia && !shouldPrintMoreInfo) {
                const key = 'content-type'
                printLog(`header.${key}: ${proxyRes.headers[key]}`)
            }
            if (!isMedia) {
                (async () => {
                    const responseText = await new Promise((resolve, reject) => {
                        // 将响应内容备份至本地（若为gzip或deflate压缩过的响应内容，在备份前先解压）
                        const fileName = `${req.url.split('#')[0].split('?')[0].split(/^\//)[1].replace(/\//g, '-')}.json`
                        const encoding = proxyHeaders['content-encoding']

                        if (encoding === 'gzip') {
                            zlib.gunzip(buffer, (err, decoded) => {
                                if (err) {
                                    printLog(err)
                                    reject(err)
                                    return
                                }
                                const stringDataToSave = decoded.toString()
                                resolve(stringDataToSave)
                                utils.saveProxyData(fileName, stringDataToSave)
                            })
                        } else if (encoding === 'deflate') {
                            zlib.inflate(buffer, (err, decoded) => {
                                if (err) {
                                    printLog(err)
                                    reject(err)
                                    return
                                }
                                const stringDataToSave = decoded.toString()
                                resolve(stringDataToSave)
                                utils.saveProxyData(fileName, stringDataToSave)
                            })
                        } else {
                            const stringDataToSave = buffer.toString()
                            resolve(stringDataToSave)
                            utils.saveProxyData(fileName, stringDataToSave)
                        }
                    })

                    // 将响应内容进行输出
                    try {
                        let bufferString = responseText
                        if (req.url.indexOf('callback=') !== -1) {
                            bufferString = bufferString.replace(/^.+\((.+)\)/, '$1') // 如果是JSONP请求，则日志里输出括号内的JSON文本即可
                            printLog(`responseText: ${JSON.stringify(JSON.parse(bufferString), null, 2)}`)
                        } else {
                            printLog(`responseText: ${JSON.stringify(JSON.parse(bufferString), null, 2)}`)
                        }
                    } catch (err) {
                        printLog(`responseText: ${buffer.toString()}`)
                    }
                })()
            }
            printLog('************* response end *************')
            printLog('  ')
        })
    }
    app.use(proxyMiddleware(context, options))
})

// app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')))

// enable uploading large file
app.use(bodyParser.json({ limit: '100000kb' }))
app.use(bodyParser.urlencoded({
    extended: false,
    // 100M的传输限制足够一般场景使用了
    // 请注意，如果使用nginx等其他服务代理时，这些服务本身也有文件大小限制的，
    // 没记错的话nginx默认限制1M，tomcat默认限制2M，
    // 最终能支持的大小是由所有这些服务中的下限决定的
    limit: '100000kb',
}))

app.use(cookieParser())

app.get('/help', (req, res) => {
    printLog(`[${req.method}] ${req.url}`) // 打印原始请求
    fs.readFile(path.join(__dirname, 'README.md'), (err, data) => {
        if (err) {
            printLog(err)
            return
        }
        const readme = md.render(data.toString())
        res.send(readme)
    })
})

// 301 moved permanently
Object.keys(config.redirect.movedPermanently).forEach((key) => {
    app.all(key, (req, res) => {
        printLog(`[${req.method}] ${req.url}`) // 打印原始请求
        const targetLocation = config.redirect.movedPermanently[key]
        res.redirect(301, targetLocation)
    })
})

// 302 moved temporarily
Object.keys(config.redirect.movedTemporarily).forEach((key) => {
    app.all(key, (req, res) => {
        printLog(`[${req.method}] ${req.url}`) // 打印原始请求
        const targetLocation = config.redirect.movedTemporarily[key]
        res.redirect(302, targetLocation)
    })
})

// 响应静态JSON文件
config.jsonTable.forEach((context) => {
    // 根据路径生成对应的文件名（不含文件后缀）
    const fileName = utils.transferPathToFileName(context)
    if (!fileName) { return }

    // 若config.jsonTable数组中存在尚未建立对应json文件的路径，则创建之，免去手动创建的麻烦
    const filePathAndName = path.join(__dirname, 'data/mock/json', `${fileName}.json`)
    fs.access(filePathAndName, fs.F_OK, (err) => {
        if (err) {
            if (err.code === 'ENOENT') {
                fs.writeFile(filePathAndName, '{}', (err2) => {
                    printLog(err2 ? `${filePathAndName}文件创建失败！` : `${filePathAndName}文件创建成功！`)
                })
            } else {
                printLog(err)
            }
        }
    })

    // 路由配置
    app.all(context, (req, res) => {
        printLog(`[${req.method}] ${req.url}`) // 打印原始请求
        fs.readFile(filePathAndName, (err, data) => {
            if (err) {
                res.json(err)
                return
            }
            res.json(JSON.parse(data.toString()))
        })
    })
})

// 响应可编码的自定义内容
config.customTable.forEach((context) => {
    // 根据路径生成对应的文件名（不含文件后缀）
    const fileName = utils.transferPathToFileName(context)
    if (!fileName) { return }

    // 若config.jsonTable数组中存在尚未建立对应json文件的路径，则创建之，免去手动创建的麻烦
    const filePathAndName = path.join(__dirname, 'data/mock/custom', `${fileName}.js`)
    fs.access(filePathAndName, fs.F_OK, (err) => {
        if (err) {
            if (err.code === 'ENOENT') {
                fs.writeFile(filePathAndName, 'module.exports = (req) => { return {} }', (err2) => {
                    printLog(err2 ? `${filePathAndName}文件创建失败！` : `${filePathAndName}文件创建成功！`)
                })
            } else {
                printLog(err)
            }
        }
    })

    // 路由配置
    app.all(context, (req, res) => {
        printLog(`[${req.method}] ${req.url}`) // 打印原始请求
        const content = require(filePathAndName)(req) // eslint-disable-line import/no-dynamic-require, global-require, max-len
        res.json(content)
    })
})

// 静态文件服务
app.use(config.public, express.static(path.join(__dirname, 'public'), {
    index: 'index.html', // 默认首页
    maxAge: 60 * 60 * 1000, // 最大缓存时间
}))

// catch 404 and forward to error handler
app.use((req, res, next) => {
    const err = new Error('Not Found')
    err.status = 404
    next(err)
})

// error handlers (will print stacktrace)
app.use((err, req, res, next) => { // eslint-disable-line
    res.status(err.status || 500).json({
        message: err.message,
        error: err,
    })
})

app.set('port', config.port)

const server = http.createServer(app)

server.listen(config.port)
server.on('error', (error) => {
    if (error.syscall !== 'listen') {
        throw error
    }

    const bind = typeof config.port === 'string'
        ? `Pipe ${config.port}`
        : `Port ${config.port}`

    // handle specific listen errors with friendly messages
    switch (error.code) {
    case 'EACCES':
        console.error(`${bind} requires elevated privileges`)
        process.exit(1)
        break
    case 'EADDRINUSE':
        console.error(`${bind} is already in use`)
        process.exit(1)
        break
    default:
        throw error
    }
}) // eslint-disable-line no-use-before-define

server.on('listening', () => {
    const addr = server.address()
    const bind = typeof addr === 'string'
        ? `pipe ${addr}`
        : `port ${addr.port}`

    printLog(`[MAIN] Listening on ${bind}`)
})

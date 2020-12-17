const fs = require('fs')
const path = require('path')

function printLog (text) {
    console.log(text) // eslint-disable-line
}

exports.printLog = printLog

// 代码来源：https://github.com/joehewitt/mkdir/blob/master/lib/mkdir.js
function makePathSync (dirPath, mode) {
    dirPath = path.resolve(dirPath) // eslint-disable-line no-param-reassign

    if (typeof mode === 'undefined') {
        mode = 0o0777 & (-process.umask()) // eslint-disable-line no-param-reassign, no-bitwise
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

// 构建项目文件夹
exports.manufactureInfrastructure = function (arrPaths) {
    arrPaths.forEach((pth) => { makePathSync(pth) })
}

// 将1位数字转为2位数字（字符串）
function toDouble (val) {
    if (val > 9) { return `${val}` }
    return `0${val}`
}

exports.getDateStr = function getDateStr () {
    const objDate = new Date()
    const year = objDate.getFullYear()
    const month = toDouble(objDate.getMonth() + 1)
    const date = toDouble(objDate.getDate())
    const hour = toDouble(objDate.getHours())
    const minute = toDouble(objDate.getMinutes())
    const second = toDouble(objDate.getSeconds())
    const millisecond = toDouble(objDate.getMilliseconds())
    return `${year}-${month}-${date} ${hour}:${minute}:${second}:${millisecond}`
}

// translate '/a/b-d/c#d?q=hello' to 'a-b-d-c'
exports.transferPathToFileName = function (pth) {
    if (!/^\/.*$/.test(pth)) {
        printLog(`[PATH ERROR]: path should start with symbol '/' instead of your ${pth}`)
        return false
    }
    return pth.split('#')[0].split(/^\//)[1].replace(/\//g, '-')
}

exports.saveProxyData = function (fileName, fileData) {
    const filePathAndName = path.join(__dirname, 'data/mock/proxy', fileName)
    fs.access(filePathAndName, fs.F_OK, (err) => {
        if (err) {
            if (err.code === 'ENOENT') {
                const stringifyFileData = (() => {
                    try {
                        if (fileData.indexOf('jsonp') !== -1) {
                            // 如果是JSONP请求，则日志里输出括号内的JSON文本即可
                            fileData = fileData.replace(/^.+\((.+)\)/, '$1') // eslint-disable-line no-param-reassign
                        }
                        return JSON.stringify(JSON.parse(fileData), null, 4)
                    } catch (e) {
                        if (e.message.indexOf('Unexpected token < in JSON') !== -1) {
                            return null
                        }
                        printLog(e)
                        return null
                    }
                })()
                if (stringifyFileData !== null) {
                    fs.writeFile(filePathAndName, stringifyFileData, (err2) => {
                        if (err2) { printLog(err2) }
                    })
                }
            } else {
                printLog(err)
            }
        }
    })
}


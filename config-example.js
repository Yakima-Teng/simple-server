const config = {
    port: '3456',
    // 日志打印丰富度，normal会打印大量内容，simple只打印核心内容
    logLevel: 'simple',
    // 将public目录映射成为url中的对应路径
    public: '/static',
    // 代理请求，将请求转发至其他服务器，然后返回相应的内容
    proxyTable: {
        '/apis/proxy-test': {
            target: 'http://test.api.com',
            changeOrigin: true,
            pathRewrite (path, req) { // eslint-disable-line no-unused-vars
                return path.replace('/apis/proxy-test', '/apis/proxy')
            },
        },
        '/apis/proxy': {
            target: 'http://production.api.com',
            changeOrigin: true,
            cookieDomainRewrite: '',
        },
    },
    // 读取固定的JSON文件内容作为返回值
    jsonTable: [
        '/apis/json',
    ],
    // 读取用户自定义的内容，可以在此处使用第三方数据模拟工具（默认已经预装了mockjs模块，开箱即用）
    customTable: [
        '/apis/custom',
    ],
    // 重定向
    redirect: {
        movedPermanently: { // 301 redirect 永久重定向
            '/a': '/b',
        },
        movedTemporarily: { // 302 redirect 临时重定向
            '/vendor/assets/zepto.min.js': 'http://localhost:3000/vendor/assets/zepto.min.js?v=20191122',
        },
    },
}

module.exports = config

const domain = {
    douban: 'https://api.douban.com'
}

const config = {
    showReadMe: true, // 是否显示说明文档
    port: '3000',
    // 将public目录映射成为url中的对应路径
    public: '/test',
    // 代理请求，将请求转发至其他服务器，然后返回相应的内容
    proxyTable: {
        '/apis/proxy': {
            target: domain.douban,
            changeOrigin: true
        }
    },
    // 读取固定的JSON文件内容作为返回值
    jsonTable: [
        '/apis/json'
    ],
    // 读取用户自定义的内容，可以在此处使用第三方数据模拟工具（默认已经预装了mockjs模块，开箱即用）
    customTable: [
        '/apis/custom'
    ],
    redirect: {
        movedPermanently: { // 301 redirect
            '/a': '/b',
        },
        movedTemporarily: { // 302 redirect
            '/vendor/assets/zepto.min.js': 'http://localhost:3000/vendor/assets/zepto.min.js?v=20191122',
        },
    },
}

module.exports = config

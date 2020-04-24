# simple-server

> simple-server是一个使用NodeJS编写的简单服务，支持静态资源、请求转发、数据mock。非常适合在开发、测试环境使用。

simple-server具有如下特点：

1. 集成mock服务（服务端数据模拟），即支持使用静态JSON文件，也支持返回JS动态生成的数据，支持高级拓展（如根据前端上行参数返回不同结果）；
2. 默认支持跨域访问；
3. 支持post传输大文件（不会在硬盘上进行存储）；
4. 针对请求转发场景进行了日志优化，便于排查问题（由于目标场景是请求量不大的测试或者开发环境，所以日志被格式化便于阅读，若用于生产环境请稍加修改）。
5. 集成了PM2支持，只要几个命令即可做到异常时自启动、配置/mock文件修改时自启动，开机自启动（开启自启不支持window系统），部署运维方便；

说明：本文档中“配置文件”指的是config目录下的index.js文件。

## 截图

![](./screenshots/console.png)

## 安装

1、全局安装jMock以便在命令行工具中使用：
```bash
npm i -g jmock
```

2、在项目中安装jmock文件
```bash
cd project-path
jmock init
```

3、进入jmock目录，安装项目依赖
```bash
cd jmock
npm i
```

4、书写配置文件

在`jmock/config/`目录下新建`index.js`文件，内容参考`jmock/config/index_sample.js`文件的内容。

5、启动mock server
```bash
jmock start
```

## 配置文件规则说明


### 请求代理

修改配置文件中的config.proxyTable即可。示例如下：

```
proxyTable: {
  '/blog': {
    target: "http://yakima.duapp.com",
    changeOrigin: true
  },
  '/wechat/KqPay': {
    target: "http://yakima.duapp.com",
    changeOrigin: true
  }
}
```

如上配置对应的描述如下：

- 本地发出的请求地址以/blog开头的请求会被转发到yakima.duapp.com/域名下相同的路径。即本地发出的/blog/v1/pages将会收到yakima.duapp.com/blog/v1/pages请求的响应结果。
- 这里采用“越具体的配置，优先级越高”的规则，即如果本地发出的请求以/blog/details开头，则采用/blog/details规则匹配的代理域名而非/blog规则匹配的代理域名。

说明：程序会自动对代理请求返回的结果进行备份，备份目录为/mock/proxy，生成的文件名是根据请求地址自动生成的。大部分时候不需要搭理这些备份文件。


### 返回JSON静态数据

修改配置文件中的config.jsonTable即可。示例配置如下：

```
jsonTable: [
  '/manage2/intention/list',
  '/manage2/carInsurance/queryDetails',
  '/manage2/carInsurance/updateQuotation',
  '/manage2/order/list',
  '/manage2/order/queryDetails',
  '/manage2/order/updateSalesman',
  '/manage2/order/update'
]
```

如上配置对应的描述如下：

若本地发起了请求地址为“/manage2/intention/list”的请求，则服务器会将/mock/json/manage2-intention-list.json的内容予以返回。

注意：需要在启动服务器之前，先在/mock/json目录下手动建立对应的json文件，并自行填充数据；如果您未手动新建json文件，程序会自动帮你新建一个内容为“{}”的json文件，内容还需您自行填充。一般来说用后面这种方法会比较方便，修改了文件后程序会自动重启的，不需要重复操作命令行工具。

小技巧：可以将程序在/mock/proxy目录下生成的备份文件拷贝至此处使用。


### 返回JS自定义数据

修改配置文件中的config.customTable即可。示例配置如下：

```
customTable: [
  '/great/what'
]
```

如上配置对应的描述如下：

若本地发起了请求地址为/great/what,则服务器会将/mock/custom/great-what.js文件中导出的函数予以调用，并将函数返回值发送至前端。

注意：在启动服务器之前，先在/mock/custom目录下手动建立对应的js文件，在该js文件中通过module.exports导出一个函数，该函数需要返回一个json数据（也可以让程序自动创建该文件，程序自动创建的文件会默认写入“module.exports = (req) => { return {} }”来作为占位内容）；另外，该函数可接收一个表示请求的req参数，从而可以根据req来判断请求方式、传参等来动态输入自定义内容。

说明：之所以在自定义js文件中导出函数而非直接导出数据，是为了便于服务器返回随机数据。

说明：程序内置了[mockjs模块](http://mockjs.com/)，可以直接使用这个模块生成一些随机数据。

如下为一份使用了mockjs模块自定义数据的js文件的内容：

```
const Mock = require('mockjs')

const returnRes = (req) => {
  return Mock.mock({
    // 属性 list 的值是一个数组，其中含有 1 到 10 个元素
    'list|1-10': [{
      // 属性 id 是一个自增数，起始值为 1，每次增 1
      'id|+1': 1
    }],
    // 再接口里返回请求方式
    method: req.method,
    // 在接口里返回前端传参
    params: (() => {
      if (req.method === 'POST') {
        return req.body
      } else if (req.method === 'GET') {
        return req.query
      }
    })()
  })
}

module.exports = returnRes
```

### 设置服务端口

修改配置文件中的config.port字段，默认启用端口号为3000。


## 设置静态文件根路径的访问地址

将您的前端文件或其他静态文件放置于public目录下，然后修改配置文件中的config.public，config.public的值将与public目录直接映射。config.public的默认值为"/test"，即"/test/index.html"将会访问public目录下的index.html文件。

说明：

- 访问"/test"和访问"/test/index.html"访问的是同一个文件，因为程序设定的默认首页为index.html。

## 许可

jMock is available under the terms of the MIT License (MIT)

# spec-promise

spec-promise一个完全基于[ECMAScript标准27.2](https://tc39.es/ecma262/multipage/control-abstraction-objects.html#sec-promise-objects)搭建的Promise，可通过99.3%的[test262](https://github.com/tc39/test262)标准符合性测试。

【图】（chrome、我、两个仓库）

此仓库是《人人都能读标准 —— ECMAScript篇》的附属产品，旨在为读者展示基于标准的算法你可以做些什么。且由于这是一个使用JavaScript实现的、轻量但“五脏俱全”的promise，你可以借助它在开发者工具上可视化原生promise的底层实现（配合标准食用更佳哦！）。



## 使用test262进行测试

使用test262对浏览器进行测试的方式非常简单：

1. 在[test262官方仓库](https://github.com/tc39/test262)中下载test262测试包（无需解压）；
2. 在浏览器上打开[Test262 Web Runner](https://bakkot.github.io/test262-web-runner/)；
3. 点击`Local`，选择第一步下载完毕的测试包；
4. 点击`Run`。

【图】

Test262-Web-Runner通过创建新的iframe来获得“干净”的Realm，然后在这些Realm上面跑test262的测试。但Test262-Web-Runner开了一个“后门”，使得我们可以修改Realm中的对象。所以，我们在运行测试前，需要通过在开发者工具中运行以下的代码：

```js
fetch(URL) // 更换url
  .then(res => res.text()).then(promise_initializer => {
    window.useTransformer = true
    window.transform = function(test_text){
        return `
            window.Promise = undefined
            ${promise_initializer}
            if (!window.Promise) window.Promise = window.ES6Promise;
            ${test_text}
        `
    }
}).then(() => {console.log("Ready!")})
```

更换不同的URL，就可以测试不同promise实现的代码：

- spec-promise：https://lawliet01.github.io/spec-promise/dist/bundle.js
- [then/Promise](https://github.com/then/promise)：https://cdnjs.cloudflare.com/ajax/libs/promise-polyfill/8.3.0/polyfill.min.js
- [es6-promise](https://github.com/stefanpenner/es6-promise)：https://cdn.jsdelivr.net/npm/es6-promise@4/dist/es6-promise.js

【图】

在这里，4个没有通过的test cases，是因为一些它们都触及一些更为底层的行为，我无法修改这些行为，或者说为了通过这些测试，我需要违背成本收益原则地改造源码。

需要注意的是，**碾压性的测试通过率，并不意味着spec-promise比其他的promise更好，then/Promise是promise的超集，它提供了一些原生promise也没有的特性，如`promise.done`；而es6-promise，顾命思议，只实现到了es6。**


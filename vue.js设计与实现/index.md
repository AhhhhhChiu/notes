# Vue.js设计与实现

## 一、权衡的艺术

### 命令式和声明式

1. 命令式强调过程，声明式重视结果
2. 理论性能：命令式强于声明式（无法确保写出的命令式代码得到最佳优化）
3. 命令式写起来比较累，很难维护

典型例子：JQuery & Vue

### 虚拟DOM的性能

比较原生js操作、虚拟dom以及innerHTML三种方式后发现

**还行**

### 编译时和运行时

？不明白给的纯编译时和纯运行时的例子具体区别是什么

## 二、框架设计的核心要素

### 友好的警告信息

不用多说，Vue里有很多这样的代码

```ts
warn('qnyd')
```

### 控制体积

为了避免框架体积因为诸如警告信息之类的代码而变得越来越大，需要借助tree-shaking减少体积（例如利用环境变量__DEV__之类的区分开发环境和生产环境，决定那些辅助开发的功能代码不出现在生产环境中）

### tree-shaking

动态语言很难完全排除dead code，可以使用 */*#__PURE__*/* 注释来辅助树摇

### 输出产物

为了满足用户多种使用需求，框架一般会提供多种适用不同环境的输出产物

### 特性开关

用户可以关闭那些不需要用到的特性来减少打包代码体积，例如关掉options api

### 错误处理

书里的例子很好，这里写一段

```js
// utils.js
let handleError = null

export default {
    foo(fn) {
        callWithErrorHandler(fn)
    },
    registerErrorHandler(fn) {
        handleError = fn
    }
}

function callWithErrorHandler(fn) {
    try {
        fn && fn()
    } catch (e) {
        // 书里是 handleError(e)
        // 但感觉要?.()会比较稳妥一点
        // 将捕获到的错误传递给用户的错误处理程序
        handleError?.(e)
    }
}
```

使用

```js
import utils from 'utils.js'

utils.registerErrorHandler((e) => {
    console.log(e)
})

utils.foo(() => {/****/})
```

### ts类型支持

不是用了ts就是对ts类型支持良好，比如

```ts
// anyscript了属于是
const foo = (bar: any) => bar
```

这样会好一点

```ts
const foo = <T extends any>(bar: T): T => bar
```

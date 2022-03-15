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

## 三、Vue.js3的设计思路

### 声明式描述UI

Vue使用贴近原生的描述方式来进行声明式描述UI，也可以用虚拟DOM的方式，会更灵活

### 渲染器

就是把虚拟DOM变成真实DOM的一段程序

比如现在有个虚拟DOM长这样

```js
const vnode = {
    tag: 'div',
    props: {
        onClick: () => alert('qnyd')
    },
    children: '不错'
}
```

```js
const render = (vnode, container) => {
    const el = document.createElement(vnode.tag)
    for (const key in vnode.props) {
        if (/^on/.test(key)) {
            el.addEventListener(
                key.subStr(2).toLowerCase(),
                vnode.props[key]
            )
        }
    }

    if (typeof vnode.children === 'string') {
        el.appendChild(document.createTextNode(vnode.children))
    } else if (Array.isArray(vnode.children)) {
        vnode.children.forEach((node) => render(node, el))
    }

    container.appendChild(el)
}
```

### 组件的本质

就是一组虚拟DOM元素的封装

类似这样

```js
const vnode = {
    tag: 'div',
    props: {
        onClick: () => alert('qnyd')
    },
    children: '不错'
}

const component = () => vnode
```

### 模板的工作原理

通过编译器编译成虚拟DOM

### 模块化

编译器、渲染器等各个模块互相关联、互相制约、共同构成一个有机整体

## 四、响应式系统的作用与实现

### 响应式数据与副作用函数

运行会产生副作用的函数就是副作用函数，比如

```js
// 副作用修改了body
function effect() {
    document.body.innerText = 'qnyd'
}
```

响应式数据是什么呢，当我们修改obj.text的时候，如果effect能重新执行，obj就是响应式数据

```js
const obj = { text: 'qnyd' }
function effect() {
    document.body.innerText = obj.text
}
```

### 响应式数据的基本实现

- 执行 `effect` 函数的时候触发 `读取` 操作
- 修改 `obj.text` 的时候触发 `写入` 操作

因此如果在读取 `obj.text` 的时候将依赖该值的副作用函数全部收集起来，触发写入操作的时候再把这些副作用函数都执行一遍就实现了响应式

```js
// 存储依赖的桶子
const bucket = new Set()

// original data
const data = { text: 'qnyd' }
// 代理
const proxyData = new Proxy(data, {
    get(target, key) {
        bucket.add(effect)
        return target[key]
    },
    set(target, key, newVal) {
        target[key] = newVal
        bucket.forEach((fn) => fn())
        return true
    }
})
```

### 设计一个完善的响应式系统

上面实现的响应式系统存在2个问题（其他的后面再说）
1. 直接通过名字(effect)来获取副作用函数很不灵活
2. 给对象设置新属性的时候会触发副作用函数

解决第一个问题需要提供一个注册副作用函数的机制
```js
// 全局变量存放被注册函数
let activeEffect
// 注册器
function effect(fn) {
    activeEffect = fn
    fn()
}
// 稍稍改造一下代理过程
const proxyData = new Proxy(data, {
    get(target, key) {
        activeEffect && bucket.add(activeEffect) // 新增
        return target[key]
    },
    set(target, key, newVal) {/*...*/}
})
```

这样就不依赖副作用函数的名字了

然后来看看第二个问题

```js
effect(() => {
    console.log('qnyd') // 会打印两次
    document.body.innerText = obj.text
})
// 副作用函数中并没有读取这个属性
// 正常来说设置该属性时不应该触发副作用函数
// 但是触发了
obj.notExist = 'abc'
```

问题在于我们`没有在副作用函数与被操作的目标字段之间建立明确的联系`，所以来重新整个桶子

```js
const bucket = new WeakMap()
const track = (target, key) => {
    // 同样的 没有副作用函数直接不玩
    if (activeEffect) return 
    const depsMap = bucket.get(target)
    if (!depsMap) {
        bucket.set(target, (depsMap = new Map()))
    }
    let deps = depsMap.get(key)
    if (!deps) {
        depsMap.set(key, (deps = new Set()))
    }
    deps.add(activeEffect)
}

const trigger = (target, key) => {
    const depsMap = bucket.get(target)
    if (!depsMap) return
    const effects = depsMap.get(key)
    effects && effects.forEach((fn) => fn())
}

const proxyData = new Proxy(data, {
    get(target, key) {
        track(target, key)
        return target[key]
    },
    set(target, key, newVal) {
        target[key] = newVal
        trigger(target, key)
    }
})
```

桶子之前是这样的

```
bucket: [effect1, effect2, effect3...]
```

现在是这样的

```
bucket: {
    obj1: {
        attr1: [effect1, effect2...],
        attr2: [effect3, effect4...]
    },
    obj2: {
        attr3: [effect5, effect6...]
    }
}
```

bucket使用WeakMap的原因是因为它对key是弱引用，并不会影响垃圾回收，具体可以看看WeakMap和Map的区别

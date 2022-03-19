# Vue.js设计与实现

最近一直被各种狂轰乱炸安利这本书，最终还是买了下来，小一百块钱感觉小贵，感觉不能白看，一边看一边随便写点读书笔记，加深理解后面也可以翻看，over

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

### 分支切换与cleanup

遗留的副作用函数会导致不必要的更新

```js
const data = { ok: true, text: 'qnyd' }
const proxyData = new Proxy(data, { /*...*/ })

effect(() => {
    document.body.innerText = obj.ok ? obj.text : 'not'
})
```

此时修改obj.ok会触发副作用函数

```js
obj.ok = false
```

且同时obj.text不会被读取，我们希望修改obj.text时副作用函数不被重新执行，但事实上是会的

解决的思路是这样，因为每次执行副作用函数时，都会往桶子里收集依赖，但在这次新的收集过程中是不会包括没用的依赖的，举个栗子，第二次修改ok的值时


```js
/**
 * 修改值触发set操作 -> trigger
 */
obj.ok = false

/**
 * 取出依赖这个 key <<ok>> 的所有副作用函数并执行
 */
deps.forEach((fn) => fn())

/**
 * 也就是下面这个函数
 * 这个时候被执行读操作的只有ok这个key
 * text不会重新track了
 */ 
() => {
    document.body.innerText = obj.ok ? obj.text : 'not'
}
```

那么只要在执行副作用函数前，解除掉所有关联到这个函数的依赖就可以了，因为执行完会建立起新的、正确的依赖

所以需要知道都有谁和这个副作用函数建立了联系，需要重新设计effect

```js
let activeEffect
// 注册器原先是这样的
// function effect(fn) {
//     activeEffect = fn
//     fn()
// }
function effect(fn) {
    // 先用一个函数把之前的逻辑包裹起来
    const effectFn = () => {
        activeEffect = effectFn
        fn()
    }
    // 然后给这个函数挂一个deps属性
    // 用来记录谁和本函数建立了联系
    effectFn.deps = []
    // 正常的执行一次
    effectFn()
}
```

effectFn.deps如何收集，就要回到我们是如果收集这个fn到bucket里了，答案是在track里，也就是做key的get操作时

```js
const track = (target, key) => {
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

    // deps就是一个与当前副作用函数存在联系的依赖合集
    // 将其添加到activeEffect.deps数组中
    activeEffect.deps.push(deps)
}
```

然后我们要做的就是在每次执行副作用函数前，解除掉所有关联到这个函数的依赖

```js
const cleanup = (effectFn) => {
    effectFn.deps.forEach((deps) => {
        // 将自己从有联系的依赖合集里去掉
        deps.delete(effectFn)
    })
    // 现在没人依赖我了
    effectFn.deps.length = 0
}

let activeEffect
function effect(fn) {
    const effectFn = () => {
        cleanup(effectFn) // 清除一下
        activeEffect = effectFn
        fn()
    }
    effectFn.deps = []
    effectFn()
}
```

修改一下trigger避免无限循环（具体问题引起参照书中代码）

```js
const trigger = (target, key) => {
    const depsMap = bucket.get(target)
    if (!depsMap) return
    const effects = depsMap.get(key)
    const effectsToRun = new Set(effects)
    effectsToRun.forEach((fn) => fn())
    // effects && effects.forEach((fn) => fn())
}
```

这样就可以避免有副作用函数产生遗留了

### 嵌套的 effect 与 effect 栈

目前的设计是不适用与嵌套的情况的，举个例子

```js
const data = { foo: true, bar: true }
const proxyData = new Proxy(data, { /*...*/ })

let temp
effect(() => {
    console.log('外层执行')
    effect(() => {
        console.log('里层执行')
        temp = data.foo
    })
    temp = data.bar
})

setTimeout(() => {
    data.bar = false
}, 1000)
```

我们期望的结果是，执行完副作用函数之后建立起这样的联系

```js
bucket: {
    data: {
        foo: [里层的函数],
        bar: [外层的函数]
    }
}
```

修改了bar的值为false，自然去执行外层函数，然后间接触发里层函数。所以我们期望的打印结果应该是这样

```js
外层执行
里层执行
外层执行
里层执行
```

可实际上确实这样的

```js
外层执行
里层执行
里层执行
```

很显然原因在于我们的全局变量activeEffect，我们用它来存储副作用函数，这意味着只能存一个

```js
// 这段代码的运行大概是这样

// 1. 通过effect注册「外」层的副作用函数
// 2. 此时activeEffect存储「外」层函数
// 3. 存完了开始执行「外」层的副作用函数
// 4. 通过effect注册「里」层的副作用函数
// 5. 此时activeEffect存储「里」层函数
// 6. 存完了开始执行「里」层的副作用函数
// 7. 执行到了「里」层对foo键的读操作
// 8. 收集activeEffect(存的「里」层函数)作为依赖
// 9. 执行到了「外」层对bar键的读操作
// 10. 收集activeEffect(存的「里」层函数)作为依赖
let activeEffect
function effect(fn) {
    const effectFn = () => {
        cleanup(effectFn)
        activeEffect = effectFn // 2 5
        fn()
    }
    effectFn.deps = []
    effectFn()
}

let temp
effect(() => {// 1
    console.log('外层执行') // 3
    effect(() => { // 4
        console.log('里层执行') // 6
        temp = data.foo // 7
    })
    temp = data.bar // 9
})
```

其实就是外层函数还没走到收集依赖那步，存放副作用函数的全局变量就被里面的给覆盖了（把temp = data.bar放在里层函数执行前试试，就发现trigger前bucket里的数据没有错了）感觉我很笨，想了好一会才明白为什么被覆盖

要解决这个问题就需要换一种方式来存放副作用函数

```js
let activeEffect

// 维护一个effect栈
const effectStack = []
function effect(fn) {
    const effectFn = () => {
        cleanup(effectFn)
        activeEffect = effectFn
        // 执行前把副作用函数压入栈中
        effectStack.push(activeEffect)
        fn()
        // 执行完将当前副作用函数弹出栈
        effectStack.pop()
        // 同时把当前激活函数指向栈顶
        activeEffect = effectStack[effectStack.length - 1]
    }
    effectFn.deps = []
    effectFn()
}
```

代入刚刚那个例子就很快想明白了

### 避免无线递归循环

当前的响应式系统容易出现无限递归循环的问题

```js
const proxyData = new Proxy({ foo: 1 }, {/*...*/})
effect(() => proxyData.foo++) // 爆栈
```

原因在于副作用函数其实相当于`proxyData.foo = proxyData.foo + 1`，对foo这个字段同时进行了读和写的操作，读的时候track了当前副作用函数，写又trigger了一次，然后又是读写无限递归调用，于是就产生了栈溢出

解决这个问题需要增加一个判断：`如果trigger触发执行的副作用函数与正在执行的副作用函数相同，则不触发执行`

```js
const trigger = (target, key) => {
    const depsMap = bucket.get(target)
    if (!depsMap) return
    const effects = depsMap.get(key)
    const effectsToRun = new Set()
    effects && effects.forEach((fn) => {
        // 如果trigger触发执行的副作用函数与当前正在执行的副作用函数相同，则不触发执行
        if (fn !== activeEffect) {
            effectsToRun.add(fn)
        }
    })
    effectsToRun.forEach((fn) => fn())
}
```

### 调度执行

可调度性的意思就是`让用户有能力决定副作用函数执行的时机，次数以及方式`

```js
// 像挂deps一样，我们给effect多挂一个options，允许用户指定调度器
function effect(fn, options = {}) {
    const effectFn = () => {
        cleanup(effectFn)
        activeEffect = effectFn
        effectStack.push(activeEffect)
        fn()
        effectStack.pop()
        activeEffect = effectStack[effectStack.length - 1]
    }
    effectFn.options = options // 这里
    effectFn.deps = []
    effectFn()
}
```

在trigger里做分支判断，如果用户指定了调度器，则把副作用函数的执行控制权交给用户

```js
const trigger = (target, key) => {
    const depsMap = bucket.get(target)
    if (!depsMap) return
    const effects = depsMap.get(key)
    const effectsToRun = new Set()
    effects && effects.forEach((fn) => {
        if (fn !== activeEffect) {
            effectsToRun.add(fn)
        }
    })
    effectsToRun.forEach((fn) => {
        // 如果用户自定义了调度器，则把副作用函数注入
        if (fn.options.scheduler) {
            fn.options.scheduler(fn)
        } else {
            // 否则直接执行
            fn()
        }
    })
}
```

此时我们的响应式系统就有了调度功能。另外，书中有个任务队列的代码很有意思，我这里摘抄过来

```js
const jobQueue = new Set()
const p = Promise.resolve()

let isFlushing = false
function flushJob() {
    if (isFlushing) return
    isFlushing = true
    p.then(() => {
        jobQueue.forEach((job) => job())
    }).finally(() => {
        isFlushing = false
    })
}
```

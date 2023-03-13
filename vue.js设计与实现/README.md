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
    if (!activeEffect) return 
    let depsMap = bucket.get(target)
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
const obj = new Proxy(data, { /*...*/ })

effect(() => {
    document.body.innerText = obj.ok ? obj.text : 'not'
})
```

此时修改obj.ok会触发副作用函数

```js
obj.ok = false
```

且同时obj.text不会被读取，我们希望修改obj.text时副作用函数不被重新执行，但事实上是会的

```js
// 如果执行
obj.text = 'qnyd!'
// 会重新执行 effect
```

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

### 避免无限递归循环

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

### 计算属性 computed 与 lazy

要实现一个 computed，我们需要先让 effect 具有懒执行的能力，并且需要获得副作用函数的执行结果

```js
function effect(fn, options = {}) {
    const effectFn = () => {
        cleanup(effectFn)
        activeEffect = effectFn
        effectStack.push(activeEffect)
        const res = fn() // 保存结果
        effectStack.pop()
        activeEffect = effectStack[effectStack.length - 1]
        return res // 返回
    }
    effectFn.options = options
    effectFn.deps = []
    // 如果不是 lazy 才立即执行
    if (!options.lazy) {
        effectFn()
    }
    // 将副作用函数作为返回值
    return effectFn
}

const effectFn = effect(
    () => foo + bar, // 传入一个 getter 作为副作用函数
    { lazy: true } // 新增
)
const value = effectFn() // 手动执行获取 getter 的值
```

基于此封装一个简易的 computed

```js
function computed (getter) {
    const effectFn = effect(getter, { lazy: true })
    const obj = {
        get value() {
            return effectFn()
        }
    }
    return obj
}

const proxyData = new Proxy({ foo: 1, bar: 2 }, { /*...*/ })
const sum = computed(() => proxyData.foo + proxyData.bar)
console.log('sum: ', sum.value)
```

computed可以正常的工作，但是还无法对值进行缓存，执行多次`console.log('sum: ', sum.value)`会导致effectFn 进行重复计算

```js
function computed (getter) {
    let value // 用于缓存值
    let dirty = true // 用来标识值是否需要重新计算
    const effectFn = effect(getter, {
        lazy: true,
        scheduler() {
            // 值发生变化时需要重新计算
            dirty = true
        }
    })
    const obj = {
        get value() {
            // 计算判断
            if (dirty) {
                value = effectFn()
                dirty = false
            }
            return value
        }
    }
    return obj
}
```

此时 computed 已经趋于完美，但还有一个缺陷，它体现在当我们在另外一个 effect 中读取计算属性的值时：

```js
const proxyData = new Proxy({ foo: 1, bar: 2 }, { /*...*/ })
const sum = computed(() => proxyData.foo + proxyData.bar)

effect(() => {
    // 在另一个 effect 中读取 sum 的值
    console.log(sum.value)
})
proxyData.foo++ // 这次修改并不会触发以上 effect 执行
```

书里的解释我并不是很明白，我自己的理解是： `effect` 中读取值后建立依赖关系以及触发重新执行这两件事情是由 `Proxy` 数据中的 `track` 和 `trigger` 做的，而 `computed` 中返回的这个 `obj` 里并没有实现这俩兄弟，导致的 `effect` 不能正常工作

所以我们需要为 `computed` 手动去 `track` 和 `trigger`

```js
function computed (getter) {
    let value
    let dirty = true
    const effectFn = effect(getter, {
        lazy: true,
        scheduler() {
            dirty = true
            trigger(obj, 'value') // 手动触发
        }
    })
    const obj = {
        get value() {
            if (dirty) {
                value = effectFn()
                dirty = false
            }
            track(obj, 'value') // 手动收集
            return value
        }
    }
    return obj
}
```

### watch 的实现原理

watch 本质就是监听变化、执行回调

```js
function watch(data, cb) {
    effect(
        () => traverse(data), // 递归读取
        {
            scheduler() {
                cb()
            }
        }
    )
}

function traverse(data, seen = new Set()) {
    if (typeof data !== 'object' || data === null || seen.has(data)) return
    // 代表读取过了 避免循环引用导致死循环
    seen.add(data)
    for(const key in data) {
        traverse(data[key], seen)
    }
    return data
}
```

除了传入一个响应式数据以外，也可以支持传入一个内部读取响应式数据的 getter

```js
const proxyData = new Proxy({ foo: 1 }, {/*...*/})
watch(() => proxyData.foo, () => {
    console.log('proxyData.foo: ', proxyData.foo)
})

function watch(data, cb) {
    const getter = typeof data === 'function'
        ? data : () => traverse(data)
    effect(
        getter,
        {
            scheduler() {
                cb()
            }
        }
    )
}
```

新旧值注入回调函数

```js
function watch(data, cb) {
    let oldVal // 新增
    const getter = typeof data === 'function'
        ? data : () => traverse(data)
    const effectFn = effect(
        getter,
        {
            lazy: true, // 开启 lazy 模式
            scheduler() {
                const newVal = effectFn()
                cb(newVal, oldVal) // 注入
                oldVal = newVal
            }
        }
    )
    oldVal = effectFn()
}
```

### 立即执行的 watch 与回调执行时机

目前的 `watch` 回调只会在响应式数据发生变化时才会执行，而 Vue 中是可以通过传入 `immediate` 来控制是否立即执行时机的

```js
function watch(data, cb, options) {
    let oldVal
    const getter = typeof data === 'function'
        ? data : () => traverse(data)

    // 把先前 scheduler 里的东西抽出来
    const job = () => {
        const newVal = effectFn()
        cb(newVal, oldVal)
        oldVal = newVal
    }
    const effectFn = effect(
        getter,
        {
            lazy: true,
            scheduler: job
        }
    )

    // 是否立即执行
    if (options.immediate) {
        job()
    } else {
        oldVal = effectFn()
    }
}
```

除了 `immediate` 以外，还可以通过 `flush` 来指定回调的执行时机

```js
watch(getter, console.log, {
    /**
     *  pre: 回调函数在 watch 创建时执行
     *  post: 调度函数需要将副作用函数放到一个微任务队列中执行
     *  sync: 同步执行
     */
    flush: 'post'
})

function watch(data, cb, options) {
    let oldVal
    const getter = typeof data === 'function'
        ? data : () => traverse(data)

    const job = () => {
        const newVal = effectFn()
        cb(newVal, oldVal)
        oldVal = newVal
    }
    const effectFn = effect(
        getter,
        {
            lazy: true,
            scheduler: () => {
                // 微任务
                if (options.flush === 'post') {
                    const p = Promise.resolve()
                    p.then(job)
                } else {
                    job() // 同步执行
                }
            }
        }
    )

    if (options.immediate) {
        job()
    } else {
        oldVal = effectFn()
    }
}
```

### 过期的副作用

来看一个场景，假设我们连续修改 `obj` 的值两次，会触发两次请求

```js
let finalData
watch(obj, async () => {
    const res = await fetch('/api/example)
    finalData = res
})

/**
 * Client ------ request  A ----> Server
 * Client ------ request  B ----> Server
 * Client <----- response B ----- Server
 * Client <----- response A ----- Server
 */
```

由于 `B` 请求是后发的，我们认为 `response B` 才是最新的数据，而请求 `A` 已经过期，其结果 `response A` 应该被视为无效

在 `Vue` 中，`watch` 函数的回调函数有第三个参数 `onInvalidate` 函数，可以用来注册一个回调在当前副作用函数过期时执行，所以以上的例子可以改造为：

```js
let finalData
watch(obj, async (newVal, oldVal, onInvalidate) => {
    // 标识当前副作用函数是否过期
    let expired = false
    onInvalidate(() => {
        // 过期回调时置为 true
        expired = true
    })
    const res = await fetch('/api/example')
    if (!expired) {
        // 没有过期才赋给 finalData
        finalData = res
    }
})
```

`onInvalidate` 的原理很简单，在 `watch` 内部每次检测到变更后，在副作用函数重新执行之前，会先调用我们通过 `onInvalidate` 函数注册的过期回调

```js
function watch(data, cb, options) {
    let oldVal
    let cleanup // 过期回调
    const onInvalidate = (fn) => {
        cleanup = fn
    }
    const getter = typeof data === 'function'
        ? data : () => traverse(data)

    const job = () => {
        const newVal = effectFn()
        cleanup && cleanup()
        cb(newVal, oldVal, onInvalidate)
        oldVal = newVal
    }
    const effectFn = effect(
        getter,
        {
            lazy: true,
            scheduler: () => {
                // 微任务
                if (options.flush === 'post') {
                    const p = Promise.resolve()
                    p.then(job)
                } else {
                    job()
                }
            }
        }
    )

    if (options.immediate) {
        job()
    } else {
        oldVal = effectFn()
    }
}
```

## 五、非原始值的响应式方案

### 理解 Proxy 和 Reflect

#### Proxy

使用 `Proxy` 可以创建一个 `代理对象`，对 `其他对象` 的 `基本语义` 的 `代理`，即` 拦截` 和 `重新定义` 对象的基本操作

什么是基本语义？对一个对象的 `读` `写` 等操作就属于基本语义的操作，即 `基本操作`，与之对应的有 `复合操作`

```js
const obj = {
    foo: 1,
    bar: () => {
        console.log(2)
    }
}

obj.foo // 基本操作
obj.bar() // 复合操作，包含了 get 和 apply 两个操作
```

Proxy 只能拦截基本操作

```js
const p = new Proxy(obj, {
    get() {
        // do something
    },
    set() {
        // do something
    }
})
```

Proxy 构造函数接收两个参数，第一个是被代理对象，第二个对象是一组 `捕捉器(traps)`，用来捕获拦截被代理对象的基本操作

#### Reflect

Reflect 是一个内置的全局对象，它提供拦截 JavaScript 操作的方法。这些方法与 Proxy 拦截器的方法相同。Reflect 不是一个函数对象，因此它是不可构造的

```js
const obj = { foo: 'bar' }
Reflect.get(obj, 'foo') // 'bar' 等价于 obj.foo
```

Reflect 的所有方法都比 Proxy 拦截器方法多一个入参 `receiver`，可以理解为 `this`，这里来看一个例子

```js
// 不使用 Reflect
const obj = {
  foo: 1,
  get bar() {
    return this.foo
  }
}

const p = new Proxy(obj, {
  get(target, key) {
    track(target, key)
    return target[key]
  },
  set(target, key, newVal) {
    target[key] = newVal
    trigger(target, key)
  }
})

effect(() => {
    console.log(p.bar) // 读取 bar 建立联系
})

p.foo++ // 并不会触发重新执行副作用函数
```

在这个例子中，`p.bar` 执行了 `get bar()`，进而读取了 `foo` 属性，所以我们预期是 `foo` 和副作用函数建立了联系，当 `foo` 变化时，副作用函数应该重新执行，可事实却没有

原因在于 `p.bar` 时，代理对象是通过 `target[bar]` 来访问到 `bar` 属性的，而 `target` 是原始对象，即 `obj`

```js
    // 相当于代理对象通过 obj.bar 访问到这个函数
    get bar() {
        return this.foo // this 此时指向 obj
    }
```

也就是我们没有通过代理对象 `p` 来访问 `foo` 属性，就不存在建立联系了

我们使用 `Reflect` 来改写一下

```js
const p = new Proxy(obj, {
  get(target, key, receiver) {
    track(target, key)
    // 使用 Reflect.get 返回读取结果，receiver 代表谁在读取该参数
    return Reflect.get(target, key, receiver)
  },
  set(target, key, newVal) {
    target[key] = newVal
    trigger(target, key)
  }
})
```

此时我们知道 `receiver` 是代理对象 `p`，而 `get bar()` 中的 `this` 也指向了 `p`

### JavaScript 对象及 Proxy 的工作原理

JavaScript 中一切皆对象。ECMAScript 规范中指出，JavaScript 中有两种对象，一种是 `常规对象(ordinary object)`，另一种是 `异质对象(exotic object)`。如何区分，我们需要先了解对象的内部方法和内部槽。

当我们对一个对象进行操作时，实际上引擎会调用对象的内部方法(internal method)。ECMAScript 中规范了所有必要的内部方法：

Internal Method|Signature|Description
|-|-|-|
[[GetPrototypeOf]] | ( ) → Object \| Null | Determine the object that provides inherited properties for this object. A null value indicates that there are no inherited properties.
[[SetPrototypeOf]] | (Object \| Null) → Boolean | Associate this object with another object that provides inherited properties. Passing null indicates that there are no inherited properties. Returns true indicating that the operation was completed successfully or false indicating that the operation was not successful.
[[IsExtensible]] | ( ) → Boolean | Determine whether it is permitted to add additional properties to this object.
[[PreventExtensions]] | ( ) → Boolean | Control whether new properties may be added to this object. Returns true if the operation was successful or false if the operation was unsuccessful.
[[GetOwnProperty]] | (propertyKey) → Undefined \| Property Descriptor | Return a Property Descriptor for the own property of this object whose key is propertyKey, or undefined if no such property exists.
[[DefineOwnProperty]] | (propertyKey, PropertyDescriptor) → Boolean | Create or alter the own property, whose key is propertyKey, to have the state described by PropertyDescriptor. Return true if that property was successfully created/updated or false if the property could not be created or updated.
[[HasProperty]] | (propertyKey) → Boolean | Return a Boolean value indicating whether this object already has either an own or inherited property whose key is propertyKey.
[[Get]] | (propertyKey, Receiver) → any | Return the value of the property whose key is propertyKey from this object. If any ECMAScript code must be executed to retrieve the property value, Receiver is used as the this value when evaluating the code.
[[Set]] | (propertyKey, value, Receiver) → Boolean | Set the value of the property whose key is propertyKey to value. If any ECMAScript code must be executed to set the property value, Receiver is used as the this value when evaluating the code. Returns true if the property value was set or false if it could not be set.
[[Delete]] | (propertyKey) → Boolean | Remove the own property whose key is propertyKey from this object. Return false if the property was not deleted and is still present. Return true if the property was deleted or is not present.
[[OwnPropertyKeys]] | ( ) → List of property keys | Return a List whose elements are all of the own property keys for the object.

除此之外，还有两个额外的必要内部方法。在 JavaScript 中，函数也是对象，通过内部方法和内部槽可以区分对象是否为函数。

Internal Method|Signature|Description
|-|-|-|
[[Call]] | (any, a List of any) → any | Executes code associated with this object. Invoked via a function call expression. The arguments to the internal method are a this value and a List whose elements are the arguments passed to the function by a call expression. Objects that implement this internal method are callable.
[[Construct]] | (a List of any, Object) → Object | Creates an object. Invoked via the new operator or a super call. The first argument to the internal method is a List whose elements are the arguments of the constructor invocation or the super call. The second argument is the object to which the new operator was initially applied. Objects that implement this internal method are called constructors. A function object is not necessarily a constructor and such non-constructor function objects do not have a [[Construct]] internal method.

回到一开始的问题，如果一个对象按以上规范去实现内部方法，即为 `常规对象`，否则为 `异质对象`。

`Proxy` 就是一个 `异质对象`。当访问一个代理对象的属性时

```js
const proxyObject = new Proxy(obj, { /** */ })
proxyObject.foo
```

实际上是调用 `proxyObject` 中的 `[[Get]]` 方法，如果 `proxyObject` 没有指定 `get()` 拦截函数，则会调用原始对象 `obj` 的内部方法 `[[Get]]`，即代理透明性质。

因此，当代理对象指定一个拦截函数时，并不是修改了原始对象(被代理的 obj)的内部方法和行为，而是自定义了自己(代理对象 proxyObject)的内部方法和行为。以下是 Proxy 对象部署的所有内部方法以及用来自定义内部方法和行为的拦截函数名称。

内部方法|处理器函数
|-|-|
[[GetPrototypeOf]] | getPrototypeOf
[[SetPrototypeOf]] | setPrototypeOf
[[IsExtensible]] | isExtensible
[[PreventExtensions]] | preventExtensions
[[GetOwnProperty]] | getOwnPropertyDescriptor
[[DefineOwnProperty]] | defineProperty
[[HasProperty]] | has
[[Get]] | get
[[Set]] | set
[[Delete]] | deleteProperty
[[OwnPropertyKeys]] | ownKeys
[[Call]] | apply
[[Construct]] | constructor

例如我们需要拦截删除属性操作

```js
const obj = { foo: 1 }
const proxyObject = new Proxy(obj, {
    deleteProperty(target, key) {
        return Reflect.deleteProperty(target, key) // 调用 Reflect 上的同名方法实现操作
    }
})

console.log(obj.foo) // 1
delete obj.foo
console.log(obj.foo) // undefined
```

### 如何代理 Object

读取是一个很宽泛的概念，以下所有操作都是对一个对象的读取：

1. 访问属性：foo.bar
2. 判断对象或原型上是否存在给定的 key：key in obj
3. 使用 for...in 循环遍历对象：for (const key in obj) {}

#### 拦截 in

对于 `in` 操作符应该如何拦截？在ECMA-262规范中明确定义了 `in` 操作符的运行时逻辑：

>RelationalExpression : RelationalExpression in ShiftExpression
>1. Let lref be the result of evaluating RelationalExpression.
>2. Let lval be ? GetValue(lref).
>3. Let rref be the result of evaluating ShiftExpression.
>4. Let rval be ? GetValue(rref).
>5. If Type(rval) is not Object, throw a TypeError exception.
>6. Return ? HasProperty(rval, ? ToPropertyKey(lval)).

看到第6点可以知道，in 的运算结果最后是通过调用一个 `HasProperty` 的抽象方法得到的。通过ECMA-262 7.3.11节找到：`HasProperty` 抽象方法其实就是调用内部方法 `[[HasProperty]]`，而它对应的拦截器函数为 `has`。因此：

```js
const obj = { foo: 1 }

const proxyObj = new Proxy(obj, {
    has (target, key) {
        track(target, key) // done
        return Reflect.has(target, key)
    }
})

effect(() => {
    'foo' in proxyObj // 将会建立依赖关系
})
```

#### 拦截 for...in

同样通过查阅 ECMA-262 14.7.5.6 节得到，for...in的运行时逻辑中，6-c 步骤调用了一个 `EnumerateObjectProperties` 的抽象方法：

>6. If iterationKind is enumerate then  
>...  
>c. Let iterator be ? EnumerateObjectProperties(obj)  
>...

规范 14.7.5.9 节中给出 `EnumerateObjectProperties` 的示例实现，代码中使用了 `Reflect.ownKeys(obj)` 来获取只属于对象自身拥有的键，因此，我们使用同名的 `ownKeys` 拦截函数就可以拦截到 `for...in` 操作：

```js
const obj = { foo: 1 }
const ITERATE_KEY = Symbol()

const proxyObj = new Proxy(obj, {
    ownKeys(target) {
        track(target, ITERATE_KEY) // 现在 for...in 会建立联系
        return Reflect.ownKeys(target)
    }
})
```

`ownKeys` 不接收具体的 key，所以我们需要手动指定一个 `ITERATE_KEY` 来确保 key 的依赖被正确追踪，因此在做 set 操作的时候也应该确保 `ITERATE_KEY` 对应的副作用函数被重新执行

```js
const obj = { foo: 1 }
const proxyObj = new Proxy(obj, {
  // do something
})

effect(() => {
  for (const key in proxyObj) {
    console.log('key: ', key)
  }
})

proxyObj.bar = 2 // 需要触发 ITERATE_KEY 对应依赖
```

```js
function trigger(target, key) {
  // ...
  
  const iterateEffects = depsMap.get(ITERATE_KEY)
  iterateEffects && iterateEffects.forEach(effectFn => {
    if (effectFn !== activeEffect) {
      effectsToRun.add(effectFn)
    }
  })

  // ...
}
```

在 trigger 的时候同时把 `ITERATE_KEY` 相关的副作用函数取出来重新执行。但这样会导致一个问题，那就是修改属性的时候也会触发，而修改属性并不修改 for...in 次数，是不应该触发的。因此我们应该标记此次 set 对应的是新增属性还是修改属性操作

```js
set(target, key, newVal, receiver) {
  // 如果属性不存在，则说明是在添加新的属性，否则是设置已存在的属性
  const type = Object.prototype.hasOwnProperty.call(target, key) ? 'SET' : 'ADD'
  // 设置属性值
  const res = Reflect.set(target, key, newVal, receiver)
  // 将 type 作为第三个参数传递给 trigger 函数
  trigger(target, key, type)

  return res
}
```

```js
function trigger(target, key, type) {
  // ...
  
  const iterateEffects = depsMap.get(ITERATE_KEY)
  if (type === 'ADD') {
    iterateEffects && iterateEffects.forEach(effectFn => {
      if (effectFn !== activeEffect) {
        effectsToRun.add(effectFn)
      }
    })
  }

  // ...
}
```

同理，删除属性的时候会减少 for...in 次数，也应该重新执行 `ITERATE_KEY` 相关的副作用函数。

```js
deleteProperty(target, key) {
  // 检查被操作的属性是否是对象自己的属性
  const hadKey = Object.prototype.hasOwnProperty.call(target, key)
  // 使用 Reflect.deleteProperty 完成属性的删除
  const res = Reflect.deleteProperty(target, key)

  if (res && hadKey) {
    // 只有当被删除的属性时对象自己的属性并且成功删除时，才触发更新
    trigger(target, key, 'DELETE')
  }

  return res
}
```

```js
function trigger(target, key, type) {
  // ...
  
  const iterateEffects = depsMap.get(ITERATE_KEY)
  if (type === 'ADD' || type === 'DELETE') {
    iterateEffects && iterateEffects.forEach(effectFn => {
      if (effectFn !== activeEffect) {
        effectsToRun.add(effectFn)
      }
    })
  }

  // ...
}
```

### 合理地触发响应

当值没有发生变化时，应该不触发响应，因此我们判断此次 `set` 设置的值是否和旧值相同，相同则不触发

```js
const p = new Proxy(obj, {
  set(target, key, newVal, receiver) {
    // 先获取旧值
    const oldVal = target[key]

    const type = Object.prototype.hasOwnProperty.call(target, key) ? 'SET' : 'ADD'
    const res = Reflect.set(target, key, newVal, receiver)
    // 比较新值与旧值，当不全等、并且新旧值不都为NaN时候才触发响应
    if (oldVal !== newVal && (oldVal === oldVal && newVal === newVal)) {
      trigger(target, key, type)
    }

    return res
  },
})
```

此外，还有一种从原型上继承属性的情况

```js
// reactive 是对 new Proxy 的简单封装
function reactive*(obj) => new Proxy(obj, { /** */ })

const parent = reactive({ foo: 1 })
const child = reactive({})
Object.setPrototypeOf(child, parent)
effect(() => {
  console.log(child.foo)
})
child.foo = 2 // 会导致副作用函数重新执行两次
```

查看规范 10.1.8.1 节来了解 `[[Get]]` 内部方法的执行流程，其中有一步如下

如果 desc 是 undefined，那么
- a. 让 parent 的值为 ? O.[[GetPrototypeOf]]()。
- b. 如果 parent 是 null，则返回 undefined。
- c. 返回 ? parent.[[Get]](P, Receiver)。

也就是说读取 `child` 的 `foo` 属性时，如果对象上不含该属性，则会获取对象的原型，然后调用原型的 `[[Get]]` 内部方法，即 `parent` 对象的 `[[Get]]`。但 `parent` 也是一个代理对象，所以会同时收集 `child` 和 `parent` 都会与副作用函数建立联系。

同理，为 `child` 设置属性时，由于 `child` 上并不存在该属性，所以在 `Reflect.set(...)` 时会调用原型的 `[[Set]]` 方法，类似一个栈：

```js
child.[[Set]] => parent.[[Set]] => parent trigger => child trigger
```

解决的方式屏蔽掉其中一次副作用的执行。我们可以知道，
1. 执行 `child` 的拦截函数 `set` 时，其中的 `target` 参数为 `child` 的原始对象，`receiver` 为 `child`
2. 执行 `parent` 的拦截函数 `set` 时，其中的 `target` 参数为 `parent` 的原始对象，`receiver` 依然为 `child`
因为我们是为 `child` 设置属性值，因此 `receiver` 总是为 `child`

```js
const originalChild = {}
const child = new Proxy(originalChild, {
  // target 为 originalChild
  // receiver 为调用者即 child
  set(target, key, newVal, receiver) {
    // ...
  }
})

const originalParent = {}
const parent = new Proxy(originalParent, {
  // target 为 originalParent
  // receiver 为调用者即 child
  set(target, key, newVal, receiver) {
    // ...
  }
}) 
```

因此我们在 `set` 时判断 `receiver` 的原始对象是否为 `target`，是的时候再执行 `trigger`

```js
const reactive = (obj) => new Proxy(obj, {
  get(target, key, receiver) {
    if (key === 'raw') { // 约定.raw时是读取当前代理对象的原始对象
      return target
    }
    track(target, key)
    return Reflect.get(target, key, receiver)
  },
  set(target, key, newVal, receiver) {
    const oldVal = target[key]
    const type = Object.prototype.hasOwnProperty.call(target, key) ? TriggerType.SET : TriggerType.ADD
    const res = Reflect.set(target, key, newVal, receiver)
    if (target === receiver.raw) { // 判断 target 和 receiver 的原始对象是否相同
      if (oldVal !== newVal && (oldVal === oldVal || newVal === newVal)) {
        trigger(target, key, type)
      }
    }
    return res
  },
  // ...
})
```

### 浅响应与深响应

我们现在实现的 `reactive` 是浅响应

```js
const obj = reactive({ foo: { bar: 1 } })
effect(() => {
  console.log(obj.foo.bar)
})
// 修改 obj.foo.bar 的值，并不能触发响应
obj.foo.bar = 2
```

我们需要改造一下，封装 `shallowReactive` 和 `reactive`，让我们的系统同时支持浅响应与深响应

```js
// 封装两个新函数
const reactive = (obj) => createReactive(obj)
const shallowReactive = (obj) => createReactive(obj, true)

// 原先的 reactive 改名为 createReactive，新增 isShallow 参数区别是否为浅响应
function createReactive(obj, isShallow) {
  return new Proxy(obj, {
    get(target, key, receiver) {
      if (key === 'raw') {
        return target
      }
      const res = Reflect.get(target, key, receiver)
      track(target, key)
      if (isShallow) {
        return res // 如果是浅响应则直接返回结果
      }
      if (typeof res === 'object' && res !== null) {
        return reactive(res) // 如果是深响应且结果为对象 则返回包装对象
      }
      return res
    },
  })
}
```

### 只读和浅只读

我们希望一些数据是只读的，当用户尝试修改只读数据时，会收到一条警告信息。同理有浅只读和深只读，这就是接下来要封装的 `shallowReadonly` 和 `readonly`


```js
// 封装两个新函数
const readonly = (obj) => createReactive(obj, false, true)
const shallowReadonly = (obj) => createReactive(obj, true, true)

// 新增 isReadonly 参数区别是否为只读
function createReactive(obj, isShallow, isReadonly) {
  return new Proxy(obj, {
    get(target, key, receiver) {
      if (key === 'raw') {
        return target
      }
      const res = Reflect.get(target, key, receiver)
      // 只读属性的响应式是无意义的 因为只 track 那些非只读属性
      if (!isReadonly) {
          track(target, key)
      }
      if (isShallow) {
        return res
      }
      if (typeof res === 'object' && res !== null) {
        // 同样的 深只读需要递归所有子属性
        return isReadonly ? readonly(res) : reactive(res)
      }
      return res
    },
    set(target, key, newVal, receiver) {
      // 如果是只读的，打印警告信息并返回
      if (isReadonly) {
        console.warn(`属性${key}是只读的`)
        return true
      }
      // ...
    },
    deleteProperty(target, key) {
      // 如果是只读的，打印警告信息并返回
      if (isReadonly) {
        console.warn(`属性${key}是只读的`)
        return true
      }
      // ...
    },
    // ...
  })
}
```

### 代理数组

在 JavaScript 中有两种对象：常规对象和异质对象。而数组就是一种异质对象，这是因为数组对象的 `[[DefineOwnProperty]]` 内部方法与常规对象不同，其余都相同。因此，在代理数组时，现在用于代理对象的大部分逻辑都可以适用。

数组的读取操作如下：

1. 通过索引访问数组元素值：arr[0]。
2. 访问数组的长度：arr.length。
3. 把数组作为对象，使用 for...in 循环遍历。
4. 使用 for...of 迭代遍历数组。
5. 数组的原型方法，如 concat/join/every/some/find/findIndex/includes 等，以及其他所有不改变原数组的原型方法。

数组的设置操作如下：

1. 通过索引修改数组元素值：arr[1] = 3。
2. 修改数组长度：arr.length = 0。
3. 数组的栈方法：push/pop/shift/unshift。
4. 修改原数组的原型方法：splice/fill/sort 等。

下面我们从数组的索引与 length 开始说起

#### 数组的索引与 length

通过索引设置数组的元素值与设置对象的属性值存在根本上的不同，查询规范的 10.4.2.1 节可知，如果设置的索引值大于数组当前的长度，那么要更新数组的length 属性。因此在触发响应时，也应该触发与 length 属性相关联的副作用函数重新执行。

```js
const arr = reactive(['foo']) // 数组的原长度为 1

effect(() => {
  console.log(arr.length) // 1
})
// 设置索引 1 的值，会导致数组的长度变为 2
arr[1] = 'bar'
```

为了实现目标，我们需要修改 `set` 拦截函数

```js
set(target, key, newVal, receiver) {
  const oldVal = target[key]
  const type = Array.isArray(target)
    ? Number(key) < target.length ? TriggerType.SET : TriggerType.ADD // 新增数组判断 set 类型判断
    : Object.prototype.hasOwnProperty.call(target, key) ? TriggerType.SET : TriggerType.ADD
  const res = Reflect.set(target, key, newVal, receiver)
  if (target === receiver.raw) {
    if (oldVal !== newVal && (oldVal === oldVal || newVal === newVal)) {
      trigger(target, key, type)
    }
  }
  return res
}
```

知道了数组当前 `set` 操作是新增子项还是设置原有子项后，我们就可以在 `trigger` 中选择是否触发 `length` 相关联的副作用函数了

```js
const trigger = (target, key, type) => {
  // ...
  if (type === TriggerType.ADD && Array.isArray(target)) {
    const lengthEffects = depsMap.get('length')
    lengthEffects && lengthEffects.forEach((fn) => {
      if (fn !== activeEffect) {
        effectsToRun.add(fn)
      }
    })
  }
  effectsToRun.forEach((fn) => {
    // ...
  })
}
```

同理，修改数组的 `length` 属性也有可能影响部分数组元素，例如修改 `length` 为 100 时，并不会影响索引值为 2 的元素，但会影响索引值为 120 的元素。因此，我们需要找到那些索引值大于或等于新的 length 属性值的元素触发响应。

```js
set(target, key, newVal, receiver) {
  // ...
  if (target === receiver.raw) {
    if (oldVal !== newVal && (oldVal === oldVal || newVal === newVal)) {
      trigger(target, key, type, newVal) // 新增第四个参数 触发响应的新值
    }
  }
  return res
}
```

trigger 中获取到新值之后就可以判断此次是否是对 `length` 的修改，以及是否需要触发重新执行副作用函数

```js
const trigger = (target, key, type, newVal) => {
  // ...
  if (Array.isArray(target) && key === 'length') {
    depsMap.forEach((effects, index) => {
      if (index >= newVal) { // 只有索引值大于等于新 length 的元素才需要触发响应
        effects.forEach((fn) => {
          if (fn !== activeEffect) {
            effectsToRun.add(fn)
          }
        })
      }
    })
  }
  effectsToRun.forEach((fn) => {
    // ...
  })
}
```

#### 遍历数组

数组也是对象，因此支持用 `for...in` 对数组进行遍历，虽然并不建议这么做，但语法上可行我们也需要考虑到。

由前文了解到 `for...in` 是由 `ownKeys` 函数拦截的，我们创造了 ITERATE_KEY 作为追踪的 key，但这是对于普通对象而言的。

对于数组来说，有两种操作会影响到 `for...in` 循环对数组的遍历:

```js
arr[100] = 'bar' // 添加新元素
arr.length = 0   // 修改 length 的值
```

这两种操作本质上都是修改了数组的 `length`，因此我们可以在 `ownKeys` 拦截函数内，判断当前操作目标 `target` 是否是数组，如果是，则使用 `length` 作为 key 去建立响应联系

```js
ownKeys(target) {
  // 数组则以 length 作为 key
  track(target, Array.isArray(ITERATE_KEY) ? 'length' : ITERATE_KEY)
  return Reflect.ownKeys(target)
}
```

`for...of` 也可以用来遍历数组，与 `for...in` 不同，`for...of` 是用来遍历 `可迭代对象` 的。

**ES2015** 为 **JavaScript** 定义了 `迭代协议（iteration protocol）`，其中规定了，一个对象是否能被迭代，取决于该对象的原型是否实现了 `@@iterator` 方法，即 `Symbol.iterator` 方法。

```js
// 实现了 Symbol.iterator 的对象
const obj = {
  val: 0,
  [Symbol.iterator]() {
    return {
      next() {
        return {
          value: obj.val++,
          done: obj.val > 10
        }
      }
    }
  }
}

for (const key of obj) {
  console.log(key) // 0 1 2 3 4 5 6 7 8 9
}
```

数组中内建了迭代器方法

```js
// 调用数组内建的迭代器方法
const arr = [1, 2, 3]
const iterator = arr[Symbol.iterator]()
console.log(iterator.next()) // { value: 1, done: false }
console.log(iterator.next()) // { value: 2, done: false }
console.log(iterator.next()) // { value: 3, done: false }
console.log(iterator.next()) // { value: undefined, done: true }

// 数组的 values() 其实就是调用的迭代器方法
console.log(Array.prototype.values === Array.prototype[Symbol.iterator]) // true
```

查阅了规范的 23.1.5.1 节可以知道，数组迭代器的执行会读取数组的 length 属性，如果迭代的是数组元素值，还会读取数组的索引。

因此，只需要在副作用函数与数组的长度和索引之间建立响应联系即可。即不需要新增逻辑就可以使其正常工作。

```js
const arr = reactive([1, 2, 3, 4, 5])
effect(() => {
  for (const val of arr.values()) {
    console.log(val)
  }
})
arr[1] = 'bar'  // 能够触发响应
arr.length = 0  // 能够触发响应
```

最后需要指出，数组的 `Symbol.iterator` 是一个 `symbol` 值，为了避免意外错误和性能问题，不应该 `track` 这类 `symbol` 值

```js
get(target, key, receiver) {
  // ...
  const res = Reflect.get(target, key, receiver)
  if (!isReadonly && typeof key !== 'symbol') {
    track(target, key) // 读取属性时收集依赖
  }
  if (isShallow) {
    return res
  }
  // ...
}
```

#### 数组的查找方法

数组的内部方法其实都依赖了对象的基本语义，所以大部分情况都不需要额外的处理，这里有个例外：

```js
const obj = {}
const arr = reactive([obj])
console.log(arr.includes(arr[0]))  // false
```

查阅了规范的 23.1.3.13 节

>1. Let O be ? ToObject(this value).  
>...

>10. Repeat, while k < len,  
>  a. Let elementK be ? Get(O, ! ToString(𝔽(k))).  
>  b. If SameValueZero(searchElement, elementK) is true, return true.  
>  c. Set k to k + 1.

得知 `includes` 方法会通过索引读取数组元素的值，在第一步中的 `this` 指代的其实是代理对象 `arr`，到第十步去索引代理对象的元素做比较输出结果。

我们再回头看这句代码：`arr.includes(arr[0])`。其中，`arr[0]` 得到的是一个代理对象，而在 `includes` 方法内部也会通过 `arr` 访问数组元素，从而也得到一个代理对象，问题是这两个代理对象是不同的。

```js
function createReactive(data, isShallow, isReadonly) {
  return new Proxy(data, {
    //...
    if (typeof res === 'object' && res !== null) {
      return isReadonly ? readonly(res) : reactive(res) // reactive() 会返回一个新的代理对象
    }
    //...
  }）
}
```

即使参数相同，每次调用 `reactive` 函数也都会返回新的代理对象。因此，我们要避免 `reactive` 创建重复对象，这个问题就会迎刃而解。

```js
// 维护一个 Map 实例来存储原始对象和代理对象之间的映射关系
const reactiveMap = new Map()
const reactive = (obj) => {
  // 如果已经存在代理对象则直接返回
  const existedProxy = reactiveMap.get(obj)
  if (existedProxy) return existedProxy

  // 没有再进行创建 存储映射关系 返回新的代理对象
  const res = createReactive(obj)
  reactiveMap.set(obj, res)
  return res
}
```

此时上面的示例代码可以正常运行，然而，还有以下这种情况：

```js
const obj = {}
const arr = reactive([obj])

console.log(arr.includes(obj))  // false
```

这个问题很好理解，`includes` 内部实现中的 `this` 指代的是代理对象 `arr`，而通过代理对象找 `obj` 这个原始对象是找不到的。要解决这个问题，我们需要重写 `includes` 方法

我们知道，调用数组的 `includes` 方法其实是由两个基本语义组成的，一是访问数组对象上的 `incudes` 属性，二是执行函数。那我们只需要在拦截函数 `get` 中拦截并返回一个自定义的 `includes` 方法就可以实现对其重写的操作了 

```js
const arrayInstrumentations = {}
;['includes', 'indexOf', 'lastIndexOf'].forEach((method) => { // indexOf 和 lastIndexOf 也需要做相同的操作 一并处理了
  const originMethod = Array.prototype[method]
  arrayInstrumentations[method] = function(...args) {
    let res = originMethod.apply(this, args)
    // 如果代理对象中没有找到则通过原始对象查找
    if (res === false) {
      res = originMethod.apply(this.raw, args)
    }
    return res
  }
})

// ...
get(target, key, receiver) {
  // ...
  if (key === 'raw') {
    return target
  }
  if (Array.isArray(target) && arrayInstrumentations.hasOwnProperty(key)) {
    return Reflect.get(arrayInstrumentations, key, receiver)
  }
  // ...
}
```

#### 隐式修改数组长度的原型方法

`push/pop/shift/unshift/splice` 都会隐式修改数组长度，我们以 `push` 为例子

```js
const arr = reactive([1])
effect(() => { arr.push(1) })
effect(() => { arr.push(1) }) // Maximum call stack size exceeded
```

上面代码会导致栈溢出，查阅了规范的 23.1.3.20 节，得知 `push` 方法在执行过程中，既会读取数组的 `length` 属性值，也会设置数组的 `length` 属性值。这会导致两个独立的副作用函数互相影响。

因此我们只需屏蔽掉 `push` 对 `length` 的读取即可

```js
let shouldTrack = true
// 重写数组的 push、pop、shift、unshift 以及 splice 方法
;['push', 'pop', 'shift', 'unshift', 'splice'].forEach(method => {
  const originMethod = Array.prototype[method]
  arrayInstrumentations[method] = function(...args) {
    shouldTrack = false
    let res = originMethod.apply(this, args)
    shouldTrack = true
    return res
  }
})

function track(target, key) {
  // 当禁止追踪时，直接返回
  if (!activeEffect || !shouldTrack) return
  // 省略部分代码
}
```

### 代理 Set 和 Map

#### 如何代理 Set 和 Map

`Set` 和 `Map` 类型的数据有特定的属性和方法用来操作自身，因此我们不能像代理普通对象那样去代理它们。

```js
const s = new Set([1, 2, 3])
const p = new Proxy(s, {/** */})

console.log(p.size) // error 在不兼容的 receiver 上调用了 get Set.prototype.size 方法
p.delete(1) // TypeError: Method Set.prototype.delete called on incompatible receiver [object Object]
```

查阅规范 24.2.3.9 得知，`Set.prototype.size` 是一个访问器属性，访问时会取 `this（这里指代理对象）` ，然后检查对象是否存在内部槽 `[[SetData]]`，因为代理对象不存在这个内部槽，所以会报错。因此我们需要修正这个 `this` 的指向。

```js
get(target, key, receiver) {
  if (key === 'size') {
    return Reflect.get(target, key, target) // 将 receiver 指向 target 自己
  }
  // ...
}
```

`delete` 的错误也类似，但有些区别。因为 `p.delete` 时，`delete` 方法并没有执行，真正使其执行的语句是 `p.delete(1)` 这句函数调用。因此无论怎么修改 `receiver` 的指向，在 `delete` 方法执行时候，方法内部的 `this` 总是会指向调用方也就是代理对象 `p`。

要想解决这个问题，我们需要把 `delete` 方法与原始数据对象绑定

```js
get(target, key, receiver) {
  if (key === 'size') {
    track(target, ITERATE_KEY)
    return Reflect.get(target, key, target)
  }
  return target[key].bind(target) // this 指向 target 自身
}
```

#### 建立响应联系

```js
const p = reactive(new Set([1, 2, 3]))

effect(() => {
  // 在副作用函数内访问 size 属性
  console.log(p.size)
})
// 添加值为 1 的元素，应该触发响应
p.add(1)
```

为了实现以上功能，我们需要在访问 `.size` 时调用 `track` 函数进行依赖追踪，然后在 `add` 方法执行时调用 `trigger` 函数触发响应

```js
const mutableInstrumentations = {
  add(key) {
    // proxyObj.add(xxx) 时 this 指向代理对象，那 .raw 指向原始对象
    const target = this.raw
    const hasKey = target.has(key)
    // 使用原始对象直接 .add 则不需要 bind
    const res = target.add(key)
    // 只有 add 原始对象不存在的 key 才会 trigger，而传入 ADD 类型，在 trigger 内部会触发 ITERATE_KEY 相关依赖
    !hasKey && trigger(target, key, 'ADD') 
    return res
  }
}
get(target, key, receiver) {
  if (key === 'raw') return target
  if (key === 'size') {
    track(target, key, receiver) // 建立响应性联系
    return Reflect.get(target, ITERATE_KEY)
  }
  return mutableInstrumentations[key]
}
```

`delete` 方法也类似

```js
delete(key) {
  const target = this.raw
  const hasKey = target.has(key)
  const res = target.delete(key)
  // 这里变成了原本存在该 key 才触发响应
  hasKey && trigger(target, key, 'DELETE')
  return res
}
```

#### 避免污染原始数据

借助 `Map` 的 `set` 和 `get` 方法来说明什么是污染原始数据

```js
const p = reactive(new Map([['key', 1]]))
effect(() => {
  console.log(p.get('key'))
})
p.set('key', 2) // 触发响应
```

要想实现以上功能，我们需要重写 `Map` 的 `set` 和 `get` 方法

```js
get(key) {
  const target = this.raw
  const hasKey = target.has(key)
  track(target, key)
  if (hasKey) {
    const res = target.get(key)
    return typeof res === 'object' ? reactive(obj) : res // 省略了具体的递归判断逻辑
  }
},
set(key, value) {
  const target = this.raw
  const hasKey = target.has(key)
  const oldVal = target.get(key)
  target.set(key, value)
  if (!hasKey) {
    trigger(target, key, TriggerType.ADD)
  } else if (oldVal !== value || (oldVal === oldVal && value === value)) {
    trigger(target, key, TriggerType.SET) 
  }
}
```

上面给出的 `set` 函数的实现能够正常工作，但它仍然存在问题，即 `set` 方法会污染原始数据。这是什么意思呢？来看下面的代码

```js
const m = new Map()
const p1 = reactive(m)
const p2 = reactive(new Map())
p1.set('p2', p2)
effect(() => {
  console.log(m.get('p2').size) // 通过原始数据 m 来读取数据值
})
m.get('p2').set('foo', 1) // 通过原始数据 m 设置数据值，却触发了副作用函数的重新执行，这是不合理的
```

原因在于重写的 `set` 方法中，我们通过 `target.set(key, value)`，将 `value` 原封不动地设置到原始对象上了，我们把**响应式数据设置到原始数据上的行为称为数据污染**

```js
set(key, value) {
  // ...
  const rawValue = value.raw || value // 避免将 value 原封不动设置到原始数据上
  target.set(key, rawValue)
  // ...
}
```

#### 处理 forEach

遍历操作只与键值对的数量有关，因此任何会修改 Map 对象键值对数量的操作都应该触发副作用函数重新执行，例如 delete 和 add 方法等

```js
const mutableInstrumentations = {
  forEach(callback) {
    // 取得原始数据对象
    const target = this.raw
    // 与 ITERATE_KEY 建立响应联系
    track(target, ITERATE_KEY)
    // 通过原始数据对象调用 forEach 方法，并把 callback 传递过去
    target.forEach(callback)
  }
}
```

重写 `forEach` 方法后可以使其具有响应性，但以上代码仍有缺陷

```js
const key = { key: 1 }
const value = new Set([1, 2, 3])
const p = reactive(new Map([
  [key, value]
]))
effect(() => {
  p.forEach(function (value, key) {
    console.log(value.size) // 
  })
})
p.get(key).delete(1) // 并没有触发副作用函数的重新执行
```

问题在于我们调用了原始的 `forEach` 方法，这使得传入的 `callback` 的参数是非响应性的，因此需要完善一下逻辑

```js
forEach(callback) {
  // wrap 函数可以将可代理数据转换为响应式数据
  const wrap = (val) => typeof val === 'object' ? reactive(val) : val
  const target = this.raw
  track(target, ITERATE_KEY)
  target.forEach((v, k) => {
    // 将参数包装为响应式再传入
    callback(wrap(v), wrap(k), this)
  })
}
```

另外，`forEach` 本身也接收第二个参数，用来指定 `callback` 函数执行时的 `this` 值

```js
forEach(callback, thisArg) {
  const wrap = (val) => typeof val === 'object' ? reactive(val) : val
  const target = this.raw
  track(target, ITERATE_KEY)
  target.forEach((v, k) => {
    callback.call(thisArg, wrap(v), wrap(k), this)
  })
}
```

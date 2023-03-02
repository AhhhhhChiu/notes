/**
 * 清除引用关系
 */
const cleanup = (effectFn) => {
  effectFn.deps?.forEach((deps) => {
    deps.delete(effectFn)
  })
  effectFn.deps.length = 0
}

/**
 * 注册副作用函数
 */
const effectStack = []
let activeEffect
const effect = (fn) => {
  const effectFn = () => {
    cleanup(effectFn)
    activeEffect = effectFn
    effectStack.push(activeEffect)
    fn()
    effectStack.pop()
    activeEffect = effectStack[effectStack.length - 1]
  }
  effectFn.deps = []
  effectFn()
}

/**
 * 收集依赖
 */
const bucket = new WeakMap()
const track = (target, key) => {
  console.log('track', key)
  if (!activeEffect) return 
  let depsMap = bucket.get(target)
  if (!depsMap) bucket.set(target, (depsMap = new Map()))
  let deps = depsMap.get(key)
  if (!deps) depsMap.set(key, (deps = new Set()))
  deps.add(activeEffect)
  activeEffect.deps.push(deps)
}

/**
 * 触发依赖执行
 */
const trigger = (target, key) => {
  console.log('trigger', key)
  const depsMap = bucket.get(target)
  if (!depsMap) return
  const deps = depsMap.get(key)
  const effectsToRun = new Set(deps)
  effectsToRun.forEach((fn) => fn())
}

/**
 * 代理
 */
const proxy = (data) => new Proxy(data, {
  get(target, key) {
    track(target, key) // 读取属性时收集依赖
    return target[key]
  },
  set(target, key, newVal) {
    target[key] = newVal
    trigger(target, key) // 写入属性时触发依赖执行
  }
})

/**
 * 使用
 */
const proxyData = proxy({ foo: true, bar: true })
let temp
effect(() => {
    console.log('外层执行')
    effect(() => {
        console.log('里层执行')
        temp = proxyData.foo
    })
    temp = proxyData.bar
})

setTimeout(() => {
    proxyData.bar = false
}, 1000)

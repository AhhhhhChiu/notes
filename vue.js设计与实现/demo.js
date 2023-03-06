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
const effect = (fn, options = {}) => {
  const effectFn = () => {
    cleanup(effectFn)
    activeEffect = effectFn
    effectStack.push(activeEffect)
    const res = fn()
    effectStack.pop()
    activeEffect = effectStack[effectStack.length - 1]
    return res
  }
  effectFn.options = options
  effectFn.deps = []
  if (!options.lazy) {
    effectFn()
  }
  return effectFn
}

/**
 * ownKeys 用来收集依赖的键
 */
const ITERATE_KEY = Symbol()


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
const TriggerType = {
  SET: 1,
  ADD: 2,
  DELETE: 3
}
const trigger = (target, key, type) => {
  console.log('trigger', key)
  const depsMap = bucket.get(target)
  if (!depsMap) return
  const deps = depsMap.get(key)
  const effectsToRun = new Set()
  deps && deps.forEach((fn) => {
    if (fn !== activeEffect) {
      effectsToRun.add(fn)
    }
  })
  if (type === TriggerType.ADD || type === TriggerType.DELETE) {
    const iterateEffects = depsMap.get(ITERATE_KEY)
    iterateEffects && iterateEffects.forEach((fn) => {
      if (fn !== activeEffect) {
        effectsToRun.add(fn)
      }
    })
  }
  effectsToRun.forEach((fn) => {
    if (fn.options.scheduler) {
      fn.options.scheduler(fn)
    } else {
      fn()
    }
  })
}

/**
 * 代理
 */
const proxy = (data) => new Proxy(data, {
  get(target, key, receiver) {
    track(target, key) // 读取属性时收集依赖
    return Reflect.get(target, key, receiver)
  },
  set(target, key, newVal, receiver) {
    const oldVal = target[key]
    const type = Object.prototype.hasOwnProperty.call(target, key) ? TriggerType.SET : TriggerType.ADD
    const res = Reflect.set(target, key, newVal, receiver)
    if (oldVal !== newVal && (oldVal === oldVal || newVal === newVal)) { // 新值不等于旧值并且排除重复设置NaN的情况
      trigger(target, key, type) // 写入属性时触发依赖执行
    }
    return res
  },
  has(target, key, receiver) { // 拦截 in 读取
    track(target, key)
    return Reflect.has(target, key, receiver)
  },
  ownKeys(target) { // 拦截 for...in
    track(target, ITERATE_KEY)
    return Reflect.ownKeys(target)
  },
  deleteProperty(target, key) {
    const hadKey = Object.prototype.hasOwnProperty.call(target, key)
    const res = Reflect.deleteProperty(target, key)
    if (hadKey && res) {
      trigger(target, key, TriggerType.DELETE)
    }
    return res
  }
})

/**
 * computed 封装
 */
const computed = (getter) => {
  let value
  let dirty = true
  const effectFn = effect(getter, {
    lazy: true,
    scheduler() {
      dirty = true
      trigger(obj, 'value')
    }
  })

  const obj = {
    get value() {
      if (dirty) {
        value = effectFn()
        dirty = false
      }
      track(obj, 'value')
      return value
    }
  }
  return obj
}

/**
 * watch 封装
 */
const traverse = (data, seen = new Set()) => {
  if (typeof data !== 'object' || data === null || seen.has(data)) return
  seen.add(data)
  for (const key in data) {
    traverse(data[key], seen)
  }
  return data
}
const watch = (data, callback, options) => {
  let oldVal
  let _cleanup
  const onInvalidate = (fn) => {
    _cleanup = fn
  }
  const getter = typeof data === 'function'
    ? data
    : () => traverse(data)
  const job = () => {
    const newVal = effectFn()
    _cleanup?.()
    callback(newVal, oldVal, onInvalidate)
    oldVal = newVal
  }
  const effectFn = effect(getter, {
    scheduler: job
  })
  options?.immediate && job()
}


/**
 * 使用
 */
const proxyData = proxy({ foo: NaN, bar: 1 })
effect(() => {
  console.log(proxyData.foo)
  console.log(proxyData.bar)
})
proxyData.foo = NaN
proxyData.bar = 1

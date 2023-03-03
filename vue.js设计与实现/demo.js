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
  const effectsToRun = new Set()
  deps && deps.forEach((fn) => {
    if (fn !== activeEffect) {
      effectsToRun.add(fn)
    }
  })
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
const watch = (data, callback) => {
  const getter = typeof data === 'function'
    ? data
    : () => traverse(data)
  effect(getter, {
    scheduler() {
      callback()
    }
  })
}


/**
 * 使用
 */
const proxyData = proxy({ foo: 1, bar: 2 })
watch(proxyData, () => {
  console.log('change')
})

setTimeout(() => {
  proxyData.foo = 2
}, 1000)

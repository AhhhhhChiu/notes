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
  if (!activeEffect || !shouldTrack) return 
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
const trigger = (target, key, type, newVal) => {
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
  if (type === TriggerType.ADD && Array.isArray(target)) { // 数组添加新元素时需要重新执行 length 关联的副作用函数
    const lengthEffects = depsMap.get('length')
    lengthEffects && lengthEffects.forEach((fn) => {
      if (fn !== activeEffect) {
        effectsToRun.add(fn)
      }
    })
  }
  if (key === 'length' && Array.isArray(target)) { // length 修改时有可能需要重新触发子项关联的副作用函数
    depsMap.forEach((effects, index) => {
      if (index >= newVal) { // 只有索引值大于等于新长度的子项才需要触发
        effects.forEach((fn) => {
          if (fn !== activeEffect) {
            effectsToRun.add(fn)
          }
        })
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
 * 重写数组方法
 */
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

/**
 * 重写 Set 和 Map 方法
 */
const mutableInstrumentations = {
  add(key) {
    const target = this.raw
    const hasKey = target.has(key)
    const res = target.add(key)
    !hasKey && trigger(target, key, TriggerType.ADD) 
    return res
  },
  delete(key) {
    const target = this.raw
    const hasKey = target.has(key)
    const res = target.delete(key)
    hasKey && trigger(target, key, TriggerType.DELETE) 
    return res
  },
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
    const rawValue = value.raw || value // 避免将 value 原封不动设置到原始数据上
    target.set(key, rawValue)
    if (!hasKey) {
      trigger(target, key, TriggerType.ADD)
    } else if (oldVal !== value || (oldVal === oldVal && value === value)) {
      trigger(target, key, TriggerType.SET) 
    }
  }
}

/**
 * 代理
 */
const createReactive = (data, isShallow, isReadonly) => new Proxy(data, {
  get(target, key, receiver) {
    if (key === 'raw') {
      return target
    }
    // 书中并没有提到如何融合进 reactive，大概是这样?
    const type = Object.prototype.toString.call(target).match(/^\[object (.*)\]$/)[1].toLowerCase()
    if (type === 'set' || type === 'map') {
      if (key === 'size') {
        track(target, ITERATE_KEY)
        return Reflect.get(target, key, target)
      }
      return mutableInstrumentations[key]
    }
    if (Array.isArray(target) && arrayInstrumentations.hasOwnProperty(key)) {
      return Reflect.get(arrayInstrumentations, key, receiver)
    }
    const res = Reflect.get(target, key, receiver)
    if (!isReadonly && typeof key !== 'symbol') {
      track(target, key) // 读取属性时收集依赖
    }
    if (isShallow) {
      return res
    }
    if (typeof res === 'object' && res !== null) {
      return isReadonly ? readonly(res) : reactive(res)
    }
    return res
  },
  set(target, key, newVal, receiver) {
    if (isReadonly) {
      console.warn(`属性${key}是只读的`)
      return true
    }
    const oldVal = target[key]
    const type = Array.isArray
      ? Number(key) < target.length ? TriggerType.SET : TriggerType.ADD
      : Object.prototype.hasOwnProperty.call(target, key) ? TriggerType.SET : TriggerType.ADD
    const res = Reflect.set(target, key, newVal, receiver)
    if (target === receiver.raw) {
      if (oldVal !== newVal && (oldVal === oldVal || newVal === newVal)) { // 新值不等于旧值并且排除重复设置NaN的情况
        trigger(target, key, type, newVal) // 写入属性时触发依赖执行
      }
    }
    return res
  },
  has(target, key, receiver) { // 拦截 in 读取
    track(target, key)
    return Reflect.has(target, key, receiver)
  },
  ownKeys(target) { // 拦截 for...in
    track(target, Array.isArray(target) ? 'length' : ITERATE_KEY)
    return Reflect.ownKeys(target)
  },
  deleteProperty(target, key) {
    if (isReadonly) {
      console.warn(`属性${key}是只读的`)
      return true
    }
    const hadKey = Object.prototype.hasOwnProperty.call(target, key)
    const res = Reflect.deleteProperty(target, key)
    if (hadKey && res) {
      trigger(target, key, TriggerType.DELETE)
    }
    return res
  }
})

/**
 * 深响应和浅响应封装
 */
const reactiveMap = new Map()
const reactive = (obj) => {
  const existedProxy = reactiveMap.get(obj)
  if (existedProxy) return existedProxy
  const res = createReactive(obj)
  reactiveMap.set(obj, res)
  return res
}
const shallowReactive = (obj) => createReactive(obj, true)

/**
 * 深只读和浅只读封装
 */
const readonly = (obj) => createReactive(obj, false, true)
const shallowReadonly = (obj) => createReactive(obj, true, true)

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
const m = new Map()
const p1 = reactive(m)
const p2 = reactive(new Map())

p1.set('p2', p2)
console.log('---')
effect(() => {
  console.log(m.get('p2').size)
})
console.log('---')
m.get('p2').set('foo', 1)

/**
 * 注册副作用函数
 */
let activeEffect
const effect = (fn) => {
  activeEffect = fn
  fn()
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
}

/**
 * 触发依赖执行
 */
const trigger = (target, key) => {
  console.log('trigger', key)
  const depsMap = bucket.get(target)
  if (!depsMap) return
  const deps = depsMap.get(key)
  deps && deps.forEach((fn) => fn())
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
const obj = proxy({ foo: 1 })
effect(() => {
  console.log('effect')
})

obj.foo
obj.foo = 2

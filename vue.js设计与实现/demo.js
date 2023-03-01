// 注册副作用函数
let activeEffect
const effect = (fn) => {
  activeEffect = fn
  fn()
}

// 收集依赖的桶
const bucket = new Set()

// 代理
const proxy = (data) => new Proxy(data, {
  get(target, key) {
    console.log('get', key)
    activeEffect && bucket.add(activeEffect) // 读取属性时收集依赖
    return target[key]
  },
  set(target, key, newVal) {
    console.log('set', key)
    target[key] = newVal
    bucket.forEach((fn) => fn()) // 写入属性时触发依赖执行
    return true
  }
})

// 使用
const obj = proxy({ foo: 1 })
effect(() => {
  console.log('effect')
})

obj.foo
obj.foo = 2

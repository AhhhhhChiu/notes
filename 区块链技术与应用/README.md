# 区块链技术与应用

## BTC 密码学原理

比特币被称为加密货币(crypto-currency)，区块链上内容都是公开的，包括区块的地址，转账的金额。

比特币主要用到了密码学中的两个功能: 1.哈希 2.签名

### 哈希

密码学中用到的哈希函数被称为cryptographic hash function，它有两个重要的性质：

1. collision resistance
2. hiding/one-way

除了密码学中要求的这两个性质外，比特币中用到的哈希函数还有第三个性质

3. puzzle friendly

找到一篇解释得不错的文章，感觉不需要重复写笔记 [https://zhuanlan.zhihu.com/p/139310385?ivk_sa=1024320u](https://zhuanlan.zhihu.com/p/139310385?ivk_sa=1024320u)

### 签名

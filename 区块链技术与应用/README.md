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

找到一篇解释得不错的文章，感觉不需要重复写笔记 [哈希函数的五大特性
](https://zhuanlan.zhihu.com/p/139310385?ivk_sa=1024320u)

### 签名

在本地创建一个公私钥对(public key & private key)就是开户，公私钥匙对来自于非对称的加密技术(asymmetric encryption algorithm [HTTPS原理全解析 3:50~6:32](https://www.bilibili.com/video/BV1w4411m7GL/?share_source=copy_web&vd_source=d486fb505db260f8763f22d27b81101a))。

A如果想发起一笔转账，会用自己的私钥进行签名，他人只需要用A公开的公钥去进行验证，就可以知道这次转账记录是否合法有效。

## BTC 数据结构

### 区块链

比特币中最基本的结构就是区块链，区块链就是一个一个区块组成的链表。区块链和普通的链表相比有什么区别：

1. 用哈希指针代替了普通指针(Block chain is a linked list using hash pointers)

2. 普通链表可以改变任意一个元素，对链表中其他元素是没有影响的。而区块链是牵一发而动全身，因为只需要保存最后一个哈希值，就可以判断区块链有没有改变，在哪里改变了。


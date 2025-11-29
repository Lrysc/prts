// 测试官方格式
const officialSample = {
  "1757053681.497": {
    "p": "人偶的歌谣",
    "pi": "LINKAGE_65_0_1",
    "c": [["香草", 2, 0], ["安赛尔", 2, 0], ["三角初华", 4, 1], ["芙蓉", 2, 0], ["深靛", 3, 0], ["松果", 3, 0], ["史都华德", 2, 0], ["克洛丝", 2, 0], ["阿消", 3, 0], ["米格鲁", 2, 0]],
    "cn": "梦中舞会\n人偶寻访",
    "ci": "mujica",
    "pos": 9
  }
};

console.log('官方格式示例:', JSON.stringify(officialSample, null, 2));

// 检查时间戳格式
const timestamp = "1757053681.497";
console.log('时间戳类型:', typeof timestamp);
console.log('时间戳值:', timestamp);
console.log('转换为数字:', parseFloat(timestamp));
console.log('是否大于1e12:', parseFloat(timestamp) > 1000000000000);
console.log('是否大于1e9:', parseFloat(timestamp) > 1000000000);
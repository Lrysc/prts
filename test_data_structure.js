// 测试不同的数据结构

// 情况1：API返回的是单个角色记录（我们的当前实现）
const singleRecords = {
  categories: [{
    categoryInfo: {
      name: "梦中舞会\n人偶寻访",
      id: "LINKAGE_65_0_1"
    },
    mergedData: {
      data: {
        list: [
          { gachaTs: "1757053681", charName: "香草", rarity: 2, isNew: false, pos: 9 },
          { gachaTs: "1757053682", charName: "安赛尔", rarity: 2, isNew: false, pos: 10 },
          { gachaTs: "1757053683", charName: "三角初华", rarity: 4, isNew: true, pos: 11 }
        ]
      }
    }
  }]
};

// 情况2：API返回的是十连抽记录（官方格式）
const tenPullRecords = {
  categories: [{
    categoryInfo: {
      name: "梦中舞会\n人偶寻访", 
      id: "LINKAGE_65_0_1"
    },
    mergedData: {
      data: {
        list: [
          // 一次十连抽，所有记录有相同时间戳
          { gachaTs: "1757053681", charName: "香草", rarity: 2, isNew: false, pos: 9 },
          { gachaTs: "1757053681", charName: "安赛尔", rarity: 2, isNew: false, pos: 9 },
          { gachaTs: "1757053681", charName: "三角初华", rarity: 4, isNew: true, pos: 9 },
          { gachaTs: "1757053681", charName: "芙蓉", rarity: 2, isNew: false, pos: 9 },
          { gachaTs: "1757053681", charName: "深靛", rarity: 3, isNew: false, pos: 9 },
          { gachaTs: "1757053681", charName: "松果", rarity: 3, isNew: false, pos: 9 },
          { gachaTs: "1757053681", charName: "史都华德", rarity: 2, isNew: false, pos: 9 },
          { gachaTs: "1757053681", charName: "克洛丝", rarity: 2, isNew: false, pos: 9 },
          { gachaTs: "1757053681", charName: "阿消", rarity: 3, isNew: false, pos: 9 },
          { gachaTs: "1757053681", charName: "米格鲁", rarity: 2, isNew: false, pos: 9 },
          // 另一次十连抽
          { gachaTs: "1757053766", charName: "缠丸", rarity: 3, isNew: false, pos: 19 },
          { gachaTs: "1757053766", charName: "芬", rarity: 2, isNew: false, pos: 19 }
        ]
      }
    }
  }]
};

function convertToOfficialFormat(rawDataExport) {
  const officialData = {};

  rawDataExport.categories.forEach((category) => {
    if (category.mergedData && category.mergedData.data && category.mergedData.data.list) {
      const recordsByTimestamp = new Map();
      
      category.mergedData.data.list.forEach((record) => {
        const timestamp = record.gachaTs;
        if (!recordsByTimestamp.has(timestamp)) {
          recordsByTimestamp.set(timestamp, []);
        }
        recordsByTimestamp.get(timestamp).push(record);
      });

      recordsByTimestamp.forEach((records, timestamp) => {
        let ts = parseFloat(timestamp);
        
        if (ts > 1000000000000) {
          ts = ts / 1000;
        }
        
        const timestampStr = ts.toString();
        const poolName = category.categoryInfo.name;
        
        const characters = [];
        records.forEach(record => {
          if (record.charName) {
            characters.push([record.charName, record.rarity, record.isNew ? 1 : 0]);
          }
        });

        officialData[timestampStr] = {
          p: poolName.replace('\\r\\n', ''),
          pi: category.categoryInfo.id || '',
          c: characters,
          cn: poolName,
          ci: category.categoryInfo.id || '',
          pos: records[0]?.pos || 0
        };
      });
    }
  });

  return officialData;
}

console.log('=== 单个记录测试 ===');
const result1 = convertToOfficialFormat(singleRecords);
console.log(JSON.stringify(result1, null, 2));

console.log('\n=== 十连抽记录测试 ===');
const result2 = convertToOfficialFormat(tenPullRecords);
console.log(JSON.stringify(result2, null, 2));

console.log('\n=== 十连抽紧凑格式 ===');
console.log(JSON.stringify(result2));
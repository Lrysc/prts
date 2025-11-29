// 调试导出功能的实际数据

// 模拟从API获取的实际数据结构
const mockApiData = {
  categories: [{
    categoryInfo: {
      name: "梦中舞会\n人偶寻访",
      id: "LINKAGE_65_0_1"
    },
    mergedData: {
      data: {
        list: [
          // 这些可能是API实际返回的数据：单个角色记录
          { gachaTs: "1757053681.497", charName: "香草", rarity: 2, isNew: false, pos: 9, poolId: "LINKAGE_65_0_1", poolName: "人偶的歌谣" },
          { gachaTs: "1757053681.497", charName: "安赛尔", rarity: 2, isNew: false, pos: 9, poolId: "LINKAGE_65_0_1", poolName: "人偶的歌谣" },
          { gachaTs: "1757053681.497", charName: "三角初华", rarity: 4, isNew: true, pos: 9, poolId: "LINKAGE_65_0_1", poolName: "人偶的歌谣" },
          { gachaTs: "1757053681.497", charName: "芙蓉", rarity: 2, isNew: false, pos: 9, poolId: "LINKAGE_65_0_1", poolName: "人偶的歌谣" },
          { gachaTs: "1757053681.497", charName: "深靛", rarity: 3, isNew: false, pos: 9, poolId: "LINKAGE_65_0_1", poolName: "人偶的歌谣" },
          { gachaTs: "1757053681.497", charName: "松果", rarity: 3, isNew: false, pos: 9, poolId: "LINKAGE_65_0_1", poolName: "人偶的歌谣" },
          { gachaTs: "1757053681.497", charName: "史都华德", rarity: 2, isNew: false, pos: 9, poolId: "LINKAGE_65_0_1", poolName: "人偶的歌谣" },
          { gachaTs: "1757053681.497", charName: "克洛丝", rarity: 2, isNew: false, pos: 9, poolId: "LINKAGE_65_0_1", poolName: "人偶的歌谣" },
          { gachaTs: "1757053681.497", charName: "阿消", rarity: 3, isNew: false, pos: 9, poolId: "LINKAGE_65_0_1", poolName: "人偶的歌谣" },
          { gachaTs: "1757053681.497", charName: "米格鲁", rarity: 2, isNew: false, pos: 9, poolId: "LINKAGE_65_0_1", poolName: "人偶的歌谣" },
          // 下一抽
          { gachaTs: "1757053766.954", charName: "缠丸", rarity: 3, isNew: false, pos: 19, poolId: "LINKAGE_65_0_1", poolName: "人偶的歌谣" },
          { gachaTs: "1757053766.954", charName: "芬", rarity: 2, isNew: false, pos: 19, poolId: "LINKAGE_65_0_1", poolName: "人偶的歌谣" }
        ]
      }
    }
  }]
};

// 根据poolId映射到ci字段
const mapPoolIdToCi = (poolId) => {
  if (!poolId) return '';
  
  if (poolId.startsWith('LINKAGE_')) {
    return 'mujica';
  } else if (poolId.startsWith('SINGLE_') || poolId.startsWith('NORM_') || poolId.startsWith('SPECIAL_')) {
    return 'normal';
  } else if (poolId.startsWith('LIMITED_')) {
    return 'anniver_fest';
  } else if (poolId.startsWith('CLASSIC_') || poolId.startsWith('FESCLASSIC_')) {
    return 'classic';
  } else if (poolId.startsWith('CLASSIC_DOUBLE_')) {
    return 'classic';
  }
  
  return poolId.length > 6 ? poolId.substring(0, 6) : poolId;
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

        // 按官方顺序创建记录对象：p, pi, c, cn, ci, pos
        const record = {};
        record.p = records[0]?.poolName || poolName.replace('\\r\\n', ''); // p字段使用实际的poolName
        record.pi = records[0]?.poolId || category.categoryInfo.id || ''; // pi字段使用实际的poolId
        record.c = characters;
        record.cn = poolName;
        record.ci = mapPoolIdToCi(records[0]?.poolId || category.categoryInfo.id || '');
        record.pos = records[0]?.pos || 0;
        
        officialData[timestampStr] = record;
      });
    }
  });

  return officialData;
}

console.log('=== 模拟API数据转换结果 ===');
const result = convertToOfficialFormat(mockApiData);
console.log(JSON.stringify(result));

console.log('\n=== 与官方格式对比 ===');
const officialSample = {"1757053681.497":{"p":"人偶的歌谣","pi":"LINKAGE_65_0_1","c":[["香草",2,0],["安赛尔",2,0],["三角初华",4,1],["芙蓉",2,0],["深靛",3,0],["松果",3,0],["史都华德",2,0],["克洛丝",2,0],["阿消",3,0],["米格鲁",2,0]],"cn":"梦中舞会\n人偶寻访","ci":"mujica","pos":9}};

console.log('我们的结果第一个键:', Object.keys(result)[0]);
console.log('官方样本第一个键:', Object.keys(officialSample)[0]);
console.log('键相同:', Object.keys(result)[0] === Object.keys(officialSample)[0]);

const ourFirst = result[Object.keys(result)[0]];
const officialFirst = officialSample[Object.keys(officialSample)[0]];

console.log('p字段相同:', ourFirst.p === officialFirst.p);
console.log('pi字段相同:', ourFirst.pi === officialFirst.pi);
console.log('c字段长度相同:', ourFirst.c.length === officialFirst.c.length);
console.log('cn字段相同:', ourFirst.cn === officialFirst.cn);
console.log('ci字段相同:', ourFirst.ci === officialFirst.ci);
console.log('pos字段相同:', ourFirst.pos === officialFirst.pos);
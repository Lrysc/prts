// 测试官方格式生成
function testOfficialFormat() {
  // 模拟我们的数据结构
  const rawDataExport = {
    categories: [{
      categoryInfo: {
        name: "梦中舞会\n人偶寻访",
        id: "LINKAGE_65_0_1"
      },
      mergedData: {
        data: {
          list: [
            // 模拟十连抽的10个记录，应该有相同的时间戳
            { gachaTs: "1757053681.497", charName: "香草", rarity: 2, isNew: false, pos: 9 },
            { gachaTs: "1757053681.497", charName: "安赛尔", rarity: 2, isNew: false, pos: 9 },
            { gachaTs: "1757053681.497", charName: "三角初华", rarity: 4, isNew: true, pos: 9 },
            { gachaTs: "1757053681.497", charName: "芙蓉", rarity: 2, isNew: false, pos: 9 },
            { gachaTs: "1757053681.497", charName: "深靛", rarity: 3, isNew: false, pos: 9 },
            { gachaTs: "1757053681.497", charName: "松果", rarity: 3, isNew: false, pos: 9 },
            { gachaTs: "1757053681.497", charName: "史都华德", rarity: 2, isNew: false, pos: 9 },
            { gachaTs: "1757053681.497", charName: "克洛丝", rarity: 2, isNew: false, pos: 9 },
            { gachaTs: "1757053681.497", charName: "阿消", rarity: 3, isNew: false, pos: 9 },
            { gachaTs: "1757053681.497", charName: "米格鲁", rarity: 2, isNew: false, pos: 9 }
          ]
        }
      }
    }]
  };

  // 模拟转换函数
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

  const result = convertToOfficialFormat(rawDataExport);
  console.log('生成的官方格式:');
  console.log(JSON.stringify(result, null, 2));
  
  // 验证关键属性
  const firstKey = Object.keys(result)[0];
  const firstRecord = result[firstKey];
  
  console.log('\n验证结果:');
  console.log('时间戳键:', firstKey);
  console.log('时间戳类型:', typeof firstKey);
  console.log('p字段:', firstRecord.p);
  console.log('c字段长度:', firstRecord.c.length);
  console.log('cn字段:', JSON.stringify(firstRecord.cn));
  console.log('pos字段:', firstRecord.pos);
}

testOfficialFormat();
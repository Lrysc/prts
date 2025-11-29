const fs = require('fs');

const content = fs.readFileSync('1764351379886_official_19371587_gacha.json', 'utf8');
const data = JSON.parse(content);

console.log('=== pi 和 ci 字段映射关系 ===');
const piToCi = new Map();

Object.values(data).forEach(record => {
  if (!piToCi.has(record.pi)) {
    piToCi.set(record.pi, record.ci);
  }
});

piToCi.forEach((ci, pi) => {
  console.log(`pi: ${pi} -> ci: ${ci}`);
});

console.log('\n=== 检查是否有规律 ===');
// 看看ci是否是pi的某种简化
piToCi.forEach((ci, pi) => {
  console.log(`${pi} -> ${ci} (长度: ${pi.length} -> ${ci.length})`);
});
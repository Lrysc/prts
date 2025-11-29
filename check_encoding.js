const fs = require('fs');

const content = fs.readFileSync('1764351379886_official_19371587_gacha.json', 'utf8');
console.log('前100个字符:', content.substring(0, 100));
console.log('包含梦中舞会:', content.includes('梦中舞会'));
console.log('包含换行符:', content.includes('\\n'));

// 解析并重新生成
const parsed = JSON.parse(content);
const regenerated = JSON.stringify(parsed);
console.log('重新生成的长度:', regenerated.length);
console.log('原始长度:', content.length);
console.log('长度相同:', regenerated.length === content.length);
// 测试映射函数
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

console.log('测试映射函数:');
console.log('LINKAGE_65_0_1 ->', mapPoolIdToCi('LINKAGE_65_0_1'));
console.log('SINGLE_66_0_1 ->', mapPoolIdToCi('SINGLE_66_0_1'));
console.log('LIMITED_67_0_1 ->', mapPoolIdToCi('LIMITED_67_0_1'));
console.log('CLASSIC_DOUBLE_66_0_2 ->', mapPoolIdToCi('CLASSIC_DOUBLE_66_0_2'));
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { AuthAPI } from '@services/api';
import { useAuthStore } from '@stores/auth';

/**
 * 游戏数据状态管理Store
 * 负责玩家游戏数据的获取、缓存和状态管理
 * 包含理智计算、任务进度、基建状态等核心功能
 */
export const useGameDataStore = defineStore('gameData', () => {
  // ========== 状态定义 ==========

  /**
   * 数据加载状态
   * true: 正在加载数据
   * false: 数据加载完成
   */
  const isLoading = ref(true);

  /**
   * 错误消息
   * 空字符串: 无错误
   * 非空字符串: 显示错误信息
   */
  const errorMsg = ref('');

  /**
   * 玩家游戏数据
   * 从森空岛API获取的完整玩家数据
   * 包含角色、基建、任务等所有游戏信息
   */
  const playerData = ref<any>(null);

  /**
   * 数据刷新状态
   * true: 正在刷新数据
   * false: 刷新完成
   */
  const isRefreshing = ref(false);

  /**
   * 最后更新时间戳
   * 记录数据最后一次成功获取的时间
   * 用于显示"最后更新"信息
   */
  const lastUpdateTime = ref<number>(0);

  /**
   * 当前时间戳（秒级）
   * 用于实时计算理智恢复、任务刷新等时间相关功能
   */
  const currentTime = ref<number>(Math.floor(Date.now() / 1000));

  // ========== 缓存配置 ==========

  /**
   * 缓存持续时间（5分钟）
   * 在此期间内不会重复请求API，使用缓存数据
   */
  const CACHE_DURATION = 5 * 60 * 1000;

  /**
   * 数据缓存对象
   * 存储玩家数据和缓存时间戳，减少API请求频率
   */
  const dataCache = ref<{ data: any; timestamp: number } | null>(null);

  // ========== 依赖注入 ==========

  /**
   * 认证Store实例
   * 用于获取登录状态、用户凭证等认证信息
   */
  const authStore = useAuthStore();

  // ========== 定时器 ==========

  /**
   * 时间更新定时器
   * 每秒更新一次当前时间，确保时间相关计算准确
   */
  let timeUpdateInterval: NodeJS.Timeout | null = null;

  // ========== 工具函数 ==========

  /**
   * 获取当前最新时间戳（秒级）
   * @returns 当前时间戳（秒）
   */
  const getCurrentTimestamp = () => {
    return currentTime.value;
  };

  /**
   * 格式化时间戳为本地日期时间
   * @param ts - 时间戳（秒级）
   * @returns 格式化的日期时间字符串
   */
  const formatTimestamp = (ts?: number) => {
    if (!ts) return '未知';
    return new Date(ts * 1000).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  /**
   * 计算实际理智数值 - 基于Kotlin代码逻辑
   * 根据恢复时间动态计算当前实际理智值
   * @param apData - 理智数据对象
   * @returns 包含当前理智、最大理智、剩余恢复时间等信息的对象
   */
  const calculateActualAp = (apData: any) => {
    if (!apData) return { current: 0, max: 0, remainSecs: -1, recoverTime: -1 };

    const currentTs = getCurrentTimestamp();
    const max = apData.max || 130;
    const current = apData.current || 0;
    const completeRecoveryTime = apData.completeRecoveryTime || 0;

    // 基于Kotlin代码的逻辑
    if (current >= max) {
      return {
        current: current,
        max: max,
        remainSecs: -1,
        recoverTime: -1
      };
    }

    if (completeRecoveryTime < currentTs) {
      return {
        current: max,
        max: max,
        remainSecs: -1,
        recoverTime: -1
      };
    }

    // 计算实际当前理智：最大理智 - (剩余恢复时间 / 6分钟 + 1)
    const actualCurrent = max - Math.floor((completeRecoveryTime - currentTs) / (60 * 6) + 1);
    const remainSecs = completeRecoveryTime - currentTs;

    return {
      current: Math.max(0, actualCurrent),
      max: max,
      remainSecs: remainSecs,
      recoverTime: completeRecoveryTime
    };
  };

  /**
   * 格式化理智恢复时间
   * 将秒数转换为易读的时间格式
   * @param recoveryTs - 恢复完成时间戳（秒级）
   * @returns 格式化的时间字符串（如"2小时30分钟"）
   */
  const formatRecoveryTime = (recoveryTs?: number) => {
    if (!recoveryTs || recoveryTs <= 0) return '已回满';
    const now = getCurrentTimestamp();
    const diff = recoveryTs - now;

    if (diff <= 0) return '已回满';

    const hours = Math.floor(diff / 3600);
    const minutes = Math.floor((diff % 3600) / 60);

    if (hours > 0) return `${hours}小时${minutes}分钟`;
    return `${minutes}分钟`;
  };

  /**
   * 格式化任务进度（已完成/总数）
   * 根据实际数据结构使用 current/total 字段
   */
  const formatTaskProgress = (task?: any) => {
    if (!task) return '0/0';

    console.log('任务数据详情:', task);

    // 根据实际数据结构，使用 current/total 字段
    let completed = task.current || 0;
    let total = task.total || 0;

    console.log(`任务进度计算: ${completed}/${total}`);
    return `${completed}/${total}`;
  };

  // ========== 计算属性 ==========

  /**
   * 获取干员总数
   * 通过遍历chars数组计算拥有的干员数量
   */
  const getCharCount = computed(() => {
    return playerData.value?.chars?.length || 0;
  });

  /**
   * 获取作战进度显示
   * 根据API文档：全通关时mainStageProgress返回空，其他情况显示最新抵达的关卡
   */
  const getMainStageProgress = computed(() => {
    const status = playerData.value?.status;
    if (!status) return '未知';

    // 如果mainStageProgress为空字符串，表示全通关
    if (status.mainStageProgress === '') {
      return '全部完成';
    }

    // 如果mainStageProgress有值，显示具体的关卡进度
    if (status.mainStageProgress && typeof status.mainStageProgress === 'string') {
      return status.mainStageProgress.trim();
    }

    // 最后回退到默认值
    return '未通关主线';
  });

  /**
   * 获取公开招募刷新次数
   * 显示当前刷新次数和最大次数（0/3）
   */
  const getHireRefreshCount = computed(() => {
    const refreshCount = playerData.value?.building?.hire?.refreshCount || 0;
    return `${refreshCount}/3`;
  });

  /**
   * 获取公开招募位置数量
   * 计算正在招募的位置和总位置数（如"2/4"）
   */
  const getHireSlotCount = computed(() => {
    const slots = playerData.value?.building?.hire?.slots;
    if (!Array.isArray(slots)) return '0/4';

    const totalSlots = slots.length;
    const activeSlots = slots.filter(slot => slot.state === 1).length; // state=1表示正在招募
    return `${activeSlots}/${totalSlots}`;
  });

  /**
   * 获取会客室线索总数
   * 会客室最多可以存放7个线索
   * 尝试多种数据路径获取线索数量
   */
  const getClueCount = computed(() => {
    const clueBoard = playerData.value?.building?.meeting?.clue?.board;
    const meetingRoom = playerData.value?.building?.meeting;

    let clueCount = 0;

    // 尝试不同的数据路径获取线索数量
    if (Array.isArray(clueBoard)) {
      clueCount = clueBoard.reduce((total: number, clue: any) => total + (clue.count || 0), 0);
    } else if (meetingRoom?.ownClues && Array.isArray(meetingRoom.ownClues)) {
      clueCount = meetingRoom.ownClues.length;
    } else if (meetingRoom?.clue?.own && Array.isArray(meetingRoom.clue.own)) {
      clueCount = meetingRoom.clue.own.length;
    }

    // 会客室最多7个线索位置
    return `${clueCount}/7`;
  });

  /**
   * 获取制造站运行状态和货物数量
   * 根据 remain 字段计算已制造的货物数量
   */
  const getManufactureStatus = computed(() => {
    const manufactures = playerData.value?.building?.manufactures;

    // 移除所有 console.log 调试语句
    if (!manufactures || !Array.isArray(manufactures) || manufactures.length === 0) return '0 货物 | 0/0 运行中';

    // 计算总已制造货物数量
    const totalManufactured = manufactures.reduce((total, mfg) => {
      const remain = mfg.remain || 0;
      return total + (99 - remain);
    }, 0);

    // 计算运行中的制造站数量
    const totalStations = manufactures.length;
    const activeStations = manufactures.filter((mfg: any) => {
      return mfg.completeWorkTime > getCurrentTimestamp();
    }).length;

    return `${totalManufactured} 货物 | ${activeStations}/${totalStations} 运行中`;
  });

  /**
   * 获取贸易站订单数量
   * 根据实际数据结构计算总订单上限和当前订单数量
   */
  const getTradingOrderCount = computed(() => {
    const tradings = playerData.value?.building?.tradings;
    console.log('=== 贸易站数据调试 ===');
    console.log('贸易站数组:', tradings);

    if (!tradings || !Array.isArray(tradings)) return '0/0 订单';

    let totalStockLimit = 0;  // 总订单上限
    let totalCurrentStock = 0; // 当前订单数量

    tradings.forEach((trading: any, index: number) => {
      console.log(`贸易站 ${index + 1}:`, trading);

      // 订单上限
      const stockLimit = trading.stockLimit || 0;
      // 当前订单数量（stock数组的长度）
      const currentStock = Array.isArray(trading.stock) ? trading.stock.length : 0;

      console.log(`贸易站 ${index + 1} - 上限: ${stockLimit}, 当前: ${currentStock}`);

      totalStockLimit += stockLimit;
      totalCurrentStock += currentStock;
    });

    console.log(`贸易站总计 - 上限: ${totalStockLimit}, 当前: ${totalCurrentStock}`);

    return `${totalCurrentStock}/${totalStockLimit} 订单`;
  });

  /**
   * 获取无人机数量和恢复时间
   * 显示当前无人机数量/最大值，以及恢复时间
   */
  const getLaborCount = computed(() => {
    const labor = playerData.value?.building?.labor;
    const current = labor?.value || labor?.count || labor?.current || 0;
    const max = labor?.maxValue || labor?.max || 0;
    const remainSecs = labor?.remainSecs || 0;

    // 格式化恢复时间
    const recoveryTime = formatRecoveryTimeFromSeconds(remainSecs);

    return {
      count: `${current}/${max}`,
      recovery: remainSecs > 0 ? recoveryTime : '已回满',
      remainSecs: remainSecs
    };
  });

  /**
   * 从秒数格式化恢复时间
   * 将秒数转换为易读的时间格式（小时和分钟）
   * @param seconds - 剩余秒数
   * @returns 格式化的时间字符串
   */
  const formatRecoveryTimeFromSeconds = (seconds: number) => {
    if (!seconds || seconds <= 0) return '已回满';

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) return `${hours}小时${minutes}分钟`;
    return `${minutes}分钟`;
  };

  /**
   * 获取宿舍休息人数
   * 计算所有宿舍中正在休息的干员总数
   * 宿舍休息人数上限为15人
   */
  const getDormRestCount = computed(() => {
    const dormitories = playerData.value?.building?.dormitories;
    if (!dormitories || !Array.isArray(dormitories)) return '0/15';

    // 计算所有宿舍休息人数总和
    const totalResting = dormitories.reduce((total: number, dorm: any) => {
      // 尝试不同的字段名获取休息人数
      const restCount = dorm.restCount || dorm.chars?.length || dorm.characterCount || 0;
      return total + restCount;
    }, 0);

    // 确保不超过上限15人
    const actualResting = Math.min(totalResting, 15);

    return `${actualResting}/15`;
  });

  /**
   * 获取训练室状态
   * 计算正在训练的干员数量和总数
   */
  const getTrainingStatus = computed(() => {
    const trainees = playerData.value?.building?.training?.trainee;
    if (!trainees || !Array.isArray(trainees) || trainees.length === 0) return '0/0 训练中';

    const activeCount = trainees.filter((t: any) => t.completeTime > getCurrentTimestamp()).length;
    return `${activeCount}/${trainees.length} 训练中`;
  });

  /**
   * 获取助战干员数量
   * 获取设置的助战干员总数
   */
  const getAssistCharCount = computed(() => {
    return playerData.value?.assistChars?.length || 0;
  });

  /**
   * 获取收藏品数量（肉鸽）
   * 获取集成战略模式中的收藏品数量
   */
  const getRelicCount = computed(() => {
    return playerData.value?.rogue?.relicCnt || 0;
  });

  /**
   * 获取实际理智信息
   * 使用calculateActualAp计算当前的实时理智状态
   */
  const getActualApInfo = computed(() => {
    const apData = playerData.value?.status?.ap;
    return calculateActualAp(apData);
  });

  /**
   * 获取疲劳干员数量
   * 获取基建中处于疲劳状态的干员数量
   */
  const getTiredCharsCount = computed(() => {
    return playerData.value?.building?.tiredChars?.length || 0;
  });

  /**
   * 获取剿灭作战合成玉进度
   * 显示当前已获得的合成玉和总可获得合成玉
   */
  const getCampaignReward = computed(() => {
    const reward = playerData.value?.campaign?.reward;
    return `${reward?.current || 0}/${reward?.total || 0}`;
  });

  /**
   * 获取数据增补仪进度
   * 显示保全派驻模式中数据增补仪的当前进度
   */
  const getTowerLowerItem = computed(() => {
    const lowerItem = playerData.value?.tower?.reward?.lowerItem;
    return `${lowerItem?.current || 0}/${lowerItem?.total || 0}`;
  });

  /**
   * 获取数据增补条进度
   * 显示保全派驻模式中数据增补条的当前进度
   */
  const getTowerHigherItem = computed(() => {
    const higherItem = playerData.value?.tower?.reward?.higherItem;
    return `${higherItem?.current || 0}/${higherItem?.total || 0}`;
  });

  /**
   * 获取每日任务进度
   * 格式化显示每日任务的完成进度
   */
  const getDailyTaskProgress = computed(() => {
    const daily = playerData.value?.routine?.daily;
    return formatTaskProgress(daily);
  });

  /**
   * 获取每周任务进度
   * 格式化显示每周任务的完成进度
   */
  const getWeeklyTaskProgress = computed(() => {
    const weekly = playerData.value?.routine?.weekly;
    return formatTaskProgress(weekly);
  });

  // ========== 调试功能 ==========

  /**
   * 调试数据函数
   * 在控制台输出完整的玩家数据，用于调试和分析数据结构
   */
  const debugData = () => {
    console.log('=== 完整玩家数据 ===', playerData.value);
    console.log('=== 任务数据 ===', playerData.value?.routine);
    console.log('=== 基建数据 ===', playerData.value?.building);
    console.log('=== 宿舍数据 ===', playerData.value?.building?.dormitories);
    console.log('=== 会客室数据 ===', playerData.value?.building?.meeting);
    console.log('=== 无人机数据 ===', playerData.value?.building?.labor);
    console.log('=== 贸易站数据 ===', playerData.value?.building?.tradings);
    console.log('=== 制造站数据 ===', playerData.value?.building?.manufactures);
    console.log('=== 公招数据 ===', playerData.value?.building?.hire);
    // console.log('=== 训练室数据 ===', playerData.value?.building?.training.trainee && playerData.value?.building?.training.trainer);
  };

  // ========== 核心方法 ==========

  /**
   * 加载游戏数据核心方法
   * 处理数据缓存、API请求、错误处理等完整的数据加载流程
   * @param refresh - 是否强制刷新（忽略缓存）
   */
  const fetchGameData = async (refresh = false) => {
    // 检查缓存（非强制刷新时）
    if (!refresh && dataCache.value && dataCache.value.data) {
      const currentMs = Date.now();
      const cacheAge = currentMs - dataCache.value.timestamp;
      if (cacheAge < CACHE_DURATION) {
        console.log('使用缓存数据，缓存年龄:', Math.floor(cacheAge / 1000), '秒');
        playerData.value = dataCache.value.data;
        lastUpdateTime.value = currentMs;
        isLoading.value = false;
        debugData();
        return;
      }
    }

    // 设置加载状态
    if (refresh) {
      isRefreshing.value = true;
    } else {
      isLoading.value = true;
    }
    errorMsg.value = '';

    try {
      console.log('开始加载游戏数据...');

      // 1. 检查登录状态，未登录则抛出错误
      if (!authStore.isLogin) {
        throw new Error('请先登录账号');
      }

      console.log('用户已登录，检查绑定角色...');

      // 2. 检查绑定角色，无角色则获取角色列表
      if (!authStore.bindingRoles || authStore.bindingRoles.length === 0) {
        console.log('没有绑定角色，正在获取...');
        await authStore.fetchBindingRoles();
      }

      console.log(`当前绑定角色数量: ${authStore.bindingRoles.length}`);

      // 3. 获取默认角色
      const targetRole = authStore.bindingRoles.find((role: any) => role.isDefault) || authStore.bindingRoles[0];

      if (!targetRole) {
        throw new Error('未找到绑定的游戏角色');
      }

      console.log(`使用角色: ${targetRole.nickName} (${targetRole.uid})`);

      // 4. 调用API获取玩家详细数据
      const data = await AuthAPI.getPlayerData(
        authStore.sklandCred,
        authStore.sklandSignToken,
        targetRole.uid
      );

      console.log('玩家数据获取成功');
      playerData.value = data;
      lastUpdateTime.value = Date.now();

      // 更新缓存
      dataCache.value = {
        data: data,
        timestamp: getCurrentTimestamp() * 1000
      };

      // 调试输出数据结构
      debugData();

      console.log('游戏数据加载完成并已缓存');
    } catch (error: any) {
      console.error('GameData load error:', error);
      errorMsg.value = error.message || '游戏数据加载失败，请稍后重试';

      // 确保在出错时也停止加载状态
      if (!refresh) {
        isLoading.value = false;
      }
    } finally {
      isLoading.value = false;
      isRefreshing.value = false;
      console.log('加载状态已重置');
    }
  };

  /**
   * 刷新数据
   * 强制重新加载数据，忽略缓存
   */
  const refreshData = async () => {
    await fetchGameData(true);
  };

  /**
   * 启动时间更新定时器
   * 每秒更新一次当前时间，确保时间相关计算准确
   */
  const startTimeUpdate = () => {
    timeUpdateInterval = setInterval(() => {
      currentTime.value = Math.floor(Date.now() / 1000);
    }, 1000);
  };

  /**
   * 停止时间更新定时器
   * 清理定时器，防止内存泄漏
   */
  const stopTimeUpdate = () => {
    if (timeUpdateInterval) {
      clearInterval(timeUpdateInterval);
      timeUpdateInterval = null;
      console.log('时间更新定时器已清理');
    }
  };

  /**
   * 清除缓存
   * 强制清除缓存数据，下次加载会重新请求API
   */
  const clearCache = () => {
    dataCache.value = null;
  };

  // ========== 导出接口 ==========
  return {
    // 状态
    isLoading,
    errorMsg,
    playerData,
    isRefreshing,
    lastUpdateTime,
    currentTime,

    // 计算属性
    getCharCount,
    getMainStageProgress,
    getHireRefreshCount,
    getHireSlotCount,
    getClueCount,
    getManufactureStatus,
    getTradingOrderCount,
    getLaborCount,
    getDormRestCount,
    getTrainingStatus,
    getAssistCharCount,
    getRelicCount,
    getActualApInfo,
    getTiredCharsCount,
    getCampaignReward,
    getTowerLowerItem,
    getTowerHigherItem,
    getDailyTaskProgress,
    getWeeklyTaskProgress,

    // 方法
    fetchGameData,
    refreshData,
    formatTimestamp,
    formatRecoveryTime,
    debugData,
    startTimeUpdate,
    stopTimeUpdate,
    clearCache
  };
});

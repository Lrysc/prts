<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue';
import { useAuthStore } from '@stores/auth';
import { AuthAPI } from '@services/api';

// 状态管理实例
const authStore = useAuthStore();

// 组件内部状态
const isLoading = ref(true);
const errorMsg = ref('');
const playerData = ref<any>(null);
const isRefreshing = ref(false);
const lastUpdateTime = ref<number>(0);
const isAttending = ref(false);
const attendanceMsg = ref('');
const currentTime = ref<number>(Math.floor(Date.now() / 1000));

// 定时更新当前时间，确保时间相关计算始终准确
let timeUpdateInterval: NodeJS.Timeout | null = null;

// 缓存相关
const CACHE_DURATION = 5 * 60 * 1000; // 5分钟缓存
const dataCache = ref<{ data: any; timestamp: number } | null>(null);

/**
 * 获取当前最新时间戳（秒级）
 * @returns 当前时间戳
 */
const getCurrentTimestamp = () => {
  return currentTime.value;
};

/**
 * 格式化时间戳为本地日期时间
 * @param ts 时间戳（秒级）
 * @returns 格式化后的字符串
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
 * @param apData 理智数据对象
 * @returns 实际理智数值
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

  // 计算实际当前理智
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
 * @param recoveryTs 恢复完成时间戳（秒级）
 * @returns 剩余时间字符串
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
 * 计算干员总数（遍历chars数组）
 * @returns 干员数量
 */
const getCharCount = computed(() => {
  return playerData.value?.chars?.length || 0;
});

/**
 * 修复作战进度显示逻辑
 * 根据API文档：全通关时mainStageProgress返回空，其他情况显示最新抵达的关卡
 * @returns 作战进度描述
 */
const getMainStageProgress = computed(() => {
  const status = playerData.value?.status;
  if (!status) return '未知';

  // 如果mainStageProgress为空字符串，表示全通关
  if (status.mainStageProgress === '') {
    return '主线全通关';
  }

  // 如果mainStageProgress有值，显示具体的关卡进度
  if (status.mainStageProgress && typeof status.mainStageProgress === 'string') {
    return status.mainStageProgress.trim();
  }

  // 最后回退到默认值
  return '未通关主线';
});

/**
 * 格式化任务进度（已完成/总数）
 * @param task 任务数据对象
 * @returns 进度字符串
 */
const formatTaskProgress = (task?: { completed?: number; total?: number }) => {
  if (!task) return '0/0';
  return `${task.completed || 0}/${task.total || 0}`;
};

/**
 * 获取公开招募刷新次数 - 修正为0/3
 * @returns 刷新次数
 */
const getHireRefreshCount = computed(() => {
  const refreshCount = playerData.value?.building?.hire?.refreshCount || 0;
  return `${refreshCount}/3`;
});

/**
 * 获取公开招募位置数量
 * @returns 招募位置数量
 */
const getHireSlotCount = computed(() => {
  const slots = playerData.value?.building?.hire?.slots;
  if (!Array.isArray(slots)) return '0/4';

  const totalSlots = slots.length;
  const activeSlots = slots.filter(slot => slot.state === 1).length; // state=1表示正在招募
  return `${activeSlots}/${totalSlots}`;
});

/**
 * 获取会客室线索总数 - 修正为7个位置
 * @returns 线索数量
 */
const getClueCount = computed(() => {
  // 尝试多种可能的路径
  const clueBoard = playerData.value?.building?.meeting?.clue?.board;
  const meetingRoom = playerData.value?.building?.meeting;

  console.log('会客室数据调试:', { clueBoard, meetingRoom });

  let clueCount = 0;

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
 * 获取制造站运行状态
 * @returns 制造站状态描述
 */
const getManufactureStatus = computed(() => {
  const manufactures = playerData.value?.building?.manufactures;
  if (!manufactures || !Array.isArray(manufactures) || manufactures.length === 0) return '0/0 运行中';

  // 计算正在运行的制造站数量
  const activeCount = manufactures.filter((mfg: any) => mfg.status === 'working').length;
  return `${activeCount}/${manufactures.length} 运行中`;
});

/**
 * 获取贸易站订单数量
 * @returns 订单数量
 */
const getTradingOrderCount = computed(() => {
  const tradings = playerData.value?.building?.tradings;
  if (!tradings || !Array.isArray(tradings)) return '0 订单';

  // 计算所有贸易站的订单总数
  const totalOrders = tradings.reduce((total: number, trading: any) => {
    // 订单可能在slots或orders字段中
    const slots = trading.slots || trading.orders || [];
    return total + slots.length;
  }, 0);

  return `${totalOrders} 订单`;
});

/**
 * 获取无人机数据 - 修正为正确的数据结构
 * @returns 无人机数量
 */
const getLaborCount = computed(() => {
  const labor = playerData.value?.building?.labor;
  console.log('无人机数据调试:', labor);

  // 尝试不同的字段名
  const current = labor?.value || labor?.count || labor?.current || 0;
  const max = labor?.maxValue || labor?.max || 0;

  return `${current}/${max}`;
});

/**
 * 获取宿舍休息人数 - 修正数据结构
 * @returns 休息人数
 */
const getDormRestCount = computed(() => {
  const dormitories = playerData.value?.building?.dormitories;
  console.log('宿舍数据调试:', dormitories);

  if (!dormitories || !Array.isArray(dormitories)) return 0;

  // 计算所有宿舍休息人数总和
  return dormitories.reduce((total: number, dorm: any) => {
    // 尝试不同的字段名
    const restCount = dorm.restCount || dorm.chars?.length || dorm.characterCount || 0;
    return total + restCount;
  }, 0);
});

/**
 * 获取训练室状态
 * @returns 训练室状态描述
 */
const getTrainingStatus = computed(() => {
  const trainees = playerData.value?.building?.training?.trainee;
  if (!trainees || !Array.isArray(trainees) || trainees.length === 0) return '0/0 训练中';

  // 计算正在训练的干员数量
  const activeCount = trainees.filter((t: any) => t.completeTime > getCurrentTimestamp()).length;
  return `${activeCount}/${trainees.length} 训练中`;
});

/**
 * 获取助战干员数量
 * @returns 助战干员数量
 */
const getAssistCharCount = computed(() => {
  return playerData.value?.assistChars?.length || 0;
});

/**
 * 获取收藏品数量（肉鸽）
 * @returns 收藏品数量
 */
const getRelicCount = computed(() => {
  return playerData.value?.rogue?.relicCnt || 0;
});

/**
 * 获取实际理智信息
 * @returns 理智信息对象
 */
const getActualApInfo = computed(() => {
  const apData = playerData.value?.status?.ap;
  return calculateActualAp(apData);
});

/**
 * 获取疲劳干员数量
 * @returns 疲劳干员数量
 */
const getTiredCharsCount = computed(() => {
  return playerData.value?.building?.tiredChars?.length || 0;
});

/**
 * 获取剿灭作战合成玉进度
 * @returns 合成玉进度
 */
const getCampaignReward = computed(() => {
  const reward = playerData.value?.campaign?.reward;
  return `${reward?.current || 0}/${reward?.total || 0}`;
});

/**
 * 获取数据增补仪进度
 * @returns 数据增补仪进度
 */
const getTowerLowerItem = computed(() => {
  const lowerItem = playerData.value?.tower?.reward?.lowerItem;
  return `${lowerItem?.current || 0}/${lowerItem?.total || 0}`;
});

/**
 * 获取数据增补条进度
 * @returns 数据增补条进度
 */
const getTowerHigherItem = computed(() => {
  const higherItem = playerData.value?.tower?.reward?.higherItem;
  return `${higherItem?.current || 0}/${higherItem?.total || 0}`;
});

/**
 * 获取每日任务进度
 * @returns 每日任务进度
 */
const getDailyTaskProgress = computed(() => {
  const daily = playerData.value?.routine?.daily;
  console.log('每日任务数据调试:', daily);
  return formatTaskProgress(daily);
});

/**
 * 获取每周任务进度
 * @returns 每周任务进度
 */
const getWeeklyTaskProgress = computed(() => {
  const weekly = playerData.value?.routine?.weekly;
  console.log('每周任务数据调试:', weekly);
  return formatTaskProgress(weekly);
});

/**
 * 调试数据函数 - 用于检查数据结构
 */
const debugData = () => {
  console.log('=== 完整玩家数据 ===', playerData.value);
  console.log('=== 任务数据 ===', playerData.value?.routine);
  console.log('=== 基建数据 ===', playerData.value?.building);
  console.log('=== 宿舍数据 ===', playerData.value?.building?.dormitories);
  console.log('=== 会客室数据 ===', playerData.value?.building?.meeting);
  console.log('=== 无人机数据 ===', playerData.value?.building?.labor);
  console.log('=== 贸易站数据 ===', playerData.value?.building?.tradings);
};

/**
 * 加载游戏数据核心方法
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
      debugData(); // 调试数据
      return;
    }
  }

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
      console.log('用户未登录');
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
      console.log('未找到绑定的游戏角色');
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
 */
const refreshData = async () => {
  await fetchGameData(true);
};

/**
 * 签到功能
 */
const handleAttendance = async () => {
  if (!authStore.isLogin || !authStore.bindingRoles.length) {
    errorMsg.value = '请先登录并绑定游戏角色';
    return;
  }

  isAttending.value = true;
  attendanceMsg.value = '';

  try {
    // 先验证cred是否还有效
    console.log('=== 验证cred有效性 ===');
    const isCredValid = await AuthAPI.checkCred(authStore.sklandCred);
    console.log('Cred有效性:', isCredValid);

    if (!isCredValid) {
      throw new Error('Cred已失效，请重新登录');
    }

    const targetRole = authStore.bindingRoles.find((role: any) => role.isDefault) || authStore.bindingRoles[0];

    if (!targetRole) {
      throw new Error('未找到绑定的游戏角色');
    }

    console.log('=== 绑定角色调试信息 ===');
    console.log('完整的绑定角色列表:', JSON.stringify(authStore.bindingRoles, null, 2));
    console.log('选中的角色信息:', JSON.stringify(targetRole, null, 2));
    console.log('角色UID:', targetRole.uid);
    console.log('channelMasterId:', targetRole.channelMasterId);
    console.log('========================');

    // gameId需要是uint32类型，使用channelMasterId并转换为数字
    const gameId = targetRole.channelMasterId;
    console.log('使用的gameId:', gameId);
    console.log('gameId类型:', typeof gameId);
    console.log('转换为数字:', parseInt(gameId));

    const attendanceData = await AuthAPI.attendance(
      authStore.sklandCred,
      authStore.sklandSignToken,
      targetRole.uid,
      gameId
    );

    // 检查是否已经签到
    if (attendanceData.alreadyAttended) {
      attendanceMsg.value = '今日已签到';
    } else {
      // 解析签到奖励
      const awards = attendanceData.awards || [];
      const awardTexts = awards.map((award: any) => {
        const count = award.count || 0;
        const name = award.resource?.name || '未知奖励';
        return `${name} x${count}`;
      }).join(', ');

      attendanceMsg.value = `签到成功！获得：${awardTexts}`;
    }

    // 3秒后清除签到消息
    setTimeout(() => {
      attendanceMsg.value = '';
    }, 3000);

  } catch (error: any) {
    console.error('签到失败:', error);
    attendanceMsg.value = error.message || '签到失败，请稍后重试';
  } finally {
    isAttending.value = false;
  }
};

// 组件挂载时加载数据
onMounted(async () => {
  console.log('GameData组件挂载，开始初始化...');

  // 启动时间更新定时器，每秒更新一次确保时间准确性
  timeUpdateInterval = setInterval(() => {
    currentTime.value = Math.floor(Date.now() / 1000);
  }, 1000);

  try {
    // 监听登录状态变化，登录后自动加载数据
    if (authStore.isLogin) {
      console.log('用户已登录，直接加载数据');
      await fetchGameData();
    } else {
      console.log('用户未登录，尝试恢复登录状态');
      // 未登录时尝试恢复登录状态
      const isRestored = await authStore.restoreAuthState();
      if (isRestored) {
        console.log('登录状态恢复成功，加载数据');
        await fetchGameData();
      } else {
        console.log('登录状态恢复失败');
        isLoading.value = false;
        errorMsg.value = '请先登录森空岛账号';
      }
    }
  } catch (error) {
    console.error('GameData组件初始化失败:', error);
    isLoading.value = false;
    errorMsg.value = '初始化失败，请刷新页面重试';
  }
});

// 监听登录状态变化，登录后自动刷新数据
watch(() => authStore.isLogin, async (newLoginState, oldLoginState) => {
  if (newLoginState && !oldLoginState) {
    // 从未登录变为已登录
    console.log('检测到登录状态变化，清除缓存并重新加载数据');
    dataCache.value = null; // 清除缓存
    await fetchGameData();
  }
});

// 组件卸载时清理定时器
onUnmounted(() => {
  if (timeUpdateInterval) {
    clearInterval(timeUpdateInterval);
    timeUpdateInterval = null;
    console.log('时间更新定时器已清理');
  }
});
</script>

<template>
  <div class="game-data-container">
    <!-- 加载状态提示 -->
    <div class="loading-container" v-if="isLoading">
      <div class="spinner"></div>
      <p class="loading-text">加载游戏数据中...</p>
    </div>

    <!-- 数据加载失败提示 -->
    <div class="error-container" v-else-if="errorMsg">
      <p class="error-text">{{ errorMsg }}</p>
      <button class="retry-btn" @click="fetchGameData()">重新加载</button>
    </div>

    <!-- 数据卡片区域（加载成功时显示） -->
    <div class="cards-wrapper" v-else>
      <!-- 数据头部操作栏 -->
      <div class="data-header">
        <div class="left-section">
          <div class="update-info">
            <span class="last-update" v-if="lastUpdateTime">
              最后更新：{{ formatTimestamp(Math.floor(lastUpdateTime / 1000)) }}
            </span>
          </div>
          <!-- 签到消息提示 -->
          <div class="attendance-message" v-if="attendanceMsg" :class="{ success: !attendanceMsg.includes('失败'), error: attendanceMsg.includes('失败') }">
            {{ attendanceMsg }}
          </div>
        </div>
        <div class="header-buttons">
          <!-- 森空岛签到图标按钮 -->
          <button
            class="attendance-icon-btn"
            @click="handleAttendance"
            :disabled="isAttending"
            :class="{ attending: isAttending }"
            :title="isAttending ? '签到中...' : '每日签到'"
          >
            <img
              src="@assets/icon_skland.svg"
              alt="森空岛签到"
              class="skland-icon"
            />
            <span class="attendance-tooltip" v-if="isAttending">签到中...</span>
            <span class="attendance-tooltip" v-else>每日签到</span>
          </button>
          <button
            class="refresh-btn"
            @click="refreshData"
            :disabled="isRefreshing"
            :class="{ refreshing: isRefreshing }"
          >
            <span v-if="isRefreshing">刷新中...</span>
            <span v-else>刷新数据</span>
          </button>
<!--          <button-->
<!--            class="debug-btn"-->
<!--            @click="debugData"-->
<!--          >-->
<!--            调试数据-->
<!--          </button>-->
        </div>
      </div>

      <!-- Header 信息卡片 -->
      <div class="section-card">
        <h3 class="section-title">--- 基本信息 ---</h3>
        <ul class="data-grid">
          <li class="data-item">
            <span class="label">入职日期</span>
            <span class="value">{{ formatTimestamp(playerData?.status?.registerTs) }}</span>
          </li>
          <li class="data-item">
            <span class="label">游戏昵称</span>
            <span class="value">Dr.{{ playerData?.status?.name || '未知' }}</span>
          </li>
          <li class="data-item">
            <span class="label">作战进度</span>
            <span class="value">{{ getMainStageProgress }}</span>
          </li>
          <li class="data-item">
            <span class="label">家具保有数</span>
            <span class="value">{{ playerData?.building?.furniture?.total || 0 }}</span>
          </li>
          <li class="data-item">
            <span class="label">雇佣干员数</span>
            <span class="value">{{ getCharCount }}</span>
          </li>
        </ul>
      </div>

      <!-- 助战干员卡片 -->
      <div class="section-card">
        <h3 class="section-title">--- 助战干员 ---</h3>
        <ul class="data-grid">
          <li class="data-item">
            <span class="label">助战干员数量</span>
            <span class="value">{{ getAssistCharCount }}</span>
          </li>
        </ul>
      </div>

      <!-- 实时数据卡片 -->
      <div class="section-card">
        <h3 class="section-title">--- 实时数据 ---</h3>
        <ul class="data-grid">
          <li class="data-item">
            <span class="label">理智</span>
            <span class="value">{{ getActualApInfo.current }}/{{ getActualApInfo.max }}</span>
            <span class="sub-value" v-if="getActualApInfo.remainSecs > 0">
              {{ formatRecoveryTime(getActualApInfo.recoverTime) }} 回满
            </span>
            <span class="sub-value" v-else>已回满</span>
          </li>
          <li class="data-item">
            <span class="label">公开招募位置</span>
            <span class="value">{{ getHireSlotCount }}</span>
          </li>
          <li class="data-item">
            <span class="label">公招刷新次数</span>
            <span class="value">{{ getHireRefreshCount }}</span>
          </li>
          <li class="data-item">
            <span class="label">训练室</span>
            <span class="value">{{ getTrainingStatus }}</span>
          </li>
          <li class="data-item">
            <span class="label">每周报酬合成玉</span>
            <span class="value">{{ getCampaignReward }}</span>
          </li>
          <li class="data-item">
            <span class="label">每日任务</span>
            <span class="value">{{ getDailyTaskProgress }}</span>
          </li>
          <li class="data-item">
            <span class="label">每周任务</span>
            <span class="value">{{ getWeeklyTaskProgress }}</span>
          </li>
          <li class="data-item">
            <span class="label">数据增补仪</span>
            <span class="value">{{ getTowerLowerItem }}</span>
          </li>
          <li class="data-item">
            <span class="label">数据增补条</span>
            <span class="value">{{ getTowerHigherItem }}</span>
          </li>
        </ul>
      </div>

      <!-- 我的干员卡片 -->
      <div class="section-card">
        <h3 class="section-title">--- 我的干员 ---</h3>
        <ul class="data-grid">
          <li class="data-item">
            <span class="label">干员总数</span>
            <span class="value">{{ getCharCount }}</span>
          </li>
          <li class="data-item">
            <span class="label">时装数量</span>
            <span class="value">{{ playerData?.skins?.length || 0 }}</span>
          </li>
        </ul>
      </div>

      <!-- 基建数据卡片 -->
      <div class="section-card">
        <h3 class="section-title">--- 基建数据 ---</h3>
        <ul class="data-grid">
          <li class="data-item">
            <span class="label">贸易站订单</span>
            <span class="value">{{ getTradingOrderCount }}</span>
          </li>
          <li class="data-item">
            <span class="label">制造站</span>
            <span class="value">{{ getManufactureStatus }}</span>
          </li>
          <li class="data-item">
            <span class="label">宿舍休息</span>
            <span class="value">{{ getDormRestCount }} 人</span>
          </li>
          <li class="data-item">
            <span class="label">会客室线索</span>
            <span class="value">{{ getClueCount }}</span>
            <span class="sub-value" v-if="getClueCount.startsWith('7/')">（已满）</span>
          </li>
          <li class="data-item">
            <span class="label">干员疲劳</span>
            <span class="value">{{ getTiredCharsCount }} 人</span>
          </li>
          <li class="data-item">
            <span class="label">无人机</span>
            <span class="value">{{ getLaborCount }}</span>
          </li>
        </ul>
      </div>

      <!-- 游戏战绩卡片 -->
      <div class="section-card">
        <h3 class="section-title">--- 游戏战绩 ---</h3>
        <ul class="data-grid">
          <li class="data-item">
            <span class="label">剿灭作战</span>
            <span class="value">{{ getCampaignReward }} 合成玉</span>
          </li>
          <li class="data-item">
            <span class="label">集成战略</span>
            <span class="value">{{ getRelicCount }} 收藏品</span>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<style scoped>
.game-data-container {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 400px;
  gap: 16px;
  color: #ccc;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid rgba(100, 108, 255, 0.2);
  border-top: 4px solid #646cff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.loading-text {
  font-size: 16px;
  color: #ccc;
}

.error-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 400px;
  gap: 16px;
  color: #ff6b6b;
}

.error-text {
  font-size: 16px;
  text-align: center;
  max-width: 400px;
}

.retry-btn {
  padding: 10px 24px;
  background: #646cff;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.3s ease;
}

.retry-btn:hover {
  background: #747bff;
}

.cards-wrapper {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.data-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: #2d2d2d;
  border-radius: 8px;
  border: 1px solid #404040;
  margin-bottom: 10px;
}

.left-section {
  display: flex;
  align-items: center;
  gap: 20px;
  flex: 1;
}

.header-buttons {
  display: flex;
  gap: 10px;
  align-items: center;
}

/* 森空岛图标签到按钮样式 */
.attendance-icon-btn {
  position: relative;
  width: 44px;
  height: 44px;
  padding: 8px;
  background: transparent;
  border: 2px solid #4caf50;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.attendance-icon-btn:hover:not(:disabled) {
  background: rgba(76, 175, 80, 0.1);
  border-color: #45a049;
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3);
}

.attendance-icon-btn:disabled {
  border-color: #666;
  cursor: not-allowed;
  opacity: 0.7;
}

.attendance-icon-btn.attending {
  border-color: #ffa500;
  animation: pulse 1.5s infinite;
}

.attendance-icon-btn.attending:hover {
  border-color: #ff8c00;
}

.skland-icon {
  width: 28px;
  height: 28px;
  filter: brightness(0) saturate(100%) invert(67%) sepia(51%) saturate(495%) hue-rotate(80deg) brightness(95%) contrast(89%);
  transition: all 0.3s ease;
}

.attendance-icon-btn:hover .skland-icon {
  filter: brightness(0) saturate(100%) invert(67%) sepia(51%) saturate(495%) hue-rotate(80deg) brightness(110%) contrast(89%);
  transform: scale(1.1);
}

.attendance-icon-btn.attending .skland-icon {
  filter: brightness(0) saturate(100%) invert(75%) sepia(90%) saturate(500%) hue-rotate(360deg) brightness(105%) contrast(105%);
}

.attendance-tooltip {
  position: absolute;
  bottom: -30px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.3s ease;
}

.attendance-icon-btn:hover .attendance-tooltip {
  opacity: 1;
}

.update-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.last-update {
  color: #999;
  font-size: 14px;
}

.attendance-message {
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
}

.attendance-message.success {
  background: rgba(76, 175, 80, 0.2);
  color: #4caf50;
  border: 1px solid #4caf50;
}

.attendance-message.error {
  background: rgba(244, 67, 54, 0.2);
  color: #f44336;
  border: 1px solid #f44336;
}

.refresh-btn {
  padding: 8px 16px;
  background: #646cff;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.refresh-btn:hover:not(:disabled) {
  background: #747bff;
  transform: translateY(-1px);
}

.refresh-btn:disabled {
  background: #666;
  cursor: not-allowed;
  opacity: 0.7;
}

.refresh-btn.refreshing {
  background: #ffa500;
}

.debug-btn {
  padding: 8px 16px;
  background: #ff9800;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 14px;
}

.debug-btn:hover {
  background: #f57c00;
  transform: translateY(-1px);
}

.section-card {
  background: #2d2d2d;
  border-radius: 8px;
  border: 1px solid #404040;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.section-title {
  color: #9feaf9;
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid #404040;
  text-align: center;
}

.data-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
  list-style: none;
  margin: 0;
  padding: 0;
}

.data-item {
  display: flex;
  flex-direction: column;
  padding: 12px;
  background: #333333;
  border-radius: 6px;
  transition: background 0.3s ease;
  border: 1px solid #404040;
}

.data-item:hover {
  background: #3a3a3a;
  transform: translateY(-1px);
}

.label {
  font-size: 12px;
  color: #999;
  margin-bottom: 4px;
  font-weight: 500;
}

.value {
  font-size: 16px;
  color: #ccc;
  font-weight: 600;
}

.sub-value {
  font-size: 12px;
  color: #666;
  margin-top: 2px;
}

.data-item:nth-child(1) .value { color: #9feaf9; }
.data-item:nth-child(2) .value { color: #fad000; }
.data-item:nth-child(3) .value { color: #6cc24a; }
.data-item:nth-child(4) .value { color: #ff7eb9; }
.data-item:nth-child(5) .value { color: #7afcff; }
.data-item:nth-child(6) .value { color: #ff9800; }
.data-item:nth-child(7) .value { color: #ff65a3; }
.data-item:nth-child(8) .value { color: #feff9c; }
.data-item:nth-child(9) .value { color: #ff6b6b; }
.data-item:nth-child(10) .value { color: #6bffb8; }

@media (max-width: 768px) {
  .data-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .data-header {
    flex-direction: column;
    gap: 12px;
    align-items: stretch;
  }

  .left-section {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .header-buttons {
    flex-direction: row;
    justify-content: flex-end;
    gap: 8px;
  }

  .attendance-icon-btn {
    width: 40px;
    height: 40px;
  }

  .skland-icon {
    width: 24px;
    height: 24px;
  }
}

@media (max-width: 480px) {
  .data-grid {
    grid-template-columns: 1fr;
  }

  .game-data-container {
    padding: 10px;
  }

  .header-buttons {
    flex-direction: column;
    gap: 8px;
  }
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

@keyframes pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(255, 165, 0, 0.4);
  }
  70% {
    box-shadow: 0 0 0 10px rgba(255, 165, 0, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(255, 165, 0, 0);
  }
}
</style>

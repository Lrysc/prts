<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { useAuthStore } from '@stores/auth';
import { useGameDataStore } from '@stores/gameData';
import { AuthAPI } from '@services/api';

// ==================== Store实例 ====================
const authStore = useAuthStore();
const gameDataStore = useGameDataStore();

// ==================== 组件状态管理 ====================

// 签到相关状态
const isAttending = ref(false);
const attendanceMsg = ref('');

// 右键菜单相关状态
const contextMenuVisible = ref(false);
const contextMenuPosition = ref({ x: 0, y: 0 });

// 浮窗提示相关状态
const toastVisible = ref(false);
const toastMessage = ref('');
const toastType = ref<'success' | 'error'>('success');
const toastLeaving = ref(false); // 控制退出动画状态

// ==================== 浮窗提示功能 ====================

/**
 * 显示浮窗提示
 * @param message 提示消息内容
 * @param type 提示类型：success成功 / error错误
 */
const showToast = (message: string, type: 'success' | 'error' = 'success') => {
  // 如果已经有浮窗在显示，先隐藏它再显示新的
  if (toastVisible.value) {
    hideToast();
    setTimeout(() => {
      showNewToast(message, type);
    }, 300);
  } else {
    showNewToast(message, type);
  }
};

/**
 * 显示新浮窗的内部方法
 */
const showNewToast = (message: string, type: 'success' | 'error') => {
  toastMessage.value = message;
  toastType.value = type;
  toastLeaving.value = false; // 重置退出状态
  toastVisible.value = true;

  // 3秒后自动隐藏
  setTimeout(() => {
    hideToast();
  }, 3000);
};

/**
 * 隐藏浮窗（带退出动画效果）
 */
const hideToast = () => {
  if (!toastVisible.value) return;

  // 先设置退出状态，触发退出动画
  toastLeaving.value = true;

  // 等待动画完成后再隐藏元素
  setTimeout(() => {
    toastVisible.value = false;
    toastLeaving.value = false; // 重置状态
  }, 300);
};

// ==================== 右键菜单功能 ====================

/**
 * 显示右键菜单（带边缘检测防止被遮挡）
 * @param event 鼠标事件对象
 */
const showContextMenu = (event: MouseEvent) => {
  event.preventDefault(); // 阻止默认右键菜单
  event.stopPropagation(); // 阻止事件冒泡

  const menuWidth = 150; // 菜单宽度
  const menuHeight = 50; // 菜单高度
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  // 计算菜单位置，防止被屏幕边缘遮挡
  let x = event.clientX;
  let y = event.clientY;

  // 如果靠近右侧边缘，向左偏移
  if (x + menuWidth > viewportWidth) {
    x = viewportWidth - menuWidth - 10;
  }

  // 如果靠近底部边缘，向上偏移
  if (y + menuHeight > viewportHeight) {
    y = viewportHeight - menuHeight - 10;
  }

  // 确保位置不会超出屏幕边界
  x = Math.max(10, Math.min(x, viewportWidth - menuWidth - 10));
  y = Math.max(10, Math.min(y, viewportHeight - menuHeight - 10));

  contextMenuPosition.value = { x, y };
  contextMenuVisible.value = true;
};

/**
 * 隐藏右键菜单
 */
const hideContextMenu = () => {
  contextMenuVisible.value = false;
};

/**
 * 处理容器点击事件（阻止冒泡）
 */
const handleContainerClick = (event: MouseEvent) => {
  event.stopPropagation();
};

// ==================== 数据操作功能 ====================

/**
 * 处理刷新数据请求
 */
const handleRefresh = async () => {
  hideContextMenu();

  try {
    await gameDataStore.refreshData();
    showToast('数据刷新成功！', 'success');
  } catch (error: any) {
    // 安全的错误处理，避免未处理的Promise拒绝
    const errorMessage = error?.message || '未知错误';
    console.error('刷新数据失败:', error);
    showToast(`刷新失败：${errorMessage}`, 'error');
  }
};

/**
 * 处理森空岛签到功能
 */
const handleAttendance = async () => {
  // 检查登录状态和绑定角色
  if (!authStore.isLogin || !authStore.bindingRoles?.length) {
    gameDataStore.errorMsg = '请先登录并绑定游戏角色';
    return;
  }

  isAttending.value = true;
  attendanceMsg.value = '';

  try {
    // 验证cred有效性
    console.log('=== 验证cred有效性 ===');
    const isCredValid = await AuthAPI.checkCred(authStore.sklandCred);
    console.log('Cred有效性:', isCredValid);

    if (!isCredValid) {
      throw new Error('Cred已失效，请重新登录');
    }

    // 获取目标角色信息
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

    const gameId = targetRole.channelMasterId;
    console.log('使用的gameId:', gameId);

    // 执行签到请求
    const attendanceData = await AuthAPI.attendance(
      authStore.sklandCred,
      authStore.sklandSignToken,
      targetRole.uid,
      gameId
    );

    // 处理签到结果
    if (attendanceData.alreadyAttended) {
      attendanceMsg.value = '今日已签到';
      showToast('今日已签到', 'success');
    } else {
      // 解析签到奖励信息
      const awards = attendanceData.awards || [];
      const awardTexts = awards.map((award: any) => {
        const count = award.count || 0;
        const name = award.resource?.name || '未知奖励';
        return `${name} x${count}`;
      }).join(', ');

      attendanceMsg.value = `签到成功！获得：${awardTexts}`;
      showToast(`签到成功！获得：${awardTexts}`, 'success');
    }

    // 3秒后清除签到消息
    setTimeout(() => {
      attendanceMsg.value = '';
    }, 3000);

  } catch (error: any) {
    // 安全的错误处理
    const errorMsg = error?.message || '签到失败，请稍后重试';
    console.error('签到失败:', error);
    attendanceMsg.value = errorMsg;
    showToast(errorMsg, 'error');
  } finally {
    isAttending.value = false;
  }
};

// ==================== 生命周期管理 ====================

/**
 * 组件挂载时的初始化操作
 */
onMounted(async () => {
  console.log('GameData组件挂载，开始初始化...');

  // 启动时间更新定时器
  gameDataStore.startTimeUpdate();

  // 添加全局事件监听器
  document.addEventListener('click', hideContextMenu);
  document.addEventListener('contextmenu', (event) => {
    // 只在菜单显示时处理右键事件
    if (!contextMenuVisible.value) return;
    const target = event.target as HTMLElement;
    if (!target.closest('.context-menu')) {
      hideContextMenu();
    }
  });

  try {
    if (authStore.isLogin) {
      console.log('用户已登录，直接加载数据');
      await gameDataStore.fetchGameData();
    } else {
      console.log('用户未登录，尝试恢复登录状态');
      const isRestored = await authStore.restoreAuthState();
      if (isRestored) {
        console.log('登录状态恢复成功，加载数据');
        await gameDataStore.fetchGameData();
      } else {
        console.log('登录状态恢复失败');
        gameDataStore.isLoading = false;
        gameDataStore.errorMsg = '请先登录森空岛账号';
      }
    }
  } catch (error) {
    // 安全的错误处理
    console.error('GameData组件初始化失败:', error);
    gameDataStore.isLoading = false;
    gameDataStore.errorMsg = '初始化失败，请刷新页面重试';
  }
});

/**
 * 监听登录状态变化
 */
watch(() => authStore.isLogin, async (newLoginState, oldLoginState) => {
  if (newLoginState && !oldLoginState) {
    console.log('检测到登录状态变化，清除缓存并重新加载数据');
    gameDataStore.clearCache();
    try {
      await gameDataStore.fetchGameData();
    } catch (error) {
      console.error('重新加载数据失败:', error);
    }
  }
});

/**
 * 组件卸载时的清理操作
 */
onUnmounted(() => {
  gameDataStore.stopTimeUpdate();
  document.removeEventListener('click', hideContextMenu);
  document.removeEventListener('contextmenu', hideContextMenu);
});
</script>

<template>
  <div class="game-data-container" @contextmenu="showContextMenu" @click="handleContainerClick">

    <!-- ==================== 右键菜单组件 ==================== -->
    <div
      v-if="contextMenuVisible"
      class="context-menu"
      :style="{
        left: `${contextMenuPosition.x}px`,
        top: `${contextMenuPosition.y}px`
      }"
      @click.stop
    >
      <button
        class="context-menu-item refresh-item"
        @click="handleRefresh"
        :disabled="gameDataStore.isRefreshing"
        :class="{ refreshing: gameDataStore.isRefreshing }"
      >
        <span class="context-menu-text">
          {{ gameDataStore.isRefreshing ? '刷新中...' : '刷新数据' }}
        </span>
      </button>
    </div>

    <!-- ==================== 浮窗提示组件 ==================== -->
    <div
      v-if="toastVisible"
      class="toast-notification"
      :class="[toastType, { leaving: toastLeaving }]"
    >
      <div class="toast-content">
        <p class="toast-message">{{ toastMessage }}</p>
      </div>
      <button class="toast-close" @click="hideToast">×</button>
    </div>

    <!-- ==================== 主内容区域 ==================== -->

    <!-- 加载状态提示 -->
    <div class="loading-container" v-if="gameDataStore.isLoading">
      <div class="spinner"></div>
      <p class="loading-text">加载游戏数据中...</p>
    </div>

    <!-- 数据加载失败提示 -->
    <div class="error-container" v-else-if="gameDataStore.errorMsg">
      <p class="error-text">{{ gameDataStore.errorMsg }}</p>
      <button class="retry-btn" @click="gameDataStore.fetchGameData()">重新加载</button>
    </div>

    <!-- 数据卡片区域（加载成功时显示） -->
    <div class="cards-wrapper" v-else>

      <!-- 数据头部操作栏 -->
      <div class="data-header">
        <div class="left-section">
          <div class="update-info">
            <span class="last-update" v-if="gameDataStore.lastUpdateTime">
              最后更新：{{ gameDataStore.formatTimestamp(Math.floor(gameDataStore.lastUpdateTime / 1000)) }}
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
        </div>
      </div>

      <!-- 基本信息卡片 -->
      <div class="section-card">
        <h3 class="section-title">--- 基本信息 ---</h3>
        <ul class="data-grid">
          <li class="data-item">
            <span class="label">入职日期</span>
            <span class="value">{{ gameDataStore.formatTimestamp(gameDataStore.playerData?.status?.registerTs) }}</span>
          </li>
          <li class="data-item">
            <span class="label">游戏昵称</span>
            <span class="value">Dr.{{ gameDataStore.playerData?.status?.name || '未知' }}</span>
          </li>
          <li class="data-item">
            <span class="label">作战进度</span>
            <span class="value">{{ gameDataStore.getMainStageProgress }}</span>
          </li>
          <li class="data-item">
            <span class="label">家具保有数</span>
            <span class="value">{{ gameDataStore.playerData?.building?.furniture?.total || 0 }}</span>
          </li>
          <li class="data-item">
            <span class="label">雇佣干员数</span>
            <span class="value">{{ gameDataStore.getCharCount }}</span>
          </li>
        </ul>
      </div>

      <!-- 助战干员卡片 -->
      <div class="section-card">
        <h3 class="section-title">--- 助战干员 ---</h3>
        <ul class="data-grid">
          <li class="data-item">
            <span class="label">助战干员数量</span>
            <span class="value">{{ gameDataStore.getAssistCharCount }}</span>
          </li>
        </ul>
      </div>

      <!-- 实时数据卡片 -->
      <div class="section-card">
        <h3 class="section-title">--- 实时数据 ---</h3>
        <ul class="data-grid">
          <li class="data-item">
            <span class="label">理智</span>
            <span class="value">{{ gameDataStore.getActualApInfo.current }}/{{ gameDataStore.getActualApInfo.max }}</span>
            <span class="sub-value" v-if="gameDataStore.getActualApInfo.remainSecs > 0">
              {{ gameDataStore.formatRecoveryTime(gameDataStore.getActualApInfo.recoverTime) }} 回满
            </span>
            <span class="sub-value" v-else>已回满</span>
          </li>
          <li class="data-item">
            <span class="label">公开招募</span>
            <span class="value">{{ gameDataStore.getHireSlotCount }}</span>
          </li>
          <li class="data-item">
            <span class="label">公招刷新次数</span>
            <span class="value">{{ gameDataStore.getHireRefreshCount }}</span>
          </li>
          <li class="data-item">
            <span class="label">训练室</span>
            <span class="value">{{ gameDataStore.getTrainingStatus }}</span>
          </li>
          <li class="data-item">
            <span class="label">每周报酬合成玉</span>
            <span class="value">{{ gameDataStore.getCampaignReward }}</span>
          </li>
          <li class="data-item">
            <span class="label">每日任务</span>
            <span class="value">{{ gameDataStore.getDailyTaskProgress }}</span>
          </li>
          <li class="data-item">
            <span class="label">每周任务</span>
            <span class="value">{{ gameDataStore.getWeeklyTaskProgress }}</span>
          </li>
          <li class="data-item">
            <span class="label">数据增补仪</span>
            <span class="value">{{ gameDataStore.getTowerLowerItem }}</span>
          </li>
          <li class="data-item">
            <span class="label">数据增补条</span>
            <span class="value">{{ gameDataStore.getTowerHigherItem }}</span>
          </li>
        </ul>
      </div>

      <!-- 我的干员卡片 -->
      <div class="section-card">
        <h3 class="section-title">--- 我的干员 ---</h3>
        <ul class="data-grid">
          <li class="data-item">
            <span class="label">干员总数</span>
            <span class="value">{{ gameDataStore.getCharCount }}</span>
          </li>
          <li class="data-item">
            <span class="label">时装数量</span>
            <span class="value">{{ gameDataStore.playerData?.skins?.length || 0 }}</span>
          </li>
        </ul>
      </div>

      <!-- 基建数据卡片 -->
      <div class="section-card">
        <h3 class="section-title">--- 基建数据 ---</h3>
        <ul class="data-grid">
          <li class="data-item">
            <span class="label">贸易站订单</span>
            <span class="value">{{ gameDataStore.getTradingOrderCount }}</span>
          </li>
          <li class="data-item">
            <span class="label">制造站</span>
            <span class="value">{{ gameDataStore.getManufactureStatus }}</span>
          </li>
          <li class="data-item">
            <span class="label">宿舍休息</span>
            <span class="value">{{ gameDataStore.getDormRestCount }} 人</span>
          </li>
          <li class="data-item">
            <span class="label">会客室线索</span>
            <span class="value">{{ gameDataStore.getClueCount }}</span>
            <span class="sub-value" v-if="gameDataStore.getClueCount.startsWith('7/')">（已满）</span>
          </li>
          <li class="data-item">
            <span class="label">干员疲劳</span>
            <span class="value">{{ gameDataStore.getTiredCharsCount }} 人</span>
          </li>
          <li class="data-item">
            <span class="label">无人机</span>
            <span class="value">{{ gameDataStore.getLaborCount.count }}</span>
            <span class="sub-value" v-if="gameDataStore.getLaborCount.remainSecs > 0">
              {{ gameDataStore.getLaborCount.recovery }} 回满
            </span>
            <span class="sub-value" v-else>已回满</span>
          </li>
        </ul>
      </div>

      <!-- 游戏战绩卡片 -->
      <div class="section-card">
        <h3 class="section-title">--- 游戏战绩 ---</h3>
        <ul class="data-grid">
          <li class="data-item">
            <span class="label">剿灭作战</span>
            <span class="value">{{ gameDataStore.getCampaignReward }} 合成玉</span>
          </li>
          <li class="data-item">
            <span class="label">集成战略</span>
            <span class="value">{{ gameDataStore.getRelicCount }} 收藏品</span>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ==================== 容器布局样式 ==================== */
.game-data-container {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
  min-height: 100vh;
  position: relative;
  user-select: none; /* 防止文本选中干扰右键菜单 */
}

/* ==================== 右键菜单样式 ==================== */
.context-menu {
  position: fixed;
  background: #2d2d2d;
  border: 1px solid #404040;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
  z-index: 10000;
  min-width: 150px;
  padding: 8px;
  animation: contextMenuSlideIn 0.15s ease-out;
  backdrop-filter: blur(10px);
}

.context-menu-item {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 12px 16px;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: #ccc;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 14px;
  font-family: inherit;
}

.context-menu-item:hover:not(:disabled) {
  background: #646cff;
  color: white;
}

.context-menu-item:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.context-menu-item.refreshing {
  background: #ffa500;
  color: white;
}

.context-menu-text {
  text-align: center;
}

/* 右键菜单进入动画 */
@keyframes contextMenuSlideIn {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(-5px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

/* ==================== 浮窗提示样式 ==================== */
.toast-notification {
  position: fixed;
  top: 20px;
  right: 20px;
  background: #2d2d2d;
  border: 1px solid #404040;
  border-radius: 8px;
  padding: 16px 20px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
  z-index: 10001;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-width: 300px;
  max-width: 450px;
  animation: toastSlideIn 0.3s ease-out forwards; /* 进入动画 */
  backdrop-filter: blur(10px);
}

/* 浮窗退出状态 */
.toast-notification.leaving {
  animation: toastSlideOut 0.3s ease-in forwards; /* 退出动画 */
}

/* 成功状态样式 */
.toast-notification.success {
  border-left: 4px solid #4caf50;
  background: linear-gradient(90deg, rgba(76, 175, 80, 0.1) 0%, #2d2d2d 100%);
}

/* 错误状态样式 */
.toast-notification.error {
  border-left: 4px solid #f44336;
  background: linear-gradient(90deg, rgba(244, 67, 54, 0.1) 0%, #2d2d2d 100%);
}

.toast-content {
  flex: 1;
}

.toast-message {
  margin: 0;
  color: #fff;
  font-size: 14px;
  line-height: 1.4;
  font-weight: 500;
}

.toast-close {
  background: none;
  border: none;
  color: #999;
  font-size: 20px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.2s ease;
  flex-shrink: 0;
  line-height: 1;
}

.toast-close:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

/* 浮窗进入动画 - 从右侧水平滑入 */
@keyframes toastSlideIn {
  from {
    opacity: 0;
    transform: translateX(100%);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

/* 浮窗退出动画 - 水平向右滑出 */
@keyframes toastSlideOut {
  from {
    opacity: 1;
    transform: translateX(0);
  }
  to {
    opacity: 0;
    transform: translateX(100%);
  }
}

/* ==================== 加载状态样式 ==================== */
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

/* ==================== 错误状态样式 ==================== */
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

/* ==================== 主内容区域样式 ==================== */
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

/* ==================== 签到按钮样式 ==================== */
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

/* ==================== 信息显示样式 ==================== */
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

/* 数据项颜色区分 */
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

/* ==================== 动画定义 ==================== */
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

@keyframes pulse {
  0% { box-shadow: 0 0 0 0 rgba(255, 165, 0, 0.4); }
  70% { box-shadow: 0 0 0 10px rgba(255, 165, 0, 0); }
  100% { box-shadow: 0 0 0 0 rgba(255, 165, 0, 0); }
}
</style>

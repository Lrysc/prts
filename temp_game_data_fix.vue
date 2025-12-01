<template>
  <div class="game-data-container">

    <!-- ==================== 主内容区域 ==================== -->
    <!-- 数据卡片区域 -->
    <div class="cards-wrapper">

      <!-- 数据头部操作栏 -->
      <div class="data-header">
        <div class="left-section">
          <div class="update-info">
            <!-- 最后更新时间 - 只在有数据时显示 -->
            <span class="last-update" v-if="gameDataStore.lastUpdateTime && authStore.isLogin">
              最后更新：{{ gameDataStore.formatTimestamp(Math.floor(gameDataStore.lastUpdateTime / 1000)) }}
            </span>
          </div>
        </div>
        <div class="header-buttons">
          <!-- 森空岛签到图标按钮 -->
          <button
            class="attendance-icon-btn"
            @click="handleAttendance"
            :disabled="isAttending || !authStore.isLogin"
            :class="{ attending: isAttending }"
            :title="!authStore.isLogin ? '请先登录' : (isAttending ? '签到中...' : '每日签到')"
          >
            <img
              src="@assets/icon_skland.svg"
              alt="森空岛签到"
              class="skland-icon"
            />
            <span class="attendance-tooltip" v-if="isAttending">签到中...</span>
            <span class="attendance-tooltip" v-else-if="!authStore.isLogin">请先登录</span>
            <span class="attendance-tooltip" v-else>每日签到</span>
          </button>
        </div>
      </div>

      <!-- 未登录时的提示信息 -->
      <div class="section-card" v-if="!authStore.isLogin">
        <h3 class="section-title">--- 登录提示 ---</h3>
        <div class="login-prompt">
          <p class="prompt-text">请登录鹰角网络通行证以查看游戏数据</p>
          <p class="prompt-subtext">登录后即可查看详细的游戏信息和统计数据</p>
        </div>
      </div>

      <!-- 实时数据卡片 -->
      <div class="section-card" v-if="authStore.isLogin">
        <h3 class="section-title">--- 实时数据 ---</h3>
        <ul class="data-grid">
          <li class="data-item">
            <div class="ap-ring-container">
              <svg class="ap-ring-svg" viewBox="0 0 120 120">
                <!-- 背景圆环 -->
                <circle cx="60" cy="60" r="54" fill="none" stroke="#333" stroke-width="8"/>
                <!-- 进度圆环 -->
                <circle 
                  cx="60" cy="60" r="54" 
                  fill="none" 
                  :stroke="gameDataStore.getActualApInfo?.remainSecs > 0 ? '#888' : '#4a90e2'" 
                  stroke-width="8" 
                  :stroke-dasharray="circumference" 
                  :stroke-dashoffset="apProgress" 
                  stroke-linecap="round" 
                  transform="rotate(-90 60 60)" 
                  class="ap-progress-circle"
                />
              </svg>
              <div class="ap-info">
                <span class="label">理智</span>
                <div class="ap-value">
                  <span class="current-ap">{{ gameDataStore.getActualApInfo?.current || '--' }}</span>
                  <span class="ap-separator">/</span>
                  <span class="max-ap">{{ gameDataStore.getActualApInfo?.max || '--' }}</span>
                </div>
                <div class="ap-recovery-info">
                  <span class="sub-value" v-if="gameDataStore.getActualApInfo?.remainSecs > 0">
                    {{ gameDataStore.formatRecoveryTime(gameDataStore.getActualApInfo?.recoverTime) }} 回满
                  </span>
                  <span class="sub-value" v-else-if="gameDataStore.getActualApInfo">已回满</span>
                </div>
              </div>
            </div>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, inject } from 'vue';
import { useGameDataStore } from '@stores/gameDataStore';
import { useAuthStore } from '@stores/authStore';
import { useNotificationStore } from '@stores/notificationStore';

// ==================== 依赖注入 ====================
const gameDataStore = useGameDataStore();
const authStore = useAuthStore();
const { showSuccess, showError } = useNotificationStore();

// ==================== 计算属性 ====================
/**
 * 圆环周长
 */
const circumference = ref(2 * Math.PI * 54);

/**
 * 理智进度计算
 * 根据当前理智和最大理智计算圆环进度
 */
const apProgress = computed(() => {
  const current = gameDataStore.getActualApInfo?.current || 0;
  const max = gameDataStore.getActualApInfo?.max || 1;
  const progress = (current / max) * circumference.value;
  return circumference.value - progress;
});

// ==================== 组件状态管理 ====================
/**
 * 签到操作状态
 */
const isAttending = ref(false);

/**
 * 处理森空岛签到功能
 */
const handleAttendance = async () => {
  // 签到逻辑
};

/**
 * 组件挂载时的初始化操作
 */
onMounted(async () => {
  console.log('GameData组件挂载，开始初始化...');
  try {
    if (authStore.isLogin) {
      console.log('用户已登录，直接加载游戏数据');
      await gameDataStore.fetchGameData();
    }
  } catch (error) {
    console.error('GameData组件初始化失败:', error);
  }
});
</script>

<style scoped>
.game-data-container {
  padding: 16px;
  background: transparent;
  min-height: 100vh;
}

.cards-wrapper {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 1200px;
  margin: 0 auto;
}

.section-card {
  background: rgba(30, 30, 30, 0.95);
  border-radius: 16px;
  padding: 20px;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

.section-title {
  color: #9feaf9;
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 16px;
  text-align: center;
  text-shadow: 0 0 10px rgba(159, 234, 249, 0.3);
}

.data-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 16px;
  list-style: none;
  padding: 0;
  margin: 0;
}

.data-item {
  background: rgba(40, 40, 40, 0.8);
  border-radius: 12px;
  padding: 16px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  transition: all 0.3s ease;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.data-item:hover {
  background: rgba(50, 50, 50, 0.9);
  border-color: rgba(159, 234, 249, 0.2);
  transform: translateY(-2px);
  box-shadow: 0 4px 20px rgba(159, 234, 249, 0.1);
}

.label {
  color: #999;
  font-size: 14px;
  font-weight: 500;
}

.value {
  color: #fff;
  font-size: 16px;
  font-weight: 600;
}

.sub-value {
  color: #666;
  font-size: 12px;
}

/* 理智圆环样式 */
.ap-ring-container {
  position: relative;
  width: 120px;
  height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto;
}

.ap-ring-svg {
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
}

.ap-progress-circle {
  transition: stroke-dashoffset 0.3s ease;
}

.ap-info {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.ap-value {
  display: flex;
  align-items: center;
  gap: 2px;
  font-size: 18px;
  font-weight: 700;
  color: #fff;
}

.current-ap {
  font-size: 20px;
  color: #9feaf9;
}

.ap-separator {
  color: #999;
  margin: 0 1px;
}

.max-ap {
  font-size: 16px;
  color: #ccc;
}

.ap-recovery-info {
  font-size: 11px;
  color: #666;
  text-align: center;
}

.data-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding: 0 4px;
}

.left-section {
  flex: 1;
}

.update-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.last-update {
  color: #666;
  font-size: 12px;
}

.header-buttons {
  display: flex;
  gap: 8px;
}

.attendance-icon-btn {
  background: rgba(159, 234, 249, 0.1);
  border: 1px solid rgba(159, 234, 249, 0.3);
  border-radius: 8px;
  padding: 8px 12px;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 6px;
  color: #9feaf9;
  font-size: 14px;
  position: relative;
}

.attendance-icon-btn:hover:not(:disabled) {
  background: rgba(159, 234, 249, 0.2);
  border-color: rgba(159, 234, 249, 0.5);
  transform: translateY(-1px);
}

.attendance-icon-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.skland-icon {
  width: 16px;
  height: 16px;
}

.attendance-tooltip {
  font-size: 12px;
  white-space: nowrap;
}

.login-prompt {
  text-align: center;
  padding: 40px 20px;
}

.prompt-text {
  color: #ccc;
  font-size: 16px;
  margin-bottom: 8px;
}

.prompt-subtext {
  color: #666;
  font-size: 14px;
}
</style>
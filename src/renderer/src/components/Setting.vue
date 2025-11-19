<template>
  <div class="setting-container">
    <h2>系统设置</h2>

    <div class="setting-content">
      <!-- 用户信息展示 -->
      <div class="user-info-section" v-if="authStore.isLogin">
        <h3>当前账号</h3>
        <div class="user-card">
          <div class="user-avatar">👤</div>
          <div class="user-details">
            <p class="user-name">{{ authStore.userName }}</p>
            <p class="user-level">等级: {{ authStore.userLevel }}</p>
            <p class="user-uid">游戏ID: {{ gameUid }}</p>
            <p class="login-status">状态: <span class="status-online">已登录</span></p>
          </div>
        </div>
      </div>

      <!-- 未登录状态提示 -->
      <div class="not-login-section" v-else>
        <div class="not-login-card">
          <p class="not-login-text">未登录</p>
          <p class="not-login-tip">登录后可使用更多功能</p>
        </div>
      </div>

<!--      <div class="setting-section">-->
<!--        <h3>账号管理</h3>-->
<!--      </div>-->

      <div class="setting-tips">
        <p>更多设置功能开发中...</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useAuthStore } from '@stores/auth'

const authStore = useAuthStore()

/**
 * 获取游戏内UID
 */
const gameUid = computed(() => {
  if (!authStore.isLogin || !authStore.bindingRoles.length) {
    return '未获取'
  }

  // 获取默认角色或第一个角色的UID
  const defaultRole = authStore.bindingRoles.find(role => role.isDefault) || authStore.bindingRoles[0]
  return defaultRole?.uid || '未获取'
})

</script>

<style scoped>
.setting-container {
  color: white;
  max-width: 100%;
  padding: 20px;
}

.setting-container h2 {
  margin-bottom: 30px;
  color: #ffffff;
  text-align: center;
}

.setting-content {
  max-width: 500px;
  margin: 0 auto;
}

/* 用户信息区域 */
.user-info-section {
  background: #2d2d2d;
  border-radius: 8px;
  border: 1px solid #404040;
  padding: 20px;
  margin-bottom: 20px;
}

.user-info-section h3 {
  margin-bottom: 15px;
  color: #9feaf9;
  font-size: 16px;
}

.user-card {
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 15px;
  background: #3a3a3a;
  border-radius: 6px;
  border: 1px solid #4a4a4a;
}

.user-avatar {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background: #646cff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
}

.user-details {
  flex: 1;
}

.user-name {
  font-weight: 600;
  color: #fff;
  margin-bottom: 4px;
  font-size: 16px;
}

.user-level, .user-uid, .login-status {
  color: #ccc;
  font-size: 12px;
  margin-bottom: 2px;
}

.status-online {
  color: #4caf50;
  font-weight: 500;
}

/* 未登录状态 */
.not-login-section {
  background: #2d2d2d;
  border-radius: 8px;
  border: 1px solid #404040;
  padding: 30px 20px;
  margin-bottom: 20px;
  text-align: center;
}

.not-login-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.not-login-text {
  color: #ccc;
  font-size: 16px;
  margin: 0;
}

.not-login-tip {
  color: #888;
  font-size: 12px;
  margin: 0;
}

/* 设置区域 */
.setting-section {
  background: #2d2d2d;
  border-radius: 8px;
  border: 1px solid #404040;
  padding: 20px;
  margin-bottom: 20px;
}

.setting-section h3 {
  margin-bottom: 20px;
  color: #9feaf9;
  font-size: 16px;
}

.setting-tips {
  text-align: center;
  padding: 20px;
  color: #ccc;
  font-size: 14px;
  background: #2d2d2d;
  border-radius: 8px;
  border: 1px solid #404040;
}



.dialog-header h3 {
  margin: 0;
  color: #fff;
  font-size: 16px;
  font-weight: 600;
}

.dialog-content p {
  margin: 0 0 12px 0;
  color: #ccc;
  font-size: 14px;
}


@keyframes modalSlideIn {
  from {
    opacity: 0;
    transform: translateY(-20px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
</style>

<template>
  <div class="title-bar">
    <div class="title-bar-left">
<!--      <div class="app-title">PRTS系统</div>-->
    </div>
    <div class="title-bar-right">
      <button class="title-bar-btn minimize-btn" @click="minimizeWindow" title="最小化">
        <img src="@assets/minimize.svg" alt="最小化" />
      </button>
      <button class="title-bar-btn maximize-btn" @click="toggleMaximize" :title="isMaximized ? '还原' : '最大化'">
        <img v-if="isMaximized" src="@assets/restore.svg" alt="还原" />
        <img v-else src="@assets/maximize.svg" alt="最大化" />
      </button>
      <button class="title-bar-btn close-btn" @click="closeWindow" title="关闭">
        <img src="@assets/close.svg" alt="关闭" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

const isMaximized = ref(false)

const minimizeWindow = async () => {
  if (window.api?.windowControl) {
    await window.api.windowControl.minimize()
  }
}

const toggleMaximize = async () => {
  if (window.api?.windowControl) {
    if (isMaximized.value) {
      await window.api.windowControl.unmaximize()
    } else {
      await window.api.windowControl.maximize()
    }
    updateMaximizedState()
  }
}

const closeWindow = async () => {
  if (window.api?.windowControl) {
    await window.api.windowControl.close()
  }
}

const updateMaximizedState = async () => {
  if (window.api?.windowControl) {
    isMaximized.value = await window.api.windowControl.isMaximized()
  }
}

onMounted(() => {
  updateMaximizedState()
})
</script>

<style scoped>
.title-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 32px;
  background: #2d2d2d;
  border-bottom: 1px solid #404040;
  -webkit-app-region: drag;
  user-select: none;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
}

.title-bar-left {
  display: flex;
  align-items: center;
  padding-left: 12px;
  flex: 1;
}

.app-title {
  color: #fff;
  font-size: 13px;
  font-weight: 500;
}

.title-bar-right {
  display: flex;
  -webkit-app-region: no-drag;
}

.title-bar-btn {
  width: 46px;
  height: 32px;
  border: none;
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s ease;
  color: #999;
}

.title-bar-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.close-btn:hover {
  background: #e81123;
  color: #fff;
}

.title-bar-btn img {
  width: 12px;
  height: 12px;
  filter: brightness(0) invert(1);
}
</style>

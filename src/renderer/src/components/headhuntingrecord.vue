<template>
  <div class="headhunting-record">
    <div class="header">
      <h2>API测试</h2>
      <div class="actions">
        <button @click="testPhonePasswordLogin" class="test-btn" title="测试手机号密码登录">
          测试登录
        </button>
        <button @click="clearSavedCredentials" class="clear-btn" title="清除保存的账号信息">
          清除账号
        </button>
        <button @click="testFullFlow" class="flow-btn" title="测试完整API流程">
          测试完整流程
        </button>
        <button @click="openDebugBrowser" class="debug-btn" title="打开内置调试浏览器">
          调试浏览器
        </button>
      </div>
    </div>

    <div v-if="loading" class="loading">
      <div class="loading-spinner"></div>
      <p>处理中...</p>
    </div>

    <div v-else-if="error" class="error">
      <p>{{ error }}</p>
      <button @click="error = null" class="retry-btn">关闭</button>
    </div>

    <div v-else-if="result" class="result">
      <h3>API响应结果:</h3>
      <pre>{{ JSON.stringify(result, null, 2) }}</pre>
    </div>

    <div v-else class="empty">
      <p>点击上方按钮测试API功能</p>
    </div>

    <!-- 登录对话框 -->
    <div v-if="showLoginDialog" class="login-dialog-overlay" @click="closeLoginDialog">
      <div class="login-dialog" @click.stop>
        <h3>明日方舟账号登录</h3>
        <div class="form-group">
          <label>手机号:</label>
          <input
            v-model="loginForm.phone"
            type="tel"
            placeholder="请输入手机号"
            @keyup.enter="confirmLogin"
          />
        </div>
        <div class="form-group">
          <label>密码:</label>
          <input
            v-model="loginForm.password"
            type="password"
            placeholder="请输入密码"
            @keyup.enter="confirmLogin"
          />
        </div>
        <div class="form-group">
          <label>
            <input v-model="loginForm.saveInfo" type="checkbox" />
            保存账号信息
          </label>
        </div>
        <div class="dialog-actions">
          <button @click="closeLoginDialog" class="cancel-btn">取消</button>
          <button @click="confirmLogin" :disabled="!loginForm.phone || !loginForm.password" class="confirm-btn">
            登录
          </button>
        </div>
      </div>
    </div>

    <!-- UID输入对话框 -->
    <div v-if="showUidDialog" class="login-dialog-overlay" @click="closeUidDialog">
      <div class="login-dialog" @click.stop>
        <h3>输入游戏UID</h3>
        <div class="form-group">
          <label>游戏UID (8位数字):</label>
          <input
            v-model="uidInput"
            type="text"
            placeholder="请输入8位数字UID"
            maxlength="8"
            @keyup.enter="confirmUid"
          />
        </div>
        <div class="dialog-actions">
          <button @click="closeUidDialog" class="cancel-btn">取消</button>
          <button @click="confirmUid" :disabled="!uidInput || uidInput.length !== 8" class="confirm-btn">
            确认
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { SimpleGachaAPI } from '@services/Gacha';

const loading = ref(false);
const error = ref<string | null>(null);
const result = ref<any>(null);

// 登录对话框相关
const showLoginDialog = ref(false);
const loginForm = ref({
  phone: '',
  password: '',
  saveInfo: false
});
const loginResolve = ref<((value: { phone: string; password: string; saveInfo: boolean }) => void) | null>(null);

// UID对话框相关
const showUidDialog = ref(false);
const uidInput = ref('');
const uidResolve = ref<((value: string) => void) | null>(null);

// 显示登录对话框
const showLoginDialogAsync = (): Promise<{ phone: string; password: string; saveInfo: boolean }> => {
  return new Promise((resolve) => {
    loginResolve.value = resolve;
    showLoginDialog.value = true;

    // 预填充保存的信息
    const savedPhone = localStorage.getItem('hg_phone');
    const savedPassword = localStorage.getItem('hg_password');
    if (savedPhone && savedPassword) {
      loginForm.value.phone = savedPhone;
      loginForm.value.password = savedPassword;
      loginForm.value.saveInfo = true;
    }
  });
};

// 关闭登录对话框
const closeLoginDialog = (): void => {
  showLoginDialog.value = false;
  loginForm.value = { phone: '', password: '', saveInfo: false };
  if (loginResolve.value) {
    loginResolve.value(null as any);
  }
};

// 显示UID输入对话框
const showUidDialogAsync = (): Promise<string> => {
  return new Promise((resolve) => {
    uidResolve.value = resolve;
    showUidDialog.value = true;
  });
};

// 关闭UID对话框
const closeUidDialog = (): void => {
  showUidDialog.value = false;
  uidInput.value = '';
  if (uidResolve.value) {
    uidResolve.value(null as any);
  }
};

// 确认UID
const confirmUid = (): void => {
  if (!uidInput.value || uidInput.value.length !== 8 || !/^\d{8}$/.test(uidInput.value)) {
    return;
  }

  if (uidResolve.value) {
    uidResolve.value(uidInput.value);
    uidResolve.value = null;
  }

  showUidDialog.value = false;
  uidInput.value = '';
};

// 确认登录
const confirmLogin = (): void => {
  if (!loginForm.value.phone || !loginForm.value.password) {
    return;
  }

  if (loginResolve.value) {
    loginResolve.value({ ...loginForm.value });
    loginResolve.value = null;
  }

  showLoginDialog.value = false;

  // 如果选择保存，保存到localStorage
  if (loginForm.value.saveInfo) {
    localStorage.setItem('hg_phone', loginForm.value.phone);
    localStorage.setItem('hg_password', loginForm.value.password);
  }

  // 清空表单
  loginForm.value = { phone: '', password: '', saveInfo: false };
};

// 测试手机号密码登录
const testPhonePasswordLogin = async (): Promise<void> => {
  try {
    loading.value = true;
    error.value = null;
    result.value = null;

    // 显示登录对话框
    const loginData = await showLoginDialogAsync();

    console.log('开始测试手机号密码登录...');

    // 1. 获取鹰角网络token
    const hgToken = await SimpleGachaAPI.getHypergryphTokenByPhonePassword(loginData.phone, loginData.password);
    console.log('获取到的鹰角网络token:', hgToken.substring(0, 20) + '...');

    // 2. 测试获取用户信息
    console.log('测试获取用户信息...');
    console.log('传递给getUserInfo的token:', hgToken);
    console.log('token类型:', typeof hgToken);
    console.log('token长度:', hgToken?.length);
    const userInfo = await SimpleGachaAPI.getUserInfo(hgToken);
    console.log('获取到的用户信息:', userInfo);

    result.value = {
      step: '登录成功',
      token: hgToken.substring(0, 50) + '...',
      userInfo: userInfo
    };

  } catch (err: unknown) {
    console.error('测试登录失败:', err);
    error.value = err instanceof Error ? err.message : '未知错误';
  } finally {
    loading.value = false;
  }
};

// 测试完整API流程
const testFullFlow = async (): Promise<void> => {
  try {
    loading.value = true;
    error.value = null;
    result.value = null;

    // 1. 获取登录信息
    const loginData = await showLoginDialogAsync();

    // 2. 获取token
    const token = await SimpleGachaAPI.getHypergryphTokenByPhonePassword(loginData.phone, loginData.password);
    console.log('步骤1: 获取token成功');

    // 3. 获取用户信息
    console.log('步骤2: 准备获取用户信息，token:', token);
    console.log('token类型:', typeof token);
    console.log('token长度:', token?.length);
    const userInfo = await SimpleGachaAPI.getUserInfo(token);
    console.log('步骤2: 获取用户信息成功');

    // 4. 获取UID
    const uid = await showUidDialogAsync();
    console.log('步骤3: 获取UID成功:', uid);

    // 5. 获取卡池分类
    const categories = await SimpleGachaAPI.getGachaCategories(userInfo, token, uid);
    console.log('步骤4: 获取卡池分类成功');

    result.value = {
      step: '完整流程测试成功',
      token: token.substring(0, 50) + '...',
      userInfo: userInfo,
      uid: uid,
      categories: categories
    };

  } catch (err: unknown) {
    console.error('测试完整流程失败:', err);
    error.value = err instanceof Error ? err.message : '未知错误';
  } finally {
    loading.value = false;
  }
};

// 清除保存的账号信息
const clearSavedCredentials = (): void => {
  if (confirm('确定要清除保存的账号信息吗？')) {
    localStorage.removeItem('hg_phone');
    localStorage.removeItem('hg_password');
    alert('账号信息已清除');
  }
};

// 打开调试浏览器
const openDebugBrowser = async (): Promise<void> => {
  try {
    await (window as any).api.openDebugWindow('https://ak.hypergryph.com/user/headhunting');
  } catch (err: unknown) {
    console.error('打开调试浏览器失败:', err);
    alert('打开调试浏览器失败: ' + (err instanceof Error ? err.message : '未知错误'));
  }
};
</script>

<style scoped>
.headhunting-record {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.header h2 {
  margin: 0;
  color: #333;
  font-size: 24px;
  font-weight: 600;
}

.actions {
  display: flex;
  gap: 12px;
}

.test-btn {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  background-color: #52c41a;
  color: white;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.2s;
}

.test-btn:hover {
  background-color: #73d13d;
}

.clear-btn {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  background-color: #ff4d4f;
  color: white;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.2s;
}

.clear-btn:hover {
  background-color: #ff7875;
}

.flow-btn {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  background-color: #722ed1;
  color: white;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.2s;
}

.flow-btn:hover {
  background-color: #9254de;
}

.debug-btn {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  background-color: #fa8c16;
  color: white;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.2s;
}

.debug-btn:hover {
  background-color: #ffa940;
}

.result {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 20px;
  margin-top: 20px;
}

.result h3 {
  margin: 0 0 16px 0;
  color: #333;
  font-size: 16px;
  font-weight: 600;
}

.result pre {
  background: #fff;
  border: 1px solid #e9ecef;
  border-radius: 4px;
  padding: 16px;
  overflow-x: auto;
  font-size: 12px;
  line-height: 1.4;
  color: #666;
  max-height: 400px;
  overflow-y: auto;
}

.retry-btn {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  background-color: #1890ff;
  color: white;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.2s;
  margin-top: 12px;
}

.retry-btn:hover {
  background-color: #40a9ff;
}

.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #1890ff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.error, .empty {
  text-align: center;
  padding: 60px 20px;
  color: #666;
}

.error {
  color: #ff4d4f;
}

/* 登录对话框样式 */
.login-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.login-dialog {
  background: white;
  border-radius: 12px;
  padding: 24px;
  width: 400px;
  max-width: 90vw;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
}

.login-dialog h3 {
  margin: 0 0 20px 0;
  color: #333;
  font-size: 18px;
  font-weight: 600;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  color: #666;
  font-size: 14px;
  font-weight: 500;
}

.form-group input[type="text"],
.form-group input[type="tel"],
.form-group input[type="password"] {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #d9d9d9;
  border-radius: 6px;
  font-size: 14px;
  transition: border-color 0.2s;
}

.form-group input:focus {
  outline: none;
  border-color: #1890ff;
  box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.2);
}

.form-group input[type="checkbox"] {
  margin-right: 8px;
}

.dialog-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 24px;
}

.cancel-btn {
  padding: 8px 16px;
  border: 1px solid #d9d9d9;
  border-radius: 6px;
  background-color: white;
  color: #666;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.cancel-btn:hover {
  border-color: #40a9ff;
  color: #40a9ff;
}

.confirm-btn {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  background-color: #1890ff;
  color: white;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.2s;
}

.confirm-btn:hover:not(:disabled) {
  background-color: #40a9ff;
}

.confirm-btn:disabled {
  background-color: #d9d9d9;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .login-dialog {
    width: 350px;
    padding: 20px;
  }
}
</style>

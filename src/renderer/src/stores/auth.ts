import { defineStore } from 'pinia';
import { AuthAPI } from '@services/api';

/**
 * 认证状态接口定义
 * 用于管理用户登录状态和相关凭证数据
 */
interface AuthState {
  isLogin: boolean;          // 用户是否已登录
  hgToken: string;           // 鹰角网络通行证令牌
  sklandCred: string;        // 森空岛身份凭证
  sklandSignToken: string;   // 森空岛签名令牌
  userId: string;            // 用户ID
  playerData: any;           // 玩家详细游戏数据
  bindingRoles: any[];       // 绑定的游戏角色列表
}

/**
 * API错误接口扩展
 * 增强错误对象以包含HTTP响应状态信息
 */
interface ApiError extends Error {
  response?: {
    status?: number;         // HTTP状态码
  };
  message: string;           // 错误消息
}

/**
 * 认证状态管理Store
 * 负责用户登录、登出、凭证管理和状态持久化
 */
export const useAuthStore = defineStore('auth', {
  // 初始状态定义
  state: (): AuthState => ({
    isLogin: false,          // 初始未登录状态
    hgToken: '',             // 初始为空令牌
    sklandCred: '',          // 初始为空凭证
    sklandSignToken: '',     // 初始为空签名令牌
    userId: '',              // 初始为空用户ID
    playerData: null,        // 初始无玩家数据
    bindingRoles: []         // 初始无绑定角色
  }),

  // 计算属性（Getters）
  getters: {
    /**
     * 获取用户昵称
     * 从玩家数据中提取昵称，若无则返回默认值
     */
    userName: (state) => state.playerData?.status?.name || '未知用户',

    /**
     * 获取用户等级
     * 从玩家数据中提取等级，若无则返回0
     */
    userLevel: (state) => state.playerData?.status?.level || 0,

    /**
     * 获取主要角色UID
     * 优先返回默认角色UID，若无则返回第一个角色的UID
     */
    mainUid: (state) => state.bindingRoles.find(role => role.isDefault)?.uid || state.bindingRoles[0]?.uid || '',

    /**
     * 检查是否有绑定角色
     * 返回是否有绑定角色的布尔值
     */
    hasBindingRoles: (state) => state.bindingRoles.length > 0
  },

  // 操作方法（Actions）
  actions: {
    /**
     * 通用登录流程处理
     * @param hgToken - 鹰角网络令牌
     * 处理完整的登录流程：获取授权码 → 获取森空岛凭证 → 获取用户数据
     */
    async handleLogin(hgToken: string) {
      try {
        // 1. 使用鹰角令牌获取OAuth2授权码
        const grantCode = await AuthAPI.getGrantCode(hgToken);

        // 2. 使用授权码获取森空岛身份凭证和签名令牌
        const { cred, token: signToken, userId } = await AuthAPI.getSklandCred(grantCode);

        // 3. 更新本地状态
        this.hgToken = hgToken;
        this.sklandCred = cred;
        this.sklandSignToken = signToken;
        this.userId = userId;
        this.isLogin = true;

        // 4. 获取用户绑定的游戏角色列表
        await this.fetchBindingRoles();

        // 5. 如果有绑定角色，获取详细的玩家游戏数据
        if (this.bindingRoles.length > 0) {
          await this.fetchPlayerData();
        }

        // 6. 将登录状态持久化到本地存储
        this.saveToLocalStorage();

        console.log('登录成功');

      } catch (error) {
        // 登录失败时清除所有状态
        this.logout();
        throw this.normalizeError(error);
      }
    },

    /**
     * 密码登录完整流程
     * @param phone - 手机号码
     * @param password - 密码
     * 通过手机号和密码进行登录
     */
    async loginWithPassword(phone: string, password: string) {
      const hgToken = await AuthAPI.loginByPassword(phone, password);
      await this.handleLogin(hgToken);
    },

    /**
     * 验证码登录完整流程
     * @param phone - 手机号码
     * @param code - 短信验证码
     * 通过手机号和验证码进行登录
     */
    async loginWithSmsCode(phone: string, code: string) {
      const hgToken = await AuthAPI.loginBySmsCode(phone, code);
      await this.handleLogin(hgToken);
    },

    /**
     * 保存登录状态到本地存储
     * 将当前认证状态序列化并存储到localStorage
     * 用于应用重启后恢复登录状态
     */
    saveToLocalStorage() {
      const authState = {
        isLogin: this.isLogin,           // 登录状态
        hgToken: this.hgToken,           // 鹰角令牌
        sklandCred: this.sklandCred,     // 森空岛凭证
        sklandSignToken: this.sklandSignToken, // 签名令牌
        userId: this.userId,             // 用户ID
        playerData: this.playerData,     // 玩家数据
        bindingRoles: this.bindingRoles, // 绑定角色
        timestamp: Date.now()            // 时间戳（用于过期检查）
      };
      localStorage.setItem('authState', JSON.stringify(authState));
    },

    /**
     * 退出登录
     * 清除所有认证状态和本地存储数据
     * 用户需要重新登录才能访问受保护的功能
     */
    logout() {
      // 重置所有状态到初始值
      this.isLogin = false;
      this.hgToken = '';
      this.sklandCred = '';
      this.sklandSignToken = '';
      this.userId = '';
      this.playerData = null;
      this.bindingRoles = [];

      // 清除本地存储的认证数据
      localStorage.removeItem('authState');

      console.log('退出登录成功');
    },

    /**
     * 从本地存储恢复登录状态
     * 应用启动时调用，尝试恢复之前的登录会话
     * @returns 恢复成功返回true，失败返回false
     */
    async restoreAuthState() {
      try {
        // 1. 从localStorage读取保存的认证状态
        const authStr = localStorage.getItem('authState');
        if (!authStr) {
          console.log('本地存储中没有登录状态');
          return false;
        }

        // 2. 解析JSON数据
        const authState = JSON.parse(authStr);

        // 3. 检查必要的数据完整性
        if (!authState.hgToken || !authState.sklandCred || !authState.sklandSignToken) {
          console.warn('本地存储的登录状态不完整');
          this.logout();
          return false;
        }

        // 4. 检查登录状态是否过期（7天有效期）
        const EXPIRY_TIME = 7 * 24 * 60 * 60 * 1000; // 7天
        if (authState.timestamp && (Date.now() - authState.timestamp > EXPIRY_TIME)) {
          console.warn('登录状态已过期');
          this.logout();
          return false;
        }

        // 5. 恢复所有状态到Store
        this.isLogin = authState.isLogin || false;
        this.hgToken = authState.hgToken;
        this.sklandCred = authState.sklandCred;
        this.sklandSignToken = authState.sklandSignToken;
        this.userId = authState.userId || '';
        this.playerData = authState.playerData || null;
        this.bindingRoles = authState.bindingRoles || [];

        console.log('从本地存储恢复登录状态成功');

        // 6. 验证凭证有效性并获取最新数据
        if (this.sklandCred && this.sklandSignToken) {
          try {
            // 验证cred是否仍然有效
            const isCredValid = await AuthAPI.checkCred(this.sklandCred);
            if (!isCredValid) {
              console.warn('Cred已失效，需要重新登录');
              this.logout();
              return false;
            }

            // 获取最新的绑定角色信息
            await this.fetchBindingRoles();

            console.log('登录状态验证成功');
            return true;
          } catch (error) {
            const normalizedError = this.normalizeError(error);
            console.warn('恢复登录状态时验证失败:', normalizedError.message);

            // 如果是网络问题，允许使用缓存的登录状态
            if (normalizedError.message.includes('Network') || normalizedError.message.includes('网络')) {
              console.log('网络问题，使用缓存的登录状态');
              return true;
            }

            // 其他错误清除登录状态
            this.logout();
            return false;
          }
        }

        return true;
      } catch (error) {
        const normalizedError = this.normalizeError(error);
        console.error('恢复登录状态失败:', normalizedError.message);
        this.logout();
        return false;
      }
    },

    /**
     * 获取绑定角色列表
     * 从森空岛API获取用户绑定的游戏角色信息
     * 会自动验证凭证有效性并更新本地存储
     */
    async fetchBindingRoles() {
      // 前置条件检查
      if (!this.sklandCred || !this.sklandSignToken) {
        throw new Error('未登录或登录凭证无效');
      }

      console.log('正在获取绑定角色列表...');

      try {
        // 1. 验证cred有效性
        const isCredValid = await AuthAPI.checkCred(this.sklandCred);
        if (!isCredValid) {
          console.warn('Cred已失效，需要重新登录');
          this.logout();
          throw new Error('登录已过期，请重新登录');
        }

        // 2. 获取绑定角色列表
        this.bindingRoles = await AuthAPI.getBindingRoles(this.sklandCred, this.sklandSignToken);
        console.log(`获取到 ${this.bindingRoles.length} 个绑定角色`);

        // 3. 更新本地存储
        this.saveToLocalStorage();
      } catch (error) {
        const normalizedError = this.normalizeError(error);
        console.error('获取绑定角色失败:', normalizedError.message);

        // 处理认证失败的情况
        if (normalizedError.message.includes('认证失败') ||
          normalizedError.message.includes('401') ||
          normalizedError.message.includes('登录已过期')) {
          this.logout();
          throw new Error('登录已过期，请重新登录');
        }
        throw normalizedError;
      }
    },

    /**
     * 获取玩家数据
     * 获取指定角色的详细游戏数据
     * 包括理智、干员、基建等信息
     */
    async fetchPlayerData() {
      // 前置条件检查
      if (!this.sklandCred || !this.sklandSignToken) {
        throw new Error('未登录或登录凭证无效');
      }

      if (!this.bindingRoles.length) {
        throw new Error('没有绑定角色');
      }

      // 选择默认角色或第一个角色
      const defaultUid = this.bindingRoles.find(role => role.isDefault)?.uid || this.bindingRoles[0].uid;
      console.log(`正在获取玩家数据，UID: ${defaultUid}`);

      try {
        // 调用API获取玩家数据
        this.playerData = await AuthAPI.getPlayerData(this.sklandCred, this.sklandSignToken, defaultUid);
        console.log('玩家数据获取成功');

        // 更新本地存储
        this.saveToLocalStorage();
      } catch (error) {
        const normalizedError = this.normalizeError(error);
        console.error('获取玩家数据失败:', normalizedError.message);

        // 处理认证失败的情况
        if (normalizedError.message.includes('认证失败') || normalizedError.message.includes('401')) {
          this.logout();
          throw new Error('登录已过期，请重新登录');
        }
        throw normalizedError;
      }
    },

    /**
     * 标准化错误对象
     * 将未知类型的错误转换为标准的Error对象
     * @param error - 原始错误对象
     * @returns 标准化的ApiError对象
     */
    normalizeError(error: unknown): ApiError {
      // 已经是Error实例
      if (error instanceof Error) {
        return error as ApiError;
      }

      // 字符串错误
      if (typeof error === 'string') {
        return new Error(error);
      }

      // 包含message属性的对象
      if (error && typeof error === 'object' && 'message' in error) {
        return new Error(String((error as any).message));
      }

      // 未知错误类型
      return new Error('未知错误');
    }
  }
});

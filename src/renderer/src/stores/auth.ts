import { defineStore } from 'pinia';
import { AuthAPI } from '@services/api';

/**
 * 认证状态接口定义
 */
interface AuthState {
  isLogin: boolean;
  hgToken: string;
  sklandCred: string;
  sklandSignToken: string;
  userId: string;
  playerData: any;
  bindingRoles: any[];
  // 新增缓存相关状态
  lastUpdated: number; // 最后更新时间戳
  cacheValid: boolean; // 缓存是否有效
  restoreAttempts: number; // 恢复尝试次数
}

/**
 * API错误接口扩展
 */
interface ApiError extends Error {
  response?: {
    status?: number;
  };
  message: string;
}

/**
 * 存储的认证状态接口
 */
interface StoredAuthState {
  isLogin: boolean;
  hgToken: string;
  sklandCred: string;
  sklandSignToken: string;
  userId: string;
  playerData: any;
  bindingRoles: any[];
  timestamp: number;
  lastUpdated: number;
  restoreAttempts: number;
  version?: string;
}

/**
 * 缓存配置 - 优化过期时间
 */
const CACHE_CONFIG = {
  // 本地存储过期时间：30天（延长存储时间）
  LOCAL_STORAGE_EXPIRY: 30 * 24 * 60 * 60 * 1000,
  // 玩家数据缓存时间：5分钟
  PLAYER_DATA_CACHE: 5 * 60 * 1000,
  // 角色列表缓存时间：10分钟
  ROLES_CACHE: 10 * 60 * 1000,
  // 凭证检查缓存时间：5分钟（延长验证缓存）
  CRED_CHECK_CACHE: 5 * 60 * 1000,
  // 最大恢复尝试次数
  MAX_RESTORE_ATTEMPTS: 3
};

/**
 * 优化后的认证状态管理Store
 * 重点解决登录状态持久化问题
 */
export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    isLogin: false,
    hgToken: '',
    sklandCred: '',
    sklandSignToken: '',
    userId: '',
    playerData: null,
    bindingRoles: [],
    lastUpdated: 0,
    cacheValid: false,
    restoreAttempts: 0
  }),

  getters: {
    userName: (state) => state.playerData?.status?.name || '未知用户',
    userLevel: (state) => state.playerData?.status?.level || 0,
    mainUid: (state) => state.bindingRoles.find(role => role.isDefault)?.uid || state.bindingRoles[0]?.uid || '',
    hasBindingRoles: (state) => state.bindingRoles.length > 0,

    /**
     * 检查玩家数据是否需要刷新
     */
    shouldRefreshPlayerData: (state): boolean => {
      if (!state.playerData) return true;
      return Date.now() - state.lastUpdated > CACHE_CONFIG.PLAYER_DATA_CACHE;
    },

    /**
     * 检查角色列表是否需要刷新
     */
    shouldRefreshRoles: (state): boolean => {
      if (state.bindingRoles.length === 0) return true;
      return Date.now() - state.lastUpdated > CACHE_CONFIG.ROLES_CACHE;
    },

    /**
     * 检查是否可以尝试恢复登录状态
     */
    canAttemptRestore: (state): boolean => {
      return state.restoreAttempts < CACHE_CONFIG.MAX_RESTORE_ATTEMPTS;
    }
  },

  actions: {
    /**
     * 优化后的通用登录流程 - 并行处理提升速度
     */
    async handleLogin(hgToken: string): Promise<void> {
      try {
        console.time('登录流程总耗时');

        // 1. 获取授权码
        const grantCode = await AuthAPI.getGrantCode(hgToken);

        // 2. 获取森空岛凭证
        const credResult = await AuthAPI.getSklandCred(grantCode);
        const { cred, token: signToken, userId } = credResult;

        // 3. 更新本地状态
        this.hgToken = hgToken;
        this.sklandCred = cred;
        this.sklandSignToken = signToken;
        this.userId = userId;
        this.isLogin = true;
        this.lastUpdated = Date.now();
        this.restoreAttempts = 0; // 重置恢复尝试次数

        // 4. 获取绑定角色
        await this.fetchBindingRoles();

        // 5. 如果有绑定角色，获取玩家数据
        if (this.bindingRoles.length > 0) {
          await this.fetchPlayerData();
        }

        // 6. 保存到本地存储
        await this.saveToLocalStorage();

        console.timeEnd('登录流程总耗时');
        console.log('登录成功');

      } catch (error) {
        console.error('登录失败:', error);
        this.logout();
        // 使用 return 而不是 throw 来避免本地捕获异常警告
        return Promise.reject(this.normalizeError(error));
      }
    },

    /**
     * 密码登录
     */
    async loginWithPassword(phone: string, password: string): Promise<void> {
      try {
        const hgToken = await AuthAPI.loginByPassword(phone, password);
        await this.handleLogin(hgToken);
      } catch (error) {
        return Promise.reject(this.normalizeError(error));
      }
    },

    /**
     * 验证码登录
     */
    async loginWithSmsCode(phone: string, code: string): Promise<void> {
      try {
        const hgToken = await AuthAPI.loginBySmsCode(phone, code);
        await this.handleLogin(hgToken);
      } catch (error) {
        return Promise.reject(this.normalizeError(error));
      }
    },

    /**
     * 优化保存到本地存储 - 确保数据完整保存
     */
    async saveToLocalStorage(): Promise<void> {
      return new Promise((resolve, reject) => {
        // 清除之前的定时器
        if ((this as any).saveTimeout) {
          clearTimeout((this as any).saveTimeout);
        }

        (this as any).saveTimeout = setTimeout(() => {
          try {
            const authState: StoredAuthState = {
              isLogin: this.isLogin,
              hgToken: this.hgToken,
              sklandCred: this.sklandCred,
              sklandSignToken: this.sklandSignToken,
              userId: this.userId,
              playerData: this.compressPlayerData(this.playerData),
              bindingRoles: this.bindingRoles,
              timestamp: Date.now(),
              lastUpdated: this.lastUpdated,
              restoreAttempts: this.restoreAttempts,
              // 添加版本标识，便于后续兼容性处理
              version: '1.0.0'
            };

            // 双重验证数据完整性
            if (!this.validateAuthStateForStorage(authState)) {
              console.warn('保存前的数据验证失败');
              reject(new Error('数据验证失败'));
              return;
            }

            localStorage.setItem('authState', JSON.stringify(authState));

            // 验证保存是否成功
            const savedData = localStorage.getItem('authState');
            if (!savedData) {
              reject(new Error('保存到本地存储失败'));
              return;
            }

            this.cacheValid = true;
            console.log('登录状态保存成功');
            resolve();
          } catch (error) {
            console.error('保存到本地存储失败:', error);
            reject(error);
          }
        }, 300); // 缩短防抖时间，确保及时保存
      });
    },

    /**
     * 压缩玩家数据，减少存储空间
     */
    compressPlayerData(playerData: any): any {
      if (!playerData) return null;

      // 只保留必要的基础信息
      return {
        status: playerData.status ? {
          name: playerData.status.name,
          level: playerData.status.level,
          registerTs: playerData.status.registerTs,
          mainStageProgress: playerData.status.mainStageProgress
        } : null,
        // 可以根据需要添加其他必要字段
        chars: playerData.chars ? { length: playerData.chars.length } : null
      };
    },

    /**
     * 退出登录 - 优化清理流程
     */
    logout(): void {
      console.log('开始执行退出登录流程...');

      // 清理状态
      this.isLogin = false;
      this.hgToken = '';
      this.sklandCred = '';
      this.sklandSignToken = '';
      this.userId = '';
      this.playerData = null;
      this.bindingRoles = [];
      this.lastUpdated = 0;
      this.cacheValid = false;
      this.restoreAttempts = 0;

      // 清理定时器
      if ((this as any).saveTimeout) {
        clearTimeout((this as any).saveTimeout);
        (this as any).saveTimeout = null;
      }

      // 清理本地存储
      try {
        localStorage.removeItem('authState');
        // 清理凭证检查缓存
        const cacheKeys = Object.keys(localStorage).filter(key => key.startsWith('cred_check_'));
        cacheKeys.forEach(key => localStorage.removeItem(key));
        console.log('本地存储清理完成');
      } catch (error) {
        console.warn('清理本地存储失败:', error);
      }

      console.log('退出登录成功');
    },

    /**
     * 优化恢复登录状态 - 增强健壮性和错误处理
     */
    async restoreAuthState(): Promise<boolean> {
      // 检查恢复尝试次数
      if (!this.canAttemptRestore) {
        console.warn('已达到最大恢复尝试次数，不再尝试恢复');
        return false;
      }

      this.restoreAttempts++;

      try {
        console.time('恢复登录状态耗时');
        console.log(`第 ${this.restoreAttempts} 次尝试恢复登录状态`);

        const authStr = localStorage.getItem('authState');
        if (!authStr) {
          console.log('本地存储中没有登录状态');
          return false;
        }

        let authState: StoredAuthState;
        try {
          authState = JSON.parse(authStr);
        } catch (parseError) {
          console.error('解析本地存储数据失败:', parseError);
          this.clearCorruptedStorage();
          return false;
        }

        // 检查数据完整性
        if (!this.validateAuthStateForRestore(authState)) {
          console.warn('本地存储的登录状态不完整或格式错误');
          this.clearCorruptedStorage();
          return false;
        }

        // 检查过期时间 - 使用更宽松的检查
        if (this.isAuthStateExpired(authState)) {
          console.warn('登录状态已过期');
          this.clearExpiredStorage();
          return false;
        }

        // 恢复状态
        this.isLogin = authState.isLogin || false;
        this.hgToken = authState.hgToken || '';
        this.sklandCred = authState.sklandCred || '';
        this.sklandSignToken = authState.sklandSignToken || '';
        this.userId = authState.userId || '';
        this.playerData = authState.playerData || null;
        this.bindingRoles = authState.bindingRoles || [];
        this.lastUpdated = authState.lastUpdated || 0;
        this.restoreAttempts = authState.restoreAttempts || 0;
        this.cacheValid = true;

        console.log('从本地存储恢复登录状态成功');

        // 异步验证凭证有效性（不阻塞恢复，且失败不自动登出）
        setTimeout(() => {
          this.validateCredInBackground().catch(error => {
            console.warn('后台验证凭证失败，但不影响当前登录状态:', error);
            // 这里不自动登出，让用户继续使用
          });
        }, 1000);

        console.timeEnd('恢复登录状态耗时');
        return true;

      } catch (error) {
        console.error('恢复登录状态失败:', error);
        // 恢复失败时不自动登出，保持当前状态
        return false;
      }
    },

    /**
     * 清理损坏的存储数据
     */
    clearCorruptedStorage(): void {
      try {
        localStorage.removeItem('authState');
        console.log('已清理损坏的存储数据');
      } catch (error) {
        console.warn('清理损坏存储数据失败:', error);
      }
    },

    /**
     * 清理过期的存储数据
     */
    clearExpiredStorage(): void {
      try {
        localStorage.removeItem('authState');
        console.log('已清理过期的存储数据');
      } catch (error) {
        console.warn('清理过期存储数据失败:', error);
      }
    },

    /**
     * 后台验证凭证有效性 - 优化为更宽松的验证
     */
    async validateCredInBackground(): Promise<boolean> {
      if (!this.sklandCred || !this.sklandSignToken) {
        console.warn('凭证信息不完整，跳过验证');
        return false;
      }

      try {
        const cacheKey = `cred_check_${this.userId}`;
        const cachedCheck = localStorage.getItem(cacheKey);

        // 检查缓存，避免频繁验证
        if (cachedCheck) {
          const { timestamp, isValid } = JSON.parse(cachedCheck);
          if (Date.now() - timestamp < CACHE_CONFIG.CRED_CHECK_CACHE) {
            console.log('使用缓存的凭证验证结果:', isValid);
            return isValid;
          }
        }

        console.log('开始验证凭证有效性...');

        // 实际验证 - 通过获取绑定角色来验证凭证有效性
        // 设置超时，避免长时间阻塞
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('验证超时')), 10000);
        });

        const verifyPromise = AuthAPI.getBindingRoles(this.sklandCred, this.sklandSignToken);

        await Promise.race([verifyPromise, timeoutPromise]);

        // 验证成功，更新缓存
        localStorage.setItem(cacheKey, JSON.stringify({
          timestamp: Date.now(),
          isValid: true
        }));

        console.log('凭证验证成功');
        return true;

      } catch (error) {
        console.warn('凭证验证失败:', error);

        // 验证失败，但不立即登出，更新缓存
        const cacheKey = `cred_check_${this.userId}`;
        localStorage.setItem(cacheKey, JSON.stringify({
          timestamp: Date.now(),
          isValid: false
        }));

        // 这里不自动登出，让用户继续尝试使用
        // 只有在用户主动操作时才提示重新登录
        return false;
      }
    },

    /**
     * 验证认证状态数据的完整性 - 存储前验证
     */
    validateAuthStateForStorage(authState: StoredAuthState): boolean {
      const requiredFields = ['hgToken', 'sklandCred', 'sklandSignToken'];
      const isValid = requiredFields.every(field =>
        authState[field] && typeof authState[field] === 'string' && authState[field].length > 0
      );

      if (!isValid) {
        console.warn('存储前验证失败，缺失必要字段:', requiredFields.filter(field => !authState[field]));
      }

      return isValid;
    },

    /**
     * 验证认证状态数据的完整性 - 恢复时验证
     */
    validateAuthStateForRestore(authState: StoredAuthState): boolean {
      // 恢复时的验证可以稍微宽松一些
      const requiredFields = ['sklandCred', 'sklandSignToken'];
      const isValid = requiredFields.every(field =>
        authState[field] && typeof authState[field] === 'string' && authState[field].length > 0
      );

      if (!isValid) {
        console.warn('恢复时验证失败，缺失必要字段:', requiredFields.filter(field => !authState[field]));
      }

      return isValid;
    },

    /**
     * 检查认证状态是否过期
     */
    isAuthStateExpired(authState: StoredAuthState): boolean {
      if (!authState.timestamp) return true;

      const expiryTime = authState.timestamp + CACHE_CONFIG.LOCAL_STORAGE_EXPIRY;
      const isExpired = Date.now() > expiryTime;

      if (isExpired) {
        console.log(`存储数据已过期，保存时间: ${new Date(authState.timestamp).toLocaleString()}`);
      }

      return isExpired;
    },

    /**
     * 优化获取绑定角色列表 - 添加缓存策略
     */
    async fetchBindingRoles(forceRefresh = false): Promise<any[]> {
      if (!this.sklandCred || !this.sklandSignToken) {
        // 使用 return 而不是 throw 来避免本地捕获异常警告
        return Promise.reject(new Error('未登录或登录凭证无效'));
      }

      // 使用缓存避免重复请求
      if (!forceRefresh && !this.shouldRefreshRoles && this.bindingRoles.length > 0) {
        console.log('使用缓存的角色列表');
        return this.bindingRoles;
      }

      console.log('正在获取绑定角色列表...');

      try {
        const roles = await AuthAPI.getBindingRoles(this.sklandCred, this.sklandSignToken);

        // 更新状态
        this.bindingRoles = roles;
        this.lastUpdated = Date.now();
        this.cacheValid = true;

        // 异步保存到本地存储
        this.saveToLocalStorage().catch(error => {
          console.warn('保存角色列表失败:', error);
        });

        console.log(`获取到 ${roles.length} 个绑定角色`);
        return roles;

      } catch (error) {
        const normalizedError = this.normalizeError(error);
        console.error('获取绑定角色失败:', normalizedError.message);

        if (this.isAuthError(normalizedError)) {
          console.warn('认证错误，需要重新登录');
          // 使用 return 而不是 throw 来避免本地捕获异常警告
          return Promise.reject(new Error('登录已过期，请重新登录'));
        }

        // 如果是网络错误，尝试使用缓存
        if (this.isNetworkError(normalizedError) && this.bindingRoles.length > 0) {
          console.warn('网络错误，使用缓存的角色列表');
          return this.bindingRoles;
        }

        // 使用 return 而不是 throw 来避免本地捕获异常警告
        return Promise.reject(normalizedError);
      }
    },

    /**
     * 优化获取玩家数据 - 添加缓存和降级策略
     */
    async fetchPlayerData(forceRefresh = false): Promise<any> {
      if (!this.sklandCred || !this.sklandSignToken) {
        // 使用 return 而不是 throw 来避免本地捕获异常警告
        return Promise.reject(new Error('未登录或登录凭证无效'));
      }

      if (!this.bindingRoles.length) {
        // 使用 return 而不是 throw 来避免本地捕获异常警告
        return Promise.reject(new Error('没有绑定角色'));
      }

      // 使用缓存避免重复请求
      if (!forceRefresh && !this.shouldRefreshPlayerData && this.playerData) {
        console.log('使用缓存的玩家数据');
        return this.playerData;
      }

      const defaultUid = this.bindingRoles.find(role => role.isDefault)?.uid || this.bindingRoles[0].uid;
      console.log(`正在获取玩家数据，UID: ${defaultUid}`);

      try {
        const playerData = await AuthAPI.getPlayerData(this.sklandCred, this.sklandSignToken, defaultUid);

        // 更新状态
        this.playerData = playerData;
        this.lastUpdated = Date.now();
        this.cacheValid = true;

        // 异步保存到本地存储
        this.saveToLocalStorage().catch(error => {
          console.warn('保存玩家数据失败:', error);
        });

        console.log('玩家数据获取成功');
        return playerData;

      } catch (error) {
        const normalizedError = this.normalizeError(error);
        console.error('获取玩家数据失败:', normalizedError.message);

        if (this.isAuthError(normalizedError)) {
          console.warn('认证错误，需要重新登录');
          // 使用 return 而不是 throw 来避免本地捕获异常警告
          return Promise.reject(new Error('登录已过期，请重新登录'));
        }

        // 如果是网络错误，尝试使用缓存
        if (this.isNetworkError(normalizedError) && this.playerData) {
          console.warn('网络错误，使用缓存的玩家数据');
          return this.playerData;
        }

        // 使用 return 而不是 throw 来避免本地捕获异常警告
        return Promise.reject(normalizedError);
      }
    },

    /**
     * 判断是否为认证错误
     */
    isAuthError(error: ApiError): boolean {
      const authErrorKeywords = ['认证失败', '401', '登录已过期', 'token', 'cred', 'unauthorized'];
      return authErrorKeywords.some(keyword =>
        error.message.toLowerCase().includes(keyword.toLowerCase()) ||
        (error.response && error.response.status === 401)
      );
    },

    /**
     * 判断是否为网络错误
     */
    isNetworkError(error: ApiError): boolean {
      const networkErrorKeywords = ['Network', '网络', 'timeout', '超时', 'fetch', 'net::'];
      return networkErrorKeywords.some(keyword =>
        error.message.toLowerCase().includes(keyword.toLowerCase())
      );
    },

    /**
     * 标准化错误对象
     */
    normalizeError(error: unknown): ApiError {
      if (error instanceof Error) {
        return error as ApiError;
      }

      if (typeof error === 'string') {
        return new Error(error);
      }

      if (error && typeof error === 'object' && 'message' in error) {
        return new Error(String((error as any).message));
      }

      return new Error('未知错误');
    }
  }
});

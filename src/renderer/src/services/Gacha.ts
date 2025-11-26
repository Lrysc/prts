// ============================================================================
// 基础配置
// ============================================================================

const isDev = import.meta.env.DEV;
const API_BASE = {
  ak: isDev ? '/api/ak' : 'https://ak.hypergryph.com',
  web: isDev ? '/api/web' : 'https://web-api.hypergryph.com'  // 修正这里
};

/**
 * 获取通用请求头
 */
const getCommonHeaders = () => {
  return {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36 Edg/142.0.0.0',
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  };
};

/**
 * 处理 API 响应
 */
const handleApiResponse = async (response: Response, apiName: string): Promise<any> => {
  if (!response.ok) {
    throw new Error(`${apiName} 请求失败: HTTP ${response.status}`);
  }

  const data = await response.json();
  console.log(`${apiName} 响应:`, data);

  if (data.code !== 0) {
    throw new Error(data.msg || `${apiName} 业务逻辑错误`);
  }

  return data;
};

// ============================================================================
// 核心抽卡 API
// ============================================================================

/**
 * 获取鹰角网络账户凭证（真正的抽卡凭证）
 * @param hgToken - 鹰角网络认证token
 * @returns 账户凭证字符串
 */
export const getHypergryphAccountToken = async (hgToken: string): Promise<string> => {
  const url = `${API_BASE.web}/account/info/hg`;  // 修正URL

  console.log('获取账户凭证请求:', {
    url,
    cookie: `ACCOUNT=${hgToken}`
  });

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      ...getCommonHeaders(),
      'Cookie': `ACCOUNT=${hgToken}`  // 正确的Cookie格式
    }
  });

  const data = await handleApiResponse(response, '获取账户凭证');

  if (!data.data?.content) {
    console.error('账户凭证响应结构异常:', data);
    throw new Error('获取账户凭证失败：响应格式异常');
  }

  console.log('账户凭证获取成功，长度:', data.data.content.length);
  return data.data.content;
};

/**
 * 获取卡池分类信息
 * @param accountToken - 真正的账户凭证（从getHypergryphAccountToken获取）
 * @param uid - 游戏UID
 * @returns 卡池分类信息
 */
export const getGachaCategories = async (accountToken: string, uid: string) => {
  const userInfo = { content: accountToken };
  const userInfoParam = encodeURIComponent(JSON.stringify(userInfo));
  const url = `${API_BASE.ak}/user/api/inquiry/gacha/cate?uid=${uid}&userInfo=${userInfoParam}`;

  console.log('获取卡池分类请求:', {
    url,
    uid,
    cookie: `ACCOUNT=${accountToken}`
  });

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      ...getCommonHeaders(),
      'Cookie': `ACCOUNT=${accountToken}`  // 正确的Cookie格式
    }
  });

  const data = await handleApiResponse(response, '获取卡池分类');
  return data.data;
};

/**
 * 获取抽卡记录
 * @param accountToken - 账户凭证
 * @param uid - 游戏UID
 * @param poolId - 卡池ID
 * @param page - 页码
 * @param size - 每页大小
 * @returns 抽卡记录
 */
export const getGachaRecords = async (
  accountToken: string,
  uid: string,
  poolId: string,
  page: number = 1,
  size: number = 20
) => {
  const userInfo = { content: accountToken };
  const userInfoParam = encodeURIComponent(JSON.stringify(userInfo));
  const url = `${API_BASE.ak}/user/api/inquiry/gacha/record?uid=${uid}&poolId=${poolId}&page=${page}&size=${size}&userInfo=${userInfoParam}`;

  console.log('获取抽卡记录请求:', {
    url,
    uid,
    poolId,
    cookie: `ACCOUNT=${accountToken}`
  });

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      ...getCommonHeaders(),
      'Cookie': `ACCOUNT=${accountToken}`  // 正确的Cookie格式
    }
  });

  const data = await handleApiResponse(response, '获取抽卡记录');
  return data.data;
};

// ============================================================================
// 导入API模块
// ============================================================================
import { AuthAPI } from './api';

// ============================================================================
// 简化的抽卡API接口（修正版）
// ============================================================================

export const SimpleGachaAPI = {
  getHypergryphTokenByPhonePassword: async (phone: string, password: string) => {
    return await AuthAPI.loginByPassword(phone, password);
  },

  getUserInfo: async (token: string) => {
    // 这里需要调用 getHypergryphAccountToken 来获取真正的抽卡凭证
    const accountToken = await getHypergryphAccountToken(token);
    return {
      content: accountToken  // 返回content字段，这是真正的凭证
    };
  },

  getGachaCategories: async (userInfo: any, _token: string, uid: string) => {
    // 使用userInfo.content作为accountToken
    const accountToken = userInfo?.content;
    if (!accountToken) {
      throw new Error('缺少有效的账户凭证');
    }
    const categories = await getGachaCategories(accountToken, uid);
    return categories;
  }
};

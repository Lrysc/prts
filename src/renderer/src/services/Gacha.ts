// ============================================================================
// 基础配置
// ============================================================================

import { logger } from './logger';

const isDev = import.meta.env.DEV;
const API_BASE = {
  ak: isDev ? '/api/ak' : 'https://ak.hypergryph.com',
  binding: isDev ? '/api/binding' : 'https://binding-api-account-prod.hypergryph.com',
  web: isDev ? '/api/hg' : 'https://as.hypergryph.com'
};

/**
 * 统一的HTTP请求函数，自动处理CORS问题
 */
const httpRequest = async (url: string, options: RequestInit = {}): Promise<Response> => {
  if (isDev) {
    // 开发环境：使用fetch和代理
    return fetch(url, options);
  } else {
    // 生产环境：使用Electron的API代理
    const result = await (window as any).api.apiRequest(url, options);
    
    if (!result.success) {
      throw new Error(result.error || `HTTP error: ${result.status || 'Unknown'}`);
    }
    
    // 模拟Response对象
    const mockHeaders = new Headers();
    if (result.headers) {
      Object.entries(result.headers).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          value.forEach(v => mockHeaders.append(key, v));
        } else {
          mockHeaders.set(key, value as string);
        }
      });
    }
    
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: mockHeaders,
      json: async () => result.data,
      text: async () => JSON.stringify(result.data)
    } as Response;
  }
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
 * 处理鹰角API响应（流程1-3，使用status字段）
 */
const handleHgApiResponse = async (response: Response, apiName: string): Promise<any> => {
  console.log(`${apiName} 响应状态:`, response.status, response.statusText);
  console.log(`${apiName} 响应头:`, Object.fromEntries(response.headers.entries()));
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error(`${apiName} 错误响应内容:`, errorText);
    throw new Error(`${apiName} 请求失败: HTTP ${response.status}`);
  }

  const data = await response.json();
  console.log(`${apiName} 响应:`, data);

  // 鹰角API使用status字段
  if (data.status !== 0) {
    throw new Error(data.msg || `${apiName} 业务逻辑错误`);
  }

  return data;
};

/**
 * 处理游戏API响应（流程4-6，使用code字段）
 */
const handleApiResponse = async (response: Response, apiName: string): Promise<any> => {
  console.log(`${apiName} 响应状态:`, response.status, response.statusText);
  console.log(`${apiName} 响应头:`, Object.fromEntries(response.headers.entries()));
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error(`${apiName} 错误响应内容:`, errorText);
    throw new Error(`${apiName} 请求失败: HTTP ${response.status}`);
  }

  const data = await response.json();
  console.log(`${apiName} 响应:`, data);

  // 游戏API使用code字段
  if (data.code !== 0) {
    throw new Error(data.msg || `${apiName} 业务逻辑错误`);
  }

  return data;
};

// ============================================================================
// 类型定义
// ============================================================================

export interface GachaCategory {
  id: string;
  name: string;
}

export interface GachaRecord {
  poolId: string;
  poolName: string;
  charId: string;
  charName: string;
  rarity: number;
  isNew: boolean;
  gachaTs: string;
  pos: number;
}

export interface GachaHistoryResponse {
  list: GachaRecord[];
  hasMore: boolean;
}

// ============================================================================
// 抽卡API实现 - 基于md文件流程
// ============================================================================

/**
 * 流程1：通过手机号密码获取token
 */
export const getTokenByPhonePassword = async (phone: string, password: string): Promise<string> => {
  return await logger.trackApiParams(
    'getTokenByPhonePassword',
    `${API_BASE.web}/user/auth/v1/token_by_phone_password`,
    {
      phone,
      password: password ? '[已隐藏]' : null,
      url: `${API_BASE.web}/user/auth/v1/token_by_phone_password`,
      method: 'POST',
      headers: getCommonHeaders()
    },
    async (validParams) => {
      const response = await httpRequest(validParams.url, {
        method: validParams.method,
        headers: validParams.headers,
        body: JSON.stringify({ phone: validParams.phone, password })
      });

      const data = await handleHgApiResponse(response, '获取token');
      return data.data.token;
    }
  );
};

/**
 * 流程2：OAuth2授权
 */
export const getOAuth2Grant = async (token: string): Promise<{ token: string; hgId: string }> => {
  return await logger.trackApiParams(
    'getOAuth2Grant',
    `${API_BASE.web}/user/oauth2/v2/grant`,
    {
      token: token ? token.substring(0, 20) + '...' : null,
      appCode: 'be36d44aa36bfb5b',
      type: 1,
      url: `${API_BASE.web}/user/oauth2/v2/grant`,
      method: 'POST',
      headers: getCommonHeaders()
    },
    async (validParams) => {
      const response = await fetch(validParams.url, {
        method: validParams.method,
        headers: validParams.headers,
        body: JSON.stringify({
          token: token,
          appCode: validParams.appCode,
          type: validParams.type
        })
      });

      const data = await handleHgApiResponse(response, 'OAuth2授权');
      return data.data;
    }
  );
};

/**
 * 流程3：获取x-role-token
 */
export const getU8TokenByUid = async (token: string, uid: string): Promise<string> => {
  return await logger.trackApiParams(
    'getU8TokenByUid',
    `${API_BASE.binding}/account/binding/v1/u8_token_by_uid`,
    {
      token: token ? token.substring(0, 20) + '...' : null,
      uid,
      url: `${API_BASE.binding}/account/binding/v1/u8_token_by_uid`,
      method: 'POST',
      headers: getCommonHeaders()
    },
    async (validParams) => {
      const response = await httpRequest(validParams.url, {
        method: validParams.method,
        headers: validParams.headers,
        body: JSON.stringify({ token, uid: validParams.uid })
      });

      const data = await handleHgApiResponse(response, '获取u8 token');
      return data.data.token;
    }
  );
};

/**
 * 流程4：角色登录获取cookie
 */
export const roleLogin = async (token: string): Promise<string> => {
  return await logger.trackApiParams(
    'roleLogin',
    `${API_BASE.ak}/user/api/role/login`,
    {
      token: token ? token.substring(0, 20) + '...' : null,
      source_from: '',
      share_type: '',
      share_by: '',
      url: `${API_BASE.ak}/user/api/role/login`,
      method: 'POST',
      headers: getCommonHeaders()
    },
    async (validParams) => {
      const response = await httpRequest(validParams.url, {
        method: validParams.method,
        headers: validParams.headers,
        body: JSON.stringify({
          token,
          source_from: validParams.source_from,
          share_type: validParams.share_type,
          share_by: validParams.share_by
        })
      });

      const data = await handleApiResponse(response, '角色登录');
  
      // 优先从响应体中获取cookie（通过代理处理）
      if (data.data && data.data.cookie) {
        console.log('从响应体获取到cookie:', data.data.cookie.substring(0, 50) + '...');
        return data.data.cookie;
      }
      
      // 备用方案：尝试从响应头获取（在Electron中应该能正常工作）
      const setCookieHeader = response.headers.get('set-cookie');
      if (setCookieHeader) {
        console.log('从响应头获取到cookie');
        const match = setCookieHeader.match(/ak-user-center=([^;]+)/);
        if (match) {
          return decodeURIComponent(match[1]);
        }
      }
      
      // 如果无法从响应头获取，返回空字符串
      console.warn('无法从响应头获取cookie，返回空字符串');
      return '';
    }
  );
};

/**
 * 流程5：获取卡池分类
 */
export const getGachaCategories = async (
  uid: string,
  cookie: string,
  roleToken: string,
  accountToken: string
): Promise<GachaCategory[]> => {
  const url = `${API_BASE.ak}/user/api/inquiry/gacha/cate?uid=${uid}`;
  
  const headers: Record<string, string> = {
    ...getCommonHeaders(),
    'Cookie': `ak-user-center=${cookie}`
  };
  
  // 在生产环境中，这些token可能为空
  if (roleToken) {
    headers['x-role-token'] = roleToken;
  }
  
  if (accountToken) {
    headers['x-account-token'] = accountToken;
  }

  return await logger.trackApiParams(
    'getGachaCategories',
    url,
    {
      uid,
      cookie: cookie ? '[已设置]' : null,
      roleToken: roleToken ? '[已设置]' : null,
      accountToken: accountToken ? '[已设置]' : null,
      url,
      method: 'GET',
      headers
    },
    async (validParams) => {
      const response = await httpRequest(validParams.url, {
        method: validParams.method,
        headers: validParams.headers
      });

      const data = await handleApiResponse(response, '获取卡池分类');
      return data.data;
    }
  );
};

/**
 * 流程6：获取抽卡记录
 */
export const getGachaHistory = async (
  uid: string,
  cookie: string,
  roleToken: string,
  accountToken: string,
  category: string,
  size: number = 10,
  pos?: number,
  gachaTs?: string
): Promise<GachaHistoryResponse> => {
  const params = new URLSearchParams({
    uid,
    category,
    size: size.toString()
  });
  
  if (pos !== undefined) {
    params.append('pos', pos.toString());
  }
  
  if (gachaTs) {
    params.append('gachaTs', gachaTs);
  }
  
  const url = `${API_BASE.ak}/user/api/inquiry/gacha/history?${params}`;
  
  const headers: Record<string, string> = {
    ...getCommonHeaders(),
    'Cookie': `ak-user-center=${cookie}`
  };
  
  // 在生产环境中，这些token可能为空
  if (roleToken) {
    headers['x-role-token'] = roleToken;
  }
  
  if (accountToken) {
    headers['x-account-token'] = accountToken;
  }

  return await logger.trackApiParams(
    'getGachaHistory',
    url,
    {
      uid,
      cookie: cookie ? '[已设置]' : null,
      roleToken: roleToken ? '[已设置]' : null,
      accountToken: accountToken ? '[已设置]' : null,
      category,
      size,
      pos,
      gachaTs,
      url,
      method: 'GET',
      headers
    },
    async (validParams) => {
      const response = await httpRequest(validParams.url, {
        method: validParams.method,
        headers: validParams.headers
      });

      const data = await handleApiResponse(response, '获取抽卡记录');
      console.log('getGachaHistory 完整响应 data:', data);
      console.log('getGachaHistory 返回的 data.data:', data.data);
      
      // 检查 data.data 是否存在且包含必要字段
      if (!data.data) {
        console.error('getGachaHistory data.data 为空:', data.data);
        // 返回一个默认的空结构，而不是抛出错误
        return {
          list: [],
          hasMore: false
        };
      }
      
      // 如果 data.data 不是预期的格式，尝试直接返回
      if (!data.data.hasOwnProperty('list') || !data.data.hasOwnProperty('hasMore')) {
        console.warn('getGachaHistory data.data 格式异常，可能为空响应:', data.data);
        return {
          list: [],
          hasMore: false
        };
      }
      
      return data.data;
    }
  );
};

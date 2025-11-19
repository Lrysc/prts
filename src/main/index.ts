import { app, shell, BrowserWindow, ipcMain, session, net } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

function createWindow(): void {
  // 创建浏览器窗口
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 500,
    minWidth: 900,
    minHeight: 500,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    icon: join(__dirname, '../../build/icon.ico'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true, // 启用webSecurity，正确解决CORS问题
      allowRunningInsecureContent: false
    }
  })

  // 设置 Windows 应用详情，解决任务栏显示问题
  if (process.platform === 'win32') {
    mainWindow.setAppDetails({
      appId: 'com.prts.app',
      appIconPath: join(__dirname, '../../build/icon.ico'),
      appIconIndex: 0,
      relaunchCommand: process.execPath,
      relaunchDisplayName: 'PRTS系统'
    })
  }

  // 允许跨域请求的域名列表
  const allowedOrigins = [
    'https://as.hypergryph.com',
    'https://zonai.skland.com',
    'https://www.skland.com'
  ];

  // 处理CORS预检请求和响应头
  mainWindow.webContents.session.webRequest.onBeforeSendHeaders(
    { urls: allowedOrigins.map(origin => `${origin}/*`) },
    (details, callback) => {
      const requestHeaders = {
        ...details.requestHeaders,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36 Edg/142.0.0.0',
        'sec-ch-ua': '"Chromium";v="142", "Microsoft Edge";v="142", "Not_A Brand";v="99"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'cross-site'
      };

      // 移除 Electron 相关的头
      delete requestHeaders['x-electron'];

      callback({ requestHeaders });
    }
  )

  // 处理响应头 - 添加CORS头
  mainWindow.webContents.session.webRequest.onHeadersReceived(
    { urls: allowedOrigins.map(origin => `${origin}/*`) },
    (details, callback) => {
      const responseHeaders = {
        ...details.responseHeaders,
        'Access-Control-Allow-Origin': ['*'],
        'Access-Control-Allow-Methods': ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        'Access-Control-Allow-Headers': ['*'],
        'Access-Control-Allow-Credentials': ['true'],
        'Access-Control-Max-Age': ['86400'] // 24小时缓存
      }

      // 如果是预检请求，直接返回成功
      if (details.method === 'OPTIONS') {
        callback({
          cancel: false,
          responseHeaders: {
            ...responseHeaders,
            'Content-Length': ['0'],
            'Content-Type': ['text/plain']
          }
        });
      } else {
        callback({ responseHeaders });
      }
    }
  )

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  // 处理外部链接打开
  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url).catch((err: Error) =>
      console.error('打开外部链接失败:', err)
    );
    return { action: 'deny' }
  })

  // 设置 CSP 策略 - 移除不安全的HTTP连接
  mainWindow.webContents.session.webRequest.onHeadersReceived(
    { urls: ['*://*/*'] },
    (details, callback) => {
      const responseHeaders = { ...details.responseHeaders }

      if (is.dev) {
        // 开发环境：只允许HTTPS和本地连接
        responseHeaders['Content-Security-Policy'] = [
          "default-src 'self' 'unsafe-inline' data: https:; " +
          "script-src 'self' 'unsafe-inline'; " +
          "style-src 'self' 'unsafe-inline'; " +
          "img-src 'self' data: https:; " +
          "font-src 'self' data:; " +
          "connect-src 'self' https: ws: " +
          "https://as.hypergryph.com https://zonai.skland.com https://www.skland.com; " +
          "object-src 'none'; " +
          "frame-ancestors 'none';"
        ]
      } else {
        // 生产环境：严格的安全策略
        responseHeaders['Content-Security-Policy'] = [
          "default-src 'self'; " +
          "script-src 'self' 'unsafe-inline'; " +
          "style-src 'self' 'unsafe-inline'; " +
          "img-src 'self' data: https:; " +
          "font-src 'self' data:; " +
          "connect-src 'self' https://as.hypergryph.com https://zonai.skland.com https://www.skland.com; " +
          "object-src 'none'; " +
          "frame-ancestors 'none'; " +
          "base-uri 'self'; " +
          "form-action 'self';"
        ]
      }

      callback({ responseHeaders })
    }
  )

  // 加载页面
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
      .catch((err: Error) => console.error('加载开发环境URL失败:', err));
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
      .catch((err: Error) => console.error('加载生产环境文件失败:', err));
  }
}

// 应用初始化
app.whenReady().then(() => {
  // 设置应用ID - 修复任务栏显示问题
  app.setAppUserModelId('com.prts.app')
  electronApp.setAppUserModelId('com.prts.app')

  // 权限请求处理
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    const allowedPermissions = ['clipboard-read', 'notifications'];
    callback(allowedPermissions.includes(permission));
  })

  // HTTP请求代理处理器 - 作为备用方案
  ipcMain.handle('proxy-request', async (_event, { url, options = {} }) => {
    try {
      console.log('代理请求:', url, options);

      const requestOptions: any = {
        method: options.method || 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...options.headers
        }
      };

      // 如果有请求体，添加body
      if (options.body) {
        requestOptions.body = JSON.stringify(options.body);
      }

      const response = await net.fetch(url, requestOptions);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, response: ${errorText}`);
      }

      const data = await response.json();
      return { success: true, data };
    } catch (error: unknown) {
      console.error('Proxy request failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return { success: false, error: errorMessage };
    }
  });

  // 额外的安全设置
  app.on('web-contents-created', (_event, contents) => {
    // 阻止导航到外部URL
    contents.on('will-navigate', (navigationEvent, navigationUrl) => {
      // 只允许本地开发服务器和生产环境文件，禁止HTTP链接
      const allowedOrigins = [
        'https://localhost:5173',
        'file://'
      ];

      if (!allowedOrigins.some(origin => navigationUrl.startsWith(origin))) {
        navigationEvent.preventDefault();
        console.warn('阻止导航到不安全的URL:', navigationUrl);
      }
    });

    // 阻止新窗口创建
    contents.setWindowOpenHandler(({ url }) => {
      // 只允许HTTPS链接
      if (url.startsWith('https://')) {
        shell.openExternal(url).catch((err: Error) =>
          console.error('打开外部链接失败:', err)
        );
      } else if (url.startsWith('http://')) {
        console.warn('阻止打开不安全的HTTP链接:', url);
      }
      return { action: 'deny' };
    });
  });

  // 窗口快捷键优化
  app.on('browser-window-created', (_event, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC测试
  ipcMain.on('ping', () => console.log('pong'))

  // 创建主窗口
  createWindow()

  // macOS激活处理
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// 窗口关闭处理
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

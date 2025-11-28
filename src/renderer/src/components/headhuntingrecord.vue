<template>
  <div class="headhunting-record">
    <div class="header">
      <h2>寻访记录</h2>
      <div class="actions">
        <button @click="exportGachaData" class="export-btn" title="导出寻访记录" :disabled="exportLoading">
          {{ exportLoading ? '导出中...' : '导出记录' }}
        </button>
        <button @click="importGachaData" class="import-btn" title="导入寻访记录">
          导入记录
        </button>
        <button 
          v-if="importedData.length > 0" 
          @click="exportMergedImportedData" 
          class="export-merged-btn" 
          title="导出合并后的导入数据"
        >
          导出合并
        </button>
      </div>
    </div>

    <!-- 导出加载提示 -->
    <div v-if="exportLoading" class="export-loading-overlay">
      <div class="export-loading-content">
        <div class="export-loading-spinner"></div>
        <p>正在导出寻访记录，请稍候...</p>
        <p class="export-progress">{{ exportProgress }}</p>
      </div>
    </div>

    <!-- 未登录提示 -->
    <div v-if="!authStore.isLogin" class="login-prompt">
      <div class="prompt-content">
        <img src="@assets/icon_user.svg" alt="用户图标" class="prompt-icon" />
        <h3>需要登录</h3>
        <p>请先登录鹰角网络通行证以查看寻访记录</p>
        <button @click="$emit('showLogin')" class="login-btn">立即登录</button>
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-else-if="loading" class="loading">
      <div class="loading-spinner"></div>
      <p>{{ loadingText }}</p>
    </div>

    <!-- 错误状态 -->
    <div v-else-if="error" class="error">
      <div class="error-content">
        <h3>加载失败</h3>
        <p>{{ error }}</p>
        <button @click="refreshGachaData" class="retry-btn">重试</button>
      </div>
    </div>

    <!-- 卡池列表 -->
    <div v-else-if="!selectedCategory && categories.length > 0" class="categories-list">
      <h3>选择卡池类型</h3>
      <div class="categories-grid">
        <div
          v-for="category in categories"
          :key="category.id"
          class="category-card"
          @click="selectCategory(category)"
        >
          <h4>{{ category.name.replace('\\n', ' ') }}</h4>
          <p class="category-poolname">{{ getPoolNameForCategory(category.id) }}</p>
        </div>
      </div>
    </div>

    <!-- 抽卡记录表格 -->
    <div v-else-if="selectedCategory && gachaRecords.length > 0" class="records-container">
      <!-- 回退图标按钮 -->
      <button @click="backToCategories" class="back-icon-btn" title="返回卡池列表">
        <img src="@assets/exit.png" alt="返回" class="back-icon-img" />
      </button>
      
      <div class="records-header">
        <h3>{{ selectedCategory.name.replace('\\n', ' ') }}</h3>
      </div>

      <div class="table-container">
        <table class="gacha-table">
          <thead>
            <tr>
              <th>序号</th>
              <th>干员名称</th>
              <th>星级</th>
              <th>获取时间</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(record, index) in currentPageRecords" :key="index">
              <td>{{ getRecordIndex(index) }}</td>
              <td>{{ record.charName }}</td>
              <td>
                <span class="rarity-badge" :class="`rarity-${record.rarity}`">
                  {{ getRarityText(record.rarity) }}
                </span>
              </td>
              <td>{{ formatTime(record.gachaTs) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 分页控件 -->
      <div class="pagination">
        <button 
          @click="prevPage" 
          :disabled="currentPage === 1 || loading"
          class="page-btn"
        >
          上一页
        </button>
        
        <span class="page-info">
          第 {{ currentPage }} 页
        </span>
        
        <button 
          @click="nextPage" 
          :disabled="!hasNextPage || loading"
          class="page-btn"
        >
          下一页
        </button>
      </div>
    </div>

    <!-- 无数据状态 -->
    <div v-else-if="selectedCategory && gachaRecords.length === 0" class="no-data">
      <!-- 回退图标按钮 -->
      <button @click="backToCategories" class="back-icon-btn" title="返回卡池列表">
        <img src="@assets/exit.png" alt="返回" class="back-icon-img" />
      </button>
      
      <div class="no-data-content">
        <h3>暂无数据</h3>
        <p>该卡池暂无抽卡记录</p>
      </div>
    </div>

    <!-- 无卡池状态 -->
    <div v-else class="no-data">
      <div class="no-data-content">
        <h3>暂无卡池</h3>
        <p>当前账号暂无可用卡池</p>
      </div>
    </div>

    <!-- 已导入的寻访记录 -->
    <div v-if="importedData.length > 0" class="imported-records">
      <div class="imported-header">
        <h3>已导入的寻访记录</h3>
        <button @click="clearImportedData" class="clear-btn" title="清除导入数据">
          清除数据
        </button>
      </div>
      
      <div class="imported-categories">
        <div
          v-for="(category, index) in importedData"
          :key="index"
          class="imported-category"
        >
          <h4 @click="toggleImportedCategory(index)">
            {{ category.categoryName }}
            <span class="toggle-icon">{{ expandedImportedCategories[index] ? '▼' : '▶' }}</span>
          </h4>
          
          <div v-if="expandedImportedCategories[index]" class="imported-records-table">
            <table class="gacha-table">
              <thead>
                <tr>
                  <th>序号</th>
                  <th>卡池名称</th>
                  <th>干员名称</th>
                  <th>星级</th>
                  <th>获取时间</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(record, recordIndex) in category.records" :key="recordIndex">
                  <td>{{ recordIndex + 1 }}</td>
                  <td>{{ record.poolName }}</td>
                  <td>{{ record.charName }}</td>
                  <td>
                    <span class="rarity-badge" :class="`rarity-${record.rarity}`">
                      {{ getRarityText(record.rarity) }}
                    </span>
                  </td>
                  <td>{{ formatTime(record.gachaTs) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '@stores/auth';
import { 
  getOAuth2Grant, 
  getU8TokenByUid, 
  roleLogin, 
  getGachaCategories, 
  getGachaHistory,
  type GachaCategory,
  type GachaRecord,
  type GachaHistoryResponse
} from '@services/Gacha';
import { showToast } from '@services/toastService';

// 定义组件事件
const emit = defineEmits<{
  showLogin: []
}>();

// 状态管理
const authStore = useAuthStore();

// 组件状态
const loading = ref(false);
const loadingText = ref('');
const error = ref<string | null>(null);

// 导出相关状态
const exportLoading = ref(false);
const exportProgress = ref('');

// 卡池相关状态
const categories = ref<GachaCategory[]>([]);
const selectedCategory = ref<GachaCategory | null>(null);
const gachaRecords = ref<GachaRecord[]>([]);
const categoryPoolNames = ref<Map<string, string>>(new Map());

// 导入数据相关状态
const importedData = ref<Array<{
  categoryName: string;
  categoryId?: string;
  records: GachaRecord[];
}>>([]);
const expandedImportedCategories = ref<Record<number, boolean>>({});

// 分页相关状态
const currentPage = ref(1);
const pageSize = 10;
const hasNextPage = ref(false);
const lastRecordPos = ref<number | null>(null);
const lastRecordTs = ref<string | null>(null);

// 计算属性
const currentPageRecords = computed(() => {
  const start = (currentPage.value - 1) * pageSize;
  const end = start + pageSize;
  return gachaRecords.value.slice(start, end);
});

// 方法
const refreshGachaData = async () => {
  if (!authStore.mainUid) {
    error.value = '未找到游戏UID';
    return;
  }

  loading.value = true;
  error.value = null;
  
  try {
    // 重置状态
    categories.value = [];
    selectedCategory.value = null;
    gachaRecords.value = [];
    currentPage.value = 1;
    lastRecordPos.value = null;
    lastRecordTs.value = null;

    // 执行完整的抽卡API流程
    await executeGachaFlow();
  } catch (err: unknown) {
    console.error('获取抽卡数据失败:', err);
    error.value = err instanceof Error ? err.message : '获取抽卡数据失败';
  } finally {
    loading.value = false;
  }
};

const executeGachaFlow = async () => {
  if (!authStore.hgToken || !authStore.mainUid) {
    throw new Error('缺少必要的认证信息');
  }

  const uid = authStore.mainUid;

  // 流程1-4：获取认证凭证
  loadingText.value = '正在获取认证凭证...';
  
  // 流程1：获取token（使用已有的hgToken）
  const token = authStore.hgToken;
  console.log('使用hgToken:', token.substring(0, 20) + '...');
  console.log('使用UID:', uid);
  
  // 流程2：OAuth2授权
  const oauthData = await getOAuth2Grant(token);
  
  // 流程3：获取x-role-token
  const roleToken = await getU8TokenByUid(oauthData.token, uid);
  
  // 流程4：角色登录获取cookie
  const cookie = await roleLogin(roleToken);
  
  // 流程5：获取卡池分类
  loadingText.value = '正在获取卡池列表...';
  const categoryList = await getGachaCategories(uid, cookie, roleToken, token);
  categories.value = categoryList;
  
  // 预先获取所有卡池的poolName
  loadingText.value = '正在获取卡池详细信息...';
  await loadAllPoolNames(uid, cookie, roleToken, token, categoryList);
  
  // 保存认证信息到本地存储，供后续使用
  localStorage.setItem('gacha_auth', JSON.stringify({
    uid,
    cookie,
    roleToken,
    accountToken: token
  }));
};

const selectCategory = async (category: GachaCategory) => {
  selectedCategory.value = category;
  currentPage.value = 1;
  lastRecordPos.value = null;
  lastRecordTs.value = null;
  
  await loadGachaRecords();
};

const loadGachaRecords = async () => {
  if (!selectedCategory.value || !authStore.mainUid) {
    return;
  }

  loading.value = true;
  error.value = null;
  loadingText.value = '正在加载抽卡记录...';

  try {
    // 获取保存的认证信息
    const authData = localStorage.getItem('gacha_auth');
    if (!authData) {
      throw new Error('认证信息已过期，请重新登录');
    }

    const { uid, cookie, roleToken, accountToken } = JSON.parse(authData);

    // 加载当前页数据
    const response = await getGachaHistory(
      uid,
      cookie,
      roleToken,
      accountToken,
      selectedCategory.value.id,
      pageSize,
      lastRecordPos.value || undefined,
      lastRecordTs.value || undefined
    );

    if (currentPage.value === 1) {
      // 第一页，直接替换数据
      gachaRecords.value = response.list;
    } else {
      // 后续页，追加数据
      gachaRecords.value.push(...response.list);
    }

    hasNextPage.value = response.hasMore;
    
    // 更新分页信息
    if (response.list.length > 0) {
      const lastRecord = response.list[response.list.length - 1];
      lastRecordPos.value = lastRecord.pos;
      lastRecordTs.value = lastRecord.gachaTs;
    }

  } catch (err: unknown) {
    console.error('加载抽卡记录失败:', err);
    error.value = err instanceof Error ? err.message : '加载抽卡记录失败';
  } finally {
    loading.value = false;
  }
};

const prevPage = () => {
  if (currentPage.value > 1) {
    currentPage.value--;
  }
};

const nextPage = async () => {
  if (hasNextPage.value && !loading.value) {
    currentPage.value++;
    await loadGachaRecords();
  } else if (!hasNextPage.value && !loading.value) {
    showToast('没有更多内容了');
  }
};

const backToCategories = () => {
  selectedCategory.value = null;
  gachaRecords.value = [];
  currentPage.value = 1;
  lastRecordPos.value = null;
  lastRecordTs.value = null;
};

const getRecordIndex = (index: number) => {
  return (currentPage.value - 1) * pageSize + index + 1;
};

const getRarityText = (rarity: number) => {
  const rarityMap: { [key: number]: string } = {
    1: '二星',
    2: '三星', 
    3: '四星',
    4: '五星',
    5: '六星'
  };
  return rarityMap[rarity] || `${rarity}星`;
};

const formatTime = (timestamp: string) => {
  const date = new Date(parseInt(timestamp));
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const getPoolNameForCategory = (categoryId: string) => {
  return categoryPoolNames.value.get(categoryId) || '';
};

// 导出寻访记录（原始数据格式）
const exportGachaData = async () => {
  if (categories.value.length === 0) {
    showToast('没有可导出的数据');
    return;
  }

  exportLoading.value = true;
  exportProgress.value = '准备导出...';

  try {
    // 获取保存的认证信息
    const authData = localStorage.getItem('gacha_auth');
    if (!authData) {
      showToast('认证信息已过期，无法导出数据');
      return;
    }
    
    const { uid, cookie, roleToken, accountToken } = JSON.parse(authData);
    
    // 创建原始数据格式的导出对象
    const rawDataExport = {
      exportTime: new Date().toISOString(),
      uid: uid,
      categories: [] as any[]
    };
    
    const totalCategories = categories.value.length;
    
    for (let i = 0; i < totalCategories; i++) {
      const category = categories.value[i];
      
      try {
        exportProgress.value = `正在导出卡池 ${i + 1}/${totalCategories}: ${category.name.replace('\\n', ' ')}`;
        
        // 使用现有的 getGachaHistory 函数来获取数据
        const allApiResponses: Array<{
          code: number;
          data: GachaHistoryResponse;
          msg: string;
        }> = [];
        const allRecords: GachaRecord[] = [];
        let currentPos: number | undefined = 0; // 第一次请求 pos=0
        let currentTs: string | undefined;
        let hasMore = true;
        let pageCount = 0;
        
        while (hasMore) {
          pageCount++;
          exportProgress.value = `正在导出卡池 ${i + 1}/${totalCategories}: ${category.name.replace('\\n', ' ')} (第${pageCount}页)`;
          
          const response = await getGachaHistory(
            uid,
            cookie,
            roleToken,
            accountToken,
            category.id,
            10, // 使用正常的分页大小
            currentPos,
            currentTs
          );
          
          console.log(`导出卡池 ${category.name} 的响应:`, response);
          
          // 创建模拟的原始API响应格式
          const mockRawData = {
            code: 0,
            data: response,
            msg: ''
          };
          allApiResponses.push(mockRawData);
          
          // 检查响应结构并更新分页参数
          if (response && response.list && Array.isArray(response.list)) {
            hasMore = response.hasMore;
            allRecords.push(...response.list);
            
            if (response.list.length > 0) {
              // 使用最后一条记录的 pos 和 gachaTs 作为下一页的参数
              const lastRecord = response.list[response.list.length - 1];
              currentPos = lastRecord.pos;
              currentTs = lastRecord.gachaTs;
            } else {
              hasMore = false;
            }
          } else {
            hasMore = false;
          }
        }
        
        // 保存合并后的数据，同时保留原始响应
        if (allRecords.length > 0) {
          rawDataExport.categories.push({
            categoryInfo: category,
            apiResponses: allApiResponses,
            mergedData: {
              code: 0,
              data: {
                list: allRecords,
                hasMore: false
              },
              msg: ''
            }
          });
        }
        
      } catch (err: unknown) {
        console.error(`导出卡池 ${category.name} 时发生错误:`, err);
        const errorMessage = err instanceof Error ? err.message : '未知错误';
        showToast(`导出卡池 ${category.name} 时发生错误: ${errorMessage}`);
      }
    }
    
    if (rawDataExport.categories.length === 0) {
      showToast('没有可导出的记录');
      return;
    }
    
    exportProgress.value = '正在生成文件...';
    
    // 创建并下载原始JSON文件
    const dataStr = JSON.stringify(rawDataExport, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `寻访记录_原始数据_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    showToast('寻访记录（原始数据格式）导出成功');
  } catch (err: unknown) {
    console.error('导出失败:', err);
    showToast('导出失败，请重试');
  } finally {
    exportLoading.value = false;
    exportProgress.value = '';
  }
};

// 导入寻访记录
const importGachaData = () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  
  input.onchange = (event) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        
        // 检查是否是新的导出格式（包含categories字段的对象）
        if (data && typeof data === 'object' && data.categories && Array.isArray(data.categories)) {
          // 新格式：提取categories数组
          importedData.value = data.categories.map((category: any) => ({
            categoryName: category.categoryInfo.name.replace('\\n', ' '),
            categoryId: category.categoryInfo.id,
            records: category.mergedData ? category.mergedData.data.list : []
          }));
        } else if (Array.isArray(data)) {
          // 旧格式：直接使用数组
          importedData.value = data;
        } else {
          showToast('文件格式错误');
          return;
        }
        expandedImportedCategories.value = {};
        
        showToast('寻访记录导入成功');
      } catch (error) {
        console.error('导入失败:', error);
        showToast('文件解析失败，请检查文件格式');
      }
    };
    
    reader.readAsText(file);
  };
  
  input.click();
};

// 切换导入卡池的展开/收起状态
const toggleImportedCategory = (index: number) => {
  expandedImportedCategories.value[index] = !expandedImportedCategories.value[index];
};

// 清除导入数据
const clearImportedData = () => {
  importedData.value = [];
  expandedImportedCategories.value = {};
  showToast('导入数据已清除');
};

// 导出合并后的导入数据
const exportMergedImportedData = () => {
  if (importedData.value.length === 0) {
    showToast('没有可导出的导入数据');
    return;
  }

  try {
    // 按卡池ID合并数据
    const mergedCategories = new Map();
    
    for (const category of importedData.value) {
      const categoryId = category.categoryId || category.categoryName;
      
      if (!mergedCategories.has(categoryId)) {
        // 如果这个卡池还没有数据，创建新的条目
        mergedCategories.set(categoryId, {
          categoryName: category.categoryName,
          categoryId: category.categoryId || categoryId,
          records: []
        });
      }
      
      // 合并记录
      const existingCategory = mergedCategories.get(categoryId);
      existingCategory.records.push(...category.records);
    }
    
    // 去重并排序记录（按时间戳）
    for (const category of mergedCategories.values()) {
      // 按gachaTs去重（保留最新的记录）
      const uniqueRecords = new Map();
      for (const record of category.records) {
        const key = `${record.charId}_${record.gachaTs}`;
        if (!uniqueRecords.has(key) || record.gachaTs > uniqueRecords.get(key).gachaTs) {
          uniqueRecords.set(key, record);
        }
      }
      
      // 转换为数组并按时间戳排序（最新的在前）
      category.records = Array.from(uniqueRecords.values())
        .sort((a, b) => new Date(b.gachaTs).getTime() - new Date(a.gachaTs).getTime());
    }
    
    // 创建导出数据
    const mergedData = Array.from(mergedCategories.values());
    
    // 创建并下载JSON文件
    const dataStr = JSON.stringify({
      exportTime: new Date().toISOString(),
      exportType: 'merged_imported_data',
      totalCategories: mergedData.length,
      categories: mergedData
    }, null, 2);
    
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `合并寻访记录_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    showToast(`合并寻访记录导出成功，共${mergedData.length}个卡池`);
  } catch (err: unknown) {
    console.error('导出合并数据失败:', err);
    showToast('导出合并数据失败，请重试');
  }
};

const loadAllPoolNames = async (
  uid: string,
  cookie: string,
  roleToken: string,
  accountToken: string,
  categoryList: GachaCategory[]
) => {
  const promises = categoryList.map(async (category) => {
    try {
      const response = await getGachaHistory(
        uid,
        cookie,
        roleToken,
        accountToken,
        category.id,
        1, // 只获取1条记录来获取poolName
        undefined,
        undefined
      );
      
      if (response.list.length > 0) {
        const firstRecord = response.list[0];
        categoryPoolNames.value.set(category.id, firstRecord.poolName);
      }
    } catch (error) {
      console.warn(`获取卡池 ${category.id} 的poolName失败:`, error);
    }
  });
  
  await Promise.all(promises);
};

// 生命周期
onMounted(() => {
  if (authStore.isLogin) {
    refreshGachaData();
  }
});
</script>

<style scoped>
.headhunting-record {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
  color: white;
  min-height: calc(100vh - 120px);
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  background: #2d2d2d;
  padding: 20px;
  border-radius: 8px;
  border: 1px solid #404040;
}

.header h2 {
  margin: 0;
  color: #ffffff;
  font-size: 24px;
  font-weight: 600;
}

.actions {
  display: flex;
  gap: 12px;
}

.refresh-btn {
  padding: 10px 20px;
  border: 1px solid #404040;
  border-radius: 6px;
  background: #3a3a3a;
  color: #ccc;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 8px;
}

.refresh-btn:hover:not(:disabled) {
  background: #4a4a4a;
  color: #ffffff;
  border-color: #646cff;
}

.refresh-btn:disabled {
  background: #2d2d2d;
  color: #666;
  cursor: not-allowed;
  border-color: #404040;
}

/* 导出加载提示样式 */
.export-loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.export-loading-content {
  background: #2d2d2d;
  border: 1px solid #404040;
  border-radius: 12px;
  padding: 30px;
  text-align: center;
  max-width: 400px;
  width: 90%;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

.export-loading-spinner {
  width: 50px;
  height: 50px;
  border: 4px solid #404040;
  border-top: 4px solid #646cff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 20px;
}

.export-loading-content p {
  margin: 8px 0;
  color: #ccc;
  font-size: 16px;
  line-height: 1.5;
}

.export-progress {
  color: #646cff !important;
  font-weight: 500;
  font-size: 14px !important;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* 登录提示样式 */
.login-prompt {
  background: #2d2d2d;
  border-radius: 8px;
  padding: 40px;
  text-align: center;
  border: 1px solid #404040;
}

.prompt-content {
  max-width: 400px;
  margin: 0 auto;
}

.prompt-icon {
  width: 64px;
  height: 64px;
  margin-bottom: 20px;
  opacity: 0.6;
  filter: brightness(0) invert(0.6);
}

.login-prompt h3 {
  margin: 0 0 12px 0;
  color: #ffffff;
  font-size: 20px;
  font-weight: 600;
}

.login-prompt p {
  margin: 0 0 24px 0;
  color: #ccc;
  font-size: 14px;
  line-height: 1.5;
}

.login-btn {
  padding: 12px 24px;
  border: 1px solid #404040;
  border-radius: 6px;
  background: #3a3a3a;
  color: #ccc;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
}

.login-btn:hover {
  background: #4a4a4a;
  color: #ffffff;
  border-color: #646cff;
}

/* 加载和错误状态 */
.loading, .error {
  background: #2d2d2d;
  border-radius: 8px;
  padding: 40px;
  text-align: center;
  border: 1px solid #404040;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #404040;
  border-top: 4px solid #646cff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 16px;
}

.loading p, .error h3, .error p {
  margin: 8px 0;
  color: #ccc;
  font-size: 14px;
}

.error h3 {
  color: #ff6b6b;
  font-weight: 600;
}

.retry-btn {
  padding: 10px 20px;
  border: 1px solid #404040;
  border-radius: 6px;
  background: #3a3a3a;
  color: #ccc;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
  margin-top: 16px;
}

.retry-btn:hover {
  background: #4a4a4a;
  color: #ffffff;
  border-color: #646cff;
}

/* 卡池列表样式 */
.categories-list {
  background: #2d2d2d;
  border-radius: 8px;
  padding: 24px;
  border: 1px solid #404040;
}

.categories-list h3 {
  margin: 0 0 20px 0;
  color: #ffffff;
  font-size: 18px;
  font-weight: 600;
}

.categories-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 16px;
}

.category-card {
  background: #3a3a3a;
  border: 1px solid #404040;
  border-radius: 8px;
  padding: 20px;
  cursor: pointer;
  transition: all 0.2s;
  text-align: center;
}

.category-card:hover {
  border-color: #646cff;
  background: #4a4a4a;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(100, 108, 255, 0.15);
}

.category-card h4 {
  margin: 0 0 8px 0;
  color: #ffffff;
  font-size: 16px;
  font-weight: 600;
}

.category-id {
  margin: 0;
  color: #ccc;
  font-size: 12px;
  font-family: monospace;
}

.category-poolname {
  margin: 0;
  color: #999;
  font-size: 12px;
  font-style: italic;
}

/* 记录表格样式 */
.records-container {
  background: #2d2d2d;
  border-radius: 8px;
  padding: 24px;
  border: 1px solid #404040;
  position: relative;
}

.records-header {
  display: flex;
  justify-content: center;
  align-items: center;
  margin-bottom: 20px;
  text-align: center;
}

.records-header h3 {
  margin: 0;
  color: #ffffff;
  font-size: 18px;
  font-weight: 600;
}

.table-container {
  overflow-x: auto;
  margin-bottom: 20px;
  border: 1px solid #404040;
  border-radius: 8px;
}

.gacha-table {
  width: 100%;
  border-collapse: collapse;
  background: #2d2d2d;
}

.gacha-table th {
  background: #3a3a3a;
  padding: 12px 16px;
  text-align: left;
  font-weight: 600;
  color: #ffffff;
  border-bottom: 2px solid #404040;
  font-size: 14px;
}

.gacha-table td {
  padding: 12px 16px;
  border-bottom: 1px solid #404040;
  font-size: 14px;
  color: #ccc;
}

.gacha-table tr:hover {
  background: #3a3a3a;
}

.rarity-badge {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  display: inline-block;
}

.rarity-1 { background: rgba(155, 250, 100, 0.2); color: #85ff47; }
.rarity-2 { background: rgba(39, 167, 226, 0.2); color: #419ce2; }
.rarity-3 { background: rgba(162, 40, 238, 0.2); color: #8d7cff; }
.rarity-4 { background: rgba(243, 229, 30, 0.2); color: #fffb18; }
.rarity-5 { background: rgba(255, 150, 30, 0.2); color: #ff6b6b; }

/* 分页控件 */
.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  padding: 16px 0;
}

.page-btn {
  padding: 8px 16px;
  border: 1px solid #404040;
  border-radius: 6px;
  background: #3a3a3a;
  color: #ccc;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.page-btn:hover:not(:disabled) {
  border-color: #646cff;
  color: #ffffff;
  background: #4a4a4a;
}

.page-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-info {
  color: #ccc;
  font-size: 14px;
  font-weight: 500;
}

/* 无数据状态 */
.no-data {
  background: #2d2d2d;
  border-radius: 8px;
  padding: 40px;
  text-align: center;
  border: 1px solid #404040;
}

.no-data-content h3 {
  margin: 0 0 12px 0;
  color: #ccc;
  font-size: 18px;
  font-weight: 500;
}

.no-data-content p {
  margin: 0 0 20px 0;
  color: #999;
  font-size: 14px;
}

/* 回退图标样式 */
.back-icon-btn {
  position: absolute;
  top: 20px;
  left: 20px;
  width: 40px;
  height: 40px;
  border: 1px solid #404040;
  border-radius: 6px;
  background: #3a3a3a;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  z-index: 10;
}

.back-icon-btn:hover {
  border-color: #646cff;
  background: #4a4a4a;
}

.back-icon-img {
  width: 20px;
  height: 20px;
  /* 镜面反转 (transform: scaleX(-1)) + 白色滤镜 */
  transform: scaleX(-1);
  filter: brightness(0) invert(1);
  transition: all 0.2s;
}

.back-icon-btn:hover .back-icon-img {
  /* hover时变为蓝色 */
  filter: brightness(0) saturate(100%) invert(42%) sepia(91%) saturate(1352%) hue-rotate(202deg) brightness(97%) contrast(89%);
}

/* 导出导入按钮样式 */
.export-btn, .import-btn, .clear-btn {
  padding: 10px 20px;
  border: 1px solid #404040;
  border-radius: 6px;
  background: #3a3a3a;
  color: #ccc;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
}

.export-btn:hover:not(:disabled), .import-btn:hover, .export-merged-btn:hover {
  background: #4a4a4a;
  color: #ffffff;
  border-color: #646cff;
}

.export-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  background: #2d2d2d;
}

.export-merged-btn {
  padding: 10px 20px;
  border: 1px solid #404040;
  border-radius: 6px;
  background: #2a5a2a;
  color: #ccc;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
}

.clear-btn:hover {
  background: #4a4a4a;
  color: #ff6b6b;
  border-color: #ff6b6b;
}

/* 导入记录样式 */
.imported-records {
  background: #2d2d2d;
  border-radius: 8px;
  padding: 24px;
  border: 1px solid #404040;
  margin-top: 24px;
}

.imported-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid #404040;
}

.imported-header h3 {
  margin: 0;
  color: #ffffff;
  font-size: 18px;
  font-weight: 600;
}

.imported-categories {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.imported-category {
  background: #3a3a3a;
  border: 1px solid #404040;
  border-radius: 8px;
  overflow: hidden;
}

.imported-category h4 {
  margin: 0;
  padding: 16px 20px;
  color: #ffffff;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: background 0.2s;
}

.imported-category h4:hover {
  background: #4a4a4a;
}

.toggle-icon {
  font-size: 12px;
  color: #999;
  transition: transform 0.2s;
}

.imported-records-table {
  border-top: 1px solid #404040;
  overflow-x: auto;
}

.imported-records-table .gacha-table {
  margin: 0;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .headhunting-record {
    padding: 16px;
  }
  
  .header {
    flex-direction: column;
    gap: 16px;
    padding: 16px;
  }
  
  .actions {
    flex-direction: column;
    width: 100%;
  }
  
  .export-btn, .import-btn {
    width: 100%;
  }
  
  .categories-grid {
    grid-template-columns: 1fr;
  }
  
  .records-header {
    flex-direction: column;
    gap: 12px;
    align-items: flex-start;
  }
  
  .table-container {
    font-size: 12px;
  }
  
  .gacha-table th,
  .gacha-table td {
    padding: 8px 12px;
  }
  
  .pagination {
    flex-direction: column;
    gap: 12px;
  }
  
  .imported-header {
    flex-direction: column;
    gap: 12px;
    align-items: flex-start;
  }
}
</style>
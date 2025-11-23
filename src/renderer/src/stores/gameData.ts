import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { AuthAPI } from '@services/api';
import { useAuthStore } from '@stores/auth';
import { showSuccess, showError } from '@services/toastService';
import { logger } from '@services/logger';

// ========== 类型定义 ==========

interface ApInfo {
  current: number;
  max: number;
  remainSecs: number;
  recoverTime: number;
}

interface TrainingInfo {
  isNull: boolean;
  traineeIsNull: boolean;
  trainerIsNull: boolean;
  status: number;
  remainSecs: number;
  completeTime: number;
  trainee: string;
  trainer: string;
  profession: string;
  targetSkill: number;
  totalPoint: number;
  remainPoint: number;
  changeRemainSecsIrene: number;
  changeTimeIrene: number;
  changeRemainSecsLogos: number;
  changeTimeLogos: number;
}

interface RecruitInfo {
  isNull: boolean;
  max: number;
  complete: number;
  remainSecs: number;
  completeTime: number;
}

interface HireInfo {
  isNull: boolean;
  count: number;
  max: number;
  remainSecs: number;
  completeTime: number;
}

interface TradingStation {
  strategy: string;
  max: number;
  current: number;
  completeTime: number;
  remainSecs: number;
}

interface TradingsInfo {
  isNull: boolean;
  current: number;
  max: number;
  remainSecs: number;
  completeTime: number;
  tradings: TradingStation[];
}

interface ManufactureStation {
  formula: string;
  max: number;
  current: number;
  completeTime: number;
  remainSecs: number;
}

interface ManufacturesInfo {
  isNull: boolean;
  current: number;
  max: number;
  remainSecs: number;
  completeTime: number;
  manufactures: ManufactureStation[];
}

interface LaborInfo {
  current: number;
  max: number;
  remainSecs: number;
  recoverTime: number;
}

interface DormitoriesInfo {
  isNull: boolean;
  current: number;
  max: number;
}

interface TiredInfo {
  current: number;
  remainSecs: number;
}

interface RecruitSlot {
  slotIndex: number;
  state: number;
  status: string;
  startTime: string;
  finishTime: string;
  startTs: number;
  finishTs: number;
}

interface TradingDetail {
  stationIndex: number;
  strategy: string;
  strategyName: string;
  current: number;
  max: number;
  progress: number;
  remainSecs: number;
  remainingTime: string;
  completeTime: string;
}

interface ManufactureDetail {
  stationIndex: number;
  formula: string;
  current: number;
  max: number;
  progress: number;
  remainSecs: number;
  remainingTime: string;
  completeTime: string;
}

/**
 * 游戏数据状态管理Store
 * 负责玩家游戏数据的获取、缓存和状态管理
 * 包含理智计算、任务进度、基建状态等核心功能
 * 基于Kotlin代码逻辑完整实现各项功能
 */
export const useGameDataStore = defineStore('gameData', () => {
  // ========== 状态定义 ==========
  const isLoading = ref(true);
  const errorMsg = ref('');
  const playerData = ref<any>(null);
  const isRefreshing = ref(false);
  const lastUpdateTime = ref(0);
  const currentTime = ref(Math.floor(Date.now() / 1000));
  const userAvatar = ref('');
  const avatarLoadError = ref(false);

  // ========== 缓存配置 ==========
  const CACHE_DURATION = 5 * 60 * 1000;
  const dataCache = ref<{ data: any; timestamp: number } | null>(null);

  // ========== 依赖注入 ==========
  const authStore = useAuthStore();

  // ========== 定时器 ==========
  let timeUpdateInterval: NodeJS.Timeout | null = null;

  // ========== 工具函数 ==========

  /**
   * 获取当前最新时间戳（秒级）
   * @returns 当前时间戳（秒）
   */
  const getCurrentTimestamp = (): number => {
    return currentTime.value;
  };

  /**
   * 格式化时间戳为本地日期时间
   * @param ts - 时间戳（秒级）
   * @returns 格式化的日期时间字符串
   */
  const formatTimestamp = (ts?: number): string => {
    if (!ts || ts <= 0) return '未知';
    return new Date(ts * 1000).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  /**
   * 从秒数格式化恢复时间
   * 将秒数转换为易读的时间格式（小时和分钟）
   * @param seconds - 剩余秒数
   * @returns 格式化的时间字符串
   */
  const formatRecoveryTimeFromSeconds = (seconds: number): string => {
    if (!seconds || seconds <= 0) return '已完成';

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) return `${hours}小时${minutes}分钟`;
    return `${minutes}分钟`;
  };

  /**
   * 格式化理智恢复时间
   * 将秒数转换为易读的时间格式
   * @param recoveryTs - 恢复完成时间戳（秒级）
   * @returns 格式化的时间字符串（如"2小时30分钟"）
   */
  const formatRecoveryTime = (recoveryTs?: number): string => {
    if (!recoveryTs || recoveryTs <= 0) return '已回满';
    const now = getCurrentTimestamp();
    const diff = recoveryTs - now;

    if (diff <= 0) return '已回满';

    const hours = Math.floor(diff / 3600);
    const minutes = Math.floor((diff % 3600) / 60);

    if (hours > 0) return `${hours}小时${minutes}分钟`;
    return `${minutes}分钟`;
  };

  // ========== 基于Kotlin代码的核心计算逻辑 ==========

  /**
   * 计算实际理智数值 - 基于Kotlin代码逻辑
   * 根据恢复时间动态计算当前实际理智值
   * @param apData - 理智数据对象
   * @returns 包含当前理智、最大理智、剩余恢复时间等信息的对象
   */
  const calculateActualAp = (apData: any): ApInfo => {
    if (!apData) return { current: 0, max: 0, remainSecs: -1, recoverTime: -1 };

    const currentTs = getCurrentTimestamp();
    const max = apData.max || 130;
    const current = apData.current || 0;
    const completeRecoveryTime = apData.completeRecoveryTime || 0;

    // 基于Kotlin代码的逻辑
    if (current >= max) {
      return {
        current: current,
        max: max,
        remainSecs: -1,
        recoverTime: -1
      };
    }

    if (completeRecoveryTime < currentTs) {
      return {
        current: max,
        max: max,
        remainSecs: -1,
        recoverTime: -1
      };
    }

    // 计算实际当前理智：最大理智 - (剩余恢复时间 / 6分钟 + 1)
    const actualCurrent = max - Math.floor((completeRecoveryTime - currentTs) / (60 * 6) + 1);
    const remainSecs = completeRecoveryTime - currentTs;

    return {
      current: Math.max(0, actualCurrent),
      max: max,
      remainSecs: remainSecs,
      recoverTime: completeRecoveryTime
    };
  };

  /**
   * 计算训练室信息 - 基于Kotlin代码逻辑
   * @param training - 训练室数据
   * @param charInfoMap - 角色信息映射表
   * @returns 训练室详细信息
   */
  const calculateTrainingInfo = (training: any, charInfoMap: any): TrainingInfo => {
    if (!training) {
      return {
        isNull: true,
        traineeIsNull: true,
        trainerIsNull: true,
        status: -1,
        remainSecs: -1,
        completeTime: -1,
        trainee: '',
        trainer: '',
        profession: '',
        targetSkill: 0,
        totalPoint: 1,
        remainPoint: 1,
        changeRemainSecsIrene: -1,
        changeTimeIrene: -1,
        changeRemainSecsLogos: -1,
        changeTimeLogos: -1
      };
    }

    const currentTs = getCurrentTimestamp();
    const result: TrainingInfo = {
      isNull: false,
      traineeIsNull: !training.trainee,
      trainerIsNull: !training.trainer,
      status: -1,
      remainSecs: training.remainSecs || -1,
      completeTime: -1,
      trainee: '',
      trainer: '',
      profession: '',
      targetSkill: 0,
      totalPoint: 1,
      remainPoint: 1,
      changeRemainSecsIrene: -1,
      changeTimeIrene: -1,
      changeRemainSecsLogos: -1,
      changeTimeLogos: -1
    };

    // 处理训练干员信息
    if (training.trainee && training.trainee.charId) {
      const charInfo = charInfoMap?.[training.trainee.charId];
      if (charInfo) {
        result.trainee = charInfo.name;
        result.profession = charInfo.profession;
        result.targetSkill = (training.trainee.targetSkill || 0) + 1;
      }
    }

    // 处理协助者信息
    if (training.trainer && training.trainer.charId) {
      const charInfo = charInfoMap?.[training.trainer.charId];
      if (charInfo) {
        result.trainer = charInfo.name;
      }
    }

    // 处理训练状态
    if (training.remainSecs !== undefined && training.remainSecs !== null) {
      result.remainSecs = training.remainSecs;
      result.completeTime = training.remainSecs + currentTs;

      if (training.remainSecs === 0) {
        // 专精完成
        result.status = 0;
        result.totalPoint = 1;
        result.remainPoint = 0;
      } else if (training.remainSecs === -1) {
        // 空闲中
        result.status = -1;
        result.totalPoint = 1;
        result.remainPoint = 1;
      } else {
        // 训练中
        result.status = 1;

        if (training.speed) {
          result.remainPoint = Math.floor(training.remainSecs * training.speed);
          const totalPointCalc = Math.floor(
            ((currentTs - (training.lastUpdateTime || currentTs)) * training.speed) + result.remainPoint
          );
          result.totalPoint = getTotalPoint(totalPointCalc);

          // 计算Irene和Logos转换时间点
          const targetPointIrene = (result.profession === "SNIPER" || result.profession === "WARRIOR") ? 24300 : 18900;
          const targetPointLogos = (result.profession === "CASTER" || result.profession === "SUPPORT") ? 24300 : 18900;

          if (result.remainPoint > targetPointIrene) {
            const secs = (result.remainPoint - targetPointIrene) / training.speed;
            result.changeRemainSecsIrene = Math.floor(secs);
            result.changeTimeIrene = currentTs + Math.floor(secs);
          }

          if (result.remainPoint > targetPointLogos) {
            const secs = (result.remainPoint - targetPointLogos) / training.speed;
            result.changeRemainSecsLogos = Math.floor(secs);
            result.changeTimeLogos = currentTs + Math.floor(secs);
          }
        }
      }
    }

    return result;
  };

  /**
   * 计算公开招募信息 - 基于Kotlin代码逻辑
   * @param recruitNode - 公开招募数据数组
   * @returns 公开招募详细信息
   */
  const calculateRecruitInfo = (recruitNode: any[]): RecruitInfo => {
    if (!recruitNode || !Array.isArray(recruitNode)) {
      return {
        isNull: true,
        max: 0,
        complete: 0,
        remainSecs: -1,
        completeTime: -1
      };
    }

    const currentTs = getCurrentTimestamp();
    let unable = 0;
    let complete = 0;
    let maxFinishTs = -1;

    recruitNode.forEach(node => {
      switch (node.state) {
        case 0: // 无法招募
          unable++;
          break;
        case 3: // 招募完成
          complete++;
          break;
        case 2: // 招募中
          if (node.finishTs) {
            if (node.finishTs < currentTs) {
              complete++;
            }
            maxFinishTs = Math.max(maxFinishTs, node.finishTs);
          }
          break;
      }
    });

    const max = 4 - unable;
    let remainSecs = -1;
    let completeTime = -1;

    if (maxFinishTs !== -1 && maxFinishTs > currentTs) {
      remainSecs = maxFinishTs - currentTs;
      completeTime = maxFinishTs;
    }

    return {
      isNull: false,
      max,
      complete,
      remainSecs,
      completeTime
    };
  };

  /**
   * 计算公招刷新次数信息 - 基于Kotlin代码逻辑
   * @param hireNode - 公招数据
   * @returns 公招刷新次数信息
   */
  const calculateHireInfo = (hireNode: any): HireInfo => {
    if (!hireNode) {
      return {
        isNull: true,
        count: 0,
        max: 3,
        remainSecs: -1,
        completeTime: -1
      };
    }

    const currentTs = getCurrentTimestamp();
    const remainSecs = hireNode.completeWorkTime - currentTs;

    let count = 0;
    let completeTime = -1;

    if (remainSecs < 0) {
      completeTime = -1;
      count = Math.min(hireNode.refreshCount + 1, 3);
    } else {
      completeTime = hireNode.completeWorkTime;
      count = hireNode.refreshCount;
    }

    return {
      isNull: false,
      count,
      max: 3,
      remainSecs: remainSecs < 0 ? -1 : remainSecs,
      completeTime
    };
  };

  /**
   * 计算贸易站信息 - 基于Kotlin代码逻辑
   * @param tradingsNode - 贸易站数据数组
   * @returns 贸易站详细信息
   */
  const calculateTradingsInfo = (tradingsNode: any[]): TradingsInfo => {
    if (!tradingsNode || !Array.isArray(tradingsNode)) {
      return {
        isNull: true,
        current: 0,
        max: 0,
        remainSecs: -1,
        completeTime: -1,
        tradings: []
      };
    }

    const currentTs = getCurrentTimestamp();
    let stockSum = 0;
    let stockLimitSum = 0;
    let completeTimeAll = -1;
    let remainSecsAll = -1;
    const tradings: TradingStation[] = [];

    tradingsNode.forEach(node => {
      const strategy = node.strategy;
      const max = node.stockLimit;
      const targetPoint = strategy === "O_GOLD" ? 7000 : 4000;

      // 计算生成的货物数量 - 修复冗余的 0 + geneStock
      const geneStock = Math.floor((node.completeWorkTime - node.lastUpdateTime) / targetPoint);
      let stock = (node.stock?.length || 0) + geneStock;

      if (geneStock > 0 && currentTs < node.completeWorkTime) {
        stock--;
      } else {
        const newStock = Math.floor((currentTs - node.completeWorkTime) / targetPoint);
        stock += newStock + 1;
      }

      if (stock > max) {
        stock = max;
      }

      let completeTime = -1;
      let remainSecs = -1;

      if (stock < max) {
        const restStock = max - stock;
        if (currentTs < node.completeWorkTime) {
          remainSecs = restStock * targetPoint + node.completeWorkTime - currentTs;
          completeTime = currentTs + remainSecs;
        } else {
          completeTime = (max - ((node.stock?.length || 0) + geneStock)) * targetPoint + node.completeWorkTime;
          remainSecs = completeTime - currentTs;
        }
      }

      tradings.push({
        strategy,
        max,
        current: stock,
        completeTime,
        remainSecs
      });

      stockSum += stock;
      stockLimitSum += max;
      completeTimeAll = Math.max(completeTimeAll, completeTime);
      remainSecsAll = Math.max(remainSecsAll, remainSecs);
    });

    return {
      isNull: false,
      current: stockSum,
      max: stockLimitSum,
      remainSecs: remainSecsAll,
      completeTime: completeTimeAll,
      tradings
    };
  };

  /**
   * 计算制造站信息 - 基于Kotlin代码逻辑
   * @param manufacturesNode - 制造站数据数组
   * @param formulaMap - 制造配方信息映射表
   * @returns 制造站详细信息
   */
  const calculateManufacturesInfo = (manufacturesNode: any[], formulaMap: any): ManufacturesInfo => {
    if (!manufacturesNode || !Array.isArray(manufacturesNode)) {
      return {
        isNull: true,
        current: 0,
        max: 0,
        remainSecs: -1,
        completeTime: -1,
        manufactures: []
      };
    }

    const currentTs = getCurrentTimestamp();
    let stockSum = 0;
    let stockLimitSum = 0;
    let completeTimeAll = -1;
    let remainSecsAll = -1;
    const manufactures: ManufactureStation[] = [];

    manufacturesNode.forEach(node => {
      const formula = node.formulaId;
      const weight = formulaMap?.[node.formulaId]?.weight || 1;
      const stockLimit = Math.floor(node.capacity / weight);
      const max = stockLimit;

      let stock = node.complete || 0;
      let completeTime = -1;
      let remainSecs = -1;

      if (currentTs >= node.completeWorkTime) {
        stock = stockLimit;
      } else {
        const timeRatio = (node.completeWorkTime - node.lastUpdateTime) / (stockLimit - stock);
        stock += Math.floor((currentTs - node.lastUpdateTime) / timeRatio);
        completeTime = node.completeWorkTime;
        remainSecs = node.completeWorkTime - currentTs;
      }

      manufactures.push({
        formula,
        max,
        current: stock,
        completeTime,
        remainSecs
      });

      stockLimitSum += stockLimit;
      stockSum += stock;
      completeTimeAll = Math.max(completeTimeAll, completeTime);
      remainSecsAll = Math.max(remainSecsAll, remainSecs);
    });

    return {
      isNull: false,
      current: stockSum,
      max: stockLimitSum,
      remainSecs: remainSecsAll,
      completeTime: completeTimeAll,
      manufactures
    };
  };

  /**
   * 计算无人机信息 - 基于Kotlin代码逻辑
   */
  const calculateLaborInfo = (labor: any): LaborInfo => {
    if (!labor) {
      return {
        current: 0,
        max: 0,
        remainSecs: -1,
        recoverTime: -1
      };
    }

    const currentTs = getCurrentTimestamp();
    const max = labor.maxValue || labor.max || 0;
    const laborRemain = labor.remainSecs - (currentTs - labor.lastUpdateTime);

    // 计算当前无人机数量
    let current = 0;
    if (labor.remainSecs === 0) {
      current = labor.value || labor.current || 0;
    } else {
      current = Math.min(
        max,
        Math.floor(
          ((currentTs - labor.lastUpdateTime) * (max - (labor.value || labor.current || 0)) /
            labor.remainSecs + (labor.value || labor.current || 0))
        )
      );
    }

    const remainSecs = laborRemain < 0 ? 0 : laborRemain;
    const recoverTime = labor.remainSecs + labor.lastUpdateTime;

    return {
      current,
      max,
      remainSecs,
      recoverTime
    };
  };

  /**
   * 计算宿舍信息 - 基于Kotlin代码逻辑
   */
  const calculateDormitoriesInfo = (dormitoriesNode: any[]): DormitoriesInfo => {
    if (!dormitoriesNode || !Array.isArray(dormitoriesNode)) {
      return {
        isNull: true,
        current: 0,
        max: 0
      };
    }

    const currentTs = getCurrentTimestamp();
    let max = 0;
    let value = 0;

    dormitoriesNode.forEach(node => {
      const chars = node.chars || [];
      const speed = node.level * 0.1 + 1.5 + (node.comfort || 0) / 2500.0;
      max += chars.length;

      chars.forEach((chr: any) => {
        if (chr.ap === 8640000) {
          value++;
        } else {
          const ap = ((currentTs - (chr.lastApAddTime || currentTs)) * speed * 100 + (chr.ap || 0));
          if (ap >= 8640000) value++;
        }
      });
    });

    return {
      isNull: false,
      current: value,
      max: max
    };
  };

  /**
   * 计算疲劳干员信息 - 基于Kotlin代码逻辑
   */
  const calculateTiredInfo = (building: any): TiredInfo => {
    if (!building) {
      return {
        current: 0,
        remainSecs: -1
      };
    }

    const currentTs = getCurrentTimestamp();
    let current = building.tiredChars?.length || 0;
    let remainSecs = Number.MAX_SAFE_INTEGER;

    // 收集所有在工作中的干员
    const charList: any[] = [];

    if (building.meeting?.chars) charList.push(...building.meeting.chars);
    if (building.control?.chars) charList.push(...building.control.chars);
    if (building.hire?.chars) charList.push(...building.hire.chars);
    if (building.tradings) {
      building.tradings.forEach((trading: any) => {
        if (trading.chars) charList.push(...trading.chars);
      });
    }
    if (building.manufactures) {
      building.manufactures.forEach((manufacture: any) => {
        if (manufacture.chars) charList.push(...manufacture.chars);
      });
    }
    if (building.powers) {
      building.powers.forEach((power: any) => {
        if (power.chars) charList.push(...power.chars);
      });
    }

    // 计算疲劳恢复时间
    charList.forEach(char => {
      if (char.workTime !== 0 && char.workTime !== undefined) {
        const speed = (8640000 - (char.ap || 0)) / char.workTime;
        const restTime = (char.ap || 0) / speed;

        if ((currentTs - (char.lastApAddTime || currentTs)) > restTime) {
          current++;
        } else {
          remainSecs = Math.min(remainSecs, Math.floor(restTime));
        }
      }
    });

    return {
      current,
      remainSecs: remainSecs === Number.MAX_SAFE_INTEGER ? -1 : remainSecs
    };
  };

  /**
   * 获取训练点数 - 基于Kotlin代码逻辑
   */
  const getTotalPoint = (computePoint: number): number => {
    if (computePoint > 86400) return 86400;
    if (computePoint > 57600) return 86400;
    if (computePoint > 43200) return 57600;
    if (computePoint > 28800) return 43200;
    return 28800;
  };

  // ========== 设置相关功能 ==========

  /**
   * 处理CDN图片URL
   * 将相对路径转换为完整的CDN URL
   * @param url - 原始图片URL
   * @returns 处理后的完整URL
   */
  const processImageUrl = (url: string): string => {
    if (!url) return '';

    // 如果已经是完整URL，直接返回
    if (url.startsWith('http')) {
      return url;
    }

    // 如果是相对路径，添加CDN域名
    if (url.startsWith('/')) {
      return `https://web.hycdn.cn${url}`;
    }

    return url;
  };

  /**
   * 获取头像占位符
   * 当头像加载失败时显示用户名的第一个字符
   * @returns 头像占位符字符
   */
  const getAvatarPlaceholder = (): string => {
    if (!authStore.userName) return '👤';

    // 从用户名中提取第一个字符作为占位符
    const firstChar = authStore.userName.charAt(0);
    return firstChar || '👤';
  };

  /**
   * 处理头像加载错误
   * 当头像加载失败时设置错误状态
   */
  const handleAvatarError = (): void => {
    logger.warn('头像加载失败，使用默认占位符');
    avatarLoadError.value = true;
  };

  /**
   * 处理头像加载成功
   * 当头像加载成功时清除错误状态
   */
  const handleAvatarLoad = (): void => {
    logger.debug('头像加载成功');
    avatarLoadError.value = false;
  };

  /**
   * 获取用户头像
   * 从玩家数据中提取并处理头像URL
   */
  const fetchUserAvatar = (): void => {
    if (!authStore.isLogin || !playerData.value?.status?.avatar) {
      userAvatar.value = '';
      avatarLoadError.value = true;
      logger.debug('无法获取用户头像：未登录或没有头像数据');
      return;
    }

    try {
      // 直接从 playerData 中获取头像信息
      const avatarData = playerData.value.status.avatar;
      if (avatarData && avatarData.url) {
        // 处理CDN URL
        userAvatar.value = processImageUrl(avatarData.url);
        avatarLoadError.value = false;
        logger.debug('用户头像URL处理成功', {
          originalUrl: avatarData.url,
          processedUrl: userAvatar.value
        });
      } else {
        userAvatar.value = '';
        avatarLoadError.value = true;
        logger.warn('头像数据不完整', { avatarData });
      }
    } catch (error) {
      logger.error('获取用户头像失败', error);
      userAvatar.value = '';
      avatarLoadError.value = true;
    }
  };

  /**
   * 复制文本到剪贴板的现代化实现
   * 避免使用已弃用的 document.execCommand
   * @param text - 要复制的文本
   * @returns 复制是否成功的Promise
   */
  const copyToClipboard = async (text: string): Promise<boolean> => {
    try {
      // 优先使用现代剪贴板API
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        logger.debug('使用现代剪贴板API复制成功');
        return true;
      } else {
        // 降级方案：使用textarea元素和现代选择API
        const textArea = document.createElement('textarea');
        textArea.value = text;

        // 设置样式确保元素不可见
        textArea.style.position = 'fixed';
        textArea.style.top = '0';
        textArea.style.left = '0';
        textArea.style.width = '2em';
        textArea.style.height = '2em';
        textArea.style.padding = '0';
        textArea.style.border = 'none';
        textArea.style.outline = 'none';
        textArea.style.boxShadow = 'none';
        textArea.style.background = 'transparent';
        textArea.style.opacity = '0';

        document.body.appendChild(textArea);

        try {
          // 使用现代选择API选择文本
          textArea.select();
          textArea.setSelectionRange(0, textArea.value.length);

          // 尝试使用现代剪贴板API
          if (navigator.clipboard) {
            await navigator.clipboard.writeText(text);
            logger.debug('使用降级方案的剪贴板API复制成功');
            return true;
          } else {
            // 如果现代API不可用，提示用户手动复制
            logger.warn('剪贴板API不可用，需要用户手动复制');
            return false;
          }
        } finally {
          // 确保清理DOM元素
          document.body.removeChild(textArea);
        }
      }
    } catch (error) {
      logger.error('复制到剪贴板失败', error);
      return false;
    }
  };

  /**
   * 复制UID到剪贴板
   * 使用现代化的剪贴板API，避免使用已弃用的方法
   * @param uid - 要复制的UID
   */
  const copyUid = async (uid: string): Promise<void> => {
    // 检查UID是否有效
    if (!uid || uid === '未获取') {
      const error = new Error('UID不可用，无法复制');
      logger.warn('复制UID失败', error);
      showError('UID不可用，无法复制');
      return;
    }

    try {
      logger.info('用户尝试复制UID', { uid });

      const success = await copyToClipboard(uid);
      if (success) {
        logger.info('UID复制成功', { uid });
        showSuccess(`已复制 UID ${uid}`);
      } else {
        // 如果复制失败，提供手动复制选项
        logger.warn('UID复制失败，提供手动复制选项');
        showError('复制失败，请手动选择并复制UID');

        // 自动选择文本以便用户手动复制
        const selection = window.getSelection();
        const range = document.createRange();
        const elements = document.querySelectorAll('.uid-value.copyable');
        if (elements.length > 0 && selection) {
          range.selectNodeContents(elements[0] as Node);
          selection.removeAllRanges();
          selection.addRange(range);
          logger.debug('已自动选择UID文本供用户手动复制');
        }
      }
    } catch (error) {
      logger.error('复制UID过程中发生异常', error);
      showError('复制失败，请手动复制UID');
    }
  };

  /**
   * 复制昵称到剪贴板
   * @param nickname - 要复制的昵称
   */
  const copyNickname = async (nickname: string): Promise<void> => {
    // 检查昵称是否有效
    if (!nickname || nickname === '未获取' || nickname === '未知用户') {
      showError('昵称不可用，无法复制');
      return;
    }

    try {
      logger.info('用户尝试复制昵称', { nickname });

      const success = await copyToClipboard(nickname);
      if (success) {
        logger.info('昵称复制成功', { nickname });
        showSuccess(`已复制昵称 ${nickname}`);
      } else {
        logger.warn('昵称复制失败');
        showError('复制失败，请手动复制');
      }
    } catch (error) {
      logger.error('复制昵称过程中发生异常', error);
      showError('复制失败，请手动复制');
    }
  };

  // ========== 计算属性 ==========

  /**
   * 获取游戏内UID
   * 返回默认角色或第一个角色的UID
   */
  const gameUid = computed((): string => {
    if (!authStore.isLogin || !authStore.bindingRoles?.length) {
      return '未获取';
    }

    // 获取默认角色或第一个角色的UID
    const defaultRole = authStore.bindingRoles.find(role => role.isDefault) || authStore.bindingRoles[0];
    return defaultRole?.uid || '未获取';
  });

  /**
   * 获取用户等级
   * 从玩家状态数据中提取等级信息
   */
  const userLevel = computed((): string => {
    if (!authStore.isLogin || !playerData.value?.status) {
      return '未获取';
    }
    return playerData.value.status.level?.toString() || '未获取';
  });

  /**
   * 获取干员总数
   * 通过遍历chars数组计算拥有的干员数量
   */
  const getCharCount = computed((): number => {
    if (!playerData.value?.chars) return 0;
    return Math.max(0, playerData.value.chars.length - 2);
  });

  /**
   * 获取作战进度显示
   * 根据API文档：全通关时mainStageProgress返回空，其他情况显示最新抵达的关卡
   */
  const getMainStageProgress = computed((): string => {
    const status = playerData.value?.status;
    if (!status) return '未知';

    // 如果mainStageProgress为空字符串，表示全通关
    if (status.mainStageProgress === '') {
      return '全部完成';
    }

    // 如果mainStageProgress有值，显示具体的关卡进度
    if (status.mainStageProgress && typeof status.mainStageProgress === 'string') {
      return status.mainStageProgress.trim();
    }

    // 最后回退到默认值
    return '未通关主线';
  });

  // ========== 公开招募相关计算属性 ==========

  /**
   * 获取公开招募完整信息 - 基于Kotlin计算逻辑
   */
  const getRecruitInfo = computed((): RecruitInfo => {
    const recruitData = playerData.value?.recruit;
    return calculateRecruitInfo(recruitData);
  });

  /**
   * 获取公开招募刷新次数 - 基于Kotlin计算逻辑
   */
  const getHireInfo = computed((): HireInfo => {
    const hireData = playerData.value?.building?.hire;
    return calculateHireInfo(hireData);
  });

  /**
   * 获取公开招募槽位状态显示
   */
  const getHireSlotCount = computed((): string => {
    const recruitInfo = getRecruitInfo.value;
    if (recruitInfo.isNull) return '0/4';

    return `${recruitInfo.complete}/${recruitInfo.max}`;
  });

  /**
   * 获取公开招募刷新次数显示
   */
  const getHireRefreshCount = computed((): string => {
    const hireInfo = getHireInfo.value;
    return `${hireInfo.count}/${hireInfo.max}`;
  });

  /**
   * 获取公开招募完成状态
   */
  const getCompletedRecruitCount = computed((): string => {
    const recruitInfo = getRecruitInfo.value;
    return recruitInfo.isNull ? '0' : `${recruitInfo.complete}`;
  });

  /**
   * 获取公开招募剩余时间
   */
  const getRecruitRemainingTime = computed((): string => {
    const recruitInfo = getRecruitInfo.value;
    if (recruitInfo.isNull || recruitInfo.remainSecs <= 0) {
      return '已完成';
    }
    return formatRecoveryTimeFromSeconds(recruitInfo.remainSecs);
  });

  /**
   * 获取公开招募详细信息
   */
  const getRecruitDetails = computed((): RecruitSlot[] => {
    const recruitData = playerData.value?.recruit;
    if (!recruitData || !Array.isArray(recruitData)) return [];

    return recruitData.map((slot, index): RecruitSlot => {
      let status: string;
      let finishTime = '';

      switch (slot.state) {
        case 0:
          status = '无法招募';
          break;
        case 1:
          status = '空闲';
          break;
        case 2:
          status = '招募中';
          if (slot.finishTs && slot.finishTs > 0) {
            finishTime = formatTimestamp(slot.finishTs);
          }
          break;
        case 3:
          status = '已完成';
          if (slot.finishTs && slot.finishTs > 0) {
            finishTime = formatTimestamp(slot.finishTs);
          }
          break;
        default:
          status = '未知';
      }

      return {
        slotIndex: index + 1,
        state: slot.state,
        status,
        startTime: slot.startTs > 0 ? formatTimestamp(slot.startTs) : '',
        finishTime,
        startTs: slot.startTs,
        finishTs: slot.finishTs
      };
    });
  });

  // ========== 贸易站相关计算属性 ==========

  /**
   * 获取贸易站完整信息 - 基于Kotlin计算逻辑
   */
  const getTradingsInfo = computed((): TradingsInfo => {
    const tradingsData = playerData.value?.building?.tradings;
    return calculateTradingsInfo(tradingsData);
  });

  /**
   * 获取贸易站订单数量显示
   */
  const getTradingOrderCount = computed((): string => {
    const tradingsInfo = getTradingsInfo.value;
    if (tradingsInfo.isNull) return '0/0 订单';

    return `${tradingsInfo.current}/${tradingsInfo.max} 订单`;
  });

  /**
   * 获取贸易站剩余时间
   */
  const getTradingRemainingTime = computed((): string => {
    const tradingsInfo = getTradingsInfo.value;
    if (tradingsInfo.isNull || tradingsInfo.remainSecs <= 0) {
      return '已完成';
    }
    return formatRecoveryTimeFromSeconds(tradingsInfo.remainSecs);
  });

  /**
   * 获取贸易站详细信息
   */
  const getTradingDetails = computed((): TradingDetail[] => {
    const tradingsInfo = getTradingsInfo.value;
    if (tradingsInfo.isNull) return [];

    return tradingsInfo.tradings.map((trading: TradingStation, index: number): TradingDetail => ({
      stationIndex: index + 1,
      strategy: trading.strategy,
      strategyName: trading.strategy === 'O_GOLD' ? '龙门币订单' : '其他订单',
      current: trading.current,
      max: trading.max,
      progress: trading.max > 0 ? Math.floor((trading.current / trading.max) * 100) : 0,
      remainSecs: trading.remainSecs,
      remainingTime: trading.remainSecs > 0 ? formatRecoveryTimeFromSeconds(trading.remainSecs) : '已完成',
      completeTime: trading.completeTime > 0 ? formatTimestamp(trading.completeTime) : '已完成'
    }));
  });

  // ========== 制造站相关计算属性 ==========

  /**
   * 获取制造站完整信息 - 基于Kotlin计算逻辑
   */
  const getManufacturesInfo = computed((): ManufacturesInfo => {
    const manufacturesData = playerData.value?.building?.manufactures;
    const formulaMap = playerData.value?.manufactureFormulaInfoMap;
    return calculateManufacturesInfo(manufacturesData, formulaMap);
  });

  /**
   * 获取制造站货物数量显示
   */
  const getManufactureStatus = computed((): string => {
    const manufacturesInfo = getManufacturesInfo.value;
    if (manufacturesInfo.isNull) return '0 货物 | 0/0 运行中';

    // 计算运行中的制造站数量
    const manufacturesData = playerData.value?.building?.manufactures;
    const totalStations = manufacturesData?.length || 0;
    const activeStations = manufacturesData?.filter((mfg: any) => {
      return mfg.completeWorkTime > getCurrentTimestamp();
    }).length || 0;

    return `${manufacturesInfo.current} 货物 | ${activeStations}/${totalStations} 运行中`;
  });

  /**
   * 获取制造站剩余时间
   */
  const getManufactureRemainingTime = computed((): string => {
    const manufacturesInfo = getManufacturesInfo.value;
    if (manufacturesInfo.isNull || manufacturesInfo.remainSecs <= 0) {
      return '已完成';
    }
    return formatRecoveryTimeFromSeconds(manufacturesInfo.remainSecs);
  });

  /**
   * 获取制造站详细信息
   */
  const getManufactureDetails = computed((): ManufactureDetail[] => {
    const manufacturesInfo = getManufacturesInfo.value;
    if (manufacturesInfo.isNull) return [];

    return manufacturesInfo.manufactures.map((manufacture: ManufactureStation, index: number): ManufactureDetail => ({
      stationIndex: index + 1,
      formula: manufacture.formula,
      current: manufacture.current,
      max: manufacture.max,
      progress: manufacture.max > 0 ? Math.floor((manufacture.current / manufacture.max) * 100) : 0,
      remainSecs: manufacture.remainSecs,
      remainingTime: manufacture.remainSecs > 0 ? formatRecoveryTimeFromSeconds(manufacture.remainSecs) : '已完成',
      completeTime: manufacture.completeTime > 0 ? formatTimestamp(manufacture.completeTime) : '已完成'
    }));
  });

  // ========== 训练室相关计算属性 ==========

  /**
   * 获取训练室完整信息 - 基于Kotlin计算逻辑
   */
  const getTrainingInfo = computed((): TrainingInfo => {
    const trainingData = playerData.value?.building?.training;
    const charInfoMap = playerData.value?.charInfoMap;
    return calculateTrainingInfo(trainingData, charInfoMap);
  });

  /**
   * 获取训练室状态显示
   */
  const getTrainingStatus = computed((): string => {
    const trainingInfo = getTrainingInfo.value;
    if (trainingInfo.isNull) return '未配置训练室';

    if (trainingInfo.status === -1) {
      return '训练室空闲';
    }

    if (trainingInfo.status === 0) {
      return '专精训练完成';
    }

    if (trainingInfo.status === 1) {
      return `训练中 - 剩余${formatRecoveryTimeFromSeconds(trainingInfo.remainSecs)}`;
    }

    return '训练室状态未知';
  });

  /**
   * 获取训练室详细信息
   */
  const getTrainingDetails = computed(() => {
    const trainingInfo = getTrainingInfo.value;
    if (trainingInfo.isNull) return null;

    return {
      trainee: trainingInfo.trainee,
      trainer: trainingInfo.trainer,
      profession: trainingInfo.profession,
      targetSkill: trainingInfo.targetSkill,
      status: trainingInfo.status,
      remainSecs: trainingInfo.remainSecs,
      completeTime: trainingInfo.completeTime,
      totalPoint: trainingInfo.totalPoint,
      remainPoint: trainingInfo.remainPoint,
      changeRemainSecsIrene: trainingInfo.changeRemainSecsIrene,
      changeTimeIrene: trainingInfo.changeTimeIrene,
      changeRemainSecsLogos: trainingInfo.changeRemainSecsLogos,
      changeTimeLogos: trainingInfo.changeTimeLogos
    };
  });

  /**
   * 获取训练室状态（简版）- 用于卡片显示，分行显示
   */
  const getTrainingSimpleStatus = computed((): string => {
    const trainingInfo = getTrainingInfo.value;
    if (trainingInfo.isNull) return '训练室空闲';

    const traineeName = trainingInfo.trainee || '无';
    const trainerName = trainingInfo.trainer || '无';

    return `训练干员：${traineeName}\n协助干员：${trainerName}`;
  });

  /**
   * 检查训练室是否正在运行
   */
  const isTrainingActive = computed((): boolean => {
    const trainingInfo = getTrainingInfo.value;
    return !trainingInfo.isNull && trainingInfo.status === 1;
  });

  // ========== 其他基建相关计算属性 ==========

  /**
   * 获取会客室线索总数
   * 会客室最多可以存放7个线索
   */
  const getClueCount = computed((): string => {
    const meetingRoom = playerData.value?.building?.meeting;

    if (!meetingRoom) return '已获得线索 0/7 ';

    let clueCount = 0;

    // 方法1：从 clue.board 数组长度获取（根据您的调试数据）
    if (meetingRoom.clue?.board && Array.isArray(meetingRoom.clue.board)) {
      clueCount = meetingRoom.clue.board.length;
    }
    // 方法2：从 ownClues 获取
    else if (meetingRoom.ownClues && Array.isArray(meetingRoom.ownClues)) {
      clueCount = meetingRoom.ownClues.length;
    }
    // 方法3：从 clue.own 获取
    else if (meetingRoom.clue?.own !== undefined) {
      clueCount = meetingRoom.clue.own;
    }

    return `已获得线索 ${clueCount}/7`;
  });

  /**
   * 获取无人机数量和恢复时间
   */
  const getLaborCount = computed(() => {
    const labor = playerData.value?.building?.labor;
    const laborInfo = calculateLaborInfo(labor);

    const recoveryTime = formatRecoveryTimeFromSeconds(laborInfo.remainSecs);

    return {
      count: `${laborInfo.current}/${laborInfo.max}`,
      recovery: laborInfo.remainSecs > 0 ? recoveryTime : '已回满',
      remainSecs: laborInfo.remainSecs,
      recoverTime: laborInfo.recoverTime
    };
  });

  /**
   * 获取无人机恢复进度百分比
   */
  const getLaborRecoveryProgress = computed((): number => {
    const laborInfo = calculateLaborInfo(playerData.value?.building?.labor);
    if (laborInfo.max === 0) return 0;
    return Math.min(100, Math.floor((laborInfo.current / laborInfo.max) * 100));
  });

  /**
   * 获取宿舍休息人数
   */
  const getDormRestCount = computed((): string => {
    const dormitoriesInfo = calculateDormitoriesInfo(playerData.value?.building?.dormitories);
    return `${dormitoriesInfo.current}/${dormitoriesInfo.max}`;
  });

  /**
   * 获取疲劳干员数量
   */
  const getTiredCharsCount = computed((): number => {
    const tiredInfo = calculateTiredInfo(playerData.value?.building);
    return tiredInfo.current;
  });

  /**
   * 获取实际理智信息
   */
  const getActualApInfo = computed((): ApInfo => {
    const apData = playerData.value?.status?.ap;
    return calculateActualAp(apData);
  });

  /**
   * 获取剿灭作战合成玉进度
   */
  const getCampaignReward = computed((): string => {
    const reward = playerData.value?.campaign?.reward;
    return `${reward?.current || 0}/${reward?.total || 0}`;
  });

  /**
   * 获取每日任务进度
   */
  const getDailyTaskProgress = computed((): string => {
    const daily = playerData.value?.routine?.daily;
    const completed = daily?.current || 0;
    const total = daily?.total || 0;
    return `${completed}/${total}`;
  });

  /**
   * 获取每周任务进度
   */
  const getWeeklyTaskProgress = computed((): string => {
    const weekly = playerData.value?.routine?.weekly;
    const completed = weekly?.current || 0;
    const total = weekly?.total || 0;
    return `${completed}/${total}`;
  });

  /**
   * 获取数据增补仪进度
   */
  const getTowerLowerItem = computed((): string => {
    const lowerItem = playerData.value?.tower?.reward?.lowerItem;
    return `${lowerItem?.current || 0}/${lowerItem?.total || 0}`;
  });

  /**
   * 获取数据增补条进度
   */
  const getTowerHigherItem = computed((): string => {
    const higherItem = playerData.value?.tower?.reward?.higherItem;
    return `${higherItem?.current || 0}/${higherItem?.total || 0}`;
  });

  // ========== 调试功能 ==========

  /**
   * 调试数据函数
   */
  const debugData = (): void => {
    logger.debug('=== 完整玩家数据 ===', playerData.value);
    logger.debug('=== 基建数据 ===', playerData.value?.building);
    logger.debug('=== 公开招募数据 ===', playerData.value?.recruit);
    logger.debug('=== 公招刷新数据 ===', playerData.value?.building?.hire);
    logger.debug('=== 贸易站数据 ===', playerData.value?.building?.tradings);
    logger.debug('=== 制造站数据 ===', playerData.value?.building?.manufactures);
    logger.debug('=== 训练室数据 ===', playerData.value?.building?.training);
    logger.debug('=== 计算后的公开招募信息 ===', getRecruitInfo.value);
    logger.debug('=== 计算后的公招刷新信息 ===', getHireInfo.value);
    logger.debug('=== 计算后的贸易站信息 ===', getTradingsInfo.value);
    logger.debug('=== 计算后的制造站信息 ===', getManufacturesInfo.value);
    logger.debug('=== 计算后的训练室信息 ===', getTrainingInfo.value);
  };

  // ========== 核心方法 ==========

  /**
   * 加载游戏数据核心方法
   * @param refresh - 是否强制刷新（忽略缓存）
   */
  const fetchGameData = async (refresh = false): Promise<void> => {
    // 缓存检查逻辑
    if (!refresh && dataCache.value && dataCache.value.data) {
      const currentMs = Date.now();
      const cacheAge = currentMs - dataCache.value.timestamp;
      if (cacheAge < CACHE_DURATION) {
        const cacheAgeSeconds = Math.floor(cacheAge / 1000);
        logger.debug('使用缓存数据', {
          cacheAge: cacheAgeSeconds,
          cacheDuration: CACHE_DURATION / 1000
        });
        playerData.value = dataCache.value.data;
        lastUpdateTime.value = currentMs;
        // 数据加载成功后更新头像
        fetchUserAvatar();
        isLoading.value = false;
        debugData();
        return;
      }
    }

    if (refresh) {
      isRefreshing.value = true;
      logger.info('手动刷新游戏数据');
    } else {
      isLoading.value = true;
      logger.info('开始加载游戏数据');
    }
    errorMsg.value = '';

    try {
      logger.debug('检查用户登录状态');
      if (!authStore.isLogin) {
        errorMsg.value = '请先登录账号';
        logger.warn('未登录状态下尝试获取游戏数据');
        return;
      }

      logger.debug('检查绑定角色列表');
      if (!authStore.bindingRoles || authStore.bindingRoles.length === 0) {
        logger.info('没有绑定角色，正在获取角色列表...');
        try {
          await authStore.fetchBindingRoles();
          logger.info('角色列表获取成功');
        } catch (error: any) {
          errorMsg.value = '获取角色列表失败: ' + (error.message || '未知错误');
          logger.error('获取角色列表失败', error);
          return;
        }
      }

      const roleCount = authStore.bindingRoles.length;
      logger.debug(`当前绑定角色数量: ${roleCount}`);

      const targetRole = authStore.bindingRoles.find((role: any) => role.isDefault) || authStore.bindingRoles[0];

      if (!targetRole) {
        errorMsg.value = '未找到绑定的游戏角色';
        logger.error('未找到绑定的游戏角色');
        return;
      }

      logger.info(`使用角色获取数据`, {
        name: targetRole.nickName,
        uid: targetRole.uid
      });

      const data = await AuthAPI.getPlayerData(
        authStore.sklandCred,
        authStore.sklandSignToken,
        targetRole.uid
      );

      logger.info('玩家数据获取成功', {
        hasData: !!data,
        dataKeys: data ? Object.keys(data) : []
      });

      playerData.value = data;
      lastUpdateTime.value = Date.now();

      dataCache.value = {
        data: data,
        timestamp: Date.now()
      };

      // 数据加载成功后更新头像
      fetchUserAvatar();
      debugData();

      logger.debug('游戏数据加载完成并已缓存');

    } catch (error: any) {
      const message = error.message || '游戏数据加载失败，请稍后重试';
      logger.error('游戏数据加载失败', error);

      if (message.includes('认证失败') || message.includes('401')) {
        errorMsg.value = '登录已过期，请重新登录';
        logger.warn('认证失败，需要重新登录');
      } else if (message.includes('网络') || message.includes('Network')) {
        errorMsg.value = '网络连接失败，请检查网络设置';
        logger.warn('网络连接失败');
      } else if (message.includes('角色')) {
        errorMsg.value = '未找到游戏角色，请确认账号绑定';
        logger.warn('未找到游戏角色');
      } else {
        errorMsg.value = message;
        logger.error('未知错误类型', { message });
      }
    } finally {
      isLoading.value = false;
      isRefreshing.value = false;
      logger.debug('游戏数据加载状态已重置', {
        isLoading: isLoading.value,
        isRefreshing: isRefreshing.value
      });
    }
  };

  /**
   * 刷新数据
   */
  const refreshData = async (): Promise<void> => {
    logger.info('用户手动刷新游戏数据');
    await fetchGameData(true);
  };

  /**
   * 启动时间更新定时器
   */
  const startTimeUpdate = (): void => {
    if (timeUpdateInterval) {
      logger.debug('时间更新定时器已在运行');
      return;
    }

    timeUpdateInterval = setInterval(() => {
      currentTime.value = Math.floor(Date.now() / 1000);
    }, 1000);

    logger.info('时间更新定时器已启动');
  };

  /**
   * 停止时间更新定时器
   */
  const stopTimeUpdate = (): void => {
    if (timeUpdateInterval) {
      clearInterval(timeUpdateInterval);
      timeUpdateInterval = null;
      logger.info('时间更新定时器已停止');
    } else {
      logger.debug('时间更新定时器未运行，无需停止');
    }
  };

  /**
   * 清除缓存
   */
  const clearCache = (): void => {
    dataCache.value = null;
    logger.info('游戏数据缓存已清除');
  };

  // ========== 导出接口 ==========
  return {
    // 状态
    isLoading,
    errorMsg,
    playerData,
    isRefreshing,
    lastUpdateTime,
    currentTime,
    userAvatar,
    avatarLoadError,

    // 计算属性
    gameUid,
    userLevel,
    getCharCount,
    getMainStageProgress,

    // 公开招募相关
    getRecruitInfo,
    getHireInfo,
    getHireSlotCount,
    getHireRefreshCount,
    getCompletedRecruitCount,
    getRecruitRemainingTime,
    getRecruitDetails,

    // 贸易站相关
    getTradingsInfo,
    getTradingOrderCount,
    getTradingRemainingTime,
    getTradingDetails,

    // 制造站相关
    getManufacturesInfo,
    getManufactureStatus,
    getManufactureRemainingTime,
    getManufactureDetails,

    // 训练室相关
    getTrainingInfo,
    getTrainingStatus,
    getTrainingDetails,
    getTrainingSimpleStatus,
    isTrainingActive,

    // 其他基建相关
    getClueCount,
    getLaborCount,
    getLaborRecoveryProgress,
    getDormRestCount,
    getTiredCharsCount,
    getActualApInfo,
    getCampaignReward,
    getDailyTaskProgress,
    getWeeklyTaskProgress,
    getTowerLowerItem,
    getTowerHigherItem,

    // 方法
    fetchGameData,
    refreshData,
    formatTimestamp,
    formatRecoveryTime, // 添加缺失的函数
    formatRecoveryTimeFromSeconds,
    debugData,
    startTimeUpdate,
    stopTimeUpdate,
    clearCache,

    // 设置相关方法
    processImageUrl,
    getAvatarPlaceholder,
    handleAvatarError,
    handleAvatarLoad,
    fetchUserAvatar,
    copyUid,
    copyNickname
  };
});

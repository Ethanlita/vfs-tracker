/**
 * useDocumentMeta - 动态管理页面 <title> 和 <meta> 标签的自定义 Hook
 * 
 * 用于 SEO 优化，让每个页面有独立的标题和描述。
 * 由于 react-helmet-async 不支持 React 19，使用原生 DOM API 实现。
 * 
 * @example
 * // 在页面组件中使用
 * useDocumentMeta({
 *   title: '仪表板',
 *   description: '查看您的嗓音训练数据统计'
 * });
 */

import { useEffect } from 'react';

// 网站基础信息
const SITE_NAME = 'VFS Tracker';
const DEFAULT_TITLE = 'VFS Tracker - 分析和记录你的嗓音女性化旅程';
const DEFAULT_DESCRIPTION = 'VFS Tracker 是一个免费开源的嗓音女性化（Voice Feminization）训练追踪工具。记录您的嗓音训练历程，分析基频、共振峰等声学参数，可视化展示进步趋势。';

/**
 * 动态设置页面的 title 和 meta description
 * 
 * @param {Object} options - 配置选项
 * @param {string} [options.title] - 页面标题（会自动拼接站点名）
 * @param {string} [options.description] - 页面描述
 * @param {boolean} [options.noIndex=false] - 是否阻止搜索引擎索引
 */
export function useDocumentMeta({ title, description, noIndex = false } = {}) {
  useEffect(() => {
    // 保存原始值以便组件卸载时恢复
    const originalTitle = document.title;
    const metaDescription = document.querySelector('meta[name="description"]');
    const originalDescription = metaDescription?.content;
    const metaRobots = document.querySelector('meta[name="robots"]');
    const originalRobots = metaRobots?.content;

    // 设置标题
    if (title) {
      document.title = `${title} - ${SITE_NAME}`;
    } else {
      document.title = DEFAULT_TITLE;
    }

    // 设置 description
    if (description) {
      if (metaDescription) {
        metaDescription.content = description;
      } else {
        const meta = document.createElement('meta');
        meta.name = 'description';
        meta.content = description;
        document.head.appendChild(meta);
      }
    }

    // 设置 robots（用于 404 等不需要索引的页面）
    if (noIndex) {
      if (metaRobots) {
        metaRobots.content = 'noindex, nofollow';
      } else {
        const meta = document.createElement('meta');
        meta.name = 'robots';
        meta.content = 'noindex, nofollow';
        document.head.appendChild(meta);
      }
    }

    // 同步更新 Open Graph 标签
    updateMetaProperty('og:title', title ? `${title} - ${SITE_NAME}` : DEFAULT_TITLE);
    updateMetaProperty('og:description', description || DEFAULT_DESCRIPTION);

    // 组件卸载时恢复原始值
    return () => {
      document.title = originalTitle;
      if (metaDescription && originalDescription) {
        metaDescription.content = originalDescription;
      }
      if (metaRobots && originalRobots) {
        metaRobots.content = originalRobots;
      } else if (metaRobots && noIndex) {
        // 如果原来没有 robots 标签，移除我们添加的
        metaRobots.remove();
      }
    };
  }, [title, description, noIndex]);
}

/**
 * 更新或创建 Open Graph meta 标签
 * @param {string} property - og:xxx 属性名
 * @param {string} content - 内容
 */
function updateMetaProperty(property, content) {
  let meta = document.querySelector(`meta[property="${property}"]`);
  if (meta) {
    meta.content = content;
  } else {
    meta = document.createElement('meta');
    meta.setAttribute('property', property);
    meta.content = content;
    document.head.appendChild(meta);
  }
}

export default useDocumentMeta;

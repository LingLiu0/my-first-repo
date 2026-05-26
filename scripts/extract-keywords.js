/**
 * 从文档内容中提取关键概念，生成知识图谱数据
 * 
 * 流程：
 * 1. 读取所有 .docx 和 .pdf 文件内容
 * 2. 中文分词 + 关键词提取（N-gram + TF-IDF）
 * 3. 构建概念 + 文档双层图谱
 */

const fs = require('fs');
const path = require('path');
const mammoth = require('mammoth');

// ===================== 配置 =====================

// AI / 政策领域核心词典（领域相关概念会有加分权重）
const DOMAIN_DICT = [
  // AI相关
  '人工智能', '大模型', '算力', '数据中心', '算法', '智能体', '深度学习',
  '机器学习', '自然语言处理', '计算机视觉', '生成式', '开源', '鸿蒙',
  '智能驾驶', '自动驾驶', '机器人', '具身智能', 'AI', 'ChatGPT', 'GPT',
  
  // 数据相关
  '数据基础设施', '数据要素', '数据流通', '数据安全', '数据治理', '数据交易',
  '公共数据', '数据目录', '大数据', '数据共享', '数据资产', '数据确权',
  '高质量数据集', '授权运营', '数据开放',
  
  // 政策方向
  '数字化转型', '数字经济', '数字政府', '智能制造', '智慧城市', '智慧医疗',
  '智慧交通', '智慧教育', '智慧农业', '数字乡村', '新型基础设施',
  
  // 产业领域
  '制造业', '新能源', '新能源汽车', '芯片', '半导体', '集成电路',
  '生物医药', '医疗器械', '低空经济', '量子', '区块链', '元宇宙',
  '碳中和', '碳达峰', '绿色低碳', '氢能', '储能',
  
  // 政策主体
  '国务院', '国家发改委', '工信部', '科技部', '数据局', '网信办',
  '湖北省', '武汉市', '北京', '上海', '深圳', '长三角', '大湾区',
  
  // 热词
  '新质生产力', '高质量发展', '专精特新', '中小企业', '营商环境',
  '放管服', '双循环', '统一大市场', '服务消费', '养老', '教育',
  '人才', '就业', '供应链', '产业链',
  
  // 技术
  '5G', '6G', '云计算', '边缘计算', '物联网', '工业互联网',
  '数字孪生', '隐私计算', '联邦学习', '零碳', '零碳工厂',
  
  // 标准/法规
  '指导意见', '实施方案', '行动计划', '管理办法', '通知', '标准',
  '规范', '条例', '方案', '三年行动', '五年规划',
];

// 停用词
const STOP_WORDS = new Set([
  '的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一',
  '一个', '上', '也', '很', '到', '说', '要', '去', '你', '会', '着',
  '没有', '看', '好', '自己', '这', '他', '她', '它', '们', '那', '些',
  '什么', '怎么', '哪', '吗', '吧', '啊', '呢', '哦', '嗯', '哈', '哇',
  '为', '以', '与', '及', '或', '但', '而', '且', '所', '被', '从', '对',
  '将', '把', '向', '由', '于', '其', '之', '等', '各', '该', '本', '此',
  '中', '内', '外', '前', '后', '左', '右', '已', '可', '能', '将', '应',
  '可', '需', '要', '来', '去', '能', '会', '过', '进', '发', '用', '让',
  '更', '最', '还', '又', '再', '才', '就', '便', '即', '却', '只', '但',
  '第', '次', '项', '条', '款', '个', '种', '类', '部分', '方面',
  '进行', '通过', '推动', '开展', '加强', '推进', '加快', '支持', '促进',
  '完善', '建立', '深化', '提升', '实施', '落实', '做好', '强化', '持续',
  '相关', '主要', '重要', '基本', '关键', '重点', '全面', '进一步',
  '积极', '有效', '有序', '大力', '着力', '切实', '不断',
  '提出', '明确', '要求', '指出', '指出', '强调', '表示',
  '发展', '建设', '服务', '管理', '保障', '创新', '机制',
  '工作', '情况', '问题', '措施', '任务', '目标', '水平',
  '体系', '领域', '行业', '企业', '部门', '单位', '机构',
  '我国', '全国', '各地', '社会', '经济', '市场',
  '目前', '已经', '正在', '今年', '去年', '以来', '以后',
  '同时', '此外', '另外', '其中', '包括', '按照', '根据',
  '累计', '达到', '超过', '实现', '形成', '提供',
  '以及', '及其', '或者', '如有',
  '重大', '专项', '示范', '试点', '集群',
  '各', '区', '市', '省', '县', '镇', '村',
  '年', '月', '日', '时', '分', '累计', '以上', '以下',
  '东湖智库', '中国移动通信集团湖北有限公司', '中国移动通信集团湖北',
  '中国移动通信集团', '中国移动', '通信集团', '湖北有限公司', '湖北有限',
  '长江研究院', '有限公司', '通信', '集团', '公司', '湖北', '有限',
  '国移动通', '动通信集', '通信集团湖北', '集团湖北有限',
  '团湖北有限', '湖北有限公司东', '北有限公司东湖', '有限公司东湖',
  '公司东湖', '司东湖', '东湖智库', '通信集', '集团湖', '团湖北', '北有限',
  '公司东', '有限公', '限公司', '公司湖', '司东', '移动通', '动通信',
  '国移动', '移动通信', '信集团', '集湖北', '团有限', '北有', '有东',
  '通俗理解', '通俗理', '俗理解',     // PDF残片
  '一周资讯速递', '一周咨询速递', '目', '录', '重点关注', '政策速递', '热点资讯',
  '智库', '东湖',
  // 新增通用词过滤
  '理解', '知识', '信息', '方法', '使用', '包括', '具有', '成为',
  '发布', '关注', '系列', '专题', '组织', '结合', '研究', '分析',
  '作为', '起来', '起来', '可以', '需要', '来说', '对于', '为了',
  '方面', '领域', '行业', '情况', '工作', '部门', '单位', '问题',
  '存在', '可能', '产生', '引起', '导致', '造成', '带来',
  '以及', '及其', '还有', '而言', '对此', '由此', '从而',
  '能力', '水平', '程度', '基础', '条件', '环境', '局面',
  '认识', '认为', '觉得', '知道', '了解', '掌握',
  '坚持', '贯彻', '执行', '遵循', '按照', '依照',
  '一些', '这些', '那些', '各种', '多种', '不同', '相同', '类似',
  '发文时间', '发文时', '文时间', '发布时间',  // 日期元数据
  '数据资', '据资源', '共数据', '共数据资', '公共数据资', '共数据资源',  // 截断词
  '公共数', '授权运', '权运营', '是着力',  // 截断/碎片词
  '优势', '劣势', '机遇', '挑战', '风险', '影响',
]);

// N-gram 提取的最小/最大字符数
const NGRAM_MIN = 2;
const NGRAM_MAX = 6;

// 需要额外过滤的噪音模式
const NOISE_PATTERNS = [
  /^\d+年\d+月$/,        // 5年12月
  /^\d+年\d+月\d*$/,     // 2025年6月 变体
  /^\d*年\d+月$/,        // 025年6月
  /^\d+年\d*$/,          // 5年
  /^\d{1,2}月\d{1,2}日$/, // 1月16日
  /^of\d+$/i,            // of1, of13
  /^age$/i,              // page 残留
  /^第[一二三四五六七八九十\d]+[章节条款]/,
  /^[一二三四五六七八九十]+$/, // 纯序号
  /^目\s*录$/,
  /^中[的]国移[动的]?/,    // 中国移动残留碎片
  /^信集团/,              // 碎片
  /^公司$/,               // 碎片
  /^\d{2,}$/,            // 纯数字
  /^[A-Za-z]{1,2}$/,     // 单双字母
  /^[A-Za-z]{1}[\u4e00-\u9fa5]/,  // 单个字母+中文混合（PDF碎片）
  /^[\u4e00-\u9fa5]{1}[A-Za-z]{1,2}$/, // 单中文+英文碎片
  /^[\.,，。、；;：:！!？?]+$/,
  /^\d+[\.\-\/]\d+$/,    // 日期数字
  /total_number/i,
  /page_number/i,
  /^\s*$/,
];

// 检查是否为噪音
function isNoise(gram) {
  for (const pattern of NOISE_PATTERNS) {
    if (pattern.test(gram)) return true;
  }
  return false;
}

// ===================== 文档解析 =====================

async function parseDocx(filePath) {
  try {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  } catch (err) {
    console.error(`  解析 DOCX 失败: ${filePath} - ${err.message}`);
    return '';
  }
}

async function parsePdf(filePath) {
  try {
    const { PDFParse } = require('pdf-parse');
    const dataBuffer = fs.readFileSync(filePath);
    const pdf = new PDFParse({ data: dataBuffer });
    const result = await pdf.getText();
    await pdf.destroy();
    return result.text;
  } catch (err) {
    console.error(`  解析 PDF 失败: ${filePath} - ${err.message}`);
    return '';
  }
}

async function parseDocument(filePath, fileName) {
  if (fileName.endsWith('.docx') || fileName.endsWith('.doc')) {
    return await parseDocx(filePath);
  }
  if (fileName.endsWith('.pdf')) {
    return await parsePdf(filePath);
  }
  return '';
}

// ===================== 中文分词 (N-gram) =====================

/**
 * 用滑动窗口提取所有可能的N-gram
 */
function extractNGrams(text) {
  const ngrams = {};
  
  // 清除 PDF/DOCX 噪声，并按自然边界分段
  let cleaned = text
    .replace(/--\s*\d+\s*of\s*\d+\s*--/g, '\n')
    .replace(/--\s*page_number[^\-]*--/gi, '\n')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '\n');
  
  // 移除整个公司名称行
  cleaned = cleaned.replace(/中国移动通信集团湖北有限公司[东湖长江]*智库*/g, '');
  
  // 过滤掉文档头部的固定行（页码、标题、目录等）
  cleaned = cleaned.split(/\n/).filter(line => {
    const trimmed = line.trim().replace(/\s+/g, '');
    if (trimmed.length < 1) return false;
    if (/^(目\s*录|一周资讯速递|一周咨询速递|每周政策速递|每周资讯速递|重点\s*关\s*注|政策\s*速\s*递|热点\s*资\s*讯)/.test(trimmed)) return false;
    if (/^(中国移动|湖北有限|长江研究|东湖智库|有限公|集团)/.test(trimmed) && trimmed.length < 20) return false;
    return true;
  }).join('\n');
  
  // 按自然边界分段（换行、句号、逗号等）
  const segments = cleaned.split(/[\n\r。，、；：！？\t　]+/);
  
  for (const segment of segments) {
    // 每段内只保留中文和字母数字
    const s = segment.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '');
    if (s.length < 3) continue;
    
    // 在段落内做 N-gram
    for (let len = NGRAM_MIN; len <= Math.min(NGRAM_MAX, s.length); len++) {
      for (let i = 0; i <= s.length - len; i++) {
        const gram = s.substring(i, i + len);
        ngrams[gram] = (ngrams[gram] || 0) + 1;
      }
    }
  }
  
  return ngrams;
}

/**
 * 过滤 N-gram：
 * 1. 去掉停用词
 * 2. 去掉太短/太长的
 * 3. 至少出现2次
 */
function filterNGrams(ngrams, domainConceptsSet) {
  const filtered = {};
  for (const [gram, freq] of Object.entries(ngrams)) {
    if (freq < 3) continue;  // 提高到至少3次
    if (STOP_WORDS.has(gram)) continue;
    if (isNoise(gram)) continue;
    
    const chineseChars = (gram.match(/[\u4e00-\u9fa5]/g) || []).length;
    const alphaChars = (gram.match(/[a-zA-Z]/g) || []).length;
    const digitChars = (gram.match(/\d/g) || []).length;
    const totalLen = gram.length;
    
    // 数字占比过高 → 跳过
    if (digitChars / totalLen > 0.3) continue;
    
    // 中文 + 非中文混合，且非中文占比 > 20% → 跳过（PDF 乱码特征）
    const nonChinese = totalLen - chineseChars;
    if (chineseChars > 0 && nonChinese / totalLen > 0.2 && !domainConceptsSet.has(gram)) continue;
    
    // 纯英文：只保留在词典中的或长度合理的术语
    if (chineseChars === 0) {
      if (domainConceptsSet.has(gram)) {
        filtered[gram] = freq;
      }
      // 其他纯英文跳过（太多PDF噪声）
      continue;
    }
    
    // 中文为主：至少2个中文字，且总长度≥3
    if (chineseChars >= 2 && totalLen >= 3) {
      // 额外检查：不在词典中但长度只有2的 → 太通用，跳过
      if (totalLen === 2 && chineseChars === 2 && !domainConceptsSet.has(gram)) continue;
      filtered[gram] = freq;
    }
  }
  return filtered;
}

/**
 * 从词典中匹配概念（在文本中查找预定义概念的出现次数）
 */
function matchDomainConcepts(text) {
  const concepts = {};
  for (const concept of DOMAIN_DICT) {
    let count = 0;
    let pos = 0;
    while ((pos = text.indexOf(concept, pos)) !== -1) {
      count++;
      pos += concept.length;
    }
    if (count > 0) {
      concepts[concept] = count;
    }
  }
  return concepts;
}

/**
 * 计算 TF-IDF 分数
 * TF: 词频 / 文档总词数
 * IDF: log(总文档数 / 包含该词的文档数)
 */
function calculateTFIDF(ngrams, docLength, docFreq, totalDocs, domainSet) {
  const scores = {};
  for (const [term, freq] of Object.entries(ngrams)) {
    if (freq < 2) continue;
    const tf = freq / Math.max(docLength / 100, 1);
    const df = docFreq[term] || 1;
    const idf = Math.log(totalDocs / df);
    let score = tf * idf;
    
    // 词典概念加分（2倍权重）
    if (domainSet.has(term)) {
      score *= 2.5;
    }
    
    scores[term] = score;
  }
  return scores;
}

// ===================== 图谱构建 =====================

function extractDateRange(filename) {
  const match = filename.match(/\((\d+[\.\-]\d+)-(\d+[\.\-]\d+)\)/);
  if (match) return { start: match[1], end: match[2] };
  return null;
}

function extractYear(filename, folderYear) {
  const yearMatch = filename.match(/20(\d{2})/);
  if (yearMatch) return '20' + yearMatch[1];
  return folderYear;
}

/**
 * 概念分类
 */
function classifyConcept(name) {
  const aiTerms = ['人工智能', '大模型', '算力', '算法', '智能体', '机器学习', '深度学习', 
                    'AI', 'ChatGPT', 'GPT', '生成式', '具身智能', '自动驾驶', '机器人'];
  const dataTerms = ['数据', '数字', '数字化', '大数据', '5G', '6G', '云计算', '物联网',
                     '区块链', '隐私计算', '联邦学习', '数字孪生', '工业互联网'];
  const policyTerms = ['意见', '方案', '办法', '条例', '通知', '规范', '标准', '行动',
                       '规划', '指导', '试点', '示范', '专项'];
  const energyTerms = ['新能源', '碳中和', '碳达峰', '绿色', '低碳', '氢能', '储能', '光伏',
                       '风电', '零碳'];
  const industryTerms = ['制造业', '芯片', '半导体', '集成电路', '生物医药', '医疗',
                         '汽车', '低空经济', '量子', '元宇宙'];
  
  for (const t of aiTerms) if (name.includes(t)) return 'AI';
  for (const t of dataTerms) if (name.includes(t)) return '数据';
  for (const t of energyTerms) if (name.includes(t)) return '能源';
  for (const t of industryTerms) if (name.includes(t)) return '产业';
  for (const t of policyTerms) if (name.includes(t)) return '政策';
  if (name.includes('国务院') || name.includes('发改委') || name.includes('工信部') ||
      name.includes('科技部') || name.includes('省委') || name.includes('省政府')) {
    return '政策机构';
  }
  
  return '概念';
}

function getColor(category) {
  const colorMap = {
    'AI': '#7F77DD',
    '数据': '#378ADD',
    '政策': '#D85A30',
    '能源': '#1D9E75',
    '产业': '#E67E22',
    '政策机构': '#C0392B',
    '概念': '#8E44AD',
    '文档': '#95A5A6',
  };
  return colorMap[category] || '#888780';
}

// ===================== 主流程 =====================

async function main() {
  const docsDir = path.join(__dirname, '..', 'weekly-news');
  const outputDir = path.join(__dirname, '..', 'docs');
  
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // ====== 第一步：收集所有文件 ======
  const allFiles = [];
  const years = ['2024', '2025', '2026'];
  
  for (const year of years) {
    const yearPath = path.join(docsDir, year);
    if (!fs.existsSync(yearPath)) continue;
    
    const files = fs.readdirSync(yearPath);
    for (const file of files) {
      if (file.startsWith('.') || file.startsWith('~')) continue;
      const ext = path.extname(file).toLowerCase();
      if (!['.docx', '.pdf', '.doc'].includes(ext)) continue;
      
      allFiles.push({
        fileName: file,
        filePath: path.join(yearPath, file),
        year: year,
        ext: ext,
        id: `${year}-${file.replace(/[^\w\u4e00-\u9fa5]/g, '-')}`.substring(0, 80),
      });
    }
  }
  
  console.log(`📂 共找到 ${allFiles.length} 个文件`);
  
  // ====== 第二步：解析所有文档内容 ======
  const documents = [];
  const globalDocFreq = {}; // 全局文档频率（用于IDF）
  let processedCount = 0;
  
  for (const fileInfo of allFiles) {
    processedCount++;
    const shortName = fileInfo.fileName.length > 40 
      ? fileInfo.fileName.substring(0, 37) + '...' 
      : fileInfo.fileName;
    console.log(`📄 [${processedCount}/${allFiles.length}] 解析: ${shortName}`);
    
    const content = await parseDocument(fileInfo.filePath, fileInfo.fileName);
    
    if (!content || content.length < 100) {
      console.log(`  ⚠️  内容过短或为空，跳过`);
      continue;
    }
    
    // 提取关键词
    const ngrams = extractNGrams(content);
    const domainConceptsSet = new Set(DOMAIN_DICT);
    const filteredNgrams = filterNGrams(ngrams, domainConceptsSet);
    const domainConcepts = matchDomainConcepts(content);
    
    // 合并 N-gram 和词典概念
    const allKeywords = { ...filteredNgrams };
    for (const [concept, freq] of Object.entries(domainConcepts)) {
      allKeywords[concept] = Math.max(allKeywords[concept] || 0, freq);
    }
    
    // 更新全局文档频率
    for (const keyword of Object.keys(allKeywords)) {
      globalDocFreq[keyword] = (globalDocFreq[keyword] || 0) + 1;
    }
    
    // 提取日期
    const dateRange = extractDateRange(fileInfo.fileName);
    const year = extractYear(fileInfo.fileName, fileInfo.year);
    
    documents.push({
      id: fileInfo.id,
      fileName: fileInfo.fileName,
      filePath: fileInfo.filePath,
      year: year,
      dateRange: dateRange,
      keywords: allKeywords,
      contentLength: content.length,
    });
  }
  
  console.log(`\n✅ 成功解析 ${documents.length} 个文档`);
  
  // ====== 第三步：计算 TF-IDF 并提取每个文档的核心概念 ======
  const totalDocs = documents.length;
  const domainSet = new Set(DOMAIN_DICT);
  
  for (const doc of documents) {
    const scores = calculateTFIDF(doc.keywords, doc.contentLength, globalDocFreq, totalDocs, domainSet);
    // 取分数最高的 15 个概念
    const topConcepts = Object.entries(scores)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([term, score]) => ({ term, score }));
    
    doc.topConcepts = topConcepts;
  }
  
  // ====== 第四步：确定全局概念节点 ======
  // 至少在 3 个文档中出现过的概念才成为节点
  const globalConcepts = {};
  for (const doc of documents) {
    for (const { term, score } of doc.topConcepts) {
      if (!globalConcepts[term]) {
        globalConcepts[term] = { count: 0, totalScore: 0, docs: [] };
      }
      globalConcepts[term].count++;
      globalConcepts[term].totalScore += score;
      globalConcepts[term].docs.push(doc.id);
    }
  }
  
  // 过滤：至少出现3次，或者TF-IDF总分足够高
  const conceptNodes = {};
  for (const [term, info] of Object.entries(globalConcepts)) {
    if (info.count >= 3 || (info.count >= 2 && info.totalScore > 1.0)) {
      conceptNodes[term] = {
        id: `concept-${term}`,
        label: term,
        type: 'concept',
        category: classifyConcept(term),
        weight: info.count,
        totalScore: info.totalScore,
        docCount: info.count,
      };
    }
  }
  
  console.log(`🔑 提取了 ${Object.keys(conceptNodes).length} 个关键概念`);
  
  // ====== 第五步：构建图谱节点和边 ======
  
  // 文档节点
  const docNodes = documents.map(doc => ({
    id: doc.id,
    label: doc.fileName.replace(/\.(docx|pdf|doc)$/, ''),
    year: doc.year,
    type: 'document',
    categories: doc.topConcepts.slice(0, 3).map(c => classifyConcept(c.term)),
    dateRange: doc.dateRange,
    path: `weekly-news/${doc.year}/${doc.fileName}`,
    topConcepts: doc.topConcepts.slice(0, 10).map(c => c.term),
  }));
  
  // 概念节点
  const conceptNodeList = Object.values(conceptNodes);
  
  // 所有节点
  const nodes = [...conceptNodeList, ...docNodes];
  
  // 边：文档 → 概念
  const edges = [];
  const edgeSet = new Set();
  
  for (const doc of documents) {
    for (const { term, score } of doc.topConcepts) {
      if (!conceptNodes[term]) continue;
      const edgeKey = `${doc.id}--${conceptNodes[term].id}`;
      if (!edgeSet.has(edgeKey)) {
        edgeSet.add(edgeKey);
        edges.push({
          source: doc.id,
          target: conceptNodes[term].id,
          relation: '涉及',
          strength: Math.min(Math.round(score * 5), 10),
          weight: score,
        });
      }
    }
  }
  
  // 边：概念共现（两个概念在同一文档中出现过）
  const cooccurrence = {};
  for (const doc of documents) {
    const docConcepts = doc.topConcepts
      .filter(c => conceptNodes[c.term])
      .map(c => c.term);
    
    for (let i = 0; i < docConcepts.length; i++) {
      for (let j = i + 1; j < docConcepts.length; j++) {
        const key = [docConcepts[i], docConcepts[j]].sort().join('|||');
        cooccurrence[key] = (cooccurrence[key] || 0) + 1;
      }
    }
  }
  
  // 只保留共现2次以上的
  for (const [key, count] of Object.entries(cooccurrence)) {
    if (count >= 2) {
      const [a, b] = key.split('|||');
      const edgeKey = `concept-${a}--concept-${b}`;
      if (!edgeSet.has(edgeKey)) {
        edgeSet.add(edgeKey);
        edges.push({
          source: `concept-${a}`,
          target: `concept-${b}`,
          relation: '共现',
          strength: Math.min(count, 5),
          weight: count,
        });
      }
    }
  }
  
  console.log(`🔗 生成了 ${edges.length} 条关系边`);
  
  // ====== 第六步：统计分析 ======
  const stats = {
    byYear: {},
    byCategory: {},
    topConcepts: Object.entries(globalConcepts)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 20)
      .map(([term, info]) => ({ term, count: info.count })),
  };
  
  for (const year of years) {
    stats.byYear[year] = documents.filter(d => d.year === year).length;
  }
  
  for (const node of conceptNodeList) {
    stats.byCategory[node.category] = (stats.byCategory[node.category] || 0) + 1;
  }
  
  // ====== 第七步：输出 ======
  const graphData = {
    meta: {
      title: '一周资讯速递 - 概念知识图谱',
      description: '从文档内容中自动提取关键概念并构建知识图谱',
      totalDocuments: documents.length,
      totalConcepts: conceptNodeList.length,
      totalEdges: edges.length,
      years: years.filter(y => stats.byYear[y] > 0),
      generatedAt: new Date().toISOString(),
    },
    nodes: nodes,
    edges: edges,
    statistics: stats,
  };
  
  const outputPath = path.join(outputDir, 'graph-data.json');
  fs.writeFileSync(outputPath, JSON.stringify(graphData, null, 2), 'utf-8');
  
  console.log(`\n✅ 知识图谱数据已生成: ${outputPath}`);
  console.log(`📊 统计:`);
  console.log(`   文档节点: ${docNodes.length}`);
  console.log(`   概念节点: ${conceptNodeList.length}`);
  console.log(`   关系边: ${edges.length}`);
  console.log(`\n🏆 TOP 20 核心概念:`);
  stats.topConcepts.forEach((c, i) => {
    console.log(`   ${i+1}. ${c.term} (${c.count}篇文档)`);
  });
}

main().catch(err => {
  console.error('❌ 执行失败:', err);
  process.exit(1);
});

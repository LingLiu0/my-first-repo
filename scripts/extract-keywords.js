const fs = require('fs');
const path = require('path');

// 关键词分类规则
const CATEGORIES = {
  '一周资讯速递': { type: '资讯', color: '#378ADD' },
  '一周咨询速递': { type: '资讯', color: '#378ADD' },
  '每周资讯速递': { type: '资讯', color: '#378ADD' },
  '每周政策速递': { type: '政策', color: '#D85A30' },
  'AI': { type: 'AI', color: '#7F77DD' },
  '人工智能': { type: 'AI', color: '#7F77DD' },
  '政策': { type: '政策', color: '#D85A30' },
  '报告': { type: '报告', color: '#1D9E75' }
};

function extractDateRange(filename) {
  // 从文件名提取日期范围，如 (1.16-1.23) -> { start: '1.16', end: '1.23' }
  const match = filename.match(/\((\d+[\.\-]\d+)-(\d+[\.\-]\d+)\)/);
  if (match) {
    return { start: match[1], end: match[2] };
  }
  return null;
}

function extractYear(filename, folderYear) {
  // 从文件名或文件夹名提取年份
  const yearMatch = filename.match(/20(\d{2})/);
  if (yearMatch) {
    return '20' + yearMatch[1];
  }
  return folderYear;
}

function classifyDocument(filename) {
  let categories = [];
  for (const [keyword, category] of Object.entries(CATEGORIES)) {
    if (filename.includes(keyword)) {
      categories.push(category);
    }
  }
  // 去重
  const uniqueCategories = [...new Set(categories.map(c => c.type))];
  return uniqueCategories.length > 0 ? uniqueCategories : ['其他'];
}

function getDocumentType(filename) {
  if (filename.endsWith('.docx')) return 'Word文档';
  if (filename.endsWith('.pdf')) return 'PDF文档';
  if (filename.endsWith('.doc')) return 'Word文档';
  return '未知';
}

function scanFolder(folderPath, year) {
  const documents = [];
  const files = fs.readdirSync(folderPath);
  
  for (const file of files) {
    if (file.startsWith('.')) continue;
    
    const filePath = path.join(folderPath, file);
    const stats = fs.statSync(filePath);
    
    if (stats.isFile()) {
      const dateRange = extractDateRange(file);
      const categories = classifyDocument(file);
      const docType = getDocumentType(file);
      
      documents.push({
        id: `${year}-${file.replace(/[^\w\u4e00-\u9fa5]/g, '-')}`,
        name: file,
        year: year,
        dateRange: dateRange,
        categories: categories,
        docType: docType,
        type: 'document',
        path: `weekly-news/${year}/${file}`
      });
    }
  }
  
  return documents;
}

function main() {
  const docsDir = path.join(__dirname, '..', 'weekly-news');
  const docsDirDocs = path.join(__dirname, '..', 'docs');
  
  // 确保 docs 目录存在
  if (!fs.existsSync(docsDirDocs)) {
    fs.mkdirSync(docsDirDocs, { recursive: true });
  }
  
  const allDocuments = [];
  
  // 扫描各年份文件夹
  const years = ['2024', '2025', '2026'];
  for (const year of years) {
    const yearPath = path.join(docsDir, year);
    if (fs.existsSync(yearPath)) {
      const docs = scanFolder(yearPath, year);
      allDocuments.push(...docs);
    }
  }
  
  // 生成节点和边数据
  const nodes = allDocuments.map(doc => ({
    id: doc.id,
    label: doc.name.replace(/\.(docx|pdf|doc)$/, ''),
    year: doc.year,
    categories: doc.categories,
    docType: doc.docType,
    path: doc.path
  }));
  
  // 生成关系（基于年份和类别）
  const edges = [];
  
  // 年份间关系
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const nodeA = nodes[i];
      const nodeB = nodes[j];
      
      // 同一类别
      const sharedCategories = nodeA.categories.filter(c => nodeB.categories.includes(c));
      if (sharedCategories.length > 0 && nodeA.year === nodeB.year) {
        edges.push({
          source: nodeA.id,
          target: nodeB.id,
          relation: '同类别',
          strength: sharedCategories.length
        });
      }
      
      // 同一月份（从日期范围推断）
      if (nodeA.dateRange && nodeB.dateRange) {
        if (nodeA.dateRange.start === nodeB.dateRange.start) {
          edges.push({
            source: nodeA.id,
            target: nodeB.id,
            relation: '同期',
            strength: 1
          });
        }
      }
    }
  }
  
  const graphData = {
    meta: {
      title: '一周资讯速递知识图谱',
      description: '基于已上传的每周资讯报告自动生成的知识图谱',
      totalDocuments: allDocuments.length,
      years: years,
      generatedAt: new Date().toISOString()
    },
    nodes: nodes,
    edges: edges,
    statistics: {
      byYear: {
        '2024': allDocuments.filter(d => d.year === '2024').length,
        '2025': allDocuments.filter(d => d.year === '2025').length,
        '2026': allDocuments.filter(d => d.year === '2026').length
      },
      byCategory: {
        '资讯': allDocuments.filter(d => d.categories.includes('资讯')).length,
        '政策': allDocuments.filter(d => d.categories.includes('政策')).length,
        'AI': allDocuments.filter(d => d.categories.includes('AI')).length
      },
      byType: {
        'Word文档': allDocuments.filter(d => d.docType === 'Word文档').length,
        'PDF文档': allDocuments.filter(d => d.docType === 'PDF文档').length
      }
    }
  };
  
  // 保存到 docs/graph-data.json
  const outputPath = path.join(docsDirDocs, 'graph-data.json');
  fs.writeFileSync(outputPath, JSON.stringify(graphData, null, 2), 'utf-8');
  
  console.log(`✅ 已生成知识图谱数据: ${outputPath}`);
  console.log(`📊 共处理 ${allDocuments.length} 份文档`);
  console.log(`📅 涵盖 ${years.join(', ')} 年`);
}

main();

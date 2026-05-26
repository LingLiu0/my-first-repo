/**
 * 生成交互式知识图谱页面
 * 支持双层节点：文档节点 + 概念节点
 */
const fs = require('fs');
const path = require('path');

function generateHTML() {
  const docsDir = path.join(__dirname, '..', 'docs');
  
  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
  }
  
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>一周资讯速递 · 概念知识图谱</title>
  <script src="https://cdn.jsdelivr.net/npm/d3@7"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'PingFang SC', 'Microsoft YaHei', sans-serif; background: #0f0f1a; color: #e0e0e0; }
    header { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%); padding: 24px; text-align: center; border-bottom: 1px solid #2a2a4a; }
    header h1 { font-size: 22px; font-weight: 600; color: #e8e8ff; }
    header p { font-size: 13px; color: #8892b0; margin-top: 6px; }
    .stats { display: flex; justify-content: center; gap: 40px; margin-top: 16px; }
    .stat { text-align: center; }
    .stat-value { font-size: 28px; font-weight: 700; color: #64ffda; }
    .stat-label { font-size: 11px; color: #8892b0; }
    .controls { background: #1a1a2e; padding: 12px 20px; border-bottom: 1px solid #2a2a4a; display: flex; gap: 12px; flex-wrap: wrap; align-items: center; }
    .filter-group { display: flex; gap: 6px; align-items: center; }
    .filter-label { font-size: 12px; color: #8892b0; white-space: nowrap; }
    .filter-btn { padding: 5px 10px; border: 1px solid #333; border-radius: 4px; background: #1a1a2e; color: #8892b0; cursor: pointer; font-size: 11px; transition: all 0.2s; }
    .filter-btn:hover { border-color: #64ffda; color: #64ffda; }
    .filter-btn.active { background: #64ffda; color: #0f0f1a; border-color: #64ffda; font-weight: 600; }
    #graph { width: 100%; height: calc(100vh - 210px); min-height: 500px; }
    .tooltip { position: absolute; background: #1e1e3a; border: 1px solid #333; border-radius: 8px; padding: 14px; box-shadow: 0 8px 30px rgba(0,0,0,0.5); pointer-events: none; max-width: 340px; z-index: 1000; opacity: 0; transition: opacity 0.15s; color: #e0e0e0; }
    .tooltip.visible { opacity: 1; }
    .tooltip-title { font-weight: 600; font-size: 14px; margin-bottom: 8px; color: #64ffda; word-break: break-all; }
    .tooltip-meta { font-size: 12px; color: #a0a0c0; line-height: 1.6; }
    .tooltip-meta span { display: block; }
    .tag { display: inline-block; background: rgba(100,255,218,0.15); color: #64ffda; padding: 1px 6px; border-radius: 3px; font-size: 10px; margin-right: 4px; margin-top: 4px; }
    .legend { position: absolute; bottom: 16px; right: 16px; background: #1a1a2eed; padding: 14px; border-radius: 8px; border: 1px solid #333; backdrop-filter: blur(8px); }
    .legend-title { font-size: 11px; font-weight: 600; margin-bottom: 8px; color: #ccc; }
    .legend-item { display: flex; align-items: center; gap: 6px; font-size: 10px; color: #888; margin-bottom: 3px; }
    .legend-dot { width: 8px; height: 8px; border-radius: 50%; }
    .legend-doc { width: 8px; height: 8px; border-radius: 2px; }
    footer { text-align: center; padding: 14px; color: #555; font-size: 11px; background: #0f0f1a; }
    .search-box { padding: 5px 10px; border: 1px solid #333; border-radius: 4px; background: #0f0f1a; color: #e0e0e0; font-size: 12px; width: 180px; outline: none; }
    .search-box:focus { border-color: #64ffda; }
  </style>
</head>
<body>
  <header>
    <h1>一周资讯速递 · 概念知识图谱</h1>
    <p>从文档内容中自动提取概念，构建 AI 政策领域知识网络</p>
    <div class="stats">
      <div class="stat"><div class="stat-value" id="total-docs">--</div><div class="stat-label">文档数</div></div>
      <div class="stat"><div class="stat-value" id="total-concepts">--</div><div class="stat-label">概念数</div></div>
      <div class="stat"><div class="stat-value" id="total-edges">--</div><div class="stat-label">关系数</div></div>
    </div>
  </header>
  
  <div class="controls">
    <div class="filter-group">
      <span class="filter-label">年份:</span>
      <button class="filter-btn active" data-filter="all">全部</button>
      <button class="filter-btn" data-filter="2024">2024</button>
      <button class="filter-btn" data-filter="2025">2025</button>
      <button class="filter-btn" data-filter="2026">2026</button>
    </div>
    <div class="filter-group">
      <span class="filter-label">节点:</span>
      <button class="filter-btn active" data-nodetype="all">全部</button>
      <button class="filter-btn" data-nodetype="document">文档</button>
      <button class="filter-btn" data-nodetype="concept">概念</button>
    </div>
    <div class="filter-group" style="flex:1; justify-content:flex-end;">
      <input class="search-box" type="text" placeholder="搜索概念或文档..." id="search-input" />
    </div>
  </div>
  
  <div id="graph"></div>
  
  <div class="tooltip" id="tooltip">
    <div class="tooltip-title"></div>
    <div class="tooltip-meta"></div>
  </div>
  
  <div class="legend" id="legend"></div>
  
  <footer>
    <p>由 GitHub Actions 自动生成 | 基于文档内容提取</p>
  </footer>

  <script>
    const colorMap = {
      'AI': '#7F77DD',
      '数据': '#378ADD',
      '政策': '#D85A30',
      '能源': '#1D9E75',
      '产业': '#E67E22',
      '政策机构': '#C0392B',
      '概念': '#8E44AD',
      '资讯': '#378ADD',
      '报告': '#1D9E75',
      '其他': '#888780',
    };

    fetch('graph-data.json')
      .then(r => r.json())
      .then(data => initGraph(data))
      .catch(err => {
        console.error(err);
        document.getElementById('graph').innerHTML = '<p style="text-align:center;padding:80px;color:#555;">加载数据中... 请确保 Actions 已完成运行</p>';
      });

    let graphData = null;
    let simulation = null;
    let allNodes = [];
    let allLinks = [];

    function initGraph(data) {
      graphData = data;
      
      document.getElementById('total-docs').textContent = data.meta.totalDocuments;
      document.getElementById('total-concepts').textContent = data.meta.totalConcepts;
      document.getElementById('total-edges').textContent = data.meta.totalEdges;
      
      // 生成图例
      const cats = [...new Set(data.nodes.filter(n => n.type === 'concept').map(n => n.category))];
      let legendHtml = '<div class="legend-title">图例</div>';
      for (const cat of cats) {
        legendHtml += '<div class="legend-item"><div class="legend-dot" style="background:' + (colorMap[cat] || '#888') + ';"></div> ' + cat + '</div>';
      }
      legendHtml += '<div class="legend-item"><div class="legend-doc" style="background:#aaa;width:6px;height:6px;border-radius:2px;"></div> 文档</div>';
      document.getElementById('legend').innerHTML = legendHtml;
      
      const container = document.getElementById('graph');
      const width = container.clientWidth || 960;
      const height = container.clientHeight || 600;
      
      const svg = d3.select('#graph')
        .append('svg')
        .attr('width', width)
        .attr('height', height);
      
      const g = svg.append('g');
      const zoom = d3.zoom()
        .scaleExtent([0.15, 5])
        .on('zoom', (event) => g.attr('transform', event.transform));
      svg.call(zoom);
      
      // 构建节点和边
      allNodes = data.nodes.map(d => ({...d, x: null, y: null, fx: null, fy: null}));
      allLinks = data.edges.map(d => ({...d}));
      
      // 节点大小映射
      const nodeSize = d => {
        if (d.type === 'concept') return Math.min(6 + d.weight * 2, 30);
        return 5;
      };
      
      // 模拟
      simulation = d3.forceSimulation(allNodes)
        .force('link', d3.forceLink(allLinks).id(d => d.id).distance(d => d.relation === '共现' ? 60 : 100))
        .force('charge', d3.forceManyBody().strength(d => d.type === 'concept' ? -(nodeSize(d) * 25) : -80))
        .force('center', d3.forceCenter(width/2, height/2))
        .force('collision', d3.forceCollide().radius(d => nodeSize(d) + 4));
      
      // 边
      const link = g.append('g')
        .selectAll('line')
        .data(allLinks)
        .join('line')
        .attr('class', 'link')
        .attr('stroke', d => d.relation === '共现' ? '#444' : '#2a2a4a')
        .attr('stroke-width', d => Math.max(d.strength * 0.5, 0.5))
        .attr('stroke-opacity', d => d.relation === '共现' ? 0.3 : 0.15);
      
      // 节点组
      const node = g.append('g')
        .selectAll('.node')
        .data(allNodes)
        .join('g')
        .attr('class', 'node')
        .call(d3.drag()
          .on('start', dragstarted)
          .on('drag', dragged)
          .on('end', dragended));
      
      // 文档节点（小方点）
      const docNodes = node.filter(d => d.type === 'document');
      docNodes.append('rect')
        .attr('width', 6)
        .attr('height', 6)
        .attr('x', -3)
        .attr('y', -3)
        .attr('rx', 1)
        .attr('fill', '#95A5A6')
        .attr('stroke', '#555')
        .attr('stroke-width', 0.5);
      
      docNodes.append('text')
        .attr('dx', 8)
        .attr('dy', 4)
        .attr('fill', '#666')
        .attr('font-size', '9px')
        .attr('opacity', 0)
        .text(d => d.label.substring(0, 20));
      
      // 概念节点（圆点，大小随权重）
      const conceptNodes = node.filter(d => d.type === 'concept');
      conceptNodes.append('circle')
        .attr('r', d => nodeSize(d))
        .attr('fill', d => colorMap[d.category] || '#8E44AD')
        .attr('stroke', d => 'rgba(255,255,255,0.3)')
        .attr('stroke-width', 1);
      
      conceptNodes.append('text')
        .attr('dx', d => nodeSize(d) + 4)
        .attr('dy', 4)
        .attr('fill', '#ccc')
        .attr('font-size', d => Math.min(10 + d.weight * 0.5, 16) + 'px')
        .attr('font-weight', d => d.weight > 10 ? '600' : '400')
        .text(d => d.label);
      
      // 悬停
      const tooltip = document.getElementById('tooltip');
      node.on('mouseenter', (event, d) => {
        const title = tooltip.querySelector('.tooltip-title');
        const meta = tooltip.querySelector('.tooltip-meta');
        
        title.textContent = d.label;
        
        if (d.type === 'concept') {
          meta.innerHTML = 
            '<span>类型: 概念节点 (' + d.category + ')</span>' +
            '<span>出现于 ' + (d.docCount || d.weight) + ' 篇文档</span>';
        } else {
          meta.innerHTML = 
            '<span>年份: ' + d.year + '</span>' +
            '<span>路径: ' + (d.path || '') + '</span>';
          if (d.topConcepts && d.topConcepts.length > 0) {
            meta.innerHTML += '<span style="margin-top:8px;">核心概念:</span>';
            meta.innerHTML += d.topConcepts.map(c => '<span class="tag">' + c + '</span>').join('');
          }
        }
        
        tooltip.classList.add('visible');
      }).on('mousemove', (event) => {
        tooltip.style.left = (event.pageX + 15) + 'px';
        tooltip.style.top = (event.pageY - 10) + 'px';
      }).on('mouseleave', () => {
        tooltip.classList.remove('visible');
      });
      
      // 位置更新
      simulation.on('tick', () => {
        link
          .attr('x1', d => d.source.x)
          .attr('y1', d => d.source.y)
          .attr('x2', d => d.target.x)
          .attr('y2', d => d.target.y);
        
        node.attr('transform', d => 'translate(' + d.x + ',' + d.y + ')');
      });
      
      // 缩放事件中控制标签显示
      svg.call(zoom.on('zoom', (event) => {
        g.attr('transform', event.transform);
        const scale = event.transform.k;
        docNodes.select('text').attr('opacity', scale > 2 ? 1 : 0);
      }));
      
      // 拖拽
      function dragstarted(event) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        event.subject.fx = event.subject.x;
        event.subject.fy = event.subject.y;
      }
      function dragged(event) {
        event.subject.fx = event.x;
        event.subject.fy = event.y;
      }
      function dragended(event) {
        if (!event.active) simulation.alphaTarget(0);
        event.subject.fx = null;
        event.subject.fy = null;
      }
      
      // 筛选
      let currentFilters = { year: 'all', nodetype: 'all', search: '' };
      
      document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const parent = btn.parentElement;
          parent.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          
          if (btn.dataset.filter) currentFilters.year = btn.dataset.filter;
          if (btn.dataset.nodetype) currentFilters.nodetype = btn.dataset.nodetype;
          
          applyFilters();
        });
      });
      
      document.getElementById('search-input').addEventListener('input', (e) => {
        currentFilters.search = e.target.value.toLowerCase();
        applyFilters();
      });
      
      function applyFilters() {
        const { year, nodetype, search } = currentFilters;
        
        // 高亮匹配的节点
        const matchedIds = new Set();
        if (search) {
          allNodes.forEach(n => {
            if (n.label.toLowerCase().includes(search)) {
              matchedIds.add(n.id);
            }
          });
        }
        
        node.style('opacity', d => {
          let visible = true;
          
          if (year !== 'all') {
            if (d.type === 'document' && d.year !== year) visible = false;
            if (d.type === 'concept') {
              // 概念节点如果没有连接到该年份的文档也隐藏
              const hasConnection = allLinks.some(l => {
                const other = l.source.id === d.id ? l.target : (l.target.id === d.id ? l.source : null);
                if (!other) return false;
                return other.year === year;
              });
              if (!hasConnection) visible = false;
            }
          }
          
          if (nodetype !== 'all' && d.type !== nodetype) visible = false;
          
          if (search && !matchedIds.has(d.id)) {
            // 渐变而非完全消失
          }
          
          return visible ? 1 : (search ? 0.15 : 0.05);
        });
        
        link.style('opacity', l => {
          if (year === 'all' && nodetype === 'all') return l.relation === '共现' ? 0.3 : 0.15;
          
          const sourceNode = allNodes.find(n => n.id === l.source.id);
          const targetNode = allNodes.find(n => n.id === l.target.id);
          
          if (!sourceNode || !targetNode) return 0.02;
          
          if (search && (matchedIds.has(l.source.id) || matchedIds.has(l.target.id))) {
            return 0.8;
          }
          
          if (year !== 'all') {
            const docNode = sourceNode.type === 'document' ? sourceNode : (targetNode.type === 'document' ? targetNode : null);
            if (docNode && docNode.year !== year) return 0.02;
          }
          
          return 0.3;
        });
      }
      
      // 初始缩放
      svg.call(zoom.transform, d3.zoomIdentity.translate(width*0.3, height*0.3).scale(0.7));
    }
  </script>
</body>
</html>`;

  const outputPath = path.join(docsDir, 'index.html');
  fs.writeFileSync(outputPath, html, 'utf-8');
  console.log('✅ 已生成知识图谱页面:', outputPath);
}

generateHTML();

import React, { useState, useEffect } from 'react';

interface DialogueItem {
  id: number;
  page: string;
  order: number;
  box: [number, number, number, number];
  cls: string;
  original: string;
  translation: string;
}

interface ProcessResult {
  page: string;
  action: string;
  bubbles: number;
  seconds: number;
  output: string;
  qa_url?: string;
  final_url?: string;
  items?: DialogueItem[];
}

export default function App() {
  const [isBatch, setIsBatch] = useState<boolean>(false);
  const [mode, setMode] = useState<string>('advanced');
  const [inputPath, setInputPath] = useState<string>(
    'examples/MOMOUMIX 与桃酱在海边的本（《少女与战车》）/MOMOUMIX_003.jpg'
  );
  const [batchDir, setBatchDir] = useState<string>(
    'examples/MOMOUMIX 与桃酱在海边的本（《少女与战车》）'
  );
  const [pageRange, setPageRange] = useState<string>('03-19');
  const [referencePath, setReferencePath] = useState<string>(
    'examples/MOMOUMIX 与桃酱在海边的本（《少女与战车》）/MOMOUMIX_022.jpg'
  );
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<string>('就绪');
  const [activeTab, setActiveTab] = useState<'compare' | 'final' | 'table'>('compare');

  const [result, setResult] = useState<ProcessResult | null>(null);
  const [dialogueItems, setDialogueItems] = useState<DialogueItem[]>([]);
  const [batchSummary, setBatchSummary] = useState<any[]>([]);

  const [health, setHealth] = useState({
    api: true,
    model: 'gemini-3.8-flash-tiered',
    comfyui: false,
    cuda: true,
  });

  const [showConfig, setShowConfig] = useState<boolean>(false);
  const [config, setConfig] = useState({
    api_base: 'http://127.0.0.1:8045/v1',
    model: 'gemini-3.8-flash-tiered',
    comfy_url: 'http://127.0.0.1:8000',
    font: 'C:/Windows/Fonts/msyh.ttc',
  });

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => {
        if (data) setHealth(data);
      })
      .catch(() => {});
  }, []);

  const loadMomoumixPreset = () => {
    setIsBatch(true);
    setMode('advanced');
    setBatchDir('examples/MOMOUMIX 与桃酱在海边的本（《少女与战车》）');
    setPageRange('03-19');
    setReferencePath('examples/MOMOUMIX 与桃酱在海边的本（《少女与战车》）/MOMOUMIX_022.jpg');
    setStatusMsg('已载入 MOMOUMIX 03-19 话册测试预设 (基准色: MOMOUMIX_022.jpg)');
  };

  const handleRun = async () => {
    setIsProcessing(true);
    setStatusMsg(`正在以 [${mode}] 模式启动流水线...`);

    try {
      if (isBatch) {
        setStatusMsg(`正在执行批量任务: ${batchDir} (范围: ${pageRange})...`);
        const resp = await fetch('/api/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            input: batchDir,
            reference: referencePath,
            mode: mode,
            page_range: pageRange,
            glob: '*.jpg',
          }),
        });

        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status}: ${await resp.text()}`);
        }

        const data = await resp.json();
        setBatchSummary(data.summary || []);
        setStatusMsg(`批量任务完成！处理了 ${data.summary?.length || 0} 个页面。`);
      } else {
        setStatusMsg(`正在处理单页: ${inputPath}...`);
        const resp = await fetch('/api/process', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            input: inputPath,
            reference: referencePath,
            mode: mode,
          }),
        });

        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status}: ${await resp.text()}`);
        }

        const data: ProcessResult = await resp.json();
        setResult(data);
        if (data.items) {
          setDialogueItems(data.items);
        }
        setStatusMsg(`完成！耗时: ${data.seconds}秒, 共处理 ${data.bubbles} 处对白。`);
        setActiveTab('compare');
      }
    } catch (err: any) {
      console.error(err);
      setStatusMsg(`处理失败: ${err.message || err}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateTranslation = (id: number, newTrans: string) => {
    setDialogueItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, translation: newTrans } : it))
    );
  };

  return (
    <div className="container">
      {/* Header Bar */}
      <header className="header-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <span style={{ fontSize: '32px' }}>🎨</span>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 700, letterSpacing: '-0.5px' }}>
              MangaShot Studio
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              一键日漫全自动翻译与全彩上色工作台 (MangaTranslate & MangaColour 集成)
            </p>
          </div>
        </div>

        {/* Health Badges */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            className="btn btn-secondary"
            style={{ padding: '6px 12px', fontSize: '12px', borderColor: 'var(--accent)' }}
            onClick={loadMomoumixPreset}
          >
            ⭐ 载入 MOMOUMIX 03-19 测试预设
          </button>
          <span className="badge badge-info">
            🚀 API: {health.model}
          </span>
          <span className={`badge ${health.comfyui ? 'badge-success' : 'badge-warning'}`}>
            {health.comfyui ? '● ComfyUI 在线' : '○ ComfyUI 离线 (色度迁移就绪)'}
          </span>
          <button
            className="btn btn-secondary"
            style={{ padding: '6px 12px', fontSize: '13px' }}
            onClick={() => setShowConfig(!showConfig)}
          >
            ⚙️ 设置
          </button>
        </div>
      </header>

      {/* Main Grid */}
      <main className="main-layout">
        {/* Left Column: Control Panel */}
        <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Mode Selector */}
          <div>
            <label style={{ fontSize: '14px', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
              选择流水线模式 (Pipeline Mode)
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
              {[
                { id: 'advanced', title: '⚡ 进阶模式 (推荐: 先擦后色再嵌字)', desc: '先擦除生肉日文->无字全彩上色->高锐度重嵌中文，绝不糊字' },
                { id: 'auto', title: '🪄 智能全自动 (Auto-Detect)', desc: '自动检测色彩与语言：黑白自动上色，非中文自动汉化' },
                { id: 'both', title: '🌈 翻译并上色 (Both)', desc: '强制执行汉化翻译与全彩上色双重流程' },
                { id: 'translate', title: '📖 仅汉化翻译 (Translate Only)', desc: '仅执行气泡检测、OCR、连贯翻译与排版嵌字' },
                { id: 'colorize', title: '🎨 仅漫画上色 (Colorize Only)', desc: '仅基于参考图执行扩散上色与高频线稿复合' },
              ].map((m) => (
                <div
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  style={{
                    padding: '8px 10px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    background: mode === m.id ? 'rgba(56, 189, 248, 0.15)' : '#0f172a',
                    border: `1px solid ${mode === m.id ? 'var(--accent)' : 'var(--border-color)'}`,
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ fontSize: '13px', fontWeight: 600, color: mode === m.id ? 'var(--accent)' : 'var(--text-main)' }}>
                    {m.title}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {m.desc}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Single vs Batch Switch */}
          <div style={{ display: 'flex', background: '#0f172a', padding: '4px', borderRadius: '8px' }}>
            <button
              className={`btn ${!isBatch ? 'btn-primary' : 'btn-secondary'}`}
              style={{ flex: 1, padding: '8px', fontSize: '13px' }}
              onClick={() => setIsBatch(false)}
            >
              单页处理模式
            </button>
            <button
              className={`btn ${isBatch ? 'btn-primary' : 'btn-secondary'}`}
              style={{ flex: 1, padding: '8px', fontSize: '13px' }}
              onClick={() => setIsBatch(true)}
            >
              整话批量模式
            </button>
          </div>

          {/* Inputs */}
          {!isBatch ? (
            <div>
              <label style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                输入漫画单页路径 (Page File)
              </label>
              <input
                type="text"
                className="input-field"
                value={inputPath}
                onChange={(e) => setInputPath(e.target.value)}
              />
            </div>
          ) : (
            <>
              <div>
                <label style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                  整话漫画目录路径 (Chapter Directory)
                </label>
                <input
                  type="text"
                  className="input-field"
                  value={batchDir}
                  onChange={(e) => setBatchDir(e.target.value)}
                />
              </div>
              <div>
                <label style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                  页码区间过滤 (Page Range, 如 03-19)
                </label>
                <input
                  type="text"
                  className="input-field"
                  value={pageRange}
                  onChange={(e) => setPageRange(e.target.value)}
                  placeholder="03-19"
                />
              </div>
            </>
          )}

          {/* Reference Image */}
          <div>
            <label style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
              色彩基准图 (Color Palette Reference)
            </label>
            <input
              type="text"
              className="input-field"
              value={referencePath}
              onChange={(e) => setReferencePath(e.target.value)}
            />
          </div>

          {/* Action Button */}
          <button
            className="btn btn-primary"
            style={{ width: '100%', padding: '12px' }}
            disabled={isProcessing}
            onClick={handleRun}
          >
            {isProcessing ? '⏳ 正在处理中...' : isBatch ? '🚀 开始执行整话批量处理' : '🚀 开始执行单页流水线'}
          </button>

          {/* Status Message */}
          <div style={{ padding: '10px', background: '#0f172a', borderRadius: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
            <strong>状态：</strong> {statusMsg}
          </div>
        </section>

        {/* Right Column: Visualization & Dialogue Table */}
        <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Navigation Tabs */}
          <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
            <button
              className={`btn ${activeTab === 'compare' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '8px 16px', fontSize: '13px' }}
              onClick={() => setActiveTab('compare')}
            >
              📊 双联画对比 (QA Compare)
            </button>
            <button
              className={`btn ${activeTab === 'final' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '8px 16px', fontSize: '13px' }}
              onClick={() => setActiveTab('final')}
            >
              🖼️ 最终成果图 (Final Page)
            </button>
            <button
              className={`btn ${activeTab === 'table' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '8px 16px', fontSize: '13px' }}
              onClick={() => setActiveTab('table')}
            >
              📝 坐标控制台词表 ({dialogueItems.length})
            </button>
          </div>

          {/* Viewer Area */}
          <div style={{ flex: 1, minHeight: '620px', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#0f172a', borderRadius: '8px', overflow: 'hidden', padding: '16px' }}>
            {activeTab === 'compare' && (
              result?.qa_url ? (
                <img
                  src={result.qa_url}
                  alt="QA Compare"
                  style={{ maxWidth: '100%', maxHeight: '680px', objectFit: 'contain', borderRadius: '6px' }}
                />
              ) : (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: '48px', marginBottom: '8px' }}>🖼️</div>
                  <p>点击左侧“开始执行流水线”以生成双联对比视图。</p>
                  <p style={{ fontSize: '12px', marginTop: '4px' }}>展示生肉黑白原稿 vs 无字底稿 vs 全彩汉化最终成果。</p>
                </div>
              )
            )}

            {activeTab === 'final' && (
              result?.final_url ? (
                <img
                  src={result.final_url}
                  alt="Final Result"
                  style={{ maxWidth: '100%', maxHeight: '680px', objectFit: 'contain', borderRadius: '6px' }}
                />
              ) : (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: '48px', marginBottom: '8px' }}>✨</div>
                  <p>暂无最终成果图。</p>
                </div>
              )
            )}

            {activeTab === 'table' && (
              <div style={{ width: '100%', height: '100%', maxHeight: '680px', overflowY: 'auto' }}>
                {dialogueItems.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', paddingTop: '100px' }}>
                    暂无台词数据。执行任务后将展示经过位置校验的完整对话列表。
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ background: '#1e293b', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                        <th style={{ padding: '10px' }}>ID</th>
                        <th style={{ padding: '10px' }}>气泡框坐标 [X1, Y1, X2, Y2]</th>
                        <th style={{ padding: '10px' }}>日文生肉原文 (OCR)</th>
                        <th style={{ padding: '10px' }}>简体中文译文 (连贯汉化)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dialogueItems.map((item) => (
                        <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '10px', color: 'var(--accent)', fontWeight: 600 }}>#{item.id}</td>
                          <td style={{ padding: '10px', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                            [{item.box.join(', ')}]
                          </td>
                          <td style={{ padding: '10px' }}>{item.original}</td>
                          <td style={{ padding: '10px' }}>
                            <input
                              type="text"
                              className="input-field"
                              value={item.translation}
                              onChange={(e) => handleUpdateTranslation(item.id, e.target.value)}
                              style={{ padding: '6px 10px', fontSize: '13px' }}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Settings Modal */}
      {showConfig && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000
        }}>
          <div className="card" style={{ width: '520px', maxWidth: '90vw' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px' }}>⚙️ 流水线配置中心</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '13px', display: 'block', marginBottom: '4px' }}>翻译 API 接口地址</label>
                <input
                  type="text"
                  className="input-field"
                  value={config.api_base}
                  onChange={(e) => setConfig({ ...config, api_base: e.target.value })}
                />
              </div>
              <div>
                <label style={{ fontSize: '13px', display: 'block', marginBottom: '4px' }}>LLM 翻译模型</label>
                <input
                  type="text"
                  className="input-field"
                  value={config.model}
                  onChange={(e) => setConfig({ ...config, model: e.target.value })}
                />
              </div>
              <div>
                <label style={{ fontSize: '13px', display: 'block', marginBottom: '4px' }}>ComfyUI 服务地址</label>
                <input
                  type="text"
                  className="input-field"
                  value={config.comfy_url}
                  onChange={(e) => setConfig({ ...config, comfy_url: e.target.value })}
                />
              </div>
              <div>
                <label style={{ fontSize: '13px', display: 'block', marginBottom: '4px' }}>中文字体文件路径</label>
                <input
                  type="text"
                  className="input-field"
                  value={config.font}
                  onChange={(e) => setConfig({ ...config, font: e.target.value })}
                />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
              <button className="btn btn-secondary" onClick={() => setShowConfig(false)}>关闭</button>
              <button className="btn btn-primary" onClick={() => setShowConfig(false)}>保存设置</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

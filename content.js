if (!document.getElementById('extension-icon')) {
    addIconToPage();
}
let lastCompletionCode = null; // 存储最新生成的代码
let eyeProtectionInterval = 20 * 60 * 1000;
let chatHistory = JSON.parse(localStorage.getItem('chatHistory') || '[]');
let codeHistory = JSON.parse(localStorage.getItem('codeHistory') || '[]');
window.loadHistoryToCurrentSession = function(index) {
    const session = chatHistory[index];
    if (!session) return;

    const contentArea = document.getElementById('ai-dialog-content');
    contentArea.innerHTML = '';

    session.messages.forEach(msg => {
        const decodedContent = decodeURIComponent(msg.text); // URI解码
        const wrapper = document.createElement('div');
        wrapper.dataset.history = true;
        appendMessage(msg.role, decodedContent, true, true); // 第四个参数表示HTML内容
    });

    const historyBox = document.getElementById('history-box');
    if (historyBox) historyBox.remove();

    document.getElementById('ai-dialog').style.display = 'flex';
    contentArea.scrollTop = contentArea.scrollHeight;
};
const stylePatch = document.createElement('style');
stylePatch.textContent = `
    [data-role="user"] {
        background: #3f51b5 !important;
        color: white !important;
    }
    [data-role="assistant"] {
        background: #fff !important;
        color: #333 !important;
    }
    [data-history] {
        opacity: 0.8;
        filter: grayscale(0.1);
    }
`;
document.head.appendChild(stylePatch);
function parseCodeStructure(code) {
    const structures = [];
    const loopRegex = /(for|while|do)\s*\(([^)]+)\)\s*\{/g;
    const conditionRegex = /(if|else if|switch)\s*\(([^)]+)\)\s*\{/g;
    const funcRegex = /(function|const|let)\s+(\w+)\s*\(([^)]*)\)/g;

    let match;
    while ((match = loopRegex.exec(code)) !== null) {
        structures.push({
            type: 'loop',
            keyword: match[1],
            condition: match[2],
            line: code.slice(0, match.index).split('\n').length
        });
    }
    while ((match = conditionRegex.exec(code)) !== null) {
        structures.push({
            type: 'condition',
            keyword: match[1],
            condition: match[2],
            line: code.slice(0, match.index).split('\n').length
        });
    }
    while ((match = funcRegex.exec(code)) !== null) {
        structures.push({
            type: 'function',
            name: match[2],
            params: match[3],
            line: code.slice(0, match.index).split('\n').length
        });
    }
    return structures;
}

//  伪代码生成
function generatePseudocode(code) {
    const structures = parseCodeStructure(code);
    let pseudocode = "BEGIN\n";

    structures.forEach((s, i) => {
        pseudocode += `  ${i + 1}. [LINE ${s.line}] ${s.type.toUpperCase()}`;
        if (s.type === 'function') {
            pseudocode += ` ${s.name}(${s.params})`;
        } else {
            pseudocode += `: ${s.keyword} ${s.condition}`;
        }
        pseudocode += '\n';
    });

    pseudocode += "END";
    return pseudocode;
}

// 伪代码面板
function showPseudocode(code) {
    const pseudocode = generatePseudocode(code);
    const bubble = document.createElement('div');
    Object.assign(bubble.style, {
        background: '#f0f4ff',
        padding: '12px',
        borderRadius: '8px',
        margin: '8px 0',
        whiteSpace: 'pre-wrap',
        fontFamily: 'monospace',
        borderLeft: '3px solid #3f51b5'
    });

    const codeHeader = document.createElement('div');
    codeHeader.textContent = '生成伪代码：';
    codeHeader.style.fontWeight = 'bold';
    codeHeader.style.marginBottom = '8px';

    const codeContent = document.createElement('div');
    codeContent.textContent = pseudocode;

    const analyzeBtn = document.createElement('button');
    Object.assign(analyzeBtn.style, {
        background: '#3f51b5',
        color: 'white',
        border: 'none',
        padding: '6px 12px',
        borderRadius: '4px',
        marginTop: '8px',
        cursor: 'pointer',
        display: 'block'
    });
    analyzeBtn.textContent = '基于伪代码分析';
    analyzeBtn.onclick = () => {
        querySparkApi(`基于伪代码分析：\n${pseudocode}\n请回答：\n1. 算法类型\n2. 时间复杂度\n3. 优化建议`,true);
    };

    bubble.append(codeHeader, codeContent, analyzeBtn);
    return bubble;
}
function addIconToPage() {
    const iconElement = document.createElement('div');
    iconElement.id = 'extension-icon';
    Object.assign(iconElement.style, {
        position: 'fixed',
        top: '50%',
        right: '20px',
        transform: 'translateY(-50%)',
        zIndex: '999999999',
        width: '48px',
        height: '48px',
        background: `url(${chrome.runtime.getURL('icons/assistant.png')}) center/cover`,
        cursor: 'pointer',
        borderRadius: '50%',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        transition: 'transform 0.3s'
    });

    iconElement.addEventListener('click', () => {
        const dialog = document.getElementById('ai-dialog');
        dialog ? dialog.style.display = 'flex' : showAIDialog(true);
        iconElement.style.display = 'none';
    });
    document.body.appendChild(iconElement);
}

function showAIDialog() {
    let dialog = document.getElementById('ai-dialog');
    if (dialog) return;

    dialog = document.createElement('div');
    dialog.id = 'ai-dialog';
    Object.assign(dialog.style, {
        position: 'fixed',
        top: '50%',
        right: '20px',
        transform: 'translateY(-50%)',
        zIndex: '999999999',
        width: '380px',
        height: '600px',
        backgroundColor: '#fff',
        borderRadius: '16px',
        boxShadow: '0 12px 24px rgba(0,0,0,0.2)',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'system-ui, -apple-system, sans-serif'
    });

    // Header
    const header = document.createElement('div');
    Object.assign(header.style, {
        padding: '12px 16px',
        borderBottom: '1px solid #eee',
        display: 'flex',
        justifyContent: 'space-between'
    });


    // Control buttons
    const minimizeBtn = createControlButton('−', () => {
        dialog.style.display = 'none';
        document.getElementById('extension-icon').style.display = 'block'; // 新增显示图标
    });

    const closeBtn = createControlButton('×', () => {

        saveCurrentSession();
        dialog.remove();
        document.getElementById('extension-icon').style.display = 'block';
    });

    header.append(minimizeBtn, closeBtn);

    // Content area
    const contentArea = document.createElement('div');
    contentArea.id = 'ai-dialog-content';
    Object.assign(contentArea.style, {
        flex: '1',
        padding: '16px',
        overflowY: 'auto',
        background: '#f8f9fa'
    });

    // Input area
    const inputContainer = document.createElement('div');
    Object.assign(inputContainer.style, {
        padding: '16px',
        borderTop: '1px solid #eee',
        background: '#fff',
        boxSizing: 'border-box', // 新增
        width: 'calc(100% - 32px)' // 新增
    });

    const buttonRow = document.createElement('div');
    buttonRow.style.display = 'flex';
    buttonRow.style.gap = '8px';
    buttonRow.style.marginBottom = '12px';

    const buttons = [
        { text: '🗂️ 代码工具', action: toggleFunctionMenu }, // 原"功能"
        { text: '🤖  智能分析', action: toggleSmartMenu },    // 原"智能"
        { text: '🕛 历史会话', action: showHistory },        // 原"历史"
        { text: '📝 个性设置', action: toggleSettingsMenu }, // 原"设置"
        { text: '🔌 平台对接', action: togglePlatformMenu }  // 原"平台"
    ];

    buttons.forEach(({text, action}) => {
        const btn = createToolButton(text);
        btn.addEventListener('click', action);
        buttonRow.appendChild(btn);
    });

    const textarea = document.createElement('textarea');
    Object.assign(textarea.style, {
        width: '100%',
        height: '72px',
        padding: '12px',
        border: '1px solid #ddd',
        borderRadius: '8px',
        resize: 'none',
        fontSize: '14px'
    });

    const sendBtn = document.createElement('button');
    Object.assign(sendBtn.style, {
        width: '100%',
        padding: '10px',
        marginTop: '12px',
        background: '#3f51b5',
        color: 'white',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer'
    });
    sendBtn.textContent = '发送';
    sendBtn.addEventListener('click', () => {
        const text = textarea.value.trim();
        const settings = JSON.parse(localStorage.getItem('userSettings') || {});
        if (text) {
            appendMessage('user', text);

            // 直接发问不传第二个参数
            if (settings.enableChat !== false) {
                querySparkApi(text); // 此处不传第二个参数
            } else {
                appendMessage('assistant', '💡 对话功能已关闭，请使用右侧功能按钮进行操作', true);
            }
            textarea.value = '';
        }
    });

    inputContainer.append(buttonRow, textarea, sendBtn, createFileInput());
    dialog.append(header, contentArea, inputContainer);
    document.body.appendChild(dialog);

    // 初始化功能菜单
    initFunctionMenu();
    initPlatformMenu();
}

function appendMessage(role, text, noScroll, isHTML = false) {
    const contentArea = document.getElementById('ai-dialog-content');
    const wrapper = document.createElement('div');
    Object.assign(wrapper.style, {
        display: 'flex',
        justifyContent: role === 'user' ? 'flex-end' : 'flex-start',
        marginBottom: '16px'
    });

    // 创建消息气泡
    const bubble = document.createElement('div');
    bubble.dataset.role = role;
    Object.assign(bubble.style, {
        maxWidth: '80%',
        padding: '12px 16px',
        borderRadius: role === 'user' ? '12px 4px 12px 12px' : '4px 12px 12px 12px',
        background: role === 'user' ? '#3f51b5' : '#fff',
        color: role === 'user' ? 'white' : '#333',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        position: 'relative'
    });

    // 创建头像
    const avatar = document.createElement('div');
    avatar.textContent = role === 'user' ? '👤' : '🤖';
    avatar.style.margin = role === 'user' ? '0 0 0 8px' : '0 8px 0 0';

    // 消息内容处理
    const textNode = document.createElement('div');
    if (isHTML) {
        textNode.innerHTML = text; // 直接插入HTML内容
    } else {
        textNode.innerHTML = text.replace(/\n/g, '<br>');
    }
    bubble.appendChild(textNode);

    // 组装元素
    role === 'user' ? wrapper.append(bubble, avatar) : wrapper.append(avatar, bubble);
    contentArea.appendChild(wrapper);

    // 自动滚动
    if (!noScroll) {
        contentArea.scrollTop = contentArea.scrollHeight;
    }
    role === 'user' ? wrapper.append(bubble, avatar) : wrapper.append(avatar, bubble);
    contentArea.appendChild(wrapper);

    // 返回消息气泡元素
    return bubble;
}
document.querySelector('#ai-dialog button')?.addEventListener('click', () => {
    const settings = JSON.parse(localStorage.getItem('userSettings') || '{}');
    const textarea = document.querySelector('#ai-dialog textarea');
    const text = textarea.value.trim();
    if (settings.eyeProtection !== false) {
        initEyeProtection(settings.eyeProtectionInterval || 20);
    }
    if (settings.autoComplete && isIncompleteCode(text)) {
        const code = extractCode(text);
        handleCodeCompletion(code); // 触发自动补全
        return;
    }
    // 记忆库查询模式
    if (/我开发的.+代码/.test(text)) {
        const result = queryCodeMemory(text);
        appendMessage('assistant', result);
        return;
    }

    if (text) {
        appendMessage('user', text);

        // ++ 伪代码处理逻辑
        if (text.toLowerCase().includes('分析代码')) {
            const codeBlock = text.match(/```([\s\S]*?)```/)?.[1] || text.split('分析代码')[1];
            if (codeBlock) {
                const pseudocode = generatePseudocode(codeBlock);
                appendMessage('assistant', `生成的伪代码：\n\`\`\`\n${pseudocode}\n\`\`\``);
            }
        } else {
            querySparkApi(text,true);
        }

        textarea.value = '';
    }
});
function isIncompleteCode(text) {
    const indicators = ['// TODO', '...', '{', 'function'];
    return indicators.some(indicator => text.includes(indicator)) &&
        !text.includes('}');
}

// 添加样式
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeIn {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
    }
    .debug-panel {
        border: 1px solid #ff980055;
    }
`;
document.head.appendChild(style);

function createControlButton(text, onClick) {
    const btn = document.createElement('button');
    Object.assign(btn.style, {
        width: '24px',
        height: '24px',
        borderRadius: '50%',
        border: 'none',
        background: '#666',
        color: 'white',
        cursor: 'pointer'
    });
    btn.textContent = text;
    btn.addEventListener('click', onClick);
    return btn;
}

function createToolButton(text) {
    const btn = document.createElement('button');
    Object.assign(btn.style, {
        flex: 1,
        padding: '8px',
        border: 'none',
        borderRadius: '8px',
        background: '#eee',
        cursor: 'pointer',
        transition: 'all 0.2s'
    });
    btn.textContent = text;
    btn.addEventListener('mouseenter', () => {
        btn.style.background = '#ddd';
        btn.style.transform = 'scale(1.05)';
    });
    btn.addEventListener('mouseleave', () => {
        btn.style.background = '#eee';
        btn.style.transform = 'none';
    });
    return btn;
}

function createFileInput() {
    const input = document.createElement('input');
    input.type = 'file';
    input.id = 'file-upload';
    input.style.display = 'none';
    input.addEventListener('change', handleFileSelect);
    return input;
}
function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    const statusMsg = appendMessage('assistant', '📤 正在分析文件...', true);

    const formData = new FormData();
    formData.append('file', file);

    fetch('http://localhost:5000/analyze', {
        method: 'POST',
        body: formData
    })
        .then(response => response.json())
        .then(data => {
            statusMsg.remove();

            if (data.error) {
                appendMessage('assistant', `❌ 分析失败: ${data.error}`);
                return;
            }

            const resultHTML = `
            <div style="border-left:3px solid #3f51b5; padding:12px; margin:12px 0; background:#f8f9fa;">
                <div style="color:#3f51b5; font-weight:500;">📄 ${data.filename} 分析结果：</div>
                <pre style="white-space:pre-wrap;">${data.analysis}</pre>
            </div>
        `;
            appendMessage('assistant', resultHTML);
        })
        .catch(error => {
            statusMsg.remove();
            appendMessage('assistant', `❌ 分析失败: ${error.message}`);
        });
}

function querySparkApi(query,isFunctionCall = false) {
    if (query.includes('分析代码')) {
        saveCodeHistory(getEditorContent());
    }
    const settings = JSON.parse(localStorage.getItem('userSettings')) || {};
    // 允许功能调用绕过对话开关
    if (!isFunctionCall && settings.enableChat === false) {
        console.log('对话功能已关闭，仅执行工具操作');
        return;
    }
    // 在消息处理逻辑中添加
    if (query.startsWith('搜索 ')) {
        const  text= query.replace('搜索 ', '');
        handleWebSearch(text).then(showSearchResults);
        return;
    }
    if (settings.onlinesearch) {
        query += "\n请在回复的第一句加上：🌐 结合网上相关资料分析得出：\n" ;
    }
    if (settings.deepThinking) {
        query += "\n请按照以下要求进行深度分析：\n" +
            "1. 分步骤拆解问题核心\n" +
            "2. 提供至少两种解决方案\n" +
            "3. 对比不同方案的优劣\n" +
            "4. 给出优化建议和注意事项\n" +
            "5. 附上相关算法原理说明"+"不要保留这些步骤文字，直接给出问题解答结果";
        chrome.runtime.sendMessage({ action: "query_sparkai", query }, response => {
            // 新增深度思考结果格式化
            const cleanedResponse = settings.deepThinking ?
                formatDeepThinkingResponse(response.response) :
                response.response;

            appendMessage('assistant', cleanedResponse);
        });
    }

    if (settings.learningCoach) {
        query += "\n请同时解释代码中的关键知识点，包括：\n" +
            "1. 使用的数据结构和算法\n" +
            "2. 重要语法特性\n" +
            "3. 最佳实践建议";
    }
    if (settings.autoComplete) {
        query += "\n请将这段代码补全，并只给出补全后的代码即可\n";
    }
    chrome.runtime.sendMessage({ action: "query_sparkai", query }, response => {
        let cleanedResponse = response.response
            .replace(/\|[-]+结束/g, '')  // 移除类似|----结束的标记
            .replace(/[|]+[-]+\s*$/g, ''); // 移除行末的|----
        appendMessage('assistant', cleanedResponse);
    });
}

async function saveCurrentSession() {
    const messages = Array.from(document.querySelectorAll('#ai-dialog-content > div'))
        .filter(wrapper => !wrapper.textContent.includes('对话历史已清空'))
        .map(wrapper => {
            const roleElement = wrapper.querySelector('[data-role="user"], [data-role="assistant"]');
            return {
                role: roleElement?.dataset.role === 'user' ? 'user' : 'assistant',
                text: encodeURIComponent(roleElement?.innerHTML || ''),
                timestamp: new Date().toISOString()
            };
        });

    if (messages.length > 0) {
        // 生成AI标题
        const summary = await generateHistorySummary(messages)
            || new Date().toLocaleTimeString('zh-CN', {
                hour: '2-digit',
                minute: '2-digit'
            });

        // 保持原有去重逻辑
        chatHistory = chatHistory.filter(session =>
            !session.messages.every((msg, i) =>
                decodeURIComponent(msg.text) === decodeURIComponent(messages[i]?.text)
            )
        );

        // 添加summary字段
        if (chatHistory.length >= 50) chatHistory.pop();
        chatHistory.unshift({
            date: new Date().toLocaleString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            }),
            messages,
            summary: summary.slice(0, 10) // 严格10字限制
        });

        localStorage.setItem('chatHistory', JSON.stringify(chatHistory));
    }
    if (settings.autoSaveCode) {
        saveCodeToMemory(); // 新增自动保存
    }
}
async function generateHistorySummary(messages) {
    try {
        // 提取最新3条消息的文本内容
        const context = messages.slice(0, 3)
            .map(m => {
                const text = decodeURIComponent(m.text)
                    .replace(/<[^>]+>/g, '') // 去除HTML标签
                    .replace(/\s+/g, ' ')    // 合并空格
                    .slice(0, 100);          // 每条消息最多取前100字
                return `${m.role === 'user' ? '用户' : '助手'}: ${text}`;
            })
            .join('\n')
            .slice(0, 300); // 总输入长度限制

        const prompt = `请用最多10个汉字总结对话核心内容（不要任何标点符号）:\n"""${context}"""`;

        return new Promise(resolve => {
            chrome.runtime.sendMessage(
                { action: "query_sparkai", query: prompt },
                response => {
                    if (response.success) {
                        // 强力清洗结果
                        const clean = response.response
                            .replace(/["“”【】《》！？，。、；：]/g, '') // 去除中文标点
                            .replace(/[^\u4e00-\u9fa5]/g, '')          // 只保留中文
                            .trim()
                            .substring(0, 10);
                        resolve(clean || null);
                    } else {
                        resolve(null);
                    }
                }
            );
        });
    } catch (e) {
        console.error('标题生成失败:', e);
        return null;
    }
}

function showHistory() {
    const dialog = document.getElementById('ai-dialog');
    if (dialog) dialog.style.display = 'none';

    // 移除已存在的历史弹窗
    const existingHistory = document.getElementById('history-box');
    if (existingHistory) existingHistory.remove();

    const historyBox = document.createElement('div');
    historyBox.id = 'history-box';
    Object.assign(historyBox.style, {
        position: 'fixed',
        top: '50%',
        right: '20px',
        transform: 'translateY(-50%)',
        zIndex: '999999998',  // 确保在主对话框之下
        width: '380px',
        height: '600px',
        backgroundColor: '#fff',
        borderRadius: '16px',
        padding: '16px',
        boxShadow: '0 12px 24px rgba(0,0,0,0.2)',
        overflowY: 'auto'
    });

    // 标题部分
    const title = document.createElement('h3');
    Object.assign(title.style, {
        margin: '0 0 16px 0',
        fontSize: '16px',
        color: '#3f51b5',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
    });

    const titleText = document.createElement('span');
    titleText.textContent = `对话历史 (${chatHistory.length}/50)`;

    const closeTitleBtn = document.createElement('button');
    Object.assign(closeTitleBtn.style, {
        background: 'none',
        border: 'none',
        color: '#666',
        fontSize: '20px',
        cursor: 'pointer',
        padding: '0'
    });
    closeTitleBtn.innerHTML = '&times;';
    closeTitleBtn.addEventListener('click', () => historyBox.remove());

    title.append(titleText, closeTitleBtn);

    // 历史记录容器
    const historyContent = document.createElement('div');

    if (chatHistory.length === 0) {
        const emptyMsg = document.createElement('div');
        emptyMsg.textContent = '暂无历史记录';
        emptyMsg.style.textAlign = 'center';
        emptyMsg.style.color = '#666';
        emptyMsg.style.padding = '20px';
        historyContent.appendChild(emptyMsg);
    } else {
        chatHistory.forEach((session, index) => {
            const item = document.createElement('div');
            Object.assign(item.style, {
                padding: '12px',
                marginBottom: '12px',
                background: '#f8f9fa',
                borderRadius: '8px',
                position: 'relative'
            });

            // 删除按钮
            const deleteBtn = document.createElement('button');
            Object.assign(deleteBtn.style, {
                position: 'absolute',
                top: '8px',
                right: '8px',
                width: '20px',
                height: '20px',
                background: '#ff4444dd',
                color: 'white',
                border: 'none',
                borderRadius: '50%',
                cursor: 'pointer',
                transition: 'all 0.2s'
            });
            deleteBtn.innerHTML = '×';
            deleteBtn.addEventListener('mouseenter', () => deleteBtn.style.background = '#ff0000');
            deleteBtn.addEventListener('mouseleave', () => deleteBtn.style.background = '#ff4444dd');
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                chatHistory.splice(index, 1);
                localStorage.setItem('chatHistory', JSON.stringify(chatHistory));
                item.remove();
                titleText.textContent = `对话历史 (${chatHistory.length}/50)`;
            });

            // 会话预览
            const date = document.createElement('div');
            date.innerHTML = `
    <div style="font-size:12px;color:#666">${session.date}</div>
    <div style="
        font-weight: 500;
        color: #3f51b5;
        margin: 4px 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap
    ">
        ${session.summary || '新对话'}
    </div>
`;

            const preview = document.createElement('div');
            preview.textContent = session.messages[0]?.text.slice(0, 60) + (session.messages[0]?.text.length > 60 ? '...' : '');
            preview.style.margin = '8px 0';
            preview.style.color = '#333';
            preview.style.fontSize = '14px';

            // 操作按钮
            const btnContainer = document.createElement('div');
            btnContainer.style.display = 'flex';
            btnContainer.style.gap = '8px';
            btnContainer.style.marginTop = '12px';

            const loadBtn = document.createElement('button');
            Object.assign(loadBtn.style, {
                padding: '6px 12px',
                background: '#3f51b5',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '12px',
                transition: 'all 0.2s'
            });
            loadBtn.textContent = '加载会话';
            loadBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                historyBox.remove();
                window.loadHistoryToCurrentSession(index);
                if (dialog) dialog.style.display = 'flex';
            });

            btnContainer.append(loadBtn, deleteBtn);
            item.append(date, preview, btnContainer);
            historyContent.appendChild(item);
        });
    }

    // 清空全部按钮
    const clearAllBtn = document.createElement('button');
    Object.assign(clearAllBtn.style, {
        width: '100%',
        padding: '12px',
        marginTop: '16px',
        background: '#ff444433',
        color: '#ff4444',
        border: '1px solid #ff444466',
        borderRadius: '8px',
        cursor: 'pointer',
        fontWeight: '500',
        transition: 'all 0.2s'
    });
    clearAllBtn.textContent = '清空全部历史';
    clearAllBtn.addEventListener('mouseenter', () => {
        clearAllBtn.style.background = '#ff444411';
    });
    clearAllBtn.addEventListener('mouseleave', () => {
        clearAllBtn.style.background = '#ff444433';
    });
    clearAllBtn.addEventListener('click', () => {
        if (confirm('确定要永久删除所有历史记录吗？')) {
            chatHistory = [];
            localStorage.removeItem('chatHistory');
            historyBox.remove();
            if (dialog) dialog.style.display = 'flex';
        }
    });
    const closeHistoryBtn = document.createElement('button');
    Object.assign(closeHistoryBtn.style, {
        width: '100%',
        padding: '12px',
        marginTop: '8px',
        background: '#3f51b5',
        color: 'white',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer'
    });
    closeHistoryBtn.textContent = '返回主界面';
    closeHistoryBtn.addEventListener('click', () => {
        historyBox.remove();
        document.getElementById('ai-dialog').style.display = 'flex';
    });

    // 组装组件
    historyBox.append(title, historyContent);
    if (chatHistory.length > 0) historyBox.append(clearAllBtn);
    historyBox.append(closeHistoryBtn);

    // 点击外部关闭
    const clickHandler = (e) => {
        if (!historyBox.contains(e.target)) {
            historyBox.remove();
            document.removeEventListener('click', clickHandler);
            if (dialog) dialog.style.display = 'flex';
        }
    };
    setTimeout(() => document.addEventListener('click', clickHandler), 0);

    document.body.appendChild(historyBox);
}

function createFuncBtn(text, onClick) {
    const btn = document.createElement('button');
    Object.assign(btn.style, {
        width: '100%',
        padding: '10px',
        background: '#673ab7',
        color: 'white',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        transition: 'transform 0.2s',

    });
    btn.innerHTML = text;
    btn.style.textAlign = 'left';
    btn.style.paddingLeft = '16px';
    btn.addEventListener('mouseenter', () => btn.style.transform = 'scale(1.02)');
    btn.addEventListener('mouseleave', () => btn.style.transform = 'none');
    btn.addEventListener('click', onClick);
    return btn;
}
function getLatestUserMessage() {
    const messages = Array.from(document.querySelectorAll('#ai-dialog-content > div'));
    for (let i = messages.length - 1; i >= 0; i--) {
        const bubble = messages[i].querySelector('[data-role="user"]');
        if (bubble) {
            return bubble.textContent
                .replace(/<\/?[^>]+(>|$)/g, "")
                .trim()
                .replace(/\s+/g, ' ');
        }
    }
    return null;
}

function handleFunction(mode) {
    const message = getLatestUserMessage();

    // 增强型空值检测
    if (!message) {
        appendMessage('assistant', '❌ 分析失败：未找到有效内容\n可能原因：\n1. 尚未发送消息\n2. 消息内容为空\n3. 消息已被清空');
        return;
    }

    // 定义分析模板
    const prompts = {
        explain: `请深度理解下面的内容：\n「${message}」\n需要包含：\n1.逐行理解代码，为每一行代码添加注释，并给出添加注释后的代码\n2.代码的作用和关键组成要素\n3. 实际应用场景\n4.不要显示这些要求文字`,
        debug: `请全面诊断以下内容：\n「${message}」\n需要包含：\n1. 检查代码是否存在问题，若不存在则说代码能正确运行\n2.如果代码存在错误则分析错误根本原因分析\n3. 代码改进方案建议`,
        analyze: `请专业评估以下内容：\n「${message}」\n需要包含：\n1. 复杂度量化分析，从以下方面进行分析：耦合与内聚复杂度，时间复杂度，空间复杂度，控制流复杂度，数据结构复杂度，如果没有涉及到对应复杂度则不说\n2. 指出影响代码性能的关键问题\n3. 代码该如何在性能方面进行优化`
    };

    // 显示加载状态
    const loadingId = Date.now();
    appendMessage('assistant', `🔄 分析进行中 (ID: ${loadingId})...`);

    // 执行分析
    querySparkApi(prompts[mode],true);

    // 关闭功能菜单
    document.getElementById('func-menu').style.display = 'none';
}
function handlesmartFunction(mode) {
    const message = getLatestUserMessage();

    // 增强型空值检测
    if (!message) {
        appendMessage('assistant', '❌ 分析失败：未找到有效内容\n可能原因：\n1. 尚未发送消息\n2. 消息内容为空\n3. 消息已被清空');
        return;
    }

    // 定义分析模板
    const prompts = {
        testcase: `请为以下内容编写测试用例：\n「${message}」\n需要包含：\n1. 常规测试用例\n2. 边界测试用例\n3. 非常规测试用例`,
        health: `请全面诊断以下内容：\n「${message}」\n需要包含：\n1. 潜在安全问题定位\n2. 根本原因分析\n3. 改进方案建议`,
        refactor: `请对以下内容进行代码重构：\n「${message}」\n\n1. 重构后的代码信息\n2. 重构修改了哪些地方\n3. 重构后的代码优点在哪里`
    };

    // 显示加载状态
    const loadingId = Date.now();
    appendMessage('assistant', `🔄 分析进行中 (ID: ${loadingId})...`, true);

    // 执行分析
    querySparkApi(prompts[mode],true);

    // 关闭功能菜单
    document.getElementById('func-menu').style.display = 'none';
}


function clearConversation() {
    const contentArea = document.getElementById('ai-dialog-content');
    contentArea.innerHTML = '';
    const systemMsg = document.createElement('div');
    systemMsg.textContent = '对话历史已清空';
    systemMsg.style.textAlign = 'center';
    systemMsg.style.color = '#666';
    systemMsg.style.padding = '20px';
    contentArea.appendChild(systemMsg);
}
function showHelpDocument(fromSettings = false) {
    const helpBox = document.createElement('div');
    helpBox.id = 'help-box';
    Object.assign(helpBox.style, {
        position: 'fixed',
        top: '50%',
        right: '20px',
        transform: 'translateY(-50%)',
        zIndex: '999999999',
        width: '420px',  // 加宽以适应更多内容
        height: '600px',
        backgroundColor: '#fff',
        borderRadius: '16px',
        padding: '24px',
        boxShadow: '0 12px 24px rgba(0,0,0,0.2)',
        overflowY: 'auto'
    });

    const content = `
         <h3 style="color:#3f51b5; margin:0 0 16px 0; border-bottom:2px solid #eee; padding-bottom:8px">菜单功能全解</h3>

        <!-- 🧰 代码工具菜单 -->
        <div style="margin-bottom:24px">
            <h4 style="color:#3f51b5; margin:12px 0">🧰 代码工具</h4>
            <ul style="padding-left:16px; color:#444">
                <li>
                    <strong>📁 文件分析</strong>
                    <div style="margin:6px 0 12px; padding-left:8px">
                        ▶︎ 效果：解析本地代码文件生成摘要<br>
                        ▶︎ 使用：点击「代码工具→上传文件」<br>
                        ▶︎ 注意：仅支持.txt/.js/.py格式，最大2MB
                </li>
                <li>
                    <strong>📝 代码解释</strong>
                    <div style="margin:6px 0 12px; padding-left:8px">
                        ▶︎ 效果：逐行解释发送代码逻辑<br>
                        ▶︎ 使用：发送代码过后对最新发送的代码进行解释"/explain"<br>
                        ▶︎ 注意：需保持代码结构完整
                    </div>
                </li>
                <li>
                    <strong>🐞 错误分析</strong>
                    <div style="margin:6px 0 12px; padding-left:8px">
                        ▶︎ 效果：定位运行时错误和逻辑缺陷<br>
                        ▶︎ 使用：在错误日志上点击「分析」按钮<br>
                        ▶︎ 注意：需包含错误上下文
                    </div>
                </li>
                <li>
                    <strong>🗑️ 清空对话</strong>
                    <div style="margin:6px 0 12px; padding-left:8px">
                        ▶︎ 效果：重置当前会话窗口<br>
                        ▶︎ 使用：输入"/clear"或点击垃圾桶图标<br>
                        ▶︎ 注意：不可撤销操作
                    </div>
                </li>
            </ul>
        </div>

        <!-- 💡 智能菜单 -->
        <div style="margin-bottom:24px">
            <h4 style="color:#3f51b5; margin:12px 0">💡 智能分析</h4>
            <ul style="padding-left:16px; color:#444">
                <li>
                    <strong>♻代码重构</strong>
                    <div style="margin:6px 0 12px; padding-left:8px">
                        ▶︎ 效果：自动优化代码结构和命名规范<br>
                        ▶︎ 使用：选中代码后点击「智能→重构」<br>
                        ▶︎ 注意：会修改原始代码，建议先保存
                    </div>
                </li>
                <li>
                    <strong>🧪 测试用例</strong>
                    <div style="margin:6px 0 12px; padding-left:8px">
                        ▶︎ 效果：生成代码对应的输入输出测试用例<br>
                        ▶︎ 使用：发送函数后点击按钮<br>
                        ▶︎ 注意：需明确输入输出类型
                    </div>
                </li>
                <li>
                    <strong>⚠ 安全检测</strong>
                    <div style="margin:6px 0 12px; padding-left:8px">
                        ▶︎ 效果：检测安全漏洞和代码异味<br>
                        ▶︎ 使用：上传文件后自动触发<br>
                        ▶︎ 注意：支持ESLint规则检测
                    </div>
                </li>
                <li>
                    <strong>💾 代码记忆</strong>
                    <div style="margin:6px 0 12px; padding-left:8px">
                        ▶︎ 效果：保存20个常用代码片段<br>
                        ▶︎ 使用：点击💾按钮将保存最近一次发送的代码信息<br>
                        ▶︎ 注意：若未发送点击则并不会存入
                    </div>
                </li>
            </ul>
        </div>

        <!-- 🕰️ 历史菜单 -->
        <div style="margin-bottom:24px">
            <h4 style="color:#3f51b5; margin:12px 0">🕰️ 历史管理</h4>
            <ul style="padding-left:16px; color:#444">
                <li>
                    <strong>🗃️ 会话历史</strong>
                    <div style="margin:6px 0 12px; padding-left:8px">
                        ▶︎ 效果：查看/加载过往50条对话记录<br>
                        ▶︎ 使用：点击侧边栏时钟图标<br>
                        ▶︎ 注意：请不要清除本地存储记录
                    </div>
                </li>
                
                
            </ul>
        </div>

        <!-- ⚙️ 设置菜单 -->
        <div style="margin-bottom:24px">
            <h4 style="color:#3f51b5; margin:12px 0">⚙️ 系统设置</h4>
            <ul style="padding-left:16px; color:#444">
                <li>
                    <strong>🎨 主题颜色</strong>
                    <div style="margin:6px 0 12px; padding-left:8px">
                        ▶︎ 效果：自定义主界面配色方案<br>
                        ▶︎ 使用：设置→外观→主题颜色<br>
                        ▶︎ 注意：需刷新页面生效
                    </div>
                </li>
                <li>
                    <strong>🤖 自动补全</strong>
                    <div style="margin:6px 0 12px; padding-left:8px">
                        ▶︎ 效果：代码片段智能联想<br>
                        ▶︎ 使用：设置→编辑器→开启自动补全<br>
                        ▶︎ 注意：依赖网络连接质量
                    </div>
                </li>
                <li>
                    <strong>🧠 深度思考</strong>
                    <div style="margin:6px 0 12px; padding-left:8px">
                        ▶︎ 效果：生成多步骤解决方案<br>
                        ▶︎ 使用：设置→智能模式→开启深度思考<br>
                        ▶︎ 注意：响应时间增加30-50%
                    </div>
                </li>
                <li>
                    <strong>教练模式与健康管家</strong>
                    <div style="margin:6px 0 12px; padding-left:8px">
                        ▶︎ 效果：将以教练的模式对编程进行指导，以及避免长时间使用助手忽略健康问题<br>
                    </div>
                </li>
            </ul>
        </div>

        <!-- 🔌 平台菜单 -->
        <div style="margin-bottom:24px">
            <h4 style="color:#3f51b5; margin:12px 0">🔌 平台对接</h4>
            <ul style="padding-left:16px; color:#444">
                <li>
                    <strong>📝 题目解析</strong>
                    <div style="margin:6px 0 12px; padding-left:8px">
                        ▶︎ 效果：生成平台题目分析代码<br>
                        ▶︎ 使用：在题目页面点击「平台→解析」<br>
                        ▶︎ 注意：需处于题目描述页
                    </div>
                </li>
                <li>
                    <strong>💡 思路提示</strong>
                    <div style="margin:6px 0 12px; padding-left:8px">
                        ▶︎ 效果：提供3种算法思路对比<br>
                        ▶︎ 使用：输入"hint"或点击灯泡图标<br>
                        ▶︎ 注意：可能包含剧透内容
                    </div>
                </li>
                <li>
                    <strong>🚀 自动填入</strong>
                    <div style="margin:6px 0 12px; padding-left:8px">
                        ▶︎ 效果：一键提交代码到编辑器<br>
                        ▶︎ 使用：智能补全按钮点击后再点击自动填入<br>
                        ▶︎ 注意：需登录目标平台账号
                    </div>
                </li>
                <li>
                    <strong>🤖 自动补全</strong>
                    <div style="margin:6px 0 12px; padding-left:8px">
                        ▶︎ 效果：根据页面题目信息给出对应补全后的代码<br>
                        ▶︎ 使用：在平台题目描述页面和解答页面点击<br>
                    </div>
                </li>
            </ul>
        </div>

        <!-- ⚠️ 全局注意事项 -->
        <div style="color:#ff4444; border-top:1px solid #eee; padding-top:16px">
            <h4 style="margin:16px 0 8px 0">⚠️ 重要限制说明</h4>
            <ul style="padding-left:16px">
                <li>出现功能卡顿问题时，刷新页面即可</li>
                <li>文件上传需允许浏览器跨域权限</li>
                <li>部分功能需页面完全加载后使用</li>
                <li>自动填入功能仅限平台页面使用</li>
            </ul>
        </div>
    `;
    helpBox.innerHTML = content;
    if (fromSettings) {
        const returnBtn = document.createElement('button');
        Object.assign(returnBtn.style, {
            position: 'absolute',
            top: '12px',
            left: '12px',
            background: 'var(--primary-color, #3f51b5)',
            color: 'white',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '4px',
            cursor: 'pointer'
        });
        returnBtn.textContent = '← 返回设置';
        returnBtn.addEventListener('click', () => {
            helpBox.remove();
            toggleSettingsMenu();
            document.getElementById('settings-menu').style.display = 'block'; // 强制显示设置菜单
        });
        helpBox.querySelector('h3').prepend(returnBtn);
    }

    const closeBtn = document.createElement('button');
    Object.assign(closeBtn.style, {
        width: '100%',
        padding: '10px',
        marginTop: '16px',
        background: '#3f51b5',
        color: 'white',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        transition: 'background 0.2s'
    });
    closeBtn.onmouseenter = () => closeBtn.style.background = '#2c387e';
    closeBtn.onmouseleave = () => closeBtn.style.background = '#3f51b5';
    closeBtn.textContent = '关闭帮助';
    closeBtn.addEventListener('click', () => helpBox.remove());


    helpBox.appendChild(closeBtn);
    document.body.appendChild(helpBox);
}

function initFunctionMenu() {
    let menu = document.getElementById('func-menu');
    if (menu) return;

    menu = document.createElement('div');
    menu.id = 'func-menu';
    Object.assign(menu.style, {
        position: 'absolute',
        bottom: '140px',
        right: '20px',
        background: '#fff',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        padding: '8px',
        display: 'none',
        flexDirection: 'column',
        gap: '4px',
        zIndex: 1000,
        width: '160px'
    });

    const buttons = [
        createFuncBtn('📁 文件分析', () => {
            document.getElementById('file-upload').click();
            menu.style.display = 'none';
        }),
        createFuncBtn('📝 代码解释', () => handleFunction('explain')),
        createFuncBtn('🔍  错误分析', () => handleFunction('debug')),
        createFuncBtn('📊  复杂度评估', () => handleFunction('analyze')),
        createFuncBtn('🗑️ 清空对话', clearConversation)
    ];

    buttons.forEach(btn => {
        btn.style.fontSize = '14px';
        btn.style.padding = '10px 16px';
        btn.style.width = '100%';
        btn.style.boxSizing = 'border-box';
        btn.style.justifyContent = 'flex-start';
    });

    menu.append(...buttons);
    document.getElementById('ai-dialog').appendChild(menu);
}



function toggleFunctionMenu(e) {
    const menu = document.getElementById('func-menu');
    if (!menu) initFunctionMenu();  // 确保菜单存在

    // 关闭其他菜单
    if (platformMenu && platformMenu.style.display !== 'none') {
        platformMenu.style.display = 'none';
    }

    menu.style.display = menu.style.display === 'none' ? 'flex' : 'none';
    e.stopPropagation();
}
// 添加全局点击关闭监听
document.addEventListener('click', (e) => {
    const funcMenu = document.getElementById('func-menu');
    if (funcMenu && !funcMenu.contains(e.target)){
        funcMenu.style.display = 'none';
    }
    // 关闭智能菜单
    if (smartMenu && !smartMenu.contains(e.target)) {
        smartMenu.style.display = 'none';
    }
});
// 初始化时创建功能菜单
document.addEventListener('DOMContentLoaded', () => {
    initFunctionMenu();
    initPlatformMenu();
    initSmartMenu(); // 新增智能菜单初始化
});
let platformMenu = null;

function initPlatformMenu() {
    if (platformMenu && document.body.contains(platformMenu)) return;

    platformMenu = document.createElement('div');
    platformMenu.id = 'platform-menu';
    Object.assign(platformMenu.style, {
        position: 'fixed',
        bottom: '140px',
        right: '20px',
        background: '#fff',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        padding: '8px',
        display: 'none',
        flexDirection: 'column',
        gap: '4px',
        zIndex: '2147483647',
        width: '200px',
        animation: 'fadeIn 0.2s ease-out'
    });

    document.body.appendChild(platformMenu);
    refreshPlatformMenu();
}

function createPlatformButton(text, onClick) {
    const btn = document.createElement('button');
    Object.assign(btn.style, {
        width: '100%',
        padding: '10px 16px',
        background: '#673ab7',
        color: 'white',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        transition: 'all 0.2s',
        textAlign: 'left',
        fontSize: '14px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
    });

    // 添加图标和文字
    const [icon, label] = text.split(' ');
    btn.innerHTML = `${icon} <span>${label}</span>`;

    btn.addEventListener('mouseenter', () => {
        btn.style.background = '#512da8';
        btn.style.transform = 'translateX(4px)';
    });
    btn.addEventListener('mouseleave', () => {
        btn.style.background = '#673ab7';
        btn.style.transform = 'none';
    });
    btn.addEventListener('click', onClick);
    return btn;
}
// 修改菜单切换函数
function togglePlatformMenu(e) {
    try {
        initPlatformMenu();
        const isVisible = platformMenu.style.display === 'block';

        // 关闭其他菜单
        const funcMenu = document.getElementById('func-menu');
        if (funcMenu) funcMenu.style.display = 'none';

        platformMenu.style.display = isVisible ? 'none' : 'block';
        e.stopPropagation();
    } catch (error) {
        console.error('平台菜单操作失败:', error);
    }
}
function isProblemPage() {
    // 更精准的URL匹配规则
    return /\/problems\/[^/]+\/(desc|submit)/.test(location.pathname);
}

function isSubmitPage() {
    return /\/submit$/.test(location.pathname);
}
function refreshPlatformMenu() {
    platformMenu.innerHTML = '';
    const isSubmit = isSubmitPage();
    const buttons = [];

    // 通用功能
    buttons.push(
        createPlatformButton('📝 题目解析', handleProblemAnalysis),
        createPlatformButton('💡 思路提示', handleHint)
    );

    // 提交页专属功能
    if (isSubmit) {
        buttons.push(
            createPlatformButton('🧩 智能补全', handleCodeCompletion),
            createPlatformButton('💾 自动填入', async () => {
                if (!lastCompletionCode) {
                    appendMessage('assistant', '❌ 请先生成补全代码');
                    return;
                }

                const success = await copyToClipboard(lastCompletionCode);
                if (success) {
                    appendMessage('assistant', '✅ 代码已复制到剪贴板，鼠标移入编辑器自动粘贴');
                } else {
                    appendMessage('assistant', '❌ 剪贴板权限被拒绝，请手动粘贴');
                }
            })

        );
    }

    buttons.forEach(btn => {
        btn.style.margin = '6px';
        btn.style.padding = '8px 12px';
        platformMenu.appendChild(btn);
    });
}
// 添加全局点击关闭监听
document.addEventListener('click', (e) => {
    if (platformMenu && !platformMenu.contains(e.target)) {
        platformMenu.style.display = 'none';
    }
});
// 题目解析功能
async function handleProblemAnalysis() {

        const problemDesc = getProblemDescription();
        const lang = detectProgrammingLanguage();

        // 结构化提示词
        const prompt = `包含以下内容：
题目描述：
${problemDesc.slice(0, 2000)}

要求：
1. 讲解问题和解决问题的逻辑
2. 问题考察的知识点
3. 提供关键算法
4. 说明题目难点


请使用自然流畅的中文直接回答，不要添加代码信息，不要添加"结束"、"完毕"等无关标记。`;

        appendMessage('assistant', '🔄 正在生成题目解析...', true);
        const pseudocode = await querySparkApi(prompt,true);
        appendMessage('assistant', pseudocode);


}


// 修改思路提示函数
async function handleHint() {

        const problemDesc = getProblemDescription();

        // 算法识别提示词
        const prompt = `分析题目并给出算法思路：
题目描述：
${problemDesc.slice(0, 2000)}

请按以下结构回答（不要使用任何分隔线或结束标记）：
1. 核心考察点：列出3-5个关键点
2. 推荐算法：给出2-3种适用算法
3. 复杂度对比：表格展示不同算法的时间/空间复杂度
4. 伪代码框架：给出主函数框架

请使用自然流畅的中文直接回答，不要添加"结束"、"完毕"等无关标记。`;

        appendMessage('assistant', '💡 正在生成解题思路...', true);
        const analysis = await querySparkApi(prompt,true);
        appendMessage('assistant', analysis);

}



function getLatestUserMessage() {
    const messages = Array.from(document.querySelectorAll('#ai-dialog-content > div'));
    for (let i = messages.length - 1; i >= 0; i--) {
        const bubble = messages[i].querySelector('[data-role="user"]');
        if (bubble) {
            // 清理文本内容
            const rawText = bubble.textContent;
            const cleanText = rawText
                .replace(/<\/?[^>]+(>|$)/g, "") // 移除HTML标签
                .replace(/\s+/g, ' ')            // 合并连续空格
                .trim();                         // 去除首尾空格

            // 有效性验证
            if (cleanText &&
                cleanText !== "对话历史已清空" &&
                cleanText.length >= 2) {
                return cleanText;
            }
        }
    }
    return null;
}

function hasFunction(code) {
    return /function\s+main\s*\(/.test(code);
}

const EDITOR_SELECTORS = {
    monaco: '.monaco-editor textarea',
    codeMirror: '.CodeMirror',
    textarea: 'textarea[name="code"]',
    monacoLines: '.view-lines.monaco-mouse-cursor-text', // 新增精准定位
    monacoTextarea: '.monaco-editor textarea' // Monaco隐藏的textarea
};

async function handleCodeCompletion() {
    try {
        const loadingId = Date.now();
        // 添加加载状态提示
        const loadingMsg = appendMessage('assistant', '🔄 正在启动智能补全...', true);

        // 移除自动触发相关逻辑
        const code = getExistingCodeContent();
        const lang = detectProgrammingLanguage();

        // 空代码生成完整模板
        if (!code.trim()) {
            const template = generateCodeTemplate(lang);
            insertCode(template);
            appendMessage('assistant', `✅ 已生成${lang.toUpperCase()}初始模板`);
            return;
        }

        appendMessage('assistant', `🔄 正在分析代码进行智能补全 (ID: ${loadingId})...`, true);

        // 构建精准补全提示
        const prompt = buildCompletionPrompt(code, lang);

        // 调用AI接口
        const response = await new Promise(resolve => {
            chrome.runtime.sendMessage(
                { action: "query_sparkai", query: prompt },
                response => resolve(response))
        });
        if (loadingMsg && loadingMsg.remove) {
            loadingMsg.remove();
        }

        // 处理响应
        if (response.success) {
            const completion = extractCompletion(response.response, code);
            showSimpleCompletion(completion);
        } else {
            appendMessage('assistant', '❌ 补全失败: ' + (response.error || '未知错误'));
        }
    } catch (e) {
        appendMessage('assistant', `❌ 补全失败: ${e.message}`);
        console.error('智能补全错误:', e);
    }
}
// 核心工具函数
function getExistingCodeContent() {
    // 优先提取Monaco编辑器内容
    const monacoLines = Array.from(document.querySelectorAll('.view-line'))
        .map(line => Array.from(line.querySelectorAll('.mtk1, .mtk6, .mtk7'))
            .map(span => span.textContent).join(''))
        .filter(line => line.trim());
    if (monacoLines.length > 0) return monacoLines.join('\n');

    // 兼容CodeMirror编辑器
    const codeMirror = document.querySelector('.CodeMirror');
    if (codeMirror?.CodeMirror?.getValue()) {
        return codeMirror.CodeMirror.getValue();
    }

    // 原生文本域检测
    const textarea = document.querySelector('textarea[name="code"]');
    if (textarea) return textarea.value;

    return "";
}


function buildCompletionPrompt(code, lang) {
    const problemDesc = getProblemDescription().slice(0, 1500);
    const langMap = {
        py: 'Python',
        python: 'Python',
        c: 'C',
        cpp: 'C++',
        java: 'Java'
    };

    return `作为专业${langMap[lang]}开发者，请基于以下内容补全代码：
【题目要求】
${problemDesc}

【当前代码】
\`\`\`${lang}
${code || '// 代码为空，请生成初始模板'}
\`\`\`

请：
1. ${code ? '续写代码保持连贯性' : '生成完整解决方案'}
2. 添加必要的中文注释
3. 严格使用${langMap[lang]}语法规范
4. 保持与已有代码的缩进风格一致
5. 直接返回完整代码`;
}
function extractCompletion(response, originalCode) {
    // 直接使用AI返回的完整代码（假设AI已正确处理补全）
    return extractCodeFromResponse(response);
}
function showSimpleCompletion(completion) {
    lastCompletionCode = completion;
    const completionHTML = `
        <div style="
            border: 1px solid #3f51b5;
            border-radius: 8px;
            padding: 16px;
            margin: 12px 0;
            background: #f8f9fa;
        ">
            <h4 style="color:#3f51b5; margin-top:0">代码补全建议</h4>
            
            <pre style="
                margin: 0;
                padding: 12px;
                background: white;
                border-radius: 6px;
                overflow-x: auto;
                border: 1px solid #eee;
                font-family: Consolas, monospace;
            ">${completion.replace(/</g, '&lt;')}</pre>

          
                
            </button>
        </div>
    `;

    appendMessage('assistant', completionHTML);
}

async function analyzeCodeStructure(code, requirements) {
    // 代码结构分析
    const issues = {
        missingFunctions: [],
        incompleteBlocks: [],
        unmetRequirements: [],
        syntaxErrors: []
    };

    // 1. 检查未实现函数
    requirements.functions.forEach(func => {
        if (!new RegExp(`function\\s+${func.name}\\s*\\(`).test(code)) {
            issues.missingFunctions.push(func);
        }
    });

    // 2. 检测不完整代码块
    const blockRegex = /(if|while|for|function)\s*\([^)]*\)\s*\{[^}]*$/g;
    let match;
    while ((match = blockRegex.exec(code)) !== null) {
        issues.incompleteBlocks.push({
            type: match[1],
            line: code.slice(0, match.index).split('\n').length
        });
    }

    // 3. 验证题目要求
    requirements.conditions.forEach(cond => {
        if (!code.includes(cond.key)) {
            issues.unmetRequirements.push(cond);
        }
    });

    // 4. 语法错误检测
    try {
        new Function(code);
    } catch (e) {
        issues.syntaxErrors.push({
            message: e.message,
            line: e.lineNumber || '未知'
        });
    }

    return {
        isValid: issues.missingFunctions.length +
            issues.incompleteBlocks.length +
            issues.unmetRequirements.length === 0,
        missingParts: issues
    };
}


async function generateCompletionSuggestion(code, analysis) {
    // 构建补全提示
    const promptParts = [];

    if (analysis.missingFunctions.length > 0) {
        promptParts.push(`需要实现以下函数：${
            analysis.missingFunctions.map(f => f.name).join(', ')
        }`);
    }

    if (analysis.incompleteBlocks.length > 0) {
        promptParts.push(`以下代码块不完整：${
            analysis.incompleteBlocks.map(b => `${b.type} (第${b.line}行)`).join(', ')
        }`);
    }

    if (analysis.unmetRequirements.length > 0) {
        promptParts.push(`需要满足以下条件：${
            analysis.unmetRequirements.map(c => c.text).join(', ')
        }`);
    }

    const fullPrompt = `根据题目要求和当前代码状态：
${promptParts.join('\n')}

请：
1. 补全缺失代码
2. 保持原有代码风格
3. 添加必要注释

当前代码：
\`\`\`
${code}
\`\`\`
`;

    // 调用AI生成补全
    return querySparkApi(fullPrompt,true);
}


function showCodeCompletion(suggestion, issues) {
    const completionHTML = `
        <div style="border:1px solid #3f51b5; border-radius:8px; padding:12px; margin:8px 0">
            <h4 style="color:#3f51b5; margin-top:0">✨ 智能补全建议</h4>
            
            ${issues.missingFunctions.length > 0 ? `
                <div style="margin-bottom:12px">
                    <div style="color:#666">缺失函数：</div>
                    ${issues.missingFunctions.map(f => `
                        <div style="padding:4px; background:#f0f4ff; margin:4px 0; border-radius:4px">
                            <code>function ${f.name}()</code> - ${f.desc}
                        </div>
                    `).join('')}
                </div>
            ` : ''}

            ${issues.incompleteBlocks.length > 0 ? `
                <div style="margin-bottom:12px">
                    <div style="color:#666">不完整代码块：</div>
                    ${issues.incompleteBlocks.map(b => `
                        <div style="padding:4px; background:#fff3e0; margin:4px 0; border-radius:4px">
                            第${b.line}行 ${b.type}语句未完成
                        </div>
                    `).join('')}
                </div>
            ` : ''}

            <pre style="background:#f8f9fa; padding:12px; border-radius:8px; overflow-x:auto">
${suggestion.replace(/</g, '&lt;')}
            </pre>

            <button style="
                margin-top:12px; padding:8px 16px;
                background:#3f51b5; color:white;
                border:none; border-radius:4px;
                cursor:pointer
            " onclick="insertCompletion('${encodeURIComponent(suggestion)}')">
                插入代码
            </button>
        </div>
    `;

    appendMessage('assistant', completionHTML);
}


async function handleCodeCompletion() {
    try {
        // 移除残留的自动触发逻辑
        const code = getExistingCodeContent();
        const lang = detectProgrammingLanguage();

        // 添加空值校验
        if (!code && !confirm('检测到空代码，是否生成初始模板？')) return;

        // 显示明确的加载状态
        const loadingId = Date.now();
        const loadingMsg = appendMessage('assistant', `🔄 智能补全启动中 (ID: ${loadingId})...`, true);

        // 构建带防护机制的提示词
        const prompt = buildCompletionPrompt(
            code || 'python',
            lang || 'javascript'
        );

        // 添加请求超时处理
        const response = await Promise.race([
            new Promise(resolve =>
                chrome.runtime.sendMessage(
                    { action: "query_sparkai", query: prompt },
                    resolve
                )
            ),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('请求超时（超过30秒）')), 30000)
            )
        ]);

        // 移除旧的加载消息
        loadingMsg.remove();

        if (response?.success) {
            const completion = extractCodeFromResponse(response.response);
            if (!completion) throw new Error('未提取到有效代码');

            showSimpleCompletion(completion);
        } else {
            throw new Error(response?.error || 'API返回异常');
        }
    } catch (e) {
        console.error('完整错误日志:', {
            error: e,
            stack: e.stack,
            lastCode: lastCompletionCode,
            editorState: detectEditor()?.getValue()
        });
        appendMessage('assistant', `❌ 补全失败: ${e.message}`);
    }
}
function getCodeContent() {
    // 兼容多种编辑器格式
    const editors = [
        () => document.querySelector('.monaco-editor textarea')?.value, // VS Code风格
        () => document.querySelector('.CodeMirror')?.CodeMirror?.getValue(), // CodeMirror
        () => document.querySelector('textarea[name="code"]')?.value // 原生文本框
    ];

    for (const editorFn of editors) {
        const code = editorFn();
        if (code) return code;
    }
    return '';
}

function getProblemDescription() {
    // 同时兼容题目页和提交页
    const selectors = [
        'div.flex-1.p-6',      // 题目描述页
        'div.overflow-auto.p-4',// 提交页题目描述
        'div[data-cy="question-title"]' // 备用选择器
    ];

    for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) {
            // 清理无用元素
            Array.from(element.querySelectorAll('button, .btn, .action')).forEach(e => e.remove());
            return element.innerText
                .replace(/\n+/g, '\n')
                .replace(/[\s\uFEFF\xA0]+/g, ' ')
                .trim();
        }
    }
    return '';
}

async function generateCompletionSuggestion(code, analysis) {
    // 构建上下文提示
    const promptParts = [];

    if (analysis.missingFunctions.length > 0) {
        promptParts.push(`需要实现以下函数：${
            analysis.missingFunctions.map(f => `${f.name} - ${f.desc}`).join('\n')
        }`);
    }

    if (analysis.incompleteIO.length > 0) {
        promptParts.push(`需要完善：${
            analysis.incompleteIO[0].missing.join('和')
        }逻辑`);
    }

    if (analysis.unmetConstraints.length > 0) {
        promptParts.push(`需要满足约束条件：${
            analysis.unmetConstraints.join(', ')
        }`);
    }

    const fullPrompt = `你是一个专业算法竞赛助手，请根据以下需求补全代码：
题目要求：
${JSON.stringify(analysis.missingParts, null, 2)}

当前代码：
\`\`\`javascript
${code}
\`\`\`

请：
1. 保持原有代码结构
2. 只补全缺失部分
3. 添加中文注释
4. 确保符合输入输出格式要求`;

    // 调用API获取补全
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
            { action: "query_sparkai", query: fullPrompt },
            response => resolve(response.success ? response.response : '补全失败')
        );
    });
}
function insertCompletion(encodedCode) {
    const code = decodeURIComponent(encodedCode);

    // 统一处理Monaco编辑器
    const monacoEditor = document.querySelector('.monaco-editor');
    if (monacoEditor) {
        // 获取Monaco编辑器实例
        const editor = monacoEditor.editor;
        if (editor && editor.getModel) {
            // 使用Monaco API设置内容
            editor.setValue(code);
            // 修复滚动位置
            editor.revealPositionInCenterIfOutsideViewport(
                editor.getPosition(),
                monaco.editor.ScrollType.Smooth
            );
            return;
        }
    }

    // 原有CodeMirror处理
    const cm = document.querySelector('.CodeMirror')?.CodeMirror;
    if (cm) {
        cm.setValue(code);
        return;
    }

    // 原生文本域处理
    const textarea = document.querySelector('textarea[name="code"]');
    if (textarea) {
        textarea.value = code;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        return;
    }

    appendMessage('assistant', '❌ 无法识别当前代码编辑器类型');
}
let cachedContent = null;

function getPageContent() {
    // 提交页面优先获取代码区的题目信息
    if (isSubmitPage()) {
        const submitDesc = document.querySelector('div.flex.flex-col div.flex-1');
        if (submitDesc) return submitDesc.innerText;
    }

    // 题目描述页面
    const problemDesc = document.querySelector('div.flex-1.p-6');
    return problemDesc?.innerText || document.body.innerText;
}
function showAnalysisResult(text, type) {
    const resultBox = document.createElement('div');
    Object.assign(resultBox.style, {
        background: type === 'code' ? '#f8f9fa' : '#fff3e0',
        padding: '16px',
        borderRadius: '8px',
        margin: '12px 0',
        whiteSpace: 'pre-wrap'
    });

    // 代码高亮处理
    if (type === 'code') {
        const highlighted = hljs.highlightAuto(text).value;
        resultBox.innerHTML = `<pre><code>${highlighted}</code></pre>`;
    } else {
        // 文本结构化
        const structuredText = text
            .replace(/(\d+\.)/g, '<br><strong>$1</strong>')
            .replace(/建议:/g, '<span style="color:#3f51b5">建议：</span>');
        resultBox.innerHTML = structuredText;
    }

    // 操作按钮
    const btnGroup = document.createElement('div');
    btnGroup.style.marginTop = '12px';

    const copyBtn = createActionButton('复制内容', '#4CAF50', () => {
        navigator.clipboard.writeText(text);
    });

    const refineBtn = createActionButton('优化表达', '#3f51b5', () => {
        querySparkAPI(`请优化以下内容：\n${text.slice(0, 3000)}`,true);
    });

    btnGroup.append(copyBtn, refineBtn);
    resultBox.appendChild(btnGroup);

    appendMessage('assistant', resultBox);
}
// 错误处理组件
function showAnalysisError(error, moduleName) {
    const errorHTML = `
        <div class="error-alert">
            <div class="error-header">⚠️ ${moduleName} 操作异常</div>
            <div class="error-detail">
                <p>错误类型：${error.name}</p>
                <p>错误信息：${error.message}</p>
                <p>建议操作：</p>
                <ul>
                    <li>检查输入内容格式</li>
                    <li>确认网络连接正常</li>
                    <li>尝试重新操作</li>
                </ul>
            </div>
            <button onclick="this.parentElement.remove()">关闭提示</button>
        </div>
    `;
    appendMessage('assistant', errorHTML);
}
function createActionButton(text, color, onClick) {
    const btn = document.createElement('button');
    Object.assign(btn.style, {
        padding: '6px 12px',
        marginRight: '8px',
        background: color,
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer'
    });
    btn.textContent = text;
    btn.addEventListener('click', onClick);
    return btn;
}
function detectProgrammingLanguage() {
    const langSelect = document.querySelector('select[name="language"]');
    if (langSelect) {
        return langSelect.value; // 直接返回选项值
    }return  'python';

}

function generateCodeTemplate(lang) {
    const templates = {
        cpp: `#include <iostream>
using namespace std;

int main() {
    // 在此编写核心代码逻辑
    
    return 0;
}`,

        c: `#include <stdio.h>

int main() {
    // 实现题目要求的输入输出处理
    
    return 0;
}`,

        python: `

if __name__ == "__main__":
    // 在此编写核心代码逻辑`,

        java: `public class Main {
    public static void main(String[] args) {
        System.out.println("请实现算法逻辑");
    }
}`
    };

    return templates[lang] || templates.py; // 默认返回py模板
}
function extractCodeFromResponse(text) {
    // 优先匹配带语言标识的代码块
    const codeBlockRegex = /```(?:javascript|python|java|cpp|python3)\n([\s\S]*?)```/;
    const match = text.match(codeBlockRegex);
    if (match) return match[1];

    // 匹配无语言标识的代码块
    const fallbackRegex = /```\n?([\s\S]*?)```/;
    const fallbackMatch = text.match(fallbackRegex);
    return fallbackMatch ? fallbackMatch[1] : text;
}

// 辅助函数：格式化代码显示
function formatCodeDisplay(code, lang) {
    // 清理多余空行
    const cleanedCode = code.replace(/\n{3,}/g, '\n\n');

    return `
        <div style="border:1px solid #3f51b5; border-radius:8px; padding:12px; margin:8px 0">
            <pre style="background:#f8f9fa; padding:12px; border-radius:8px; overflow-x:auto">
${cleanedCode.replace(/</g, '&lt;')}
            </pre>
        </div>
    `;
}

// 复制代码处理函数
function handleCopyCode(button) {
    const codeElement = button.closest('.code-container').querySelector('code');
    const code = codeElement.textContent;

    navigator.clipboard.writeText(code).then(() => {
        const originalText = button.textContent;
        button.textContent = '✓ 已复制';
        button.style.background = '#4CAF50';

        setTimeout(() => {
            button.textContent = originalText;
            button.style.background = '#3f51b5';
        }, 2000);
    }).catch(err => {
        console.error('复制失败:', err);
        button.textContent = '❌ 复制失败';
        button.style.background = '#ff4444';
    });
}
// 插入函数
function insertCode(content) {
    try {
        // 优先Monaco编辑器
        const monaco = document.querySelector('.monaco-editor textarea');
        if (monaco) {
            monaco.value = content;
            monaco.dispatchEvent(new Event('input', { bubbles: true }));
            return;
        }

        // CodeMirror编辑器
        const cm = document.querySelector('.CodeMirror')?.CodeMirror;
        if (cm) {
            cm.setValue(content);
            return;
        }

        // 原生文本域
        const textarea = document.querySelector('textarea[name="code"]');
        if (textarea) {
            textarea.value = content;
            return;
        }

        throw new Error('未找到支持的编辑器');
    } catch (e) {
        appendMessage('assistant', `❌ 插入失败: ${e.message}`);
    }
}
let smartMenu = null;
// 初始化智能菜单
function initSmartMenu() {
    if (smartMenu && document.body.contains(smartMenu)) return;

    smartMenu = document.createElement('div');
    smartMenu.id = 'smart-menu';
    Object.assign(smartMenu.style, {
        position: 'absolute',
        bottom: '140px',
        right: '20px',
        background: '#fff',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        padding: '8px',
        display: 'none',
        flexDirection: 'column',
        gap: '4px',
        zIndex: '2147483648',
        width: '200px',
        animation: 'fadeIn 0.2s ease-out'
    });

    // 菜单项配置
    const buttons = [
        createFuncBtn('♻代码重构', () => handlesmartFunction('refactor')),
        createFuncBtn('🧪测试用例', () => handlesmartFunction('testcase')),
        createFuncBtn('⚠ 安全检测', () => handlesmartFunction('health')),
        createFuncBtn('💾保存代码', saveCodeToMemory),
        createFuncBtn('📚代码记忆库', showCodeHistory)

    ];

    buttons.forEach(btn => smartMenu.appendChild(btn));
    document.body.appendChild(smartMenu);
}
function toggleSmartMenu(e) {
    try {
        initSmartMenu();
        const isVisible = smartMenu.style.display === 'flex';

        // 关闭其他菜单
        const funcMenu = document.getElementById('func-menu');
        if (funcMenu) funcMenu.style.display = 'none';
        smartMenu.style.display = isVisible ? 'none' : 'flex';
        e.stopPropagation();
    } catch (error) {
        console.error('智能菜单操作失败:', error);
    }
}


// 全局点击监听
document.addEventListener('click', (e) => {
    const smartMenu = document.getElementById('smart-menu');
    if (smartMenu && !smartMenu.contains(e.target)) {
        smartMenu.style.display = 'none';
    }
});
function handleImageAnalysis() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        const formData = new FormData();
        formData.append('file', file);

        const result = await fetch('/analyze_image', {
            method: 'POST',
            body: formData
        }).then(res => res.json());

        showImageAnalysisResult(result);
    };
    input.click();
}
// 增强图片分析功能
async function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        const imgPreview = document.createElement('div');
        imgPreview.innerHTML = `
            <div style="
                border: 2px dashed #3f51b5;
                border-radius: 8px;
                padding: 8px;
                margin: 8px 0;
                text-align: center;
            ">
                <img src="${e.target.result}" style="max-width: 100%; max-height: 200px;">
                <div style="color: #666; margin-top: 8px;">分析中...</div>
            </div>
        `;
        appendMessage('assistant', imgPreview);

        try {
            // 使用Tesseract.js进行OCR识别
            const { createWorker } = Tesseract;
            const worker = await createWorker();

            await worker.loadLanguage('eng+chi_sim');
            await worker.initialize('eng+chi_sim');

            const { data: { text } } = await worker.recognize(file);

            // 结构化分析结果
            const analysisResult = await analyzeImageContent(text);

            // 展示分析结果
            showImageAnalysisResult(analysisResult, e.target.result);

            await worker.terminate();

        } catch (error) {
            appendMessage('assistant', `❌ 分析失败: ${error.message}`);
        }
    };
    reader.readAsDataURL(file);
}

async function analyzeImageContent(text) {
    // 调用AI进行内容分析
    const prompt = `请分析以下从图片中识别出的内容：
"""
${text.slice(0, 3000)}
"""

请按以下格式返回：
1. 主要内容概括（20字以内）
2. 关键信息提取（列表形式）
3. 内容分类（代码/文本/图表等）
4. 可执行操作建议`;

    const response = await fetchSparkAI(prompt);
    return response;
}// 展示图片分析结果
function showImageAnalysisResult(data) {
    const resultBox = document.createElement('div');
    resultBox.innerHTML = `
        <div class="image-analysis">
            <h4>${data.filename} 分析结果</h4>
            <img src="${URL.createObjectURL(data.file)}" style="max-width: 200px;">
            <div class="detail">
                <p>类型：${data.type}</p>
                <p>建议布局：${data.layout_suggestion}</p>
                <pre>${data.code_snippets}</pre>
            </div>
        </div>
    `;
    appendMessage('assistant', resultBox);
}
// 样式增强
const enhancedStyles = `
    .smart-btn {
        padding: 12px;
        border: none;
        border-radius: 8px;
        background: #f8f9fa;
        color: #3f51b5;
        cursor: pointer;
        transition: all 0.2s;
        text-align: left;
        display: flex;
        align-items: center;
        gap: 8px;
        &:hover {
            background: #e8eaf6;
            transform: translateX(4px);
        }
    }
    
    .loader {
        border: 3px solid #f3f3f3;
        border-top: 3px solid #3f51b5;
        border-radius: 50%;
        width: 24px;
        height: 24px;
        animation: spin 1s linear infinite;
    }
    
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
`;




async function handleComplexityAnalysis() {
    const code = getLatestUserMessage();
    if (!code) {
        appendMessage('assistant', '❌ 请在输入框中输入要分析的代码');
        return;
    }

    const prompt = `分析以下代码复杂度：
\`\`\`
${code.slice(0, 2000)}
\`\`\`
需包含：
1. 时间复杂度（最坏/平均）
2. 空间复杂度
3. 循环/递归深度分析
4. 优化建议及复杂度对比
5. 结果用大O符号表示`;

    querySparkApi(prompt,true);
}

function getInputContent() {
    const textarea = document.querySelector('#ai-dialog textarea');
    return textarea?.value.trim() || '';
}

function validateInput(content, minLength = 2) {
    if (!content) {
        appendMessage('assistant', '❌ 输入内容不能为空');
        return false;
    }
    if (content.length < minLength) {
        appendMessage('assistant', `❌ 输入内容至少需要${minLength}个字符`);
        return false;
    }
    return true;
}



function getInputCode() {
    const textarea = document.querySelector('#ai-dialog textarea');
    if (!textarea) return null;

    // 增强型代码提取逻辑
    const text = textarea.value.trim();

    // 自动识别代码块（优先级1）
    const codeBlock = text.match(/```(?:\w+)?\n([\s\S]+?)\n```/);
    if (codeBlock) return codeBlock[1];

    // 智能识别代码特征（优先级2）
    const codeLikeContent = text.split('\n')
        .filter(line => line.match(/^\s*(function|def|class|for|if|console\.|public|void)/))
        .join('\n');

    return codeLikeContent || text;
}
// 代码对比展示组件
function showCodeComparison(newCode, oldCode) {
    const diff = Diff.createPatch('code', oldCode, newCode);
    const highlighted = hljs.highlight('diff', diff).value;

    appendMessage('assistant', `
        <div class="code-diff">
            <h4>♻️ 重构建议</h4>
            <pre><code>${highlighted}</code></pre>
            <button onclick="applyCodePatch('${btoa(newCode)}')">应用重构</button>
        </div>
    `);
}
function showStructuredResult(content, title) {
    const resultBox = document.createElement('div');
    resultBox.innerHTML = `
        <div style="border:2px solid #3f51b5; border-radius:12px; margin:16px 0">
            <div style="background:#3f51b5; color:white; padding:12px; border-radius:10px 10px 0 0">
                <h3 style="margin:0">${title}</h3>
            </div>
            <div style="padding:16px; background:#f8f9fa">
                ${marked.parse(content)} <!-- 使用Markdown解析 -->
            </div>
            <div style="padding:12px; border-top:1px solid #ddd; display:flex; gap:8px">
                <button onclick="exportAsMD(this)" style="flex:1">导出Markdown</button>
                <button onclick="createDiscussion(this)" style="flex:1">发起讨论</button>
            </div>
        </div>
    `;
    appendMessage('assistant', resultBox);
}


// ======================== 设置菜单实现 ========================
let settingsMenu = null;

function initSettingsMenu() {
    if (settingsMenu && document.body.contains(settingsMenu)) return;

    settingsMenu = document.createElement('div');
    settingsMenu.id = 'settings-menu';
    Object.assign(settingsMenu.style, {
        position: 'fixed',
        top: '50%',
        right: '20px',
        transform: 'translateY(-50%)',
        zIndex: '999999999',
        width: '380px',
        height: '600px',
        backgroundColor: '#fff',
        borderRadius: '16px',
        padding: '24px 16px',
        boxShadow: '0 12px 24px rgba(0,0,0,0.2)',
        overflowY: 'auto',
        display: 'none',
        flexDirection: 'column',
        fontFamily: 'system-ui, -apple-system, sans-serif'
    });

    // 关闭按钮（右上角独立显示）
    const closeBtn = document.createElement('button');
    Object.assign(closeBtn.style, {
        position: 'absolute',
        top: '8px',
        right: '8px',
        background: 'none',
        border: 'none',
        fontSize: '24px',
        color: '#666',
        cursor: 'pointer',
        padding: '0'
    });
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', () => settingsMenu.style.display = 'none');

    // 设置内容容器（保留所有原有功能）
    const content = document.createElement('div');
    content.innerHTML = `
        <div style="margin-bottom:24px">
            <!-- 主题颜色设置 -->
            <div style="margin:16px 0">
                <div style="font-weight:500; color:#666; margin-bottom:8px">主题颜色</div>
                <div style="display:flex; gap:8px;">
                    <div class="color-option" data-color="#3f51b5" style="width:32px; height:32px; border-radius:8px; background:#3f51b5; cursor:pointer;"></div>
                    <div class="color-option" data-color="#4CAF50" style="width:32px; height:32px; border-radius:8px; background:#4CAF50; cursor:pointer;"></div>
                    <div class="color-option" data-color="#FF9800" style="width:32px; height:32px; border-radius:8px; background:#FF9800; cursor:pointer;"></div>
                </div>
            </div>

            <!-- 自动补全设置 -->
            <div style="margin:16px 0">
                <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
                    <input type="checkbox" id="auto-complete">
                    <span>自动代码补全</span>
                </label>
            </div>

            <!-- 响应模式 -->
            <div style="margin:16px 0">
                <label style="display:block; margin-bottom:8px; color:#666">响应模式</label>
                <select id="response-mode" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px;">
                    <option value="professional">专业模式</option>
                    <option value="beginner">新手指导</option>
                    <option value="humor">幽默风格</option>
                </select>
            </div>

            <!-- 学习教练设置 -->
            <div style="margin:16px 0">
                <h4 style="color:#3f51b5; margin:16px 0">学习教练</h4>
                <label style="display:block; margin:8px 0">
                    <input type="checkbox" id="learning-coach"> 启用学习模式优化
                </label>
                <label style="display:block; margin:8px 0">
                </label>
            </div>
            <div style="margin:16px 0">
            <h4 style="color:#3f51b5; margin:16px 0">👁️ 健康设置</h4>
            <label style="display:block; margin:8px 0">
                <input type="checkbox" id="eyeProtection" checked>
                启用护眼提醒
            </label>
            <div style="margin-left:24px">
                <label>提醒间隔（分钟）：
                    <input type="number" id="eyeProtectionInterval" 
                        min="1" max="60" value="20" style="width:60px">
                </label>
            </div>
        </div>

            <!-- 联网搜索设置 -->
            <div style="margin:24px 0">
                <h4 style="color:#3f51b5; margin:16px 0">联网搜索设置</h4>
                <div style="margin:12px 0">
                <label style="display:block; margin:8px 0">
                    <input type="checkbox" id="onlinesearch">
                    联网搜索开启（网上搜索结果)
                </label>
                    <label style="display:block; margin-bottom:8px; color:#666">搜索引擎</label>
                    <select id="search-engine" style="width:100%; padding:8px; border:1px solid #ddd;">
                        <option value="google">Google</option>
                        
                    </select>
                </div>
                <div style="margin:12px 0">
                    <label style="display:block; margin-bottom:8px; color:#666">最大结果数</label>
                    <input type="number" id="max-results" min="3" max="10" value="5" style="width:100%; padding:8px; border:1px solid #ddd;">
                </div>
            </div>
        </div>
        <div style="margin:16px 0">
                <h4 style="color:#3f51b5; margin:16px 0">高级功能</h4>
                <label style="display:block; margin:8px 0">
                    <input type="checkbox" id="deep-thinking">
                    深度思考模式（增强分析能力）
                </label>
                <div style="color:#666; font-size:0.9em; margin-left:24px;">
                    启用后将提供更详细的分析步骤和优化建议，响应时间可能稍长
                </div>
            </div>
            <div style="margin:16px 0">
        <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
            <input type="checkbox" id="enable-chat" checked>
            <span>启用聊天对话</span>
        </label>
        <div style="color:#666; font-size:0.9em; margin-left:24px;">
            关闭后将只执行工具操作，不进行AI对话
        </div>
    </div>
    `;

    // 保存按钮
    const saveBtn = document.createElement('button');
    Object.assign(saveBtn.style, {
        width: '100%',
        padding: '12px',
        background: '#3f51b5',
        color: 'white',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        marginTop: '16px'
    });
    saveBtn.textContent = '保存设置';
    saveBtn.addEventListener('click', saveSettings);

    // 组装元素
    settingsMenu.appendChild(closeBtn);
    settingsMenu.appendChild(content);
    settingsMenu.appendChild(saveBtn);
    document.body.appendChild(settingsMenu);

    // 颜色选择事件
    settingsMenu.addEventListener('click', function(event) {
        const option = event.target.closest('.color-option');
        if (option) {
            document.documentElement.style.setProperty('--primary-color', option.dataset.color);
            settingsMenu.querySelectorAll('.color-option').forEach(opt =>
                opt.style.border = '2px solid transparent'
            );
            option.style.border = '2px solid #666';
        }
    });
    const helpSection = document.createElement('div');
    helpSection.innerHTML = `
        <div style="margin:24px 0">
            <h4 style="color:#3f51b5">帮助与支持</h4>
            <button id="open-help" style="width:100%; padding:12px; background:#e3f2fd; color:#1565c0">
                📖 打开完整帮助文档
            </button>
        </div>
    `;
    settingsMenu.appendChild(helpSection);

    // 绑定点击事件
    document.getElementById('open-help').addEventListener('click', () => {
        settingsMenu.style.display = 'none';
        showHelpDocument(true);
    });

    loadSettings();  // 加载已有设置
}

// ======================== 设置存储功能 ========================
function saveSettings() {
    const getSafeElement = id => document.getElementById(id) || { value: null, checked: false };

    const settings = {
        onlinesearch:getSafeElement('onlinesearch').checked,
        themeColor: getComputedStyle(document.documentElement).getPropertyValue('--primary-color').trim(),
        autoComplete: getSafeElement('auto-complete').checked,
        responseMode: getSafeElement('response-mode').value,
        enableChat: getSafeElement('enable-chat').checked,
        learningCoach: getSafeElement('learning-coach').checked,
        reminderInterval: parseInt(getSafeElement('reminder-interval').value || 60),
        deepThinking: getSafeElement('deep-thinking').checked,
        maxResults: parseInt(getSafeElement('max-results').value || 5)
    };

    localStorage.setItem('userSettings', JSON.stringify(settings));
    // 新增关闭逻辑
    const settingsMenu = document.getElementById('settings-menu');
    if (settingsMenu) settingsMenu.style.display = 'none';
    document.getElementById('ai-dialog').style.display = 'flex';
    appendMessage('assistant', '✅ 设置已保存', true);
}

function loadSettings() {
    const saved = JSON.parse(localStorage.getItem('userSettings')) || {};

    // 主题颜色
    if(saved.themeColor) {
        document.documentElement.style.setProperty('--primary-color', saved.themeColor);
        settingsMenu.querySelectorAll('.color-option').forEach(opt => {
            if(opt.dataset.color === saved.themeColor) {
                opt.style.border = '2px solid #666';
            }
        });
    }

    // 安全设置各表单项
    const setValue = (id, value) => {
        const el = document.getElementById(id);
        if(el) el.value = value;
    };

    const setChecked = (id, checked) => {
        const el = document.getElementById(id);
        if(el) el.checked = checked;
    };

    setChecked('auto-complete', saved.autoComplete || false);
    setValue('response-mode', saved.responseMode || 'professional');
    setChecked('learning-coach', saved.learningCoach || false);
    setValue('reminder-interval', saved.reminderInterval || 60);
    setValue('search-engine', saved.searchEngine || 'google');
    setValue('max-results', saved.maxResults || 5);
    setChecked('enable-chat', saved.enableChat !== false);
    setChecked('deep-thinking', saved.deepThinking || false);
}

function applySettings(settings) {
    // 应用主题色
    document.documentElement.style.setProperty('--primary-color', settings.themeColor || '#3f51b5');

    // 应用消息样式
    const assistantBubbles = document.querySelectorAll('[data-role="assistant"]');
    assistantBubbles.forEach(bubble => {
        bubble.style.background = settings.themeColor || '#3f51b5';
        bubble.style.color = isDarkColor(settings.themeColor) ? '#fff' : '#333';
    });

    // 全局配置
    window.assistantConfig = {
        style: settings.style || 'professional',
        autoComplete: settings.autoComplete || false
    };
    if (settings.deepThinking) {
        const style = document.createElement('style');
        style.textContent = `
            [data-deep-thinking] {
                border-left: 3px solid #3f51b5;
                padding-left: 12px;
                margin: 16px 0;
                background: #f8f9fa;
            }
        `;
        document.head.appendChild(style);
    }
}

function isDarkColor(hex) {
    const r = parseInt(hex.substr(1,2),16);
    const g = parseInt(hex.substr(3,2),16);
    const b = parseInt(hex.substr(5,2),16);
    return (r*0.299 + g*0.587 + b*0.114) < 186;
}
// ======================== 菜单切换函数 ========================
function toggleSettingsMenu(e) {
    try {
        initSettingsMenu();
        // 强制显示设置菜单并关闭其他菜单
        document.querySelectorAll('#func-menu, #smart-menu, #platform-menu')
            .forEach(menu => menu.style.display = 'none');
        settingsMenu.style.display = 'block'; // 直接设置为显示
        if (e) e.stopPropagation();
    } catch (error) {
        console.error('设置菜单操作失败:', error);
    }
}


// ======================== 全局样式补充 ========================
const settingsStyle = document.createElement('style');
settingsStyle.textContent = `
    :root {
        --primary-color: #3f51b5;
    }

    [data-role="user"] {
        background: var(--primary-color) !important;
    }

    select:focus, input:focus {
        outline: 2px solid var(--primary-color);
    }

    button:hover {
        filter: brightness(0.9);
    }

    /* +++ 新增联网搜索样式 +++ */
    .settings-section h4 {
        font-size: 14px;
        margin: 16px 0 8px;
        padding-bottom: 4px;
        border-bottom: 1px solid #eee;
    }

    .setting-item {
        margin: 12px 0;
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .setting-item label {
        flex: 0 0 80px;
        font-size: 13px;
        color: #666;
    }
`;
document.head.appendChild(settingsStyle);

// ====================== 样式补充 ====================== //
const smartMenuStyle = document.createElement('style');
smartMenuStyle.textContent = `
    .test-case-box {
        border: 1px solid #3f51b5;
        border-radius: 8px;
        padding: 16px;
        margin: 12px 0;
        background: #f8f9fa;
    }
    .test-case-box table {
        width: 100%;
        margin: 12px 0;
        border-collapse: collapse;
    }
    .test-case-box td {
        padding: 8px;
        border: 1px solid #ddd;
    }
    .test-case-box button {
        background: #3f51b5;
        color: white;
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
    }
`;
document.head.appendChild(smartMenuStyle);
function showCodeAnalysisResult(issues) {
    const result = issues.length > 0 ?
        `🔍 代码气味检测结果：\n• ${issues.join('\n• ')}` :
        '✅ 代码结构良好！';

    appendMessage('assistant', result);
}

// =============== 新增函数结束 ===============
const addedStyles = `
  [id^="settings-menu"] h4 {
    font-size: 14px;
    padding-bottom: 4px;
    border-bottom: 2px solid var(--primary-color);
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .smell-result {
    border-left: 3px solid #ff9800;
    padding: 8px;
    margin: 8px 0;
    background: #fff3e0;
  }
`;
document.head.appendChild(document.createElement('style')).textContent = addedStyles;



function autoGenerateDescription(code) {
    const structures = parseCodeStructure(code);
    const keywords = {
        'function': '函数',
        'loop': '循环',
        'condition': '条件',
        'algorithm': detectAlgorithm(code) // 算法检测函数
    };

    // 生成自然语言描述
    return structures.slice(0,3)
        .map(s => keywords[s.type] || s.type)
        .concat(detectCodePurpose(code)) // 用途分析
        .join('+');
}

// ======================== 辅助函数 ========================
function extractCodeFromMessage(text) {
    const codeBlock = text.match(/```(?:\w+)?\n([\s\S]+?)\n```/);
    return codeBlock ? codeBlock[1] : text.match(/(?:function|class|def)\s+\w+/)?.[0];
}

function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash |= 0; // 转换为32位整数
    }
    return hash;
}

function showMemoryStatus(message) {
    const statusBox = document.createElement('div');
    statusBox.style = 'position:fixed; top:20px; right:20px; background:#fff; padding:12px; border-radius:8px; box-shadow:0 2px 8px rgba(0,0,0,0.1); z-index:999999;';
    statusBox.textContent = message;
    document.body.appendChild(statusBox);
    setTimeout(() => statusBox.remove(), 2000);
}
function loadFullCode(hash) {
    const code = codeMemory.find(c => c.hash === hash)?.code;
    if (code) {
        appendMessage('assistant',
            `📜 完整代码（哈希值：${hash}）
            \`\`\`\n${code}\n\`\`\`
            `
        );
    }
}
function showSearchResults(results) {
    const resultHTML = results.map(r => `
        <div style="border-bottom:1px solid #eee; padding:8px 0;">
            <a href="${r.link}" target="_blank" style="color:#3f51b5; text-decoration:none;">
                <div style="font-weight:500;">${r.title}</div>
                <div style="color:#666; font-size:0.9em;">${r.snippet}</div>
            </a>
        </div>
    `).join('');

    appendMessage('assistant', `
        <div style="margin:12px 0;">
            <div style="color:#666; font-size:0.9em; margin-bottom:8px;">🔍 联网搜索结果</div>
            ${resultHTML}
        </div>
    `);
}
async function handleWebSearch(query) {
    const API_KEY = 'AIzaSyB9H4i8lzX6Y6s7JjQbK6q3vQ1WZ6jYJZw'; // Google Custom Search API Key
    const CX = '012345678901234567890:abcdefghijk'; // 搜索引擎ID

    try {
        const url = `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(query)}&key=${API_KEY}&cx=${CX}`;

        const response = await fetch(url);
        const data = await response.json();

        return data.items.slice(0, 5).map(item => ({
            title: item.title,
            link: item.link,
            snippet: item.snippet
        }));
    } catch (error) {
        console.error('搜索失败:', error);
        return [{title: "搜索服务暂不可用", link: "#", snippet: ""}];
    }
}
function showSearchResults(results) {
    const resultHTML = results.map(r => `
        <div style="border-bottom:1px solid #eee; padding:8px 0;">
            <a href="${r.link}" target="_blank" style="color:#3f51b5; text-decoration:none;">
                <div style="font-weight:500;">${r.title}</div>
                <div style="color:#666; font-size:0.9em;">${r.snippet}</div>
            </a>
        </div>
    `).join('');

    appendMessage('assistant', `
        <div style="margin:12px 0;">
            <div style="color:#666; font-size:0.9em; margin-bottom:8px;">🔍 联网搜索结果</div>
            ${resultHTML}
        </div>
    `);
}
function formatDeepThinkingResponse(response) {
    return `🔍 深度分析结果：
${response}

▌ 分析步骤：
1. 问题拆解
2. 方案对比
3. 复杂度分析
4. 优化建议
5. 最佳实践

💡 总结：${extractSummary(response)}`;
}

function extractSummary(text) {
    const summaryRegex = /总结：(.+?)(?=\n|$)/;
    return text.match(summaryRegex)?.[1] || "已生成深度分析报告";
}


// 保存当前代码到记忆库
function saveCodeToMemory() {
    const message = getLatestUserMessage();
    if (!message) return;

    // 增强型代码提取和格式化
    const codeBlock = message.match(/```[\s\S]*?\n([\s\S]*?)```/);
    let code = codeBlock ? codeBlock[1] : message;

    // 添加格式化逻辑
    code = code
        .replace(/\t/g, '  ')         // 转换制表符为2空格
        .replace(/\r\n/g, '\n')       // 统一换行符
        .replace(/([{;}])\n?/g, '$1\n')// 在花括号和分号后强制换行
        .replace(/\n{3,}/g, '\n\n');  // 限制连续空行

    codeHistory.unshift({
        code: code,
        timestamp: new Date().toLocaleString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit'
        }),
        structure: parseCodeStructure(code) // 复用现有的代码结构解析
    });

    if (codeHistory.length > 20) codeHistory.pop(); // 最多保存20条
    localStorage.setItem('codeHistory', JSON.stringify(codeHistory));
    appendMessage('assistant', '✅ 代码已保存到记忆库', true);
}
function showCodeHistory() {
    const dialog = document.getElementById('ai-dialog');
    if (dialog) dialog.style.display = 'none';

    const existingHistory = document.getElementById('code-history-box');
    if (existingHistory) existingHistory.remove();

    const historyBox = document.createElement('div');
    historyBox.id = 'code-history-box';
    Object.assign(historyBox.style, {
        position: 'fixed',
        top: '50%',
        right: '20px',
        transform: 'translateY(-50%)',
        zIndex: '999999998',
        width: '480px',
        height: '600px',
        backgroundColor: '#fff',
        borderRadius: '16px',
        padding: '24px',
        boxShadow: '0 12px 24px rgba(0,0,0,0.2)',
        overflowY: 'auto'
    });

    // 标题部分
    const title = document.createElement('h3');
    Object.assign(title.style, {
        margin: '0 0 16px 0',
        fontSize: '18px',
        color: '#3f51b5',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
    });

    const titleText = document.createElement('span');
    titleText.textContent = `代码记忆库 (${codeHistory.length}/20)`;

    const closeBtn = document.createElement('button');
    Object.assign(closeBtn.style, {
        background: 'none',
        border: 'none',
        color: '#666',
        fontSize: '24px',
        cursor: 'pointer',
        padding: '0'
    });
    closeBtn.innerHTML = '&times;';
    closeBtn.addEventListener('click', () => {
        historyBox.remove();
        document.getElementById('ai-dialog').style.display = 'flex'; // 新增显示主界面
    });

    title.append(titleText, closeBtn);

    // 内容容器
    const content = document.createElement('div');
    if (codeHistory.length === 0) {
        const emptyMsg = document.createElement('div');
        emptyMsg.textContent = '暂无保存的代码片段';
        emptyMsg.style.textAlign = 'center';
        emptyMsg.style.color = '#666';
        emptyMsg.style.padding = '20px';
        content.appendChild(emptyMsg);
    } else {
        codeHistory.forEach((entry, index) => {
            const item = document.createElement('div');
            Object.assign(item.style, {
                padding: '16px',
                marginBottom: '12px',
                background: '#f8f9fa',
                borderRadius: '8px',
                position: 'relative'
            });

            // 代码预览
            const preview = document.createElement('pre');
            preview.className = 'code-history-pre';

            // 添加带缩进线的格式化显示
            const formattedCode = entry.code
                .split('\n')
                .map(line => `<span>${line.replace(/ /g, '·').replace(/\t/g, '→   ')}</span>`)
                .join('\n');

            preview.innerHTML = formattedCode;
            preview.textContent = entry.code.slice(0, 100) + (entry.code.length > 100 ? '...' : '');
            preview.style.margin = '8px 0';
            preview.style.color = '#666';
            preview.style.fontFamily = 'monospace';
            preview.style.fontSize = '14px';

            // 操作按钮
            const btnGroup = document.createElement('div');
            btnGroup.style.display = 'flex';
            btnGroup.style.gap = '8px';
            btnGroup.style.marginTop = '12px';

            // 查看按钮
            const viewBtn = document.createElement('button');
            Object.assign(viewBtn.style, {
                padding: '8px 16px',
                background: '#3f51b5',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer'
            });
            viewBtn.textContent = '查看完整代码';
            viewBtn.addEventListener('click', () => showCodeDetail(entry.code, index));

            // 删除按钮
            const deleteBtn = document.createElement('button');
            Object.assign(deleteBtn.style, {
                padding: '8px 16px',
                background: '#ff4444dd',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer'
            });
            deleteBtn.textContent = '删除';
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                codeHistory.splice(index, 1);
                localStorage.setItem('codeHistory', JSON.stringify(codeHistory));
                item.remove();
                titleText.textContent = `代码记忆库 (${codeHistory.length}/20)`;
            });

            btnGroup.append(viewBtn, deleteBtn);
            item.append(preview, btnGroup);
            content.appendChild(item);
        });
    }

    // 组装组件
    historyBox.append(title, content);
    document.body.appendChild(historyBox);
}

// 展示代码详情页面
function showCodeDetail(code, index) {
    const existingDetail = document.getElementById('code-detail-box');
    if (existingDetail) existingDetail.remove();

    const detailBox = document.createElement('div');
    detailBox.id = 'code-detail-box';
    Object.assign(detailBox.style, {
        position: 'fixed',
        top: '50%',
        right: '20px',
        transform: 'translateY(-50%)',
        zIndex: '999999999', // 更高层级
        width: '600px',
        height: '600px',
        backgroundColor: '#fff',
        borderRadius: '16px',
        padding: '24px',
        boxShadow: '0 12px 24px rgba(0,0,0,0.2)',
        overflowY: 'auto'
    });


    // 添加样式
    const lineStyle = document.createElement('style');
    lineStyle.textContent = `
        .code-line { display: flex; padding: 2px 0; }
        .line-number {
            width: 40px;
            color: #666;
            user-select: none;
            text-align: right;
            padding-right: 8px;
        }
        .line-content { flex: 1; }
    `;
    detailBox.appendChild(lineStyle);

    // 返回按钮
    const backBtn = document.createElement('button');
    Object.assign(backBtn.style, {
        padding: '8px 16px',
        background: '#3f51b5',
        color: 'white',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        marginBottom: '16px'
    });
    backBtn.textContent = '← 返回记忆库';
    backBtn.addEventListener('click', () => {
        detailBox.remove();
        showCodeHistory();
    });

    // 代码展示
    const codeContent = document.createElement('pre');
    Object.assign(codeContent.style, {
        background: '#f8f9fa',
        padding: '16px',
        borderRadius: '8px',
        overflowX: 'auto',
        whiteSpace: 'pre-wrap'
    });
    // 添加行号显示
    const lines = code.split('\n');
    const formatted = lines.map((line, i) =>
        `<div class="code-line">
            <span class="line-number">${i+1}</span>
            <span class="line-content">${line}</span>
        </div>`
    ).join('\n');

    codeContent.innerHTML = formatted;
    codeContent.textContent = code;

    // 操作按钮
    const actionGroup = document.createElement('div');
    actionGroup.style.display = 'flex';
    actionGroup.style.gap = '8px';
    actionGroup.style.marginTop = '16px';
    detailBox.append(backBtn, codeContent, actionGroup);
    document.body.appendChild(detailBox);
}

function showFullCode(code, index) {
    const contentArea = document.getElementById('ai-dialog-content');
    contentArea.innerHTML = `
        <div style="margin-bottom:16px;">
            <button onclick="showCodeHistory()" 
                style="background:#3f51b5; color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer">
                ← 返回记忆库
            </button>
        </div>
        <pre style="background:#f8f9fa; padding:16px; border-radius:8px; overflow-x:auto">
            <code>${code.replace(/</g, '&lt;')}</code>
        </pre>
        <div style="margin-top:16px">
            <button onclick="insertCompletion('${encodeURIComponent(code)}')" 
                style="background:#4CAF50; color:white; border:none; padding:8px 16px; border-radius:4px; cursor:pointer">
                插入编辑器
            </button>
            <button onclick="deleteCodeMemory(${index})" 
                style="background:#ff4444; color:white; border:none; padding:8px 16px; border-radius:4px; cursor:pointer; margin-left:8px">
                删除本条
            </button>
        </div>
    `;
}

function deleteCodeMemory(index) {
    codeHistory.splice(index, 1);
    localStorage.setItem('codeHistory', JSON.stringify(codeHistory));
    showCodeHistory(); // 刷新显示
}

function restoreOriginalContent() {
    const contentArea = document.getElementById('ai-dialog-content');
    contentArea.innerHTML = ''; // 实际应用中需要恢复原始内容
    // 这里可以添加逻辑恢复对话框的原始状态
}

// 加载记忆库代码
function loadCodeFromMemory(index) {
    const code = codeHistory[index]?.code;
    if (!code) return;

    // 复用现有的代码插入逻辑
    const bubble = appendMessage('assistant', `记忆代码（${codeHistory[index].timestamp}）：\n\`\`\`\n${code}\n\`\`\``);
    bubble.querySelector('pre').style.cursor = 'pointer';
    bubble.querySelector('pre').onclick = () => insertCode(code);
}

// 删除记忆项
function deleteCodeMemory(index) {
    codeHistory.splice(index, 1);
    localStorage.setItem('codeHistory', JSON.stringify(codeHistory));
    showCodeHistory(); // 刷新显示
}
let lastClipboardContent = null;

async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        lastClipboardContent = text;
        setupAutoPaste('.view-lines.monaco-mouse-cursor-text');
        return true;
    } catch (e) {
        console.error('剪贴板写入失败:', e);
        return false;
    }
}
function setupAutoPaste(targetSelector) {
    let pasteCooldown = false;
    const cooldownDuration = 1000;

    document.addEventListener('mouseover', async (e) => {
        const target = e.target.closest(targetSelector);
        if (!target || pasteCooldown || !lastCompletionCode) return;

        pasteCooldown = true;
        setTimeout(() => pasteCooldown = false, cooldownDuration);

        try {
            // 现代剪贴板API写入
            await navigator.clipboard.writeText(lastCompletionCode);

            // 获取编辑器焦点元素
            const editor = document.querySelector('.monaco-editor textarea');
            if (!editor) return;

            // 创建粘贴事件
            const pasteEvent = new ClipboardEvent('paste', {
                bubbles: true,
                clipboardData: new DataTransfer()
            });

            // 设置剪贴板数据
            pasteEvent.clipboardData.setData('text/plain', lastCompletionCode);

            // 执行粘贴流程
            editor.focus();
            editor.dispatchEvent(pasteEvent);

            // 清除状态
            lastCompletionCode ='';
        } catch (error) {
            console.error('自动粘贴失败:', error);
            // 降级处理：传统execCommand方式
            try {
                const editor = document.querySelector('.monaco-editor textarea');
                editor.focus();
                document.execCommand('paste');
            } catch (fallbackError) {
                console.error('降级粘贴失败:', fallbackError);
            }
        }
    });
}
// 护眼提醒功能
let eyeProtectionTimer = null;

function initEyeProtection(intervalMinutes = 20) {
    if (eyeProtectionTimer) clearInterval(eyeProtectionTimer);

    eyeProtectionTimer = setInterval(() => {
        showEyeProtectionReminder();
    }, intervalMinutes * 60 * 1000);
}

function showEyeProtectionReminder() {
    const reminder = document.createElement('div');
    reminder.innerHTML = `
        <div style="
            position: fixed;
            top: 20px;
            right: 20px;
            background: #fff3e0;
            padding: 16px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 999999999;
            animation: fadeIn 0.5s;
        ">
            <h3 style="margin:0 0 8px 0; color:#ff9800">👀 护眼提醒</h3>
            <p>您已连续使用 ${localStorage.getItem('eyeProtectionInterval') || 20} 分钟，建议：</p>
            <ul style="margin:8px 0; padding-left:16px">
                <li>眺望20英尺外物体20秒</li>
                <li>活动颈部与肩部</li>
                <li>调整屏幕亮度</li>
            </ul>
            <button onclick="this.parentElement.remove()" 
                style="padding:4px 12px; background:#ff9800; color:white; border:none; border-radius:4px">
                知道了
            </button>
        </div>
    `;
    document.body.appendChild(reminder);
}
function initEyeProtection() {
    // 从设置读取（修复数值转换）
    const settings = JSON.parse(localStorage.getItem('userSettings') || {});
    const minutes = parseInt(settings.eyeProtectionInterval) || 20;
    eyeProtectionInterval = minutes * 60 * 1000;

    // 清除旧定时器
    if (window.eyeTimer) clearInterval(window.eyeTimer);

    // 设置新定时器（立即触发一次）
    window.eyeTimer = setInterval(showEyeProtectionReminder, eyeProtectionInterval);
    showEyeProtectionReminder(); // 立即显示测试
}

function showEyeProtectionReminder() {
    const reminder = document.createElement('div');
    reminder.innerHTML = `
        <div style="
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: #fff3e0;
            padding: 12px;
            border-radius: 8px;
            box-shadow: 0 2px 6px rgba(0,0,0,0.2);
            z-index: 999999999;
            animation: fadeIn 0.5s;
        ">
            👀 已连续使用 ${parseInt(eyeProtectionInterval/60000)} 分钟，请休息眼睛！
        </div>
    `;
    document.body.appendChild(reminder);

    // 5秒后自动移除
    setTimeout(() => reminder.remove(), 5000);
}

// 初始化（在页面加载时调用）
initEyeProtection();

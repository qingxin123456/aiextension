Starfire AI Extension 是一款强大的浏览器扩展工具，旨在为用户提供了一个便捷的接口，使用户能够在浏览器中直接与 Starfire AI 模型进行交互。这个扩展特别适用于代码分析、调试、优化以及智能提示等编程相关任务，同时支持多种文件类型分析和智能交互。
功能特点
智能代码分析：自动检测代码意图，提供调试、优化、解释和实现建议。
文件分析：支持多种文件类型（如 .txt、.py、.java、.c、.docx、.pptx 等）的上传和分析。
历史记录：保存对话历史和代码记忆，方便用户回顾和继续之前的分析。
伪代码生成：从代码结构生成伪代码，并支持基于伪代码的进一步分析。
自动补全：智能代码补全功能，提高编程效率。
护眼提醒：定时提醒用户休息，保护视力健康。
多平台支持：兼容多种在线编程平台。
技术栈
前端：纯 JavaScript 实现，兼容主流浏览器。
后端：基于 Flask 构建 API 服务。
AI 模型：集成 Starfire AI 模型，提供智能分析和生成能力。
通信协议：使用 WebSocket 实现实时通信。
安装指南
安装扩展
打开浏览器，进入扩展程序管理页面。
启用“开发者模式”。
点击“加载已解压的扩展程序”，选择本项目的 extension 文件夹。
启动后端服务
确保你已安装 Python 和 Flask。在项目根目录下运行以下命令：
bash
复制
python app.py
服务默认运行在 http://localhost:5000。
使用方法
文件分析
点击扩展图标，打开 Starfire AI 界面。
点击“上传文件”按钮，选择要分析的文件。
等待分析结果返回，结果会在界面中显示。
代码分析与交互
在扩展界面的输入框中输入代码或技术问题。
点击“发送”按钮，AI 将根据输入内容提供分析和建议。
使用侧边栏的功能按钮（如“代码工具”、“智能分析”等）进行更深入的操作。
查看历史记录
点击“历史会话”按钮，查看之前的所有分析记录。
点击某条记录可以加载并继续之前的对话。
开发与配置
环境配置
Python 3.6+
Flask
Starfire AI 相关库
安装依赖：
bash
复制
pip install flask flask-cors starfire-ai
配置 Starfire AI
在 app.py 中配置你的 Starfire AI 凭证：
Python
复制
SPARKAI_APP_ID = '你的AppID'
SPARKAI_API_SECRET = '你的APISecret'
SPARKAI_API_KEY = '你的APIKey'
项目结构
复制
project-root/
├── extension/           # 浏览器扩展文件
│   ├── content.js       # 扩展逻辑脚本
│   ├── background.js    # 后台脚本
│   ├── manifest.json    # 扩展配置
│   └── icons/           # 扩展图标
├── app.py               # 后端服务
└── README.md            # 项目说明
在浏览器加载扩展处，文件路径选择到content.js文件路径加载，即可加载程序。manifest文件是权限文件，需要与content文件放在一起。background是后端启动文件，也需要与content文件一起。
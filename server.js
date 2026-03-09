const express = require('express');
const path = require('path');
const WebSocket = require('ws');
const app = express();
const PORT = 3000;

// 当前状态
let currentState = 'resting';
let lastUpdate = Date.now();

// 状态枚举
const validStatuses = ['commuting', 'arrival', 'working', 'resting'];

// 提供静态文件
app.use(express.static(__dirname));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 状态API - 获取当前状态
app.get('/api/state', (req, res) => {
    res.json({
        status: currentState,
        location: getLocationName(currentState),
        timestamp: lastUpdate,
        uptime: Date.now()
    });
});

// 状态API - 更新状态
app.post('/api/state', (req, res) => {
    const { status } = req.body;
    
    if (status && validStatuses.includes(status)) {
        currentState = status;
        lastUpdate = Date.now();
        console.log(`🦞 状态更新: ${status} (${getLocationName(currentState)}) - ${new Date().toLocaleTimeString()}`);
        
        // 广播给所有WebSocket客户端
        broadcastState();
        
        res.json({ 
            success: true, 
            status: currentState,
            location: getLocationName(currentState),
            timestamp: lastUpdate
        });
    } else {
        res.status(400).json({ 
            error: 'Invalid status', 
            validStatuses,
            message: 'Valid states: commuting, arrival, working, resting'
        });
    }
});

// 健康检查
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        current: currentState,
        location: getLocationName(currentState),
        uptime: process.uptime(),
        memory: process.memoryUsage()
    });
});

// 获取状态对应的中文名称
function getLocationName(status) {
    const locationMap = {
        'commuting': '公交站',
        'arrival': '公司大门',
        'working': '办公区',
        'resting': '摸鱼区'
    };
    return locationMap[status] || '未知位置';
}

// WebSocket支持
let wsClients = [];
const wss = new WebSocket.Server({ port: 3001 });

wss.on('connection', (ws) => {
    wsClients.push(ws);
    console.log('🔗 新客户端连接');
    
    // 发送当前状态
    ws.send(JSON.stringify({
        type: 'state',
        data: {
            status: currentState,
            location: getLocationName(currentState),
            timestamp: lastUpdate
        }
    }));
    
    ws.on('close', () => {
        wsClients = wsClients.filter(client => client !== ws);
        console.log('🔌 客户端断开');
    });
});

// 广播状态更新
function broadcastState() {
    const message = JSON.stringify({
        type: 'state',
        data: {
            status: currentState,
            location: getLocationName(currentState),
            timestamp: lastUpdate
        }
    });
    
    wsClients.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(message);
        }
    });
}

// 启动HTTP服务器
app.listen(PORT, () => {
    console.log(`
    🦞 小派像素UI服务器启动成功！
    
    ══════════════════════════════════
    
    📱 访问地址: http://localhost:${PORT}
    🌐 API地址:  http://localhost:${PORT}/api/state
    🔌 WebSocket:  ws://localhost:3001
    ❤️  健康检查:  http://localhost:${PORT}/health
    
    ────────────────────────────────────────
    
    状态控制示例:
    curl -X POST http://localhost:${PORT}/api/state \\
         -H "Content-Type: application/json" \\
         -d '{"status":"working"}'
    
    ══════════════════════════════════
    
    🎮 WebSocket实时推送已启用！
    💖 享受像素小龙虾的陪伴时光~
    `);
});

// 优雅退出
process.on('SIGINT', () => {
    console.log('\n\n👋 服务器正在关闭...');
    wss.close();
    process.exit(0);
});
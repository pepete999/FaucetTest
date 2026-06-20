// server.js - Versión Revolucionaria MEJORADA
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const crypto = require('crypto');
const path = require('path'); // <--- NUEVO: Para manejar rutas

const app = express();

// ========== MIDDLEWARE ==========
app.use(cors());
app.use(express.json());

// 🔥 NUEVO: Servir archivos estáticos (HTML, CSS, JS)
app.use(express.static('public'));

// 🔥 NUEVO: Ruta raíz que sirve index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 🔥 NUEVO: Ruta de prueba para verificar que el servidor funciona
app.get('/ping', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: Date.now(),
        message: '🚀 Servidor funcionando correctamente',
        endpoints: [
            'POST /register',
            'POST /action', 
            'GET /stats/:publicKey',
            'POST /withdraw',
            'GET /transactions/:publicKey',
            'POST /referral',
            'GET /ping'
        ]
    });
});

// ========== CONFIGURACIÓN MATEMÁTICA ==========
const CONFIG = {
    // Múltiples faucets para maximizar rendimiento
    FAUCETS: [
        { name: 'FaucetPay', api: 'https://faucetpay.io/api/v1', weight: 1.2 },
        { name: 'Cointiply', api: 'https://api.cointiply.com', weight: 1.0 },
        { name: 'FreeBitcoin', api: 'https://freebitco.in/api', weight: 0.8 },
        { name: 'BonusBitcoin', api: 'https://bonusbitcoin.co/api', weight: 0.9 },
        { name: 'ADBTC', api: 'https://adbtc.top/api', weight: 1.1 }
    ],
    
    // Multiplicadores por acción (basados en engagement)
    MULTIPLIERS: {
        photo_upload: 1.5,
        photo_download: 0.3,
        review: 0.7,
        share: 0.4,
        daily_bonus: 2.0
    },
    
    // Umbrales de rendimiento
    THRESHOLDS: {
        min_withdraw: 1.0,
        max_daily: 50.0,
        optimal_session: 25,
        decay_factor: 0.98
    }
};

// ========== BASE DE DATOS AVANZADA ==========
class Database {
    constructor() {
        this.dbFile = 'data.json';
        if (!fs.existsSync(this.dbFile)) {
            fs.writeFileSync(this.dbFile, JSON.stringify({
                users: {},
                transactions: [],
                stats: { totalPaid: 0, totalUsers: 0 }
            }));
        }
    }
    
    getUser(publicKey) {
        const db = this.getDB();
        if (!db.users[publicKey]) {
            db.users[publicKey] = {
                balance: 0,
                lifetimeEarnings: 0,
                totalPhotos: 0,
                totalDownloads: 0,
                totalReviews: 0,
                lastActivity: Date.now(),
                streak: 0,
                performance: 1.0,
                faucetCredits: {}
            };
            db.stats.totalUsers++;
            this.saveDB(db);
        }
        return db.users[publicKey];
    }
    
    updateUser(publicKey, data) {
        const db = this.getDB();
        db.users[publicKey] = { ...db.users[publicKey], ...data };
        this.saveDB(db);
    }
    
    getDB() {
        return JSON.parse(fs.readFileSync(this.dbFile));
    }
    
    saveDB(data) {
        fs.writeFileSync(this.dbFile, JSON.stringify(data, null, 2));
    }
    
    addTransaction(publicKey, amount, type, description) {
        const db = this.getDB();
        db.transactions.push({
            publicKey,
            amount,
            type,
            description,
            timestamp: Date.now()
        });
        this.saveDB(db);
    }
}

const db = new Database();

// ========== ALGORITMO PNL OPTIMIZADO ==========
class PNLOptimizer {
    static calculateOptimalPerformance(user) {
        const baseRate = 0.005;
        
        const engagementFactor = Math.min(
            (user.totalPhotos + user.totalReviews) / 100, 
            3.0
        );
        
        const streakFactor = 1 + (user.streak * 0.05);
        const timeFactor = this.getTimeBonus();
        const faucetEfficiency = this.calculateFaucetEfficiency(user);
        
        const performance = baseRate * 
                           engagementFactor * 
                           streakFactor * 
                           timeFactor * 
                           faucetEfficiency;
        
        return Math.min(performance, 0.05);
    }
    
    static getTimeBonus() {
        const hour = new Date().getHours();
        if (hour >= 2 && hour <= 6) return 1.5;
        if (hour >= 12 && hour <= 14) return 1.3;
        return 1.0;
    }
    
    static calculateFaucetEfficiency(user) {
        const credits = user.faucetCredits || {};
        let totalEfficiency = 0;
        let count = 0;
        
        for (const [key, value] of Object.entries(credits)) {
            totalEfficiency += value || 1.0;
            count++;
        }
        
        return count > 0 ? totalEfficiency / count : 1.0;
    }
}

// ========== FAUCET ORCHESTRATOR ==========
class FaucetOrchestrator {
    static async processTask(publicKey, taskType, metadata = {}) {
        const user = db.getUser(publicKey);
        
        const rate = PNLOptimizer.calculateOptimalPerformance(user);
        const multiplier = CONFIG.MULTIPLIERS[taskType] || 1.0;
        const earned = rate * multiplier;
        
        user.balance += earned;
        user.lifetimeEarnings += earned;
        user.lastActivity = Date.now();
        user.streak = (user.streak || 0) + 1;
        
        if (taskType === 'photo_upload') user.totalPhotos++;
        if (taskType === 'photo_download') user.totalDownloads++;
        if (taskType === 'review') user.totalReviews++;
        
        const faucetShare = earned / CONFIG.FAUCETS.length;
        CONFIG.FAUCETS.forEach(f => {
            if (!user.faucetCredits) user.faucetCredits = {};
            user.faucetCredits[f.name] = (user.faucetCredits[f.name] || 0) + faucetShare * f.weight;
        });
        
        db.updateUser(publicKey, user);
        db.addTransaction(publicKey, earned, 'earn', `${taskType}: ${metadata.description || ''}`);
        
        if (user.balance >= CONFIG.THRESHOLDS.min_withdraw) {
            await this.autoWithdraw(publicKey);
        }
        
        return {
            earned,
            balance: user.balance,
            rate: rate * 3600,
            performance: user.performance
        };
    }
    
    static async autoWithdraw(publicKey) {
        const user = db.getUser(publicKey);
        const amount = Math.min(user.balance, CONFIG.THRESHOLDS.max_daily);
        
        if (amount >= CONFIG.THRESHOLDS.min_withdraw) {
            user.balance -= amount;
            db.updateUser(publicKey, user);
            db.addTransaction(publicKey, amount, 'withdraw', 'Retiro automático optimizado');
            
            return {
                success: true,
                amount,
                message: `💰 Retiro automático de $${amount.toFixed(2)} procesado`
            };
        }
        
        return { success: false, message: 'Saldo insuficiente' };
    }
}

// ========== ENDPOINTS API ==========

// Registro con algoritmo de bienvenida
app.post('/register', (req, res) => {
    const { publicKey } = req.body;
    if (!publicKey) {
        return res.status(400).json({ error: 'Public key requerida' });
    }
    
    const user = db.getUser(publicKey);
    const welcomeBonus = 0.05 * (1 + Math.random() * 0.2);
    user.balance += welcomeBonus;
    db.updateUser(publicKey, user);
    
    res.json({
        success: true,
        message: `🎉 Registrado con bono de $${welcomeBonus.toFixed(3)}`,
        balance: user.balance
    });
});

// Procesar acción
app.post('/action', async (req, res) => {
    const { publicKey, action, metadata } = req.body;
    
    if (!publicKey) {
        return res.status(400).json({ error: 'Public key requerida' });
    }
    
    try {
        const result = await FaucetOrchestrator.processTask(publicKey, action, metadata);
        res.json({
            success: true,
            ...result,
            message: `✅ Ganaste $${result.earned.toFixed(4)} (${(result.rate).toFixed(2)} USD/hora)`
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Obtener estadísticas
app.get('/stats/:publicKey', (req, res) => {
    try {
        const user = db.getUser(req.params.publicKey);
        const performance = PNLOptimizer.calculateOptimalPerformance(user);
        
        res.json({
            publicKey: req.params.publicKey,
            balance: user.balance,
            lifetimeEarnings: user.lifetimeEarnings,
            totalPhotos: user.totalPhotos,
            totalReviews: user.totalReviews,
            streak: user.streak,
            currentRate: performance * 3600,
            estimatedHourly: Math.min(performance * 3600 * 10, 20),
            nextWithdraw: CONFIG.THRESHOLDS.min_withdraw - user.balance,
            faucetDistribution: user.faucetCredits || {}
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Retiro manual
app.post('/withdraw', async (req, res) => {
    const { publicKey } = req.body;
    if (!publicKey) {
        return res.status(400).json({ error: 'Public key requerida' });
    }
    
    const result = await FaucetOrchestrator.autoWithdraw(publicKey);
    res.json(result);
});

// Dashboard de transacciones
app.get('/transactions/:publicKey', (req, res) => {
    try {
        const allData = db.getDB();
        const txs = allData.transactions.filter(t => t.publicKey === req.params.publicKey);
        res.json({
            publicKey: req.params.publicKey,
            count: txs.length,
            transactions: txs.slice(-20)
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Sistema de referidos
app.post('/referral', (req, res) => {
    const { referrer, newUser } = req.body;
    
    if (!referrer || !newUser) {
        return res.status(400).json({ error: 'Referrer y newUser requeridos' });
    }
    
    const referrerUser = db.getUser(referrer);
    referrerUser.balance += 0.05;
    db.updateUser(referrer, referrerUser);
    
    res.json({
        success: true,
        message: `👥 Bono por referido: $0.05 para ${referrer}`
    });
});

// 🔥 NUEVO: Dashboard global
app.get('/dashboard', (req, res) => {
    const dbData = db.getDB();
    const users = Object.keys(dbData.users);
    const totalWithdraws = dbData.transactions.filter(t => t.type === 'withdraw');
    const totalEarned = dbData.transactions.filter(t => t.type === 'earn');
    
    res.json({
        totalUsers: users.length,
        totalTransactions: dbData.transactions.length,
        totalWithdraws: totalWithdraws.length,
        totalEarned: totalEarned.reduce((sum, t) => sum + t.amount, 0),
        totalPaid: dbData.stats.totalPaid || 0,
        lastTransactions: dbData.transactions.slice(-10)
    });
});

// 🔥 NUEVO: Manejo de errores 404 (para rutas no encontradas)
app.use((req, res) => {
    res.status(404).json({ 
        error: 'Ruta no encontrada',
        path: req.path,
        message: 'Verifica la URL o visita / para ver la aplicación'
    });
});

// ========== INICIO ==========
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`\n🚀 Faucet Revolution Engine corriendo en:`);
    console.log(`📍 http://localhost:${PORT}`);
    console.log(`📱 App: http://localhost:${PORT}/`);
    console.log(`📊 Dashboard: http://localhost:${PORT}/dashboard`);
    console.log(`🏓 Ping: http://localhost:${PORT}/ping`);
    console.log(`\n📊 Modelo PNL optimizado con ${CONFIG.FAUCETS.length} faucets\n`);
});

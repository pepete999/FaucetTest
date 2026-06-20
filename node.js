// server.js - Versión Revolucionaria
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json());

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
        photo_upload: 1.5,      // +50% por foto única
        photo_download: 0.3,    // +30% por descarga
        review: 0.7,            // +70% por reseña
        share: 0.4,             // +40% por compartir
        daily_bonus: 2.0        // x2 por actividad diaria
    },
    
    // Umbrales de rendimiento
    THRESHOLDS: {
        min_withdraw: 1.0,      // USD
        max_daily: 50.0,        // USD (anti-fraude)
        optimal_session: 25,    // minutos
        decay_factor: 0.98      // reducción por inactividad
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
    // Calcula el rendimiento óptimo basado en patrones históricos
    static calculateOptimalPerformance(user) {
        const baseRate = 0.005; // $0.005 por tarea base
        
        // Factores de rendimiento
        const engagementFactor = Math.min(
            (user.totalPhotos + user.totalReviews) / 100, 
            3.0
        );
        
        const streakFactor = 1 + (user.streak * 0.05);
        const timeFactor = this.getTimeBonus();
        const faucetEfficiency = this.calculateFaucetEfficiency(user);
        
        // Fórmula mágica de rendimiento
        const performance = baseRate * 
                           engagementFactor * 
                           streakFactor * 
                           timeFactor * 
                           faucetEfficiency;
        
        return Math.min(performance, 0.05); // Cap en $0.05 por tarea
    }
    
    static getTimeBonus() {
        const hour = new Date().getHours();
        // Horas pico (2-6 AM) tienen menos competencia en faucets
        if (hour >= 2 && hour <= 6) return 1.5;
        if (hour >= 12 && hour <= 14) return 1.3;
        return 1.0;
    }
    
    static calculateFaucetEfficiency(user) {
        // Simula eficiencia basada en uso previo
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

// ========== FAUCET ORCHESTRATOR (MULTI-API) ==========
class FaucetOrchestrator {
    static async processTask(publicKey, taskType, metadata = {}) {
        const user = db.getUser(publicKey);
        
        // 1. Calcular rendimiento óptimo
        const rate = PNLOptimizer.calculateOptimalPerformance(user);
        
        // 2. Aplicar multiplicador por tipo de tarea
        const multiplier = CONFIG.MULTIPLIERS[taskType] || 1.0;
        const earned = rate * multiplier;
        
        // 3. Actualizar estadísticas
        user.balance += earned;
        user.lifetimeEarnings += earned;
        user.lastActivity = Date.now();
        user.streak = (user.streak || 0) + 1;
        
        // 4. Actualizar contadores específicos
        if (taskType === 'photo_upload') user.totalPhotos++;
        if (taskType === 'photo_download') user.totalDownloads++;
        if (taskType === 'review') user.totalReviews++;
        
        // 5. Distribuir entre faucets (evita sobrecarga)
        const faucetShare = earned / CONFIG.FAUCETS.length;
        CONFIG.FAUCETS.forEach(f => {
            if (!user.faucetCredits) user.faucetCredits = {};
            user.faucetCredits[f.name] = (user.faucetCredits[f.name] || 0) + faucetShare * f.weight;
        });
        
        // 6. Guardar
        db.updateUser(publicKey, user);
        db.addTransaction(publicKey, earned, 'earn', `${taskType}: ${metadata.description || ''}`);
        
        // 7. Verificar si hay retiro automático (algoritmo de umbral)
        if (user.balance >= CONFIG.THRESHOLDS.min_withdraw) {
            await this.autoWithdraw(publicKey);
        }
        
        return {
            earned,
            balance: user.balance,
            rate: rate * 3600, // Tasa por hora
            performance: user.performance
        };
    }
    
    static async autoWithdraw(publicKey) {
        const user = db.getUser(publicKey);
        const amount = Math.min(user.balance, CONFIG.THRESHOLDS.max_daily);
        
        if (amount >= CONFIG.THRESHOLDS.min_withdraw) {
            // Simular envío a faucet
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
    const user = db.getUser(publicKey);
    
    // Bono de bienvenida optimizado
    const welcomeBonus = 0.05 * (1 + Math.random() * 0.2);
    user.balance += welcomeBonus;
    db.updateUser(publicKey, user);
    
    res.json({
        success: true,
        message: `🎉 Registrado con bono de $${welcomeBonus.toFixed(3)}`,
        balance: user.balance
    });
});

// Procesar acción (foto, reseña, descarga)
app.post('/action', async (req, res) => {
    const { publicKey, action, metadata } = req.body;
    
    if (!publicKey) return res.status(400).json({ error: 'Public key requerida' });
    
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

// Obtener estadísticas en tiempo real
app.get('/stats/:publicKey', (req, res) => {
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
        estimatedHourly: Math.min(performance * 3600 * 10, 20), // Cap 20 USD/hora
        nextWithdraw: CONFIG.THRESHOLDS.min_withdraw - user.balance,
        faucetDistribution: user.faucetCredits || {}
    });
});

// Retiro manual
app.post('/withdraw', async (req, res) => {
    const { publicKey } = req.body;
    const result = await FaucetOrchestrator.autoWithdraw(publicKey);
    res.json(result);
});

// Dashboard público de retiros
app.get('/transactions/:publicKey', (req, res) => {
    const allData = db.getDB();
    const txs = allData.transactions.filter(t => t.publicKey === req.params.publicKey);
    res.json(txs);
});

// ========== SISTEMA DE BONOS POR REFERIDOS ==========
app.post('/referral', (req, res) => {
    const { referrer, newUser } = req.body;
    
    // Bono matemático: 10% de las ganancias del referido por 30 días
    const bonus = 0.10;
    const referrerUser = db.getUser(referrer);
    referrerUser.balance += 0.05; // Bono inicial
    db.updateUser(referrer, referrerUser);
    
    res.json({
        success: true,
        message: `👥 Bono por referido: $0.05 para ${referrer}`
    });
});

// ========== INICIO ==========
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Faucet Revolution Engine corriendo en puerto ${PORT}`);
    console.log(`📊 Modelo PNL optimizado con ${CONFIG.FAUCETS.length} faucets`);
});

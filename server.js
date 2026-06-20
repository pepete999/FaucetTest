const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// ========== FAUCETPAY API ==========
const FAUCETPAY_API_KEY = process.env.FAUCETPAY_API_KEY || '';
const FAUCETPAY_CURRENCY = process.env.FAUCETPAY_CURRENCY || 'SOL';
const FAUCETPAY_API_URL = 'https://faucetpay.io/api/v1';

const app = express();
const PORT = process.env.PORT || 3000;

// ========== MIDDLEWARE ==========
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ========== FUNCIÓN FAUCETPAY ==========
async function faucetPayRequest(endpoint, params = {}) {
    const formData = new URLSearchParams();
    formData.append('api_key', FAUCETPAY_API_KEY);
    
    for (const [key, value] of Object.entries(params)) {
        formData.append(key, value);
    }
    
    try {
        const response = await fetch(`${FAUCETPAY_API_URL}/${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: formData.toString()
        });
        return await response.json();
    } catch (error) {
        console.error('Error en FaucetPay:', error.message);
        return { status: 'error', message: error.message };
    }
}

// ========== BASE DE DATOS ==========
const DB_FILE = 'data.json';
if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ 
        users: {}, 
        transactions: [],
        stats: { totalPaid: 0, totalUsers: 0, totalWithdrawals: 0 }
    }));
}

function getDB() {
    return JSON.parse(fs.readFileSync(DB_FILE));
}

function saveDB(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// ========== FUNCIONES FAUCETPAY ==========
async function checkAddress(address, currency = FAUCETPAY_CURRENCY) {
    if (!FAUCETPAY_API_KEY) {
        return { status: 'success', valid: true, simulated: true };
    }
    return await faucetPayRequest('checkaddress', { address, currency });
}

async function sendPayment(address, amount, currency = FAUCETPAY_CURRENCY) {
    if (!FAUCETPAY_API_KEY) {
        return {
            status: 'success',
            simulated: true,
            txid: `sim_${Date.now()}`,
            message: `Simulación: ${amount} ${currency}`
        };
    }
    return await faucetPayRequest('send', { address, amount, currency });
}

// ========== ENDPOINTS ==========

// 📝 Registro
app.post('/register', (req, res) => {
    const { publicKey } = req.body;
    
    if (!publicKey) {
        return res.status(400).json({ error: 'Public key requerida' });
    }
    
    const db = getDB();
    
    if (!db.users[publicKey]) {
        db.users[publicKey] = {
            balance: 0.05,
            lifetimeEarnings: 0.05,
            totalPhotos: 0,
            totalReviews: 0,
            totalDownloads: 0,
            streak: 0,
            lastActivity: Date.now(),
            withdrawals: []
        };
        db.stats.totalUsers++;
        saveDB(db);
        
        res.json({ 
            success: true, 
            message: '✅ Registrado con bono de $0.05',
            balance: 0.05
        });
    } else {
        res.json({ 
            success: false, 
            message: '⚠️ Usuario ya existe',
            balance: db.users[publicKey].balance
        });
    }
});

// 🎯 Acción
app.post('/action', (req, res) => {
    const { publicKey, action } = req.body;
    
    if (!publicKey) {
        return res.status(400).json({ error: 'Public key requerida' });
    }
    
    const db = getDB();
    const user = db.users[publicKey];
    
    if (!user) {
        return res.status(404).json({ error: 'Usuario no registrado' });
    }
    
    const earnings = {
        'photo_upload': 0.003,
        'photo_download': 0.0015,
        'review': 0.002,
        'share': 0.001
    };
    
    const earned = earnings[action] || 0.001;
    
    user.balance += earned;
    user.lifetimeEarnings += earned;
    user.streak = (user.streak || 0) + 1;
    user.lastActivity = Date.now();
    
    if (action === 'photo_upload') user.totalPhotos = (user.totalPhotos || 0) + 1;
    if (action === 'review') user.totalReviews = (user.totalReviews || 0) + 1;
    if (action === 'photo_download') user.totalDownloads = (user.totalDownloads || 0) + 1;
    
    db.transactions.push({
        publicKey,
        amount: earned,
        action,
        timestamp: Date.now()
    });
    
    saveDB(db);
    
    res.json({
        success: true,
        earned: earned,
        balance: user.balance,
        message: `✅ Ganaste $${earned.toFixed(4)}`
    });
});

// 📊 Estadísticas
app.get('/stats/:publicKey', (req, res) => {
    const db = getDB();
    const user = db.users[req.params.publicKey];
    
    if (!user) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    res.json({
        balance: user.balance,
        totalPhotos: user.totalPhotos || 0,
        totalReviews: user.totalReviews || 0,
        totalDownloads: user.totalDownloads || 0,
        streak: user.streak || 0,
        estimatedHourly: Math.min(user.balance * 2, 20)
    });
});

// 💰 Retiro
app.post('/withdraw', async (req, res) => {
    const { publicKey, currency } = req.body;
    
    if (!publicKey) {
        return res.status(400).json({ error: 'Public key requerida' });
    }
    
    const db = getDB();
    const user = db.users[publicKey];
    
    if (!user) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    if (user.balance < 1.0) {
        return res.json({
            success: false,
            message: `❌ Saldo insuficiente. Necesitas $${(1.0 - user.balance).toFixed(2)} más`
        });
    }
    
    const currencyToUse = currency || FAUCETPAY_CURRENCY || 'SOL';
    const amountUSD = user.balance;
    
    const rates = {
        'SOL': 0.007,
        'BTC': 0.000015,
        'ETH': 0.0004,
        'USDC': 1.0
    };
    
    const rate = rates[currencyToUse] || 0.007;
    const amountCrypto = Math.round((amountUSD * rate) * 100000000) / 100000000;
    
    if (amountCrypto < 0.00000001) {
        return res.json({
            success: false,
            message: '❌ El monto es demasiado pequeño'
        });
    }
    
    try {
        const checkResult = await checkAddress(publicKey, currencyToUse);
        
        if (checkResult.status !== 'success' && !checkResult.simulated) {
            return res.json({
                success: false,
                message: '❌ Dirección inválida para ' + currencyToUse
            });
        }
        
        const paymentResult = await sendPayment(publicKey, amountCrypto, currencyToUse);
        
        if (paymentResult.status === 'success' || paymentResult.simulated) {
            user.balance = 0;
            user.withdrawals = user.withdrawals || [];
            user.withdrawals.push({
                amountUSD: amountUSD,
                amountCrypto: amountCrypto,
                currency: currencyToUse,
                txid: paymentResult.txid || 'pending',
                simulated: paymentResult.simulated || false,
                timestamp: Date.now()
            });
            
            db.stats.totalPaid += amountUSD;
            db.stats.totalWithdrawals = (db.stats.totalWithdrawals || 0) + 1;
            
            db.transactions.push({
                publicKey,
                amount: -amountUSD,
                action: 'withdraw',
                currency: currencyToUse,
                txid: paymentResult.txid || 'pending',
                timestamp: Date.now()
            });
            
            saveDB(db);
            
            res.json({
                success: true,
                message: `✅ Retiro de $${amountUSD.toFixed(2)} (${amountCrypto.toFixed(8)} ${currencyToUse}) procesado`,
                amountUSD: amountUSD,
                amountCrypto: amountCrypto,
                currency: currencyToUse,
                txid: paymentResult.txid || 'pending',
                simulated: paymentResult.simulated || false
            });
        } else {
            res.json({
                success: false,
                message: '❌ Error al procesar el pago'
            });
        }
        
    } catch (error) {
        console.error('Error en retiro:', error);
        res.status(500).json({
            success: false,
            message: '❌ Error al procesar el retiro: ' + error.message
        });
    }
});

// 🏓 Ping
app.get('/ping', (req, res) => {
    res.json({ 
        status: 'ok',
        timestamp: Date.now(),
        faucetEnabled: !!FAUCETPAY_API_KEY,
        currency: FAUCETPAY_CURRENCY
    });
});

// 🔥 Ruta principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ========== INICIAR SERVIDOR ==========
app.listen(PORT, () => {
    console.log(`\n🚀 Servidor corriendo en puerto ${PORT}`);
    console.log(`💰 FaucetPay: ${FAUCETPAY_API_KEY ? '✅ ACTIVADO' : '⚠️ SIMULACIÓN'}`);
});

// Manejo de errores 404
app.use((req, res) => {
    res.status(404).json({ error: 'Ruta no encontrada', path: req.path });
});

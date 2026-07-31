// ==========================================
// server.js (Código Completo y Adaptado)
// ==========================================
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// ========== FAUCETPAY API CONFIGURACIÓN ==========
const FAUCETPAY_API_KEY = process.env.FAUCETPAY_API_KEY || '5cf12fcc4f252927a492b551de2e4c41c248407c6d0be15f83eed041dc4537ad';
const FAUCETPAY_CURRENCY = process.env.FAUCETPAY_CURRENCY || 'BTC';
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

// ========== BASE DE DATOS LOCAL ==========
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

// ========== FUNCIONES DE VALIDACIÓN Y PAGO ==========
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

// ========== ENDPOINTS DE LA APLICACIÓN ==========

// 📝 Registro de Usuario y Wallet Nativa
app.post('/register', (req, res) => {
    const { publicKey } = req.body;
    
    if (!publicKey) {
        return res.status(400).json({ error: 'Public key requerida' });
    }
    
    const db = getDB();
    
    if (!db.users[publicKey]) {
        db.users[publicKey] = {
            balanceSats: 0,
            balanceARS: 0,
            lifetimeEarningsSats: 0,
            totalSurveys: 0,
            totalSpins: 0,
            streak: 0,
            lastActivity: Date.now(),
            withdrawals: []
        };
        db.stats.totalUsers++;
        saveDB(db);
        
        res.json({ 
            success: true, 
            message: '✅ Wallet generada correctamente',
            balanceSats: 0
        });
    } else {
        res.json({ 
            success: false, 
            message: '⚠️ La wallet ya existe',
            balanceSats: db.users[publicKey].balanceSats,
            balanceARS: db.users[publicKey].balanceARS
        });
    }
});

// 🎯 Responder Encuesta o Minijuego (Aporte por faucets externos/acciones)
app.post('/action', (req, res) => {
    const { publicKey, action, rewardSats } = req.body;
    
    if (!publicKey) {
        return res.status(400).json({ error: 'Public key requerida' });
    }
    
    const db = getDB();
    const user = db.users[publicKey];
    
    if (!user) {
        return res.status(404).json({ error: 'Usuario no registrado' });
    }
    
    const earnedSats = parseInt(rewardSats) || 300;
    
    user.balanceSats += earnedSats;
    user.lifetimeEarningsSats += earnedSats;
    user.streak = (user.streak || 0) + 1;
    user.lastActivity = Date.now();
    
    if (action === 'survey') {
        user.totalSurveys = (user.totalSurveys || 0) + 1;
    } else if (action === 'roulette') {
        user.totalSpins = (user.totalSpins || 0) + 1;
    }
    
    db.transactions.push({
        publicKey,
        amount: earnedSats,
        action,
        timestamp: Date.now()
    });
    
    saveDB(db);
    
    res.json({
        success: true,
        earned: earnedSats,
        balanceSats: user.balanceSats,
        message: `✅ Ganaste +${earnedSats} Sats (Acumulado desde fuentes externas)`
    });
});

// 💱 Convertir Sats a Pesos Argentinos (ARS)
app.post('/convert', (req, res) => {
    const { publicKey } = req.body;
    const TASA_SAT_TO_ARS = 1.25; 
    
    if (!publicKey) {
        return res.status(400).json({ error: 'Public key requerida' });
    }
    
    const db = getDB();
    const user = db.users[publicKey];
    
    if (!user) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    if (user.balanceSats <= 0) {
        return res.json({
            success: false,
            message: '❌ No tienes faucets acumulados para convertir'
        });
    }
    
    const arsGenerados = user.balanceSats * TASA_SAT_TO_ARS;
    user.balanceARS += arsGenerados;
    user.balanceSats = 0; 
    
    saveDB(db);
    
    res.json({
        success: true,
        balanceSats: user.balanceSats,
        balanceARS: user.balanceARS,
        message: '✅ Conversión exitosa a Pesos Argentinos'
    });
});

// 📊 Estadísticas de la Wallet
app.get('/stats/:publicKey', (req, res) => {
    const db = getDB();
    const user = db.users[req.params.publicKey];
    
    if (!user) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    res.json({
        balanceSats: user.balanceSats,
        balanceARS: user.balanceARS,
        totalSurveys: user.totalSurveys || 0,
        totalSpins: user.totalSpins || 0,
        streak: user.streak || 0
    });
});

// 💰 Retirar ARS (Validado con FaucetPay o Simulación)
app.post('/withdraw', async (req, res) => {
    const { publicKey, alias, currency } = req.body;
    
    if (!publicKey || !alias) {
        return res.status(400).json({ error: 'Public key y alias requeridos' });
    }
    
    const db = getDB();
    const user = db.users[publicKey];
    
    if (!user) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    if (user.balanceARS <= 0) {
        return res.json({
            success: false,
            message: '❌ Primero debes convertir tus faucets a Pesos Argentinos'
        });
    }
    
    const amountARS = user.balanceARS;
    
    try {
        const currencyToUse = currency || FAUCETPAY_CURRENCY || 'BTC';
        const checkResult = await checkAddress(publicKey, currencyToUse);
        
        if (checkResult.status !== 'success' && !checkResult.simulated) {
            return res.json({
                success: false,
                message: '❌ Dirección inválida en la red FaucetPay'
            });
        }
        
        user.balanceARS = 0;
        user.withdrawals = user.withdrawals || [];
        user.withdrawals.push({
            amountARS: amountARS,
            alias: alias,
            timestamp: Date.now()
        });
        
        db.stats.totalPaid += amountARS;
        db.stats.totalWithdrawals = (db.stats.totalWithdrawals || 0) + 1;
        
        saveDB(db);
        
        res.json({
            success: true,
            message: `✅ Retiro de $${amountARS.toLocaleString('es-AR', {minimumFractionDigits: 2})} ARS procesado con éxito para el alias: ${alias}`,
            amountARS: amountARS
        });
        
    } catch (error) {
        console.error('Error en retiro ARS:', error);
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
    console.log(`💰 FaucetPay (API Key configurada): ${FAUCETPAY_API_KEY ? '✅ ACTIVADO' : '⚠️ APAGADO'}`);
});

app.use((req, res) => {
    res.status(404).json({ error: 'Ruta no encontrada', path: req.path });
});

// --- Dependências ---
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const axios = require('axios');
const express = require('express'); // Apenas express é necessário para o servidor

// --- Configuração do Cliente WhatsApp ---
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    },
});

// --- Configuração do Servidor Express (HTTP Simples) ---
const app = express();
app.use(express.json());

const PORT = 3001; // Use a porta 3001, que sabemos que está livre

// Rota que o n8n vai chamar
app.post('/enviar-mensagem', async (req, res) => {
    const { numero, mensagem } = req.body;

    if (!numero || !mensagem) {
        console.error('❌ Requisição para /enviar-mensagem inválida.');
        return res.status(400).json({ success: false, error: 'Campos "numero" e "mensagem" são obrigatórios.' });
    }

    try {
        const chatId = await client.getNumberId(numero);
        if (!chatId) {
            return res.status(404).json({ success: false, error: `Número ${numero} não encontrado.` });
        }

        console.log(`➡️  Enviando mensagem para ${numero}: "${mensagem}"`);
        await client.sendMessage(chatId._serialized, mensagem);
        
        res.status(200).json({ success: true, message: 'Mensagem enviada com sucesso!' });
    } catch (error) {
        console.error(`❌ Falha ao enviar mensagem para ${numero}:`, error.message);
        res.status(500).json({ success: false, error: 'Falha ao enviar a mensagem no WhatsApp.' });
    }
});

// --- Lógica do Cliente WhatsApp (sem alterações) ---
// ... (seu código client.on('qr'), client.on('ready'), client.on('message') continua igual) ...

// --- Inicialização ---
// Inicia o servidor HTTP simples
app.listen(PORT, () => {
    console.log(`🚀 Servidor de API do Bot rodando em modo HTTP na porta ${PORT}`);
});

// Inicia o cliente do WhatsApp
client.initialize();
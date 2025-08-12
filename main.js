// --- Dependências ---
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const axios = require('axios');
const express = require('express');
const https = require('https' ); // Módulo para criar um servidor HTTPS
const fs = require('fs');     // Módulo para ler arquivos do sistema (nossos certificados)

// --- Configuração do Cliente WhatsApp ---
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    },
});

// --- Configuração do Servidor Express ---
const app = express();
app.use(express.json());

// --- Lógica da API para o n8n ---
// Rota que o n8n vai chamar para enviar a mensagem de volta ao usuário
app.post('/enviar-mensagem', async (req, res) => {
    const { numero, mensagem } = req.body;

    if (!numero || !mensagem) {
        console.error('❌ Requisição para /enviar-mensagem inválida: Faltou "numero" ou "mensagem".');
        return res.status(400).json({ success: false, error: 'Os campos "numero" e "mensagem" são obrigatórios.' });
    }

    try {
        const chatId = await client.getNumberId(numero);
        if (!chatId) {
            console.error(`❌ Tentativa de envio para número inválido: ${numero}`);
            return res.status(404).json({ success: false, error: `O número ${numero} não foi encontrado no WhatsApp.` });
        }

        console.log(`➡️  Enviando mensagem para ${numero}: "${mensagem}"`);
        await client.sendMessage(chatId._serialized, mensagem);
        
        res.status(200).json({ success: true, message: 'Mensagem enviada com sucesso!' });
    } catch (error) {
        console.error(`❌ Falha crítica ao enviar mensagem para ${numero}:`, error.message);
        res.status(500).json({ success: false, error: 'Falha ao enviar a mensagem no WhatsApp.', details: error.message });
    }
});

// --- Lógica do Cliente WhatsApp ---
client.on('qr', qr => {
    console.log('📱 Escaneie o QR Code abaixo com o seu WhatsApp:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('✅ Cliente WhatsApp está pronto e conectado!');
});

client.on('message', async msg => {
    if (msg.from.includes('@g.us')) {
        return;
    }

    console.log(`📥 Mensagem recebida de ${msg.from}: "${msg.body}"`);

    const contact = await msg.getContact();

    const payload = {
        de: contact.pushname || contact.name || msg.from,
        numero: msg.from,
        mensagem: msg.body,
        tipo: msg.type,
        idMensagem: msg.id._serialized,
        timestamp: msg.timestamp,
    };

    try {
        await axios.post('https://chatclean-automations.xyz/webhook/mensagem-vendas', payload );
        console.log(`🚀 Webhook enviado para o n8n com sucesso para o número ${payload.numero}.`);
    } catch (error) {
        console.error(`❌ Erro ao enviar o webhook para o n8n:`, error.message);
    }
});

// --- Inicialização ---

const PORT = 3000;

// Tenta carregar os certificados SSL
try {
    const privateKey = fs.readFileSync('key.pem', 'utf8');
    const certificate = fs.readFileSync('cert.pem', 'utf8');
    const credentials = { key: privateKey, cert: certificate };

    // Cria e inicia o servidor HTTPS
    const httpsServer = https.createServer(credentials, app );
    httpsServer.listen(PORT, ( ) => {
        console.log(`🚀 Servidor de API do Bot rodando com HTTPS na porta ${PORT}`);
    });

} catch (error) {
    console.error('❌ Erro ao carregar certificados SSL. O servidor HTTPS não pôde ser iniciado.');
    console.error('   Certifique-se de que os arquivos "key.pem" e "cert.pem" existem na mesma pasta do seu bot.');
    console.error('   Iniciando em modo HTTP apenas para o bot funcionar (API não responderá ao n8n).');
    // Fallback para HTTP se os certificados não forem encontrados
    app.listen(PORT, () => {
        console.log(`🚀 Servidor de API do Bot rodando em modo HTTP (fallback) na porta ${PORT}`);
    });
}

// Inicia o cliente do WhatsApp
client.initialize();

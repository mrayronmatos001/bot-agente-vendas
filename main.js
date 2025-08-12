// --- Dependências ---
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const axios = require('axios');
const express = require('express');

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

const PORT = 3001; // Porta para o servidor de API

// Rota que o n8n vai chamar para enviar a resposta
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

// --- Lógica do Cliente WhatsApp ---

client.on('qr', qr => {
    console.log('📱 Escaneie o QR Code abaixo com o seu WhatsApp:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('✅ Cliente WhatsApp está pronto e conectado!');
});

// ***** ESTA É A PARTE QUE ESTAVA FALTANDO *****
client.on('message', async msg => {
    // Ignora mensagens de grupos
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

    // Envia os dados para o seu fluxo de trabalho no n8n
    try {
        await axios.post('https://chatclean-automations.xyz/webhook/mensagem-vendas', payload );
        console.log(`🚀 Webhook enviado para o n8n com sucesso para o número ${payload.numero}.`);
    } catch (error) {
        // Log de erro aprimorado
        console.error(`❌ Erro CRÍTICO ao enviar o webhook para o n8n:`);
        if (error.response) {
            console.error('   Data:', error.response.data);
            console.error('   Status:', error.response.status);
        } else if (error.request) {
            console.error('   Requisição feita, mas sem resposta. Verifique a rede/firewall.');
        } else {
            console.error('   Erro na configuração do Axios:', error.message);
        }
    }
});

// --- Inicialização ---

// Inicia o servidor Express
app.listen(PORT, () => {
    console.log(`🚀 Servidor de API do Bot rodando em modo HTTP na porta ${PORT}`);
});

// Inicia o cliente do WhatsApp
client.initialize();
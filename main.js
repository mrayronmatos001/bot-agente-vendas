// --- Dependências ---
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const axios = require('axios');
const express = require('express');

// --- Configuração do Cliente WhatsApp ---
const client = new Client({
    authStrategy: new LocalAuth(), // Usa autenticação local para não precisar escanear o QR Code toda vez
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox'], // Argumentos necessários para rodar em muitos servidores/contêineres
    },
});

// --- Configuração do Servidor Express para Receber Respostas do n8n ---
const app = express();
app.use(express.json()); // Middleware nativo do Express para processar o corpo de requisições JSON

const PORT = 3000; // Porta que o servidor vai escutar. Certifique-se de que ela está liberada no seu firewall.

// Rota que o n8n vai chamar para enviar a mensagem de volta ao usuário
app.post('/enviar-mensagem', async (req, res) => {
    const { numero, mensagem } = req.body;

    // Validação básica da requisição
    if (!numero || !mensagem) {
        console.error('❌ Requisição para /enviar-mensagem inválida: Faltou "numero" ou "mensagem".');
        return res.status(400).json({ success: false, error: 'Os campos "numero" e "mensagem" são obrigatórios.' });
    }

    try {
        // Verifica se o número é um usuário válido do WhatsApp antes de enviar
        const chatId = await client.getNumberId(numero);
        if (!chatId) {
            console.error(`❌ Tentativa de envio para número inválido: ${numero}`);
            return res.status(404).json({ success: false, error: `O número ${numero} não foi encontrado no WhatsApp.` });
        }

        // Envia a mensagem usando o ID serializado do chat
        console.log(`➡️  Enviando mensagem para ${numero}: "${mensagem}"`);
        await client.sendMessage(chatId._serialized, mensagem);
        
        // Responde ao n8n que a operação foi um sucesso
        res.status(200).json({ success: true, message: 'Mensagem enviada com sucesso!' });
    } catch (error) {
        console.error(`❌ Falha crítica ao enviar mensagem para ${numero}:`, error.message);
        // Responde ao n8n que houve um erro no servidor
        res.status(500).json({ success: false, error: 'Falha ao enviar a mensagem no WhatsApp.', details: error.message });
    }
});


// --- Lógica do Cliente WhatsApp ---

// Evento para gerar o QR Code no terminal
client.on('qr', qr => {
    console.log('📱 Escaneie o QR Code abaixo com o seu WhatsApp:');
    qrcode.generate(qr, { small: true });
});

// Evento disparado quando o cliente está autenticado e pronto para operar
client.on('ready', () => {
    console.log('✅ Cliente WhatsApp está pronto e conectado!');
});

// Evento principal: disparado a cada nova mensagem recebida
client.on('message', async msg => {
    // Ignora mensagens de grupos para focar em conversas individuais
    if (msg.from.includes('@g.us')) {
        return;
    }

    console.log(`📥 Mensagem recebida de ${msg.from}: "${msg.body}"`);

    // Obtém informações de contato para um payload mais completo
    const contact = await msg.getContact();

    // Monta o payload (dados) a ser enviado para o webhook do n8n
    const payload = {
        de: contact.pushname || contact.name || msg.from, // Nome do contato ou número se não houver nome
        numero: msg.from, // ID do chat (ex: 5511999999999@c.us)
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
        console.error(`❌ Erro ao enviar o webhook para o n8n:`, error.message);
    }
});

// --- Inicialização ---

// Inicia o servidor Express para escutar as chamadas do n8n
app.listen(PORT, () => {
    console.log(`🚀 Servidor de API do Bot rodando e escutando na porta ${PORT}`);
});

// Inicia o cliente do WhatsApp
client.initialize();
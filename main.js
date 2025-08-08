const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const axios = require('axios');

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    },
});

async function obterChatIdSeguro(numero) {
    try {
        const numberId= await client.getNumberId(numero);
        if (!numberId) throw new Error(`Número ${numero} não encontrado no WhatsApp`);
        return numberId._serialized;
    } catch (error) {
        console.error(`❌ Erro ao resolver o chatId para ${numero}:`, error);
        throw error;
    }
}

client.on('qr', qr => {
    console.log('Escaneie o QR Code abaixo:');
    qrcode.generate(qr, {small: true});
});

client.on('ready', () => {
    console.log('✅ Bot está pronto');
});

client.on('message', async msg => {
    console.log('Mensagem recebida:', msg.body);
    if (msg.from.includes('@g.us')) return;

    const contact = await msg.getContact();

    const payload = {
        de: contact.pushname || contact.pushnumber,
        numero: msg.from,
        mensagem: msg.body,
        tipo: msg.type,
        idMensagem: msg.id._serialized,
        timestamp: msg.timestamp,
    };

    await axios.post('https://chatclean-automations.xyz/webhook/mensagem-vendas', payload);

});

client.initialize();
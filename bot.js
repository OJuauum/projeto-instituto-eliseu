const makeWASocket = require('@whiskeysockets/baileys').default;
const { useSingleFileAuthState } = require('@whiskeysockets/baileys').default;
const qrcode = require('qrcode-terminal');
const pino = require('pino');

const { state, saveState } = require('@whiskeysockets/baileys').useSingleFileAuthState('./auth_info.json');

async function startBot() {
  const sock = makeWASocket({
    logger: pino({ level: 'silent' }),
    auth: state
  });

  sock.ev.on('connection.update', (update) => {
    const { connection, qr } = update;
    if (qr) qrcode.generate(qr, { small: true });
    if (connection === 'open') console.log('✅ Bot conectado com sucesso!');
  });

  sock.ev.on('messages.upsert', async (m) => {
    const msg = m.messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const sender = msg.key.remoteJid;
    const text = (msg.message.conversation || msg.message.extendedTextMessage?.text || '').trim();

    const response = getResponse(text);
    await sock.sendMessage(sender, { text: response });
  });

  sock.ev.on('creds.update', saveState);
}

function getResponse(text) {
  switch (text) {
    case '1':
      return `🐶 *Castração Gratuita*
Informações:
- Prioridade para famílias de baixa renda
- O transporte é de responsabilidade do tutor
- Agendamento mediante confirmação

Por favor, informe:
1️⃣ Cidade
2️⃣ Bairro
3️⃣ Tipo de animal (Cão ou Gato)
4️⃣ Quantidade (Macho/Fêmea)
5️⃣ Raça

➤ Após responder, aguarde o atendente.`;

    case '2':
      return `🩺 *Atendimento Veterinário Gratuito*
- Atendimento apenas mediante agendamento
- Casos de urgência têm prioridade
- Sujeito à avaliação social

➤ Encaminharemos sua solicitação para um atendente.`;

    case '3':
      return `🐾 *Adoção de Animais*
- WhatsApp CÃES: (13) 91234-5678
- WhatsApp GATOS: (13) 97654-3210
- Veja fotos e perfis nas nossas redes sociais!

➤ Obrigado por adotar! 💚`;

    case '4':
      return `💰 *Setor Financeiro*
Escolha uma das opções:
4.1 Tornar-se colaborador
4.2 Contribuições eventuais
4.3 Emissão de boletos
4.4 Falar com setor financeiro
4.5 Nota Fiscal Paulista`;

    case '4.1':
      return `🤝 *Tornar-se Colaborador*
Preencha o formulário: https://institutoeliseu.org/colaborador`;

    case '4.2':
      return `🎁 *Contribuições Eventuais*
PIX: 11.111.111/0001-11 (CNPJ)
Banco: 123 - Agência: 0001 - Conta: 12345-6`;

    case '4.3':
      return `📄 *Emissão de Boletos*
Entre em contato via WhatsApp: (13) 97809-0051`;

    case '4.4':
      return `💬 *Falar com o Setor Financeiro*
WhatsApp: (13) 99618-0179`;

    case '4.5':
      return `🧾 *Nota Fiscal Paulista*
Contato: Cristiane - WhatsApp (13) 99138-1061`;

    case '5':
      return `🎒 *Doações Diversas*
Escolha:
5.1 Ajuda eventual (alimentos, roupas etc)
5.2 Doação de materiais (limpeza, insumos)`;

    case '5.1':
      return `📦 *Ajuda Eventual*
Itens aceitos: alimentos, roupas, cobertores
Endereço para envio: Rua Exemplo, 123 – Santos/SP`;

    case '5.2':
      return `🧼 *Doação de Materiais*
Aceitamos materiais de limpeza, medicamentos e utensílios
Podemos redistribuir conforme a necessidade`;

    case '6':
      return `📚 *Outros Assuntos*
Escolha:
6.1 Projetos para Voluntários
6.2 Endereço e Horário
6.3 Outras Solicitações`;

    case '6.1':
      return `🙋 *Projetos de Voluntariado*
- Aconchego Felino: WhatsApp (13) 91234-0001
- Passeio com Cães: WhatsApp (13) 91234-0002
- Nota Fiscal Salvando Vidas: WhatsApp (13) 91234-0003`;

    case '6.2':
      return `📍 *Endereço e Horário*
Rua Exemplo, 123 – Santos/SP
Horário de atendimento: Seg-Sex, 9h às 17h`;

    case '6.3':
      return `✉️ Por favor, qual é sua solicitação?
➤ Encaminharemos para um atendente.`;

    default:
      return `🌟 *Bem-vindo ao Instituto Eliseu* 🌟

Digite o número do seu assunto:
1️⃣ Castração Gratuita
2️⃣ Atendimento Veterinário Gratuito
3️⃣ Adoção de Animais
4️⃣ Setor Financeiro
5️⃣ Doações Diversas
6️⃣ Outros Assuntos`;
  }
}

startBot();
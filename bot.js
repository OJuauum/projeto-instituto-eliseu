const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('baileys');
const qrcode = require('qrcode-terminal');
const pino = require('pino');
const logger = pino({ level: 'silent' });

let currentMenus = {};        // controle de contexto por usuário
let atendimentoHumano = {};   // controle de usuários em atendimento humano

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('./auth');
  const sock = makeWASocket({ auth: state, logger, printQRInTerminal: false });

  sock.ev.on('connection.update', (update) => {
    const { connection, qr, lastDisconnect } = update;
    if (qr) qrcode.generate(qr, { small: true });
    if (connection === 'open') console.log('✅ Bot conectado!');
    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut);
      if (shouldReconnect) startBot();
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    const msg = messages[0];

    // Ignora mensagens sem conteúdo ou enviadas pelo próprio bot
    if (!msg.message || msg.key.fromMe) return;

    // Bloqueia mensagens de grupos
    const sender = msg.key.remoteJid;
    if (sender.endsWith('@g.us')) return;

    // Captura o texto da mensagem
    const text = msg.message.conversation
      || msg.message.extendedTextMessage?.text
      || msg.message.imageMessage?.caption
      || msg.message.videoMessage?.caption
      || '';

    const input = text.trim();

    const response = getResponse(sender, input);
    if (response) {
      await sock.sendPresenceUpdate('composing', sender);
      await new Promise(r => setTimeout(r, Math.min(1000 + response.length * 20, 4000)));
      await sock.sendMessage(sender, { text: response });
      await sock.sendPresenceUpdate('available', sender);
    }
  });

  sock.ev.on('creds.update', saveCreds);
}

function getResponse(sender, text) {
  const input = text.trim().toLowerCase();

  // Se usuário está em atendimento humano, só responde se digitar "voltar"
  if (atendimentoHumano[sender]) {
    if (input === 'voltar') {
      atendimentoHumano[sender] = false;
      currentMenus[sender] = 'main';
      return mainMenu();
    }
    return null; // não responde para não atrapalhar o humano
  }

  // Comando para transferir para atendimento humano
  if (input === 'atendimento humano' || input === 'falar com atendente') {
    atendimentoHumano[sender] = true;
    return `👩‍💼 Você será transferido para nosso atendimento humano. Por favor, aguarde que um atendente irá te responder.`;
  }

  const context = currentMenus[sender] || 'main';

  // Reset para menu principal
  if (['menu', 'voltar'].includes(input)) {
    currentMenus[sender] = 'main';
    return mainMenu();
  }

  if (context === 'main') {
    switch (input) {
      case '1':
        currentMenus[sender] = 'main';
        atendimentoHumano[sender] = true;
        return msgCastracao();
      case '2':
        currentMenus[sender] = 'main';
        atendimentoHumano[sender] = true;
        return msgVeterinario();
      case '3':
        currentMenus[sender] = 'main';
        return msgAdocao();
      case '4':
        currentMenus[sender] = 'financeiro';
        return menuFinanceiro();
      case '5':
        currentMenus[sender] = 'doacoes';
        return menuDoacoes();
      case '6':
        currentMenus[sender] = 'outros';
        return menuOutros();
      default:
        return mainMenu();
    }
  }

  if (context === 'financeiro') {
    switch (input) {
      case '1': return colaborador();
      case '2': return contribuicao();
      case '3': return boleto();
      case '4': return falarFinanceiro();
      case '5': return notaFiscal();
      default: return menuFinanceiro();
    }
  }

  if (context === 'doacoes') {
    switch (input) {
      case '1': return ajudaEventual();
      case '2': return doacaoMateriais();
      default: return menuDoacoes();
    }
  }

  if (context === 'outros') {
    switch (input) {
      case '1': return voluntarios();
      case '2': return enderecoHorario();
      case '3':
        atendimentoHumano[sender] = true;
        return outrasSolicitacoes();
      default: return menuOutros();
    }
  }

  return mainMenu();
}

// ---------------- Menus ----------------
function mainMenu() {
  return `🌟 Olá! Esse é o contato do INSTITUTO ELISEU 🌟

  Uma organização voltada à proteção e bem-estar animal com ações na Baixada Santista. Nossa missão principal é o controle populacional de cães e gatos, adoção responsável de animais e atendimento veterinário gratuito para os animais de pessoas comprovadamente carentes da região.

1️⃣ Castração Gratuita
2️⃣ Atendimento Veterinário Gratuito
3️⃣ Adoção de Animais
4️⃣ Setor Financeiro
5️⃣ Doações Diversas
6️⃣ Outros Assuntos

Digite o número da opção desejada.`;
}

function menuFinanceiro() {
  return `💰 *Setor Financeiro*\n
1️⃣ Tornar-se colaborador\n2️⃣ Contribuição eventual\n3️⃣ Emissão de boleto\n4️⃣ Falar com financeiro\n5️⃣ Nota Fiscal Paulista\n\nDigite o número ou digite *voltar* para retornar ao menu principal.`;
}
function menuDoacoes() {
  return `🎁 *Doações Diversas*\n
1️⃣ Ajuda eventual\n2️⃣ Doação de materiais\n\nDigite o número ou digite *voltar* para retornar ao menu principal.`;
}
function menuOutros() {
  return `❓ *Outros Assuntos*\n
1️⃣ Projetos para voluntários\n2️⃣ Endereço e horário\n3️⃣ Outras solicitações\n\nDigite o número ou digite *voltar* para retornar ao menu principal.`;
}

const msgCastracao = () => `📍 *Castração Gratuita*\n
O programa de castração gratuita do *Instituto Eliseu* é voltado a animais de pessoas de baixa renda, que não têm condições de arcar com os custos do procedimento.\n
Antes de iniciarmos o atendimento, é importante que você saiba:\n
I. As castrações são realizadas com *anestesia injetável*. Por questões de segurança, *não serão castrados*:
- Animais de raça definida;
- Cães mestiços (filhos diretos de raças definidas) com até *5 kg*;
- Cães com mais de *20 kg*;
- Animais debilitados.\n
II. Para *gatos*, é obrigatório o uso de *caixa de transporte*:
- Até *2 gatos filhotes* por caixa;
- *1 gato adulto* por caixa;
- Sem caixa apropriada, a castração **não será realizada**.\n
III. É obrigatório respeitar os *horários de agendamento* e o *local definido*. Atrasos não serão tolerados.\n
IV. É permitido levar no máximo *3 animais por pessoa* no dia da castração.\n
📝 Agora, precisamos de algumas informações:
- 📍 *Cidade*;
- 🏘️ *Bairro*;
- 🐾 *Tipo de animal* (*Cão* ou *Gato*);
- 🔢 *Quantidade* (*Machos* e *Fêmeas*);
- 🐶 *Raça*.\n
📩 Assim que possível, retornaremos o contato.\n
Muito obrigado! Encaminhando para o atendimento...`;

const msgVeterinario = () => `🐾 *Atendimento Veterinário Gratuito*\n
O programa é destinado a animais de pessoas de baixa renda, que não têm condições de arcar com os custos de uma consulta veterinária.\n
🔎 *Informações importantes:*
1️⃣ O atendimento é feito *somente com agendamento prévio*;
2️⃣ Damos prioridade a *casos de urgência ou emergência*, com animais *sem raça definida*, residentes da *Baixada Santista*;
3️⃣ A aprovação do atendimento depende da avaliação da nossa *equipe técnica*;
4️⃣ A continuidade do tratamento será definida pelo *veterinário responsável*.\n
📩 Assim que possível, retornaremos seu contato.\n
🙏 Agradecemos pela compreensão. Encaminhando para o atendimento...`;

const msgAdocao = () => `🐶 *Adoção de Animais*\n
Se você tem interesse em adotar, entre em contato com os nossos setores pelo WhatsApp:

📱 *Adoção de Cães:* (13) 99708-4953  
📱 *Adoção de Gatos:* (13) 99630-8071\n
💡 *Dica:* Antes de enviar sua mensagem, confira as fotos e histórias dos nossos animais nas redes sociais. Eles estão esperando por uma nova família cheia de amor!\n
🔗 *Redes Sociais:*  
Instagram: [@institutoeliseu](https://www.instagram.com/institutoeliseu/)  
Facebook: [Instituto Eliseu](https://www.facebook.com/institutoeliseuoficial/)\n
Agradecemos sua confiança e carinho! 💛\n
Para voltar ao menu principal, digite *voltar*.`;

const colaborador = () => `✨ *Tornar-se Colaborador*\n
Obrigado pelo seu interesse em apoiar o *Instituto Eliseu*! Para se tornar um doador mensal, siga os passos abaixo:

🔗 Preencha o formulário de doação: [Clique aqui](https://www.institutoeliseu.org.br/doacao)

💰 *Informações importantes:*  
- Valor mínimo da doação: R$ 30,00  
- O boleto será enviado por e-mail ou link via WhatsApp  
- O cadastro é automático após o envio do formulário  

📱 *Dúvidas ou suporte:* (13) 97809-0051

Aguardamos com carinho seu cadastro! 💛\n
Para voltar ao menu principal, digite *voltar*.`;

const contribuicao = () => `🔁 *Contribuição Eventual*\n
Muito obrigado por considerar apoiar o *Instituto Eliseu*! Sua contribuição faz toda a diferença para nossos animais. 💛

🏦 *Banco Itaú*  
Agência: 0610  
Conta Corrente: 14295-2  

🏦 *Caixa Econômica Federal*  
Agência: 4140  
Conta Corrente: 002352-0  

💳 *Pix (CNPJ):* 04.024.684/0001-12  

Toda doação é bem-vinda e será usada com muito cuidado para o bem-estar dos nossos bichinhos. 🐶🐱

Para voltar ao menu principal, digite *voltar*.`;

const boleto = () => `📄 *Emissão de Boleto*\n
Para solicitar a emissão ou segunda via de boletos do *Instituto Eliseu*, entre em contato pelo WhatsApp:  
📱 (13) 97809-0051  

Nossa equipe está à disposição para ajudá-lo(a).  
🙏 Agradecemos pela sua confiança e apoio ao nosso trabalho!  

Para voltar ao menu principal, digite *voltar*.`;

const falarFinanceiro = () => `📞 *Falar com o Setor Financeiro*\n
Para tratar de assuntos diretamente relacionados ao setor financeiro do *Instituto Eliseu*, entre em contato pelo WhatsApp:  
📱 (13) 99618-0179  

Nossa equipe está à disposição para ajudá-lo(a).  
🙏 Agradecemos pelo seu contato e confiança!  

Para voltar ao menu principal, digite *voltar*.`;

const notaFiscal = () => `📊 *Nota Fiscal Paulista*\n
Entre em contato com a responsável:  
👩‍💼 Cristiane – 📱 (13) 99138-1061  

🙏 Muito obrigado por apoiar nosso trabalho e confiar no *Instituto Eliseu*!  

Para voltar ao menu principal, digite *voltar*.`;

const ajudaEventual = () => `🧼 *Ajuda Eventual*\n
Muito obrigado pelo carinho com nossos pequeninos! Toda ajuda é bem-vinda.  

Aceitamos doações de:
- Ração para cães ou gatos
- Comida úmida (patê) para filhotes
- Churu (um dos favoritos do Gatinho Eliseu 💛)
- Contribuições financeiras

📦 *Endereço para envio das doações:*  
Rua São Paulo, 120 – Vila Belmiro – Santos/SP  
CEP 11075-330

🙏 A família *Instituto Eliseu* agradece sua generosidade!  

Para voltar ao menu principal, digite *voltar*.`;

const doacaoMateriais = () => `📦 *Doação de Materiais*\n
Muito obrigado por pensar em ajudar nossos animais! 🐾  
Aceitamos doações de materiais diversos que possam contribuir com o bem-estar dos nossos bichinhos.  

📍 *Local para entrega:*  
Rua São Paulo, 120 – Vila Belmiro – Santos/SP  
CEP 11075-330  

Se não for possível entregar, você também pode doar para outra entidade que precise — seu gesto já é muito valioso para nós.  

🙏 A família *Instituto Eliseu* agradece de coração sua colaboração!  

Para voltar ao menu principal, digite *voltar*.`;

const voluntarios = () => `🧍 *Voluntariado*\n
Muito obrigado pelo interesse em se tornar um voluntário do *Instituto Eliseu*! 🐾  

Atualmente, temos três formas de colaboração voluntária:

🐱 *Aconchego Felino*  
Agende um horário para passar 30 minutos no nosso Espaço Baby Cat's, fazendo carinho e brincando com os gatinhos resgatados.  
📱 Contato: (13) 99630-8071

🐶 *Passeio com Cães*  
Voluntários podem agendar horários para passear com nossos cães adultos resgatados.  
📱 Contato: (13) 99610-5629

🧾 *Projeto "Sua Nota Salvando Vidas!"*  
Nos ajude cadastrando notas fiscais no site da Nota Fiscal Paulista, uma das principais fontes de renda do Instituto.  
📱 Contato: (13) 99138-1061

🙏 Agradecemos muito sua disposição e carinho pelos animais!  

Para voltar ao menu principal, digite *voltar*.`;

const enderecoHorario = () => `📍 *Endereço e Horário de Atendimento*\n
Rua São Paulo, 120 – Vila Belmiro  
Santos/SP – CEP 11075-330

🗺️ *Como chegar:* [Clique aqui para abrir no Google Maps](https://www.google.com/maps?q=Rua+São+Paulo,+120,+Vila+Belmiro,+Santos)

🕒 *Horários de Atendimento:*  
- Segunda a sexta-feira: 08h às 17h  
- Sábado: 08h às 12h  
- Domingos e feriados: fechado

🙏 Aguardamos sua visita com muito carinho!  

Para voltar ao menu principal, digite *voltar*.`;

const outrasSolicitacoes = () => `✉️ *Outras Solicitações*\n
Por favor, nos envie as seguintes informações para melhor atendê-lo(a):

- 🏙️ Cidade  
- 🏘️ Bairro  
- 📝 Descrição detalhada da situação

📩 Assim que possível, nossa equipe retornará o contato.  
🙏 Agradecemos pela confiança no Instituto Eliseu!`;

startBot();

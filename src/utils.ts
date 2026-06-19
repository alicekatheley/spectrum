import { PautaGerada } from "./types";

/**
 * Helper to download any string content as a client-side file
 */
export function downloadFile(filename: string, content: string, contentType: string = 'text/plain') {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Compiles a beautiful Markdown text briefing for the pauta
 */
export function generatePautaBriefingText(pauta: PautaGerada): string {
  const isApice = pauta.marca === 'Apice';
  const dataLocal = new Date(pauta.dataCriacao).toLocaleString('pt-BR');
  
  return `===========================================================
PROPOSTA DE PAUTA DE CRM - PLAYBOOK DE CRM HITS
===========================================================
ID DA PAUTA: ${pauta.id}
CONCEITO DE ENVIO: ${pauta.marca}
MÉTODO DE CRIAÇÃO: Modo ${pauta.modo} - ${pauta.modo === 'A' ? 'Descoberta Livre' : 'Briefing Assistido'}
DATA DE GERAÇÃO: ${dataLocal}
STATUS: ${pauta.status.toUpperCase()}
===========================================================

1. REDAÇÃO E COPYWRITING COGNITIVO
-----------------------------------------------------------
[ASSUNTO DO EMAIL]
${pauta.copy.assunto}

[PRÉ-HEADER (INVIOLÁVEL)]
${pauta.copy.preHeader}

[HEADLINE DO BANNER (MECÂNICA)]
${pauta.copy.headlineBanner}

[SUB-HEADLINE DO BANNER]
${pauta.copy.subHeadlineBanner}

[BOTÃO CTA DO BANNER]
${pauta.copy.ctaBotao}


2. BRIEFING COM CREATIVE DESIGNER (ARTE DO BANNER)
-----------------------------------------------------------
[FORMATO]
Quadrado ideal (1:1 aspect ratio) para visualização móvel.

[TIPO DE COMPOSIÇÃO]
GIF Animado de Engajamento em 3 Frames Sequenciais.

[DIRETIVAS DA PALETA: ${pauta.visual.paletaRecomendada.nome.toUpperCase()}]
Cores recomendadas: ${(pauta.visual?.paletaRecomendada?.cores ?? []).join(', ')}

[FILTRO TIPOGRÁFICO MARCA]
${pauta.visual.tipografia}

[ESTILO DA ILUSTRAÇÃO]
${pauta.visual.estiloIlustracao}

[DECUPAGEM DE FRAMES (MECÂNICA: ${pauta.operacional.mecanicaEscolhida})]
- Frame Inicial (F1 - Fechado): ${pauta.visual.frameInicial}
- Frame de Ação (F2 - Transição): ${pauta.visual.frameIntermediario}
- Frame Revelação (F3 - Final): ${pauta.visual.frameFinal}

[POSICIONAMENTO DO CTA]
${pauta.visual.posicaoCta}


3. MOUSE-DASHBOARD & INSTRUÇÕES OPERACIONAIS
-----------------------------------------------------------
[MECÂNICA CENTRAL]
${pauta.operacional.mecanicaEscolhida}

[RECOMPENSA SELECIONADA]
${pauta.operacional.recompensaEscolhida}

[SEMANA E CALENDÁRIO RECOMENDADO]
Melhor Dia de Disparo: ${pauta.operacional.diaRecomendado}
Janela de Disparo Ideal: ${pauta.operacional.horarioRecomendado}

[TARGETING / SEGMENTO ALVO]
Segmento de Audiência: ${pauta.operacional.segmentoRecomendado}

[ANÁLISE E JUSTIFICATIVA DO BANCO RECOLHIDO]
${pauta.operacional.justificativaMecanica}


4. PREVISÕES ANALÍTICAS DE PERFORMANCE
-----------------------------------------------------------
A taxa de faturamento e engajamento foi estimada com base cruzada
através nos hits históricos reais: ${(pauta.previsao?.casesReferencia ?? []).join(', ')}

[TAXA DE ABERTURA ESTIMADA]  ${pauta.previsao.aberturaEsperada}
[CTOR ENVOLVIMENTO MÁXIMO]  ${pauta.previsao.ctorEsperado}
[RECEITA ESTIMADA DO DISPARO]  ${pauta.previsao.receitaEsperada}
[GRAU DE CONFIANÇA DO MODELO]  ${(pauta.previsao?.confianca ?? '').toUpperCase()}
Motivo: ${pauta.previsao.confiancaMotivo || 'N/A'}


5. ANÁLISE DE SEGURANÇA E DIRETIVAS DE SPAM
-----------------------------------------------------------
${pauta.riscos && pauta.riscos.length > 0 
  ? pauta.riscos.map((r, i) => `[RISCO ${i+1}] Campo: ${r.campo} (${(r.nivel ?? '').toUpperCase()})
  Aviso: ${r.mensagem}
  Alternativa sugerida: ${r.alternativaSugerida}`).join('\n\n')
  : 'Excelente! Nenhuma irregularidade identificada contra o playbook de entregabilidade.'
}

===========================================================
© 2026 Playbook CRM Copilot Software. Todos os direitos reservados.
===========================================================`;
}

/**
 * Generates an interactive, responsive, and styled standalone HTML layout file
 * which displays the simulated banner beautifully inside any browser.
 */
export function generateInteractiveHtmlBanner(pauta: PautaGerada): string {
  const isApice = pauta.marca === 'Apice';
  const isEnvelopeMecanica = 
    pauta.operacional.mecanicaEscolhida.toLowerCase().includes("carta") || 
    pauta.operacional.mecanicaEscolhida.toLowerCase().includes("envelope") || 
    pauta.operacional.mecanicaEscolhida.toLowerCase().includes("presente") || 
    pauta.operacional.mecanicaEscolhida.toLowerCase().includes("caixa") ||
    pauta.operacional.mecanicaEscolhida.toLowerCase().includes("papel") ||
    pauta.operacional.mecanicaEscolhida.toLowerCase().includes("balão") ||
    !isApice;

  const headerBg = isApice ? '#325E49' : '#BF0F26';
  const bannerBg = isEnvelopeMecanica ? '#000000' : '#E95B3E';
  
  const hColor = isEnvelopeMecanica ? '#fcd34d' : '#000000';
  const sColor = isEnvelopeMecanica ? '#ffffff' : '#1e293b';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mockup E-mail CRM - ${pauta.marca}</title>
  <style>
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background-color: #f1f5f9;
      margin: 0;
      padding: 40px 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
      color: #334155;
    }
    
    .phone-mockup {
      width: 100%;
      max-width: 420px;
      background-color: #0f172a;
      border-radius: 40px;
      padding: 12px;
      box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
      border: 1px solid #1e293b;
    }

    .email-container {
      background-color: #ffffff;
      border-radius: 30px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      border: 1px solid #e2e8f0;
    }

    .email-header {
      background-color: ${headerBg};
      padding: 24px;
      text-align: center;
      color: #ffffff;
    }

    .brand-title {
      font-size: 28px;
      font-weight: 800;
      margin: 0;
      letter-spacing: -0.5px;
      ${isApice ? "font-family: Georgia, serif; font-style: italic;" : "font-family: Arial, sans-serif; letter-spacing: 2px;"}
    }

    .brand-sub {
      font-size: 9px;
      text-transform: uppercase;
      font-weight: bold;
      letter-spacing: 3px;
      opacity: 0.9;
      margin-top: 4px;
    }

    .banner-container {
      background-color: ${bannerBg};
      aspect-ratio: 1 / 1;
      box-sizing: border-box;
      padding: 24px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      align-items: center;
      text-align: center;
      position: relative;
    }

    .banner-headline {
      margin: 10px 0 0 0;
      font-weight: 900;
      text-transform: uppercase;
      font-size: 24px;
      color: ${hColor};
      ${isEnvelopeMecanica ? "font-family: Georgia, serif; font-style: italic; text-transform: none; color: #fcd34d;" : "font-family: sans-serif;"}
    }

    .banner-subheadline {
      margin: 6px 0 0 0;
      font-weight: 800;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: ${sColor};
    }

    .gift-visual-box {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      width: 100%;
    }

    /* Representação visual estática do Frame do mockup */
    .mockup-item-visual {
      background-color: ${isEnvelopeMecanica ? '#171717' : '#FBF1A9'};
      border: 1px solid ${isEnvelopeMecanica ? '#262626' : '#fef08a'};
      border-radius: ${isEnvelopeMecanica ? '12px' : '4px'};
      width: 160px;
      height: ${isEnvelopeMecanica ? '110px' : '150px'};
      box-shadow: 0 10px 25px rgba(0,0,0,0.3);
      position: relative;
      display: flex;
      justify-content: center;
      align-items: center;
      transform: rotate(2deg);
    }

    .envelope-stamp {
      width: 50px;
      height: 50px;
      border-radius: 55%;
      background: linear-gradient(135deg, #fbbf24, #d97706);
      border: 1px solid #fcd34d;
      color: #78350f;
      display: flex;
      justify-content: center;
      align-items: center;
      font-size: 22px;
    }

    .postit-tack {
      position: absolute;
      top: -8px;
      left: 50%;
      transform: translateX(-50%);
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background-color: #ef4444;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    }

    .postit-text {
      color: #0f172a;
      font-weight: 900;
      text-align: center;
      font-size: 11px;
      line-height: 1.3;
    }

    .banner-cta {
      background-color: #000000;
      color: #ffffff;
      padding: 10px 28px;
      font-size: 11px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 2px;
      cursor: pointer;
      margin-bottom: 8px;
      border: ${isEnvelopeMecanica ? '2px dashed #fcd34d' : 'none'};
      border-radius: ${isEnvelopeMecanica ? '8px' : '0'};
    }

    .email-body {
      padding: 24px;
      background-color: #ffffff;
      font-size: 12px;
      line-height: 1.6;
      color: #475569;
    }

    .email-body p {
      margin: 0 0 16px 0;
    }

    .signature {
      font-weight: bold;
      margin-top: 20px;
      color: #0f172a;
    }

    .signature-brand {
      font-style: italic;
      color: ${headerBg};
      font-size: 14px;
    }

    .email-footer {
      background-color: #efefef;
      padding: 30px 24px;
      text-align: center;
    }

    .brand-badge {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background-color: ${headerBg};
      color: #ffffff;
      display: inline-flex;
      justify-content: center;
      align-items: center;
      font-weight: 900;
      margin-bottom: 12px;
    }

    .meta-footer {
      font-size: 9px;
      color: #64748b;
      line-height: 1.5;
    }

    .download-header {
      background-color: #1e293b;
      color: #ffffff;
      width: 100%;
      max-width: 440px;
      padding: 15px;
      border-radius: 16px;
      margin-bottom: 20px;
      text-align: center;
    }

    .info-tag {
      background: #334155;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: bold;
      margin-top: 10px;
      display: inline-block;
    }
  </style>
</head>
<body>

  <div class="download-header">
    <div style="font-weight: bold; font-size: 14px;">Mockup Interativo de E-mail de CRM</div>
    <div style="font-size: 11px; opacity: 0.8; margin-top: 4px;">Gerado por Inteligência Artificial do Playbook de CRM Hits</div>
    <div class="info-tag">Pauta ID: ${pauta.id.split('-')[1] || pauta.id} (${pauta.marca})</div>
  </div>

  <div class="phone-mockup">
    <div class="email-container">
      
      <!-- Cabeçalho -->
      <div class="email-header">
        <h1 class="brand-title">${isApice ? 'Apice' : 'Barbours'}</h1>
        <div class="brand-sub">${isApice ? 'COSMÉTICOS' : 'BEAUTY'}</div>
      </div>

      <!-- Banner de Email (Mecânica e Recompensa) -->
      <div class="banner-container">
        
        <div>
          <h2 class="banner-headline">${pauta.copy.headlineBanner}</h2>
          <p class="banner-subheadline">${pauta.copy.subHeadlineBanner}</p>
        </div>

        <div class="gift-visual-box">
          <div class="mockup-item-visual">
            ${isEnvelopeMecanica ? `
              <div class="envelope-stamp">🛒</div>
              <div style="position: absolute; bottom: -8px; right: -8px; background-color: #BF0F26; color: white; font-size: 8px; font-weight: bold; border-radius: 20px; padding: 4px 10px; transform: rotate(12deg); border: 1px solid #ef4444;">
                CUPOM M&Aacute;XIMO
              </div>
            ` : `
              <div class="postit-tack"></div>
              <div class="postit-text">
                <span style="font-size: 9px; opacity: 0.8;">LIBERE AT&Ecirc;</span><br>
                <span style="font-size: 18px; color: #ef4444;">3 BRINDES</span><br>
                <span style="font-size: 7px; tracking: 1px;">+ 1 ITEM GR&Aacute;TIS</span>
              </div>
            `}
          </div>
        </div>

        <button class="banner-cta" disabled>${pauta.copy.ctaBotao}</button>

      </div>

      <!-- Corpo da Carta Pessoal -->
      <div class="email-body">
        <p>J&aacute; preparei sua nova surpresa... E tenho certeza que voc&ecirc; n&atilde;o estava esperando algo assim, porque hoje eu trouxe presentes juntos no seu carrinho!</p>
        <p>Me diz se eu não sou a melhor em te presentear. Voc&ecirc; tem at&eacute; 00h para conseguir tudo, <span style="color: #4f46e5; text-decoration: underline; font-weight: bold;">clicando aqui</span>.</p>
        <p>Lembrando que todos os dias, &agrave;s 11h, vou deixar uma nova surpresa no seu e-mail, ent&atilde;o fica atenta para não perder!</p>
        
        <div class="signature">
          <span>Abra&ccedil;os,</span><br>
          <span class="signature-brand">${isApice ? 'Apice' : 'Barbours'}</span>
        </div>
      </div>

      <!-- Rodapé Institucional -->
      <div class="email-footer">
        <div class="brand-badge">${isApice ? 'A' : 'B'}</div>
        <div class="meta-footer">
          &copy; 2026 ${isApice ? 'Apice Cosm&eacute;ticos' : 'Barbours Beauty'}<br>
          Avenida Fernando Ferrari, 2675, Vit&oacute;ria, Brazil, 29075630<br>
          <span style="text-decoration: underline; font-weight: bold; cursor: pointer; display: inline-block; margin-top: 8px;">Cancelar assinatura</span>
        </div>
      </div>

    </div>
  </div>

</body>
</html>`;
}

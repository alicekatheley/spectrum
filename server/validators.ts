export function validateSubjectModoB(boxTituloEmail: string, marca: string): any[] {
  const isApice = marca === 'Apice';
  const riscos: any[] = [];

  const hasPorcento = boxTituloEmail.includes('%');
  const hasOff = boxTituloEmail.toUpperCase().includes('OFF');
  const hasGratis = boxTituloEmail.toUpperCase().includes('GRÁTIS') || boxTituloEmail.toUpperCase().includes('GRATIS');
  const hasRs = boxTituloEmail.includes('R$');
  const hasCaps = boxTituloEmail === boxTituloEmail.toUpperCase() && boxTituloEmail.length > 5;
  const emojiCount = (boxTituloEmail.match(/[\uD800-\uDBFF][\uDC00-\uDFFF]|\p{Emoji_Presentation}|\p{Emoji}️/gu) || []).length;

  const len = boxTituloEmail.length;
  const minLen = isApice ? 27 : 16;
  const maxLen = isApice ? 47 : 39;

  if (hasPorcento || hasOff || hasGratis || hasRs || hasCaps) {
    riscos.push({
      campo: "assunto",
      nivel: "alto",
      mensagem: `O assunto fornecido "${boxTituloEmail}" infringe as diretivas do Playbook CRM, utilizando termos proibidos (ex: %, OFF, GRÁTIS, R$ ou Caps Lock inteiro). Isso reduz sensivelmente a entregabilidade do e-mail nas caixas de entrada e gera risco de aba Promoção.`,
      alternativaSugerida: isApice ? "Use segredos de status ou notificações, ex: 'Seu status foi atualizado 🎁'" : "Use gatilho de sistema pendente, ex: '⚠️ (1) atualização pendente'"
    });
  }
  if (len < minLen || len > maxLen) {
    riscos.push({
      campo: "assunto",
      nivel: "medio",
      mensagem: `O comprimento do assunto (${len} caracteres) fica fora da janela de alto impacto ideal da marca ${marca} (deve ser de ${minLen} a ${maxLen} caracteres).`,
      alternativaSugerida: `Ajuste para conter um tamanho calibrado entre ${minLen} e ${maxLen} caracteres para melhor visualização no mobile.`
    });
  }
  if (emojiCount > 2) {
    riscos.push({
      campo: "assunto",
      nivel: "medio",
      mensagem: `O assunto contém mais de 2 emojis (${emojiCount} emojis dectetados). Isso prejudica a entregabilidade profissional e polui visualmente o preview.`,
      alternativaSugerida: "Utilize no máximo 1 ou 2 emojis temáticos focados no gatilho."
    });
  }

  return riscos;
}

export function sanitizeAssunto(
  assunto: string,
  marca: string,
  existingRiscos: any[],
): { assunto: string; riscos: any[] } {
  const isApice = marca === 'Apice';
  let assuntoLimpo = assunto;

  if (assuntoLimpo === assuntoLimpo.toUpperCase() && assuntoLimpo.length > 5) {
    assuntoLimpo = assuntoLimpo.charAt(0).toUpperCase() + assuntoLimpo.slice(1).toLowerCase();
  }

  const forbiddenWords = ["%", "OFF", "GRÁTIS", "GRATIS", "R$"];
  let containForbidden = false;
  forbiddenWords.forEach(w => {
    if (assuntoLimpo.toUpperCase().includes(w)) {
      containForbidden = true;
      const regex = new RegExp(w.replace('$', '\\$'), 'gi');
      assuntoLimpo = assuntoLimpo.replace(regex, "");
    }
  });

  const riscos = [...existingRiscos];

  if (containForbidden && !riscos.some((r: any) => r.mensagem.includes("termos proibidos"))) {
    riscos.push({
      campo: "assunto",
      nivel: "alto",
      mensagem: "Filtro Automático de Proteção: Foram dectetados termos comerciais de conversão (% ou OFF ou R$ ou GRÁTIS) no assunto gerado. O assunto foi sanitizado para evitar a aba de Promoções ou marcação de Spam e restabelecer a entregabilidade nas principais caixas da caixa de entrada.",
      alternativaSugerida: "Utilize gatilhos baseados em curiosidade ou atualizações de status sem valores de faturamento numérico (ex: 'Presente liberado na sua conta')."
    });
  }

  const finalLen = assuntoLimpo.length;
  const minLen = isApice ? 27 : 16;
  const maxLen = isApice ? 47 : 39;
  if ((finalLen < minLen || finalLen > maxLen) && !riscos.some((r: any) => r.mensagem.includes("comprimento"))) {
    riscos.push({
      campo: "assunto",
      nivel: "medio",
      mensagem: `O assunto proposto (${finalLen} caracteres) foge da faixa ideal recomendada para a marca ${marca} (deve possuir de ${minLen} a ${maxLen} caracteres).`,
      alternativaSugerida: `Ajustar assunto para atingir a zona de impacto visual em dispositivos móveis.`
    });
  }

  return { assunto: assuntoLimpo, riscos };
}

export function sanitizeBannerText(text: string): string {
  const forbiddenWords = ["%", "OFF", "GRÁTIS", "GRATIS", "R$"];
  let result = text;
  forbiddenWords.forEach(w => {
    const regex = new RegExp(w.replace('$', '\\$'), 'gi');
    result = result.replace(regex, "");
  });
  return result.trim();
}

export function risksUnique(arr: any[]): any[] {
  const seen = new Set();
  return arr.filter(item => {
    const k = item.campo + item.mensagem;
    const duplicated = seen.has(k);
    seen.add(k);
    return !duplicated;
  });
}

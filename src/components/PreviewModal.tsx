import { useState } from "react";
import { PautaGerada, PautaCopy } from "../types";
import { X, Download, FileText, Code, Check, Sparkles, Database, Edit3, Clipboard, HelpCircle, AlertTriangle } from "lucide-react";
import BannerSimulador from "./BannerSimulador";
import { downloadFile, generatePautaBriefingText, generateInteractiveHtmlBanner } from "../utils";

interface PreviewModalProps {
  pauta: PautaGerada;
  onClose: () => void;
  onUpdatePauta?: (updated: PautaGerada) => void;
}

export default function PreviewModal({ pauta, onClose, onUpdatePauta }: PreviewModalProps) {
  const [activeTab, setActiveTab] = useState<'visual' | 'edit'>('visual');
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const isApice = pauta.marca === 'Apice';

  // State local para edição em tempo real
  const [editedCopy, setEditedCopy] = useState<PautaCopy>({ ...pauta.copy });

  // Disparar atualização para o pai para que o BannerSimulador atualize ao digito
  const handleFieldChange = (key: keyof PautaCopy, value: string) => {
    const updatedCopy = { ...editedCopy, [key]: value };
    setEditedCopy(updatedCopy);
    
    if (onUpdatePauta) {
      onUpdatePauta({
        ...pauta,
        copy: updatedCopy
      });
    }
  };

  const notifyCopy = (fieldName: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => {
      setCopiedField(null);
    }, 2000);
  };

  const triggerDownloadTxt = () => {
    const text = generatePautaBriefingText(pauta);
    const idStr = pauta.id.split('-')[1] || pauta.id;
    downloadFile(`pauta_crm_${pauta.marca.toLowerCase()}_${idStr}.txt`, text);
  };

  const triggerDownloadHtml = () => {
    const htmlText = generateInteractiveHtmlBanner(pauta);
    const idStr = pauta.id.split('-')[1] || pauta.id;
    downloadFile(`mockup_crm_${pauta.marca.toLowerCase()}_${idStr}.html`, htmlText, "text/html");
  };

  const triggerDownloadJson = () => {
    const rawJson = JSON.stringify(pauta, null, 2);
    const idStr = pauta.id.split('-')[1] || pauta.id;
    downloadFile(`pauta_ia_config_${pauta.marca.toLowerCase()}_${idStr}.json`, rawJson, "application/json");
  };

  // Real-time Playbook Validation for the edited copywriting
  const validationAlerts: string[] = [];
  const minLen = isApice ? 27 : 16;
  const maxLen = isApice ? 47 : 39;
  const originalAssunto = editedCopy.assunto || "";

  if (originalAssunto === originalAssunto.toUpperCase() && originalAssunto.length > 5) {
    validationAlerts.push("⚠️ O assunto está totalmente em Caps Lock, infringindo as diretivas da marca.");
  }
  const forbiddenWords = ["%", "OFF", "GRÁTIS", "GRATIS", "R$"];
  forbiddenWords.forEach(w => {
    if (originalAssunto.toUpperCase().includes(w)) {
      validationAlerts.push(`⚠️ Termo proibido de entregabilidade detectado: "${w}". Isso aumentará as chances de ir para a caixa de Spam.`);
    }
  });
  if (originalAssunto.length < minLen || originalAssunto.length > maxLen) {
    validationAlerts.push(`⚠️ Comprimento do assunto (${originalAssunto.length} caracteres) fora da janela de impacto recomendada de ${minLen} a ${maxLen} caracteres.`);
  }

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto backdrop-blur-md bg-slate-950/80 animate-fade-in text-left select-none"
      id="preview-popup-overlay"
    >
      <div 
        id="preview-popup-content-box"
        className="relative bg-slate-900 border border-slate-800 rounded-[2rem] w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col md:max-h-[90vh]"
      >
        {/* Banner Decorativo no Topo do Modal dependendo da marca */}
        <div 
          className="h-2.5 w-full shrink-0" 
          style={{ backgroundColor: isApice ? '#688D65' : '#BF0F26' }}
        ></div>

        {/* Modal Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-6 border-b border-slate-800 bg-slate-900/90 z-10 shrink-0 gap-4">
          <div className="flex items-center gap-3">
            <span className={`p-2 rounded-xl flex items-center justify-center bg-indigo-500/10 text-indigo-300`}>
              <Sparkles className="w-5 h-5" />
            </span>
            <div className="text-left">
              <span className="text-[10px] font-black tracking-widest text-[#AA834B] uppercase block">
                Visualização de Disparo Ativo
              </span>
              <h2 className="text-lg font-bold text-slate-100">
                Pauta CRM de {pauta.marca}
              </h2>
            </div>
          </div>
          
          {/* Seletor de Sub-Abas de Edição Rápida */}
          <div className="flex items-center gap-2">
            <div className="bg-slate-950 rounded-xl p-1 border border-slate-800 flex text-xs">
              <button
                id="btn-tab-preview-visual"
                onClick={() => setActiveTab('visual')}
                className={`px-3 py-1.5 rounded-lg font-bold tracking-wider uppercase transition-all cursor-pointer ${
                  activeTab === 'visual'
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Visualizar Mockup
              </button>
              <button
                id="btn-tab-preview-editor"
                onClick={() => setActiveTab('edit')}
                className={`px-3 py-1.5 rounded-lg font-bold tracking-wider uppercase transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'edit'
                    ? 'bg-indigo-650 text-indigo-200'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                style={{ backgroundColor: activeTab === 'edit' ? '#4f46e5' : '' }}
              >
                <Edit3 className="w-3.5 h-3.5" />
                Editar Copy
              </button>
            </div>

            <button 
              onClick={onClose}
              id="close-popup-btn"
              className="p-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
              title="Fechar Visualização"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Container */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Coluna Esquerda: Simulador Animado da Pauta */}
            <div className="lg:col-span-5 flex flex-col gap-4 text-center">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-1">
                Visualização do GIF de E-mail CRM
              </span>
              
              <BannerSimulador
                brand={pauta.marca}
                headline={editedCopy.headlineBanner}
                subHeadline={editedCopy.subHeadlineBanner}
                cta={editedCopy.ctaBotao}
                mecanicaText={pauta.operacional.mecanicaEscolhida}
                recompensa={pauta.operacional.recompensaEscolhida}
                paleta={pauta.visual.paletaRecomendada}
                estiloIlustracao={pauta.visual.estiloIlustracao}
              />
            </div>

            {/* Coluna Direita: Informações Gerais dependendo da Tab selecionada */}
            <div className="lg:col-span-7 flex flex-col gap-6 text-left">
              
              {activeTab === 'visual' ? (
                <>
                  {/* Bloco de Copy Estático com Botão de Cópia Unificada */}
                  <div className="bg-slate-950/40 p-5 rounded-2xl border border-slate-800">
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="text-xs uppercase font-extrabold tracking-widest text-[#AA834B] flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                        Redação e Textos Ativos do Email
                      </h4>
                      <span className="text-[10px] text-slate-500 font-bold leading-none">clique no ícone para copiar</span>
                    </div>
                    
                    <div className="flex flex-col gap-3.5 text-xs">
                      
                      {/* Assunto */}
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-slate-400 font-bold">Assunto do E-mail</span>
                          <button
                            id="btn-copy-subject"
                            onClick={() => notifyCopy('assunto', editedCopy.assunto)}
                            className="p-1 text-slate-400 hover:text-emerald-400 transition-colors flex items-center gap-1 cursor-pointer"
                            title="Copiar Assunto"
                          >
                            {copiedField === 'assunto' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Clipboard className="w-3.5 h-3.5" />}
                            <span className="text-[9px] uppercase font-bold">{copiedField === 'assunto' ? 'Copiado!' : 'Copiar'}</span>
                          </button>
                        </div>
                        <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-slate-200 font-semibold leading-relaxed">
                          {editedCopy.assunto}
                        </div>
                      </div>

                      {/* PréHeader */}
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-slate-400 font-bold">Pré-Header Fixo (Inviolável)</span>
                          <button
                            id="btn-copy-preheader"
                            onClick={() => notifyCopy('preheader', editedCopy.preHeader)}
                            className="p-1 text-slate-400 hover:text-emerald-400 transition-colors flex items-center gap-1 cursor-pointer"
                            title="Copiar Préheader"
                          >
                            {copiedField === 'preheader' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Clipboard className="w-3.5 h-3.5" />}
                            <span className="text-[9px] uppercase font-bold">{copiedField === 'preheader' ? 'Copiado!' : 'Copiar'}</span>
                          </button>
                        </div>
                        <div className="p-3 bg-slate-900/60 border border-slate-800/80 rounded-xl text-slate-400 font-medium italic">
                          "{editedCopy.preHeader}"
                        </div>
                      </div>

                      {/* Banner Text metrics */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-slate-400 font-bold">Headline da Arte</span>
                            <button
                              id="btn-copy-headline"
                              onClick={() => notifyCopy('headlineBanner', editedCopy.headlineBanner)}
                              className="p-1 text-slate-400 hover:text-emerald-400 transition-colors flex items-center gap-1 cursor-pointer"
                              title="Copiar Headline"
                            >
                              {copiedField === 'headlineBanner' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Clipboard className="w-3.5 h-3.5" />}
                              <span className="text-[9px] uppercase font-bold">{copiedField === 'headlineBanner' ? 'Copiado!' : 'Copiar'}</span>
                            </button>
                          </div>
                          <div className="p-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-200 font-bold uppercase truncate" title={editedCopy.headlineBanner}>
                            {editedCopy.headlineBanner}
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-slate-400 font-bold">Botão CTA</span>
                            <button
                              id="btn-copy-cta"
                              onClick={() => notifyCopy('ctaBotao', editedCopy.ctaBotao)}
                              className="p-1 text-slate-400 hover:text-emerald-400 transition-colors flex items-center gap-1 cursor-pointer"
                              title="Copiar CTA"
                            >
                              {copiedField === 'ctaBotao' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Clipboard className="w-3.5 h-3.5" />}
                              <span className="text-[9px] uppercase font-bold">{copiedField === 'ctaBotao' ? 'Copiado!' : 'Copiar'}</span>
                            </button>
                          </div>
                          <div className="p-2 bg-slate-900 border border-slate-800 rounded-xl text-amber-400 font-semibold text-center font-mono">
                            {editedCopy.ctaBotao}
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>
                </>
              ) : (
                /* Aba de Edição direta em tempo real (Point 2) */
                <div className="bg-slate-950/60 p-5 rounded-2xl border border-slate-800 flex flex-col gap-4 animate-fade-in">
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs uppercase font-extrabold tracking-widest text-[#AA834B] flex items-center gap-1.5 animate-pulse">
                      <Edit3 className="w-4 h-4 text-indigo-400" />
                      Editor de Copywriting do Copilot (Tempo Real)
                    </h4>
                    <span className="text-[10px] bg-slate-900 font-bold text-slate-400 px-2 py-1 rounded">Visualização se atualiza ao vivo</span>
                  </div>

                  <p className="text-xs text-slate-400 leading-normal mb-1">
                    Ajuste os textos abaixo para calibrar o mockup do email. Suas edições atualizam a imagem e o arquivo de download automaticamente!
                  </p>

                  <div className="flex flex-col gap-4 text-xs">
                    
                    {/* Campo Assunto */}
                    <div className="flex flex-col gap-1">
                      <div className="flex justify-between font-bold">
                        <label className="text-slate-300">Assunto do E-mail</label>
                        <span className={`text-[10px] ${
                          originalAssunto.length > maxLen || originalAssunto.length < minLen 
                            ? 'text-amber-400' 
                            : 'text-emerald-300'
                        }`}>
                          {originalAssunto.length} / {maxLen} caract.
                        </span>
                      </div>
                      <input
                        type="text"
                        id="input-inline-editor-assunto"
                        value={editedCopy.assunto}
                        onChange={(e) => handleFieldChange('assunto', e.target.value)}
                        className="p-3 bg-slate-900 border border-slate-700 hover:border-slate-600 rounded-xl focus:border-indigo-500 text-slate-100 font-semibold outline-none transition-all"
                        placeholder="Digite o assunto..."
                      />
                    </div>

                    {/* Campo Pré-Header Fixo Aviso */}
                    <div className="flex flex-col gap-1">
                      <label className="text-slate-400 font-bold">Pré-Header Fixo (Inviolável / Não editável)</label>
                      <input
                        type="text"
                        disabled
                        value={editedCopy.preHeader}
                        className="p-3 bg-slate-900/40 border border-slate-800 text-slate-500 rounded-xl italic cursor-not-allowed leading-relaxed"
                      />
                      <span className="text-[9px] text-slate-500 tracking-wide font-medium">Assegura o maior fluxo de abertura do playbook por curiosidade móvel</span>
                    </div>

                    {/* Grid Headline Banner e CTA */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      
                      <div className="flex flex-col gap-1">
                        <label className="text-slate-300 font-bold">Headline do Banner</label>
                        <input
                          type="text"
                          id="input-inline-editor-headline"
                          value={editedCopy.headlineBanner}
                          onChange={(e) => handleFieldChange('headlineBanner', e.target.value)}
                          className="p-3 bg-slate-900 border border-slate-700 hover:border-slate-600 rounded-xl focus:border-indigo-500 text-white font-extrabold outline-none transition-all uppercase"
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-slate-300 font-bold">Verbo CTA do Botão</label>
                        <input
                          type="text"
                          id="input-inline-editor-cta"
                          value={editedCopy.ctaBotao}
                          onChange={(e) => handleFieldChange('ctaBotao', e.target.value)}
                          className="p-3 bg-slate-900 border border-slate-700 hover:border-slate-600 rounded-xl focus:border-indigo-500 text-amber-300 font-black tracking-widest font-mono text-center outline-none transition-all uppercase"
                        />
                      </div>

                    </div>

                    {/* Sub-headline do banner */}
                    <div className="flex flex-col gap-1">
                      <label className="text-slate-300 font-bold">Sub-headline Detalhes da Oferta</label>
                      <input
                        type="text"
                        id="input-inline-editor-subheadline"
                        value={editedCopy.subHeadlineBanner}
                        onChange={(e) => handleFieldChange('subHeadlineBanner', e.target.value)}
                        className="p-3 bg-slate-900 border border-slate-700 hover:border-slate-600 rounded-xl focus:border-indigo-500 text-slate-200 font-bold outline-none transition-all"
                      />
                    </div>

                    {/* Alertas de validação instantâneos */}
                    {validationAlerts.length > 0 && (
                      <div className="mt-2 bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl flex flex-col gap-1.5 text-amber-300 transition-all">
                        <span className="font-extrabold flex items-center gap-1.5 uppercase text-[10px] tracking-wider leading-none">
                          <AlertTriangle className="w-4 h-4 text-amber-400" />
                          Calibração de Regras Invioláveis do CRM
                        </span>
                        <div className="flex flex-col gap-1 font-semibold leading-relaxed">
                          {validationAlerts.map((alertMessage, i) => (
                            <p key={i} className="text-[10px]">{alertMessage}</p>
                          ))}
                        </div>
                      </div>
                    )}

                  </div>
                </div>
              )}

              {/* Bloco de Metadados Críticos */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 bg-slate-950/40 border border-slate-800 rounded-2xl text-xs">
                  <span className="text-slate-500 uppercase font-bold tracking-wider block mb-1">Mecânica Operacional</span>
                  <span className="font-extrabold text-slate-200 text-sm block truncate">{pauta.operacional.mecanicaEscolhida}</span>
                  <span className="text-[10px] text-slate-400 block mt-1">Recompensa: {pauta.operacional.recompensaEscolhida}</span>
                </div>
                
                <div className="p-4 bg-slate-950/40 border border-slate-800 rounded-2xl text-xs">
                  <span className="text-slate-500 uppercase font-bold tracking-wider block mb-1">Performance Esperada</span>
                  <span className="font-extrabold text-emerald-400 text-sm block">Receita: {pauta.previsao.receitaEsperada}</span>
                  <span className="text-[10px] text-slate-400 block mt-1">Abertura: {pauta.previsao.aberturaEsperada}</span>
                </div>
              </div>

              {/* Central de Exportação e Downloads (Point 3) */}
              <div className="bg-[#AA834B]/5 border border-[#AA834B]/20 p-5 rounded-2xl">
                <div className="flex items-center gap-2 mb-3">
                  <Download className="w-4 h-4 text-[#AA834B]" />
                  <h4 className="text-xs uppercase font-extrabold tracking-widest text-[#AA834B]">
                    Central de Exportação e Download
                  </h4>
                </div>

                <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                  Baixe a pauta de CRM para integrá-la às suas plataformas de envio de email ou encaminhe os briefings de layouts criados diretamente para sua equipe de design!
                </p>

                <div className="flex flex-col sm:flex-row gap-3">
                  {/* Botão de download do Briefing de texto */}
                  <button
                    id="download-briefing-txt-btn-modal"
                    onClick={triggerDownloadTxt}
                    className="flex-1 py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer border border-slate-750 shadow"
                  >
                    <FileText className="w-4 h-4 text-emerald-400" />
                    Baixar Briefing (TXT)
                  </button>

                  {/* Botão de download da Arte Interativa em HTML */}
                  <button
                    id="download-mockup-html-btn-modal"
                    onClick={triggerDownloadHtml}
                    className="flex-1 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow"
                  >
                    <Code className="w-4 h-4 text-amber-200" />
                    Baixar Arte (HTML)
                  </button>

                  {/* Botão de download do JSON */}
                  <button
                    id="download-pauta-json-btn-modal"
                    onClick={triggerDownloadJson}
                    className="py-3 px-4 bg-slate-950/60 hover:bg-slate-900 text-slate-400 hover:text-slate-250 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer border border-slate-850"
                    title="Exportar Configuração raw em JSON"
                  >
                    <Database className="w-4 h-4" />
                    JSON
                  </button>
                </div>
              </div>

            </div>

          </div>
        </div>

        {/* Modal Footer */}
        <div className="shrink-0 p-6 border-t border-slate-800 bg-slate-950/50 flex justify-end">
          <button
            onClick={onClose}
            id="close-popup-footer-btn"
            className="py-2.5 px-6 bg-slate-800 hover:bg-slate-700 text-slate-350 hover:text-slate-100 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
          >
            Fechar Visualização
          </button>
        </div>

      </div>
    </div>
  );
}

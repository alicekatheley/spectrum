import { useEffect, useState } from "react";
import { Trash2, X } from "lucide-react";
import { CalendarioGerado, CalendarioSlot } from "../../types";
import {
  EdicaoSlot,
  chaveSlot,
  familiasDisponiveis,
  familiasOcupadas,
  horasOcupadas,
} from "../../utils/editarCalendario";
import { DIA_CURTO, formatarData, formatarEnvios, formatarMoeda, formatarRpm } from "./formato";

// Painel que abre ao clicar num card. Duas funções, nesta ordem: mostrar o que o modelo prevê
// para aquele slot, e deixar mudar o que o time precisar mudar.
//
// A parte que exige cuidado é a segunda. Editar é fácil; o difícil é editar sem que a tela
// passe a mentir. Cada campo aqui carrega a nota do que a edição faz — e três deles não fazem
// nada com a receita, porque hora e oferta transferiram a 0,00 no walk-forward (§4.5). Essa é
// a informação mais útil do painel: mover um disparo das 20h para as 15h é decisão operacional
// legítima, e o modelo não tem base para dizer que ela ganha ou perde dinheiro. Escrever
// "previsão inalterada" é mais honesto — e mais respeitoso com quem decide — do que fabricar
// um delta para o campo parecer importante.

const CAMPO =
  'w-full bg-[var(--shell-bg)] border border-[var(--shell-border)] rounded-lg px-3 py-2 text-sm text-[var(--shell-text)] focus:outline-none focus:border-indigo-500/60 transition-colors';
const LABEL = 'text-[10px] font-mono uppercase tracking-widest text-[var(--shell-text-muted)]';
const NOTA = 'text-[11px] text-[var(--shell-text-muted)] leading-relaxed';

interface EditorSlotProps {
  calendario: CalendarioGerado;
  slot: CalendarioSlot;
  onAplicar: (edicao: EdicaoSlot) => void;
  onRemover: () => void;
  onFechar: () => void;
  erro: string | null;
}

export default function EditorSlot({
  calendario,
  slot,
  onAplicar,
  onRemover,
  onFechar,
  erro,
}: EditorSlotProps) {
  const chave = chaveSlot(slot);
  const [hora, setHora] = useState(String(slot.hora));
  const [oferta, setOferta] = useState(slot.oferta);
  const [familia, setFamilia] = useState(slot.familia);
  const [envios, setEnvios] = useState(String(slot.enviosPlanejados));

  // Trocar de card sem fechar o painel precisa recarregar o formulário — senão o painel
  // mostraria o slot novo no cabeçalho e os valores do anterior nos campos.
  useEffect(() => {
    setHora(String(slot.hora));
    setOferta(slot.oferta);
    setFamilia(slot.familia);
    setEnvios(String(slot.enviosPlanejados));
  }, [chave, slot.hora, slot.oferta, slot.familia, slot.enviosPlanejados]);

  const ocupadas = horasOcupadas(calendario, slot.data, chave);
  const familiasNoDia = familiasOcupadas(calendario, slot.data, chave);
  const familias = familiasDisponiveis(calendario);

  const alterado =
    Number(hora) !== slot.hora ||
    oferta.trim() !== slot.oferta ||
    familia !== slot.familia ||
    Number(envios) !== slot.enviosPlanejados;

  const trocouFamilia = familia !== slot.familia;
  const trocouEnvios = Number(envios) !== slot.enviosPlanejados;

  return (
    <div className="rounded-2xl border border-indigo-500/40 bg-[var(--shell-panel-soft)] p-5 flex flex-col gap-5">

      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <span className={LABEL}>
            {DIA_CURTO[slot.diaSemana]} · {formatarData(slot.data)} · {slot.slot}º disparo do dia
          </span>
          <h3 className="text-lg font-bold text-[var(--shell-text)] leading-tight">{slot.oferta}</h3>
        </div>
        <button
          onClick={onFechar}
          title="Fechar"
          className="shrink-0 p-1.5 rounded-lg text-[var(--shell-text-muted)] hover:text-[var(--shell-text)] hover:bg-[var(--shell-border)] transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* ── O que o modelo prevê ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 @xl:grid-cols-4 gap-3">
        <div className="flex flex-col gap-0.5">
          <span className={LABEL}>Receita esperada</span>
          <span className="text-base font-bold text-[var(--shell-text)]">
            {formatarMoeda(slot.receitaPrevista)}
          </span>
          <span className="text-[10px] font-mono text-[var(--shell-text-muted)] opacity-70">
            IC80 {formatarMoeda(slot.confianca.ic80[0])} – {formatarMoeda(slot.confianca.ic80[1])}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className={LABEL}>Eficiência esperada</span>
          <span className="text-base font-bold text-[var(--shell-text)]">
            {formatarRpm(slot.rpmPrevisto)}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className={LABEL}>Família (fadiga)</span>
          <span className="text-base font-bold text-[var(--shell-text)]">{slot.familia}</span>
          <span className="text-[10px] font-mono text-[var(--shell-text-muted)] opacity-70">
            I2 {slot.indices.familia.toLocaleString('pt-BR')} · agressividade {slot.agressividade}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className={LABEL}>Envios planejados</span>
          <span className="text-base font-bold text-[var(--shell-text)]">
            {formatarEnvios(slot.enviosPlanejados)}
          </span>
          <span className="text-[10px] font-mono text-[var(--shell-text-muted)] opacity-70">
            desde o último {slot.familia}: {slot.gapFamiliaH >= 999 ? '—' : `${slot.gapFamiliaH}h`}
          </span>
        </div>
      </div>

      {!slot.confianca.validado && (
        <p className="text-[11px] text-amber-400 border border-amber-500/30 bg-amber-500/10 rounded-lg px-3 py-2 leading-relaxed">
          3º disparo do dia: o efeito não sobreviveu à validação fora da amostra (I7 = 96, IC
          contendo 100). Entra no plano como hipótese, não como compromisso — a receita acima é
          uma estimativa sem lastro validado.
        </p>
      )}

      {/* ── Edição ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 border-t border-[var(--shell-border)] pt-4">
        <span className={LABEL}>Editar este disparo</span>

        <div className="grid grid-cols-1 @xl:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="editor-hora" className={LABEL}>Horário</label>
            <select
              id="editor-hora"
              value={hora}
              onChange={(e) => setHora(e.target.value)}
              className={`${CAMPO} cursor-pointer`}
            >
              {Array.from({ length: 24 }, (_, h) => h).map((h) => (
                <option key={h} value={h} disabled={ocupadas.has(h) && h !== slot.hora}>
                  {String(h).padStart(2, '0')}h{ocupadas.has(h) && h !== slot.hora ? ' — ocupado' : ''}
                </option>
              ))}
            </select>
            <p className={NOTA}>
              Reordena o dia. Não muda a previsão: o índice de hora transferiu a 0,00 no
              walk-forward — o modelo não sabe dizer que um horário rende mais que o outro.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="editor-oferta" className={LABEL}>Oferta</label>
            <input
              id="editor-oferta"
              type="text"
              value={oferta}
              onChange={(e) => setOferta(e.target.value)}
              className={CAMPO}
            />
            <p className={NOTA}>
              Texto livre. Dentro da mesma família também não muda a previsão — I4 transferiu a
              0,00. Quem carrega o efeito medido é a família, abaixo.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="editor-familia" className={LABEL}>Família</label>
            <select
              id="editor-familia"
              value={familia}
              onChange={(e) => setFamilia(e.target.value)}
              className={`${CAMPO} cursor-pointer`}
            >
              {familias.map(({ nome, indice }) => (
                <option key={nome} value={nome} disabled={familiasNoDia.has(nome)}>
                  {nome} (I2 {indice.toLocaleString('pt-BR')})
                  {familiasNoDia.has(nome) ? ' — já usada hoje' : ''}
                </option>
              ))}
            </select>
            <p className={NOTA}>
              A única troca qualitativa que move a receita (coeficiente 0,52). Famílias já usadas
              no dia ficam bloqueadas — H2 é rígida e a edição não a fura.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="editor-envios" className={LABEL}>Envios planejados</label>
            <input
              id="editor-envios"
              type="text"
              inputMode="numeric"
              value={envios}
              onChange={(e) => setEnvios(e.target.value.replace(/\D/g, ''))}
              className={CAMPO}
            />
            <p className={NOTA}>
              Reprecifica o dia inteiro, não só este slot: o retorno decrescente vem de esgotar a
              mesma base, então mudar o volume aqui mexe no R$/mil dos outros disparos do dia.
            </p>
          </div>
        </div>

        {(trocouFamilia || trocouEnvios) && (
          <p className="text-[11px] text-indigo-300 border border-indigo-500/30 bg-indigo-500/10 rounded-lg px-3 py-2 leading-relaxed">
            {trocouFamilia && 'Trocar de família recalcula a receita deste slot pelo índice I2. '}
            {trocouEnvios && 'Mudar o volume recalcula a receita de todos os disparos deste dia pela elasticidade α = 0,31. '}
            A previsão do período é atualizada; a decomposição não — ela descreve como o modelo
            chegou ao plano original, e reescrevê-la seria creditar a ele uma decisão sua.
          </p>
        )}

        {erro && (
          <p className="text-[11px] text-amber-400 border border-amber-500/30 bg-amber-500/10 rounded-lg px-3 py-2">
            {erro}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            id="editor-btn-aplicar"
            onClick={() =>
              onAplicar({
                hora: Number(hora),
                oferta,
                familia,
                enviosPlanejados: Number(envios) || slot.enviosPlanejados,
              })
            }
            disabled={!alterado}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/30 disabled:cursor-not-allowed text-white font-bold text-sm px-5 py-2.5 rounded-xl transition-all cursor-pointer"
          >
            Aplicar alteração
          </button>
          <button
            id="editor-btn-remover"
            onClick={onRemover}
            title="Tira o disparo do plano — o volume dele não é redistribuído"
            className="flex items-center gap-2 text-[var(--shell-text-muted)] hover:text-red-400 text-sm font-semibold px-3 py-2.5 rounded-xl transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            Remover disparo
          </button>
        </div>
      </div>
    </div>
  );
}

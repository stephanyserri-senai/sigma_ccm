import { useEffect, useMemo } from 'react';
import { Check, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { LETRAS, PAGINA, RAIO_BOLHA, layoutQuestoes } from '../layout';
import { calcularPontuacao } from '../correcao';
import { nomePorMatricula } from '../processar';
import type { FolhaCorrigida, Gabarito, Letra, LeituraQuestao } from '../types';

interface Props {
  gabarito: Gabarito;
  folha: FolhaCorrigida;
  indice: number;
  total: number;
  onNavegar: (delta: number) => void;
  onAlterar: (f: FolhaCorrigida) => void;
  onFechar: () => void;
}

const ROTULO_SITUACAO: Record<string, string> = { acerto: 'Acerto', erro: 'Erro', branco: 'Em branco', multipla: 'Múltipla', anulada: 'Anulada' };

export function Revisao({ gabarito: g, folha: f, indice, total, onNavegar, onAlterar, onFechar }: Props) {
  const p = useMemo(() => calcularPontuacao(g, f.leituras), [g, f.leituras]);
  const layout = useMemo(() => layoutQuestoes(g.numQuestoes, g.numAlternativas), [g.numQuestoes, g.numAlternativas]);
  const alts = LETRAS.slice(0, g.numAlternativas);
  const alinhada = f.status !== 'erro' || f.recorteNome !== null;

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (e.key === 'Escape') onFechar();
      if (e.key === 'ArrowRight' || e.key === 'PageDown') onNavegar(1);
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') onNavegar(-1);
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [onFechar, onNavegar]);

  const definir = (i: number, nova: Pick<LeituraQuestao, 'resposta' | 'situacao'>) =>
    onAlterar({ ...f, leituras: f.leituras.map((l, j) => (j === i ? { ...l, ...nova, editadaManualmente: true } : l)) });

  const confirmar = () => {
    onAlterar({ ...f, status: 'ok', revisadaManualmente: true, leituras: f.leituras.map((l) => (l.situacao === 'duvida' ? { ...l, situacao: l.resposta ? 'ok' : 'branco', editadaManualmente: true } : l)) });
    if (indice < total - 1) onNavegar(1);
  };

  const pendentes = f.leituras.filter((l) => !l.editadaManualmente && (l.situacao === 'duvida' || l.situacao === 'multipla')).length;

  return (
    <div className="modal-fundo" onClick={onFechar}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Revisão da folha">
        <header className="modal-topo">
          <div>
            <strong>
              Folha {indice + 1} de {total}
            </strong>
            <span className="arquivo">
              {f.arquivo} · página {f.pagina}
            </span>
          </div>
          <div className="acoes">
            <button className="btn" onClick={() => onNavegar(-1)} disabled={indice === 0}>
              <ChevronLeft size={16} /> Anterior
            </button>
            <button className="btn" onClick={() => onNavegar(1)} disabled={indice >= total - 1}>
              Próxima <ChevronRight size={16} />
            </button>
            <button className="btn icone" onClick={onFechar} aria-label="Fechar">
              <X size={18} />
            </button>
          </div>
        </header>

        <div className="modal-corpo">
          <div className="visual-folha">
            {f.imagem ? (
              <div className="folha-img">
                <img src={f.imagem} alt="Folha digitalizada" />
                {alinhada && (
                  <svg viewBox={`0 0 ${PAGINA.largura} ${PAGINA.altura}`} preserveAspectRatio="none">
                    {layout.map((q, i) => {
                      const r = p.porQuestao[i];
                      return q.bolhas.map((b, a) => {
                        const letra = alts[a];
                        const ehCorreta = g.respostas[i] === letra && !g.anuladas[i];
                        const marcada = f.leituras[i]?.resposta === letra;
                        const duvida = f.leituras[i]?.situacao === 'duvida' || f.leituras[i]?.situacao === 'multipla';
                        if (!ehCorreta && !marcada && !(duvida && (f.leituras[i]?.preenchimento[a] ?? 0) > 0.2)) return null;
                        const cor = duvida && !f.leituras[i]?.editadaManualmente ? '#f5a400' : marcada ? (r.situacao === 'acerto' ? '#16a34a' : '#E30613') : '#16a34a';
                        return (
                          <circle
                            key={`${i}-${a}`}
                            cx={b.x}
                            cy={b.y}
                            r={RAIO_BOLHA + 0.9}
                            fill="none"
                            stroke={cor}
                            strokeWidth={marcada ? 0.8 : 0.5}
                            strokeDasharray={!marcada && ehCorreta ? '1 0.7' : undefined}
                          />
                        );
                      });
                    })}
                  </svg>
                )}
              </div>
            ) : (
              <div className="sem-imagem">Arquivo não pôde ser aberto.</div>
            )}
            <p className="legenda">
              <i className="lg verde" /> acerto <i className="lg vermelho" /> marcada errada <i className="lg tracejado" /> resposta correta <i className="lg amarelo" /> dúvida
            </p>
          </div>

          <div className="painel-revisao">
            {f.mensagens.length > 0 && (
              <ul className={`mensagens ${f.status}`}>
                {f.mensagens.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            )}
            <div className="dados-aluno">
              <label className="campo">
                <span>Nome do aluno</span>
                <input value={f.nome} onChange={(e) => onAlterar({ ...f, nome: e.target.value })} />
              </label>
              <label className="campo curto">
                <span>Matrícula</span>
                <input
                  value={f.matricula}
                  onChange={(e) => {
                    const m = e.target.value.replace(/\D/g, '');
                    onAlterar({ ...f, matricula: m, nome: f.nome || nomePorMatricula(g, m) });
                  }}
                />
              </label>
              {f.recorteNome && <img className="recorte-grande" src={f.recorteNome} alt="Nome escrito" />}
            </div>
            <div className="placar">
              <div>
                <span>Acertos</span>
                <strong>
                  {p.acertos}/{g.numQuestoes - p.anuladas}
                </strong>
              </div>
              <div>
                <span>Nota</span>
                <strong>{p.nota.toFixed(2)}</strong>
              </div>
              <div>
                <span>Brancos / múltiplas</span>
                <strong>
                  {p.brancos} / {p.multiplas}
                </strong>
              </div>
            </div>

            <div className="lista-questoes">
              {f.leituras.map((l, i) => {
                const r = p.porQuestao[i];
                const duvida = !l.editadaManualmente && (l.situacao === 'duvida' || l.situacao === 'multipla');
                return (
                  <div key={i} className={`q-linha res-${r.situacao} ${duvida ? 'duvida' : ''}`}>
                    <span className="num">{i + 1}</span>
                    <div className="bolhas">
                      {alts.map((letra, a) => (
                        <button
                          key={letra}
                          className={`bolha ${l.resposta === letra ? 'marcada' : ''} ${g.respostas[i] === letra ? 'correta' : ''}`}
                          title={l.preenchimento.length ? `Preenchimento lido: ${Math.round((l.preenchimento[a] ?? 0) * 100)}%` : undefined}
                          onClick={() => definir(i, l.resposta === letra && l.situacao !== 'multipla' ? { resposta: null, situacao: 'branco' } : { resposta: letra as Letra, situacao: 'ok' })}
                        >
                          {letra}
                          {l.preenchimento.length > 0 && <i style={{ height: `${Math.round((l.preenchimento[a] ?? 0) * 100)}%` }} />}
                        </button>
                      ))}
                      <button className={`bolha extra ${l.situacao === 'multipla' ? 'marcada' : ''}`} title="Mais de uma alternativa marcada (vale zero)" onClick={() => definir(i, { resposta: null, situacao: 'multipla' })}>
                        ∗
                      </button>
                    </div>
                    <span className="tag">{duvida ? (l.situacao === 'multipla' ? 'Múltipla?' : 'Dúvida') : ROTULO_SITUACAO[r.situacao]}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <footer className="modal-rodape">
          <span>{pendentes ? `${pendentes} questão(ões) aguardando conferência` : 'Nenhuma pendência de leitura'}</span>
          <button className="btn primario" onClick={confirmar}>
            <Check size={16} /> Confirmar revisão{indice < total - 1 ? ' e ir para a próxima' : ''}
          </button>
        </footer>
      </div>
    </div>
  );
}

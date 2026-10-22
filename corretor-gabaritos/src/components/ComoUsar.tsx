export function ComoUsar() {
  return (
    <div className="ajuda card">
      <h2>Como usar</h2>
      <ol className="passos">
        <li>
          <strong>Cadastre o gabarito matriz.</strong> Em <em>Gabaritos</em>, clique em <em>Novo gabarito</em>, informe o nome da prova, o número de questões (até 60) e marque a
          resposta correta de cada uma. Você pode colar a sequência (ex.: <code>ABCDAEBC…</code>), definir pesos e anular questões.
        </li>
        <li>
          <strong>Imprima a folha de respostas.</strong> Use <em>Baixar folha de respostas (PDF)</em> e imprima em A4, em escala 100% (sem "ajustar à página"). Os quatro
          quadrados pretos dos cantos são usados para alinhar a leitura — não podem ser cortados nem rabiscados.
        </li>
        <li>
          <strong>Aplique a prova.</strong> O aluno escreve o nome, preenche a matrícula (escreve e marca os números) e pinta totalmente a bolha de cada resposta com caneta azul
          ou preta.
        </li>
        <li>
          <strong>Digitalize.</strong> Escâner (recomendado, 150 a 300 dpi, PDF com várias páginas) ou foto de celular de cima, com boa luz e a folha inteira aparecendo. A
          folha pode estar de ponta-cabeça ou deitada: o sistema corrige a orientação.
        </li>
        <li>
          <strong>Importe e confira.</strong> Em <em>Correção</em>, escolha a prova e arraste os arquivos. Folhas com marcação fraca, rasurada ou dupla ficam como{' '}
          <em>Revisar</em>: abra, confira com a imagem e confirme. Nenhuma dúvida é decidida "no chute" sem passar por você.
        </li>
        <li>
          <strong>Exporte o Excel.</strong> O arquivo traz: <em>Resumo</em> (nota de cada aluno e estatísticas da turma), <em>Respostas marcadas</em> (o que cada aluno marcou,
          colorido por acerto/erro), <em>Análise por questão</em> (índice de acerto, distratores) e <em>Detalhado</em> (uma linha por aluno e questão, para filtros).
        </li>
      </ol>
      <h3>Para testar e treinar</h3>
      <p>
        No gabarito, use <em>Gerar folhas simuladas para teste</em>: é gerado um PDF com folhas preenchidas aleatoriamente e, no rodapé de cada uma, o resultado esperado. Importe esse
        PDF na correção e compare. Depois, faça o mesmo com algumas folhas reais impressas, preenchidas à mão e digitalizadas/fotografadas.
      </p>
      <h3>Regras de pontuação</h3>
      <ul>
        <li>Nota = pontos obtidos ÷ pontos possíveis × nota máxima (com pesos, se definidos).</li>
        <li>Questão anulada: todos recebem o ponto.</li>
        <li>Questão em branco ou com mais de uma alternativa marcada: vale zero.</li>
      </ul>
      <h3>Privacidade</h3>
      <p>Tudo é processado no próprio navegador. As imagens e notas não são enviadas para nenhum servidor e ficam salvas apenas neste computador.</p>
    </div>
  );
}

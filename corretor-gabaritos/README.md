# Corretor de Gabaritos · SENAI

Sistema web para correção automática de provas objetivas por leitura óptica (OMR).

1. O docente cadastra o **gabarito matriz** (até 60 questões, A–D ou A–E, com pesos e questões anuladas).
2. O sistema gera a **folha de respostas em PDF** para imprimir e aplicar.
3. As folhas preenchidas são **importadas em lote** (PDF com várias páginas, JPG, PNG — escâner ou foto de celular).
4. Cada folha é comparada com o gabarito matriz: nota, acertos, erros, brancos e marcações múltiplas.
5. Leituras duvidosas (marca fraca, rasura, marcação dupla, matrícula incerta) vão para **revisão manual** com a imagem da folha.
6. Exporta um **Excel** formatado: resumo por aluno, respostas marcadas (coloridas), análise por questão e detalhamento.

Tudo roda no navegador: nenhuma imagem ou nota é enviada para servidor.

## Executar

```bash
cd corretor-gabaritos
npm install
npm run dev      # desenvolvimento: http://localhost:5173
npm run build    # gera dist/ (pode ser publicado em qualquer servidor estático)
npm test         # testes da leitura óptica com folhas sintéticas
```

## Como a leitura funciona

- A folha tem **4 quadrados pretos nos cantos** e um quadradinho de orientação ao lado do canto superior esquerdo.
- O sistema localiza os quadrados (binarização adaptativa + componentes conexos), descobre a orientação
  (folha de ponta-cabeça ou deitada) e corrige a perspectiva com uma homografia.
- Cada bolha é medida comparando o miolo com o papel ao redor dela, o que tolera sombras e iluminação desigual.
- Limiares (`src/omr/classificar.ts`): ≥ 45% preenchida = marcada; < 22% = vazia; o que fica entre os dois,
  ou uma segunda bolha escurecida, é marcado como **dúvida** e não é decidido sem o docente.

A geometria da folha está em `src/layout.ts` e é usada tanto para gerar o PDF quanto para ler — por isso
a leitura só funciona com a folha gerada pelo próprio sistema.

## Para testar e treinar

No gabarito, **Gerar folhas simuladas para teste** cria um PDF com folhas preenchidas aleatoriamente e o
resultado esperado no rodapé de cada página. Importe-o em **Correção** e confira.

## Estrutura

```text
src/
  layout.ts            geometria da folha (mm)
  folhaPdf.ts          geração da folha de respostas e das folhas simuladas
  arquivos.ts          leitura de PDF (pdf.js) e imagens
  omr/imagem.ts        operações de imagem, homografia, retificação
  omr/leitor.ts        localização dos marcadores e leitura das bolhas
  omr/classificar.ts   decisão marcada / branco / múltipla / dúvida
  correcao.ts          cálculo da nota
  excel.ts             relatório .xlsx (ExcelJS)
  armazenamento.ts     localStorage + IndexedDB
  components/          telas (gabarito, correção, revisão, ajuda)
tests/                 testes com folhas sintéticas (rotação, perspectiva, sombra, ruído)
```

## Cores

As cores ficam em variáveis CSS no início de `src/styles.css` (azul `#004A8D`, vermelho `#E30613`).
Ajuste conforme o manual de marca da sua regional.

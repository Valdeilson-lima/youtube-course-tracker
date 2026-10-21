/**
 * Serviço de Inteligência Artificial para o TubeCourse
 * Gera resumos estruturados de aulas, pontos-chave e insights práticos
 */

export interface LessonSummary {
  title: string;
  overview: string;
  keyPoints: string[];
  tips?: string;
  markdown: string;
}

export async function generateLessonSummary(
  lessonTitle: string,
  courseTitle: string,
  channelTitle: string = '',
  apiKey?: string
): Promise<LessonSummary> {
  const effectiveKey = apiKey || (import.meta.env.VITE_GEMINI_API_KEY as string) || '';

  // Se tiver chave Gemini, consulta o modelo Gemini Flash oficial
  if (effectiveKey) {
    try {
      const prompt = `Você é um tutor especialista. Resuma a aula "${lessonTitle}" do curso "${courseTitle}" (Canal: "${channelTitle}").
Gere uma resposta em português clara e prática para quem está estudando.
Sua resposta DEVE seguir exatamente este formato em markdown:

### 🎯 Resumo Rápido
(1 ou 2 parágrafos objetivos explicando o objetivo principal e o que é ensinado nesta aula)

### 🔑 Pontos-Chave e Conceitos
- (Ponto principal 1)
- (Ponto principal 2)
- (Ponto principal 3)
- (Ponto principal 4)

### 💡 Dica Prática para Estudo
(Uma dica de ouro ou boa prática para aplicar o conhecimento desta aula)`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${effectiveKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [{ text: prompt }],
              },
            ],
            generationConfig: {
              temperature: 0.4,
              maxOutputTokens: 800,
            },
          }),
        }
      );

      if (response.ok) {
        const json = await response.json();
        const candidate = json.candidates?.[0]?.content?.parts?.[0]?.text;
        if (candidate) {
          return parseMarkdownToSummary(lessonTitle, candidate);
        }
      }
    } catch (err) {
      console.warn('Erro ao consultar Gemini API, utilizando gerador inteligente offline:', err);
    }
  }

  // Fallback Inteligente Estruturado (não deixa o usuário na mão mesmo sem chave de API!)
  return generateOfflineSummary(lessonTitle, courseTitle, channelTitle);
}

function parseMarkdownToSummary(title: string, markdown: string): LessonSummary {
  const lines = markdown.split('\n');
  const keyPoints: string[] = [];
  let overview = '';
  let tips = '';

  let section: 'overview' | 'points' | 'tips' = 'overview';

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.includes('Resumo Rápido')) {
      section = 'overview';
    } else if (trimmed.includes('Pontos-Chave')) {
      section = 'points';
    } else if (trimmed.includes('Dica Prática')) {
      section = 'tips';
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      if (section === 'points') {
        keyPoints.push(trimmed.replace(/^[-*]\s+/, ''));
      }
    } else if (trimmed.length > 0 && !trimmed.startsWith('#')) {
      if (section === 'overview' && !overview) {
        overview = trimmed;
      } else if (section === 'tips' && !tips) {
        tips = trimmed;
      }
    }
  }

  return {
    title,
    overview: overview || `Visão geral focada nos tópicos fundamentais da aula ${title}.`,
    keyPoints: keyPoints.length > 0 ? keyPoints : [
      'Compreensão da sintaxe e conceitos centrais apresentados.',
      'Aplicação prática com exemplos de código ou demonstração.',
      'Resolução de problemas comuns e boas práticas.',
    ],
    tips: tips || 'Pratique os exemplos demonstrados no seu editor enquanto assiste para fixar o aprendizado.',
    markdown,
  };
}

function generateOfflineSummary(
  lessonTitle: string,
  courseTitle: string,
  channelTitle: string
): LessonSummary {
  const cleanTitle = lessonTitle.replace(/^(\d+[\s.-]+)/, '');
  const overview = `Nesta aula do curso "${courseTitle}" (${channelTitle || 'YouTube'}), o conteúdo é centrado em "${cleanTitle}". O objetivo é consolidar o domínio prático deste tópico com demonstrações sequenciais e explicações diretas.`;

  const keyPoints = [
    `Fundamentos e estrutura essencial de "${cleanTitle}".`,
    'Exemplos práticos de uso e implementação.',
    'Como evitar os erros mais frequentes de iniciantes.',
    'Integração deste conceito com as próximas etapas do curso.',
  ];

  const tips = 'Pause nos momentos de demonstração para codificar ou reproduzir os passos no seu próprio ambiente de desenvolvimento.';

  const markdown = `### 🎯 Resumo da Aula: ${cleanTitle}
${overview}

### 🔑 Pontos Principais
${keyPoints.map((p) => `- ${p}`).join('\n')}

### 💡 Dica de Aprendizado
${tips}

> ℹ️ *Dica Pro: Adicione sua chave gratuita do Google Gemini nas Configurações (ícone ⚙️) para resumos aprofundados com Inteligência Artificial.*`;

  return {
    title: lessonTitle,
    overview,
    keyPoints,
    tips,
    markdown,
  };
}

/**
 * Serviço de Inteligência Artificial para o TubeCourse
 * Gera resumos estruturados de aulas, pontos-chave, insights práticos
 * e extração/reconstrução de códigos através de transcrição do YouTube
 */

import { fetchVideoTranscript } from './transcript';

export interface CodeSnippet {
  language: string;
  code: string;
  description?: string;
}

export interface LessonSummary {
  title: string;
  overview: string;
  keyPoints: string[];
  codeSnippets?: CodeSnippet[];
  tips?: string;
  transcriptSource?: 'youtube_captions' | 'ai_synthesized';
  aiModel?: string;
  language?: string;
  markdown: string;
}

export async function generateLessonSummary(
  lessonTitle: string,
  courseTitle: string,
  channelTitle: string = '',
  apiKey?: string,
  videoId?: string,
  modelName: string = 'gemini-1.5-pro'
): Promise<LessonSummary> {
  const effectiveKey = apiKey || (import.meta.env.VITE_GEMINI_API_KEY as string) || '';

  // 1. Tenta obter a transcrição do áudio do vídeo do YouTube
  let transcriptData: { transcript: string; language?: string } | null = null;
  if (videoId) {
    try {
      transcriptData = await fetchVideoTranscript(videoId);
    } catch (err) {
      console.warn('Não foi possível obter transcrição do vídeo:', err);
    }
  }

  const hasTranscript = Boolean(transcriptData && transcriptData.transcript.length > 50);
  const transcriptText = hasTranscript ? transcriptData!.transcript.slice(0, 45000) : '';

  // 2. Se tiver chave Gemini, consulta o modelo oficial (Pro ou Flash com fallback)
  if (effectiveKey) {
    const modelsToTry = [modelName, 'gemini-1.5-flash'];
    const uniqueModels = Array.from(new Set(modelsToTry));

    const prompt = `Você é um tutor especialista em programação, tecnologia e ensino prático.
Analise a aula "${lessonTitle}" do curso "${courseTitle}" (Canal: "${channelTitle}").

${
  hasTranscript
    ? `--- TRANSCRIÇÃO REAL DO ÁUDIO DA AULA NO YOUTUBE (O que o professor falou) ---
${transcriptText}
--------------------------------------------------------------------------------

Com base na transcrição acima do que o instrutor realmente explicou e demonstrou no vídeo:
`
    : `O vídeo não possui transcrição de áudio direta disponível. Faça uma análise técnica profunda baseada no tema e tecnologia da aula:
`
}

Sua resposta DEVE seguir rigorosamente esta estrutura em markdown:

### 🎯 Resumo Rápido
(1 ou 2 parágrafos objetivos explicando os objetivos da aula e o que foi ensinado pelo professor)

### 🔑 Pontos-Chave e Conceitos
- (Conceito ou passo 1)
- (Conceito ou passo 2)
- (Conceito ou passo 3)
- (Conceito ou passo 4)

### 💻 Códigos e Implementações da Aula
(Se a aula envolveu programação, comandos de terminal, SQL, HTML/CSS ou configurações, RECONSTRUA os códigos e scripts exatos ensinados. Use blocos de código formatados com a linguagem correspondente (ex: \`\`\`python, \`\`\`javascript, \`\`\`typescript, \`\`\`sql, \`\`\`bash). Adicione comentários explicativos nas linhas do código. Se for uma aula puramente teórica, forneça um snippet demonstrando como o conceito é aplicado na prática.)

### 💡 Dica Prática para Estudo
(Uma dica de ouro ou boa prática para aplicar e fixar o conhecimento desta aula)`;

    for (const currentModel of uniqueModels) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${effectiveKey}`,
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
                temperature: 0.35,
                maxOutputTokens: 2048,
              },
            }),
          }
        );

        if (response.ok) {
          const json = await response.json();
          const candidate = json.candidates?.[0]?.content?.parts?.[0]?.text;
          if (candidate) {
            return parseMarkdownToSummary(
              lessonTitle,
              candidate,
              hasTranscript ? 'youtube_captions' : 'ai_synthesized',
              currentModel,
              transcriptData?.language
            );
          }
        } else {
          console.warn(`Tentativa com ${currentModel} falhou (${response.status}), tentando modelo alternativo...`);
        }
      } catch (err) {
        console.warn(`Erro ao consultar modelo ${currentModel}:`, err);
      }
    }
  }

  // 3. Fallback Inteligente Estruturado (não deixa o usuário na mão mesmo sem chave de API!)
  return generateOfflineSummary(lessonTitle, courseTitle, channelTitle, hasTranscript ? transcriptData?.transcript : undefined);
}

export function parseMarkdownToSummary(
  title: string,
  markdown: string,
  transcriptSource: 'youtube_captions' | 'ai_synthesized' = 'ai_synthesized',
  aiModel?: string,
  language?: string
): LessonSummary {
  const lines = markdown.split('\n');
  const keyPoints: string[] = [];
  const codeSnippets: CodeSnippet[] = [];
  let overview = '';
  let tips = '';

  let section: 'overview' | 'points' | 'code' | 'tips' = 'overview';

  // Extrai blocos de código com regex global
  const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  while ((match = codeBlockRegex.exec(markdown)) !== null) {
    const lang = (match[1] || 'plaintext').trim().toLowerCase();
    const code = match[2].trim();
    if (code) {
      codeSnippets.push({
        language: lang,
        code,
      });
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.includes('Resumo Rápido')) {
      section = 'overview';
      continue;
    } else if (trimmed.includes('Pontos-Chave')) {
      section = 'points';
      continue;
    } else if (trimmed.includes('Códigos') || trimmed.includes('Código') || trimmed.includes('Implementação')) {
      section = 'code';
      continue;
    } else if (trimmed.includes('Dica Prática') || trimmed.includes('Dica de')) {
      section = 'tips';
      continue;
    }

    if (section === 'points' && (trimmed.startsWith('- ') || trimmed.startsWith('* '))) {
      keyPoints.push(trimmed.replace(/^[-*]\s+/, ''));
    } else if (section === 'overview' && trimmed.length > 0 && !trimmed.startsWith('#') && !trimmed.startsWith('```')) {
      overview = overview ? `${overview} ${trimmed}` : trimmed;
    } else if (section === 'tips' && trimmed.length > 0 && !trimmed.startsWith('#') && !trimmed.startsWith('```')) {
      tips = tips ? `${tips} ${trimmed}` : trimmed;
    }
  }

  return {
    title,
    overview: overview || `Visão geral focada nos tópicos fundamentais da aula ${title}.`,
    keyPoints:
      keyPoints.length > 0
        ? keyPoints
        : [
            'Compreensão da sintaxe e conceitos centrais apresentados.',
            'Aplicação prática com exemplos de código ou demonstração.',
            'Resolução de problemas comuns e boas práticas de desenvolvimento.',
          ],
    codeSnippets: codeSnippets.length > 0 ? codeSnippets : undefined,
    tips: tips || 'Pratique os códigos demonstrados no seu próprio editor para fixar o aprendizado.',
    transcriptSource,
    aiModel: aiModel || 'gemini-1.5-pro',
    language,
    markdown,
  };
}

function generateOfflineSummary(
  lessonTitle: string,
  courseTitle: string,
  channelTitle: string,
  transcriptSnippet?: string
): LessonSummary {
  const cleanTitle = lessonTitle.replace(/^(\d+[\s.-]+)/, '');
  const overview = `Nesta aula do curso "${courseTitle}" (${channelTitle || 'YouTube'}), o conteúdo é centrado em "${cleanTitle}". O objetivo é consolidar o domínio prático deste tópico com demonstrações sequenciais e explicações diretas.`;

  const keyPoints = [
    `Fundamentos e estrutura essencial de "${cleanTitle}".`,
    'Exemplos práticos de uso e implementação.',
    'Como evitar os erros mais frequentes de iniciantes.',
    'Integração deste conceito com as próximas etapas do curso.',
  ];

  const tips =
    'Pause nos momentos de demonstração para codificar ou reproduzir os passos no seu próprio ambiente de desenvolvimento.';

  const isJsOrTs = cleanTitle.toLowerCase().includes('javascript') || cleanTitle.toLowerCase().includes('react') || cleanTitle.toLowerCase().includes('node');
  const isPython = cleanTitle.toLowerCase().includes('python');

  let sampleLang = 'javascript';
  let sampleCode = `// Exemplo prático de implementação para a aula\nfunction executarExemplo() {\n  console.log("Praticando o conceito de: ${cleanTitle}");\n}\nexecutarExemplo();`;

  if (isPython) {
    sampleLang = 'python';
    sampleCode = `# Exemplo prático de implementação da aula\ndef executar_exemplo():\n    print("Praticando o conceito de: ${cleanTitle}")\n\nif __name__ == "__main__":\n    executar_exemplo()`;
  }

  const markdown = `### 🎯 Resumo da Aula: ${cleanTitle}
${overview}

### 🔑 Pontos Principais
${keyPoints.map((p) => `- ${p}`).join('\n')}

### 💻 Códigos e Implementações da Aula
\`\`\`${sampleLang}
${sampleCode}
\`\`\`

### 💡 Dica de Aprendizado
${tips}

> ℹ️ *Dica Pro: Adicione sua chave gratuita do Google Gemini nas Configurações (ícone ⚙️) para transcrição e resumos aprofundados com Inteligência Artificial.*`;

  return {
    title: lessonTitle,
    overview,
    keyPoints,
    codeSnippets: [
      {
        language: sampleLang,
        code: sampleCode,
      },
    ],
    tips,
    transcriptSource: transcriptSnippet ? 'youtube_captions' : 'ai_synthesized',
    aiModel: 'offline',
    markdown,
  };
}

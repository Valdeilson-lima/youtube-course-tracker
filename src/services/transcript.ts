/**
 * Serviço de Transcrição de Áudio de Aulas do YouTube
 * Obtém a transcrição oficial e legendas sincronizadas do vídeo
 */

export interface TranscriptResult {
  transcript: string;
  language?: string;
  trackName?: string;
}

export async function fetchVideoTranscript(videoId: string): Promise<TranscriptResult | null> {
  if (!videoId || videoId.length < 5) return null;

  // 1. Tenta o endpoint seguro do servidor local (/api/transcript)
  try {
    const res = await fetch(`/api/transcript?videoId=${encodeURIComponent(videoId)}`);
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.transcript && data.transcript.trim().length > 0) {
        return {
          transcript: data.transcript,
          language: data.language,
          trackName: data.trackName,
        };
      }
    }
  } catch (err) {
    console.warn('Endpoint local de transcrição indisponível, tentando fallback:', err);
  }

  // 2. Fallback resiliente para produção (PWA ou deploy estático)
  try {
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(
      `https://www.youtube.com/watch?v=${videoId}`
    )}`;
    const pageRes = await fetch(proxyUrl, { signal: AbortSignal.timeout(6000) });
    if (pageRes.ok) {
      const html = await pageRes.text();
      const apiKeyMatch = html.match(/"INNERTUBE_API_KEY":"([^"]+)"/);
      if (apiKeyMatch) {
        const apiKey = apiKeyMatch[1];
        const playerRes = await fetch(`https://www.youtube.com/youtubei/v1/player?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            context: { client: { clientName: 'ANDROID', clientVersion: '20.10.38' } },
            videoId,
          }),
        });

        if (playerRes.ok) {
          const playerData = await playerRes.json();
          const captionTracks =
            playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];

          if (captionTracks.length > 0) {
            const targetTrack =
              captionTracks.find(
                (t: any) => t.languageCode === 'pt' || t.languageCode === 'pt-BR'
              ) || captionTracks[0];

            const capRes = await fetch(targetTrack.baseUrl);
            if (capRes.ok) {
              const xml = await capRes.text();
              const cleanText = xml
                .replace(/<text[^>]*>/g, ' ')
                .replace(/<\/text>/g, '\n')
                .replace(/<[^>]+>/g, '')
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'")
                .trim();

              if (cleanText && cleanText.length > 20) {
                return {
                  transcript: cleanText,
                  language: targetTrack.languageCode,
                  trackName: targetTrack.name?.runs?.[0]?.text || targetTrack.name?.simpleText,
                };
              }
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn('Fallback externo de transcrição não retornou resultados:', err);
  }

  return null;
}

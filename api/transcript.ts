export default async function handler(req: any, res: any) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const videoId = req.query.videoId || req.query.id;
  if (!videoId) {
    return res.status(400).json({ error: 'Parâmetro videoId obrigatório' });
  }

  try {
    const pageRes = await fetch(`https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      },
    });

    if (!pageRes.ok) {
      return res.status(pageRes.status).json({ error: 'Não foi possível carregar o vídeo do YouTube.' });
    }

    const html = await pageRes.text();
    const apiKeyMatch = html.match(/"INNERTUBE_API_KEY":"([^"]+)"/);
    if (!apiKeyMatch) {
      return res.status(404).json({ error: 'Chave interna do YouTube não encontrada.' });
    }
    const apiKey = apiKeyMatch[1];

    const playerRes = await fetch(`https://www.youtube.com/youtubei/v1/player?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        context: { client: { clientName: 'ANDROID', clientVersion: '20.10.38' } },
        videoId,
      }),
    });

    if (!playerRes.ok) {
      return res.status(playerRes.status).json({ error: 'Erro ao consultar player do YouTube.' });
    }

    const playerData = await playerRes.json();
    const captionTracks = playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];

    if (!captionTracks || captionTracks.length === 0) {
      return res.status(200).json({
        success: false,
        transcript: null,
        error: 'Este vídeo não possui legendas ou transcrição disponível no YouTube.',
      });
    }

    // Prioriza Português (pt ou pt-BR) ou o primeiro disponível
    const targetTrack =
      captionTracks.find((t: any) => t.languageCode === 'pt' || t.languageCode === 'pt-BR') ||
      captionTracks[0];

    const captionRes = await fetch(targetTrack.baseUrl);
    const xml = await captionRes.text();

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

    return res.status(200).json({
      success: true,
      transcript: cleanText,
      language: targetTrack.languageCode,
      trackName: targetTrack.name?.runs?.[0]?.text || targetTrack.name?.simpleText || 'Padrão',
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Erro ao processar transcrição' });
  }
}

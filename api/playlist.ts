export default async function handler(req: any, res: any) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { id } = req.query;
  if (!id) {
    return res.status(400).json({ error: 'Parâmetro id da playlist obrigatório' });
  }

  try {
    const response = await fetch(`https://www.youtube.com/playlist?list=${id}`, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      },
    });

    if (!response.ok) {
      return res
        .status(response.status)
        .json({ error: 'Não foi possível carregar a playlist do YouTube.' });
    }

    const html = await response.text();
    const match = html.match(/var ytInitialData = ({.*?});<\/script>/);
    if (!match) {
      return res.status(404).json({ error: 'Dados da playlist não encontrados no YouTube.' });
    }

    const data = JSON.parse(match[1]);
    const metadata = data.metadata?.playlistMetadataRenderer || {};
    const title = metadata.title || 'Curso do YouTube';
    const description = metadata.description || '';

    let channelTitle =
      metadata.ownerBadges?.[0]?.metadataBadgeRenderer?.label ||
      data.header?.playlistHeaderRenderer?.ownerText?.runs?.[0]?.text ||
      'Canal do YouTube';

    const sections =
      data.contents?.twoColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents || [];

    const lessons: any[] = [];

    for (const sec of sections) {
      const itemContents = sec.itemSectionRenderer?.contents || [];
      for (const item of itemContents) {
        // 1. Formato Novo: lockupViewModel
        if (item.lockupViewModel && item.lockupViewModel.contentId) {
          const vm = item.lockupViewModel;
          const videoId = vm.contentId;
          const videoTitle =
            vm.metadata?.lockupMetadataViewModel?.title?.content ||
            vm.rendererContext?.accessibilityContext?.label ||
            'Aula';
          const duration =
            vm.contentImage?.thumbnailViewModel?.overlays?.[0]?.thumbnailBottomOverlayViewModel?.badges?.[0]?.thumbnailBadgeViewModel?.text ||
            '';
          const sources = vm.contentImage?.thumbnailViewModel?.image?.sources || [];
          const thumb =
            sources[sources.length - 1]?.url ||
            `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;

          lessons.push({
            id: videoId,
            title: videoTitle,
            duration,
            thumbnailUrl: thumb,
            completed: false,
            lastPositionSeconds: 0,
          });
        }

        // 2. Formato Clássico: playlistVideoListRenderer
        if (item.playlistVideoListRenderer?.contents) {
          for (const pv of item.playlistVideoListRenderer.contents) {
            const v = pv.playlistVideoRenderer;
            if (!v || !v.videoId) continue;
            const videoId = v.videoId;
            const videoTitle = v.title?.runs?.[0]?.text || v.title?.simpleText || 'Aula';
            const duration = v.lengthText?.simpleText || '';
            const thumb =
              v.thumbnail?.thumbnails?.slice(-1)[0]?.url ||
              `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;

            if (channelTitle === 'Canal do YouTube' && v.shortBylineText?.runs?.[0]?.text) {
              channelTitle = v.shortBylineText.runs[0].text;
            }

            lessons.push({
              id: videoId,
              title: videoTitle,
              duration,
              thumbnailUrl: thumb,
              completed: false,
              lastPositionSeconds: 0,
            });
          }
        }
      }
    }

    return res.status(200).json({
      title,
      channelTitle,
      description,
      lessons,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Erro interno ao processar playlist' });
  }
}

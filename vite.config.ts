import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

function youtubePlaylistPlugin(): Plugin {
  const handlePlaylistRequest = async (req: any, res: any) => {
    try {
      const urlObj = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
      const playlistId = urlObj.searchParams.get('id');
      if (!playlistId) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Parâmetro id da playlist obrigatório' }));
        return;
      }

      const response = await fetch(`https://www.youtube.com/playlist?list=${playlistId}`, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
        },
      });

      if (!response.ok) {
        res.statusCode = response.status;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Não foi possível carregar a playlist do YouTube.' }));
        return;
      }

      const html = await response.text();
      const match = html.match(/var ytInitialData = ({.*?});<\/script>/);
      if (!match) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Dados da playlist não encontrados no YouTube.' }));
        return;
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

              let cleanTitle = videoTitle;
              if (cleanTitle.toLowerCase() === 'private video' || cleanTitle.toLowerCase() === 'vídeo privado') {
                cleanTitle = `Aula ${lessons.length + 1} (Exclusiva para Membros / Restrita)`;
              }

              lessons.push({
                id: videoId,
                title: cleanTitle,
                duration,
                thumbnailUrl: thumb,
                completed: false,
                lastPositionSeconds: 0,
              });
            }
          }
        }
      }

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          title,
          channelTitle,
          description,
          lessons,
        })
      );
    } catch (err: any) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: err.message || 'Erro interno ao processar playlist' }));
    }
  };

  const handleTranscriptRequest = async (req: any, res: any) => {
    try {
      const urlObj = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
      const videoId = urlObj.searchParams.get('videoId') || urlObj.searchParams.get('id');
      if (!videoId) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Parâmetro videoId obrigatório' }));
        return;
      }

      const pageRes = await fetch(`https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
        },
      });

      if (!pageRes.ok) {
        res.statusCode = pageRes.status;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Não foi possível carregar o vídeo do YouTube.' }));
        return;
      }

      const html = await pageRes.text();
      const apiKeyMatch = html.match(/"INNERTUBE_API_KEY":"([^"]+)"/);
      if (!apiKeyMatch) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Chave interna do YouTube não encontrada.' }));
        return;
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
        res.statusCode = playerRes.status;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Não foi possível obter dados do reprodutor do YouTube.' }));
        return;
      }

      const playerData = await playerRes.json();
      const captionTracks = playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];

      if (!captionTracks || captionTracks.length === 0) {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(
          JSON.stringify({
            success: false,
            transcript: null,
            error: 'Este vídeo não possui legendas ou transcrição disponível no YouTube.',
          })
        );
        return;
      }

      // Prioriza Português (pt ou pt-BR) ou o primeiro disponível
      const targetTrack =
        captionTracks.find((t: any) => t.languageCode === 'pt' || t.languageCode === 'pt-BR') ||
        captionTracks[0];

      const captionRes = await fetch(targetTrack.baseUrl);
      const xml = await captionRes.text();

      // Limpa tags XML preservando espaçamento e pontuação
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

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          success: true,
          transcript: cleanText,
          language: targetTrack.languageCode,
          trackName: targetTrack.name?.runs?.[0]?.text || targetTrack.name?.simpleText || 'Padrão',
        })
      );
    } catch (err: any) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: err.message || 'Erro ao extrair transcrição' }));
    }
  };

  return {
    name: 'youtube-playlist-api',
    configureServer(server) {
      server.middlewares.use('/api/playlist', handlePlaylistRequest);
      server.middlewares.use('/api/transcript', handleTranscriptRequest);
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api/playlist', handlePlaylistRequest);
      server.middlewares.use('/api/transcript', handleTranscriptRequest);
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    youtubePlaylistPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'pwa-192x192.svg', 'pwa-512x512.svg'],
      manifest: {
        name: 'TubeCourse - Cursos do YouTube',
        short_name: 'TubeCourse',
        description: 'Transforme playlists do YouTube em cursos com progresso e controle total',
        theme_color: '#0f172a',
        background_color: '#020617',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          {
            src: 'pwa-192x192.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
          },
          {
            src: 'pwa-512x512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
          },
          {
            src: 'pwa-512x512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
});

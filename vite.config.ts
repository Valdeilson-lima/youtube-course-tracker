import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

function youtubePlaylistPlugin(): Plugin {
  return {
    name: 'youtube-playlist-api',
    configureServer(server) {
      server.middlewares.use('/api/playlist', async (req, res) => {
        try {
          const urlObj = new URL(req.url || '', `http://${req.headers.host}`);
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
      });
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

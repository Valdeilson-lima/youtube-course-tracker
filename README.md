# 🎓 TubeCourse - Transforme Playlists do YouTube em Cursos

Uma aplicação moderna para estudar através do YouTube como se fosse uma plataforma de cursos profissional (Udemy, Alura, Coursera), com progresso sequencial, anotações e detecção automática de conclusão de aula.

---

## ✨ Principais Funcionalidades

1. **Reprodutor sem Distrações (YouTube IFrame API):**
   - Assista às aulas sem recomendações laterais ou feed para distrair.
   - Detecção automática de término: quando o vídeo chega ao fim, marca a aula como **Concluída** e dispara uma celebração de confetes 🎉.
   - Avanço automático para a próxima aula.
   - Controle de velocidade lembrado (0.75x, 1x, 1.25x, 1.5x, 1.75x, 2x).

2. **Barra de Progresso & Checklist:**
   - Acompanhamento de progresso geral e por curso (ex: *8 de 15 aulas concluídas • 53%*).
   - Checkbox individual para marcar/desmarcar aulas manualmente.
   - Histórico de última posição do vídeo salvo automaticamente.

3. **Anotações Inteligentes por Aula:**
   - Campo de anotações específico para cada aula salvo no navegador.
   - Botão **"Inserir Timestamp"**: adiciona o minuto exato da aula na sua anotação.
   - Exportação completa de todas as anotações do curso em arquivo Markdown (.md).

4. **Importação Fácil de Playlists:**
   - Cole o link de qualquer playlist pública do YouTube.
   - Ou cole uma lista manual de vídeos (`URL | Título da Aula`).
   - O painel começa vazio para você cadastrar apenas os seus cursos.

5. **Backup & Armazenamento Local:**
   - 100% dos dados salvos no seu próprio navegador via `localStorage`.
   - Exportação e importação de backup em arquivo JSON.

---

## 🚀 Como Iniciar

1. Abra o terminal na pasta do projeto:
   ```bash
   cd youtube-course-tracker
   ```

2. Inicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```

3. Abra seu navegador no endereço:
   [http://localhost:5173](http://localhost:5173)

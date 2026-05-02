# Zantia Formação — Plataforma de Formação

## Visão
App de formação técnica (mobile + web) inspirada na organização do site zantia.com, para centralizar imagens, vídeos e textos sobre Energia e Climatização.

## Estrutura (5 gavetões / 31 gavetinhas)
1. **Fotovoltaico** (11 itens): Painéis, Inversores String, Microinversores, Otimizadores, Baterias, Estruturas, Cabos, Proteções, Monitorização, Carregadores EV, Kits Autoconsumo
2. **Bombas de Calor** (7): Split Ar-Água, Monobloco, AQS, Piscina, Alta Temperatura, Geotérmica, Acessórios
3. **Caldeiras** (3): Gás, Gasóleo, Pellets
4. **Ar Condicionado** (9): Mural, Multi-Split, Cassete, Conduta, Consola, Teto, Portátil, VRF, Unidades Exteriores
5. **Acessórios** (1): Acessórios Gerais

## Funcionalidades
- Home com hero dinâmico e grid industrial das 5 categorias (contadores reais)
- Navegação: Home → Gavetão → Gavetinha (detalhe)
- Detalhe com galeria de imagens, player de vídeo (YouTube/Vimeo embed), descrição técnica
- **Modo edição aberto** (sem autenticação) em cada gavetinha: alterar título, descrição, adicionar/remover imagens (base64) e URLs de vídeo
- Responsivo mobile + web (mesmo código Expo)
- Placeholders editáveis — todos os títulos podem ser personalizados

## Tech
- **Frontend**: Expo Router (web + mobile), React Native, react-native-webview, expo-image-picker
- **Backend**: FastAPI + MongoDB (motor), seed automático no startup
- **Storage**: MongoDB (imagens em base64 data-URI, vídeos por URL)
- **Design**: Industrial — Navy #1A365D + Red #D92525, IBM Plex style

## API (prefixada `/api`)
- `GET /api/gavetoes` — lista 5 categorias com filhos
- `GET /api/gavetoes/{id}` — categoria individual
- `GET /api/gavetinhas/{id}` — sub-item individual
- `PUT /api/gavetinhas/{id}` — atualiza título/descrição/imagens/vídeos
- `PUT /api/gavetoes/{id}` — atualiza categoria
- `POST /api/seed` — idempotente (só corre se vazio)

## Roadmap sugerido
- Autenticação opcional no modo admin
- Upload de vídeos diretos (Cloudinary)
- Pesquisa global por gavetinha
- Export PDF de cada ficha técnica
- Marcadores/favoritos por formando

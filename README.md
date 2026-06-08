# 🍪 Bolachas

Jogo **multiplayer online 3D** no navegador, numa **cozinha gigante** (inspirada em
*A Webbing Journey*). Uma pessoa é a **criança** (maior e mais rápida) e tem de **apanhar
todas as bolachas** — jogadores que são bolachas com braços e pernas — antes do tempo acabar.

As bolachas fogem e **sobem pelas rampas** até bancadas e armários: a criança só apanha quem
estiver **à mesma altura**, por isso subir é uma fuga a sério. Frascos de vidro e caixas de
cereais servem de cobertura. Se alguma bolacha sobreviver ~75 segundos, ganham as bolachas!

## Como jogar

```bash
npm install
npm start
```

Depois abre **http://localhost:3000** no navegador. Cada jogador abre o link no seu próprio
dispositivo (telemóvel, tablet ou PC) e escolhe um nome.

- Precisa de **2 ou mais jogadores** para começar.
- O **primeiro a entrar** começa como criança; o papel **roda** a cada nova ronda.
- Quando a ronda acaba, qualquer jogador pode carregar em **"Jogar outra vez"**.

### Controlos

- **Teclado:** setas ou `W A S D`
- **Telemóvel/tablet:** joystick no canto inferior esquerdo

## Jogar com amigos noutra rede

O servidor corre na tua máquina. Para outras pessoas entrarem pela internet, expõe a porta
3000 com um túnel, por exemplo:

```bash
npx localtunnel --port 3000
# ou
ngrok http 3000
```

E partilha o endereço gerado.

## Pôr online no Render

O projeto está pronto para o [Render](https://render.com) (suporta WebSockets e processos
sempre ligados, ao contrário da Vercel). O ficheiro `render.yaml` já tem tudo configurado.

1. Faz push do projeto para o GitHub.
2. No Render: **New → Blueprint** e escolhe este repositório (ou **New → Web Service**, com
   `npm install` como *build* e `npm start` como *start*).
3. O Render atribui um endereço `https://...onrender.com` — partilha-o com os amigos.

> No plano grátis o servidor "adormece" após inatividade; o primeiro acesso pode demorar
> ~30s a acordar.

## Como está feito

| Ficheiro            | Papel                                                             |
| ------------------- | ----------------------------------------------------------------- |
| `server/index.js`   | Servidor HTTP (ficheiros estáticos) + WebSocket + loop a 30 Hz    |
| `server/game.js`    | Lógica autoritativa: jogadores, papéis, movimento, apanhar, rondas |
| `public/kitchen.js` | Mapa da cozinha (móveis, alturas, rampas) — partilhado servidor+cliente |
| `public/index.html` | Estrutura da página (lobby + jogo)                                |
| `public/style.css`  | Aspeto                                                            |
| `public/client.js`  | Ligação, controlos (teclado/joystick) e desenho no canvas         |

O **servidor é autoritativo**: os clientes só enviam a direção do movimento e desenham o
estado que recebem. Isto evita batota e mantém todos sincronizados.

# Sock Drawer

An endless laundry game. Socks hang on a clothesline. You can only swap neighbors. On each beat the last two socks hop into the drawer together.

The line keeps sliding toward the drawer. Two new socks hop on at the far end with every beat, and their mates show up later in the shuffle. More patterns join as your streak grows, and the beats get shorter. Three mismatches jam the drawer.

## Play

- Drag a sock sideways through its neighbor to swap them.
- Or tap a sock, then tap the one beside it.
- A bead travels the line. When it reaches the drawer, the last two socks leave together.
- A matching pair is folded. A mismatch falls off and costs a life.
- Press **Space**, or tap the drawer, to fold early once those two match.
- **P** or **Escape** pauses.

Your best score stays in the browser.

## Run locally

```bash
npm install
npm run dev
```

Open http://127.0.0.1:47231

```bash
npm test
npm run build
```

## Publish to socks.saamn.dev

saamn.dev stays as it is. This game publishes separately, from a public GitHub repo, on every push to `main`.

1. Create `github.com/alpasaam/sock-drawer` and push this project to it.
2. In that repo, open Settings, then Pages. Set the source to GitHub Actions and the custom domain to `socks.saamn.dev`.
3. In Porkbun, on `saamn.dev`, add a CNAME record. Host `socks`, answer `alpasaam.github.io`.

The game is then at https://socks.saamn.dev. Link to it from the portfolio.

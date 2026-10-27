# Sock Drawer

An endless laundry game. Socks step along a clothesline toward a drawer, one peg at a time. You can only swap neighbors. The sock at the end hops into the drawer and waits for the next one to match it.

The line deals itself. A new sock hops on at the far end with every step, and a match is always a few neighbor-swaps from the drawer. More patterns join as your streak grows, and the beats get shorter. Three mismatches jam the drawer.

## Play

- Drag a sock sideways through its neighbor to swap them.
- Or tap a sock, then tap the one beside it.
- A bead travels the line. When it reaches the drawer, every sock steps one peg closer.
- The end sock hops in and waits. The next step folds a match, or drops a mismatch and costs a life.
- Tap the drawer to take that step early once the next sock is right.
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

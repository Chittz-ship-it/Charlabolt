# Charlabolt — Idle Edition

A Canabalt-inspired endless runner with idle mechanics, upgrades, and character customisation. Built with React + Vite. No external dependencies beyond React itself.

## Play

- **Jump:** `Space`, `↑`, `W`, or tap/click the canvas
- **Goal:** run as far as possible, collect coins, buy upgrades

## Features

- Procedurally generated rooftop city
- Parallax background layer
- Particle effects and motion trail
- Coin collection
- **Upgrades:** Jump Boost, Max Speed, Idle Income, Double Jump, Edge Grip
- **Customisation:** 8 colour skins with glow effects
- **Idle income:** earn credits while away (scales with your best run)
- **Persistent save:** progress saved to `localStorage`

---

## Local Development

```bash
npm install
npm run dev
```

Then open [http://localhost:5173](http://localhost:5173).

## Build

```bash
npm run build
```

Output goes to `dist/`. This is a static site — just serve the `dist/` folder anywhere.

---

## Deploy Options

### Netlify (easiest — drag and drop)
1. Run `npm run build`
2. Go to [netlify.com](https://netlify.com) → drag the `dist/` folder onto the deploy area
3. Done — you get a live URL instantly

### Vercel
```bash
npm i -g vercel
vercel
```
Vercel auto-detects Vite. Just follow the prompts.

### GitHub Pages
1. Push this repo to GitHub
2. Install the deploy helper:
   ```bash
   npm install --save-dev gh-pages
   ```
3. Add to `package.json` scripts:
   ```json
   "deploy": "gh-pages -d dist"
   ```
4. Also set `base` in `vite.config.js` to your repo name:
   ```js
   base: '/your-repo-name/',
   ```
5. Then:
   ```bash
   npm run build && npm run deploy
   ```
6. Enable GitHub Pages in your repo Settings → Pages → Branch: `gh-pages`

### Any static host (Cloudflare Pages, Render, S3, etc.)
Run `npm run build` and upload the `dist/` folder. It's just HTML + JS + CSS.

---

## Project Structure

```
charlabolt/
├── index.html          # Entry HTML
├── vite.config.js      # Vite config
├── package.json
└── src/
    ├── main.jsx        # React root
    └── App.jsx         # Entire game (single file)
```

## License

MIT — do whatever you want with it.

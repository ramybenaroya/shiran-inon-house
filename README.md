# הבית של שירן וינון · 3D

An interactive 3D model of the Polon family's (משפחת פולון) two-storey semi-detached house, built with
[three.js](https://threejs.org) from the house's 1:50 plan. Walls, openings and the U-shaped stair come
from the vector drawing; the furniture follows the layouts sketched on the plan.

- **Exterior view:** orbit around the house, the patio and its pergola, and switch floors to see each storey from above.
- **Walk-through:** first-person tour with stairs and the roof (keyboard and mouse, or touch joysticks).
- **Time of day:** real sun position over the Jerusalem hills; the lights come on after sunset.

## Develop

```bash
npm install
npm run dev
```

`npm run build` writes the static site to `dist/`. Pushing to `main` deploys it to GitHub Pages.

Textures: CC0 from [Poly Haven](https://polyhaven.com); Jerusalem stone, tiles and rugs are generated in the browser.

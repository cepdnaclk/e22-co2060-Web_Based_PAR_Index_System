# Automated PAR Index Calculation System — Project Site Source

This `docs/` folder is the source for the GitHub Pages project showcase:
**https://cepdnaclk.github.io/e22-co2060-Web_Based_PAR_Index_System/**

## Site structure

Static HTML/CSS/JS — no Jekyll build step (see `.nojekyll`):

```text
docs/
├── index.html                  # The full project showcase page
├── assets/
│   ├── css/style.css           # Design system & component styles
│   ├── js/main.js              # Nav, scroll reveal, gallery filters, lightbox
│   └── images/
│       ├── hero/                # Hero / project overview image
│       ├── screenshots/         # System Interface screenshots (placeholders)
│       ├── ml/                  # AI/ML visualizations (placeholders)
│       ├── architecture/        # Exported architecture diagrams (placeholder)
│       ├── development/         # Working sessions, coding, testing (placeholders)
│       ├── gallery/              # General/concept images
│       ├── team/                 # Team member photos
│       └── supervisors/          # Supervisor photo(s)
├── data/                        # Original source images (unedited)
└── .nojekyll                     # Disables Jekyll processing on GitHub Pages
```

> This previously used the `cepdnaclk/eYY-project-theme` Jekyll remote theme.
> It was replaced with a fully custom static site so the project could get a
> proper visual showcase. For deep technical documentation (installation,
> API reference, configuration), see the
> [repository README](https://github.com/cepdnaclk/e22-co2060-Web_Based_PAR_Index_System#readme)
> — that stays the source of truth for setup and API details.

## Adding a future photo

Every image slot on the page uses the same reusable pattern:

```html
<div class="media-card" data-category="...">
  <div class="media-frame">
    <img src="assets/images/<category>/<file>.jpg" alt="Describe the image" loading="lazy">
  </div>
  <div class="media-caption"><b>Title</b>Short description</div>
</div>
```

1. Put the photo in the matching `assets/images/<category>/` folder.
2. Give it a clear filename (e.g. `login-page.jpg`, `demo-day-01.jpg`).
3. Open `index.html`, search for the section's `<!-- FUTURE PHOTOS -->` comment
   (there's one above System Interface, Architecture, AI/ML, Team/Supervisor,
   and Gallery) to find the right placeholder.
4. Replace that placeholder's `<div class="media-placeholder">…</div>` block
   with the `<img>` line shown above, using your file's path.
5. Add a short caption in the existing `.media-caption` block.
6. Preview locally (`python3 -m http.server 8000` from `docs/`), then commit.

Full step-by-step instructions and the folder map are also kept as an HTML
comment near the end of `index.html` (search for "FUTURE PROJECT PHOTOS").

The Gallery section additionally supports category filter chips
(`data-filter` / `data-category="concept|development|demo"`) — add more
photos to those categories at any time; the grid and filters already scale
from a few images to 20+ without any redesign.

## Team

- E/22/014, M.K.H. Ahamed (Team Leader), [e22014@eng.pdn.ac.lk](mailto:e22014@eng.pdn.ac.lk)
- E/22/034, M.A.M. Assadh, [e22034@eng.pdn.ac.lk](mailto:e22034@eng.pdn.ac.lk)
- E/22/035, M.F.M. Ayyash, [e22035@eng.pdn.ac.lk](mailto:e22035@eng.pdn.ac.lk)
- E/22/036, M.N. Aamir, [e22036@eng.pdn.ac.lk](mailto:e22036@eng.pdn.ac.lk)

## Supervisor

- Dr. Asitha Bandaranayake, [asithab@eng.pdn.ac.lk](mailto:asithab@eng.pdn.ac.lk)

## Links

- [Project Repository](https://github.com/cepdnaclk/e22-co2060-Web_Based_PAR_Index_System)
- [Project Page](https://cepdnaclk.github.io/e22-co2060-Web_Based_PAR_Index_System/)
- [Department Project Listing](https://projects.ce.pdn.ac.lk/co2060/e22/Web_Based_PAR_Index_System/)
- [Department of Computer Engineering](http://www.ce.pdn.ac.lk/)
- [University of Peradeniya](https://eng.pdn.ac.lk/)

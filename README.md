# Portfolio Website – Raihan Abdillah Isnandi

Static portfolio site (Vite + vanilla HTML/CSS/JavaScript). It is NOT a React/TypeScript/Tailwind project.

## Requirements
- Node.js 18+ and npm

## Install
```bash
npm install
```

## Run locally
```bash
npm run dev
```
Open the URL shown in the terminal (usually http://localhost:5173).

## Build and preview
```bash
npm run build     # output in dist/
npm run preview
```

## Structure
- `index.html` – page markup and SEO meta tags
- `src/styles.css` – design tokens, light/dark theme, responsive layout, animations
- `src/data.js` – all editable content (experience, projects, certificates, skills, links)
- `src/main.js` – rendering, theme toggle, navigation, scroll reveal, modals, contact form
- `public/` – static assets (placeholders, see below)

## Missing assets (placeholders)
- CV file → `public/files/`, then set `DATA.cv` in `src/data.js`
- Profile photo, project screenshots → `public/images/`
- Certificate images/files → `public/certificates/`
- Dates for the nyuruhaja_pwt and freelance entries (currently "to be confirmed")

## Notes
- The page has two views: home sections and the certificates page (`#certificates`).
- The contact form has no backend; it opens the visitor's email app via `mailto:`.
- No API keys or secrets are used or required.

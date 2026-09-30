# AI4Health Lab website

Live at https://ualbany-ai4health.github.io — built by GitHub Pages (Jekyll) on every push to `main`.

## Editing content

Most edits need only one file in `_data/`:

| What | File |
|---|---|
| Add a paper | `_data/publications.yml` → copy a block under `articles:` (newest first) |
| Add a person | `_data/people.yml` → add under `postdocs`, `students` or `alumni` |
| Add a photo | put it in `assets/people/`, then set `photo: /assets/people/name.jpg` |
| Research themes | `_data/research.yml` |
| Contact details, menu | `_config.yml` |

Page layouts are in `_layouts/`, styles in `assets/css/style.css`.

## Local preview

```bash
bundle install
bundle exec jekyll serve
```

Then open http://localhost:4000.

# Avana Medical Devices website

Static website (HTML, CSS and JavaScript, no build step). It started as a single-file Claude artifact and was split into separate files on 2026-10-06; the content and design are unchanged from that version.

## Folder structure

```
Avana_medical_v2/
├── index.html              All page markup (one page, sections switched by the router)
├── css/
│   ├── base.css            Small reset (margins, image sizing, [hidden])
│   └── styles.css          All site styles: colours and fonts are variables at the top (:root)
├── js/
│   ├── main.js             Menus, mobile nav, page router, Careers bloom, Contact office map, video controls
│   ├── careers-modal.js    "Open positions" pop-up form on the Careers page
│   ├── card-slides.js      Fades each Careers card through its photo set
│   └── videos.js           Loads each background video when its page is first opened
├── images/
│   ├── logos/              Avana, Arthrex, e.CHI, MovMedix (-dark for light backgrounds, -white for dark)
│   ├── arthrex/            Arthrex category cards (shoulder, knee, …)
│   ├── movmedix/           MovMedix category cards
│   ├── echi/               e.CHI FrequenzChip products
│   ├── team/               Leadership photos
│   ├── events/             Company events and team life (Careers, About)
│   ├── careers/            Photo sets for the Careers cards: discover/, creativity/, growth/
│   ├── posters/            Still frame shown while each video loads
│   ├── icons/              Small UI graphics
│   └── textures/           Background texture
├── videos/                 Background videos (.mp4)
└── serve.js                Local preview server (development only)
```

## Pages

The site is a single page. The address after `#` picks the section, and `js/main.js` shows that section and hides the rest:

| Address        | Section in index.html            |
|----------------|----------------------------------|
| `#home`        | `<div data-page="home">`         |
| `#about`       | `<div data-page="about">`        |
| `#team`        | `<div data-page="team">`         |
| `#contact`     | `<div data-page="contact">`      |
| `#arthrex`     | `<div data-page="arthrex">`      |
| `#echi`        | `<div data-page="echi">`         |
| `#movmedix`    | `<div data-page="movmedix">`     |
| `#careers`     | `<div data-page="careers">`      |

Links between sections use `href="#about" data-route="about"`.

## Run it locally

Open a terminal in this folder and run:

```
node serve.js 8097
```

Then open http://localhost:8097. Use the server rather than double-clicking `index.html`, so the videos and fonts load the same way they will online.

## Common changes

- **Text:** edit `index.html`. Search for the heading you want to change.
- **Image:** replace the file in `images/` with one of the same name and shape. To use a new file name, update the `src` in `index.html`.
- **Careers card photos:** add a JPG to `images/careers/<card>/` and an `<img>` line inside that card's `data-slides` block in `index.html`. Each photo shows for about 4.5 seconds.
- **Video:** replace the `.mp4` in `videos/` with one of the same name. Keep videos short, muted and under about 3 MB, and update the matching still in `images/posters/`.
- **Full-length source videos** (for example `Arthroknee Post Event Video Final.mp4`, 268 MB) stay on your computer only: `.gitignore` keeps files with "Final" in the name out of git, because GitHub rejects files over 100 MB. `videos/about-arthroknee.mp4` (the About Us background) is the full 92-second video, muted and compressed to 720p (6.7 MB).
- **Colours and fonts:** change the variables at the top of `css/styles.css` (`--gold`, `--charcoal`, `--sand`, …).
- **Product highlight of the month:** the hero block at the top of `<div data-page="home">`.

## Still to do

- **Careers form:** `js/careers-modal.js` has `CAREERS_ENDPOINT = ''`. Until it is set to a form or email service, the form shows a confirmation but sends nothing. The original notes mention a `careers-email.html` email template that is not in this folder.
- **Fonts:** Figtree from Google Fonts. The CSS notes plan a switch to Proxima Nova once Avana has an Adobe Fonts kit.

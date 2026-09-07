# Kicker Development Plan — App

A shareable workout tracker for your son's kicking program, themed in Plano Senior
High Wildcats maroon and white. Works as an installable app on iOS and Android (PWA)
with no App Store needed, hosted free on Netlify.

## What it does
- Weekly workout plan (pre-loaded with the plan we built), editable any time
- Daily check-off tracking + a notes field per day
- **Video links per day**: paste an unlisted YouTube or Google Drive video link and
  it embeds right in the app — great for form-check clips tied to that day's workout
  (see "Why links instead of uploads" below)
- **Coach view**: coach can suggest edits/adds/removals — they show up highlighted
  in gold until your son taps **Accept**
- Progress tab: weekly completion chart, streak counter, and a kick-distance log
  with a trend chart (great for tracking "kicking further" over the season)
- History tab: a timeline of every day's notes, completion, and any attached video
- Two shareable links — one for your son, one for the coach — same data, different
  permissions

## Why links instead of direct video uploads
Netlify's serverless functions cap request payloads at about 4.5MB — smaller than
almost any real video clip. Rather than build a broken/limited upload experience,
the app uses video *links* instead: upload the clip to YouTube (set to "Unlisted"
so it's not publicly searchable) or Google Drive (share as "Anyone with the link"),
then paste that link into the app. It plays inline, costs nothing, and has no
practical size limit.

## Deploy it (takes about 5 minutes, free)

**Option A — Drag and drop (fastest, no coding tools needed)**
1. Go to https://app.netlify.com/drop
2. You'll need a free Netlify account (sign up with email or Google/GitHub) — do that first at https://app.netlify.com/signup
3. Once logged in, go to your team's "Sites" page and look for the drag-and-drop upload area
4. Drag the whole `kicker-app` folder onto it
5. **Important:** drag-and-drop deploys don't run `npm install` for functions automatically in
   all cases — if the app loads but data doesn't save, use Option B instead, which handles
   this correctly.

**Option B — Connect to GitHub (recommended, auto-installs everything correctly)**
1. Create a free GitHub account if you don't have one: https://github.com/signup
2. Create a new repository (e.g. `kicker-app`) and upload this whole folder to it
   (GitHub's website lets you drag-and-drop files to upload, no command line needed)
3. Go to https://app.netlify.com and sign up / log in
4. Click **Add new site → Import an existing project → Deploy with GitHub**
5. Pick your `kicker-app` repository
6. Netlify will auto-detect the settings from `netlify.toml` — just click **Deploy**
7. Wait ~1 minute for the first deploy to finish

Either way, once deployed you'll get a URL like `https://random-name-123.netlify.app`.
You can rename it in Netlify's site settings to something like `https://smith-kicker-plan.netlify.app`.

## First-time setup (after deploying)
1. Open your new site URL on your phone
2. Tap **"Create a New Plan"**
3. You'll land in the **Team** tab (bottom right) — copy the **Athlete link** and the
   **Coach link**
4. Send the athlete link to your son, the coach link to the coach
5. Each person opens their link, then uses their browser's **Share → Add to Home Screen**
   (iOS Safari) or **Install app** (Android Chrome) so it sits on their home screen like
   a normal app

## How privacy works
There's no password — access is controlled by a private "family code" baked into each
link (you'll see it in the URL, e.g. `?token=ab12cd34`). Anyone with a link can view and
edit according to their role, so only share the two links with your son and the coach.
This is fine for family/team use, but isn't bank-level security — don't post the links
publicly.

## Customizing further
- To change the starting plan, edit `DEFAULT_DAYS` in `netlify/functions/data.js`
  before your first deploy (it only seeds once per family code)
- Icons are in `public/icons/` — swap in your own PNGs (192x192 and 512x512) if you want
- Colors/theme are set in `public/styles.css` under `:root`

## A few ideas for later, if useful
- Add a second athlete by generating another family code (each code is fully separate data)
- A "PR" flag on the kick log for personal-best distances
- Export the history tab to share with a recruiting coach

## Local structure
```
kicker-app/
  netlify.toml              # Netlify build config
  package.json              # function dependency (@netlify/blobs)
  netlify/functions/data.js # backend API (reads/writes the shared plan)
  public/
    index.html
    app.js                  # all app logic
    styles.css
    manifest.json           # PWA config
    sw.js                   # offline/installability support
    icons/
```

# Demo GIFs

The GIFs in the main README are recorded from the running app with Playwright. They use
fake sample data and the mock LLM, so no API keys and no personal data are needed.

| GIF         | Steps file        | Script         | Viewport      |
| ----------- | ----------------- | -------------- | ------------- |
| `route.gif` | `route.web.steps` | `route.web.js` | 1280x720      |
| `trip.gif`  | `trip.web.steps`  | `trip.web.js`  | 1280x720      |
| `walks.gif` | `walks.web.steps` | `walks.web.js` | 390x844 at 2x |

## What you need

- The backend and frontend set up as in the main README.
- Google Chrome (the scripts use `playwright-core`, already in `frontend/` dev dependencies,
  with `channel: 'chrome'`).
- [ffmpeg](https://ffmpeg.org/) on your `PATH` (Windows: `winget install Gyan.FFmpeg`).

## Record again

1. Add the sample data. It uses one fake client id, so your own walks stay as they are.
   From `backend/`:

   ```
   python manage.py shell -c "exec(open('../docs/demo/seed_demo_recording.py').read())"
   ```

2. Start the backend in mock mode and the frontend:

   ```powershell
   # Windows PowerShell, from backend/
   $env:LLM_BACKEND = "mock"; $env:WEATHER_PROVIDER = "mock"; python manage.py runserver
   ```

   ```bash
   # Linux/macOS, from backend/
   LLM_BACKEND=mock WEATHER_PROVIDER=mock python manage.py runserver
   ```

   Then `npm run dev` in `frontend/` (it must run on `http://localhost:5173`).

3. Record. Run this from a folder outside the repo, because the scripts write PNG frames
   into `demo-video/<name>-frames/` in the current folder (`<repo>` is the path to this
   repository):

   ```bash
   NODE_PATH=<repo>/frontend/node_modules node <repo>/docs/demo/route.web.js
   ```

   In PowerShell: `$env:NODE_PATH = "<repo>\frontend\node_modules"; node <repo>\docs\demo\route.web.js`

   The scripts take frames from Chrome's screencast (lossless PNG, with the real time of each
   frame in `frames.txt`) instead of Playwright's video. The video is compressed and noisy,
   which makes GIFs big, and on a phone viewport it is only 390 px wide. `walks` renders at 2x.

4. Make a 25 fps GIF. GIF frame times are in 1/100 s, so 25 fps (4/100 s) plays evenly;
   30 fps does not. `trim` cuts the page load at the start:

   | GIF     | `START` | `WIDTH` | `COLORS` |
   | ------- | ------- | ------- | -------- |
   | `route` | 3       | 1000    | 128      |
   | `trip`  | 1.5     | 1000    | 128      |
   | `walks` | 1.2     | 640     | 64       |

   ```bash
   NAME=route START=3 WIDTH=1000 COLORS=128
   F="trim=start=$START,setpts=PTS-STARTPTS,fps=25,scale=$WIDTH:-1:flags=lanczos"
   ffmpeg -y -f concat -i demo-video/$NAME-frames/frames.txt -vf "$F,palettegen=max_colors=$COLORS:stats_mode=diff" palette.png
   ffmpeg -y -f concat -i demo-video/$NAME-frames/frames.txt -i palette.png \
     -lavfi "[0:v]$F[x];[x][1:v]paletteuse=dither=none:diff_mode=rectangle" <repo>/docs/demo/$NAME.gif
   ```

5. Watch the GIF from start to end and check that no private data is visible. Do not commit
   `demo-video/` or `palette.png`. Each GIF must stay under 5 MB.

To change a demo, edit the `.web.steps` file and regenerate the script with the
`demo-recorder` skill's `make_demo.py web`, then apply the same small changes as in the
current scripts (`playwright-core`, `channel: 'chrome'`, the `localStorage` init script and
the screencast code that writes the frames).

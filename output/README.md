# SCIA 2026 Highlight: Phase 2 deliverables

## v5 changes
- **Cold open:** your supplied hook (Clive Hendricks, Intel): "I've been in supply chain now over twenty years. I've never seen conditions like this. To navigate today's challenges, we need new tools that can make us more agile." On screen:
  - a 20+ years odometer over the port aerial
  - "I've never seen conditions like this"
  - a slow push into Intel's own "Weathering the Supply Chain Storm" slide (the supply-chain ship among risk icebergs), with "We need new tools"
- **"From firefighting to foresight"** is back in Intel's segment. The segment now opens directly on "Supply chains are being used as a weapon…", so "never seen conditions" is only heard in the cold open.
- The proof montage was removed, since your hook fills the opening.
- **Timing:** finalist cards now start at 0:17.5 / 0:36.5 / 0:55.5 / 1:13.5 / 1:33.5. The ending starts at 1:51, and the white logo card at 1:57.5.

## v4 changes
- **Hook:** Intel's "from firefighting to foresight" now opens the film. Intel's segment cuts from "with Platform MI in place," straight to "5,000 parts protected", so the line isn't heard twice. Reliance's "Safety is not a cost" (with Arush on camera) is back in their segment.
- **Count-ups:** every counter is now a rolling-digit odometer with the layout locked to the final number, so nothing jitters or re-centres. Digits roll continuously with soft edge fades and a little motion blur.
- **Sound design rebuilt:** big impacts are down from 36 to 3 (title, "1 winner", "zero fatalities"). Everything else comes from a 21-sound palette, all tuned to D minor:
  - tuned felt-mallet card hits that climb a step per finalist
  - rising chord stabs on the proof montage
  - soft "lock" clicks when numbers settle
  - reverse swells that land on key words
  - glassy bell shimmers on reveals
  - deep pulses for emphasis, a tension drop on "are my systems ready?", and a rising sweep for the payback curve

  Every instance gets seeded variation, so repeated sounds never sound identical.

## v3 changes
- **New opening:** Arush Kishore (Reliance) on camera: "Safety is not a cost. It can drive efficiency." Then a proof montage of one headline number per finalist, with logos (3M parcels/day · 5,000 parts protected · 5:00→2:00 check-in · 88% fewer high-risk parts · 0 fatalities), into the title.
- **"Weapon" line** now sits inside Intel's segment as the problem statement before "firefighting to foresight". It's neutral: no red grade, glitch, shake or "state level" chip. Red is now reserved for achievements.
- **"Pays for itself"** is now a payback curve: investment dip → break-even flash → return.
- **Reliance logo:** your original file, cleaned and upscaled.
- The ≈$2B line was cut (its slide said $1B+). Intel's segment ends on 5,000 parts protected.

## v2 changes
- Finalist lineup (title), chapter cards and the end wall now use **white logo tiles** (Intel ×2, GOFO, Georgia-Pacific × project44, Reliance). The two Intel entries are told apart by a tag line under each tile ("Market Intelligence" / "Chem & Gas Control Tower").
- **CSCMP seal + SupplyChainBrain** logos open the title ("…present").
- New footage: the **port aerial** plays behind the cold open (it turns red on "weapon") and behind "See them live". The **glass-panel light trace** plays behind the title and the "5 finalists, 1 winner" wall. The glass clip was slowed with motion interpolation to fill 7 s.
- **Speakers on camera** with broadcast lower thirds: Ron Jansen (GOFO), Andrew Wadolny (Intel), Tom Cahill (GP × project44), Arush Kishore (Reliance). Lip sync is exact for the first three. Webcam tiles were upscaled ×3, denoised and sharpened.
- Sound: the count-up "ticks" are now a soft filtered swell, and the "pop" is a muted felt tap.
- Fixes: "Best in class" no longer clips, "Proceed to dock" isn't blocked, and "Reliance Industries" fits. A fit-to-frame safety net now shrinks any headline that would leave the frame.

| File | What it is |
|---|---|
| `SCIA2026_Highlight_v5.mp4` | 2:00, 1920×1080, 30 fps, H.264. Finalist footage + motion graphics + captions + **finalist dialogue + synthesized SFX**. **No music, no VO** (yours to add). |
| `stems/dialogue.wav` | Finalist dialogue only, re-cut to the new timeline (48 kHz / 24-bit) |
| `stems/sfx.wav` | Sound design only (whooshes, hits, ticks, PA chime, flip-board clacks, truck, clock) |
| `stems/dialogue_plus_sfx.wav` | The audio that's in the MP4 |
| `VOICEOVER_SCRIPT.md` | 7 VO lines with exact in-points, for ElevenLabs |
| `SUNO_MUSIC_PROMPT.md` | Style + structure prompt, 120 BPM, with a hit map |

All stems start at 0:00 and are exactly 2:00. Drop them in at the head of the timeline.
The dialogue+SFX audio sits at about **-21 LUFS** integrated (peaks at -1.5 dBFS), which leaves room for music + VO. Master the final mix to **-14 LUFS** (true peak -1 dB).

## Structure
| Time | Section |
|---|---|
| 0:00–0:10 | Cold open (supplied hook): Clive Hendricks, Intel. 20+ years · never seen conditions like this · weathering the storm · we need new tools |
| 0:10.5–0:17.5 | Title: CSCMP & SupplyChainBrain present · Supply Chain Innovation Award™ · finalists (VO1) |
| 0:17.5–0:36 | 01 Intel: Market Intelligence (used as a weapon · Platform MI · firefighting → foresight · 5,000 parts) |
| 0:36.5–0:55 | 02 GOFO (Ron Jansen on camera · 500K → 3M parcels/day · built from zero in 3 years · Atlas) |
| 0:55.5–1:13 | 03 Intel: Control Tower (Andrew Wadolny on camera · last line of defense · $1M/site/day · 88% · best in class) |
| 1:13.5–1:33 | 04 Georgia-Pacific × project44 (live yard call · Tom Cahill on camera · 5:00 → 2:00 · 66% · shipper of choice) |
| 1:33.5–1:51 | 05 Reliance (a death every 3 minutes · Arush: safety is not a cost · zero fatalities · −46% fleet · pays for itself) |
| 1:51–2:00 | 5 finalists → 1 winner → CSCMP EDGE Nashville Oct 4–7 → logo lockup |

## Please check before this goes public
1. **GP "66%"**: the speaker says 5 min → 2 min, which is 60%. Their own title says "under 2" (so 66% ≈ 1:42). The graphic shows the clock landing on 2:00 and then "66%", as spoken. Consider having the clock land on "1:40", or confirm the number with GP.
2. ~~Intel MI ≈$2B~~: cut in v3.
3. **Card subtitles**: GOFO's ("Building a National Parcel Network from Zero with Atlas") and Reliance's are my wording, based on what they presented. Swap in the official submission titles if you have them.
4. **Reliance speaker shot** (1:38–1:41) uses Arush Kishore's webcam from a moment just after the line he's saying, so lip sync is loose.
6. **Lower-third names** come from the Teams labels: Ron Jansen (GOFO), Andrew Wadolny (Intel), Tom Cahill. Tom is labelled "GP × project44" because I couldn't tell which company he's with. Confirm names and affiliations.
7. **Reliance logo**: now your original file (`motion/assets/logo_reliance.png`).
8. **project44** appears as text ("× project44") because no logo file was supplied.
9. **Intel MI (Clive Hendricks)** has no on-camera shot: his webcam tile is tiny and he's turned away from camera. He's credited as a name only in the cold open; confirm the spelling.
5. **Event dates**: "Mon · Oct 5: finalists present live" and "Tue · Oct 6: winner revealed on the main stage" come from your brief.

## Re-rendering / editing (in `motion/`)
```
npm i                          # playwright-core + fonts
# frames are extracted from the Phase 1 rough-cut export:
ffmpeg -i rough_cut.mp4 -q:v 2 assets/frames/%05d.jpg
ffmpeg -i rough_cut.mp4 -vn -ac 2 -ar 48000 assets/dialogue_src.wav
python3 build_dialogue.py      # dialogue stem + envelope from timeline.json
node render.mjs sfx && python3 synth_sfx.py   # sound design (all synthesized)
node render.mjs sheet 12 40 88 # contact sheet of any timestamps → build/sheet.png
node render.mjs full 4         # full render, 4 parallel browsers
python3 mux.py                 # mix, normalize, mux → output/
```
- `timeline.json` holds the edit: source in/out for each dialogue clip, and the captions.
- `film.js` holds every shot. Each frame is a pure function of time (`window.seek(t)`), using seeded randomness only.

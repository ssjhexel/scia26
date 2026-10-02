# SCIA 2026 Highlight: Phase 2 deliverables

| File | What it is |
|---|---|
| `SCIA2026_Highlight_v1.mp4` | 2:00, 1920×1080, 30 fps, H.264. Finalist footage + motion graphics + captions + **finalist dialogue + synthesized SFX**. **No music, no VO** (yours to add). |
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
| 0:00–0:10 | Cold open: Intel ("never seen conditions like this… supply chains as a weapon") |
| 0:10.5–0:17.5 | Title: Supply Chain Innovation Award™ · The 2026 Finalists (VO1) |
| 0:17.5–0:35 | 01 Intel: Market Intelligence (foresight · 5,000 parts · ≈$2B shielded) |
| 0:35.5–0:54 | 02 GOFO (500K → 3M parcels/day, built from zero in 3 years, Atlas) |
| 0:54.5–1:12 | 03 Intel: Control Tower (last line of defense · $1M/site/day · 88% · best in class) |
| 1:12.5–1:32 | 04 Georgia-Pacific × project44 (live yard call · 5:00 → 2:00 · 66% · shipper of choice) |
| 1:32.5–1:50 | 05 Reliance Industries (a death every 3 minutes · safety ≠ cost · zero fatalities · −46% fleet) |
| 1:50–2:00 | 5 finalists → 1 winner → CSCMP EDGE Nashville Oct 4–7 → logo lockup |

## Please check before this goes public
1. **GP "66%"**: the speaker says 5 min → 2 min, which is 60%. Their own title says "under 2" (so 66% ≈ 1:42). The graphic shows the clock landing on 2:00 and then "66%", as spoken. Consider having the clock land on "1:40", or confirm the number with GP.
2. **Intel MI "≈$2B"**: shown as spoken ("closer to 2 billion"). Their slide says "$1B+ revenue shielded".
3. **Card subtitles**: GOFO's ("Building a National Parcel Network from Zero with Atlas") and Reliance's are my wording, based on what they presented. Swap in the official submission titles if you have them.
4. **Reliance speaker shot** (1:37–1:40) uses Arush Kishore's webcam from a moment just after the line he's saying, so lip sync is loose at that size. The lower third names him "VP, Reliance Industries Limited", taken from his closing slide.
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

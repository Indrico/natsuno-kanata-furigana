# Natsuno Kanata furigana patch

For Windows installation without Python, download the ready-to-copy ZIP from
the [latest release](https://github.com/Indrico/natsuno-kanata-furigana/releases/latest)
and follow the [installation guide](../README.md).

Copy this directory into the game folder alongside `resources`, then apply it
with `python3 furigana-patch/apply.py` from the game folder (Python 3.11+).
See the [installation guide](../README.md) for the full Windows instructions.
After applying the patch, start the game, open the gear menu, and click
**ふりがな : OFF** to enable readings. Click again to turn them off.
The preference is saved between launches. The first enable loads the bundled
dictionary and briefly shows `準備中…`.

Readings cover Japanese dialogue, exploration text, menus, and other HTML text.
They use the local kuromoji.js/IPADIC dictionary, with no remote reading service.
Kana endings stay outside the ruby where they match the dictionary reading.
Names and ambiguous words can have imperfect automatic readings; unknown words
without dictionary readings remain as written. Text baked into images is not annotated.

## Restore or rebuild

Close the game before running either command, from the game folder. These
commands require Python 3.11 or newer (`py` can replace `python3` on Windows).

```sh
# Restore the byte-for-byte original game archive.
python3 furigana-patch/apply.py --restore

# Reapply, or rebuild after editing files in furigana-patch/payload/.
python3 furigana-patch/apply.py
```

The backup is `../resources/app.asar.original`. Keep it to allow restoration.
The patcher verifies its SHA-256, builds a temporary archive, and replaces the
active archive after writing finishes. Rebuilding always uses that verified
original plus the current payload.

Original SHA-256:
`2d5b5b289c6eb177f0c7ca68a4c778e4fe68c90a654b6f182042f3388325549d`

## Reverse-engineering findings

The investigation followed the [REA JavaScript artifact inspection guide](https://github.com/morluto/rea/blob/main/docs/javascript-artifact-reconstruction.md):
inventory the application archive, inspect its entry points and text pipeline,
then verify behavior in an isolated runtime profile.

The Windows executable embeds Electron **12.0.5 / Chromium 89.0.4389.128**.
`resources/app.asar` contains 1,057 files, including readable JavaScript and CSV
scenario data. The game displays version **1.2.11**; its Electron package metadata
uses version **1.0.0**.

| Archive path | Role and change |
| --- | --- |
| `main.js` | Creates a BrowserWindow and loads `app/index.html`. |
| `app/index.html` | Loads the reading scripts and stylesheet, and adds a button below the settings columns. |
| `app/js/app/ui/optionWindow.js` | Builds the original two-column settings menu. |
| `app/js/app/ui/textLine.js` | Shared story/exploration typewriter. Ruby words and nested formatting move as complete DOM elements. Command handlers remove readings before passing text to the game's input. |
| `app/js/system/utility/tag.js` | Expands game color and command tags before rendering. |
| `app/js/app/option/furigana.js` | Loads the dictionary, generates ruby, watches new UI text, and persists the toggle. |
| `app/style/furigana.css` | Styles readings and the new button, and gives dialogue room for ruby. |
| `app/resources/furigana/dict/` | Bundled compressed IPADIC dictionaries. |

The independent ASAR comparison found only two changed original files:
`app/index.html` and `app/js/app/ui/textLine.js`. The other 1,055 original files
match byte for byte. Added files contain the reading implementation, dictionary,
and third-party license notices. The payload adds about 17 MiB to the archive.

The setting uses localStorage key `natsuno-kanata.furigana.enabled` and defaults
to OFF. Active typewriter spans are excluded from background annotation so
incomplete words are not guessed. Annotated words reveal as complete units,
keeping their readings together; remaining text reveals character by character.
Enabling during an existing line adds its readings when that line finishes.

kuromoji.js **0.1.2** comes from [takuyaa/kuromoji.js](https://github.com/takuyaa/kuromoji.js).
Its Apache license and IPADIC notices are bundled in `app/resources/furigana/`.

## Verification

The packaged ASAR was run using **Electron 12.0.5 on Linux**, through `file://`
with a separate test profile. The original Windows executable has not been
launched on this Linux host.

Runtime checks cover dictionary loading from ASAR, ON/OFF visibility, saved
preferences after reload, Japanese readings and kana endings, nested HTML,
unknown characters, emoji, typewriter completion, toggling during typing,
command clicks for both characters, and the actual opening story. The runtime
test asserts that no uncaught renderer exceptions occur.

Evidence is in `evidence/`, including menu/story screenshots and JSON results.
`test-runtime.cjs` requires Node 22+ and a separately launched test instance with
`--remote-debugging-port=9317` and an isolated `--user-data-dir`. Run:

```sh
node furigana-patch/test-runtime.cjs
```

The test changes settings and advances the opening story in that test profile.
Use an isolated profile when repeating it.

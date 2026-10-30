# Natsuno Kanata Furigana

Adds an **ON/OFF furigana setting** to Natsuno Kanata. Hiragana readings appear
above kanji in dialogue, exploration text, and menus, using a bundled offline
dictionary. The setting is remembered between launches.

![Furigana in the opening story](furigana-patch/evidence/story-on.png)

## Install on Windows — no Python

Download the ready-to-copy ZIP from the [latest release](https://github.com/Indrico/natsuno-kanata-furigana/releases/latest):
**`natsuno-kanata-furigana-v1.0.0-windows.zip`** under **Assets**.

This build is for the game displaying version **1.2.11** (Electron package
version 1.0.0).

1. Close the game.
2. Back up the game's original `resources/app.asar`, for example as
   `resources/app.asar.original`. Keep an existing original backup if you already
   have one.
3. Extract the release ZIP. Copy its `resources` folder into the game folder
   containing `natsuno-kanata.exe`. Choose **Replace** for `resources/app.asar`.
4. Start the game, open the gear menu, and click **ふりがな : OFF** to enable
   readings. Click again to turn them off.

The release ZIP contains the patched archive and the offline dictionary.
Installation does not require Python, Node.js, or a terminal.

## Build and install from source

You need an installed copy of the game and **Python 3.11 or newer**. This patch
was built for the game displaying version **1.2.11** (Electron package version
1.0.0). The installer checks the original archive's SHA-256 before applying it.

1. Download this repository using **Code → Download ZIP**, or clone it:

   ```sh
   git clone https://github.com/Indrico/natsuno-kanata-furigana.git
   ```

2. Copy the `furigana-patch` folder into the game folder containing
   `natsuno-kanata.exe`. The layout should look like this:

   ```text
   game-folder/
   ├── natsuno-kanata.exe
   ├── resources/
   │   └── app.asar
   └── furigana-patch/
       ├── apply.py
       └── payload/
   ```

3. Close the game and run this command from the game folder:

   ```sh
   py furigana-patch/apply.py
   ```

   If your Python command is `python3`, use `python3 furigana-patch/apply.py`.

4. Start `natsuno-kanata.exe`, open the gear menu, and click
   **ふりがな : OFF** to turn readings on. Click again to turn them off.
   The first enable briefly shows `準備中…` while the local dictionary loads.

[View the settings menu](furigana-patch/evidence/options-on.png).

## Restore

For the ready-to-copy release, close the game and replace `resources/app.asar`
with your original backup.

The Python installer preserves the original archive at
`resources/app.asar.original`. Close the game, then run this from the game folder:

```sh
py furigana-patch/apply.py --restore
```

Keep the backup if you want to restore the original game later. Run the install
command again to reapply the patch.

## Behavior and verification

Readings are generated automatically with **kuromoji.js 0.1.2 / IPADIC**.
Names and ambiguous words can have imperfect readings. Text inside images is
not annotated. The bundled dictionary adds about 17 MiB to the game archive.

The packaged patch passed checks for ON/OFF behavior, saved preferences,
typewriter rendering, switching during typing, command buttons, and the actual
opening story using **Electron 12.0.5 on Linux**. The original Windows
executable has not been tested on that host. Archive comparison verified that
1,055 of the 1,057 original files match byte for byte; the two changed originals
are the HTML entry point and shared text renderer.

See [implementation notes and test instructions](furigana-patch/README.md),
[runtime results](furigana-patch/evidence/runtime-verification.json), and
[archive verification](furigana-patch/evidence/archive-verification.json).

## Credits

The investigation followed the [REA JavaScript artifact inspection guide](https://github.com/morluto/rea/blob/main/docs/javascript-artifact-reconstruction.md).
Reading assistance uses [kuromoji.js](https://github.com/takuyaa/kuromoji.js).
Its [Apache license](furigana-patch/payload/app/resources/furigana/LICENSE-kuromoji.txt)
and [IPADIC notices](furigana-patch/payload/app/resources/furigana/NOTICE-kuromoji.md)
are included with the dictionary.

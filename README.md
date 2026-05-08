# web-didj

LeapFrog Didj and Leapster browser emulator shell.

## Features

- Browser-based emulator UI for Didj and Leapster themes
- Built-in Didj demo and Leapster demo programs
- JSON ROM loader for custom programs
- ZIP archive support (extracts JSON files)
- BIN file support (assumed to be JSON format)
- Keyboard + touch controls

## Usage

1. Open `index.html` in a modern browser.
2. Choose between `Didj` and `Leapster`.
3. Start the emulator and use arrow keys + `Z`/`X`.
4. Optionally load a ROM file: JSON, ZIP (containing JSON), or BIN (JSON format).

## Controls

- Arrow keys: D-pad
- `Z`: A button
- `X`: B button
- `Space`: Start the emulator

## Development

No build is required; this is a static web app.

Open `index.html` directly or serve the folder with a local web server.

<p align="center">
  <img src="icons/icon-128.png" width="96" height="96" alt="">
</p>

<h1 align="center">Sound Stickers</h1>

<p align="center">
  A Chrome extension that turns a video, image or GIF into a <b>WhatsApp sticker with sound</b>,<br>
  then sends it right from WhatsApp Web. Everything runs locally in your browser.
</p>

---

## Features

- **Three ways to make a sticker**
  - **Video** — trim a clip from any video; the picture and its own audio stay together.
  - **Image + audio** — a still image with any sound you pick.
  - **Video or GIF + audio** — a muted video or an animated GIF with a separate audio track (loop it, hold the last frame, or let each keep its own length).
- **Frame-accurate trimming** with draggable handles, a waveform for audio, and per-frame nudging.
- **Size planner** — estimates every resolution × fps combination against WhatsApp's 1 MB sticker limit and recommends the best one.
- **Pack & author metadata** shown under the sticker in WhatsApp.
- **Send anywhere** — to the open chat, or to your own chat and straight into WhatsApp's native *Forward* dialog.
- **Download** the `.webp` sticker and `.ogg` audio instead of sending.
- **Light & dark** UI that follows WhatsApp's theme.
- **Built-in log & diagnostics** with phone numbers masked, for bug reports.

## Install

The extension isn't on the Chrome Web Store, so you load it unpacked:

1. Download or clone this repository.
2. Open `chrome://extensions` (or `edge://extensions`).
3. Turn on **Developer mode**.
4. Click **Load unpacked** and select the repository folder.
5. Pin the extension and open [web.whatsapp.com](https://web.whatsapp.com).

Requires a recent Chrome or Edge (WebCodecs, `ImageDecoder` and `OffscreenCanvas`).

## Usage

1. Click the extension button. It opens WhatsApp Web, or toggles the panel if WhatsApp Web is already open.
2. Pick a tab, choose your file(s) and trim the clip.
3. Under **Format**, choose *Fit* or *Crop*, click **Estimate sizes** and pick a cell (★ = recommended).
4. Optionally set a pack name and author, then click **Create sticker**.
5. Preview it, choose where to send it, and click **Send**.

## How it works

| Step | Tech |
| --- | --- |
| Frame capture | `<video>` seeking / `requestVideoFrameCallback`, `ImageDecoder` for GIF/APNG/WebP |
| Sticker encoding | `OffscreenCanvas` → WebP frames, assembled into an animated WebP with WhatsApp's EXIF metadata |
| Audio encoding | Web Audio (mono mixdown, 48 kHz) → WebCodecs `AudioEncoder` (Opus) → hand-written Ogg muxer |
| Sending | WhatsApp Web's own internal modules upload the audio and attach it as `stickerAudio` |

```
src/
  logger.js   event log (masked), persisted through bridge.js
  bridge.js   isolated-world bridge to chrome.storage + extension messaging
  convert.js  video/GIF/image + audio → WebP + Ogg/Opus
  wa.js       WhatsApp Web integration (upload, send, forward)
  ui.js       Shadow DOM panel
  main.js     startup
background.js extension button handling
log.html/js   full log viewer (extension options page)
```

## Privacy

Media is processed entirely on your device. Nothing is sent anywhere except to WhatsApp itself, and only when you click **Send**. The log stays in local extension storage until you export or clear it.

## Disclaimer

This is an unofficial project and is not affiliated with, endorsed by, or sponsored by WhatsApp or Meta. It relies on WhatsApp Web internals that can change at any time.

## License

[PolyForm Noncommercial 1.0.0](LICENSE.md). Free for personal and other noncommercial use. This project is a modified version of an upstream work; the license's required copyright notice is kept in [LICENSE.md](LICENSE.md).

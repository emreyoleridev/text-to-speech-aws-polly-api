# Text to Speech Tool

A professional tool to generate realistic dialogue audio from text scripts using **Amazon Polly** and **FFmpeg**.

## 🚀 Features

- **Multi-Speaker Support**: Automatically maps speaker tags (`*MAN*`, `*WOMAN*`, `*NARRATOR*`) to diverse Amazon Polly voices (US, UK, Australian, Indian accents).
- **Auto-Pause**: Automatically inserts 500ms silence between dialogue lines for natural flow.
- **Custom Pauses**: Supports `<pause 2000>` tags for specific silence durations.
- **Narrator Control**: Uses SSML to slow down the Narrator voice for better clarity.
- **Secure & Fast**: No database required; processes files on-the-fly and cleans up automatically.

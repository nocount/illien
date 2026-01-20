# Illien

A minimal journaling app built with Tauri + React. Write daily journal entries that are saved as Markdown files.

## Features

- Clean, distraction-free writing interface
- Auto-save (debounced) as you type
- Dark/light theme support
- Entries saved as Markdown files with date-based naming (`YYYY-MM-DD.md`)
- Choose your own storage directory

## Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Rust](https://rustup.rs/)
- Platform-specific dependencies for Tauri:
  - **Windows**: Microsoft Visual Studio C++ Build Tools
  - **macOS**: Xcode Command Line Tools
  - **Linux**: `libwebkit2gtk-4.1-dev`, `libappindicator3-dev`, etc.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run in development mode:
   ```bash
   npm run tauri dev
   ```

3. Build for production:
   ```bash
   npm run tauri build
   ```

## Usage

1. On first launch, select a directory to store your journal entries
2. Start writing - your entry auto-saves after 1 second of inactivity
3. Each day gets its own file named by date (e.g., `2026-01-20.md`)
4. Toggle dark/light mode with the sun/moon button
5. Change storage directory via the settings gear icon

## Project Structure

```
illien/
├── src/                    # React frontend
│   ├── App.tsx             # Main app component
│   ├── App.css             # Styling
│   ├── main.tsx            # React entry point
│   └── components/
│       └── Editor.tsx      # Journal editor component
├── src-tauri/              # Tauri backend (Rust)
│   ├── src/
│   │   ├── main.rs         # Tauri entry point
│   │   └── lib.rs          # Commands for file operations
│   ├── Cargo.toml          # Rust dependencies
│   └── tauri.conf.json     # Tauri configuration
├── package.json            # Node dependencies
└── index.html              # HTML entry point
```

## License

MIT

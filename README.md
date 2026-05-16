
# omp-cef-installer

A lightweight desktop application for installing and managing Chromium Embedded Framework (CEF) for Open.MP — built with **Rust + Tauri 2**.

![Tauri](https://img.shields.io/badge/Tauri-2.0-24C8DB?style=flat-square&logo=tauri)
![Rust](https://img.shields.io/badge/Rust-1.95-000000?style=flat-square&logo=rust)
![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)

## Features

- **Blazing fast** — Native Rust backend, ~15MB exe
- Simple and fast CEF installation with progress tracking
- Automatic version checking and updates
- One-click uninstallation
- Modern dark-themed UI

## Tech Stack

- **Runtime:** Tauri 2 (Rust)
- **Backend:** Rust (reqwest, zip, tokio)
- **Frontend:** Vanilla HTML/CSS/JS
- **HTTP:** reqwest with streaming downloads
- **Archive:** zip crate

## Prerequisites

- [Rust](https://www.rust-lang.org/tools/install) (1.70+)
- [Node.js](https://nodejs.org/) (20+)
- [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) (Windows)

## Installation

```bash
# Clone the repository
git clone https://github.com/yeatdev/omp-cef-installer.git

# Navigate to project directory
cd omp-cef-installer

# Install dependencies
npm install

# Run in development mode
npm run tauri:dev
```

## Building

```bash
# Build a release exe
npm run tauri:build
```

The output will be in `src-tauri/target/release/`.

## Project Structure

```
omp-cef-installer/
├── src/                    # Frontend
│   ├── index.html
│   ├── style.css
│   └── main.js
├── src-tauri/              # Rust backend
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── src/
│       ├── main.rs
│       └── lib.rs
├── package.json
├── version.txt
└── README.md
```

## Contributing

Contributions are welcome! Feel free to submit issues and pull requests.

## License

This project is licensed under the **MIT License**.

---

<sub>Generated with ❤️ by <a href="https://github.com/deksdeveloper/github-repo-analyzer">GitHub Repository Analyzer</a></sub>

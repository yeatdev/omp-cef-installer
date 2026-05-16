

# omp-cef-installer

A desktop application for installing and managing Chromium Embedded Framework (CEF) for Open Music Player (OMP).

![Electron](https://img.shields.io/badge/Electron-42.1.0-47848F?style=flat-square&logo=electron)
![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)

## Features

- Simple and fast CEF installation
- Automated dependency management
- Cross-platform desktop interface
- Built with Electron for reliable desktop integration

## Tech Stack

- **Framework:** Electron
- **Language:** JavaScript
- **HTTP Client:** Axios
- **Archive Extraction:** extract-zip

## Installation

```bash
# Clone the repository
git clone https://github.com/yeatdev/omp-cef-installer.git

# Navigate to project directory
cd omp-cef-installer

# Install dependencies
npm install

# Run the application
npm start
```

## Usage

After installing dependencies, run the application with:

```bash
npm start
```

The GUI will launch and guide you through the CEF installation process.

## Project Structure

```
omp-cef-installer/
├── index.html      # Main HTML entry point
├── main.js         # Electron main process
├── preload.js      # Preload script for IPC
├── renderer.js     # Renderer process logic
├── style.css       # Application styles
├── package.json    # Project configuration
└── version.txt     # Version information
```

## Contributing

Contributions are welcome! Feel free to submit issues and pull requests.

## License

This project is licensed under the **MIT License**.

---

<sub>Generated with ❤️ by <a href="https://github.com/deksdeveloper/github-repo-analyzer">GitHub Repository Analyzer</a></sub>

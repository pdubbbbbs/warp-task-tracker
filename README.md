# 🎯 Warp Task Tracker

A real-time task completion percentage tracker for Warp terminal sessions.

## 🚀 Overview

This application displays the completion percentage of your current task directly in your Warp terminal, helping you visualize progress and stay motivated during development sessions.

## ✨ Features

- **Real-time progress tracking**: Monitor task completion as you work
- **Terminal integration**: Seamlessly integrates with Warp terminal
- **Visual progress bar**: Clean, minimalist progress display
- **Session persistence**: Maintains progress across terminal sessions
- **Customizable goals**: Set your own completion criteria

## 🛠️ Installation

```bash
# Clone the repository
git clone https://github.com/pdubbbbbs/warp-task-tracker.git
cd warp-task-tracker

# Install dependencies
npm install

# Run the application
npm start
```

## 📊 Usage

```bash
# Start tracking a new task
warp-tracker start "Implement user authentication"

# Update progress
warp-tracker update 25  # 25% complete

# View current status
warp-tracker status

# Complete the task
warp-tracker complete
```

## 🎨 Display Examples

```
┌─ Current Task ──────────────────────────┐
│ Implement user authentication           │
│ ████████████░░░░░░░░░░░░ 60%           │
│ Started: 2:30 PM • Elapsed: 45min      │
└─────────────────────────────────────────┘
```

## 🔧 Configuration

Create a `.warp-tracker.json` file in your project root:

```json
{
  "displayStyle": "progress-bar",
  "updateInterval": 30,
  "notifications": true,
  "autoSave": true
}
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Inspired by the need for better task tracking in terminal environments
- Built for the Warp terminal community
- Designed to integrate with existing development workflows

---

**Created**: August 30, 2025  
**Purpose**: Visual task completion tracking for Warp terminal  
**Status**: In Development

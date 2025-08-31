# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

Warp Task Tracker is a Node.js CLI application that provides real-time task completion percentage tracking for Warp terminal sessions. It displays visual progress bars, maintains task history, and integrates with system notifications.

## Architecture

### Core Components

- **TaskTracker class** (`src/TaskTracker.js`): Main business logic handling task lifecycle, data persistence, and display formatting
- **CLI Interface** (`bin/warp-tracker`): Commander.js-based command-line interface with subcommands
- **Main Entry Point** (`src/index.js`): Application bootstrapper that shows welcome message and current status

### Data Storage

- **Configuration Directory**: `~/.warp-tracker/`
- **Task Data**: `~/.warp-tracker/tasks.json` (current task + history array)
- **User Config**: `~/.warp-tracker/config.json` (display preferences, notification settings)

### Task State Management

Tasks transition through states: `in-progress` → `completed`|`stopped`. Only one task can be active at a time. All state changes are persisted to JSON files with automatic directory creation.

## Development Commands

### Setup and Installation
```bash
npm install          # Install dependencies
npm link            # Create global symlink for warp-tracker command
```

### Development Workflow
```bash
npm run dev         # Development with nodemon auto-restart
npm start          # Run the application directly
npm test           # Run Jest test suite
npm run lint       # ESLint code analysis
npm run build      # Build executable with pkg
```

### Testing the CLI
```bash
# Test the binary directly
./bin/warp-tracker start "Test task"
./bin/warp-tracker update 50
./bin/warp-tracker status
./bin/warp-tracker complete

# Or if linked globally
warp-tracker start "Test task"
warp-tracker update 50 -m "Halfway done"
warp-tracker complete -m "Finished successfully"
```

## Key Implementation Details

### Progress Visualization
- Uses `boxen` for bordered task display boxes
- `cli-progress` for progress bars with filled (█) and empty (░) characters
- `chalk` for colored terminal output with status-based color coding

### Configuration System
- Supports runtime configuration via `warp-tracker config --set key=value`
- Automatic type parsing (boolean, number, string) in config values
- Default settings include progress bar length, update intervals, and notification preferences

### Notification Integration
- `node-notifier` for system notifications on major progress milestones
- Configurable notification triggers (25%+ progress changes, task completion)

### Data Persistence Strategy
- `fs-extra` for robust file operations with automatic directory creation
- JSON serialization with 2-space indentation for human readability
- Graceful fallbacks for missing or corrupted data files

## Common Development Tasks

### Adding New Commands
1. Add command definition in `bin/warp-tracker` using Commander.js pattern
2. Implement corresponding method in `TaskTracker` class
3. Follow existing async/await patterns for data operations

### Modifying Display Format
- Progress bar rendering logic is in `createProgressBar()` method
- Task display formatting handled by `displayTask()` method
- Color schemes and box styling use chalk and boxen configuration

### Testing Data Operations
- Task data is stored in `~/.warp-tracker/tasks.json`
- Configuration in `~/.warp-tracker/config.json`
- Remove these files to reset application state during testing

## Dependencies

### Core Runtime
- **commander**: CLI argument parsing and subcommand routing
- **chalk**: Terminal color and styling
- **boxen**: Bordered console output boxes
- **fs-extra**: Enhanced file system operations
- **node-notifier**: Cross-platform desktop notifications

### Development Tools
- **nodemon**: Development auto-restart
- **eslint**: Code linting and style enforcement
- **jest**: Testing framework
- **pkg**: Binary executable compilation

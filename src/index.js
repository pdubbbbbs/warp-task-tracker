const TaskTracker = require('./TaskTracker');
const chalk = require('chalk');

// Main application entry point
async function main() {
  try {
    const tracker = new TaskTracker();
    
    // Show welcome message
    console.log(chalk.blue.bold('🎯 Warp Task Tracker'));
    console.log(chalk.gray('Track your task completion progress in real-time'));
    console.log(chalk.gray('Run with --help for available commands\n'));
    
    // Show current status if there's an active task
    await tracker.showStatus();
  } catch (error) {
    console.error(chalk.red('❌ Error:'), error.message);
    process.exit(1);
  }
}

// Only run if this file is executed directly
if (require.main === module) {
  main();
}

module.exports = { TaskTracker };

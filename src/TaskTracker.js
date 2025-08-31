const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const boxen = require('boxen');
const cliProgress = require('cli-progress');
const notifier = require('node-notifier');
const WarpSessionManager = require('./WarpSessionManager');

class TaskTracker {
  constructor() {
    this.configDir = path.join(process.env.HOME, '.warp-tracker');
    this.dataFile = path.join(this.configDir, 'tasks.json');
    this.configFile = path.join(this.configDir, 'config.json');
    this.sessionManager = new WarpSessionManager();
    this.activeTasks = new Map(); // sessionId -> taskData
    this.initializeData();
  }

  async initializeData() {
    await fs.ensureDir(this.configDir);
    
    if (!await fs.pathExists(this.dataFile)) {
      await this.saveData({ currentTask: null, history: [] });
    }
    
    if (!await fs.pathExists(this.configFile)) {
      await this.saveConfig({
        displayStyle: 'progress-bar',
        updateInterval: 30,
        notifications: true,
        autoSave: true,
        progressBarLength: 30
      });
    }
  }

  async loadData() {
    try {
      return await fs.readJson(this.dataFile);
    } catch (error) {
      return { currentTask: null, history: [] };
    }
  }

  async saveData(data) {
    await fs.writeJson(this.dataFile, data, { spaces: 2 });
  }

  async loadConfig() {
    try {
      return await fs.readJson(this.configFile);
    } catch (error) {
      return {
        displayStyle: 'progress-bar',
        updateInterval: 30,
        notifications: true,
        autoSave: true,
        progressBarLength: 30
      };
    }
  }

  async saveConfig(config) {
    await fs.writeJson(this.configFile, config, { spaces: 2 });
  }

  async startTask(taskName, description = '') {
    const data = await this.loadData();
    
    if (data.currentTask) {
      console.log(chalk.yellow('⚠️  A task is already in progress:'));
      this.displayTask(data.currentTask);
      console.log(chalk.yellow('Please complete or stop the current task first.'));
      return;
    }

    const newTask = {
      id: Date.now().toString(),
      name: taskName,
      description,
      startTime: new Date().toISOString(),
      progress: 0,
      updates: [],
      status: 'in-progress'
    };

    data.currentTask = newTask;
    await this.saveData(data);

    console.log(chalk.green('🚀 Started tracking new task:'));
    this.displayTask(newTask);

    const config = await this.loadConfig();
    if (config.notifications) {
      notifier.notify({
        title: 'Warp Task Tracker',
        message: `Started tracking: ${taskName}`,
        icon: path.join(__dirname, '../assets/icon.png')
      });
    }
  }

  async updateProgress(percentage, message = '') {
    const data = await this.loadData();
    
    if (!data.currentTask) {
      console.log(chalk.red('❌ No active task found. Start a task first with: warp-tracker start \"Task name\"'));
      return;
    }

    if (percentage < 0 || percentage > 100) {
      console.log(chalk.red('❌ Progress percentage must be between 0 and 100'));
      return;
    }

    const previousProgress = data.currentTask.progress;
    data.currentTask.progress = percentage;
    data.currentTask.updates.push({
      timestamp: new Date().toISOString(),
      progress: percentage,
      message
    });

    await this.saveData(data);

    console.log(chalk.blue('📈 Progress updated:'));
    this.displayTask(data.currentTask);

    // Show progress change
    const change = percentage - previousProgress;
    if (change > 0) {
      console.log(chalk.green(`+${change}% progress`));
    }

    const config = await this.loadConfig();
    if (config.notifications && change >= 25) {
      notifier.notify({
        title: 'Warp Task Tracker',
        message: `${data.currentTask.name}: ${percentage}% complete`,
        icon: path.join(__dirname, '../assets/icon.png')
      });
    }
  }

  async showStatus() {
    const data = await this.loadData();
    
    if (!data.currentTask) {
      console.log(chalk.yellow('📭 No active task. Start tracking with: warp-tracker start \"Task name\"'));
      return;
    }

    console.log(chalk.blue('📊 Current Task Status:'));
    this.displayTask(data.currentTask, true);
  }

  async completeTask(message = '') {
    const data = await this.loadData();
    
    if (!data.currentTask) {
      console.log(chalk.red('❌ No active task to complete'));
      return;
    }

    data.currentTask.endTime = new Date().toISOString();
    data.currentTask.status = 'completed';
    data.currentTask.progress = 100;
    
    if (message) {
      data.currentTask.completionMessage = message;
    }

    // Add to history
    data.history.unshift(data.currentTask);
    data.currentTask = null;

    await this.saveData(data);

    console.log(chalk.green('🎉 Task completed!'));
    this.displayTask(data.history[0]);

    const config = await this.loadConfig();
    if (config.notifications) {
      notifier.notify({
        title: 'Warp Task Tracker',
        message: `Task completed: ${data.history[0].name}`,
        icon: path.join(__dirname, '../assets/icon.png')
      });
    }
  }

  async stopTask() {
    const data = await this.loadData();
    
    if (!data.currentTask) {
      console.log(chalk.red('❌ No active task to stop'));
      return;
    }

    data.currentTask.endTime = new Date().toISOString();
    data.currentTask.status = 'stopped';

    // Add to history
    data.history.unshift(data.currentTask);
    data.currentTask = null;

    await this.saveData(data);

    console.log(chalk.yellow('⏹️  Task stopped and saved to history'));
  }

  async showHistory(count = 10) {
    const data = await this.loadData();
    
    if (data.history.length === 0) {
      console.log(chalk.yellow('📝 No task history found'));
      return;
    }

    console.log(chalk.blue(`📚 Recent Task History (${Math.min(count, data.history.length)} tasks):`));
    
    data.history.slice(0, count).forEach((task, index) => {
      const statusIcon = task.status === 'completed' ? '✅' : '⏹️';
      const duration = this.calculateDuration(task.startTime, task.endTime);
      
      console.log(`\n${index + 1}. ${statusIcon} ${chalk.bold(task.name)}`);
      console.log(`   Progress: ${this.createProgressBar(task.progress, 20)} ${task.progress}%`);
      console.log(`   Duration: ${duration}`);
      console.log(`   Started: ${new Date(task.startTime).toLocaleString()}`);
    });
  }

  async handleConfig(options) {
    const config = await this.loadConfig();
    
    if (options.set) {
      const [key, value] = options.set.split('=');
      if (key && value !== undefined) {
        // Parse value based on type
        let parsedValue = value;
        if (value === 'true') parsedValue = true;
        else if (value === 'false') parsedValue = false;
        else if (!isNaN(value)) parsedValue = parseInt(value);
        
        config[key] = parsedValue;
        await this.saveConfig(config);
        console.log(chalk.green(`✅ Configuration updated: ${key} = ${parsedValue}`));
      } else {
        console.log(chalk.red('❌ Invalid format. Use: --set key=value'));
      }
    } else {
      console.log(chalk.blue('🔧 Current Configuration:'));
      Object.entries(config).forEach(([key, value]) => {
        console.log(`  ${key}: ${chalk.cyan(value)}`);
      });
    }
  }

  displayTask(task, detailed = false) {
    const config = this.loadConfig();
    const progressBar = this.createProgressBar(task.progress);
    const duration = task.endTime ? 
      this.calculateDuration(task.startTime, task.endTime) : 
      this.calculateDuration(task.startTime);
    
    let content = '';
    content += `${chalk.bold(task.name)}\n`;
    
    if (task.description) {
      content += `${chalk.gray(task.description)}\n`;
    }
    
    content += `${progressBar} ${chalk.bold(task.progress + '%')}\n`;
    
    const startTime = new Date(task.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    content += `Started: ${startTime} • Duration: ${duration}`;
    
    if (detailed && task.updates.length > 0) {
      content += `\n\n${chalk.dim('Recent Updates:')}`;
      task.updates.slice(-3).forEach(update => {
        const time = new Date(update.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        content += `\n  ${time}: ${update.progress}%${update.message ? ' - ' + update.message : ''}`;
      });
    }

    const box = boxen(content, {
      padding: 1,
      margin: 1,
      borderStyle: 'round',
      borderColor: task.status === 'completed' ? 'green' : 
                  task.status === 'stopped' ? 'yellow' : 'blue'
    });

    console.log(box);
  }

  createProgressBar(percentage, length = 30) {
    const filled = Math.round((percentage / 100) * length);
    const empty = length - filled;
    const filledBar = '█'.repeat(filled);
    const emptyBar = '░'.repeat(empty);
    
    return chalk.green(filledBar) + chalk.gray(emptyBar);
  }

  calculateDuration(startTime, endTime = null) {
    const start = new Date(startTime);
    const end = endTime ? new Date(endTime) : new Date();
    const diffMs = end - start;
    
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }

  // ===== AUTOMATIC TASK MANAGEMENT =====

  /**
   * Scan for Warp sessions and auto-create tasks
   */
  async scanAndCreateTasks() {
    try {
      const changes = await this.sessionManager.detectSessionChanges();
      
      // Create tasks for new sessions
      for (const session of changes.newSessions) {
        await this.createTaskForSession(session);
      }

      // Clean up tasks for closed sessions
      for (const sessionId of changes.closedSessions) {
        await this.handleClosedSession(sessionId);
      }

      return {
        newTasks: changes.newSessions.length,
        closedTasks: changes.closedSessions.length,
        allSessions: changes.allSessions
      };
    } catch (error) {
      console.error('Error scanning for tasks:', error);
      return { newTasks: 0, closedTasks: 0, allSessions: [] };
    }
  }

  /**
   * Create a task for a new Warp session
   */
  async createTaskForSession(session) {
    try {
      // Check if we already have a task for this session
      if (this.activeTasks.has(session.sessionId)) {
        return this.activeTasks.get(session.sessionId);
      }

      const newTask = {
        id: `${session.sessionId}_${Date.now()}`,
        name: session.taskName,
        description: `Auto-generated task for ${session.projectName}\nWorking directory: ${session.workingDir}`,
        startTime: new Date().toISOString(),
        progress: 0,
        updates: [],
        status: 'in-progress',
        sessionId: session.sessionId,
        sessionInfo: {
          windowId: session.windowId,
          projectName: session.projectName,
          workingDir: session.workingDir,
          title: session.title
        }
      };

      // Add to active tasks map
      this.activeTasks.set(session.sessionId, newTask);

      const config = await this.loadConfig();
      if (config.notifications) {
        notifier.notify({
          title: 'Warp Task Tracker',
          message: `Auto-created task: ${session.taskName}`,
          icon: path.join(__dirname, '../assets/icon.png')
        });
      }

      return newTask;
    } catch (error) {
      console.error('Error creating task for session:', error);
      return null;
    }
  }

  /**
   * Handle a closed Warp session
   */
  async handleClosedSession(sessionId) {
    try {
      const task = this.activeTasks.get(sessionId);
      if (!task) return;

      // Mark task as stopped and move to history
      task.endTime = new Date().toISOString();
      task.status = 'stopped';

      const data = await this.loadData();
      data.history.unshift(task);
      
      // If this was the current task, clear it
      if (data.currentTask && data.currentTask.sessionId === sessionId) {
        data.currentTask = null;
      }

      await this.saveData(data);
      this.activeTasks.delete(sessionId);

      const config = await this.loadConfig();
      if (config.notifications) {
        notifier.notify({
          title: 'Warp Task Tracker',
          message: `Task auto-stopped: ${task.name}`,
          icon: path.join(__dirname, '../assets/icon.png')
        });
      }
    } catch (error) {
      console.error('Error handling closed session:', error);
    }
  }

  /**
   * Get all active session-based tasks
   */
  getActiveSessionTasks() {
    return Array.from(this.activeTasks.values());
  }

  /**
   * Get task for a specific session
   */
  getTaskForSession(sessionId) {
    return this.activeTasks.get(sessionId);
  }

  /**
   * Update progress for a specific session task
   */
  async updateSessionTaskProgress(sessionId, percentage, message = '') {
    const task = this.activeTasks.get(sessionId);
    if (!task) {
      throw new Error(`No task found for session ${sessionId}`);
    }

    if (percentage < 0 || percentage > 100) {
      throw new Error('Progress percentage must be between 0 and 100');
    }

    const previousProgress = task.progress;
    task.progress = percentage;
    task.updates.push({
      timestamp: new Date().toISOString(),
      progress: percentage,
      message
    });

    // Update the active task
    this.activeTasks.set(sessionId, task);

    // Also update in data if this is the current task
    const data = await this.loadData();
    if (data.currentTask && data.currentTask.sessionId === sessionId) {
      data.currentTask = task;
      await this.saveData(data);
    }

    const config = await this.loadConfig();
    const change = percentage - previousProgress;
    if (config.notifications && change >= 25) {
      notifier.notify({
        title: 'Warp Task Tracker',
        message: `${task.name}: ${percentage}% complete`,
        icon: path.join(__dirname, '../assets/icon.png')
      });
    }

    return task;
  }

  /**
   * Set the current active task from session tasks
   */
  async setCurrentTaskFromSession(sessionId) {
    const task = this.activeTasks.get(sessionId);
    if (!task) {
      throw new Error(`No task found for session ${sessionId}`);
    }

    const data = await this.loadData();
    data.currentTask = task;
    await this.saveData(data);

    return task;
  }

  /**
   * Get current task or suggest one based on active Warp session
   */
  async getCurrentOrSuggestedTask() {
    const data = await this.loadData();
    
    if (data.currentTask) {
      return { type: 'current', task: data.currentTask };
    }

    // Try to get the active Warp session
    const activeSession = await this.sessionManager.getActiveWarpSession();
    if (activeSession) {
      const suggestedTask = this.activeTasks.get(activeSession.sessionId);
      if (suggestedTask) {
        return { type: 'suggested', task: suggestedTask, session: activeSession };
      }
    }

    // Return first active task if any
    const activeTasks = this.getActiveSessionTasks();
    if (activeTasks.length > 0) {
      return { type: 'suggested', task: activeTasks[0] };
    }

    return { type: 'none', task: null };
  }

  /**
   * Start session monitoring for automatic task management
   */
  startAutoTaskManagement(callback) {
    this.sessionManager.startSessionMonitoring(async (changes) => {
      const result = {
        newTasks: [],
        closedTasks: []
      };

      // Create tasks for new sessions
      for (const session of changes.newSessions) {
        const task = await this.createTaskForSession(session);
        if (task) result.newTasks.push(task);
      }

      // Handle closed sessions
      for (const sessionId of changes.closedSessions) {
        const task = this.activeTasks.get(sessionId);
        if (task) result.closedTasks.push(task);
        await this.handleClosedSession(sessionId);
      }

      if (callback) {
        callback(result);
      }
    });
  }

  /**
   * Stop automatic task management
   */
  stopAutoTaskManagement() {
    this.sessionManager.stopSessionMonitoring();
  }
}

module.exports = TaskTracker;

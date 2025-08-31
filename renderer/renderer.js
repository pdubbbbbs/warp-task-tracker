const { ipcRenderer, shell, remote } = require('electron');

class TaskTrackerRenderer {
    constructor() {
        this.currentTask = null;
        this.isUpdatingProgress = false;
        this.refreshInterval = null;
        
        this.initializeEventListeners();
        this.startPeriodicRefresh();
        this.updateTimeDisplay();
        this.loadInitialData();
    }

    initializeEventListeners() {
        // Window controls
        document.getElementById('minimizeBtn').addEventListener('click', () => {
            ipcRenderer.invoke('minimize-window');
        });

        document.getElementById('closeBtn').addEventListener('click', () => {
            ipcRenderer.invoke('close-window');
        });

        // Task switcher
        document.getElementById('taskSwitcher').addEventListener('change', (e) => {
            this.switchToTask(e.target.value);
        });

        document.getElementById('refreshTasksBtn').addEventListener('click', () => {
            this.refreshWarpTasks();
        });

        // Task controls
        document.getElementById('progressSlider').addEventListener('input', (e) => {
            document.getElementById('progressValue').textContent = `${e.target.value}%`;
        });

        document.getElementById('updateProgressBtn').addEventListener('click', () => {
            this.updateProgress();
        });

        document.getElementById('completeTaskBtn').addEventListener('click', () => {
            this.completeTask();
        });

        document.getElementById('stopTaskBtn').addEventListener('click', () => {
            this.stopTask();
        });

        document.getElementById('refreshHistoryBtn').addEventListener('click', () => {
            this.loadTaskHistory();
        });

        // Modal keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideNewTaskModal();
            }
            if (e.key === 'Enter' && e.ctrlKey) {
                this.createNewTask();
            }
        });

        // Listen for IPC events
        ipcRenderer.on('show-new-task-dialog', () => {
            this.showNewTaskModal();
        });
    }

    async loadInitialData() {
        await this.loadCurrentTask();
        await this.loadTaskHistory();
        this.updateStatus('Ready');
    }

    async loadCurrentTask() {
        try {
            const result = await ipcRenderer.invoke('get-current-task');
            if (result.success) {
                this.currentTask = result.task;
                this.displayCurrentTask();
                this.updateTaskControls();
            } else {
                this.showError('Failed to load current task: ' + result.error);
            }
        } catch (error) {
            this.showError('Error loading current task: ' + error.message);
        }
    }

    async loadTaskHistory() {
        try {
            const result = await ipcRenderer.invoke('get-task-history', 5);
            if (result.success) {
                this.displayTaskHistory(result.history);
            } else {
                this.showError('Failed to load task history: ' + result.error);
            }
        } catch (error) {
            this.showError('Error loading task history: ' + error.message);
        }
    }

    displayCurrentTask() {
        const container = document.getElementById('currentTaskDisplay');
        
        if (!this.currentTask) {
            container.innerHTML = `
                <div class="no-task">
                    <div class="no-task-icon">📭</div>
                    <p>No active task</p>
                    <p>Click "New Task" to get started</p>
                </div>
            `;
            return;
        }

        const startTime = new Date(this.currentTask.startTime).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });

        const duration = this.calculateDuration(this.currentTask.startTime);

        container.innerHTML = `
            <div class="task-card">
                <div class="task-info">
                    <div class="task-name">${this.escapeHtml(this.currentTask.name)}</div>
                    ${this.currentTask.description ? `<div class="task-description">${this.escapeHtml(this.currentTask.description)}</div>` : ''}
                    <div class="task-meta">
                        <span>Started: ${startTime}</span>
                        <span>Duration: ${duration}</span>
                    </div>
                </div>
                <div class="progress-section">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${this.currentTask.progress}%"></div>
                    </div>
                    <div class="progress-text">
                        <span>Progress</span>
                        <span>${this.currentTask.progress}%</span>
                    </div>
                </div>
            </div>
        `;
    }

    displayTaskHistory(history) {
        const container = document.getElementById('taskHistory');
        
        if (!history || history.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #6c7086; padding: 20px;">No task history found</p>';
            return;
        }

        container.innerHTML = history.map(task => {
            const statusIcon = task.status === 'completed' ? '✅' : '⏹️';
            const duration = this.calculateDuration(task.startTime, task.endTime);
            const startTime = new Date(task.startTime).toLocaleDateString();

            return `
                <div class="history-item">
                    <div class="history-status">${statusIcon}</div>
                    <div class="history-content">
                        <div class="history-name">${this.escapeHtml(task.name)}</div>
                        <div class="history-meta">${startTime} • ${duration}</div>
                    </div>
                    <div class="history-progress">
                        <div class="mini-progress-bar">
                            <div class="mini-progress-fill" style="width: ${task.progress}%"></div>
                        </div>
                        <span>${task.progress}%</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    updateTaskControls() {
        const controls = document.getElementById('taskControls');
        const progressSlider = document.getElementById('progressSlider');
        const progressValue = document.getElementById('progressValue');

        if (this.currentTask) {
            controls.style.display = 'block';
            progressSlider.value = this.currentTask.progress;
            progressValue.textContent = `${this.currentTask.progress}%`;
        } else {
            controls.style.display = 'none';
        }
    }

    showNewTaskModal() {
        const modal = document.getElementById('newTaskModal');
        const taskNameInput = document.getElementById('taskName');
        const taskDescInput = document.getElementById('taskDescription');
        
        modal.style.display = 'flex';
        taskNameInput.value = '';
        taskDescInput.value = '';
        taskNameInput.focus();
    }

    hideNewTaskModal() {
        document.getElementById('newTaskModal').style.display = 'none';
    }

    async createNewTask() {
        const taskName = document.getElementById('taskName').value.trim();
        const taskDescription = document.getElementById('taskDescription').value.trim();

        if (!taskName) {
            this.showError('Task name is required');
            return;
        }

        try {
            this.updateStatus('Creating task...');
            const result = await ipcRenderer.invoke('start-task', taskName, taskDescription);
            
            if (result.success) {
                this.hideNewTaskModal();
                await this.loadCurrentTask();
                this.updateStatus('Task created successfully');
            } else {
                this.showError('Failed to create task: ' + result.error);
            }
        } catch (error) {
            this.showError('Error creating task: ' + error.message);
        }
    }

    async updateProgress() {
        if (this.isUpdatingProgress) return;

        const percentage = parseInt(document.getElementById('progressSlider').value);
        const message = document.getElementById('progressMessage').value.trim();

        try {
            this.isUpdatingProgress = true;
            this.updateStatus('Updating progress...');
            
            const result = await ipcRenderer.invoke('update-progress', percentage, message);
            
            if (result.success) {
                await this.loadCurrentTask();
                document.getElementById('progressMessage').value = '';
                this.updateStatus(`Progress updated to ${percentage}%`);
            } else {
                this.showError('Failed to update progress: ' + result.error);
            }
        } catch (error) {
            this.showError('Error updating progress: ' + error.message);
        } finally {
            this.isUpdatingProgress = false;
        }
    }

    async completeTask() {
        const message = document.getElementById('progressMessage').value.trim();

        try {
            this.updateStatus('Completing task...');
            const result = await ipcRenderer.invoke('complete-task', message);
            
            if (result.success) {
                await this.loadCurrentTask();
                await this.loadTaskHistory();
                document.getElementById('progressMessage').value = '';
                this.updateStatus('Task completed successfully! 🎉');
            } else {
                this.showError('Failed to complete task: ' + result.error);
            }
        } catch (error) {
            this.showError('Error completing task: ' + error.message);
        }
    }

    async stopTask() {
        try {
            this.updateStatus('Stopping task...');
            const result = await ipcRenderer.invoke('stop-task');
            
            if (result.success) {
                await this.loadCurrentTask();
                await this.loadTaskHistory();
                this.updateStatus('Task stopped');
            } else {
                this.showError('Failed to stop task: ' + result.error);
            }
        } catch (error) {
            this.showError('Error stopping task: ' + error.message);
        }
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

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    updateStatus(message) {
        document.getElementById('statusText').textContent = message;
        
        // Auto-clear status after 3 seconds unless it's an error
        if (!message.toLowerCase().includes('error') && !message.toLowerCase().includes('failed')) {
            setTimeout(() => {
                document.getElementById('statusText').textContent = 'Ready';
            }, 3000);
        }
    }

    showError(message) {
        console.error(message);
        this.updateStatus('Error: ' + message);
    }

    updateTimeDisplay() {
        const updateTime = () => {
            const now = new Date();
            const timeString = now.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
            });
            document.getElementById('timeDisplay').textContent = timeString;
        };

        updateTime();
        setInterval(updateTime, 1000);
    }

    startPeriodicRefresh() {
        // Refresh current task every 30 seconds
        this.refreshInterval = setInterval(() => {
            if (this.currentTask) {
                this.loadCurrentTask();
            }
        }, 30000);
    }

    destroy() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
    }

    // ===== AUTOMATIC TASK MANAGEMENT =====

    async refreshWarpTasks() {
        try {
            this.updateStatus('Scanning Warp windows...');
            const result = await ipcRenderer.invoke('scan-warp-sessions');
            
            if (result.success) {
                await this.updateTaskSwitcher(result.sessions);
                this.updateStatus(`Found ${result.sessions.length} Warp sessions`);
            } else {
                this.showError('Failed to scan Warp sessions: ' + result.error);
            }
        } catch (error) {
            this.showError('Error scanning Warp sessions: ' + error.message);
        }
    }

    async updateTaskSwitcher(sessions) {
        const switcher = document.getElementById('taskSwitcher');
        
        // Clear existing options except the first one
        switcher.innerHTML = '<option value="">Select a task...</option>';
        
        // Add session-based tasks
        sessions.forEach(session => {
            const option = document.createElement('option');
            option.value = session.sessionId;
            option.textContent = `${session.projectName} (${session.workingDir})`;
            switcher.appendChild(option);
        });
        
        // If there's a current task, select it
        if (this.currentTask && this.currentTask.sessionId) {
            switcher.value = this.currentTask.sessionId;
        }
    }

    async switchToTask(sessionId) {
        if (!sessionId) {
            return;
        }

        try {
            this.updateStatus('Switching task...');
            const result = await ipcRenderer.invoke('switch-to-session-task', sessionId);
            
            if (result.success) {
                this.currentTask = result.task;
                this.displayCurrentTask();
                this.updateTaskControls();
                this.updateStatus(`Switched to: ${result.task.name}`);
            } else {
                this.showError('Failed to switch task: ' + result.error);
            }
        } catch (error) {
            this.showError('Error switching task: ' + error.message);
        }
    }

    async loadAvailableTasks() {
        try {
            const result = await ipcRenderer.invoke('get-available-tasks');
            
            if (result.success) {
                await this.updateTaskSwitcher(result.tasks);
            } else {
                this.showError('Failed to load available tasks: ' + result.error);
            }
        } catch (error) {
            this.showError('Error loading available tasks: ' + error.message);
        }
    }

    displayCurrentTask() {
        const container = document.getElementById('currentTaskDisplay');
        
        if (!this.currentTask) {
            container.innerHTML = `
                <div class="no-task">
                    <div class="no-task-icon">🔍</div>
                    <p>No active task selected</p>
                    <p>Click "🔄 Scan Warp Windows" to find tasks from your terminal sessions</p>
                </div>
            `;
            return;
        }

        const startTime = new Date(this.currentTask.startTime).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });

        const duration = this.calculateDuration(this.currentTask.startTime);
        const isAutoGenerated = this.currentTask.sessionId ? ' 🤖' : '';

        container.innerHTML = `
            <div class="task-card">
                <div class="task-info">
                    <div class="task-name">${this.escapeHtml(this.currentTask.name)}${isAutoGenerated}</div>
                    ${this.currentTask.description ? `<div class="task-description">${this.escapeHtml(this.currentTask.description)}</div>` : ''}
                    ${this.currentTask.sessionInfo ? `
                        <div class="session-info">
                            <small>📂 ${this.escapeHtml(this.currentTask.sessionInfo.workingDir)}</small>
                        </div>
                    ` : ''}
                    <div class="task-meta">
                        <span>Started: ${startTime}</span>
                        <span>Duration: ${duration}</span>
                    </div>
                </div>
                <div class="progress-section">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${this.currentTask.progress}%"></div>
                    </div>
                    <div class="progress-text">
                        <span>Progress</span>
                        <span>${this.currentTask.progress}%</span>
                    </div>
                </div>
            </div>
        `;
    }
}

// Initialize the renderer when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.taskTrackerRenderer = new TaskTrackerRenderer();
});

// Cleanup on window unload
window.addEventListener('beforeunload', () => {
    if (window.taskTrackerRenderer) {
        window.taskTrackerRenderer.destroy();
    }
});

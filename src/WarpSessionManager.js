const { exec } = require('child_process');
const path = require('path');
const fs = require('fs-extra');
const util = require('util');

const execAsync = util.promisify(exec);

class WarpSessionManager {
  constructor() {
    this.activeSessions = new Map();
    this.sessionPollingInterval = null;
    this.lastKnownSessions = new Set();
  }

  /**
   * Get all active Warp terminal windows and their working directories
   */
  async getWarpSessions() {
    try {
      // Use AppleScript to get Warp window information
      const appleScript = `
        tell application "System Events"
          set warpProcesses to every process whose name is "Warp"
          set sessionInfo to {}
          
          repeat with warpProcess in warpProcesses
            try
              set windowList to every window of warpProcess
              repeat with warpWindow in windowList
                try
                  set windowTitle to title of warpWindow
                  set windowID to id of warpWindow
                  set end of sessionInfo to {windowTitle, windowID}
                end try
              end repeat
            end try
          end repeat
          
          return sessionInfo
        end tell
      `;

      const { stdout } = await execAsync(`osascript -e '${appleScript}'`);
      const sessions = this.parseAppleScriptOutput(stdout);
      
      // Get working directories for each session
      const enrichedSessions = await this.enrichSessionsWithWorkingDir(sessions);
      
      return enrichedSessions;
    } catch (error) {
      console.error('Error getting Warp sessions:', error);
      return [];
    }
  }

  /**
   * Parse AppleScript output to extract session information
   */
  parseAppleScriptOutput(output) {
    const sessions = [];
    const lines = output.trim().split('\n');
    
    lines.forEach(line => {
      // Parse the AppleScript list format
      const match = line.match(/\{(.+), (\d+)\}/);
      if (match) {
        const [, title, windowId] = match;
        sessions.push({
          title: title.replace(/"/g, ''),
          windowId: parseInt(windowId),
          sessionId: `warp_${windowId}`
        });
      }
    });

    return sessions;
  }

  /**
   * Enrich session data with working directory information
   */
  async enrichSessionsWithWorkingDir(sessions) {
    const enrichedSessions = [];

    for (const session of sessions) {
      try {
        // Extract working directory from window title or use heuristics
        const workingDir = await this.extractWorkingDirectory(session);
        const projectName = this.extractProjectName(workingDir);
        
        const enrichedSession = {
          ...session,
          workingDir,
          projectName,
          taskName: this.generateTaskName(projectName, workingDir),
          lastSeen: new Date().toISOString()
        };

        enrichedSessions.push(enrichedSession);
      } catch (error) {
        console.error(`Error enriching session ${session.sessionId}:`, error);
        // Still add the session with basic info
        enrichedSessions.push({
          ...session,
          workingDir: '~',
          projectName: 'Unknown Project',
          taskName: `Terminal Session ${session.windowId}`,
          lastSeen: new Date().toISOString()
        });
      }
    }

    return enrichedSessions;
  }

  /**
   * Extract working directory from session
   */
  async extractWorkingDirectory(session) {
    try {
      // Try to get working directory from window title first
      if (session.title && session.title.includes(' - ')) {
        const titleParts = session.title.split(' - ');
        const possiblePath = titleParts[titleParts.length - 1];
        
        if (possiblePath.startsWith('/') || possiblePath.startsWith('~')) {
          return possiblePath;
        }
      }

      // Fallback: try to find the most recent shell process
      const { stdout } = await execAsync(`
        ps -eo pid,ppid,command | grep -E '(zsh|bash|fish)' | grep -v grep | tail -1
      `);
      
      if (stdout.trim()) {
        const pid = stdout.trim().split(/\s+/)[0];
        try {
          const { stdout: cwdOutput } = await execAsync(`lsof -p ${pid} | grep cwd | head -1`);
          const cwd = cwdOutput.trim().split(/\s+/).pop();
          if (cwd && cwd !== '') {
            return cwd;
          }
        } catch {
          // Ignore errors
        }
      }

      // Final fallback
      return process.env.HOME || '~';
    } catch (error) {
      return process.env.HOME || '~';
    }
  }

  /**
   * Extract project name from working directory
   */
  extractProjectName(workingDir) {
    if (!workingDir || workingDir === '~' || workingDir === '/') {
      return 'General Tasks';
    }

    const projectPath = workingDir.replace(/^~/, process.env.HOME || '');
    const pathParts = projectPath.split('/').filter(part => part.length > 0);
    
    // Look for common project indicators
    const projectIndicators = ['src', 'projects', 'code', 'development', 'dev', 'work'];
    
    for (let i = pathParts.length - 1; i >= 0; i--) {
      const part = pathParts[i];
      
      // Skip common non-project directories
      if (['src', 'lib', 'bin', 'node_modules', '.git'].includes(part)) {
        continue;
      }
      
      // If we find a project indicator, the next part is likely the project name
      if (i > 0 && projectIndicators.includes(pathParts[i - 1])) {
        return this.formatProjectName(part);
      }
      
      // Return the last meaningful directory name
      if (i === pathParts.length - 1) {
        return this.formatProjectName(part);
      }
    }

    return this.formatProjectName(pathParts[pathParts.length - 1] || 'Unknown Project');
  }

  /**
   * Format project name for display
   */
  formatProjectName(name) {
    return name
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase())
      .trim();
  }

  /**
   * Generate a task name based on project and context
   */
  generateTaskName(projectName, workingDir) {
    const timestamp = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
    
    return `${projectName} Development (${timestamp})`;
  }

  /**
   * Check for new or closed Warp sessions
   */
  async detectSessionChanges() {
    const currentSessions = await this.getWarpSessions();
    const currentSessionIds = new Set(currentSessions.map(s => s.sessionId));
    
    // Find new sessions
    const newSessions = currentSessions.filter(session => 
      !this.lastKnownSessions.has(session.sessionId)
    );
    
    // Find closed sessions
    const closedSessionIds = Array.from(this.lastKnownSessions).filter(sessionId => 
      !currentSessionIds.has(sessionId)
    );

    // Update tracking
    this.lastKnownSessions = currentSessionIds;
    
    // Update active sessions map
    currentSessions.forEach(session => {
      this.activeSessions.set(session.sessionId, session);
    });
    
    // Remove closed sessions
    closedSessionIds.forEach(sessionId => {
      this.activeSessions.delete(sessionId);
    });

    return {
      newSessions,
      closedSessions: closedSessionIds,
      allSessions: currentSessions
    };
  }

  /**
   * Start monitoring Warp sessions
   */
  startSessionMonitoring(callback, interval = 5000) {
    if (this.sessionPollingInterval) {
      this.stopSessionMonitoring();
    }

    this.sessionPollingInterval = setInterval(async () => {
      try {
        const changes = await this.detectSessionChanges();
        if (callback && (changes.newSessions.length > 0 || changes.closedSessions.length > 0)) {
          callback(changes);
        }
      } catch (error) {
        console.error('Error monitoring sessions:', error);
      }
    }, interval);
  }

  /**
   * Stop monitoring Warp sessions
   */
  stopSessionMonitoring() {
    if (this.sessionPollingInterval) {
      clearInterval(this.sessionPollingInterval);
      this.sessionPollingInterval = null;
    }
  }

  /**
   * Get the currently active/focused Warp session
   */
  async getActiveWarpSession() {
    try {
      const appleScript = `
        tell application "System Events"
          set frontApp to name of first application process whose frontmost is true
          if frontApp is "Warp" then
            set frontWindow to front window of first application process whose name is "Warp"
            return title of frontWindow & "," & id of frontWindow
          else
            return ""
          end if
        end tell
      `;

      const { stdout } = await execAsync(`osascript -e '${appleScript}'`);
      
      if (stdout.trim()) {
        const [title, windowId] = stdout.trim().split(',');
        const sessionId = `warp_${windowId}`;
        
        // Return session if we have it in our active sessions
        return this.activeSessions.get(sessionId) || null;
      }
      
      return null;
    } catch (error) {
      console.error('Error getting active Warp session:', error);
      return null;
    }
  }

  /**
   * Check if Warp is currently running
   */
  async isWarpRunning() {
    try {
      const { stdout } = await execAsync('pgrep -f "Warp"');
      return stdout.trim().length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get session by ID
   */
  getSession(sessionId) {
    return this.activeSessions.get(sessionId);
  }

  /**
   * Get all active sessions
   */
  getAllSessions() {
    return Array.from(this.activeSessions.values());
  }
}

module.exports = WarpSessionManager;

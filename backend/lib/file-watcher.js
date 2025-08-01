import chokidar from 'chokidar';
import fs from 'fs';
import path from 'path';
import { marked } from 'marked';

class FileWatcher {
  constructor() {
    this.watcher = null;
    this.eventCallbacks = {};
    this.watchedFiles = new Set();
  }

  on(event, callback) {
    if (!this.eventCallbacks[event]) {
      this.eventCallbacks[event] = [];
    }
    this.eventCallbacks[event].push(callback);
  }

  emit(event, data) {
    if (this.eventCallbacks[event]) {
      this.eventCallbacks[event].forEach(callback => callback(data));
    }
  }

  start() {
    const specsPath = path.join(process.cwd(), '../specs/**/*.md');
    
    console.log('Starting file watcher for specs directory...');
    
    this.watcher = chokidar.watch(specsPath, {
      ignored: /^\./,
      persistent: true,
      cwd: process.cwd(),
      ignoreInitial: false // Set to false to catch existing files on startup
    });

    this.watcher.on('add', (filePath) => {
      if (!this.watchedFiles.has(filePath)) {
        this.watchedFiles.add(filePath);
        this.handleNewSpecFile(filePath);
      }
    });

    this.watcher.on('change', (filePath) => {
      this.handleSpecFileChange(filePath);
    });

    this.watcher.on('error', (error) => {
      console.error('File watcher error:', error);
      this.emit('error', error);
    });

    console.log('File watcher started successfully');
  }

  async handleNewSpecFile(filePath) {
    try {
      console.log(`New spec file detected: ${filePath}`);
      
      const fullPath = path.join(process.cwd(), filePath);
      const content = await fs.promises.readFile(fullPath, 'utf8');
      
      if (content.trim().length === 0) {
        return; // Skip empty files
      }

      const html = await this.markdownToHTML(content);
      const fileName = path.basename(filePath, '.md');
      
      this.emit('spec_file_generated', {
        filePath,
        fileName,
        html,
        raw: content
      });
      
    } catch (error) {
      console.error(`Error processing spec file ${filePath}:`, error);
      this.emit('error', error);
    }
  }

  async handleSpecFileChange(filePath) {
    try {
      console.log(`Spec file changed: ${filePath}`);
      
      const fullPath = path.join(process.cwd(), filePath);
      const content = await fs.promises.readFile(fullPath, 'utf8');
      
      const html = await this.markdownToHTML(content);
      const fileName = path.basename(filePath, '.md');
      
      this.emit('spec_file_updated', {
        filePath,
        fileName,
        html,
        raw: content
      });
      
    } catch (error) {
      console.error(`Error processing spec file change ${filePath}:`, error);
      this.emit('error', error);
    }
  }

  async markdownToHTML(markdown) {
    // Configure marked for secure, clean HTML output
    marked.setOptions({
      breaks: true,        // Convert \n to <br>
      gfm: true,          // GitHub Flavored Markdown
      sanitize: false,    // Allow HTML (specs may contain tables, etc.)
      smartLists: true,   // Better list handling
      smartypants: false  // Don't convert quotes to smart quotes
    });
    
    return marked.parse(markdown);
  }

  stop() {
    if (this.watcher) {
      console.log('Stopping file watcher...');
      this.watcher.close();
      this.watcher = null;
      this.watchedFiles.clear();
    }
  }
}

export default FileWatcher;
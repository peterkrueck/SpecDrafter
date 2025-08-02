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
    const specsPath = path.join(process.cwd(), 'specs/**/*.md');
    const resolvedPath = path.resolve(specsPath.replace('/**/*.md', ''));
    
    console.log('🔍 FILE WATCHER DIAGNOSTICS:');
    console.log(`  Current working directory: ${process.cwd()}`);
    console.log(`  Raw specs path: ${specsPath}`);
    console.log(`  Resolved specs directory: ${resolvedPath}`);
    console.log(`  Directory exists: ${fs.existsSync(resolvedPath)}`);
    
    // Check if specs directory exists and list contents
    if (fs.existsSync(resolvedPath)) {
      try {
        const contents = fs.readdirSync(resolvedPath, { withFileTypes: true });
        console.log(`  Directory contents (${contents.length} items):`);
        contents.forEach(item => {
          console.log(`    ${item.isDirectory() ? '[DIR]' : '[FILE]'} ${item.name}`);
        });
      } catch (error) {
        console.log(`  Error reading directory: ${error.message}`);
      }
    } else {
      console.log('  ⚠️  WARNING: Specs directory does not exist!');
    }
    
    console.log('Starting file watcher for specs directory...');
    
    this.watcher = chokidar.watch(specsPath, {
      ignored: /^\./,
      persistent: true,
      cwd: process.cwd(),
      ignoreInitial: false // Set to false to catch existing files on startup
    });

    this.watcher.on('add', (filePath) => {
      console.log(`📄 FILE WATCHER: 'add' event triggered for: ${filePath}`);
      if (!this.watchedFiles.has(filePath)) {
        this.watchedFiles.add(filePath);
        console.log(`📄 FILE WATCHER: Processing new file: ${filePath}`);
        this.handleNewSpecFile(filePath);
      } else {
        console.log(`📄 FILE WATCHER: File already tracked, skipping: ${filePath}`);
      }
    });

    this.watcher.on('change', (filePath) => {
      console.log(`✏️  FILE WATCHER: 'change' event triggered for: ${filePath}`);
      this.handleSpecFileChange(filePath);
    });

    this.watcher.on('error', (error) => {
      console.error('❌ FILE WATCHER ERROR:', error);
      this.emit('error', error);
    });

    this.watcher.on('ready', () => {
      console.log('✅ FILE WATCHER: Initial scan complete, watching for changes');
      console.log(`📊 FILE WATCHER: Currently tracking ${this.watchedFiles.size} files`);
    });

    console.log('File watcher started successfully');
  }

  async handleNewSpecFile(filePath) {
    try {
      console.log(`📄 NEW SPEC FILE DETECTED: ${filePath}`);
      
      const fullPath = path.join(process.cwd(), filePath);
      console.log(`📄 Resolved full path: ${fullPath}`);
      console.log(`📄 File exists: ${fs.existsSync(fullPath)}`);
      
      const content = await fs.promises.readFile(fullPath, 'utf8');
      console.log(`📄 File content length: ${content.length} characters`);
      
      if (content.trim().length === 0) {
        console.log(`📄 Skipping empty file: ${filePath}`);
        return; // Skip empty files
      }

      const html = await this.markdownToHTML(content);
      const fileName = path.basename(filePath, '.md');
      
      const eventData = {
        filePath,
        fileName,
        html,
        raw: content
      };
      
      console.log(`🚀 EMITTING 'spec_file_generated' event for: ${filePath}`);
      console.log(`🚀 Event data:`, { filePath, fileName, htmlLength: html.length, rawLength: content.length });
      
      this.emit('spec_file_generated', eventData);
      
    } catch (error) {
      console.error(`❌ Error processing spec file ${filePath}:`, error);
      this.emit('error', error);
    }
  }

  async handleSpecFileChange(filePath) {
    try {
      console.log(`✏️ SPEC FILE CHANGED: ${filePath}`);
      
      const fullPath = path.join(process.cwd(), filePath);
      const content = await fs.promises.readFile(fullPath, 'utf8');
      
      const html = await this.markdownToHTML(content);
      const fileName = path.basename(filePath, '.md');
      
      const eventData = {
        filePath,
        fileName,
        html,
        raw: content
      };
      
      console.log(`🚀 EMITTING 'spec_file_updated' event for: ${filePath}`);
      console.log(`🚀 Event data:`, { filePath, fileName, htmlLength: html.length, rawLength: content.length });
      
      this.emit('spec_file_updated', eventData);
      
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
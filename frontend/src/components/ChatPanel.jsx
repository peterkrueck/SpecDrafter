import React, { useState, useEffect, useRef } from 'react';
import Message from './Message';
import TypingIndicator from './TypingIndicator';
import { MODEL_STORAGE_KEY } from '../config/models.js';

function ChatPanel({ messages, setMessages, typingState, socket, projectData, projectInfo, onResetSession, currentModel, availableModels }) {
  const [inputValue, setInputValue] = useState('');
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [isGeneratingSpec, setIsGeneratingSpec] = useState(false);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const scrollContainerRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, typingState]);

  const handleScroll = () => {
    if (scrollContainerRef.current) {
      const { scrollTop } = scrollContainerRef.current;
      setShowScrollTop(scrollTop > 300);
    }
  };

  const scrollToTop = () => {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    if (!socket) return;

    // Handle messages from Discovery AI
    socket.on('discovery_message', (data) => {
      const newMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        message: data.content,
        isUser: false,
        speaker: 'Discovery AI',
        timestamp: data.timestamp || new Date().toISOString()
      };
      setMessages(prev => [...prev, newMessage]);
      
      // Reset generating state when we receive a response
      setIsGeneratingSpec(false);
    });

    // Note: Review AI messages are no longer shown in chat
    // They are automatically routed to Discovery AI and appear in collaboration tab

    return () => {
      socket.off('discovery_message');
    };
  }, [socket, setMessages]);

  const sendMessage = () => {
    if (inputValue.trim()) {
      const newMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        message: inputValue,
        isUser: true,
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, newMessage]);
      socket?.emit('user_message', { message: inputValue });
      setInputValue('');
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = '40px';
      }
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleTextareaChange = (e) => {
    setInputValue(e.target.value);
    // Auto-resize textarea
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'; // Max ~4 rows
  };

  const resetSession = () => {
    socket?.emit('reset_session');
    onResetSession();
  };
  
  const handleModelChange = (modelId) => {
    if (socket && modelId) {
      socket.emit('change_model', { modelId });
      localStorage.setItem(MODEL_STORAGE_KEY, modelId);
    }
  };

  // Logic to determine when Generate & Review button should be enabled
  const canGenerateSpec = socket?.connected && 
    !typingState.isTyping && 
    messages.length > 0 && // Show after any conversation starts
    !isGeneratingSpec &&
    projectData && // Project data must exist
    projectInfo; // Project info with paths must be available

  const handleGenerateSpec = () => {
    if (!canGenerateSpec || !projectInfo) return;
    
    setIsGeneratingSpec(true);
    
    // Get project name from projectData
    const projectName = projectData?.projectName || 'UnknownProject';
    
    // Send the predefined message to Discovery AI with dynamic path
    const message = `Write the complete technical specification to the markdown file at ${projectInfo.specsDir}/${projectName}/spec.md. Focus on implementation details, technical architecture, data models, API endpoints, component structure, and integration points. Avoid timelines, budgets, or unnecessary fluff - concentrate only on the technical aspects of how to build it. After writing, ask @review: to check the file for any missing technical details, implementation gaps, or architectural improvements needed.`;
    
    socket.emit('user_message', { message });
    
    // Reset loading state after a delay
    setTimeout(() => setIsGeneratingSpec(false), 3000);
  };

  return (
    <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 shadow-2xl flex flex-col h-full overflow-hidden relative">
      <div className="p-4 border-b border-white/10">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <h3 className="text-xl font-semibold text-white flex items-center gap-2">
              💬 AI Collaboration
            </h3>
            {projectData && (
              <p className="text-sm text-gray-400 mt-1">
                Project: {projectData.projectName}
              </p>
            )}
          </div>
          <button 
            onClick={resetSession}
            className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 rounded-lg transition-all duration-200 hover:scale-105"
          >
            New Project
          </button>
        </div>
        
        {/* Model Selection Bar */}
        {currentModel && availableModels.length > 0 && (
          <div className="mt-3 flex items-center gap-2 bg-white/5 rounded-lg p-2">
            <span className="text-xs text-gray-400">Model:</span>
            <div className="flex gap-1 flex-wrap">
              {availableModels.map((model) => (
                <button
                  key={model.id}
                  onClick={() => handleModelChange(model.id)}
                  className={`px-3 py-1 rounded text-xs transition-all duration-200 ${
                    currentModel.id === model.id
                      ? 'bg-blue-500/30 text-blue-200 border border-blue-500/50'
                      : 'bg-white/5 text-gray-300 border border-white/10 hover:bg-white/10'
                  }`}
                  title={model.description}
                >
                  {model.name}
                </button>
              ))}
            </div>
            <div className="ml-auto text-xs text-gray-400">
              Current: <span className="text-blue-300">{currentModel.name}</span>
            </div>
          </div>
        )}
      </div>
      
      <div 
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-chat smooth-scroll relative"
      >
        {messages.length === 0 && (
          <div className="text-center text-gray-400 mt-8">
            <div className="text-4xl mb-4">🤝</div>
            <p>Your conversation with the AI team will appear here.</p>
            {projectData && (
              <p className="text-sm mt-2">Your project details have been shared. The conversation will begin shortly.</p>
            )}
          </div>
        )}
        
        {messages.map((msg) => (
          <Message
            key={msg.id}
            message={msg.message}
            isUser={msg.isUser}
            timestamp={msg.timestamp}
            speaker={msg.speaker}
          />
        ))}
        
        {typingState.isTyping && <TypingIndicator speaker={typingState.speaker} />}
        <div ref={messagesEndRef} />
      </div>
      
      <div className="p-4 border-t border-white/10">
        <div className="flex gap-2">
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={handleTextareaChange}
            onKeyPress={handleKeyPress}
            onKeyDown={handleKeyDown}
            placeholder="Type your message here..."
            className="flex-1 bg-white/5 border border-white/20 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none overflow-hidden"
            rows={1}
            style={{ minHeight: '40px' }}
          />
          <button
            onClick={sendMessage}
            disabled={!inputValue.trim()}
            className="px-6 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </button>
          {canGenerateSpec && (
            <button 
              onClick={handleGenerateSpec}
              disabled={!canGenerateSpec}
              className="px-4 py-2 bg-gradient-to-r from-green-500 to-teal-600 hover:from-green-600 hover:to-teal-700 disabled:from-gray-500 disabled:to-gray-600 text-white rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              title="Generate and review specification"
            >
              {isGeneratingSpec ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span className="hidden sm:inline">Generating...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="hidden sm:inline">Generate Spec</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
      
      {/* Scroll to Top Button */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="absolute bottom-20 right-4 p-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded-full backdrop-blur-sm transition-all duration-200 hover:scale-110 z-20"
          title="Scroll to top"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        </button>
      )}
    </div>
  );
}

export default ChatPanel;
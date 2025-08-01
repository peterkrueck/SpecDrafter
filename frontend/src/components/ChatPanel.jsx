import React, { useState, useEffect, useRef } from 'react';
import Message from './Message';
import TypingIndicator from './TypingIndicator';
import { MODEL_STORAGE_KEY } from '../config/models.js';

function ChatPanel({ messages, setMessages, typingState, socket, projectData, onResetSession, currentModel, availableModels }) {
  const [inputValue, setInputValue] = useState('');
  const [showScrollTop, setShowScrollTop] = useState(false);
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

    // Handle messages from Requirements AI
    socket.on('requirements_message', (data) => {
      const newMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        message: data.content,
        isUser: false,
        speaker: 'Requirements AI',
        timestamp: data.timestamp || new Date().toISOString()
      };
      setMessages(prev => [...prev, newMessage]);
    });

    // Handle messages from Review AI
    socket.on('review_message', (data) => {
      const newMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        message: data.content,
        isUser: false,
        speaker: 'Review AI',
        timestamp: data.timestamp || new Date().toISOString()
      };
      setMessages(prev => [...prev, newMessage]);
    });

    return () => {
      socket.off('requirements_message');
      socket.off('review_message');
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
import React, { useState, useEffect, useRef } from 'react';
import Message from './Message';
import TypingIndicator from './TypingIndicator';

function ChatPanel({ messages, setMessages, isTyping, socket, projectData, onResetSession }) {
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

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
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const resetSession = () => {
    socket?.emit('reset_session');
    onResetSession();
  };

  return (
    <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 shadow-2xl flex flex-col h-full">
      <div className="flex justify-between items-center p-4 border-b border-white/10">
        <div>
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
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 mt-8">
            <div className="text-4xl mb-4">🤝</div>
            <p>AI-to-AI collaboration will appear here when Gemini calls Claude for technical analysis.</p>
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
        
        {isTyping && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>
      
      <div className="p-4 border-t border-white/10">
        <div className="flex gap-2">
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message here..."
            className="flex-1 bg-white/5 border border-white/20 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            rows={1}
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
    </div>
  );
}

export default ChatPanel;
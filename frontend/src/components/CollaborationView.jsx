import React, { useEffect, useRef } from 'react';
import TypingIndicator from './TypingIndicator';
import { filterThinkingTags } from '../utils/filterThinkingTags';

function CollaborationView({ collaboration, typingState, activeToolId }) {
  const collaborationEndRef = useRef(null);
  
  // Convert AI collaboration messages to a chat-like format
  const messages = collaboration.map((event, index) => ({
    id: index,
    from: event.from,
    to: event.to,
    content: event.content || event.command || 'Communication detected',
    timestamp: event.timestamp || new Date().toISOString(),
    type: event.type || 'message',
    isSystemMessage: event.isSystemMessage || false,
    toolName: event.toolName,
    toolId: event.toolId
  }));

  const scrollToBottom = () => {
    collaborationEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [collaboration]);

  return (
    <div className="flex-1 p-4 overflow-y-auto scrollbar-collab smooth-scroll">
      {collaboration.length === 0 ? (
        <div className="text-center text-gray-400 mt-8">
          <div className="text-4xl mb-4">🤖</div>
          <p>AI collaboration messages will appear here.</p>
          <p className="text-sm mt-2">Review AI starts automatically when Discovery AI needs technical analysis.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {messages.map((msg, index) => (
            <div 
              key={msg.id} 
              className="animate-fade-in"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              {msg.isSystemMessage ? (
                // Tool usage system message - animate if active
                <div className={`rounded-lg p-3 transition-all duration-300 ${
                  msg.toolId === activeToolId 
                    ? 'bg-gray-700/40 border border-blue-500/50 animate-pulse-border' 
                    : 'bg-gray-800/30 border border-gray-700/30'
                }`}>
                  <div className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                      msg.toolId === activeToolId
                        ? 'bg-blue-600/50'
                        : 'bg-gray-700/50'
                    }`}>
                      <span className={`text-xs ${msg.toolId === activeToolId ? 'animate-spin-slow' : ''}`}>⚙️</span>
                    </div>
                    <div className="flex-grow">
                      <div className={`text-xs ${
                        msg.toolId === activeToolId ? 'text-gray-300' : 'text-gray-400'
                      }`}>
                        {msg.content}
                      </div>
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ) : (
                // Regular AI message
                <div className={`rounded-lg p-4 ${
                  msg.from === 'Discovery AI' 
                    ? 'bg-blue-500/10 border border-blue-500/20' 
                    : 'bg-orange-500/10 border border-orange-500/20'
                }`}>
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${
                      msg.from === 'Discovery AI'
                        ? 'bg-gradient-to-br from-blue-500 to-cyan-500'
                        : 'bg-gradient-to-br from-orange-500 to-red-500'
                    }`}>
                      {msg.from === 'Discovery AI' ? '🔵' : '🔴'}
                    </div>
                    <div className="flex-grow">
                      <div className="text-xs text-gray-300 mb-1">
                        {msg.from} → {msg.to}
                      </div>
                      <div className="text-sm text-gray-100 whitespace-pre-line">
                        {filterThinkingTags(msg.content)}
                      </div>
                      <div className="text-xs text-gray-400 mt-2">
                        {new Date(msg.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
          
          {/* Show typing indicator during AI collaboration */}
          {typingState && typingState.isTyping && 
           (typingState.speaker === 'Discovery AI' || typingState.speaker === 'Review AI') && (
            <TypingIndicator speaker={typingState.speaker} />
          )}
          
          <div ref={collaborationEndRef} />
        </div>
      )}
    </div>
  );
}

export default CollaborationView;
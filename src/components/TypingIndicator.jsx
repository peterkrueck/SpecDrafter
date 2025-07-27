import React from 'react';

function TypingIndicator({ speaker = 'Gemini' }) {
  return (
    <div className="flex justify-start mb-4">
      <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center text-white text-xs font-bold mr-3 flex-shrink-0">
        🔵
      </div>
      <div className="bg-white/10 border border-white/20 px-4 py-2 rounded-lg shadow-lg backdrop-blur-sm">
        <div className="flex items-center space-x-1">
          <span className="text-xs text-gray-300">{speaker} is typing</span>
          <div className="flex space-x-1">
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-typing"></div>
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-typing" style={{ animationDelay: '0.2s' }}></div>
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-typing" style={{ animationDelay: '0.4s' }}></div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TypingIndicator;
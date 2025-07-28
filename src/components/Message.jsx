import React from 'react';

function Message({ message, isUser, timestamp }) {
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      {!isUser && (
        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center text-white text-xs font-bold mr-3 flex-shrink-0">
          🔵
        </div>
      )}
      <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg shadow-lg backdrop-blur-sm ${
        isUser 
          ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white' 
          : 'bg-white/10 border border-white/20 text-gray-100'
      }`}>
        <div className="text-sm leading-relaxed whitespace-pre-line">{message}</div>
        <span className="text-xs opacity-70 mt-1 block">
          {new Date(timestamp).toLocaleTimeString()}
        </span>
      </div>
      {isUser && (
        <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white text-xs font-bold ml-3 flex-shrink-0">
          👤
        </div>
      )}
    </div>
  );
}

export default Message;
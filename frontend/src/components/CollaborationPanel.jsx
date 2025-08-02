import React from 'react';
import CollaborationView from './CollaborationView';
import SpecView from './SpecView';

function CollaborationPanel({ currentView, setCurrentView, collaboration, specContent, typingState }) {
  return (
    <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 shadow-2xl flex flex-col h-full overflow-hidden">
      <div className="flex p-4 border-b border-white/10 gap-2 flex-shrink-0">
        <button 
          onClick={() => setCurrentView('ai-collab')}
          className={`px-4 py-2 rounded-lg transition-all duration-200 ${
            currentView === 'ai-collab' 
              ? 'bg-blue-500 text-white shadow-lg' 
              : 'bg-white/10 text-gray-300 hover:bg-white/20'
          }`}
        >
          AI Collab
        </button>
        <button 
          onClick={() => setCurrentView('spec')}
          className={`px-4 py-2 rounded-lg transition-all duration-200 ${
            currentView === 'spec' 
              ? 'bg-purple-500 text-white shadow-lg' 
              : 'bg-white/10 text-gray-300 hover:bg-white/20'
          }`}
        >
          Spec View
        </button>
      </div>
      
      {currentView === 'ai-collab' ? (
        <CollaborationView collaboration={collaboration} typingState={typingState} />
      ) : (
        <SpecView content={specContent} />
      )}
    </div>
  );
}

export default CollaborationPanel;
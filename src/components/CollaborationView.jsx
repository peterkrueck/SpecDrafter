import React, { useEffect, useRef } from 'react';

function CollaborationView({ collaboration }) {
  const collaborationEndRef = useRef(null);

  const scrollToBottom = () => {
    collaborationEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [collaboration]);

  return (
    <div className="flex-1 p-4 overflow-y-auto">
      {collaboration.length === 0 ? (
        <div className="text-center text-gray-400 mt-8">
          <div className="text-4xl mb-4">🤖</div>
          <p>AI-to-AI collaboration will appear here when Gemini calls Claude for technical analysis.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {collaboration.map((item, index) => (
            <div key={index} className="border-l-2 border-blue-500/50 pl-4">
              {item.type === 'command' && (
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 mb-2">
                  <div className="text-xs text-blue-300 mb-1">Gemini → Claude</div>
                  <div className="text-sm text-gray-200 font-mono">
                    {item.command}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {new Date(item.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              )}
              
              {item.type === 'response' && (
                <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                  <div className="text-xs text-green-300 mb-1">Claude Response</div>
                  <div className="text-sm text-gray-200 whitespace-pre-wrap">
                    {item.response}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {new Date(item.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              )}
            </div>
          ))}
          <div ref={collaborationEndRef} />
        </div>
      )}
    </div>
  );
}

export default CollaborationView;
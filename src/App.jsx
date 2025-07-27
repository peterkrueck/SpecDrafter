import React, { useState, useEffect } from 'react';
import ChatPanel from './components/ChatPanel';
import CollaborationPanel from './components/CollaborationPanel';
import { useSocket } from './hooks/useSocket';

function App() {
  const [messages, setMessages] = useState([]);
  const [currentView, setCurrentView] = useState('ai-collab');
  const [isTyping, setIsTyping] = useState(false);
  const [collaboration, setCollaboration] = useState([]);
  const [specContent, setSpecContent] = useState(null);
  
  const { socket, connected } = useSocket();

  useEffect(() => {
    if (!socket) return;

    socket.on('typing_indicator', (data) => {
      setIsTyping(data.isTyping);
    });

    socket.on('collaboration_detected', (data) => {
      setCollaboration(prev => [...prev, {
        type: 'command',
        command: data.command,
        timestamp: data.timestamp
      }]);
    });

    socket.on('claude_response', (data) => {
      setCollaboration(prev => [...prev, {
        type: 'response',
        response: data.response,
        timestamp: data.timestamp
      }]);
    });

    socket.on('spec_file_generated', (data) => {
      setSpecContent({
        html: data.html,
        raw: data.raw,
        filePath: data.filePath,
        fileName: data.fileName
      });
      setCurrentView('spec');
    });

    return () => {
      socket.off('typing_indicator');
      socket.off('collaboration_detected');
      socket.off('claude_response');
      socket.off('spec_file_generated');
    };
  }, [socket]);
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-screen p-6">
        <ChatPanel 
          messages={messages}
          setMessages={setMessages}
          isTyping={isTyping}
          socket={socket}
        />
        <CollaborationPanel
          currentView={currentView}
          setCurrentView={setCurrentView}
          collaboration={collaboration}
          specContent={specContent}
        />
      </div>
      
      {!connected && (
        <div className="fixed bottom-4 right-4 bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-2 rounded-lg backdrop-blur-sm">
          Disconnected from server
        </div>
      )}
    </div>
  );
}

export default App;
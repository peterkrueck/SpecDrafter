import React, { useState, useEffect } from 'react';
import ChatPanel from './components/ChatPanel';
import CollaborationPanel from './components/CollaborationPanel';
import WelcomeScreen from './components/WelcomeScreen';
import { useSocket } from './hooks/useSocket';

function App() {
  const [showWelcome, setShowWelcome] = useState(true);
  const [projectData, setProjectData] = useState(null);
  const [messages, setMessages] = useState([]);
  const [currentView, setCurrentView] = useState('ai-collab');
  const [typingState, setTypingState] = useState({ isTyping: false, speaker: '' });
  const [collaboration, setCollaboration] = useState([]);
  const [specContent, setSpecContent] = useState(null);
  
  const { socket, connected } = useSocket();

  useEffect(() => {
    if (!socket) return;

    socket.on('orchestrator_status', (status) => {
      console.log('[FRONTEND] Orchestrator status:', status);
    });

    socket.on('processes_ready', () => {
      console.log('[FRONTEND] Claude processes are ready!');
    });

    socket.on('typing_indicator', (data) => {
      setTypingState({ isTyping: data.isTyping, speaker: data.speaker || '' });
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
      socket.off('orchestrator_status');
      socket.off('processes_ready');
      socket.off('typing_indicator');
      socket.off('collaboration_detected');
      socket.off('claude_response');
      socket.off('spec_file_generated');
    };
  }, [socket]);

  const handleWelcomeStart = (formData, initialMessage) => {
    setProjectData(formData);
    setShowWelcome(false);
    
    // Send the initial message after a brief delay to ensure UI has transitioned
    setTimeout(() => {
      if (socket) {
        const newMessage = {
          id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          message: initialMessage,
          isUser: true,
          timestamp: new Date().toISOString()
        };
        setMessages([newMessage]);
        socket.emit('user_message', { message: initialMessage });
      }
    }, 300);
  };

  const handleResetSession = () => {
    setShowWelcome(true);
    setProjectData(null);
    setMessages([]);
    setCollaboration([]);
    setSpecContent(null);
    setCurrentView('ai-collab');
  };
  
  if (showWelcome) {
    return <WelcomeScreen onStart={handleWelcomeStart} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-screen p-6">
        <ChatPanel 
          messages={messages}
          setMessages={setMessages}
          typingState={typingState}
          socket={socket}
          projectData={projectData}
          onResetSession={handleResetSession}
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
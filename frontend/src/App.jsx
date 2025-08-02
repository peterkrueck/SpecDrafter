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
  const [currentModel, setCurrentModel] = useState(null);
  const [availableModels, setAvailableModels] = useState([]);
  
  const { socket, connected } = useSocket();

  useEffect(() => {
    if (!socket) return;

    socket.on('orchestrator_status', (status) => {
      console.log('[FRONTEND] Orchestrator status:', status);
      if (status.currentModel) {
        setCurrentModel(status.currentModel);
      }
    });
    
    socket.on('available_models', (models) => {
      console.log('[FRONTEND] Available models:', models);
      setAvailableModels(models);
    });
    
    socket.on('model_changed', (data) => {
      console.log('[FRONTEND] Model changed:', data);
      if (data.model) {
        setCurrentModel(data.model);
      }
    });

    socket.on('processes_ready', () => {
      console.log('[FRONTEND] Claude processes are ready!');
    });

    socket.on('typing_indicator', (data) => {
      setTypingState({ isTyping: data.isTyping, speaker: data.speaker || '' });
    });

    socket.on('collaboration_detected', (data) => {
      // This is just for detection events, actual messages come through ai_collaboration_message
      console.log('Collaboration detected:', data);
    });

    socket.on('ai_collaboration_message', (data) => {
      setCollaboration(prev => [...prev, {
        from: data.from,
        to: data.to,
        content: data.content,
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
      socket.off('available_models');
      socket.off('model_changed');
    };
  }, [socket]);

  const handleWelcomeStart = (formData, initialMessage) => {
    setProjectData(formData);
    setShowWelcome(false);
    
    // Send the initial message after a brief delay to ensure UI has transitioned
    // Processes are already started by WelcomeScreen on mount
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
    return <WelcomeScreen onStart={handleWelcomeStart} socket={socket} />;
  }

  return (
    <div className="h-screen overflow-hidden">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full p-6">
        <ChatPanel 
          messages={messages}
          setMessages={setMessages}
          typingState={typingState}
          socket={socket}
          projectData={projectData}
          onResetSession={handleResetSession}
          currentModel={currentModel}
          availableModels={availableModels}
        />
        <CollaborationPanel
          currentView={currentView}
          setCurrentView={setCurrentView}
          collaboration={collaboration}
          specContent={specContent}
        />
      </div>
      
      {!connected && (
        <div className="fixed bottom-4 right-4 bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-2 rounded-lg backdrop-blur-sm z-50">
          Disconnected from server
        </div>
      )}
    </div>
  );
}

export default App;
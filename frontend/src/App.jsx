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
  const [collaborationTypingState, setCollaborationTypingState] = useState({ isTyping: false, speaker: '' });
  const [collaboration, setCollaboration] = useState([]);
  const [specContent, setSpecContent] = useState(null);
  const [currentModel, setCurrentModel] = useState(null);
  const [availableModels, setAvailableModels] = useState([]);
  const [projectInfo, setProjectInfo] = useState(null);
  
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
    
    socket.on('project_info', (info) => {
      console.log('[FRONTEND] Project info:', info);
      setProjectInfo(info);
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
    
    socket.on('ai_collaboration_typing', (data) => {
      setCollaborationTypingState({ isTyping: data.isTyping, speaker: data.speaker || '' });
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

    socket.on('spec_file_updated', (data) => {
      console.log('📝 Spec file updated received:', data.filePath);
      setSpecContent({
        html: data.html,
        raw: data.raw,
        filePath: data.filePath,
        fileName: data.fileName,
        lastUpdated: new Date().toISOString() // Force React to detect state change
      });
      // Don't auto-switch view for updates, user might be reading collaboration panel
    });

    return () => {
      socket.off('orchestrator_status');
      socket.off('processes_ready');
      socket.off('typing_indicator');
      socket.off('collaboration_detected');
      socket.off('ai_collaboration_message');
      socket.off('ai_collaboration_typing');
      socket.off('spec_file_generated');
      socket.off('spec_file_updated');
      socket.off('available_models');
      socket.off('project_info');
      socket.off('model_changed');
    };
  }, [socket]);

  const handleWelcomeStart = (formData, initialMessage) => {
    setProjectData(formData);
    setShowWelcome(false);
    
    // Start processes and send the initial message after a brief delay to ensure UI has transitioned
    setTimeout(() => {
      if (socket) {
        if (initialMessage) {
          // New project flow - Start Discovery AI with the user's project details as the first message
          socket.emit('start_processes', { 
            modelId: formData.modelId,
            initialMessage: initialMessage 
          });
          
          const newMessage = {
            id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            message: initialMessage,
            isUser: true,
            timestamp: new Date().toISOString()
          };
          setMessages([newMessage]);
        }
        // For existing projects, the socket handler in WelcomeScreen already emitted 'start_with_existing_spec'
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
          projectInfo={projectInfo}
          onResetSession={handleResetSession}
          currentModel={currentModel}
          availableModels={availableModels}
        />
        <CollaborationPanel
          currentView={currentView}
          setCurrentView={setCurrentView}
          collaboration={collaboration}
          specContent={specContent}
          typingState={collaborationTypingState}
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
import React, { useState, useEffect, useRef } from 'react';
import ChatPanel from './components/ChatPanel';
import CollaborationPanel from './components/CollaborationPanel';
import WelcomeScreen from './components/WelcomeScreen';
import PromoModal from './components/PromoModal';
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
  const [isGeneratingSpec, setIsGeneratingSpec] = useState(false);
  const [currentModel, setCurrentModel] = useState(null);
  const [availableModels, setAvailableModels] = useState([]);
  const [projectInfo, setProjectInfo] = useState(null);
  const [activeToolId, setActiveToolId] = useState(null);
  const [showPromoModal, setShowPromoModal] = useState(false);
  const [hasShownPromoThisSession, setHasShownPromoThisSession] = useState(false);
  const promoTimerRef = useRef(null);
  
  const { socket, connected } = useSocket();
  
  // Timeout refs for clearing stuck typing indicators
  const typingTimeoutRef = useRef(null);
  const collaborationTypingTimeoutRef = useRef(null);

  // Function to trigger promo modal after spec generation/update
  const triggerPromoModalTimer = () => {
    const isDismissed = localStorage.getItem('specdrafter-promo-dismissed');
    if (!isDismissed && !hasShownPromoThisSession) {
      // Clear any existing timer
      if (promoTimerRef.current) {
        clearTimeout(promoTimerRef.current);
      }
      
      promoTimerRef.current = setTimeout(() => {
        setShowPromoModal(true);
        setHasShownPromoThisSession(true);
      }, 30000); // 30 seconds
    }
  };

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
      
      if (data.isTyping) {
        // Clear existing timeout
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        
        // Set 5-minute timeout to force clear
        typingTimeoutRef.current = setTimeout(() => {
          console.warn('Typing indicator timeout after 5 minutes - force clearing');
          setTypingState({ isTyping: false, speaker: '' });
        }, 300000); // 5 minutes = 300,000ms
      } else {
        // Clear timeout on normal stop
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = null;
        }
      }
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
    
    socket.on('ai_collaboration_tool_usage', (data) => {
      // Set this tool as active
      setActiveToolId(data.toolId);
      
      setCollaboration(prev => [...prev, {
        from: data.from,
        content: data.description,
        timestamp: data.timestamp,
        isSystemMessage: true,
        toolName: data.toolName,
        toolId: data.toolId
      }]);
    });
    
    socket.on('ai_collaboration_tools_complete', (data) => {
      // Clear active tool when assistant responds
      setActiveToolId(null);
    });
    
    socket.on('ai_collaboration_typing', (data) => {
      setCollaborationTypingState({ isTyping: data.isTyping, speaker: data.speaker || '' });
      
      if (data.isTyping) {
        // Clear existing timeout
        if (collaborationTypingTimeoutRef.current) clearTimeout(collaborationTypingTimeoutRef.current);
        
        // Set 5-minute timeout to force clear
        collaborationTypingTimeoutRef.current = setTimeout(() => {
          console.warn('Collaboration typing indicator timeout after 5 minutes - force clearing');
          setCollaborationTypingState({ isTyping: false, speaker: '' });
        }, 300000); // 5 minutes
      } else {
        // Clear timeout on normal stop
        if (collaborationTypingTimeoutRef.current) {
          clearTimeout(collaborationTypingTimeoutRef.current);
          collaborationTypingTimeoutRef.current = null;
        }
      }
    });

    socket.on('spec_writing_started', (data) => {
      console.log('📝 Spec writing started:', data.filePath);
      setIsGeneratingSpec(true);
      setCurrentView('spec');
    });

    socket.on('initial_spec_loaded', (data) => {
      console.log('📄 Initial spec loaded for existing project:', data.filePath);
      setSpecContent({
        html: data.html,
        raw: data.raw,
        filePath: data.filePath,
        fileName: data.fileName
      });
      // Set Spec View as default for existing projects
      setCurrentView('spec');
    });

    socket.on('spec_file_generated', (data) => {
      setSpecContent({
        html: data.html,
        raw: data.raw,
        filePath: data.filePath,
        fileName: data.fileName
      });
      setCurrentView('spec');
      setIsGeneratingSpec(false);
      
      // Trigger promo modal after 30 seconds
      triggerPromoModalTimer();
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
      
      // Trigger promo modal after 30 seconds (also for updates)
      triggerPromoModalTimer();
    });


    socket.on('processes_stopped', () => {
      console.log('Processes stopped');
      // Typing states should already be cleared by the typing_indicator events
      // This is just for additional confirmation
      setTypingState({ isTyping: false, speaker: '' });
      setCollaborationTypingState({ isTyping: false, speaker: '' });
    });
    
    socket.on('error', (data) => {
      console.error('Process error:', data);
      // Clear all typing states on error
      setTypingState({ isTyping: false, speaker: '' });
      setCollaborationTypingState({ isTyping: false, speaker: '' });
    });
    
    socket.on('process_exit', (data) => {
      console.warn('Process exited:', data);
      // Clear all typing states on process exit
      setTypingState({ isTyping: false, speaker: '' });
      setCollaborationTypingState({ isTyping: false, speaker: '' });
    });

    return () => {
      socket.off('orchestrator_status');
      socket.off('processes_ready');
      socket.off('typing_indicator');
      socket.off('collaboration_detected');
      socket.off('ai_collaboration_message');
      socket.off('ai_collaboration_tool_usage');
      socket.off('ai_collaboration_tools_complete');
      socket.off('ai_collaboration_typing');
      socket.off('spec_writing_started');
      socket.off('initial_spec_loaded');
      socket.off('spec_file_generated');
      socket.off('spec_file_updated');
      socket.off('available_models');
      socket.off('project_info');
      socket.off('model_changed');
      socket.off('processes_stopped');
      socket.off('error');
      socket.off('process_exit');
      
      // Clear timeouts on unmount
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (collaborationTypingTimeoutRef.current) clearTimeout(collaborationTypingTimeoutRef.current);
      if (promoTimerRef.current) clearTimeout(promoTimerRef.current);
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
          collaborationTypingState={collaborationTypingState}
          socket={socket}
          projectData={projectData}
          projectInfo={projectInfo}
          onResetSession={handleResetSession}
          currentModel={currentModel}
          availableModels={availableModels}
          isGeneratingSpec={isGeneratingSpec}
          setIsGeneratingSpec={setIsGeneratingSpec}
        />
        <CollaborationPanel
          currentView={currentView}
          setCurrentView={setCurrentView}
          collaboration={collaboration}
          specContent={specContent}
          typingState={collaborationTypingState}
          isGeneratingSpec={isGeneratingSpec}
          activeToolId={activeToolId}
        />
      </div>
      
      {!connected && (
        <div className="fixed bottom-4 right-4 bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-2 rounded-lg backdrop-blur-sm z-50">
          Disconnected from server
        </div>
      )}
      
      <PromoModal
        isOpen={showPromoModal}
        onClose={() => setShowPromoModal(false)}
      />
    </div>
  );
}

export default App;
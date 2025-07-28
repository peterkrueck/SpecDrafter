import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

export function useSocket() {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  
  useEffect(() => {
    console.log('[FRONTEND] Initializing socket connection to http://localhost:3000');
    const newSocket = io('http://localhost:3002');
    
    newSocket.on('connect', () => {
      setConnected(true);
      console.log('[FRONTEND] ✅ Connected to SpecDrafter server', { socketId: newSocket.id });
    });
    
    newSocket.on('disconnect', (reason) => {
      setConnected(false);
      console.log('[FRONTEND] ❌ Disconnected from server', { reason });
    });

    newSocket.on('error', (error) => {
      console.error('[FRONTEND] Socket error:', error);
    });

    // Log key server events
    newSocket.on('gemini_message', (data) => {
      console.log('[FRONTEND] 📨 Gemini message received', { 
        messageLength: data.message?.length || 0,
        timestamp: data.timestamp 
      });
    });

    newSocket.on('collaboration_detected', (data) => {
      console.log('[FRONTEND] 🤝 AI collaboration detected', { command: data.command });
    });

    newSocket.on('claude_response', (data) => {
      console.log('[FRONTEND] 🔷 Claude response received', { 
        responseLength: data.response?.length || 0 
      });
    });

    newSocket.on('typing_indicator', (data) => {
      console.log('[FRONTEND] ⌨️ Typing indicator', data);
    });
    
    setSocket(newSocket);
    
    return () => {
      console.log('[FRONTEND] Closing socket connection');
      newSocket.close();
    };
  }, []);
  
  return { socket, connected };
}
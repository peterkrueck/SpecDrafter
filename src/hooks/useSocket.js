import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

export function useSocket() {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  
  useEffect(() => {
    const newSocket = io('http://localhost:3000');
    
    newSocket.on('connect', () => {
      setConnected(true);
      console.log('Connected to SpecDrafter server');
    });
    
    newSocket.on('disconnect', () => {
      setConnected(false);
    });
    
    setSocket(newSocket);
    
    return () => newSocket.close();
  }, []);
  
  return { socket, connected };
}
import React, { useState, useEffect } from 'react';
import { FolderOpen, Calendar, FileText } from 'lucide-react';

const SpecSelector = ({ socket, onSelectSpec }) => {
  const [specs, setSpecs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSpec, setSelectedSpec] = useState(null);

  useEffect(() => {
    // Request list of specs when component mounts
    socket.emit('list_specs');

    // Listen for specs list
    const handleSpecsList = (data) => {
      setSpecs(data.specs);
      setLoading(false);
    };

    // Listen for errors
    const handleError = (data) => {
      setError(data.message);
      setLoading(false);
    };

    socket.on('specs_list', handleSpecsList);
    socket.on('error', handleError);

    return () => {
      socket.off('specs_list', handleSpecsList);
      socket.off('error', handleError);
    };
  }, [socket]);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    const kb = bytes / 1024;
    if (kb < 1024) return kb.toFixed(1) + ' KB';
    const mb = kb / 1024;
    return mb.toFixed(1) + ' MB';
  };

  const handleSpecSelect = (spec) => {
    setSelectedSpec(spec);
    onSelectSpec(spec);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-400 p-4 text-center">
        Error loading specifications: {error}
      </div>
    );
  }

  if (specs.length === 0) {
    return (
      <div className="text-center p-8">
        <FolderOpen className="w-16 h-16 mx-auto mb-4 text-gray-400" />
        <p className="text-gray-400 mb-2">No existing specifications found</p>
        <p className="text-sm text-gray-500">Start a new project to create your first specification</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-400 mb-2">
        Found {specs.length} existing specification{specs.length !== 1 ? 's' : ''}
      </div>
      
      <div className="grid gap-2 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
        {specs.map((spec) => (
          <div
            key={spec.projectName}
            onClick={() => handleSpecSelect(spec)}
            className={`
              p-3 rounded-lg backdrop-blur-lg cursor-pointer
              transition-all duration-200
              ${selectedSpec?.projectName === spec.projectName
                ? 'bg-blue-500/20 border border-blue-400/50'
                : 'bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20'
              }
            `}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="w-4 h-4 text-blue-400" />
                  <h3 className="font-medium text-white text-sm">{spec.projectName}</h3>
                </div>
                
                <div className="flex items-center gap-4 text-xs text-gray-400">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {formatDate(spec.lastModified)}
                  </span>
                  <span>{formatFileSize(spec.size)}</span>
                </div>
              </div>
              
              {selectedSpec?.projectName === spec.projectName && (
                <div className="text-blue-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SpecSelector;
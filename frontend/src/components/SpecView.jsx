import React from 'react';

function SpecView({ content, isLoading }) {
  if (isLoading) {
    return (
      <div className="flex-1 p-6 flex items-center justify-center bg-black/20">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-purple-500/10 rounded-2xl mb-4 border border-purple-500/20">
            <svg className="w-10 h-10 animate-spin text-purple-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <p className="text-gray-400 text-lg">Generating specification...</p>
          <p className="text-gray-500 text-sm mt-2">Discovery AI is writing your technical specification</p>
        </div>
      </div>
    );
  }

  if (!content) {
    return (
      <div className="flex-1 p-6 flex items-center justify-center bg-black/20">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-purple-500/10 rounded-2xl mb-4 border border-purple-500/20">
            <span className="text-4xl">📝</span>
          </div>
          <p className="text-gray-400 text-lg">Generated specifications will appear here</p>
          <p className="text-gray-500 text-sm mt-2">Complete your requirements discovery to see the spec</p>
        </div>
      </div>
    );
  }

  const downloadSpec = () => {
    const blob = new Blob([content.raw], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${content.fileName || 'spec'}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="p-4 border-b border-white/10 flex justify-between items-center flex-shrink-0">
        <div className="text-sm text-gray-300">
          📁 {content.filePath || 'Generated Specification'}
        </div>
        <button
          onClick={downloadSpec}
          className="px-3 py-1 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 rounded-lg text-sm transition-all duration-200"
        >
          Download
        </button>
      </div>
      
      <div className="flex-1 p-6 overflow-y-auto scrollbar-collab smooth-scroll bg-black/20">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white/[0.02] backdrop-blur-sm rounded-xl p-8 border border-purple-500/10">
            <div 
              className="prose prose-invert prose-sm max-w-none animate-fade-in spec-content"
              dangerouslySetInnerHTML={{ __html: content.html }}
            />
          </div>
        </div>
      </div>
    </>
  );
}

export default SpecView;
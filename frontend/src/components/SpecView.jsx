import React from 'react';

function SpecView({ content }) {
  if (!content) {
    return (
      <div className="flex-1 p-4 flex items-center justify-center">
        <div className="text-center text-gray-400">
          <div className="text-4xl mb-4">📝</div>
          <p>Generated specifications will appear here when ready.</p>
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
    <div className="flex-1 flex flex-col">
      <div className="p-4 border-b border-white/10 flex justify-between items-center">
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
      
      <div className="flex-1 p-4 overflow-y-auto">
        <div 
          className="prose prose-invert prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: content.html }}
        />
      </div>
    </div>
  );
}

export default SpecView;
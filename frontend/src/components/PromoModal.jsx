import React from 'react';
import creatorPhoto from '../assets/creator-photo.jpeg';

function PromoModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleVisitFreigeist = () => {
    window.open('https://www.freigeist.dev', '_blank');
    onClose();
  };

  const handleDontShowAgain = () => {
    localStorage.setItem('specdrafter-promo-dismissed', 'true');
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn"
      onClick={handleBackdropClick}
    >
      <div className="bg-gradient-to-br from-slate-900/95 to-slate-800/95 backdrop-blur-xl rounded-2xl border border-white/20 shadow-2xl max-w-lg w-full mx-4 animate-slideUp overflow-hidden">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors z-10"
          aria-label="Close"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Content Container */}
        <div className="flex flex-col md:flex-row">
          {/* Photo Section */}
          <div className="md:w-2/5 bg-gradient-to-br from-blue-600/20 to-purple-600/20">
            <img 
              src={creatorPhoto} 
              alt="Peter - Creator of SpecDrafter"
              className="w-full h-full object-cover"
            />
          </div>

          {/* Message Section */}
          <div className="md:w-3/5 p-6">
            <h2 className="text-xl font-bold text-white mb-3">
              Hey there! 👋
            </h2>
            
            <div className="text-gray-300 space-y-3 text-sm">
              <p>
                I hope you found SpecDrafter useful so far! It's actually a proof of concept for another project of mine.
              </p>
              
              <p className="font-medium text-white">
                If you liked SpecDrafter, I think you'll love{' '}
                <span className="text-blue-400">FreigeistAI</span>.
              </p>

              <p className="text-xs text-gray-400 italic">
                Thanks for trying out my work!
              </p>
            </div>

            {/* Buttons */}
            <div className="mt-6 space-y-2">
              <button
                onClick={handleVisitFreigeist}
                className="w-full px-4 py-2.5 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all duration-200 font-medium flex items-center justify-center gap-2"
              >
                <span>Check out FreigeistAI</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </button>

              <div className="flex gap-2">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all duration-200 text-sm"
                >
                  Maybe later
                </button>
                <button
                  onClick={handleDontShowAgain}
                  className="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-400 rounded-lg transition-all duration-200 text-sm"
                >
                  Don't show again
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PromoModal;
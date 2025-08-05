module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'typing': 'typing 1.4s infinite ease-in-out',
        'spin-slow': 'spin 3s linear infinite',
        'pulse-border': 'pulseBorder 2s ease-in-out infinite'
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        typing: {
          '0%, 60%, 100%': { transform: 'translateY(0)' },
          '30%': { transform: 'translateY(-10px)' }
        },
        pulseBorder: {
          '0%, 100%': { borderColor: 'rgba(59, 130, 246, 0.3)' },
          '50%': { borderColor: 'rgba(59, 130, 246, 0.6)' }
        }
      }
    },
  },
  plugins: [
    function({ addUtilities }) {
      const scrollUtilities = {
        '.scrollbar-thin': {
          scrollbarWidth: 'thin',
        },
        '.scrollbar-none': {
          scrollbarWidth: 'none',
          '&::-webkit-scrollbar': {
            display: 'none',
          },
        },
        '.scroll-shadows': {
          position: 'relative',
          '&::before, &::after': {
            content: '""',
            position: 'absolute',
            left: 0,
            right: 0,
            height: '30px',
            pointerEvents: 'none',
            zIndex: 10,
            transition: 'opacity 0.3s ease',
          },
          '&::before': {
            top: 0,
            background: 'linear-gradient(to bottom, rgba(0, 0, 0, 0.1) 0%, transparent 100%)',
          },
          '&::after': {
            bottom: 0,
            background: 'linear-gradient(to top, rgba(0, 0, 0, 0.1) 0%, transparent 100%)',
          },
        },
      };
      addUtilities(scrollUtilities);
    },
  ],
};
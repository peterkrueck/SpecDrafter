// Available Claude models configuration
// Using aliases for automatic updates to latest versions
export const CLAUDE_MODELS = {
  OPUS: {
    id: 'opus',
    name: 'Claude Opus',
    description: 'Best for complex reasoning and detailed analysis',
    command: 'opus',
    isDefault: true
  },
  SONNET: {
    id: 'sonnet',
    name: 'Claude Sonnet',
    description: 'Balanced performance and speed',
    command: 'sonnet'
  },
  HAIKU: {
    id: 'haiku',
    name: 'Claude Haiku',
    description: 'Fast and efficient for simpler tasks',
    command: 'haiku'
  },
  CUSTOM: {
    id: 'custom',
    name: 'Custom Model',
    description: 'Advanced: Use a specific model version',
    isCustom: true
  }
};

// Get default model
export const getDefaultModel = () => {
  return Object.values(CLAUDE_MODELS).find(model => model.isDefault) || CLAUDE_MODELS.OPUS;
};

// Get model by ID
export const getModelById = (modelId) => {
  return Object.values(CLAUDE_MODELS).find(model => model.id === modelId);
};

// Get model by command
export const getModelByCommand = (command) => {
  return Object.values(CLAUDE_MODELS).find(model => model.command === command);
};

// Get all models as array
export const getAllModels = () => {
  return Object.values(CLAUDE_MODELS);
};
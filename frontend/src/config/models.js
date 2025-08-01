// Available Claude models configuration
export const CLAUDE_MODELS = {
  OPUS_4: {
    id: 'claude-opus-4-20250514',
    name: 'Claude 4 Opus',
    description: 'Best for complex reasoning and detailed analysis',
    command: 'opus'
  },
  SONNET_4: {
    id: 'claude-sonnet-4-20250514',
    name: 'Claude 4 Sonnet',
    description: 'Balanced performance and speed',
    command: 'sonnet',
    isDefault: true
  }
};

// Get default model
export const getDefaultModel = () => {
  return Object.values(CLAUDE_MODELS).find(model => model.isDefault) || CLAUDE_MODELS.SONNET_4;
};

// Get model by ID
export const getModelById = (modelId) => {
  return Object.values(CLAUDE_MODELS).find(model => model.id === modelId);
};

// Get all models as array
export const getAllModels = () => {
  return Object.values(CLAUDE_MODELS);
};

// Model preference storage key
export const MODEL_STORAGE_KEY = 'specdrafter_preferred_model';
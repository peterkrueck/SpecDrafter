import React, { useState, useEffect } from 'react';
import { getAllModels, getDefaultModel, MODEL_STORAGE_KEY, LAST_CUSTOM_MODEL_KEY } from '../config/models.js';
import SpecSelector from './SpecSelector';
import { FileText, Plus } from 'lucide-react';

function WelcomeScreen({ onStart, socket }) {
  const models = getAllModels();
  const defaultModel = getDefaultModel();
  const [mode, setMode] = useState('new'); // 'new' or 'existing'
  const [selectedSpec, setSelectedSpec] = useState(null);
  
  const [formData, setFormData] = useState({
    projectName: '',
    skillLevel: '',
    softwareType: '',
    description: '',
    modelId: ''
  });
  
  // Custom model state
  const [isCustomModel, setIsCustomModel] = useState(false);
  const [customModelName, setCustomModelName] = useState('');
  const [customModelId, setCustomModelId] = useState('');
  
  // Load saved model preference on mount
  useEffect(() => {
    const savedModelId = localStorage.getItem(MODEL_STORAGE_KEY);
    
    // Check if it was a custom model
    if (savedModelId === 'custom') {
      const lastCustom = localStorage.getItem(LAST_CUSTOM_MODEL_KEY);
      if (lastCustom) {
        try {
          const { name, id } = JSON.parse(lastCustom);
          setIsCustomModel(true);
          setCustomModelName(name || '');
          setCustomModelId(id || '');
          setFormData(prev => ({ ...prev, modelId: id }));
        } catch (e) {
          // If parsing fails, use default
          setFormData(prev => ({ ...prev, modelId: defaultModel.id }));
        }
      } else {
        setFormData(prev => ({ ...prev, modelId: defaultModel.id }));
      }
    } else {
      const initialModelId = savedModelId && models.find(m => m.id === savedModelId) ? savedModelId : defaultModel.id;
      setFormData(prev => ({ ...prev, modelId: initialModelId }));
    }
  }, []);

  const [errors, setErrors] = useState({});

  const skillLevels = [
    { id: 'non-tech', label: 'Non-Tech', description: 'No programming experience' },
    { id: 'tech-savvy', label: 'Tech-Savvy', description: 'Comfortable with technology' },
    { id: 'software-professional', label: 'Software Professional', description: 'Extensive experience' }
  ];

  const softwareTypes = [
    { id: 'web-application', label: 'Web Application', description: 'SaaS, e-commerce, social platform' },
    { id: 'mobile-app', label: 'Mobile App', description: 'iOS, Android, cross-platform' },
    { id: 'desktop-software', label: 'Desktop Software', description: 'Windows, macOS, Linux apps' },
    { id: 'simple-website', label: 'Simple Website', description: 'Blog, Landing Page' },
    { id: 'other', label: 'Other', description: 'Browser Extension, VR/AR, CLI tool, etc.' }
  ];

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing/selecting
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
    
    // If model changed, update it immediately
    if (field === 'modelId' && socket) {
      if (value === 'custom') {
        setIsCustomModel(true);
        localStorage.setItem(MODEL_STORAGE_KEY, 'custom');
        // Don't emit change yet, wait for custom ID
      } else {
        setIsCustomModel(false);
        socket.emit('change_model', { modelId: value });
        localStorage.setItem(MODEL_STORAGE_KEY, value);
      }
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (mode === 'new') {
      if (!formData.projectName.trim()) {
        newErrors.projectName = 'Project name is required';
      }
      if (!formData.skillLevel) {
        newErrors.skillLevel = 'Please select your skill level';
      }
      if (!formData.softwareType) {
        newErrors.softwareType = 'Please select software type';
      }
      if (!formData.description.trim()) {
        newErrors.description = 'Please describe your project idea';
      }
    } else if (mode === 'existing') {
      if (!selectedSpec) {
        newErrors.selectedSpec = 'Please select a project to continue';
      }
      if (!formData.skillLevel) {
        newErrors.skillLevel = 'Please select your skill level';
      }
    }
    
    // Validate custom model if selected
    if (isCustomModel) {
      if (!customModelName.trim()) {
        newErrors.customModelName = 'Please provide a name for your custom model';
      }
      if (!customModelId.trim()) {
        newErrors.customModelId = 'Please provide the model ID';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleStart = () => {
    if (mode === 'new') {
      if (validateForm()) {
        // Compose the initial message
        const skillLevelText = skillLevels.find(s => s.id === formData.skillLevel)?.label || formData.skillLevel;
        const softwareTypeText = softwareTypes.find(s => s.id === formData.softwareType)?.label || formData.softwareType;
        
        const initialMessage = `Project: ${formData.projectName}
Skill Level: ${skillLevelText}
Software Type: ${softwareTypeText}
Description: ${formData.description}

I want to create this project. Please help me draft comprehensive specifications.`;

        onStart(formData, initialMessage);
      }
    } else if (mode === 'existing') {
      if (validateForm()) {
        // Start with existing spec
        socket.emit('start_with_existing_spec', {
          projectName: selectedSpec.projectName,
          modelId: formData.modelId,
          skillLevel: formData.skillLevel
        });
        
        // Call onStart without initial message
        onStart({
          projectName: selectedSpec.projectName,
          modelId: formData.modelId,
          skillLevel: formData.skillLevel
        }, null);
      }
    }
  };

  const handleSpecSelect = (spec) => {
    setSelectedSpec(spec);
  };

  const handleCustomModelChange = (field, value) => {
    if (field === 'name') {
      setCustomModelName(value);
      // Update localStorage with current ID if we have it
      if (customModelId) {
        localStorage.setItem(LAST_CUSTOM_MODEL_KEY, JSON.stringify({ name: value, id: customModelId }));
      }
    } else if (field === 'id') {
      setCustomModelId(value);
      // Update the form data with custom ID
      if (value) {
        setFormData(prev => ({ ...prev, modelId: value }));
        // Save custom model info
        localStorage.setItem(LAST_CUSTOM_MODEL_KEY, JSON.stringify({ name: customModelName, id: value }));
        // Emit change if socket available
        if (socket) {
          socket.emit('change_model', { modelId: value });
        }
      }
    }
  };

  return (
    <div className="min-h-screen flex items-start justify-center px-6 pt-0 pb-6">
      <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 shadow-2xl p-6 max-w-4xl w-full max-h-[100vh] overflow-y-auto">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-white">SpecDrafter</h1>
        </div>

        {/* Mode Toggle */}
        <div className="flex justify-center mb-4">
          <div className="inline-flex rounded-lg bg-white/5 p-1">
            <button
              onClick={() => setMode('new')}
              className={`px-4 py-2 rounded-md flex items-center gap-2 transition-all ${
                mode === 'new'
                  ? 'bg-blue-500 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Plus className="w-4 h-4" />
              Start New Project
            </button>
            <button
              onClick={() => setMode('existing')}
              className={`px-4 py-2 rounded-md flex items-center gap-2 transition-all ${
                mode === 'existing'
                  ? 'bg-blue-500 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <FileText className="w-4 h-4" />
              Continue Existing Project
            </button>
          </div>
        </div>

        {mode === 'new' ? (
          <div className="space-y-5">
          {/* Project Name and Model Selection Row */}
          <div className="grid grid-cols-1 lg:grid-cols-[65%_35%] gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-200 mb-2">
                Project Name
              </label>
              <input
                type="text"
                value={formData.projectName}
                onChange={(e) => handleInputChange('projectName', e.target.value)}
                placeholder="Enter your project name..."
                className={`w-full bg-white/5 border rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 transition-all duration-200 ${
                  errors.projectName 
                    ? 'border-red-500 focus:ring-red-500' 
                    : 'border-white/20 focus:ring-blue-500'
                }`}
              />
              {errors.projectName && (
                <p className="text-red-400 text-sm mt-1">{errors.projectName}</p>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-200 mb-2">
                AI Model
              </label>
              <select
                value={isCustomModel ? 'custom' : formData.modelId}
                onChange={(e) => handleInputChange('modelId', e.target.value)}
                className="w-full bg-white/5 border border-white/20 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
              >
                {models.map((model) => (
                  <option key={model.id} value={model.id} className="bg-gray-900">
                    {model.name}
                    {model.description && model.id !== 'custom' && ` - ${model.description}`}
                  </option>
                ))}
              </select>
              
              {/* Custom Model Fields */}
              {isCustomModel && (
                <div className="mt-3 space-y-3 p-4 bg-white/5 rounded-lg border border-white/10">
                  <div>
                    <label className="block text-xs font-medium text-gray-300 mb-1">
                      Custom Model Name
                    </label>
                    <input
                      type="text"
                      value={customModelName}
                      onChange={(e) => handleCustomModelChange('name', e.target.value)}
                      placeholder="e.g., Sonnet 4.0"
                      className={`w-full bg-white/5 border rounded px-3 py-2 text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 transition-all duration-200 ${
                        errors.customModelName 
                          ? 'border-red-500 focus:ring-red-500' 
                          : 'border-white/20 focus:ring-blue-500'
                      }`}
                    />
                    {errors.customModelName && (
                      <p className="text-red-400 text-xs mt-1">{errors.customModelName}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-300 mb-1">
                      Model ID
                    </label>
                    <input
                      type="text"
                      value={customModelId}
                      onChange={(e) => handleCustomModelChange('id', e.target.value)}
                      placeholder="e.g., claude-sonnet-4-20250514"
                      className={`w-full bg-white/5 border rounded px-3 py-2 text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 transition-all duration-200 ${
                        errors.customModelId 
                          ? 'border-red-500 focus:ring-red-500' 
                          : 'border-white/20 focus:ring-blue-500'
                      }`}
                    />
                    {errors.customModelId && (
                      <p className="text-red-400 text-xs mt-1">{errors.customModelId}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      Find model IDs in Anthropic's documentation
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Skill Level */}
          <div>
            <label className="block text-sm font-medium text-gray-200 mb-3">
              Your Technical Background
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {skillLevels.map((skill) => (
                <button
                  key={skill.id}
                  onClick={() => handleInputChange('skillLevel', skill.id)}
                  className={`p-4 rounded-lg border transition-all duration-200 text-left ${
                    formData.skillLevel === skill.id
                      ? 'bg-blue-500/20 border-blue-500 text-blue-200'
                      : 'bg-white/5 border-white/20 text-gray-300 hover:bg-white/10 hover:border-white/30'
                  }`}
                >
                  <div className="font-medium text-sm">{skill.label}</div>
                  <div className="text-xs opacity-80 mt-1">{skill.description}</div>
                </button>
              ))}
            </div>
            {errors.skillLevel && (
              <p className="text-red-400 text-sm mt-1">{errors.skillLevel}</p>
            )}
          </div>

          {/* Software Type */}
          <div>
            <label className="block text-sm font-medium text-gray-200 mb-3">
              What Do You Want to Build?
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
              {softwareTypes.map((type) => (
                <button
                  key={type.id}
                  onClick={() => handleInputChange('softwareType', type.id)}
                  className={`p-3 rounded-lg border transition-all duration-200 text-left ${
                    formData.softwareType === type.id
                      ? 'bg-purple-500/20 border-purple-500 text-purple-200'
                      : 'bg-white/5 border-white/20 text-gray-300 hover:bg-white/10 hover:border-white/30'
                  }`}
                >
                  <div className="font-medium text-sm">{type.label}</div>
                  <div className="text-xs opacity-80 mt-1">{type.description}</div>
                </button>
              ))}
            </div>
            {errors.softwareType && (
              <p className="text-red-400 text-sm mt-1">{errors.softwareType}</p>
            )}
          </div>

          {/* Project Description */}
          <div>
            <label className="block text-sm font-medium text-gray-200 mb-2">
              Describe Your Project Idea
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Tell us about your project idea, key features, target users, and any specific requirements. Feel free to mention any preferred tools or technologies..."
              rows={6}
              className={`w-full bg-white/5 border rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 transition-all duration-200 resize-none ${
                errors.description 
                  ? 'border-red-500 focus:ring-red-500' 
                  : 'border-white/20 focus:ring-blue-500'
              }`}
            />
            {errors.description && (
              <p className="text-red-400 text-sm mt-1">{errors.description}</p>
            )}
          </div>

          {/* Start Button */}
          <div className="pt-4 flex justify-center">
            <button
              onClick={handleStart}
              disabled={!formData.projectName || !formData.skillLevel || !formData.softwareType || !formData.description}
              className="w-full max-w-md bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold py-4 rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 disabled:hover:scale-100 shadow-lg"
            >
              Start Drafting Specifications
            </button>
          </div>
        </div>
        ) : (
          /* Existing Project Mode */
          <div className="space-y-4">
            {/* Model Selection for Existing Projects */}
            <div>
              <label className="block text-sm font-medium text-gray-200 mb-2">
                AI Model
              </label>
              <select
                value={isCustomModel ? 'custom' : formData.modelId}
                onChange={(e) => handleInputChange('modelId', e.target.value)}
                className="w-full bg-white/5 border border-white/20 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
              >
                {models.map(model => (
                  <option key={model.id} value={model.id} className="bg-gray-800">
                    {model.name}
                    {model.description && model.id !== 'custom' && ` - ${model.description}`}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-1">
                Choose the AI model for this session
              </p>
              
              {/* Custom Model Fields */}
              {isCustomModel && (
                <div className="mt-3 space-y-3 p-4 bg-white/5 rounded-lg border border-white/10">
                  <div>
                    <label className="block text-xs font-medium text-gray-300 mb-1">
                      Custom Model Name
                    </label>
                    <input
                      type="text"
                      value={customModelName}
                      onChange={(e) => handleCustomModelChange('name', e.target.value)}
                      placeholder="e.g., Sonnet 4.0"
                      className={`w-full bg-white/5 border rounded px-3 py-2 text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 transition-all duration-200 ${
                        errors.customModelName 
                          ? 'border-red-500 focus:ring-red-500' 
                          : 'border-white/20 focus:ring-blue-500'
                      }`}
                    />
                    {errors.customModelName && (
                      <p className="text-red-400 text-xs mt-1">{errors.customModelName}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-300 mb-1">
                      Model ID
                    </label>
                    <input
                      type="text"
                      value={customModelId}
                      onChange={(e) => handleCustomModelChange('id', e.target.value)}
                      placeholder="e.g., claude-sonnet-4-20250514"
                      className={`w-full bg-white/5 border rounded px-3 py-2 text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 transition-all duration-200 ${
                        errors.customModelId 
                          ? 'border-red-500 focus:ring-red-500' 
                          : 'border-white/20 focus:ring-blue-500'
                      }`}
                    />
                    {errors.customModelId && (
                      <p className="text-red-400 text-xs mt-1">{errors.customModelId}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      Find model IDs in Anthropic's documentation
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Skill Level for Existing Projects */}
            <div>
              <label className="block text-sm font-medium text-gray-200 mb-2">
                Your Technical Background
              </label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {skillLevels.map((skill) => (
                  <button
                    key={skill.id}
                    onClick={() => handleInputChange('skillLevel', skill.id)}
                    className={`p-3 rounded-lg border transition-all duration-200 text-left ${
                      formData.skillLevel === skill.id
                        ? 'bg-blue-500/20 border-blue-500 text-blue-200'
                        : 'bg-white/5 border-white/20 text-gray-300 hover:bg-white/10 hover:border-white/30'
                    }`}
                  >
                    <div className="font-medium text-sm">{skill.label}</div>
                    <div className="text-xs opacity-80 mt-1">{skill.description}</div>
                  </button>
                ))}
              </div>
              {errors.skillLevel && (
                <p className="text-red-400 text-sm mt-1">{errors.skillLevel}</p>
              )}
            </div>

            {/* Spec Selector */}
            <div className="flex-1 min-h-0">
              <label className="block text-sm font-medium text-gray-200 mb-2">
                Select a Project to Continue
              </label>
              <SpecSelector 
                socket={socket} 
                onSelectSpec={handleSpecSelect}
              />
            </div>

            {/* Continue Button */}
            <div className="pt-2 flex justify-center">
              <button
                onClick={handleStart}
                disabled={!selectedSpec || !formData.skillLevel}
                className="w-full max-w-md bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold py-4 rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 disabled:hover:scale-100 shadow-lg"
              >
                Continue with {selectedSpec?.projectName || 'Selected Project'}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default WelcomeScreen;
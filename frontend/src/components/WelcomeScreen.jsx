import React, { useState, useEffect } from 'react';
import { getAllModels, getDefaultModel, MODEL_STORAGE_KEY } from '../config/models.js';

function WelcomeScreen({ onStart, socket }) {
  const models = getAllModels();
  const defaultModel = getDefaultModel();
  
  const [formData, setFormData] = useState({
    projectName: '',
    skillLevel: '',
    softwareType: '',
    description: '',
    modelId: ''
  });
  
  // Load saved model preference and start processes on mount
  useEffect(() => {
    const savedModelId = localStorage.getItem(MODEL_STORAGE_KEY);
    const initialModelId = savedModelId && models.find(m => m.id === savedModelId) ? savedModelId : defaultModel.id;
    setFormData(prev => ({ ...prev, modelId: initialModelId }));
    
    // Start processes with the initial model when socket is ready
    if (socket) {
      socket.emit('start_processes', { modelId: initialModelId });
    }
  }, [socket]);

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
    { id: 'simple-website', label: 'Simple Website', description: 'Blog, Landing Page' }
  ];

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing/selecting
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
    
    // If model changed, update it immediately
    if (field === 'modelId' && socket) {
      socket.emit('change_model', { modelId: value });
      localStorage.setItem(MODEL_STORAGE_KEY, value);
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
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

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleStart = () => {
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
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 shadow-2xl p-8 max-w-2xl w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">SpecDrafter</h1>
          <p className="text-gray-300">AI-powered specification drafting through collaborative intelligence</p>
        </div>

        <div className="space-y-6">
          {/* Project Name */}
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {softwareTypes.map((type) => (
                <button
                  key={type.id}
                  onClick={() => handleInputChange('softwareType', type.id)}
                  className={`p-4 rounded-lg border transition-all duration-200 text-left ${
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
              placeholder="Tell us about your project idea, key features, target users, and any specific requirements..."
              rows={4}
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

          {/* Model Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-200 mb-2">
              AI Model Selection
            </label>
            <select
              value={formData.modelId}
              onChange={(e) => handleInputChange('modelId', e.target.value)}
              className="w-full bg-white/5 border border-white/20 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
            >
              {models.map((model) => (
                <option key={model.id} value={model.id} className="bg-gray-900">
                  {model.name} - {model.description}
                </option>
              ))}
            </select>
            <p className="text-gray-400 text-xs mt-1">
              Both AIs will use this model. You can change it later during the session.
            </p>
          </div>

          {/* Start Button */}
          <div className="pt-4">
            <button
              onClick={handleStart}
              disabled={!formData.projectName || !formData.skillLevel || !formData.softwareType || !formData.description}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold py-4 rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 disabled:hover:scale-100 shadow-lg"
            >
              Start Drafting Specifications
            </button>
          </div>
        </div>

        <div className="mt-8 text-center text-xs text-gray-400">
          <p>SpecDrafter uses dual-AI collaboration to create comprehensive technical specifications</p>
        </div>
      </div>
    </div>
  );
}

export default WelcomeScreen;
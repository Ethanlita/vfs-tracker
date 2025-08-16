import React from 'react';
import { useAuth } from '../contexts/AuthContext';

const ProfileCompletionBanner = ({ onSetupClick }) => {
  const { needsProfileSetup, userProfile } = useAuth();

  if (!needsProfileSetup) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <span className="text-xl">👋</span>
            </div>
            <div>
              <p className="font-medium">
                欢迎使用 VFS Tracker！
              </p>
              <p className="text-sm text-purple-100">
                完善您的个人资料，获得更好的使用体验
              </p>
            </div>
          </div>
          <div className="flex-shrink-0">
            <button
              onClick={onSetupClick}
              className="bg-white text-purple-600 px-4 py-2 rounded-lg font-medium hover:bg-purple-50 transition-colors"
            >
              完善资料
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileCompletionBanner;

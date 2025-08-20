import React from 'react';

const SurveyRBH = ({ values, onChange }) => {
  const handleChange = (field, value) => {
    const numericValue = value === '' ? null : parseInt(value, 10);
    onChange({ ...values, [field]: numericValue });
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <h3 className="text-lg font-semibold mb-4 text-gray-800">RBH 量表</h3>
      <p className="text-sm text-gray-600 mb-6">请对您的声音进行0-3分的评价 (0=无, 1=轻度, 2=中度, 3=重度)。</p>
      <div className="space-y-4">
        {[
          { field: 'R', label: 'R (粗糙度)' },
          { field: 'B', label: 'B (气息感)' },
          { field: 'H', label: 'H (嘶哑度)' },
        ].map(({ field, label }) => (
          <div key={field} className="flex items-center justify-between">
            <label className="text-gray-700 font-medium">{label}:</label>
            <select
              value={values[field] ?? ''}
              onChange={(e) => handleChange(field, e.target.value)}
              className="p-2 border rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500"
            >
              <option value="">请选择</option>
              <option value="0">0 (无)</option>
              <option value="1">1 (轻度)</option>
              <option value="2">2 (中度)</option>
              <option value="3">3 (重度)</option>
            </select>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SurveyRBH;

import React from 'react';

const OVHS9_ITEMS = [
  // 功能 F
  { id: 'F1', text: '我在嘈杂环境下很难让别人清楚地听到我的声音。' },
  { id: 'F2', text: '我的声音问题影响了工作/学习或社交效率。' },
  { id: 'F3', text: '我需要重复或提高音量才能被听清。' },
  // 情感 E
  { id: 'E1', text: '我的声音让我感到尴尬或不自在。' },
  { id: 'E2', text: '因为声音问题，我感到焦虑或担心被误解。' },
  { id: 'E3', text: '我因声音问题而回避打电话或当众发言。' },
  // 生理 P
  { id: 'P1', text: '说话一段时间后，我的喉咙会感到疲劳或疼痛。' },
  { id: 'P2', text: '我需要用很大力气才能发声或保持音量。' },
  { id: 'P3', text: '早晨或长时间不用声后，我的嗓音更差，需要热嗓才能正常说话。' },
];

const SCALE = [
  { value: 0, label: '0 (从不)' },
  { value: 1, label: '1 (几乎不)' },
  { value: 2, label: '2 (有时)' },
  { value: 3, label: '3 (经常)' },
  { value: 4, label: '4 (总是)' },
];

const SurveyOVHS9 = ({ values, onChange }) => {
  const handleChange = (index, value) => {
    const newValues = [...values];
    newValues[index] = value === '' ? null : parseInt(value, 10);
    onChange(newValues);
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <h3 className="text-lg font-semibold mb-4 text-gray-800">OVHS-9 嗓音不便指数 (开放短版)</h3>
      <div className="space-y-4">
        {OVHS9_ITEMS.map((item, index) => (
          <div key={item.id} className="p-4 border rounded-lg shadow-sm bg-gray-50">
            <p className="mb-2 text-gray-700">{index + 1}. {item.text}</p>
            <div className="flex flex-wrap gap-2">
              {SCALE.map(({ value, label }) => (
                <label key={value} className="flex items-center space-x-2 p-2 rounded-md hover:bg-purple-100 cursor-pointer">
                  <input
                    type="radio"
                    name={`ovhs9-${index}`}
                    value={value}
                    checked={values[index] === value}
                    onChange={() => handleChange(index, value)}
                    className="form-radio h-4 w-4 text-purple-600 focus:ring-purple-500"
                  />
                  <span className="text-sm">{label}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SurveyOVHS9;

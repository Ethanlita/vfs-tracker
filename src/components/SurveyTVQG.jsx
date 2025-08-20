import React from 'react';

const TVQG_ITEMS = [
  // 沟通与负担
  { id: 'C1', text: '我需要比别人更费力才能把话说清楚。' },
  { id: 'C2', text: '长时间说话后，我不得不暂停或喝水才能继续。' },
  { id: 'C3', text: '说话后，我的嗓音会变得嘶哑或沙哑。' },
  { id: 'C4', text: '在打电话或线上会议中，我常被要求重复。' },
  // 社交与情绪
  { id: 'S1', text: '我因为嗓音而减少社交或公开发言。' },
  { id: 'S2', text: '我担心自己的声音让别人误以为我生病或情绪不好。' },
  { id: 'S3', text: '嗓音问题影响了我的自信心。' },
  { id: 'S4', text: '我在需要提高音量（如户外）时感到吃力。' },
  // 症状与自我管理
  { id: 'P1', text: '我经常清嗓或咳嗽以获得更清晰的声音。' },
  { id: 'P2', text: '早晨或久不说话后，声音明显更差。' },
  { id: 'P3', text: '我说话时出现破音、断裂或不稳定。' },
  { id: 'P4', text: '即使休息后，我的声音也很难完全恢复。' },
];

const SCALE = [
  { value: 0, label: '0 (从不)' },
  { value: 1, label: '1 (很少)' },
  { value: 2, label: '2 (有时)' },
  { value: 3, label: '3 (经常)' },
  { value: 4, label: '4 (总是)' },
];

const SurveyTVQG = ({ values, onChange }) => {
  const handleChange = (index, value) => {
    const newValues = [...values];
    newValues[index] = value === '' ? null : parseInt(value, 10);
    onChange(newValues);
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <h3 className="text-lg font-semibold mb-4 text-gray-800">TVQ-G 通用嗓音问卷 (12项开放版)</h3>
      <div className="space-y-4">
        {TVQG_ITEMS.map((item, index) => (
          <div key={item.id} className="p-4 border rounded-lg shadow-sm bg-gray-50">
            <p className="mb-2 text-gray-700">{index + 1}. {item.text}</p>
            <div className="flex flex-wrap gap-2">
              {SCALE.map(({ value, label }) => (
                <label key={value} className="flex items-center space-x-2 p-2 rounded-md hover:bg-purple-100 cursor-pointer">
                  <input
                    type="radio"
                    name={`tvqg-${index}`}
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

export default SurveyTVQG;

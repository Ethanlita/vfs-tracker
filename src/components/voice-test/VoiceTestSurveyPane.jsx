/** @file 嗓音测试主观量表界面。 */
import SurveyRBH from '../SurveyRBH';
import SurveyOVHS9 from '../SurveyOVHS9';
import SurveyTVQG from '../SurveyTVQG';

/** 将三张量表保持为纯展示组件，变化统一上送编排 hook。 */
export default function VoiceTestSurveyPane({ formData, onChange }) {
  return (
    <div className="space-y-8">
      <SurveyRBH values={formData.rbh} onChange={values => onChange('rbh', values)} />
      <SurveyOVHS9 values={formData.ovhs9} onChange={values => onChange('ovhs9', values)} />
      <SurveyTVQG values={formData.tvqg} onChange={values => onChange('tvqg', values)} />
    </div>
  );
}

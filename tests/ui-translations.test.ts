import {describe,it,expect} from "vitest";
import {translateUi} from "../src/lib/ui-translations";
import {languageCodes} from "../src/lib/languages";
describe('interface translations',()=>{
 for(const language of languageCodes.filter(code=>code!=='en'))it(`translates every section and authentication in ${language}`,()=>{
  for(const copy of ['Make room for questions.','SCROLL DOWN','CARE IS BETTER.','Follow it with confidence.','Medical expert sign-in','Your care plan is ready','Only clinician-approved instructions','View original source']){
   expect(translateUi(copy,language)).not.toBe(copy);expect(translateUi(copy,language).trim()).not.toBe('');
  }
 });
 it('keeps unknown medical source, personal content and English verbatim',()=>{
  const original='Take 7 mg of Original Medicine at 13:00 — clinician source 456.';
  for(const language of languageCodes){expect(translateUi(original,language)).toBe(original);expect(translateUi('patient@example.test',language)).toBe('patient@example.test');}
  expect(translateUi('CLARIFY','en')).toBe('CLARIFY');
 });
});

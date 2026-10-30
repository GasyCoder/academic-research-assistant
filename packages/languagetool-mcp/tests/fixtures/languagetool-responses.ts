/*
 * Response bodies modelled on a LanguageTool 6.9-SNAPSHOT server.
 * The analysed sentences are synthetic test strings.
 */

const software = {
  name: 'LanguageTool',
  version: '6.9-SNAPSHOT',
  buildDate: '2026-10-29 18:47:38 +0100',
  apiVersion: 1,
  premium: false,
  status: '',
};

export const infoResponse = {
  software: {
    name: 'LanguageTool',
    version: '6.9-SNAPSHOT',
    buildDate: '2026-10-29 18:47:38 +0100',
    commit: '30e303e',
    premium: false,
  },
};

export const languagesResponse = [
  { name: 'English', code: 'en', longCode: 'en' },
  { name: 'English (US)', code: 'en', longCode: 'en-US' },
  { name: 'English (GB)', code: 'en', longCode: 'en-GB' },
  { name: 'French', code: 'fr', longCode: 'fr' },
  { name: 'French (Canada)', code: 'fr', longCode: 'fr-CA' },
  { name: 'Arabic', code: 'ar', longCode: 'ar' },
];

export const frenchText = 'Je suis allé a la plage hier. Il ont mangé.';

export const frenchCheckResponse = {
  software,
  warnings: { incompleteResults: false },
  language: {
    name: 'French',
    code: 'fr',
    detectedLanguage: { name: 'French', code: 'fr', confidence: 0.9999953, source: '+fallback' },
  },
  matches: [
    {
      message: 'Dans l’expression suivante, la préposition « a » possède un accent grave.',
      shortMessage: '',
      replacements: [{ value: 'à' }],
      offset: 13,
      length: 1,
      context: { text: frenchText, offset: 13, length: 1 },
      sentence: 'Je suis allé a la plage hier.',
      type: { typeName: 'Other' },
      rule: {
        id: 'A_A_ACCENT',
        subId: '4',
        sourceFile: 'grammar.xml',
        description: "'A' au lieu de 'À'",
        issueType: 'uncategorized',
        category: { id: 'CAT_HOMONYMES_PARONYMES', name: 'Confusion d’homonymes et paronymes' },
      },
      ignoreForIncompleteSentence: true,
      contextForSureMatch: 5,
    },
    {
      message: 'Vérifiez l’accord entre le pronom « Il » et le verbe « ont ».',
      shortMessage: '',
      replacements: [{ value: 'Ils ont' }, { value: 'Il a' }],
      offset: 30,
      length: 6,
      context: { text: frenchText, offset: 30, length: 6 },
      sentence: 'Il ont mangé.',
      type: { typeName: 'Other' },
      rule: {
        id: 'ACCORD_R_PERS_VERBE',
        subId: '3',
        sourceFile: 'grammar.xml',
        description: 'il/elle + 0 tokens + Verbe',
        issueType: 'uncategorized',
        category: { id: 'CAT_GRAMMAIRE', name: 'Grammaire' },
      },
      ignoreForIncompleteSentence: true,
      contextForSureMatch: 8,
    },
  ],
  sentenceRanges: [
    [0, 29],
    [30, 43],
  ],
};

export const englishText = 'This are a smple sentence.';

export const englishCheckResponse = {
  software,
  warnings: { incompleteResults: false },
  language: {
    name: 'English (US)',
    code: 'en-US',
    detectedLanguage: { name: 'English (US)', code: 'en-US', confidence: 0.9999944, source: '+fallback' },
  },
  matches: [
    {
      message: 'Possible spelling mistake found.',
      shortMessage: 'Spelling mistake',
      replacements: [{ value: 'simple' }, { value: 'sample' }, { value: 'ample' }, { value: 'smile' }, { value: 'Siple' }],
      offset: 11,
      length: 5,
      context: { text: englishText, offset: 11, length: 5 },
      sentence: englishText,
      type: { typeName: 'UnknownWord' },
      rule: {
        id: 'MORFOLOGIK_RULE_EN_US',
        description: 'Possible spelling mistake',
        issueType: 'misspelling',
        category: { id: 'TYPOS', name: 'Possible Typo' },
      },
    },
  ],
};

export const emptyCheckResponse = {
  software,
  warnings: { incompleteResults: false },
  language: {
    name: 'English (US)',
    code: 'en-US',
    detectedLanguage: { name: 'English (US)', code: 'en-US', confidence: 0.99, source: null },
  },
  matches: [],
  sentenceRanges: [[0, 24]],
};

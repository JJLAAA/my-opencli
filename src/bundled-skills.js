import skill from '../skills/tap-adapter-author/SKILL.md' with { type: 'text' };
import adapterTemplate from '../skills/tap-adapter-author/references/adapter-template.md' with { type: 'text' };
import fieldMapping from '../skills/tap-adapter-author/references/field-mapping.md' with { type: 'text' };
import patterns from '../skills/tap-adapter-author/references/patterns.md' with { type: 'text' };

export const BUNDLED_SKILLS = {
  'tap-adapter-author': {
    'SKILL.md': skill,
    'references/adapter-template.md': adapterTemplate,
    'references/field-mapping.md': fieldMapping,
    'references/patterns.md': patterns,
  },
};

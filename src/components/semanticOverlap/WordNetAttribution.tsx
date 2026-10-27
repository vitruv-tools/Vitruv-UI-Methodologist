import React from 'react';
import { themeVars } from '../../theme/theme';

/** Attribution required by the CC-BY 4.0 licence of Open English WordNet. */
export const WordNetAttribution: React.FC = () => (
  <p style={{ margin: 0, fontSize: 11, color: themeVars.textFaint }}>
    Synonyms:{' '}
    <a href="https://github.com/globalwordnet/english-wordnet" target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>
      Open English WordNet 2025
    </a>
    , licensed under{' '}
    <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>
      CC-BY 4.0
    </a>
    .
  </p>
);

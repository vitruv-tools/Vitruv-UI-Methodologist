const monaco = {
  languages: {
    register: jest.fn(),
    setMonarchTokensProvider: jest.fn(),
    setLanguageConfiguration: jest.fn(),
    getLanguages: jest.fn(() => []),
    registerCompletionItemProvider: jest.fn(() => ({ dispose: jest.fn() })),
  },
  editor: {
    defineTheme: jest.fn(),
    setTheme: jest.fn(),
    setModelMarkers: jest.fn(),
  },
  MarkerSeverity: { Error: 8, Warning: 4, Info: 2, Hint: 1 },
};

module.exports = monaco;
module.exports.default = monaco;
module.exports.languages = monaco.languages;
module.exports.editor = monaco.editor;
module.exports.MarkerSeverity = monaco.MarkerSeverity;

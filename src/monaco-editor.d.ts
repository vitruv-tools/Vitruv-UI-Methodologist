// monaco-editor 0.56+ publishes its API through the package "exports" map.
// Create React App typechecks with TypeScript 4.9 and moduleResolution "node",
// which ignores "exports" and follows the legacy "typings" entry. That entry
// still points at esm/vs/editor/editor.main.d.ts, which these releases do not ship.
declare module 'monaco-editor' {
  export * from 'monaco-editor/esm/vs/editor/editor.api';
}

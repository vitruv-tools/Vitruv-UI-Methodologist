/** URL of the Model Library view, so it survives a page refresh and can be linked to. */
export const MODEL_LIBRARY_PATH = '/model-library';

/** URL of a meta-model's preview in the Model Library. */
export const modelLibraryModelPath = (modelId: string | number) => `${MODEL_LIBRARY_PATH}/${modelId}`;

/** URL of the Semantic overlap view, which compares two library meta-models. */
export const SEMANTIC_OVERLAP_PATH = '/semantic-overlap';

/** URL of a meta-model's full-screen UML editor in the Model Library. */
export const modelLibraryUmlPath = (modelId: string | number) => `${modelLibraryModelPath(modelId)}/uml`;

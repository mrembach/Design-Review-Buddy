import { EventHandler } from '@create-figma-plugin/utilities'

export interface VariableCollectionData {
  id: string
  name: string
  key: string
  libraryName?: string
}

export interface VariableData {
  id: string
  name: string
  key: string
  type: string
  valuesByMode: Record<string, any>
  resolvedValue?: any
  collectionName?: string
  collectionKey?: string
}

export interface SelectedCollectionData extends VariableCollectionData {
  variables?: Array<VariableData>
}

// Type definition for nodes that can have variables bound to them
export interface VariableBindableNode {
  id: string;
  type: string;
  name: string;
  setBoundVariable(field: VariableBindableNodeField, variable: Variable | null): void;
  // Add other common properties as needed
}

// Type definition for fields that can have variables bound to them
export type VariableBindableNodeField = 
  | 'bottomLeftRadius'
  | 'bottomRightRadius'
  | 'topLeftRadius'
  | 'topRightRadius'
  | 'paddingLeft'
  | 'paddingRight'
  | 'paddingTop'
  | 'paddingBottom'
  | 'itemSpacing'
  | 'counterAxisSpacing';

export interface NodeProperty {
  name: string
  value: any
  formattedValue: string
  variableId?: string
  collectionId?: string
  styleName?: string
  isMismatched: boolean
  matchedByException?: string
  suggestedVariable?: {
    id: string
    name: string
    value: any
  }
  expectedCollections: Array<{
    id: string
    name: string
  }>
  nodeId?: string
}

export interface AnalysisResult {
  nodeId: string
  nodeName: string
  nodeType: string
  layoutMode?: string
  properties: Array<NodeProperty>
  isLocked: boolean
  isVisible: boolean
}

export interface InitializeHandler extends EventHandler {
  name: 'INITIALIZE'
  handler: (variableCollections: Array<VariableCollectionData>) => void
}

export interface CollectionSelectedHandler extends EventHandler {
  name: 'COLLECTION_SELECTED'
  handler: (collectionId: string) => void
}

export interface StartReviewHandler extends EventHandler {
  name: 'START_REVIEW'
  handler: (collectionId: string) => void
}

export interface CloseHandler extends EventHandler {
  name: 'CLOSE'
  handler: () => void
}

export interface FrameSelectionHandler extends EventHandler {
  name: 'FRAME_SELECTION_CHANGED'
  handler: (hasSingleFrameSelected: boolean) => void
}

export interface AnalyzeFrameHandler extends EventHandler {
  name: 'ANALYZE_FRAME'
  handler: (exceptions: string) => void
}

export interface AnalysisResultsHandler extends EventHandler {
  name: 'ANALYSIS_RESULTS'
  handler: (results: Array<AnalysisResult>) => void
}

export interface SelectLayerHandler extends EventHandler {
  name: 'SELECT_LAYER'
  handler: (nodeId: string) => void
}

export interface ApplyRecommendationHandler extends EventHandler {
  name: 'APPLY_RECOMMENDATION'
  handler: (nodeId: string, property: NodeProperty, suggestedVariable: { id: string; name: string; value: any }) => void
}

export type VariableResolvedDataType = 'COLOR' | 'FLOAT' | 'STRING' | 'BOOLEAN';

export interface LibraryVariable {
  id: string
  name: string
  key: string
  resolvedType: VariableResolvedDataType
  valuesByMode: { [modeId: string]: any }
  defaultValue: any
  description: string
  hiddenFromPublishing: boolean
  remote: boolean
  variableCollectionId: string
  scopes: string[]
  resolvedValue?: any
  modeNames?: { [modeId: string]: string }
  displayValue?: string
}

export interface LibraryVariables {
  collectionName: string;
  collectionId: string;
  libraryName: string;
  variables: Array<LibraryVariable>;
}

export interface LibraryVariablesHandler extends EventHandler {
  name: 'LIBRARY_VARIABLES_LOADED'
  handler: (variables: Array<LibraryVariables>) => void
}

export interface Collection {
  id: string
  name: string
}

export interface AnalysisClickHandler extends EventHandler {
  name: 'ANALYSIS_CLICK'
  handler: () => void
}

export interface ExcludedNamesChangedHandler extends EventHandler {
  name: 'EXCLUDED_NAMES_CHANGED'
  handler: (patterns: string) => void
}

export interface ExceptionPatternsChangedHandler extends EventHandler {
  name: 'EXCEPTION_PATTERNS_CHANGED'
  handler: (patterns: string) => void
}

export interface InitHandler extends EventHandler {
  name: 'INITIALIZE'
  handler: (data: { collections: Array<Collection>, selectedCollection: string | null }) => void
}

export interface SelectCollectionHandler extends EventHandler {
  name: 'SELECT_COLLECTION'
  handler: (collectionId: string) => void
}

export interface ShowErrorHandler extends EventHandler {
  name: 'SHOW_ERROR'
  handler: (errorMessage: string) => void
}

export interface SingleFrameSelectedHandler extends EventHandler {
  name: 'SINGLE_FRAME_SELECTED'
  handler: (hasSingleFrameSelected: boolean) => void
}

export interface ToggleExcludeHiddenLayersHandler extends EventHandler {
  name: 'TOGGLE_EXCLUDE_HIDDEN_LAYERS'
  handler: (exclude: boolean) => void
}

export interface ToggleExcludeLockedLayersHandler extends EventHandler {
  name: 'TOGGLE_EXCLUDE_LOCKED_LAYERS'
  handler: (exclude: boolean) => void
}

// New types for Reviewer functionality
export interface FrameImageData {
  imageUrl: string;
  width: number;
  height: number;
  frameName: string;
  frameId: string;
}

export interface RunReviewerHandler extends EventHandler {
  name: 'RUN_REVIEWER'
  handler: () => void
}

export interface FrameImageExportedHandler extends EventHandler {
  name: 'FRAME_IMAGE_EXPORTED'
  handler: (frameImageData: FrameImageData) => void
}

export interface OpenExternalUrlHandler extends EventHandler {
  name: 'OPEN_EXTERNAL_URL'
  handler: (url: string) => void
}

// Design review types
export interface DesignReviewResult {
  feedback: string;
  categories: {
    contrast: number;
    hierarchy: number;
    alignment: number;
    proximity: number;
  };
  errors?: string;
}

export interface DesignReviewHandler extends EventHandler {
  name: 'PROCESS_DESIGN_REVIEW'
  handler: (frameImageData: FrameImageData, apiKey: string) => void
}

export interface DesignReviewResultHandler extends EventHandler {
  name: 'DESIGN_REVIEW_RESULT'
  handler: (reviewResult: DesignReviewResult) => void
}

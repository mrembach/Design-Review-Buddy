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
}

export interface SelectedCollectionData extends VariableCollectionData {
  variables?: Array<VariableData>
}

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

export interface SetFigmaApiKeyHandler extends EventHandler {
  name: 'SET_FIGMA_API_KEY'
  handler: (apiKey: string) => void
}

export interface ApiKeyUpdatedHandler extends EventHandler {
  name: 'API_KEY_UPDATED'
  handler: (success: boolean) => void
}

export interface ResolvedVariableValue {
  variableId: string;
  name: string;
  value: any;
  resolvedType: VariableResolvedDataType;
}

export interface FetchVariableValuesHandler extends EventHandler {
  name: 'FETCH_VARIABLE_VALUES'
  handler: () => void
}

export interface VariableValuesLoadedHandler extends EventHandler {
  name: 'VARIABLE_VALUES_LOADED'
  handler: (values: ResolvedVariableValue[]) => void
}

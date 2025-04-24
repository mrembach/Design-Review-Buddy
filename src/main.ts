import { emit, on, once, showUI } from '@create-figma-plugin/utilities'

import { 
  CloseHandler, 
  CollectionSelectedHandler, 
  InitializeHandler, 
  StartReviewHandler,
  FrameSelectionHandler,
  AnalyzeFrameHandler,
  AnalysisResultsHandler,
  VariableCollectionData,
  SelectedCollectionData,
  AnalysisResult,
  NodeProperty,
  LibraryVariables,
  LibraryVariablesHandler,
  LibraryVariable,
  VariableResolvedDataType,
  SetFigmaApiKeyHandler,
  ApiKeyUpdatedHandler,
  FetchVariableValuesHandler,
  VariableValuesLoadedHandler,
  ResolvedVariableValue
} from './types'

// Store collections data in the main context
let collectionsData: Array<VariableCollectionData> = []
let selectedCollection: SelectedCollectionData | null = null
let figmaApiKey: string | null = null

// Track frame selection state
let hasSingleFrameSelected = false

// Helper function to check if a value matches any variable in the collection
function findMatchingVariable(value: any, type: string): { id: string; name: string; value: any } | undefined {
  if (!selectedCollection?.variables) return undefined
  
  const matchingVariable = selectedCollection.variables.find(variable => {
    if (variable.type !== type) return false
    
    // Handle different value types
    if (type === 'COLOR') {
      return JSON.stringify(variable.valuesByMode) === JSON.stringify(value)
    }
    
    return variable.valuesByMode === value
  })

  if (!matchingVariable) return undefined

  return {
    id: matchingVariable.id,
    name: matchingVariable.name,
    value: matchingVariable.valuesByMode
  }
}

// Helper function to clean collection ID (get part before slash)
function cleanCollectionId(id: string | undefined): string | undefined {
  if (!id) return undefined
  return id.split('/')[0]
}

// Helper function to ensure object is serializable
function makeSerializable(obj: any): any {
  return JSON.parse(JSON.stringify(obj))
}

// Helper function to check if a style matches any exception pattern
function matchesException(styleName: string | undefined, exceptions: string): string | undefined {
  if (!styleName || !exceptions) return undefined
  
  console.log('Checking style against exceptions:', { styleName, exceptions })
  
  const patterns = exceptions.split(', ').filter(p => p.trim())
  for (const pattern of patterns) {
    if (pattern.endsWith('*')) {
      const prefix = pattern.slice(0, -1)
      console.log('Checking prefix match:', { prefix, styleName })
      if (styleName.includes(prefix)) {
        return pattern
      }
    } else if (pattern === styleName) {
      return pattern
    }
  }
  return undefined
}

// Helper function to check if collections match
function isCollectionMatch(propertyCollectionId: string | undefined, styleName: string | undefined, selectedCollectionId: string | undefined, exceptions: string = ''): { isMatch: boolean; matchedByException?: string } {
  // Check for exception match first using style name
  const exceptionMatch = matchesException(styleName, exceptions)
  if (exceptionMatch) {
    console.log('Style Exception Match:', {
      style: styleName,
      matchedPattern: exceptionMatch
    })
    return { isMatch: true, matchedByException: exceptionMatch }
  }

  if (!propertyCollectionId || !selectedCollectionId) return { isMatch: false }
  
  // Get the selected collection
  const selectedCollection = collectionsData.find(c => c.id === selectedCollectionId)
  if (!selectedCollection) return { isMatch: false }
  
  // Find all collections from the same library
  const libraryCollections = collectionsData.filter(c => 
    c.libraryName === selectedCollection.libraryName
  )

  // Check if property collection matches any of the library collection IDs
  for (const collection of libraryCollections) {
    // For variables (no style name), check if the property's collection ID is a prefix
    // or if the collection ID is a prefix of the property's ID
    if (!styleName) {
      const propertyIncludesCollection = propertyCollectionId.includes(collection.id)
      const collectionIncludesProperty = collection.id.includes(propertyCollectionId)

      if (propertyIncludesCollection || collectionIncludesProperty) {
        console.log('Variable Collection Match:', {
          property: propertyCollectionId,
          matchedWith: collection.name
        })
        return { isMatch: true }
      }
    } else {
      // For styles, check if the style's collection ID includes our collection ID
      if (propertyCollectionId.includes(collection.id)) {
        console.log('Style Collection Match:', {
          style: styleName,
          matchedWith: collection.name
        })
        return { isMatch: true }
      }
    }
  }
  
  return { isMatch: false }
}

// Helper function to convert RGB color to hex
function rgbToHex(color: { r: number; g: number; b: number }): string {
  const r = Math.round(color.r * 255)
  const g = Math.round(color.g * 255)
  const b = Math.round(color.b * 255)
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

// Helper function to format values based on type
function formatValue(name: string, value: any): string {
  // Handle solid color values
  if (value && typeof value === 'object' && 'r' in value && 'g' in value && 'b' in value) {
    return rgbToHex(value)
  }
  
  // Handle gradient values
  if (value && typeof value === 'object' && value.type && value.type.includes('GRADIENT')) {
    if (value.gradientStops && value.gradientStops.length >= 2) {
      const startColor = rgbToHex(value.gradientStops[0].color)
      const endColor = rgbToHex(value.gradientStops[value.gradientStops.length - 1].color)
      return `Gradient: ${startColor} → ${endColor}`
    }
  }
  
  // Handle numeric values (padding, radius, etc)
  if (typeof value === 'number') {
    return value.toString()
  }
  
  return JSON.stringify(value)
}

// Helper function to get expected collections
function getExpectedCollections(selectedCollectionId: string | undefined): Array<{ id: string, name: string }> {
  if (!selectedCollectionId) return []
  
  const selectedCollection = collectionsData.find(c => c.id === selectedCollectionId)
  if (!selectedCollection) return []
  
  return collectionsData
    .filter(c => c.libraryName === selectedCollection.libraryName)
    .map(c => ({ id: c.id, name: c.name }))
}

// Helper function to analyze a node's properties
function analyzeNodeProperties(node: SceneNode, exceptions: string): Array<NodeProperty> {
  console.log('\n=== Starting Node Analysis ===')
  console.log('Node:', {
    name: node.name,
    type: node.type,
    id: node.id
  })

  const properties: Array<NodeProperty> = []
  const node_any = node as any
  const expectedCollections = getExpectedCollections(selectedCollection?.id)
  
  console.log('Expected Collections:', expectedCollections)

  // Check fills
  if ('fills' in node && Array.isArray(node.fills)) {
    node.fills.forEach((fill, index) => {
      // Get the style ID if the fill is from a style
      const styleId = (node as any).fillStyleId
      let collectionId = undefined
      let variableId = undefined
      let styleName = undefined

      // Check if it's a style
      if (styleId) {
        try {
          const style = figma.getStyleById(styleId)
          if (style) {
            collectionId = style.key
            styleName = style.name
            console.log('Found style:', { name: styleName, key: collectionId })
          }
        } catch (error) {
          console.error('Error getting style:', error)
        }
      } else if (fill.type === 'SOLID') {
        // If not a style, check for variable binding
        const boundVariable = (fill as any).boundVariables?.color
        variableId = boundVariable?.id
        collectionId = boundVariable?.collectionId

        if (variableId && !collectionId) {
          try {
            const variable = figma.variables.getVariableById(variableId)
            if (variable) {
              collectionId = variable.variableCollectionId
              console.log('Found variable collection:', { id: collectionId })
            }
          } catch (error) {
            console.error('Error getting variable:', error)
          }
        }
      }

      // Only add to properties if we have a style or variable binding
      if (styleId || collectionId) {
        const matchResult = isCollectionMatch(collectionId, styleName, selectedCollection?.id, exceptions)
        console.log('Match result for fill:', { 
          matchResult, 
          styleName, 
          collectionId,
          isStyle: !!styleId,
          isVariable: !!variableId
        })
        
        const property: NodeProperty = {
          name: `Fill ${index + 1}`,
          value: fill.type === 'SOLID' ? fill.color : fill,
          formattedValue: formatValue(`Fill ${index + 1}`, fill.type === 'SOLID' ? fill.color : fill),
          variableId,
          collectionId,
          styleName,
          expectedCollections,
          isMismatched: !matchResult.isMatch,
          ...(matchResult.matchedByException && { matchedByException: matchResult.matchedByException })
        }
        
        // Only suggest variables if it's actually mismatched (not matched by exception)
        if (property.isMismatched && !matchResult.matchedByException) {
          const suggestedVar = findMatchingVariable(property.value, 'COLOR')
          if (suggestedVar) {
            property.suggestedVariable = makeSerializable(suggestedVar)
          }
        }
        
        properties.push(property)
      }
    })
  }
  
  // Check strokes
  if ('strokes' in node && Array.isArray(node.strokes)) {
    node.strokes.forEach((stroke, index) => {
      if (stroke.type === 'SOLID') {
        const boundVariable = (stroke as any).boundVariables?.color
        const variableId = boundVariable?.id
        let collectionId = boundVariable?.collectionId

        // If we have a variableId but no collectionId, try to get it from the variable
        if (variableId && !collectionId) {
          try {
            const variable = figma.variables.getVariableById(variableId)
            if (variable) {
              collectionId = variable.variableCollectionId
            }
          } catch (error) {
            console.error('Error getting variable:', error)
          }
        }

        const matchResult = isCollectionMatch(collectionId, undefined, selectedCollection?.id, exceptions)
        
        const property: NodeProperty = {
          name: `Stroke ${index + 1}`,
          value: makeSerializable(stroke.color),
          formattedValue: formatValue(`Stroke ${index + 1}`, stroke.color),
          variableId,
          collectionId,
          expectedCollections,
          isMismatched: !matchResult.isMatch,
          ...(matchResult.matchedByException && { matchedByException: matchResult.matchedByException })
        }
        
        if (property.isMismatched) {
          const suggestedVar = findMatchingVariable(stroke.color, 'COLOR')
          if (suggestedVar) {
            property.suggestedVariable = makeSerializable(suggestedVar)
          }
        }
        
        properties.push(property)
      }
    })
  }
  
  // Check corner radius - handle individual corners
  const corners = [
    { name: 'Top Left', prop: 'topLeftRadius' },
    { name: 'Top Right', prop: 'topRightRadius' },
    { name: 'Bottom Right', prop: 'bottomRightRadius' },
    { name: 'Bottom Left', prop: 'bottomLeftRadius' }
  ]

  corners.forEach(corner => {
    if (corner.prop in node_any && node_any[corner.prop] !== undefined && node_any[corner.prop] !== 0) {
      console.log(`\nChecking ${corner.name} corner radius:`)
      
      const boundVariable = node_any.boundVariables?.[corner.prop]
      const variableId = boundVariable?.id
      let collectionId = boundVariable?.collectionId

      console.log('Corner binding info:', {
        cornerName: corner.name,
        value: node_any[corner.prop],
        variableId,
        collectionId,
        boundVariable
      })

      if (variableId && !collectionId) {
        try {
          const variable = figma.variables.getVariableById(variableId)
          if (variable) {
            collectionId = variable.variableCollectionId
            console.log('Retrieved collection ID from variable:', collectionId)
          }
        } catch (error) {
          console.error('Error getting variable:', error)
        }
      }

      const matchResult = isCollectionMatch(collectionId, undefined, selectedCollection?.id, exceptions)
      console.log('Match result:', matchResult)
      
      const property: NodeProperty = {
        name: `Corner Radius ${corner.name}`,
        value: node_any[corner.prop],
        formattedValue: formatValue(corner.prop, node_any[corner.prop]),
        variableId,
        collectionId,
        expectedCollections,
        isMismatched: !matchResult.isMatch,
        ...(matchResult.matchedByException && { matchedByException: matchResult.matchedByException })
      }
      
      console.log('Created property:', property)
      
      if (property.isMismatched) {
        const suggestedVar = findMatchingVariable(property.value, 'FLOAT')
        if (suggestedVar) {
          property.suggestedVariable = makeSerializable(suggestedVar)
          console.log('Found suggested variable:', suggestedVar)
        }
      }
      
      properties.push(property)
    }
  })
  
  // Check padding
  const paddings = {
    left: (node as any).paddingLeft,
    right: (node as any).paddingRight,
    top: (node as any).paddingTop,
    bottom: (node as any).paddingBottom
  }
  
  Object.entries(paddings).forEach(([key, value]) => {
    if (value !== undefined && value !== 0) {
      const boundVariable = (node as any).boundVariables?.[`padding${key.charAt(0).toUpperCase() + key.slice(1)}`]
      const variableId = boundVariable?.id
      let collectionId = boundVariable?.collectionId

      // If we have a variableId but no collectionId, try to get it from the variable
      if (variableId && !collectionId) {
        try {
          const variable = figma.variables.getVariableById(variableId)
          if (variable) {
            collectionId = variable.variableCollectionId
          }
        } catch (error) {
          console.error('Error getting variable:', error)
        }
      }

      const matchResult = isCollectionMatch(collectionId, undefined, selectedCollection?.id, exceptions)
      
      const property: NodeProperty = {
        name: `Padding ${key.charAt(0).toUpperCase() + key.slice(1)}`,
        value,
        formattedValue: formatValue(`Padding ${key.charAt(0).toUpperCase() + key.slice(1)}`, value),
        variableId,
        collectionId,
        expectedCollections,
        isMismatched: !matchResult.isMatch,
        ...(matchResult.matchedByException && { matchedByException: matchResult.matchedByException })
      }
      
      if (property.isMismatched) {
        const suggestedVar = findMatchingVariable(value, 'FLOAT')
        if (suggestedVar) {
          property.suggestedVariable = makeSerializable(suggestedVar)
        }
      }
      
      properties.push(property)
    }
  })
  
  return properties
}

// Helper function to check if a node should be excluded based on visibility and lock state
function shouldExcludeNode(node: SceneNode, parentIsHidden: boolean, parentIsLocked: boolean): boolean {
  const isHidden = parentIsHidden || !node.visible
  const isLocked = parentIsLocked || node.locked
  return isHidden || isLocked
}

// Helper function to recursively analyze all children
function analyzeNodeAndChildren(
  node: SceneNode, 
  exceptions: string, 
  parentIsHidden: boolean = false,
  parentIsLocked: boolean = false
): Array<AnalysisResult> {
  const results: Array<AnalysisResult> = []
  
  // Check if this node should be excluded
  const isHidden = parentIsHidden || !node.visible
  const isLocked = parentIsLocked || node.locked
  
  // Only analyze the node if it's not excluded
  if (!shouldExcludeNode(node, parentIsHidden, parentIsLocked)) {
    // Analyze the current node
    const properties = analyzeNodeProperties(node, exceptions)
    if (properties.length > 0) {
      results.push({
        nodeId: node.id,
        nodeName: node.name,
        nodeType: node.type,
        layoutMode: node.type === 'FRAME' ? node.layoutMode : 'NONE',
        isLocked: isLocked,
        isVisible: !isHidden,
        properties
      })
    }
  }
  
  // Recursively analyze children if they exist, passing down the visibility and lock states
  if ('children' in node) {
    node.children.forEach(child => {
      results.push(...analyzeNodeAndChildren(child, exceptions, isHidden, isLocked))
    })
  }
  
  return results
}

// Helper function to fetch variables from a collection
async function getCollectionVariables(collection: VariableCollectionData): Promise<LibraryVariables | null> {
  try {
    console.log('Getting collection by ID:', collection.id)
    const figmaCollection = figma.variables.getVariableCollectionById(collection.id)
    if (!figmaCollection) {
      console.log('No collection found for ID:', collection.id)
      return null
    }
    
    console.log('Found collection:', figmaCollection)
    console.log('Variable IDs:', figmaCollection.variableIds)

    const variables = figmaCollection.variableIds.map(id => {
      console.log('Getting variable by ID:', id)
      const variable = figma.variables.getVariableById(id)
      if (!variable) {
        console.log('No variable found for ID:', id)
        return null
      }
      console.log('Found variable:', variable)
      return {
        name: variable.name,
        type: variable.resolvedType,
        value: variable.valuesByMode,
        id: variable.id
      }
    }).filter(v => v !== null)

    console.log('Processed variables:', variables)

    // DEBUG: Log the first variable to see its structure
    if (variables.length > 0) {
      console.log('First Variable Structure:', JSON.stringify(variables[0], null, 2))
      console.log('Full variable raw data:', variables[0])
      // Check for other possible property names that might contain the mode values
      console.log('Property names:', Object.keys(variables[0]))
    }

    return {
      collectionName: collection.name,
      collectionId: collection.id,
      libraryName: collection.libraryName || '',
      variables: variables as any[]
    }
  } catch (error) {
    console.error('Error fetching variables:', error)
    return null
  }
}

// Function to fetch all library variables
async function fetchLibraryVariables(collectionId: string): Promise<LibraryVariables[]> {
  try {
    // Get all available library collections
    const collections = await figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync()
    
    // Find the collection with the matching key
    const collection = collections.find(c => c.key === collectionId)
    if (!collection) {
      throw new Error(`Collection with key ${collectionId} not found`)
    }

    // Get variables from the collection
    const variables = await figma.teamLibrary.getVariablesInLibraryCollectionAsync(collection.key)
    
    // DEBUG: Log the first variable to see its structure
    if (variables.length > 0) {
      console.log('First Variable Structure:', JSON.stringify(variables[0], null, 2))
      console.log('valuesByMode structure:', (variables[0] as any).valuesByMode)
    }

    // Return as an array with a single LibraryVariables object
    return [{
      collectionName: collection.name || '',
      collectionId: collection.key,
      libraryName: collection.libraryName || '',
      variables: variables.map((variable: any): LibraryVariable => {
        try {
          // Ensure we have a valid resolvedType with a default fallback
          let resolvedType = (variable.resolvedType || 'COLOR') as VariableResolvedDataType
          if (!['COLOR', 'FLOAT', 'STRING', 'BOOLEAN'].includes(resolvedType)) {
            resolvedType = 'COLOR' // Default to COLOR if invalid type
          }

          // Safely create the LibraryVariable object with defensive checks
          return {
            id: variable.key || '',
            name: variable.name || '',
            key: variable.key || '',
            resolvedType,
            valuesByMode: {}, // Empty object as placeholder since API variables don't have valuesByMode
            defaultValue: null,
            description: '',
            hiddenFromPublishing: false,
            remote: false,
            variableCollectionId: '',
            scopes: []
          }
        } catch (error) {
          console.error('Error processing variable:', error, variable)
          // Return a safe default object if processing fails
          return {
            id: '',
            name: 'Error processing variable',
            key: '',
            resolvedType: 'COLOR',
            valuesByMode: {},
            defaultValue: null,
            description: '',
            hiddenFromPublishing: false,
            remote: false,
            variableCollectionId: '',
            scopes: []
          }
        }
      })
    }]
  } catch (error) {
    console.error('Error fetching library variables:', error)
    throw error
  }
}

// Function to fetch variable values using the REST API
async function fetchVariableValuesFromRestAPI(): Promise<ResolvedVariableValue[]> {
  if (!figmaApiKey || !selectedCollection) {
    console.error('Cannot fetch variable values: Missing API key or selected collection')
    return []
  }

  try {
    console.log('Fetching variable values from REST API...')

    // Extract file key from the collection key (first part before the colon)
    const fileKey = selectedCollection.key.split(':')[0]
    if (!fileKey) {
      console.error('Could not extract file key from collection key:', selectedCollection.key)
      return []
    }

    const resolvedValues: ResolvedVariableValue[] = []

    // For each variable in the collection, fetch its values
    if (selectedCollection.variables && selectedCollection.variables.length > 0) {
      // Only process a reasonable number of variables to avoid rate limiting
      const variablesToFetch = selectedCollection.variables.slice(0, 50)

      for (const variable of variablesToFetch) {
        try {
          // Construct the REST API URL
          const url = `https://api.figma.com/v1/variables/${fileKey}/${selectedCollection.id}/${variable.id}/values`
          console.log('Fetching variable values from:', url)

          // Make the REST API request
          const response = await fetch(url, {
            method: 'GET',
            headers: {
              'X-Figma-Token': figmaApiKey
            }
          })

          if (!response.ok) {
            console.error(`API request failed for ${variable.name}:`, response.status, response.statusText)
            continue
          }

          const data = await response.json()
          console.log('Variable values response:', data)

          // Extract the value from the first mode (we could make this more sophisticated later)
          const modeValues = data.values
          if (modeValues && Object.keys(modeValues).length > 0) {
            const firstModeId = Object.keys(modeValues)[0]
            const value = modeValues[firstModeId]

            resolvedValues.push({
              variableId: variable.id,
              name: variable.name,
              value,
              resolvedType: variable.type as VariableResolvedDataType
            })
          }
        } catch (error) {
          console.error(`Error fetching values for variable ${variable.name}:`, error)
        }

        // Add a small delay between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }

    return resolvedValues
  } catch (error) {
    console.error('Error fetching variable values:', error)
    return []
  }
}

export default async function () {
  console.log('=== Plugin Initialization ===')
  
  // Load saved API key if exists
  try {
    figmaApiKey = await figma.clientStorage.getAsync('figmaApiKey') as string;
    console.log('Loaded saved API key:', figmaApiKey ? '****' + figmaApiKey.substring(figmaApiKey.length - 4) : 'None');
  } catch (error) {
    console.error('Error loading API key:', error);
    figmaApiKey = null;
  }
  
  // Show UI first, before any event emission
  showUI({
    height: 400,
    width: 320
  })
  
  // Add a small delay to ensure UI is ready
  await new Promise(resolve => setTimeout(resolve, 100))
  
  // Handle API key updates
  on<SetFigmaApiKeyHandler>('SET_FIGMA_API_KEY', async function (apiKey: string) {
    console.log('Saving API key:', '****' + apiKey.substring(apiKey.length - 4));
    try {
      // Save API key to client storage
      await figma.clientStorage.setAsync('figmaApiKey', apiKey);
      figmaApiKey = apiKey;
      emit<ApiKeyUpdatedHandler>('API_KEY_UPDATED', true);
    } catch (error) {
      console.error('Error saving API key:', error);
      emit<ApiKeyUpdatedHandler>('API_KEY_UPDATED', false);
    }
  });
  
  // Handle variable values fetch request from UI
  on<FetchVariableValuesHandler>('FETCH_VARIABLE_VALUES', async function () {
    try {
      if (!figmaApiKey) {
        figma.notify('Please enter your Figma API key first', { error: true })
        emit<VariableValuesLoadedHandler>('VARIABLE_VALUES_LOADED', [])
        return
      }

      if (!selectedCollection) {
        figma.notify('Please select a collection first', { error: true })
        emit<VariableValuesLoadedHandler>('VARIABLE_VALUES_LOADED', [])
        return
      }

      figma.notify('Fetching variable values...')
      const resolvedValues = await fetchVariableValuesFromRestAPI()
      
      if (resolvedValues.length > 0) {
        figma.notify(`Loaded values for ${resolvedValues.length} variables`)
        emit<VariableValuesLoadedHandler>('VARIABLE_VALUES_LOADED', resolvedValues)
      } else {
        figma.notify('No variable values found', { error: true })
        emit<VariableValuesLoadedHandler>('VARIABLE_VALUES_LOADED', [])
      }
    } catch (error) {
      console.error('Error in fetch variable values handler:', error)
      figma.notify('Error fetching variable values', { error: true })
      emit<VariableValuesLoadedHandler>('VARIABLE_VALUES_LOADED', [])
    }
  });
  
  // Get all available library variable collections
  try {
    console.log('Fetching Library Collections...')
    const libraryCollections = await figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync()
    
    // Format the collections data for the UI
    collectionsData = libraryCollections.map(collection => ({
      id: collection.key.split('/')[0], // Get the base collection ID without the mode
      name: collection.name,
      key: collection.key,
      libraryName: collection.libraryName
    }))
    
    console.log('Available Libraries:', collectionsData.reduce((acc, curr) => {
      const libraryName = curr.libraryName || 'Unknown Library'
      if (!acc[libraryName]) {
        acc[libraryName] = []
      }
      acc[libraryName].push({
        name: curr.name,
        id: curr.id
      })
      return acc
    }, {} as Record<string, Array<{ name: string; id: string }>>))
    
    // Handle collection selection
    on<CollectionSelectedHandler>('COLLECTION_SELECTED', async function (collectionId: string) {
      console.log('\n=== Collection Selected ===')
      try {
        const collection = collectionsData.find(c => c.id === collectionId)
        if (!collection) {
          console.error('Collection not found:', collectionId)
          return
        }

        console.log('Collection:', {
          name: collection.name,
          library: collection.libraryName
        })
        
        const variables = await figma.teamLibrary.getVariablesInLibraryCollectionAsync(collection.key)
        if (!Array.isArray(variables)) {
          console.error('Variables is not an array:', variables)
          return
        }

        // DEBUG: Log the first variable to see its structure
        if (variables.length > 0) {
          console.log('First Variable Structure:', JSON.stringify(variables[0], null, 2))
          console.log('Full variable raw data:', variables[0])
          // Check for other possible property names that might contain the mode values
          console.log('Property names:', Object.keys(variables[0]))
        }

        selectedCollection = {
          ...collection,
          variables: variables.map(variable => {
            if (!variable) {
              console.log('Skipping null/undefined variable')
              return null
            }
            try {
              // Library variables from the API don't have valuesByMode property
              // Just provide a placeholder empty object
              return {
                id: variable.key || '',
                name: variable.name || '',
                key: variable.key || '',
                type: variable.resolvedType || 'COLOR',
                valuesByMode: {} // Empty object as placeholder since API variables don't have valuesByMode
              }
            } catch (err) {
              console.error('Error processing variable:', err, variable)
              return null
            }
          }).filter(v => v !== null)
        }
        
        console.log('Variables Loaded:', {
          count: selectedCollection.variables?.length || 0,
          types: selectedCollection.variables ? 
            Array.from(new Set(selectedCollection.variables.map(v => v.type))) : 
            []
        })
      } catch (error) {
        console.error('Error loading collection:', error)
        figma.notify('Error loading variables for collection', { error: true })
      }
    })

    // Handle frame selection changes
    figma.on('selectionchange', () => {
      const selection = figma.currentPage.selection
      const newHasSingleFrameSelected = selection.length === 1 && selection[0].type === 'FRAME'
      
      if (newHasSingleFrameSelected !== hasSingleFrameSelected) {
        hasSingleFrameSelected = newHasSingleFrameSelected
        emit<FrameSelectionHandler>('FRAME_SELECTION_CHANGED', hasSingleFrameSelected)
      }
    })

    // Handle frame analysis
    on<AnalyzeFrameHandler>('ANALYZE_FRAME', async function (exceptions: string) {
      if (!hasSingleFrameSelected || !selectedCollection) {
        return
      }

      const frame = figma.currentPage.selection[0] as FrameNode
      console.log('\n=== Starting Analysis ===')
      console.log('Frame:', {
        name: frame.name,
        type: frame.type,
        exceptions: exceptions || 'none'
      })
      
      // Analyze the frame and all its children recursively
      const results = analyzeNodeAndChildren(frame, exceptions)
      
      console.log('Analysis Complete:', {
        nodesAnalyzed: results.length,
        propertiesFound: results.reduce((acc, curr) => acc + curr.properties.length, 0)
      })
      
      // Send results to UI
      emit<AnalysisResultsHandler>('ANALYSIS_RESULTS', makeSerializable(results))
      
      // After sending analysis results, fetch library variables
      const libraryVariables = await fetchLibraryVariables(selectedCollection.id)
      emit<LibraryVariablesHandler>('LIBRARY_VARIABLES_LOADED', libraryVariables)
    })
    
    // Handle close
    once<CloseHandler>('CLOSE', function () {
      figma.closePlugin()
    })
    
    // Pass the collections data to the UI
    emit<InitializeHandler>('INITIALIZE', collectionsData)
    console.log('Plugin initialization complete')
  } catch (error) {
    console.error('Error during plugin initialization:', error)
    figma.notify('Error initializing plugin', { error: true })
    emit<InitializeHandler>('INITIALIZE', [])
  }
}

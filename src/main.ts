console.log('Main script loading...')
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
  SelectLayerHandler,
  ApplyRecommendationHandler,
  VariableBindableNode,
  VariableBindableNodeField,
  // New Reviewer types
  RunReviewerHandler,
  FrameImageData,
  FrameImageExportedHandler,
  OpenExternalUrlHandler,
  // Design review types
  DesignReviewHandler,
  DesignReviewResult,
  DesignReviewResultHandler
} from './types'

// Store collections data in the main context
let collectionsData: Array<VariableCollectionData> = []
let selectedCollection: SelectedCollectionData | null = null

// Track frame selection state
let hasSingleFrameSelected = false

// Helper function to check if a value matches any variable in the collection
function findMatchingVariable(value: any, type: string): { id: string; name: string; value: any } | undefined {
  if (!selectedCollection?.variables) return undefined
  
  // For FLOAT type variables, filter out variables with "text" in their name
  const eligibleVariables = selectedCollection.variables.filter(variable => {
    if (variable.type !== type) return false;
    
    // For FLOAT variables, exclude any with "text" in the name
    if (type === 'FLOAT' && variable.name.toLowerCase().includes('text')) {
      return false;
    }
    
    return true;
  });
  
  console.log(`Found ${eligibleVariables.length} eligible ${type} variables to match against`);
  
  const matchingVariable = eligibleVariables.find(variable => {
    // First check if the variable has a resolved value
    if ('resolvedValue' in variable) {
      console.log(`Checking variable ${variable.name} resolved value:`, variable.resolvedValue);
      return variable.resolvedValue === value;
    }
    
    // Handle different value types as fallback
    if (type === 'COLOR') {
      return JSON.stringify(variable.valuesByMode) === JSON.stringify(value)
    }
    
    return variable.valuesByMode === value
  })

  if (!matchingVariable) return undefined

  return {
    id: matchingVariable.id,
    name: matchingVariable.name,
    value: 'resolvedValue' in matchingVariable ? matchingVariable.resolvedValue : matchingVariable.valuesByMode
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
      if (fill.type === 'SOLID' && fill.visible !== false) {
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
        } else {
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

        // Determine if this fill is valid to analyze
        const hasStyle = !!styleId;
        const hasVariable = !!variableId;
        const isDetached = !hasStyle && !hasVariable;
        
        // Create a property whether it's linked or detached
        if (hasStyle || hasVariable || isDetached) {
          // For detached fills, there's no collection match, so force isMismatched = true
          const matchResult = isDetached ? 
            { isMatch: false } : 
            isCollectionMatch(collectionId, styleName, selectedCollection?.id, exceptions);
            
          console.log('Match result for fill:', { 
            matchResult, 
            styleName, 
            collectionId,
            isStyle: hasStyle,
            isVariable: hasVariable,
            isDetached
          });
          
          const property: NodeProperty = {
            name: `Fill ${index + 1}`,
            value: fill.type === 'SOLID' ? fill.color : fill,
            formattedValue: formatValue(`Fill ${index + 1}`, fill.type === 'SOLID' ? fill.color : fill),
            variableId,
            collectionId,
            styleName,
            expectedCollections,
            isMismatched: !matchResult.isMatch,
            nodeId: node.id, // Add nodeId to each property
            ...(matchResult.matchedByException && { matchedByException: matchResult.matchedByException })
          }
          
          // Only suggest variables if it's actually mismatched (not matched by exception)
          if (property.isMismatched && !matchResult.matchedByException) {
            // Use context-aware color matching instead of simple matching
            const suggestedVar = findContextAwareColorMatch(node, property.name, property.value)
            if (suggestedVar) {
              property.suggestedVariable = makeSerializable(suggestedVar)
            }
          }
          
          properties.push(property)
        }
      }
    })
  }
  
  // Check strokes
  if ('strokes' in node && Array.isArray(node.strokes)) {
    node.strokes.forEach((stroke, index) => {
      if (stroke.type === 'SOLID') {
        // Get the style ID if the stroke is from a style
        const styleId = (node as any).strokeStyleId
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
            }
          } catch (error) {
            console.error('Error getting style:', error)
          }
        } else {
          // If not a style, check for variable binding
          const boundVariable = (stroke as any).boundVariables?.color
          variableId = boundVariable?.id
          collectionId = boundVariable?.collectionId

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
        }

        const matchResult = isCollectionMatch(collectionId, styleName, selectedCollection?.id, exceptions)
        
        const property: NodeProperty = {
          name: `Stroke ${index + 1}`,
          value: makeSerializable(stroke.color),
          formattedValue: formatValue(`Stroke ${index + 1}`, stroke.color),
          variableId,
          collectionId,
          styleName,
          expectedCollections,
          isMismatched: !matchResult.isMatch,
          nodeId: node.id, // Add nodeId to each property
          ...(matchResult.matchedByException && { matchedByException: matchResult.matchedByException })
        }
        
        if (property.isMismatched) {
          // Use context-aware color matching for strokes
          const suggestedVar = findContextAwareColorMatch(node, property.name, stroke.color)
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
        nodeId: node.id, // Add nodeId to each property
        ...(matchResult.matchedByException && { matchedByException: matchResult.matchedByException })
      }
      
      console.log('Created property:', property)
      
      if (property.isMismatched) {
        const suggestedVar = findMatchingVariable(property.value, 'FLOAT')
        if (suggestedVar) {
          property.suggestedVariable = makeSerializable(suggestedVar)
          console.log('Found suggested variable:', suggestedVar)
        } else {
          // If no exact match found, look for the closest number variable
          const closestVar = findClosestNumberVariable(property.value)
          if (closestVar && closestVar.difference < 2) { // Only suggest if difference is small
            property.suggestedVariable = makeSerializable({
              id: closestVar.id,
              name: closestVar.name,
              value: closestVar.value
            })
            console.log('Found closest variable:', closestVar)
          }
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
        nodeId: node.id, // Add nodeId to each property
        ...(matchResult.matchedByException && { matchedByException: matchResult.matchedByException })
      }
      
      if (property.isMismatched) {
        const suggestedVar = findMatchingVariable(value, 'FLOAT')
        if (suggestedVar) {
          property.suggestedVariable = makeSerializable(suggestedVar)
        } else {
          // If no exact match found, look for the closest number variable
          const closestVar = findClosestNumberVariable(value)
          if (closestVar && closestVar.difference < 2) { // Only suggest if difference is small
            property.suggestedVariable = makeSerializable({
              id: closestVar.id,
              name: closestVar.name,
              value: closestVar.value
            })
          }
        }
      }
      
      properties.push(property)
    }
  })
  
  // Check itemSpacing (gap) in auto-layout frames
  if (node.type === 'FRAME' && (node as FrameNode).layoutMode !== 'NONE') {
    const frameNode = node as FrameNode;
    
    // Only analyze itemSpacing if it's not using SPACE_BETWEEN alignment
    // as that causes automatically calculated spacing
    if (frameNode.itemSpacing !== undefined && 
        frameNode.itemSpacing !== 0 && 
        frameNode.primaryAxisAlignItems !== 'SPACE_BETWEEN') {
      
      console.log(`\nChecking item spacing (gap):`, frameNode.itemSpacing);
      
      // Check for variable binding
      const boundVariable = (node as any).boundVariables?.itemSpacing;
      const variableId = boundVariable?.id;
      let collectionId = boundVariable?.collectionId;
      
      // If we have a variableId but no collectionId, try to get it from the variable
      if (variableId && !collectionId) {
        try {
          const variable = figma.variables.getVariableById(variableId);
          if (variable) {
            collectionId = variable.variableCollectionId;
            console.log('Retrieved collection ID from variable:', collectionId);
          }
        } catch (error) {
          console.error('Error getting variable:', error);
        }
      }
      
      const matchResult = isCollectionMatch(collectionId, undefined, selectedCollection?.id, exceptions);
      console.log('Match result for gap:', matchResult);
      
      const property: NodeProperty = {
        name: 'Gap',
        value: frameNode.itemSpacing,
        formattedValue: formatValue('Gap', frameNode.itemSpacing),
        variableId,
        collectionId,
        expectedCollections,
        isMismatched: !matchResult.isMatch,
        nodeId: node.id, // Add nodeId to each property
        ...(matchResult.matchedByException && { matchedByException: matchResult.matchedByException })
      };
      
      if (property.isMismatched) {
        const suggestedVar = findMatchingVariable(property.value, 'FLOAT');
        if (suggestedVar) {
          property.suggestedVariable = makeSerializable(suggestedVar);
        } else {
          // If no exact match found, look for the closest number variable
          const closestVar = findClosestNumberVariable(property.value);
          if (closestVar && closestVar.difference < 2) { // Only suggest if difference is small
            property.suggestedVariable = makeSerializable({
              id: closestVar.id,
              name: closestVar.name,
              value: closestVar.value
            });
          }
        }
      }
      
      properties.push(property);
    }
  }
  
  // Check text styles for TEXT nodes
  if (node.type === 'TEXT') {
    const textNode = node as TextNode;
    console.log('\nChecking text style for:', textNode.characters.substring(0, 30) + (textNode.characters.length > 30 ? '...' : ''));
    
    // Get the style ID if the text is using a text style
    const textStyleId = textNode.textStyleId;
    let collectionId = undefined;
    let styleName = undefined;
    
    // Check if it has a text style
    if (textStyleId && textStyleId !== '') {
      try {
        const style = figma.getStyleById(textStyleId as string);
        if (style) {
          collectionId = style.key;
          styleName = style.name;
          console.log('Found text style:', { name: styleName, key: collectionId });
        }
      } catch (error) {
        console.error('Error getting text style:', error);
      }
    }
    
    // If there's no text style, it's a detached text style
    const isDetached = !textStyleId || textStyleId === '';
    
    // Create a property for the text style
    // For detached text styles, force isMismatched = true
    const matchResult = isDetached ? 
      { isMatch: false } : 
      isCollectionMatch(collectionId, styleName, selectedCollection?.id, exceptions);
    
    console.log('Match result for text style:', { 
      matchResult, 
      styleName,
      collectionId,
      isDetached
    });
    
    // Create a property for the text style
    const property: NodeProperty = {
      name: 'Typography',
      value: styleName || 'Detached text style',
      formattedValue: styleName || 'Detached text style',
      styleName,
      collectionId,
      expectedCollections,
      isMismatched: !matchResult.isMatch,
      nodeId: node.id, // Add nodeId to each property
      ...(matchResult.matchedByException && { matchedByException: matchResult.matchedByException })
    };
    
    properties.push(property);
  }
  
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

    // Debug the first variable to see its structure
    if (variables.length > 0) {
      const firstVar = variables[0] as any;
      console.log('First variable structure:', {
        name: firstVar.name,
        type: firstVar.resolvedType,
        keys: Object.keys(firstVar),
        hasValuesByMode: 'valuesByMode' in firstVar,
        valuesByModeType: firstVar.valuesByMode ? typeof firstVar.valuesByMode : 'undefined',
        valuesByModeKeys: firstVar.valuesByMode ? Object.keys(firstVar.valuesByMode) : []
      })
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
    const selectedCollection = collections.find(c => c.key === collectionId)
    if (!selectedCollection) {
      throw new Error(`Collection with key ${collectionId} not found`)
    }
    
    // Find all collections from the same library (to handle dependencies)
    const relatedCollections = collections.filter(c => 
      c.libraryName === selectedCollection.libraryName
    )
    
    console.log(`Found ${relatedCollections.length} related collections from library ${selectedCollection.libraryName}:`, 
      relatedCollections.map(c => c.name))
    
    // Get variables from ALL related collections to handle dependencies
    const allVariables = await resolveLibraryVariableValues([], collectionId)
    
    // Group variables by collection
    const variablesByCollection = new Map<string, any[]>()
    
    allVariables.forEach(variable => {
      if (!variablesByCollection.has(variable.collectionKey)) {
        variablesByCollection.set(variable.collectionKey, [])
      }
      variablesByCollection.get(variable.collectionKey)?.push(variable)
    })
    
    // Create a LibraryVariables object for each collection
    const result: LibraryVariables[] = []
    
    // Use Array.from() to convert Map entries to an array for iteration
    Array.from(variablesByCollection.entries()).forEach(([collectionKey, collectionVars]) => {
      const collection = relatedCollections.find(c => c.key === collectionKey)
      if (collection) {
        result.push({
          collectionName: collection.name || '',
          collectionId: collection.key,
          libraryName: collection.libraryName || '',
          variables: collectionVars
        })
      }
    })
    
    console.log(`Returning ${result.length} collections with a total of ${allVariables.length} variables`)
    return result
  } catch (error) {
    console.error('Error fetching library variables:', error)
    throw error
  }
}

// Function to resolve library variable values
async function resolveLibraryVariableValues(variables: any[], collectionId: string): Promise<any[]> {
  try {
    console.log('Resolving values for library variables...')
    
    // Get all available library collections
    const allCollections = await figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync()
    
    // Find the current collection
    const selectedCollection = allCollections.find(c => c.key === collectionId)
    if (!selectedCollection) {
      console.warn(`Collection with ID ${collectionId} not found`)
      return variables
    }
    
    // Find all collections from the same library (to handle dependencies)
    const relatedCollections = allCollections.filter(c => 
      c.libraryName === selectedCollection.libraryName
    )
    
    console.log(`Found ${relatedCollections.length} collections from the same library:`, 
      relatedCollections.map(c => c.name))
    
    // Process each collection to get its variables and modes
    const collectionsWithModes = await Promise.all(relatedCollections.map(async (collectionDescriptor) => {
      try {
        console.log(`Processing collection: ${collectionDescriptor.name}`)
        
        // Get variables from this collection
        const libraryVariables = await figma.teamLibrary.getVariablesInLibraryCollectionAsync(collectionDescriptor.key)
        
        if (libraryVariables.length === 0) {
          console.log(`No variables found in collection: ${collectionDescriptor.name}`)
        return {
            collection: collectionDescriptor,
            figmaCollection: null,
            modes: [],
            variables: []
          }
        }
        
        // Import one variable to get access to the collection
        console.log(`Importing a variable to get collection data...`)
        let importedVariable
        try {
          importedVariable = await figma.variables.importVariableByKeyAsync(libraryVariables[0].key)
          console.log(`Successfully imported variable: ${importedVariable.name}`)
        } catch (importError) {
          console.error(`Error importing variable: ${libraryVariables[0].name}`, importError)
        return {
            collection: collectionDescriptor,
            figmaCollection: null,
            modes: [],
            variables: libraryVariables
          }
        }
        
        // Get the collection using the imported variable's collection ID
        const collectionId = importedVariable.variableCollectionId
        console.log(`Getting collection by ID: ${collectionId}`)
        
        const figmaCollection = await figma.variables.getVariableCollectionByIdAsync(collectionId)
        if (!figmaCollection) {
          console.log(`Could not get collection with ID: ${collectionId}`)
          return {
            collection: collectionDescriptor,
            figmaCollection: null,
            modes: [],
            variables: libraryVariables
          }
        }
        
        // Log the modes information
        console.log(`Collection ${collectionDescriptor.name} has ${figmaCollection.modes.length} modes:`, 
          figmaCollection.modes.map(m => m.name))
        
        return {
          collection: collectionDescriptor,
          figmaCollection,
          modes: figmaCollection.modes,
          variables: libraryVariables
        }
      } catch (error) {
        console.error(`Error processing collection ${collectionDescriptor.name}:`, error)
        return {
          collection: collectionDescriptor,
          figmaCollection: null,
          modes: [],
          variables: []
        }
      }
    }))
    
    // Process all variables with their collection modes
    let allProcessedVariables: any[] = []
    
    for (const collectionData of collectionsWithModes) {
      if (!collectionData.figmaCollection || collectionData.variables.length === 0) {
        continue
      }
      
      const processedVariables = await Promise.all(collectionData.variables.map(async (variable) => {
        try {
          // Create a valuesByMode object for the UI
          const valuesByMode: Record<string, any> = {}
          const modeNames: Record<string, string> = {}
          
          // Get all mode information
          collectionData.modes.forEach(mode => {
            modeNames[mode.modeId] = mode.name
            
            // We can't directly access values for each mode in library variables
            // We'll try to use a placeholder based on the variable's resolved type
            valuesByMode[mode.modeId] = variable.resolvedType === 'FLOAT' ? 0 : 
                                         variable.resolvedType === 'COLOR' ? {r: 0, g: 0, b: 0} :
                                         variable.resolvedType === 'BOOLEAN' ? false : ''
          })
          
          // Import this variable to get its real values
          let importedVariable: Variable | null = null
          try {
            importedVariable = await figma.variables.importVariableByKeyAsync(variable.key)
            
            // Now we can get the actual values for each mode
            if (importedVariable) {
              collectionData.modes.forEach(mode => {
                if (importedVariable && importedVariable.valuesByMode[mode.modeId] !== undefined) {
                  const modeValue = importedVariable.valuesByMode[mode.modeId];
                  
                  // Check if this is an alias
                  if (modeValue && typeof modeValue === 'object' && 'type' in modeValue && modeValue.type === 'VARIABLE_ALIAS') {
                    console.log(`Found alias in variable ${importedVariable.name} for mode ${mode.name}`);
                    
                    try {
                      // Create a temporary node to use as consumer
                      const tempNode = figma.createRectangle();
                      
                      // We need to get the collection for importedVariable
                      if (importedVariable) {
                        const importedCollection = figma.variables.getVariableCollectionById(importedVariable.variableCollectionId);
                        if (importedCollection) {
                          tempNode.setExplicitVariableModeForCollection(
                            importedCollection,
                            mode.modeId
                          );
                        }
                      }
                      
                      // Get the referenced variable
                      const refVar = figma.variables.getVariableById(modeValue.id);
                      if (refVar) {
                        // Get the collection of the referenced variable
                        const refCollection = figma.variables.getVariableCollectionById(refVar.variableCollectionId);
                        if (refCollection) {
                          // Try to find a mode with the same name
                          const matchingMode = refCollection.modes.find(m => m.name === mode.name);
                          if (matchingMode) {
                            // Set the matching mode for the referenced collection
                            tempNode.setExplicitVariableModeForCollection(
                              refCollection,
                              matchingMode.modeId
                            );
                          } else {
                            // If no matching mode is found, use the default mode
                            tempNode.setExplicitVariableModeForCollection(
                              refCollection,
                              refCollection.defaultModeId || refCollection.modes[0].modeId
                            );
                          }
                        }
                      }
                      
                      // Now bind the variable to the node based on its type
                      switch (importedVariable.resolvedType) {
                        case 'COLOR':
                          tempNode.fills = [{
                            type: 'SOLID',
                            color: { r: 0, g: 0, b: 0 },
                            visible: true,
                            opacity: 1
                          }];
                          tempNode.fillStyleId = '';
                          try {
                            // Bind the color variable using setBoundVariableForPaint
                            const newFill = figma.variables.setBoundVariableForPaint(
                              tempNode.fills[0] as SolidPaint,
                              'color',
                              refVar
                            );
                            
                            // Apply the new fill
                            tempNode.fills = [newFill];
                            
                            // Get resolved value if needed
                            if (tempNode.fills && tempNode.fills.length > 0 && tempNode.fills[0].type === 'SOLID') {
                              valuesByMode[mode.modeId] = (tempNode.fills[0] as SolidPaint).color;
                            }
                          } catch (err) {
                            console.log('Error binding color variable', err);
                          }
                          break;
                          
                        case 'FLOAT':
                          try {
                            tempNode.setBoundVariable('width', importedVariable);
                          } catch (err) {
                            console.log('Error binding number variable', err);
                          }
                          break;
                          
                        case 'BOOLEAN':
                          try {
                            tempNode.setBoundVariable('visible', importedVariable);
                          } catch (err) {
                            console.log('Error binding boolean variable', err);
                          }
                          break;
                          
                        case 'STRING':
                          // For string, we can't easily bind, so we'll use the alias directly
                          valuesByMode[mode.modeId] = modeValue;
                          break;
                      }
                      
                      // Now resolve the alias
                      if (importedVariable.resolvedType !== 'STRING') {
                        try {
                          const resolvedValue = importedVariable.resolveForConsumer(tempNode);
                          if (resolvedValue) {
                            console.log(`Resolved alias to:`, resolvedValue.value);
                            valuesByMode[mode.modeId] = resolvedValue.value;
                          } else {
                            console.log(`Could not resolve alias, using raw value`);
                            valuesByMode[mode.modeId] = modeValue;
                          }
                        } catch (err) {
                          console.log('Error resolving alias', err);
                          valuesByMode[mode.modeId] = modeValue;
                        }
                      }
                      
                      // Clean up
                      tempNode.remove();
                    } catch (err) {
                      console.log('Error handling alias', err);
                      valuesByMode[mode.modeId] = modeValue;
                    }
                  } else {
                    // Not an alias, use directly
                    valuesByMode[mode.modeId] = modeValue;
                  }
                }
              })
            }
          } catch (importError) {
            console.log(`Could not import variable: ${variable.name}`, importError)
          }
          
          // Use the default mode's value as the resolved value
          const defaultModeId = collectionData.figmaCollection.defaultModeId
          const defaultValue = valuesByMode[defaultModeId] || 
                              Object.values(valuesByMode)[0] || 
                              getDefaultValueForType(variable.resolvedType)
          
          // Format display values for each mode
          const formattedValuesByMode: Record<string, { raw: any, display: string }> = {};
          
          // Process each mode value to create formatted display values
          Object.entries(valuesByMode).forEach(([modeId, modeValue]) => {
            formattedValuesByMode[modeId] = {
              raw: modeValue,
              display: formatValueForDisplay(modeValue, variable.resolvedType)
            };
          });
          
          return {
            ...variable,
            collectionName: collectionData.collection.name,
            collectionKey: collectionData.collection.key,
            modeNames,
            valuesByMode, // Keep the raw values
            formattedValuesByMode, // Add formatted values for display
            resolvedValue: defaultValue, // Default/current value
            displayValue: formatValueForDisplay(defaultValue, variable.resolvedType) // Formatted default value
          }
        } catch (err) {
          console.error(`Error processing variable ${variable.name}:`, err)
          return {
            ...variable,
            collectionName: collectionData.collection.name,
            collectionKey: collectionData.collection.key,
            resolvedValue: getDefaultValueForType(variable.resolvedType),
            displayValue: 'Error: ' + (err as Error).message
          }
        }
      }))
      
      allProcessedVariables = allProcessedVariables.concat(processedVariables)
    }
    
    console.log(`Processed ${allProcessedVariables.length} variables with their mode values`)
    return allProcessedVariables
  } catch (error) {
    console.error('Error resolving library variable values:', error)
    return variables
  }
}

// Helper function to get a default value based on variable type
function getDefaultValueForType(type: string): any {
  switch(type) {
    case 'COLOR':
      return { r: 0, g: 0, b: 0 }
    case 'FLOAT':
      return 0
    case 'STRING':
      return ''
    case 'BOOLEAN':
      return false
    default:
      return null
  }
}

// Helper function to format values for display
function formatValueForDisplay(value: any, type: string): string {
  if (value === undefined || value === null) return 'No value'
  
  if (type === 'COLOR' && typeof value === 'object' && 'r' in value && 'g' in value && 'b' in value) {
    // Format color values
    const r = Math.round(value.r * 255)
    const g = Math.round(value.g * 255)
    const b = Math.round(value.b * 255)
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
  } else if (type === 'FLOAT') {
    // Format number values
    return typeof value === 'number' ? value.toString() : String(value)
  }
  
  // Default to string representation
  return typeof value === 'object' ? JSON.stringify(value) : String(value)
}

// Helper function to hash a string into a number (for generating placeholder colors)
function hashCode(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash |= 0 // Convert to 32bit integer
  }
  return Math.abs(hash)
}

// Helper function to find the closest number variable to a given value
function findClosestNumberVariable(value: number): { id: string; name: string; value: any; difference: number } | undefined {
  if (!selectedCollection?.variables) return undefined
  
  console.log(`Looking for closest match to: ${value}`);
  
  // Filter to only number variables that don't have "text" in their name
  const numberVariables = selectedCollection.variables.filter(variable => {
    // Check if it's a FLOAT type - either in type or resolvedType property
    const isFloat = variable.type === 'FLOAT' || 
           ('resolvedType' in variable && variable.resolvedType === 'FLOAT');
           
    // Check if the variable name doesn't include "text"
    const isNotTextVariable = !variable.name.toLowerCase().includes('text');
    
    // Only include variables that are both number type and don't have "text" in the name
    const isMatch = isFloat && isNotTextVariable;
    
    // If we have a matching variable, log it for debugging
    if (isMatch) {
      const variableValue = 'resolvedValue' in variable ? 
        variable.resolvedValue : 
        (typeof variable.valuesByMode === 'number' ? variable.valuesByMode : null);
        
      console.log(`Number variable: ${variable.name}, value: ${variableValue}`);
    }
    
    return isMatch;
  });
  
  if (numberVariables.length === 0) {
    console.log('No non-text number variables found');
    return undefined;
  }
  
  console.log(`Found ${numberVariables.length} non-text number variables`);
  
  // Calculate the difference for each variable and sort by absolute difference
  const sortedVariables = numberVariables.map(variable => {
    // Get the variable's value (prefer resolved value if available)
    const variableValue = 'resolvedValue' in variable ? 
      variable.resolvedValue : 
      (typeof variable.valuesByMode === 'number' ? variable.valuesByMode : 0);
      
    // Calculate the difference
    const difference = Math.abs(Number(variableValue) - value);
    
    console.log(`Variable: ${variable.name}, value: ${variableValue}, difference: ${difference}`);
    
    return {
      variable,
      difference,
      value: variableValue
    };
  }).sort((a, b) => a.difference - b.difference);
  
  // If we found a match, return the closest one
  if (sortedVariables.length > 0) {
    const closest = sortedVariables[0].variable;
    const closestValue = sortedVariables[0].value;
    
    console.log(`Closest match: ${closest.name} with value ${closestValue} (difference: ${sortedVariables[0].difference})`);
    
    return {
      id: closest.id,
      name: closest.name,
      value: closestValue,
      difference: sortedVariables[0].difference
    };
  }
  
  return undefined;
}

/**
 * Resolves a variable alias to its actual value
 * This handles the complex cross-collection resolution of variable aliases
 */
function resolveAlias(aliasValue: VariableAlias, expectedType: VariableResolvedDataType): any {
  try {
    // Get the referenced variable
    const referencedVariable = figma.variables.getVariableById(aliasValue.id);
    if (!referencedVariable) {
      console.log('Referenced variable not found', aliasValue);
      return null;
    }

    // Get the collection for this variable
    const collection = figma.variables.getVariableCollectionById(referencedVariable.variableCollectionId);
    if (!collection) {
      console.log('Collection not found for referenced variable', referencedVariable);
      return null;
    }

    // Create a temporary node to resolve the value
    const tempNode = figma.createRectangle();
    
    // Find a mode that matches the alias's name (matching by mode name is more reliable)
    // First, find the source collection
    const sourceVar = figma.variables.getVariableById(aliasValue.id);
    if (sourceVar) {
      const sourceCollection = figma.variables.getVariableCollectionById(sourceVar.variableCollectionId);
      if (sourceCollection) {
        // Set explicit mode for this collection
        // We need to use setExplicitVariableModeForCollection to properly handle cross-collection aliases
        tempNode.setExplicitVariableModeForCollection(
          sourceCollection,
          sourceCollection.defaultModeId // Use default mode as fallback
        );
      }
    }
    
    // Apply the variable to the temp node based on the expected type
    let resolvedValue: any = null;
    
    switch (expectedType) {
      case 'COLOR':
        tempNode.fills = [{
          type: 'SOLID',
          color: { r: 0, g: 0, b: 0 },
          visible: true,
          opacity: 1
        }];
        try {
          // Create a new paint with the variable bound to it
          const newFill = figma.variables.setBoundVariableForPaint(
            tempNode.fills[0] as SolidPaint, 
            'color', 
            referencedVariable
          );
          
          // Apply the new fill
          tempNode.fills = [newFill];
          
          // Get the resolved value
          if (tempNode.fills && tempNode.fills.length > 0 && tempNode.fills[0].type === 'SOLID') {
            resolvedValue = (tempNode.fills[0] as SolidPaint).color;
          }
        } catch (err) {
          console.error('Error binding color variable', err);
        }
        break;
      
      case 'FLOAT':
        try {
          tempNode.resize(100, 100);
          tempNode.setBoundVariable('width', referencedVariable);
          resolvedValue = tempNode.width;
        } catch (err) {
          console.error('Error binding float variable', err);
        }
        break;
      
      case 'BOOLEAN':
        try {
          tempNode.visible = true;
          tempNode.setBoundVariable('visible', referencedVariable);
          resolvedValue = tempNode.visible;
        } catch (err) {
          console.error('Error binding boolean variable', err);
        }
        break;
      
      case 'STRING':
        // For strings we need to use a text node
        try {
          tempNode.remove();
          const textNode = figma.createText();
          textNode.characters = "Placeholder";
          textNode.setBoundVariable('characters', referencedVariable);
          resolvedValue = textNode.characters;
          textNode.remove();
        } catch (err) {
          console.error('Error binding string variable', err);
          resolvedValue = null;
        }
        break;
        
      default:
        console.log('Unsupported variable type', expectedType);
        break;
    }
    
    // If we didn't create a text node, clean up the temp node
    if (expectedType !== 'STRING') {
      tempNode.remove();
    }
    
    return resolvedValue;
  } catch (err) {
    console.error('Error resolving alias', err);
    return null;
  }
}

// Interface for resolved variable values to be sent to UI
interface ResolvedVariableValues {
  name: string;
  id: string;
  key: string;
  codeName: string;
  description: string;
  resolvedType: VariableResolvedDataType;
  valuesByMode: {
    [modeId: string]: {
      value: VariableValue | null;
      resolvedValue: any;
      modeName: string;
    }
  };
  collection: {
    id: string;
    name: string;
    modes: {
      modeId: string;
      name: string;
    }[];
  } | null;
  remote: boolean;
}

// Helper function to resolve variable values for the consumer (UI)
export function resolveForConsumer(variable: Variable, importedVariable: Variable | null, modeId: string): ResolvedVariableValues {
  // Create result object
  const result: ResolvedVariableValues = {
    codeName: variable.name.replace(/\s+/g, ''), // Convert name to code-friendly format as a fallback
    description: variable.description || '',
    name: variable.name,
    id: variable.id,
    key: variable.key,
    resolvedType: variable.resolvedType,
    valuesByMode: {},
    collection: null,
    remote: false
  };

  let variableCollection: VariableCollection | null = null;
  
  // Get the collection info
  const collection = figma.variables.getVariableCollectionById(variable.variableCollectionId);
  if (collection) {
    variableCollection = collection;
    result.collection = {
      id: collection.id,
      name: collection.name,
      modes: collection.modes.map(mode => ({
        modeId: mode.modeId,
        name: mode.name
      }))
    };
  }

  if (!variableCollection) {
    console.log('Collection not found for variable', variable);
    return result;
  }

  // Determine if variable is coming from library
  if (importedVariable) {
    result.remote = true;
  }

  // Loop through all modes in the collection and get values
  for (const mode of variableCollection.modes) {
    try {
      // Get the value for this mode
      let modeValue = variable.valuesByMode[mode.modeId];

      // Check if this value is an alias
      if (modeValue && typeof modeValue === 'object' && 'type' in modeValue && modeValue.type === 'VARIABLE_ALIAS') {
        // Create a temporary node to resolve the alias with proper mode contexts
        const tempNode = figma.createRectangle();
        
        // Get the collection in this scope, we already have it from getVariableCollectionById above
        if (collection) {
          tempNode.setExplicitVariableModeForCollection(
            collection, // Use the collection we got above
            mode.modeId
          );
        }
        
        // Get the referenced variable
        const refVar = figma.variables.getVariableById(modeValue.id);
        if (refVar) {
          // Get the collection of the referenced variable
          const refCollection = figma.variables.getVariableCollectionById(refVar.variableCollectionId);
          if (refCollection) {
            // Try to find a mode with the same name
            const matchingMode = refCollection.modes.find(m => m.name === mode.name);
            if (matchingMode) {
              // Set the matching mode for the referenced collection
              tempNode.setExplicitVariableModeForCollection(
                refCollection,
                matchingMode.modeId
              );
            } else {
              // If no matching mode is found, use the default mode
              tempNode.setExplicitVariableModeForCollection(
                refCollection,
                refCollection.defaultModeId || refCollection.modes[0].modeId
              );
            }
            
            // Bind the variable based on its type
            let resolvedValue = null;
            switch (variable.resolvedType) {
              case 'COLOR':
                tempNode.fills = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 }, opacity: 1 }];
                tempNode.fillStyleId = '';
                try {
                  // Bind the color variable using setBoundVariableForPaint
                  const newFill = figma.variables.setBoundVariableForPaint(
                    tempNode.fills[0] as SolidPaint,
                    'color',
                    refVar
                  );
                  
                  // Apply the new fill
                  tempNode.fills = [newFill];
                  
                  // Get resolved value if needed
                  if (tempNode.fills && tempNode.fills.length > 0 && tempNode.fills[0].type === 'SOLID') {
                    resolvedValue = (tempNode.fills[0] as SolidPaint).color;
                  }
                } catch (err) {
                  console.log('Error binding color variable', err);
                }
                break;
              
              case 'FLOAT':
                try {
                  tempNode.resize(100, 100);
                  tempNode.setBoundVariable('width', refVar);
                  resolvedValue = tempNode.width;
                } catch (err) {
                  console.log('Error binding float variable', err);
                }
                break;
              
              case 'BOOLEAN':
                try {
                  tempNode.visible = true;
                  tempNode.setBoundVariable('visible', refVar);
                  resolvedValue = tempNode.visible;
                } catch (err) {
                  console.log('Error binding boolean variable', err);
                }
                break;
              
              case 'STRING':
                // For strings we can't easily resolve
                resolvedValue = null;
                break;
            }
            
            // Store the result
            result.valuesByMode[mode.modeId] = {
              value: modeValue,
              resolvedValue: resolvedValue,
              modeName: mode.name
            };
            
            // Clean up
            tempNode.remove();
          }
        } else {
          // If we couldn't resolve the alias
          result.valuesByMode[mode.modeId] = {
            value: modeValue,
            resolvedValue: null,
            modeName: mode.name
          };
        }
      } else {
        // For non-alias values, just use the value directly
        result.valuesByMode[mode.modeId] = {
          value: modeValue,
          resolvedValue: modeValue,
          modeName: mode.name
        };
      }
    } catch (err) {
      console.log('Error resolving mode value', err);
      // Add empty entry for this mode
      result.valuesByMode[mode.modeId] = {
        value: null,
        resolvedValue: null,
        modeName: mode.name
      };
    }
  }

  return result;
}

// Helper function to safely resolve color variables without using array paths
function safeResolveColorVariable(variable: Variable): { r: number, g: number, b: number } | null {
  try {
    // Create a temporary node for binding
    const tempNode = figma.createRectangle();
    
    try {
      // Try to get the variable value by setting it as a style
      const collection = figma.variables.getVariableCollectionById(variable.variableCollectionId);
      if (!collection) return null;
      
      // Get the default mode or first mode
      const modeId = collection.defaultModeId || collection.modes[0]?.modeId;
      if (!modeId) return null;
      
      // Set the node's mode
      tempNode.setPluginData('mode', modeId);
      
      // For color variables, we get their value indirectly
      const modeValue = variable.valuesByMode[modeId];
      
      // If it's a direct color value and not an alias
      if (typeof modeValue === 'object' && !('type' in modeValue)) {
        // It's likely a direct RGB value
        return modeValue as { r: number, g: number, b: number };
      }
      
      // If it's not a direct value, try to get a reasonable fallback
      return { r: 0, g: 0, b: 0 };
    } finally {
      // Clean up the temp node
      tempNode.remove();
    }
  } catch (error) {
    console.error('Error safely resolving color variable:', error);
    return null;
  }
}

// Helper function to calculate color distance between two RGB colors
function calculateColorDistance(color1: { r: number; g: number; b: number }, color2: { r: number; g: number; b: number }): number {
  // Convert to 0-255 range for more intuitive calculations
  const r1 = Math.round(color1.r * 255)
  const g1 = Math.round(color1.g * 255)
  const b1 = Math.round(color1.b * 255)
  
  const r2 = Math.round(color2.r * 255)
  const g2 = Math.round(color2.g * 255)
  const b2 = Math.round(color2.b * 255)
  
  // Simple Euclidean distance in RGB space
  // More sophisticated color distance formulas exist (like CIEDE2000) but this is sufficient for basic matching
  return Math.sqrt(
    Math.pow(r2 - r1, 2) +
    Math.pow(g2 - g1, 2) +
    Math.pow(b2 - b1, 2)
  )
}

// Function to determine the contextual type of node for color matching
function getNodeColorContext(node: SceneNode, propertyName: string): string {
  // Default context
  let context = 'background'
  
  // Check node type and property name to determine context
  if (node.type === 'TEXT') {
    context = 'text'
  } else if (propertyName.includes('Stroke') || propertyName.includes('Border')) {
    context = 'border'
  } else if (node.type === 'VECTOR' || node.type === 'BOOLEAN_OPERATION' || 
            node.name.toLowerCase().includes('icon') || 
            (node.parent && node.parent.name.toLowerCase().includes('icon'))) {
    context = 'icon'
  } else if (node.type === 'INSTANCE' && node.name.toLowerCase().includes('button')) {
    context = 'button'
  } else if (node.parent && node.parent.name.toLowerCase().includes('button')) {
    context = 'button'
  }
  
  console.log(`Determined color context: ${context} for node type ${node.type} named "${node.name}"`);
  return context
}

// Function to find the best semantic color variable match based on context and color value
function findContextAwareColorMatch(
  node: SceneNode, 
  propertyName: string, 
  colorValue: { r: number; g: number; b: number }
): { id: string; name: string; value: any; colorDistance: number } | undefined {
  // Don't proceed if we don't have variables in the collection
  if (!selectedCollection?.variables) return undefined
  
  console.log(`Finding context-aware color match for ${rgbToHex(colorValue)} in ${propertyName}`);
  
  // Get only the semantic token variables from the selected collection
  // First check if we have a semantic tokens collection
  const isSemanticCollection = selectedCollection.name?.toLowerCase().includes('semantic')
  
  // If not a semantic collection, we don't want to suggest variables
  if (!isSemanticCollection) {
    console.log('Not a semantic token collection, skipping suggestions');
    return undefined
  }
  
  // Get only color variables
  const colorVariables = selectedCollection.variables.filter(v => v.type === 'COLOR')
  
  if (colorVariables.length === 0) {
    console.log('No color variables found in the collection');
    return undefined
  }
  
  // Determine the color context based on node type and property
  const colorContext = getNodeColorContext(node, propertyName)
  
  // For logging purposes, count variables by context
  const contextCounts: Record<string, number> = {}
  colorVariables.forEach(v => {
    const name = v.name.toLowerCase()
    if (name.includes('text')) contextCounts['text'] = (contextCounts['text'] || 0) + 1
    if (name.includes('border')) contextCounts['border'] = (contextCounts['border'] || 0) + 1
    if (name.includes('icon')) contextCounts['icon'] = (contextCounts['icon'] || 0) + 1
    if (name.includes('background') || name.includes('surface')) {
      contextCounts['background'] = (contextCounts['background'] || 0) + 1
    }
    if (name.includes('button')) contextCounts['button'] = (contextCounts['button'] || 0) + 1
  })
  
  console.log('Color variables by context:', contextCounts);
  
  // Filter variables by context
  let contextFilteredVariables = colorVariables.filter(variable => {
    const name = variable.name.toLowerCase()
    
    // Match by context
    switch (colorContext) {
      case 'text':
        return name.includes('text')
      case 'border':
        return name.includes('border') || name.includes('stroke') || name.includes('outline')
      case 'icon':
        return name.includes('icon') || name.includes('symbol')
      case 'button':
        return name.includes('button') || name.includes('interactive') || name.includes('action')
      case 'background':
        return name.includes('background') || name.includes('surface') || name.includes('fill')
      default:
        return true
    }
  })
  
  // If no variables match the context, try a more general approach
  if (contextFilteredVariables.length === 0) {
    console.log(`No variables found for context: ${colorContext}, using all color variables`);
    contextFilteredVariables = colorVariables
  } else {
    console.log(`Found ${contextFilteredVariables.length} variables matching context: ${colorContext}`);
  }
  
  // Calculate color distance for each variable
  const variablesWithDistance = contextFilteredVariables.map(variable => {
    // Get the variable's value
    const variableColor = 'resolvedValue' in variable 
      ? variable.resolvedValue 
      : (variable.valuesByMode ? Object.values(variable.valuesByMode)[0] : null)
    
    if (!variableColor || typeof variableColor !== 'object' || !('r' in variableColor)) {
      return { variable, distance: Number.MAX_VALUE }
    }
    
    const distance = calculateColorDistance(colorValue, variableColor)
    return { variable, distance }
  })
  
  // Sort by color distance (closest first)
  variablesWithDistance.sort((a, b) => a.distance - b.distance)
  
  // Get the best match - only consider variables with a reasonable color distance
  // 75 is a reasonable threshold - it allows for some variation but prevents totally different colors
  const bestMatch = variablesWithDistance.length > 0 && variablesWithDistance[0].distance < 75 
    ? variablesWithDistance[0] 
    : undefined
  
  if (!bestMatch) {
    console.log('No suitable color matches found');
    return undefined
  }
  
  console.log('Best color match:', {
    name: bestMatch.variable.name,
    colorDistance: bestMatch.distance,
    matchValue: 'resolvedValue' in bestMatch.variable ? bestMatch.variable.resolvedValue : bestMatch.variable.valuesByMode
  })
  
  return {
    id: bestMatch.variable.id,
    name: bestMatch.variable.name,
    value: 'resolvedValue' in bestMatch.variable ? bestMatch.variable.resolvedValue : bestMatch.variable.valuesByMode,
    colorDistance: bestMatch.distance
  }
}

export default async function () {
  console.log('=== Plugin Initialization ===')
  
  // Show UI first with increased size
  showUI({
    height: 480,
    width: 360,
    title: 'Design Review Buddy'
  })
  
  // Add a longer delay to ensure UI is ready
  console.log('Waiting for UI to be ready...')
  await new Promise(resolve => setTimeout(resolve, 500))
  console.log('UI should be ready now')
  
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
        
        // Get variables from all related collections in this library
        const allCollections = await figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync()
        
        // Find all collections from the same library
        const relatedCollections = allCollections.filter(c => 
          c.libraryName === collection.libraryName
        )
        
        console.log(`Found ${relatedCollections.length} related collections from library ${collection.libraryName}`)
        
        // Get all variables for all collections and resolve their values
        const resolvedVariables = await resolveLibraryVariableValues([], collection.key)
        
        console.log(`Loaded ${resolvedVariables.length} total variables from all related collections`)
        
        // Store the variables in the selected collection
        selectedCollection = {
          ...collection,
          variables: resolvedVariables.map(variable => {
            return {
              id: variable.key || '',
              name: variable.name || '',
              key: variable.key || '',
              type: variable.resolvedType || 'COLOR',
              valuesByMode: {}, // Empty placeholder
              resolvedValue: variable.resolvedValue, // Add the resolved value
              collectionName: variable.collectionName, // Store collection info
              collectionKey: variable.collectionKey
            }
          })
        }
        
        console.log('Variables Loaded:', {
          count: selectedCollection.variables?.length || 0,
          types: selectedCollection.variables ? 
            Array.from(new Set(selectedCollection.variables.map(v => v.type))) : 
            []
        })
        
        // Log some sample number variables for debugging
        if (selectedCollection.variables && selectedCollection.variables.length > 0) {
          const numberVars = selectedCollection.variables.filter(v => v.type === 'FLOAT')
          if (numberVars.length > 0) {
            console.log('Sample number variables:')
            numberVars.slice(0, 5).forEach(v => {
              console.log(`- ${v.name}: ${(v as any).resolvedValue}`)
            })
          }
        }
        
        // Fetch and send library variables to UI
        try {
          const libraryVariables = await fetchLibraryVariables(collection.id)
          emit<LibraryVariablesHandler>('LIBRARY_VARIABLES_LOADED', libraryVariables)
          console.log('Library variables sent to UI:', libraryVariables.length)
        } catch (libraryError) {
          console.error('Error fetching library variables:', libraryError)
        }
        
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
    
    // Handle select layer
    on<SelectLayerHandler>('SELECT_LAYER', function (nodeId: string) {
      const node = figma.getNodeById(nodeId)
      if (node && node.type !== 'PAGE' && node.type !== 'DOCUMENT') {
        figma.currentPage.selection = [node as SceneNode]
        figma.viewport.scrollAndZoomIntoView([node as SceneNode])
      }
    })
    
    // Handle apply recommendation
    on<ApplyRecommendationHandler>('APPLY_RECOMMENDATION', async function (nodeId: string, property: NodeProperty, suggestedVariable: { id: string; name: string; value: any }) {
      try {
        console.log('Applying recommendation:', { nodeId, property, suggestedVariable })
        
        // Find the node to apply the recommendation to
        const node = figma.getNodeById(nodeId)
        if (!node) {
          console.error('Node not found:', nodeId)
          return
        }
        
        // Get the variable to apply
        const variableId = suggestedVariable.id
        let variable
        try {
          variable = figma.variables.getVariableById(variableId)
          if (!variable) {
            console.error('Variable not found:', variableId)
            return
          }
        } catch (error) {
          console.error('Error getting variable:', error)
          return
        }
        
        console.log('Found variable:', variable.name)
        
        // Apply the variable based on property name
        try {
          const bindableNode = node as VariableBindableNode
          const propertyName = property.name
          
          if (propertyName.includes('Corner Radius')) {
            const cornerType = propertyName.replace('Corner Radius ', '')
            let field: VariableBindableNodeField | null = null
            
            if (cornerType === 'Top Left') field = 'topLeftRadius'
            else if (cornerType === 'Top Right') field = 'topRightRadius'
            else if (cornerType === 'Bottom Left') field = 'bottomLeftRadius'
            else if (cornerType === 'Bottom Right') field = 'bottomRightRadius'
            
            if (field) {
              console.log(`Binding ${field} to variable:`, variable.name)
              bindableNode.setBoundVariable(field, variable)
            }
          } else if (propertyName.includes('Padding')) {
            const paddingType = propertyName.replace('Padding ', '')
            let field: VariableBindableNodeField | null = null
            
            if (paddingType === 'Left') field = 'paddingLeft'
            else if (paddingType === 'Right') field = 'paddingRight'
            else if (paddingType === 'Top') field = 'paddingTop'
            else if (paddingType === 'Bottom') field = 'paddingBottom'
            
            if (field) {
              console.log(`Binding ${field} to variable:`, variable.name)
              bindableNode.setBoundVariable(field, variable)
            }
          } else if (propertyName === 'Gap') {
            console.log('Binding gap to variable:', variable.name)
            
            // For auto layout, gap is either itemSpacing or counterAxisSpacing
            if (node.type === 'FRAME' && 'layoutMode' in node) {
              const frame = node as FrameNode
              const field: VariableBindableNodeField = 
                frame.layoutMode === 'HORIZONTAL' ? 'itemSpacing' : 'counterAxisSpacing'
              bindableNode.setBoundVariable(field, variable)
            }
          } else if (propertyName.includes('Fill')) {
            console.log('Binding fill to variable:', variable.name)
            
            // For fill properties, need to handle solid fills
            if ('fills' in node) {
              const index = parseInt(propertyName.split(' ')[1]) - 1
              if (index >= 0 && Array.isArray(node.fills) && index < node.fills.length) {
                (node as any).setBoundVariable(
                  ['fills', index, 'color'], 
                  variable
                )
              }
            }
          } else if (propertyName.includes('Stroke')) {
            console.log('Binding stroke to variable:', variable.name)
            
            // For stroke properties, need to handle solid fills
            if ('strokes' in node) {
              const index = parseInt(propertyName.split(' ')[1]) - 1
              if (index >= 0 && Array.isArray(node.strokes) && index < node.strokes.length) {
                (node as any).setBoundVariable(
                  ['strokes', index, 'color'], 
                  variable
                )
              }
            }
          }
          
          console.log('Recommendation applied successfully')
        } catch (error) {
          console.error('Error binding variable:', error)
        }
      } catch (error) {
        console.error('Error in apply recommendation handler:', error)
      }
    })
    
    // Handle open external URL
    on<OpenExternalUrlHandler>('OPEN_EXTERNAL_URL', (url) => {
      console.log('Opening external URL:', url)
      figma.openExternal(url)
    })
    
    // Handle process design review
    on<DesignReviewHandler>('PROCESS_DESIGN_REVIEW', async (frameImageData: FrameImageData, apiKey: string) => {
      try {
        console.log('Processing design review for frame:', frameImageData.frameName)
        
        if (!apiKey) {
          console.error('No API key provided for design review')
          const errorResult: DesignReviewResult = {
            feedback: "Please enter a valid Shopify OpenAI Proxy API key in the settings.",
            categories: {
              contrast: 0,
              hierarchy: 0,
              alignment: 0,
              proximity: 0
            },
            errors: "Missing API key"
          }
          emit<DesignReviewResultHandler>('DESIGN_REVIEW_RESULT', errorResult)
          return
        }
        
        // Extract base64 image from data URL by removing the prefix
        const base64Image = frameImageData.imageUrl.replace(/^data:image\/png;base64,/, '')
        
        // Create the request payload for OpenAI API
        const payload = {
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: `You are a helpful UI/UX design reviewer. Analyze the provided UI design screenshot and give feedback based on visual design principles. Rate the design on a scale of 1-10 for: contrast, visual hierarchy, alignment, and proximity. Provide concise, actionable feedback in 3-5 sentences.`
            },
            {
              role: "user",
              content: [
                {
                  type: "image_url",
                  image_url: {
                    url: frameImageData.imageUrl
                  }
                },
                {
                  type: "text",
                  text: "Please review this design and provide a brief critique focusing on visual design principles."
                }
              ]
            }
          ],
          max_tokens: 300
        }
        
        try {
          // Call the Shopify OpenAI Proxy
          const response = await fetch("https://proxy.shopify.ai/vendors/openai/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify(payload)
          })
          
          if (!response.ok) {
            console.error(`API error: ${response.status} ${response.statusText}`)
            const errorText = await response.text()
            console.error('Error response:', errorText)
            throw new Error(`API request failed with status ${response.status}: ${errorText}`)
          }
          
          const responseData = await response.json()
          
          // Parse the text content to extract ratings and feedback
          const aiResponse = responseData.choices[0].message.content
          console.log('AI response received:', aiResponse)
          
          // Extract ratings using regex (assuming the AI follows instructions to rate 1-10)
          const contrastMatch = aiResponse.match(/contrast:?\s*(\d+)/i)
          const hierarchyMatch = aiResponse.match(/hierarchy:?\s*(\d+)/i) || aiResponse.match(/visual hierarchy:?\s*(\d+)/i)
          const alignmentMatch = aiResponse.match(/alignment:?\s*(\d+)/i)
          const proximityMatch = aiResponse.match(/proximity:?\s*(\d+)/i)
          
          // Default to 5 if we can't extract a score
          const reviewResult: DesignReviewResult = {
            feedback: aiResponse,
            categories: {
              contrast: contrastMatch ? parseInt(contrastMatch[1]) : 5,
              hierarchy: hierarchyMatch ? parseInt(hierarchyMatch[1]) : 5,
              alignment: alignmentMatch ? parseInt(alignmentMatch[1]) : 5,
              proximity: proximityMatch ? parseInt(proximityMatch[1]) : 5
            }
          }
          
          emit<DesignReviewResultHandler>('DESIGN_REVIEW_RESULT', reviewResult)
          
        } catch (error) {
          console.error('Error calling OpenAI API:', error)
          const errorResult: DesignReviewResult = {
            feedback: "There was an error processing the design review. Please check your API key and try again.",
            categories: {
              contrast: 0,
              hierarchy: 0,
              alignment: 0,
              proximity: 0
            },
            errors: error instanceof Error ? error.message : String(error)
          }
          emit<DesignReviewResultHandler>('DESIGN_REVIEW_RESULT', errorResult)
        }
        
      } catch (error) {
        console.error('Error in design review handler:', error)
        const errorResult: DesignReviewResult = {
          feedback: "An unexpected error occurred while processing the design.",
          categories: {
            contrast: 0,
            hierarchy: 0,
            alignment: 0,
            proximity: 0
          },
          errors: error instanceof Error ? error.message : String(error)
        }
        emit<DesignReviewResultHandler>('DESIGN_REVIEW_RESULT', errorResult)
      }
    })
    
    // Handle run reviewer
    on<RunReviewerHandler>('RUN_REVIEWER', async function () {
      try {
        console.log('Running reviewer...')
        
        if (!hasSingleFrameSelected) {
          console.log('No single frame selected')
          return
        }
        
        try {
          const frame = figma.currentPage.selection[0] as FrameNode
          console.log('Exporting frame:', frame.name)
          
          // Export the frame as PNG
          const bytes = await frame.exportAsync({
            format: 'PNG',
            constraint: { type: 'SCALE', value: 2 }
          })
          
          // Convert to base64 for sending to UI
          const base64Image = figma.base64Encode(bytes)
          const imageUrl = `data:image/png;base64,${base64Image}`
          
          // Send the image data to the UI
          const frameImageData: FrameImageData = {
            imageUrl,
            width: frame.width,
            height: frame.height,
            frameName: frame.name,
            frameId: frame.id
          }
          
          console.log('Frame exported successfully')
          emit<FrameImageExportedHandler>('FRAME_IMAGE_EXPORTED', frameImageData)
        } catch (error) {
          console.error('Error exporting frame:', error)
          figma.notify('Error exporting frame', { error: true })
        }
      } catch (error) {
        console.error('Error in run reviewer handler:', error)
      }
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

import {
  Container,
  Text,
  VerticalSpace,
  render,
  Divider,
  Dropdown,
  LoadingIndicator,
  Button,
  Layer,
  Stack,
  Textbox,
  Toggle,
  IconFrame16,
  IconComponent16,
  IconInstance16,
  IconAdjust16,
  IconBoolean16,
  IconText16,
  IconStrokeWeight24,
  IconVariableColorSmall24,
  IconAutoLayoutSpacingHorizontal24,
  IconRadiusTopRight24,
  IconAutoLayoutPaddingSides24
} from '@create-figma-plugin/ui'
import { emit, on } from '@create-figma-plugin/utilities'
import { h, JSX, Fragment } from 'preact'
import { useCallback, useEffect, useState } from 'preact/hooks'

import { 
  InitializeHandler, 
  VariableCollectionData, 
  CollectionSelectedHandler,
  FrameSelectionHandler,
  AnalyzeFrameHandler,
  AnalysisResultsHandler,
  AnalysisResult,
  NodeProperty,
  SelectLayerHandler,
  LibraryVariables,
  LibraryVariablesHandler,
  SetFigmaApiKeyHandler,
  ApiKeyUpdatedHandler
} from './types'

function Plugin() {
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [collections, setCollections] = useState<Array<VariableCollectionData>>([])
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null)
  const [hasSingleFrameSelected, setHasSingleFrameSelected] = useState<boolean>(false)
  const [analysisResults, setAnalysisResults] = useState<Array<AnalysisResult>>([])
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false)
  const [exceptions, setExceptions] = useState<string>('Retail UI/*')
  const [showOnlyMismatches, setShowOnlyMismatches] = useState<boolean>(false)
  const [showFilteredView, setShowFilteredView] = useState<boolean>(false)
  const [excludeLockedLayers, setExcludeLockedLayers] = useState<boolean>(true)
  const [excludeHiddenLayers, setExcludeHiddenLayers] = useState<boolean>(true)
  const [hideAllResults, setHideAllResults] = useState<boolean>(false)
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null)
  const [libraryVariables, setLibraryVariables] = useState<Array<LibraryVariables>>([])
  const [figmaApiKey, setFigmaApiKey] = useState<string>('')
  const [apiKeyStatus, setApiKeyStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle')

  // Handle receiving variable collections from the main context
  useEffect(function () {
    return on<InitializeHandler>(
      'INITIALIZE',
      function (variableCollections: Array<VariableCollectionData>) {
        setCollections(variableCollections)
        setIsLoading(false)
        
        // Find the semantic tokens collection first
        const semanticTokensCollection = variableCollections.find(
          collection => 
            collection.name === 'semantic tokens' && 
            collection.id === '7bd47c3f865078fa6e58b1d808e0258f9947598c' &&
            collection.libraryName === 'POS Design System'
        )

        // Find the primitive tokens collection as fallback
        const primitiveTokensCollection = variableCollections.find(
          collection => 
            collection.name === 'primitive tokens' && 
            collection.id === 'b9f78a8d985f270dccda0c461a36c7f77093ed19' &&
            collection.libraryName === 'POS Design System'
        )
        
        // Set the selected collection ID, prioritizing semantic tokens, then primitive tokens, then first available
        const defaultCollectionId = semanticTokensCollection?.id || primitiveTokensCollection?.id || 
          (variableCollections.length > 0 ? variableCollections[0].id : null)
        
        setSelectedCollectionId(defaultCollectionId)
        
        // Notify main context of selection
        if (defaultCollectionId) {
          emit<CollectionSelectedHandler>('COLLECTION_SELECTED', defaultCollectionId)
        }
      }
    )
  }, [])

  // Handle frame selection changes
  useEffect(function () {
    return on<FrameSelectionHandler>(
      'FRAME_SELECTION_CHANGED',
      function (hasFrameSelected: boolean) {
        setHasSingleFrameSelected(hasFrameSelected)
      }
    )
  }, [])

  // Handle analysis results
  useEffect(function () {
    return on<AnalysisResultsHandler>(
      'ANALYSIS_RESULTS',
      function (results: Array<AnalysisResult>) {
        setAnalysisResults(results)
        setIsAnalyzing(false)
      }
    )
  }, [])

  // Handle library variables
  useEffect(function () {
    return on<LibraryVariablesHandler>(
      'LIBRARY_VARIABLES_LOADED',
      function (variables: Array<LibraryVariables>) {
        console.log('Received library variables:', variables)
        setLibraryVariables(variables)
      }
    )
  }, [])

  // Handle API key changes
  const handleApiKeyChange = useCallback(function (event: Event) {
    const input = event.target as HTMLInputElement
    setFigmaApiKey(input.value)
  }, [])

  // Handle API key submission
  const handleApiKeySubmit = useCallback(function () {
    if (!figmaApiKey.trim()) return
    
    setApiKeyStatus('saving')
    emit<SetFigmaApiKeyHandler>('SET_FIGMA_API_KEY', figmaApiKey.trim())
  }, [figmaApiKey])

  // Listen for API key update response
  useEffect(function () {
    return on<ApiKeyUpdatedHandler>(
      'API_KEY_UPDATED',
      function (success: boolean) {
        setApiKeyStatus(success ? 'success' : 'error')
        // Reset status after 3 seconds
        setTimeout(() => setApiKeyStatus('idle'), 3000)
      }
    )
  }, [])

  const handleCollectionChange = useCallback(function (event: Event) {
    const select = event.target as HTMLSelectElement
    const newCollectionId = select.value
    setSelectedCollectionId(newCollectionId)
    emit<CollectionSelectedHandler>('COLLECTION_SELECTED', newCollectionId)
  }, [])

  const handleExceptionsChange = useCallback(function (event: Event) {
    const input = event.target as HTMLInputElement
    setExceptions(input.value)
  }, [])

  const handleAnalyzeClick = useCallback(function () {
    setIsAnalyzing(true)
    emit<AnalyzeFrameHandler>('ANALYZE_FRAME', exceptions)
  }, [exceptions])

  const handleToggleChange = useCallback(function (event: Event) {
    const toggle = event.target as HTMLInputElement
    setShowOnlyMismatches(toggle.checked)
  }, [])

  const handleFilteredViewToggle = useCallback(function (event: Event) {
    const toggle = event.target as HTMLInputElement
    setShowFilteredView(toggle.checked)
  }, [])

  const handleHideAllResultsToggle = useCallback(function (event: Event) {
    const toggle = event.target as HTMLInputElement
    setHideAllResults(toggle.checked)
  }, [])

  const handleExcludeLockedLayersToggle = useCallback(function (event: Event) {
    const toggle = event.target as HTMLInputElement
    setExcludeLockedLayers(toggle.checked)
  }, [])

  const handleExcludeHiddenLayersToggle = useCallback(function (event: Event) {
    const toggle = event.target as HTMLInputElement
    setExcludeHiddenLayers(toggle.checked)
  }, [])

  const handleLayerToggle = useCallback(function (nodeId: string, event: Event) {
    const newValue = (event.target as HTMLInputElement).checked
    
    // If checked, select this layer
    // If unchecked, clear selection
    const newSelectedId = newValue ? nodeId : null
    setSelectedLayerId(newSelectedId)
    
    // Emit event to select layer in Figma
    if (newSelectedId) {
      emit<SelectLayerHandler>('SELECT_LAYER', newSelectedId)
    }
  }, [])

  const getNodeIcon = (nodeType: string) => {
    switch (nodeType) {
      case 'FRAME':
        return <IconFrame16 />
      case 'COMPONENT':
        return <IconComponent16 />
      case 'INSTANCE':
        return <IconInstance16 />
      default:
        return <IconFrame16 />
    }
  }

  // Helper function to group properties by type
  const getGroupedIssues = useCallback((results: Array<AnalysisResult>) => {
    const issues: Array<{
      nodeId: string,
      nodeName: string,
      nodeType: string,
      issueType: string,
      properties: Array<NodeProperty>,
      isLocked: boolean,
      isVisible: boolean
    }> = []

    results
      // Apply filters here as well to ensure consistency
      .filter(result => {
        if (excludeLockedLayers && result.isLocked) return false
        if (excludeHiddenLayers && !result.isVisible) return false
        return true
      })
      .forEach(result => {
        // Group properties by type
        const groupedProps: { [key: string]: Array<NodeProperty> } = {}
        
        result.properties.forEach(prop => {
          // Skip if we're hiding matches and this is a match
          if (hideAllResults && !prop.isMismatched) return
          // Skip if we're only showing mismatches and this is a match
          if (showOnlyMismatches && !prop.isMismatched) return

          let issueType = ''
          // Check for actual padding properties
          if (prop.name.match(/^Padding (Top|Bottom|Left|Right)$/)) {
            issueType = 'padding'
          }
          // Check for actual corner radius properties
          else if (prop.name.match(/^Corner Radius (Top Left|Top Right|Bottom Right|Bottom Left)$/)) {
            issueType = 'radius'
          }
          else if (prop.name.startsWith('Fill')) {
            issueType = `fill-${prop.name}`
          }
          else if (prop.name.startsWith('Stroke')) {
            issueType = `stroke-${prop.name}`
          }
          else if (prop.name === 'Gap') {
            issueType = 'gap'
          }
          else if (prop.name === 'Text Style') {
            issueType = 'text-style'
          }

          if (issueType) {
            if (!groupedProps[issueType]) {
              groupedProps[issueType] = []
            }
            groupedProps[issueType].push(prop)
          }
        })

        // Create issue entries
        Object.entries(groupedProps).forEach(([issueType, properties]) => {
          issues.push({
            nodeId: result.nodeId,
            nodeName: result.nodeName,
            nodeType: result.nodeType,
            issueType,
            properties,
            isLocked: result.isLocked,
            isVisible: result.isVisible
          })
        })
      })

    return issues
  }, [excludeLockedLayers, excludeHiddenLayers, hideAllResults, showOnlyMismatches])

  // Helper function to calculate statistics
  const calculateStats = (results: Array<AnalysisResult>) => {
    let totalProperties = 0
    let linkedProperties = 0
    let unlinkedProperties = 0
    let filteredMismatches = 0

    // Track unique mismatches by node and property type
    const uniqueMismatches = new Set<string>()

    // First filter the results based on visibility and lock state
    const filteredResults = results.filter(result => {
      if (excludeLockedLayers && result.isLocked) return false
      if (excludeHiddenLayers && !result.isVisible) return false
      return true
    })

    filteredResults.forEach(result => {
      result.properties.forEach((property: NodeProperty) => {
        totalProperties++
        if (!property.isMismatched) {
          linkedProperties++
        } else {
          unlinkedProperties++
          
          // Group padding and radius issues by node, count others individually
          let mismatchType = ''
          // Check for actual padding properties
          if (property.name.match(/^Padding (Top|Bottom|Left|Right)$/)) {
            mismatchType = `${result.nodeId}:padding`
          }
          // Check for actual corner radius properties
          else if (property.name.match(/^Corner Radius (Top Left|Top Right|Bottom Right|Bottom Left)$/)) {
            mismatchType = `${result.nodeId}:corner-radius`
          }
          else if (property.name.startsWith('Fill')) {
            mismatchType = `${result.nodeId}:fill`
          }
          else if (property.name.startsWith('Stroke')) {
            mismatchType = `${result.nodeId}:stroke`
          }
          else if (property.name.startsWith('Gap')) {
            mismatchType = `${result.nodeId}:gap`
          }
          else if (property.name.startsWith('Text Style')) {
            mismatchType = `${result.nodeId}:text-style`
          }
          
          if (mismatchType) {
            uniqueMismatches.add(mismatchType)
          }
        }
      })
    })

    filteredMismatches = uniqueMismatches.size

    return { totalProperties, linkedProperties, unlinkedProperties, filteredMismatches }
  }

  // Helper function to format property value
  const formatPropertyValue = (value: any): string => {
    if (typeof value === 'object') {
      return JSON.stringify(value)
    }
    return String(value)
  }

  // Keep truncateId only for the dropdown options
  const truncateIdForDropdown = (id: string) => {
    if (!id || id.length <= 8) return id
    return `${id.substring(0, 4)}...${id.substring(id.length - 4)}`
  }

  const stats = analysisResults.length > 0 ? calculateStats(analysisResults) : null

  // Filter results based on toggle states
  const filteredResults = analysisResults
    .filter(result => {
      // If hide all results is enabled, return no results
      if (hideAllResults) return false
      
      // Apply locked layer filter
      if (excludeLockedLayers && result.isLocked) {
        return false
      }
      
      // Apply hidden layer filter
      if (excludeHiddenLayers && !result.isVisible) {
        return false
      }
      
      // Apply mismatches filter
      if (showOnlyMismatches) {
        return result.properties.some(prop => prop.isMismatched)
      }
      
      return true
    })
    .map(result => ({
      ...result,
      properties: showOnlyMismatches 
        ? result.properties.filter(prop => prop.isMismatched)
        : result.properties
    }))
    .filter(result => result.properties.length > 0)

  // Helper function to get selected layer details
  const getSelectedLayerDetails = useCallback(() => {
    if (!selectedLayerId) return null
    return filteredResults.find(result => result.nodeId === selectedLayerId)
  }, [selectedLayerId, filteredResults])

  // Helper function to count mismatches per node
  const countNodeMismatches = (result: AnalysisResult) => {
    const uniqueMismatches = new Set<string>()
    
    result.properties.forEach(property => {
      if (property.isMismatched) {
        let mismatchType = ''
        if (property.name.startsWith('Corner Radius')) {
          mismatchType = 'corner-radius'
        } else if (property.name.startsWith('Padding')) {
          mismatchType = 'padding'
        } else if (property.name.startsWith('Fill')) {
          mismatchType = 'fill'
        } else if (property.name.startsWith('Stroke')) {
          mismatchType = 'stroke'
        } else if (property.name.startsWith('Gap')) {
          mismatchType = 'gap'
        } else if (property.name.startsWith('Text Style')) {
          mismatchType = 'text-style'
        }
        
        if (mismatchType) {
          uniqueMismatches.add(mismatchType)
        }
      }
    })
    
    return uniqueMismatches.size
  }

  // Helper function to format variable value
  const formatVariableValue = (value: any): string => {
    if (!value) return 'No value'
    if (typeof value === 'object') {
      // Handle mode values
      const values = Object.values(value)
      if (!values.length) return 'No value'
      const modeValues = values[0]
      if (!modeValues || typeof modeValues !== 'object') return 'No value'
      
      if ('r' in modeValues) {
        // It's a color
        const color = modeValues as { r: number; g: number; b: number }
        const r = Math.round(color.r * 255)
        const g = Math.round(color.g * 255)
        const b = Math.round(color.b * 255)
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
      }
      return JSON.stringify(modeValues)
    }
    return String(value)
  }

  return (
    <Container 
      space="medium" 
      style={{ 
        height: '100vh',
        overflowY: 'auto'
      }}
    >
      <VerticalSpace space="large" />
      <Text style="bold">Design Review Buddy</Text>
      <VerticalSpace space="small" />
      <Text>Create and manage design reviews for your Figma projects.</Text>
      
      <VerticalSpace space="large" />
      <Text>Figma API Key (for variable resolution):</Text>
      <VerticalSpace space="extraSmall" />
      <Stack space="extraSmall">
        <Textbox
          placeholder="Enter your Figma API key..."
          value={figmaApiKey}
          onChange={handleApiKeyChange}
          password={true}
        />
        <Button
          fullWidth
          onClick={handleApiKeySubmit}
          disabled={apiKeyStatus === 'saving'}
        >
          {apiKeyStatus === 'saving' ? 'Saving...' : 'Save API Key'}
        </Button>
        {apiKeyStatus === 'success' && (
          <Text style={{ color: '#4CAF50' }}>API key saved successfully</Text>
        )}
        {apiKeyStatus === 'error' && (
          <Text style={{ color: '#FF4D4D' }}>Failed to save API key</Text>
        )}
      </Stack>
      
      <VerticalSpace space="large" />
      <Divider />
      <VerticalSpace space="large" />
      
      <Text>Select a variable collection:</Text>
      <VerticalSpace space="small" />
      
      {isLoading ? (
        <LoadingIndicator />
      ) : collections.length === 0 ? (
        <Text>No variable collections found</Text>
      ) : (
        <Dropdown
          onChange={handleCollectionChange}
          options={collections.map(collection => ({
            value: collection.id,
            text: `${collection.name} [${truncateIdForDropdown(collection.id)}]${collection.libraryName ? ` - ${collection.libraryName}` : ''}`
          }))}
          value={selectedCollectionId || ''}
        />
      )}
      
      <VerticalSpace space="large" />
      <Text>Style Exceptions (comma-separated patterns, e.g. "Retail/*, Marketing/*"):</Text>
      <VerticalSpace space="small" />
      <Textbox
        placeholder="Enter exception patterns..."
        value={exceptions}
        onChange={handleExceptionsChange}
      />
      
      <VerticalSpace space="large" />
      <Divider />
      <VerticalSpace space="large" />

      <Text>Frame Analysis:</Text>
      <VerticalSpace space="small" />
      <Text>Select a single frame to analyze</Text>
      <VerticalSpace space="small" />
      <Button 
        disabled={!hasSingleFrameSelected || !selectedCollectionId || isAnalyzing}
        onClick={handleAnalyzeClick}
      >
        {isAnalyzing ? 'Analyzing...' : 'Analyze Frame'}
      </Button>
      
      <VerticalSpace space="large" />
      
      {analysisResults.length > 0 && (
        <Fragment>
          <Divider />
          <VerticalSpace space="large" />
          <Stack space="small">
            <Text style="bold">Analysis Results:</Text>
            <Stack space="extraSmall">
              <Toggle onChange={handleToggleChange} value={showOnlyMismatches}>
                Show only mismatches
              </Toggle>
              <Toggle onChange={handleFilteredViewToggle} value={showFilteredView}>
                Show filtered view
              </Toggle>
              <Toggle onChange={handleHideAllResultsToggle} value={hideAllResults}>
                Hide all results
              </Toggle>
              <Toggle onChange={handleExcludeLockedLayersToggle} value={excludeLockedLayers}>
                Exclude locked layers
              </Toggle>
              <Toggle onChange={handleExcludeHiddenLayersToggle} value={excludeHiddenLayers}>
                Exclude hidden layers
              </Toggle>
            </Stack>
          </Stack>
          <VerticalSpace space="small" />
          <Text>Selected Collection ID: {selectedCollectionId}</Text>
          <VerticalSpace space="small" />
          {stats && (
            <Stack space="small">
              <Text>Total Properties Scanned: {stats.totalProperties}</Text>
              <Text style="color: #4CAF50">Linked to Selected Collection: {stats.linkedProperties}</Text>
              <Text style="color: #FF4D4D">Not Linked to Selected Collection: {stats.unlinkedProperties}</Text>
              <Text style="color: #FF4D4D">Filtered Mismatches: {stats.filteredMismatches}</Text>
            </Stack>
          )}
          <VerticalSpace space="medium" />
          
          {/* Filtered View */}
          {showFilteredView ? (
            <Stack space="medium">
              {(() => {
                const issues = getGroupedIssues(filteredResults)
                
                // Group issues by layer
                const issuesByLayer = issues.reduce((acc, issue) => {
                  if (!acc[issue.nodeId]) {
                    acc[issue.nodeId] = {
                      nodeName: issue.nodeName,
                      nodeType: issue.nodeType,
                      issues: []
                    }
                  }
                  acc[issue.nodeId].issues.push(issue)
                  return acc
                }, {} as Record<string, { nodeName: string, nodeType: string, issues: typeof issues }>)

                return Object.entries(issuesByLayer).map(([nodeId, layerInfo], layerIndex) => {
                  const isSelected = selectedLayerId === nodeId
                  
                  return (
                    <Stack key={nodeId} space="small">
                      {/* Layer Header and Issues - Now in a single clickable container */}
                      <Stack
                        space="small"
                        style={{
                          cursor: 'pointer',
                          backgroundColor: isSelected ? 'var(--figma-color-bg-secondary)' : 'transparent',
                          transition: 'background-color 0.1s ease',
                          padding: '8px'
                        }}
                        onClick={(event) => handleLayerToggle(nodeId, event)}
                      >
                        <Stack space="extraSmall">
                          {/* Layer Name with Icon */}
                          <Layer
                            icon={getNodeIcon(layerInfo.nodeType)}
                            value={false}
                            bold={false}
                          >
                            <Text style="bold">{layerInfo.nodeName}</Text>
                          </Layer>
                          
                          {/* Issues List */}
                          <Stack space="extraSmall" style={{ paddingLeft: '24px' }}>
                            {layerInfo.issues.map((issue) => {
                              // Determine icon and text based on issue type
                              let icon: JSX.Element = <IconFrame16 />
                              let issueText = ''
                              
                              if (issue.issueType === 'radius') {
                                issueText = 'Radius issue'
                                icon = <IconRadiusTopRight24 style={{ transform: 'scale(0.67)' }} />
                              } else if (issue.issueType === 'padding') {
                                issueText = 'Padding issue'
                                icon = <IconAutoLayoutPaddingSides24 style={{ transform: 'scale(0.67)' }} />
                              } else if (issue.issueType.startsWith('fill')) {
                                issueText = 'Fill issue'
                                icon = <IconVariableColorSmall24 style={{ transform: 'scale(0.67)' }} />
                              } else if (issue.issueType.startsWith('stroke')) {
                                issueText = 'Stroke issue'
                                icon = <IconStrokeWeight24 style={{ transform: 'scale(0.67)' }} />
                              } else if (issue.issueType === 'gap') {
                                issueText = 'Gap issue'
                                icon = <IconAutoLayoutSpacingHorizontal24 style={{ transform: 'scale(0.67)' }} />
                              } else if (issue.issueType === 'text-style') {
                                issueText = 'Text issue'
                                icon = <IconText16 />
                              }

                              return (
                                <Layer
                                  key={`${issue.nodeId}-${issue.issueType}`}
                                  icon={icon}
                                  value={false}
                                  bold={false}
                                >
                                  <Text style={{ color: 'var(--figma-color-text-secondary)' }}>
                                    {issueText}
                                  </Text>
                                </Layer>
                              )
                            })}
                          </Stack>
                        </Stack>
                      </Stack>

                      {/* Add divider after each layer except the last one */}
                      {layerIndex < Object.keys(issuesByLayer).length - 1 && (
                        <Divider />
                      )}
                    </Stack>
                  )
                })
              })()}
            </Stack>
          ) : (
            /* Detailed View - existing code */
            <Stack space="medium">
              {filteredResults.map((result) => (
                <Stack key={result.nodeId} space="small">
                  {/* Layer Information */}
                  <Stack space="extraSmall">
                    <Text style="bold">{result.nodeName}</Text>
                    <Stack space="extraSmall" style={{ marginLeft: '16px' }}>
                      <Text>Type: {result.nodeType}</Text>
                      {result.nodeType === 'FRAME' && (
                        <Text>Layout: {result.layoutMode === 'NONE' ? 'No Auto-layout' : `${result.layoutMode} Auto-layout`}</Text>
                      )}
                    </Stack>
                  </Stack>

                  {/* Properties */}
                  <Stack space="extraSmall">
                    {result.properties.map((property: NodeProperty) => (
                      <Stack key={property.name} space="extraSmall" style={{ marginLeft: '16px', padding: '8px', backgroundColor: '#F5F5F5' }}>
                        {/* Property Name and Value */}
                        <Stack space="extraSmall">
                          <Text style="bold">{property.name}</Text>
                          <Text>Value: {property.formattedValue}</Text>
                        </Stack>

                        {/* Collections Information */}
                        <Stack space="extraSmall" style={{ marginLeft: '8px' }}>
                          <Text>Current Collection: {property.collectionId || 'Not linked'}</Text>
                          <Text>Expected Collections:</Text>
                          <Stack space="extraSmall" style={{ marginLeft: '8px' }}>
                            {property.expectedCollections.map(collection => (
                              <Text key={collection.id}>• {collection.name} ({collection.id})</Text>
                            ))}
                          </Stack>
                        </Stack>

                        {/* Status */}
                        {property.isMismatched ? (
                          <Stack space="extraSmall" style={{ marginLeft: '8px', color: '#FF4D4D' }}>
                            <Text>❌ Mismatch: Not linked to expected collections</Text>
                            {property.suggestedVariable && (
                              <Text style={{ color: '#4CAF50' }}>
                                Suggested: {property.suggestedVariable.name}
                              </Text>
                            )}
                          </Stack>
                        ) : (
                          <Stack space="extraSmall" style={{ marginLeft: '8px', color: '#4CAF50' }}>
                            <Text>
                              {property.matchedByException 
                                ? `✓ Matched by exception: ${property.matchedByException}`
                                : '✓ Correctly linked'}
                            </Text>
                          </Stack>
                        )}
                      </Stack>
                    ))}
                  </Stack>
                  <Divider />
                </Stack>
              ))}
            </Stack>
          )}
        </Fragment>
      )}
      
      {analysisResults.length > 0 && !showFilteredView && (
        <Fragment>
          <Divider />
          <VerticalSpace space="large" />
          <Text style="bold">Library Variables:</Text>
          <VerticalSpace space="medium" />
          
          {libraryVariables.map((library) => (
            <Fragment key={library.collectionId}>
              <Stack space="small">
                <Text style="bold">{library.collectionName}</Text>
                <Text style="secondary">{library.libraryName}</Text>
                
                <Stack space="medium" style={{ marginLeft: '16px' }}>
                  {library.variables.map((variable) => (
                    <Stack key={variable.id} space="extraSmall" style={{ 
                      backgroundColor: 'var(--figma-color-bg-secondary)',
                      padding: '8px',
                      borderRadius: '6px'
                    }}>
                      <Text>{variable.name}</Text>
                      <Stack space="extraSmall" style={{ marginLeft: '8px' }}>
                        <Text style="secondary">Type: {variable.resolvedType}</Text>
                        <Text style="secondary">Value: {formatVariableValue(variable.valuesByMode)}</Text>
                      </Stack>
                    </Stack>
                  ))}
                </Stack>
              </Stack>
              <VerticalSpace space="large" />
            </Fragment>
          ))}
        </Fragment>
      )}
      
      <VerticalSpace space="large" />
    </Container>
  )
}

export default render(Plugin)

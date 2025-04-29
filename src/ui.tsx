import { h } from 'preact'
import { useCallback, useEffect, useState } from 'preact/hooks'
import {
  Button,
  Checkbox,
  Container,
  Divider,
  Dropdown,
  IconComponent16,
  IconFrame16,
  IconInstance16,
  LoadingIndicator,
  Stack,
  Text,
  Textbox,
  VerticalSpace,
  Toggle,
  Layer,
  IconAdjust16,
  IconBoolean16,
  IconText16,
  IconStrokeWeight24,
  IconVariableColorSmall24,
  IconAutoLayoutSpacingHorizontal24,
  IconRadiusTopRight24,
  IconAutoLayoutPaddingSides24,
  render
} from '@create-figma-plugin/ui'
import { emit, on } from '@create-figma-plugin/utilities'

import {
  VariableCollectionData,
  InitializeHandler,
  CollectionSelectedHandler,
  FrameSelectionHandler,
  AnalyzeFrameHandler,
  AnalysisResultsHandler,
  AnalysisResult,
  NodeProperty,
  SelectLayerHandler,
  LibraryVariables,
  LibraryVariablesHandler,
  ExcludedNamesChangedHandler,
  InitHandler,
  SelectCollectionHandler,
  ShowErrorHandler,
  SingleFrameSelectedHandler,
  ToggleExcludeHiddenLayersHandler,
  ToggleExcludeLockedLayersHandler,
  ToggleHideAllResultsHandler,
  ToggleShowOnlyMismatchesHandler
} from './types'

function Plugin() {
  // State variables
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [collections, setCollections] = useState<Array<VariableCollectionData>>([])
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null)
  const [hasSingleFrameSelected, setHasSingleFrameSelected] = useState<boolean>(false)
  const [analysisResults, setAnalysisResults] = useState<Array<AnalysisResult>>([])
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false)
  const [showOnlyMismatches, setShowOnlyMismatches] = useState<boolean>(true)
  const [showFilteredView, setShowFilteredView] = useState<boolean>(false)
  const [excludeLockedLayers, setExcludeLockedLayers] = useState<boolean>(true)
  const [excludeHiddenLayers, setExcludeHiddenLayers] = useState<boolean>(true)
  const [hideAllResults, setHideAllResults] = useState<boolean>(false)
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null)
  const [libraryVariables, setLibraryVariables] = useState<Array<LibraryVariables>>([])
  const [exceptionPatterns, setExceptionPatterns] = useState<string>('Retail UI/*')

  // Handle receiving variable collections from the main context
  useEffect(function () {
    console.log('Setting up INITIALIZE event handler')
    return on<InitializeHandler>(
      'INITIALIZE',
      function (variableCollections: Array<VariableCollectionData>) {
        console.log('INITIALIZE event received with:', variableCollections)
        setCollections(variableCollections)
        setIsLoading(false)
        
        // Find default collections
        const semanticTokensCollection = variableCollections.find(
          collection => 
            collection.name === 'semantic tokens' && 
            collection.libraryName === 'POS Design System'
        )

        const primitiveTokensCollection = variableCollections.find(
          collection => 
            collection.name === 'primitive tokens' && 
            collection.libraryName === 'POS Design System'
        )
        
        // Set the selected collection ID
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

  // Event handlers
  const handleCollectionChange = useCallback(function (event: Event) {
    const select = event.target as HTMLSelectElement
    const newCollectionId = select.value
    setSelectedCollectionId(newCollectionId)
    emit<CollectionSelectedHandler>('COLLECTION_SELECTED', newCollectionId)
  }, [])

  const handleAnalyzeClick = useCallback(function () {
    setIsAnalyzing(true)
    emit<AnalyzeFrameHandler>('ANALYZE_FRAME', exceptionPatterns)
  }, [exceptionPatterns])

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
    const newSelectedId = newValue ? nodeId : null
    setSelectedLayerId(newSelectedId)
    
    if (newSelectedId) {
      emit<SelectLayerHandler>('SELECT_LAYER', newSelectedId)
    }
  }, [])

  const handleExceptionPatternsChange = useCallback((event: h.JSX.TargetedEvent<HTMLInputElement>) => {
    const value = event.currentTarget.value
    setExceptionPatterns(value)
  }, [])

  // Helper functions
  const truncateIdForDropdown = (id: string) => {
    if (!id || id.length <= 8) return id
    return `${id.substring(0, 4)}...${id.substring(id.length - 4)}`
  }

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

  // Add the helper functions for analysis results
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
      .filter(result => {
        if (excludeLockedLayers && result.isLocked) return false
        if (excludeHiddenLayers && !result.isVisible) return false
        return true
      })
      .forEach(result => {
        const groupedProps: { [key: string]: Array<NodeProperty> } = {}
        
        result.properties.forEach(prop => {
          if (hideAllResults && !prop.isMismatched) return
          if (showOnlyMismatches && !prop.isMismatched) return

          let issueType = ''
          if (prop.name.match(/^Padding (Top|Bottom|Left|Right)$/)) {
            issueType = 'padding'
          }
          else if (prop.name.match(/^Corner Radius (Top Left|Top Right|Bottom Right|Bottom Left)$/)) {
            issueType = 'radius'
          }
          else if (prop.name.startsWith('Fill')) {
            issueType = `fill-${prop.name}`
          }
          else if (prop.name.startsWith('Stroke')) {
            issueType = `stroke-${prop.name}`
          }
          else if (prop.name.startsWith('Gap')) {
            issueType = 'gap'
          }
          else if (prop.name.startsWith('Text Style')) {
            issueType = 'text-style'
          }

          if (issueType) {
            if (!groupedProps[issueType]) {
              groupedProps[issueType] = []
            }
            groupedProps[issueType].push(prop)
          }
        })

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
    const uniqueMismatches = new Set<string>()

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
          
          let mismatchType = ''
          if (property.name.match(/^Padding (Top|Bottom|Left|Right)$/)) {
            mismatchType = `${result.nodeId}:padding`
          }
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

  // Get property icons
  const getPropertyIcon = (propertyName: string) => {
    if (propertyName.startsWith('Fill')) {
      return <IconVariableColorSmall24 />
    } else if (propertyName.startsWith('Stroke')) {
      return <IconStrokeWeight24 />
    } else if (propertyName.match(/^Padding/)) {
      return <IconAutoLayoutPaddingSides24 />
    } else if (propertyName.match(/^Corner Radius/)) {
      return <IconRadiusTopRight24 />
    } else if (propertyName === 'Gap') {
      return <IconAutoLayoutSpacingHorizontal24 />
    } else if (propertyName === 'Text Style') {
      return <IconText16 />
    } else {
      return null
    }
  }

  // Add the results UI section
  const stats = analysisResults.length > 0 ? calculateStats(analysisResults) : null

  // Filter results based on toggle states
  const filteredResults = analysisResults
    .filter(result => {
      if (hideAllResults) return false
      
      if (excludeLockedLayers && result.isLocked) {
        return false
      }
      
      if (excludeHiddenLayers && !result.isVisible) {
        return false
      }
      
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

  // Group issues for the filtered view
  const groupedIssues = showFilteredView ? getGroupedIssues(analysisResults) : []

  return (
    <Container space="medium" style={{ height: '100vh', overflowY: 'auto' }}>
      <VerticalSpace space="large" />
      <Text style="bold">Design Review Buddy</Text>
      <VerticalSpace space="small" />
      <Text>Create and manage design reviews for your Figma projects.</Text>
      
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
      
      {libraryVariables.length > 0 && (
        <div>
          <Text style="bold">Library Variables:</Text>
          <VerticalSpace space="small" />
          <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #E5E5E5', borderRadius: '4px', padding: '8px' }}>
            {libraryVariables.map((collection, index) => (
              <div key={`collection-${index}`} style={{ marginBottom: '12px' }}>
                <Text style="bold">{collection.collectionName} - {collection.libraryName}</Text>
                <div style={{ marginLeft: '8px' }}>
                  {collection.variables.slice(0, 10).map((variable, varIndex) => (
                    <div key={`var-${varIndex}`} style={{ fontSize: '12px', padding: '2px 0' }}>
                      <Text>{variable.name} ({variable.resolvedType})</Text>
                    </div>
                  ))}
                  {collection.variables.length > 10 && (
                    <Text style={{ color: '#888', fontSize: '12px' }}>
                      ... and {collection.variables.length - 10} more variables
                    </Text>
                  )}
                </div>
              </div>
            ))}
          </div>
          <VerticalSpace space="large" />
        </div>
      )}
      
      <Text>Style Exceptions (comma-separated patterns, e.g. "Retail/*, Marketing/*"):</Text>
      <VerticalSpace space="small" />
      <Textbox
        placeholder="Enter exception patterns..."
        value={exceptionPatterns}
        onChange={handleExceptionPatternsChange}
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
        <div>
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
          
          {stats && (
            <div style={{ background: '#F5F5F5', padding: '12px', borderRadius: '4px', marginBottom: '12px' }}>
              <Text style="bold">Statistics:</Text>
              <Text>Total Properties: {stats.totalProperties}</Text>
              <Text>Linked Properties: {stats.linkedProperties} ({((stats.linkedProperties / stats.totalProperties) * 100).toFixed(1)}%)</Text>
              <Text>Unlinked Properties: {stats.unlinkedProperties} ({((stats.unlinkedProperties / stats.totalProperties) * 100).toFixed(1)}%)</Text>
              <Text>Filtered Mismatches: {stats.filteredMismatches}</Text>
            </div>
          )}
          
          {/* Results View */}
          {!showFilteredView ? (
            <div>
              {filteredResults.length === 0 ? (
                <Text>No results to display with current filters</Text>
              ) : (
                filteredResults.map(result => (
                  <div key={result.nodeId} style={{ marginBottom: '16px', border: '1px solid #E5E5E5', borderRadius: '4px', padding: '8px' }}>
                    <Stack space="small">
                      <Stack space="extraSmall" style={{ alignItems: 'center' }}>
                        {getNodeIcon(result.nodeType)}
                        <Text style="bold">
                          {result.nodeName} ({result.nodeType})
                        </Text>
                        <Checkbox 
                          onChange={(event) => handleLayerToggle(result.nodeId, event)}
                          value={selectedLayerId === result.nodeId}
                        >
                          Select
                        </Checkbox>
                      </Stack>
                      
                      <div style={{ marginLeft: '16px' }}>
                        {result.properties.map((prop, index) => (
                          <div key={`${result.nodeId}-${prop.name}-${index}`} style={{ 
                            padding: '4px 0',
                            borderBottom: index < result.properties.length - 1 ? '1px solid #EAEAEA' : 'none'
                          }}>
                            <Stack space="small" style={{ alignItems: 'center' }}>
                              {getPropertyIcon(prop.name)}
                              <Stack space="extraSmall" style={{ flex: 1, flexDirection: 'column' }}>
                                <Text style="bold">{prop.name}</Text>
                                <Stack space="medium">
                                  <Stack space="extraSmall" style={{ flexDirection: 'column' }}>
                                    <Text>Current Value:</Text>
                                    <Text>{prop.formattedValue}</Text>
                                  </Stack>
                                  
                                  {prop.isMismatched && prop.suggestedVariable && (
                                    <Stack space="extraSmall" style={{ flexDirection: 'column' }}>
                                      <Text>Suggested Variable:</Text>
                                      <Text style={{ color: '#1EA362' }}>{prop.suggestedVariable.name} ({prop.suggestedVariable.value})</Text>
                                    </Stack>
                                  )}
                                  
                                  {prop.matchedByException && (
                                    <Stack space="extraSmall" style={{ flexDirection: 'column' }}>
                                      <Text>Exception Pattern:</Text>
                                      <Text>{prop.matchedByException}</Text>
                                    </Stack>
                                  )}
                                </Stack>
                              </Stack>
                              
                              {prop.isMismatched ? (
                                <span style={{ color: '#F24822', fontSize: '12px', fontWeight: 'bold' }}>MISMATCH</span>
                              ) : (
                                <span style={{ color: '#1EA362', fontSize: '12px', fontWeight: 'bold' }}>LINKED</span>
                              )}
                            </Stack>
                          </div>
                        ))}
                      </div>
                    </Stack>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div>
              {groupedIssues.length === 0 ? (
                <Text>No results to display with current filters</Text>
              ) : (
                <div>
                  {/* Group by issue type view */}
                  {groupedIssues.map((issue, index) => (
                    <div key={`${issue.nodeId}-${issue.issueType}-${index}`} style={{ 
                      marginBottom: '16px', 
                      border: '1px solid #E5E5E5', 
                      borderRadius: '4px', 
                      padding: '8px' 
                    }}>
                      <Stack space="small">
                        <Stack space="extraSmall" style={{ alignItems: 'center' }}>
                          {getNodeIcon(issue.nodeType)}
                          <Text style="bold">
                            {issue.nodeName} - {issue.issueType.toUpperCase()}
                          </Text>
                          <Checkbox 
                            onChange={(event) => handleLayerToggle(issue.nodeId, event)}
                            value={selectedLayerId === issue.nodeId}
                          >
                            Select
                          </Checkbox>
                        </Stack>
                        
                        <div style={{ marginLeft: '16px' }}>
                          {issue.properties.map((prop, propIndex) => (
                            <div key={`${issue.nodeId}-${prop.name}-${propIndex}`} style={{ 
                              padding: '4px 0',
                              borderBottom: propIndex < issue.properties.length - 1 ? '1px solid #EAEAEA' : 'none'
                            }}>
                              <Stack space="small" style={{ alignItems: 'center' }}>
                                {getPropertyIcon(prop.name)}
                                <Stack space="extraSmall" style={{ flex: 1, flexDirection: 'column' }}>
                                  <Text>{prop.name}: {prop.formattedValue}</Text>
                                  
                                  {prop.isMismatched && prop.suggestedVariable && (
                                    <Text style={{ color: '#1EA362' }}>
                                      Suggestion: {prop.suggestedVariable.name} ({prop.suggestedVariable.value})
                                    </Text>
                                  )}
                                </Stack>
                                
                                {prop.isMismatched ? (
                                  <span style={{ color: '#F24822', fontSize: '12px', fontWeight: 'bold' }}>MISMATCH</span>
                                ) : (
                                  <span style={{ color: '#1EA362', fontSize: '12px', fontWeight: 'bold' }}>LINKED</span>
                                )}
                              </Stack>
                            </div>
                          ))}
                        </div>
                      </Stack>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Container>
  )
}

export default render(Plugin)

import { h, JSX } from 'preact'
import { useCallback, useEffect, useState } from 'preact/hooks'
import {
  Button,
  Container,
  Dropdown,
  LoadingIndicator,
  Text,
  Textbox,
  VerticalSpace,
  Tabs,
  IconButton,
  IconAi16,
  IconInstance16,
  IconFrame16,
  IconGroup16,
  IconShapeText16,
  IconPen16,
  IconAutoLayoutHorizontalCenter16,
  IconAutoLayoutVerticalCenter16,
  Checkbox,
  MiddleAlign,
  Muted,
  render,
  Stack,
  Divider,
  Bold
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
  LibraryVariablesHandler
} from './types'

// CSS for fixed footer
const footerStyle = {
  position: 'fixed',
  bottom: 0,
  left: 0,
  right: 0,
  padding: '16px',
  backgroundColor: 'white',
  borderTop: '1px solid #E5E5E5',
  zIndex: 2
}

// CSS for main content area to add padding at bottom
const contentStyle = {
  paddingBottom: '68px' // Height of footer + padding
}

// CSS for layer container
const layerContainer = {
  border: '1px solid #E5E5E5',
  borderRadius: '8px',
  marginBottom: '16px',
  overflow: 'hidden',
  padding: '6px 0' // Added 6px top/bottom padding to the entire container
}

// CSS for layer header
const layerHeader = {
  padding: '4px 12px', // Further reduced top/bottom from 8px to 4px, kept left/right at 12px
  backgroundColor: 'white',
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  cursor: 'pointer'
  // Removed borderBottom
}

// CSS for properties container
const propertiesContainer = {
  padding: '0 6px 0 12px' // 0 top, 6px right, 0 bottom, 12px left padding
}

// CSS for issue row
const issueRow = {
  padding: '12px 16px',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  borderBottom: '1px solid #E5E5E5'
}

// CSS for highlighted issue
const highlightedIssue = {
  backgroundColor: '#FFF5F5'
}

// CSS for issue content
const issueContent = {
  display: 'flex',
  flexDirection: 'column',
  gap: '2px'
}

// Add a style for subdued AI icons
const aiIconStyle = {
  color: '#8C8C8C', // Subdued gray color
  opacity: 0.8
}

// Add style objects for red text colors
const redTextStyle = {
  color: '#E62E2E', // Strong red color
  fontWeight: 600 // Make property titles heavier
}

const faintRedTextStyle = {
  color: '#E62E2E' // Changed from lighter red to standard red
}

// CSS for subdued text
const subduedTextStyle = {
  color: '#8C8C8C' // Subdued grey color
}

// Custom PropertyRow component (no left icon, with optional right icon)
interface PropertyRowProps {
  title: string
  description: string
  hasRecommendation: boolean
  onRecommendationClick: () => void
}

function PropertyRow({
  title,
  description,
  hasRecommendation,
  onRecommendationClick
}: PropertyRowProps) {
  return (
    <div style={{ 
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      padding: '4px 0' // Reduced from 8px to 4px
      // Removed borderBottom
    }}>
      {/* Content */}
      <div style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: '8px',
        flex: 1,
        paddingRight: '0' // Removed padding completely
      }}>
        <Text style="bold"><span style={redTextStyle}>{title}</span></Text>
        <span style={faintRedTextStyle}>{description}</span>
      </div>
      
      {/* Recommendation icon */}
      {hasRecommendation && (
        <div style={{
          position: 'absolute',
          right: '0',
          top: '50%',
          transform: 'translateY(-50%)',
          zIndex: 1
        }}>
          <IconButton onClick={onRecommendationClick}>
            <div style={aiIconStyle}>
              <IconAi16 />
            </div>
          </IconButton>
        </div>
      )}
    </div>
  )
}

function Plugin() {
  // Core state
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [collections, setCollections] = useState<Array<VariableCollectionData>>([])
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null)
  const [hasSingleFrameSelected, setHasSingleFrameSelected] = useState<boolean>(false)
  const [exceptionPatterns, setExceptionPatterns] = useState<string>('Retail UI/*')
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false)
  const [hasResults, setHasResults] = useState<boolean>(false)
  const [analysisResults, setAnalysisResults] = useState<Array<AnalysisResult>>([])
  const [libraryVariables, setLibraryVariables] = useState<Array<LibraryVariables>>([])
  const [currentTab, setCurrentTab] = useState<string>('lint')
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({})

  // Initialize
  useEffect(function () {
    return on<InitializeHandler>(
      'INITIALIZE',
      function (variableCollections: Array<VariableCollectionData>) {
        console.log('INITIALIZE event received with:', variableCollections.length, 'collections');
        
        try {
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
        } catch (error) {
          console.error('Error in initialization:', error);
        }
      }
    )
  }, [])

  // Handle frame selection changes
  useEffect(function () {
    return on<FrameSelectionHandler>(
      'FRAME_SELECTION_CHANGED',
      function (hasFrameSelected: boolean) {
        console.log('Frame selection changed:', hasFrameSelected);
        setHasSingleFrameSelected(hasFrameSelected);
      }
    )
  }, [])

  // Handle analysis results
  useEffect(function () {
    return on<AnalysisResultsHandler>(
      'ANALYSIS_RESULTS',
      function (results: Array<AnalysisResult>) {
        console.log('Received analysis results:', results.length);
        console.log('Full analysis results data:', results);
        setIsAnalyzing(false);
        setHasResults(results.length > 0);
        setAnalysisResults(results);
        // Reset checked items when we get new results
        setCheckedItems({});
      }
    )
  }, [])

  // Handle library variables loaded
  useEffect(function () {
    return on<LibraryVariablesHandler>(
      'LIBRARY_VARIABLES_LOADED',
      function (variables: Array<LibraryVariables>) {
        console.log('Library variables loaded:', variables.length);
        console.log('Full library variables data:', variables);
        setLibraryVariables(variables);
      }
    )
  }, [])

  // Event handlers
  const handleCollectionChange = useCallback(function (event: Event) {
    try {
      const select = event.target as HTMLSelectElement
      const newCollectionId = select.value
      console.log('Collection changed to:', newCollectionId);
      setSelectedCollectionId(newCollectionId)
      emit<CollectionSelectedHandler>('COLLECTION_SELECTED', newCollectionId)
    } catch (error) {
      console.error('Error in collection change:', error);
    }
  }, [])

  const handleAnalyzeClick = useCallback(function () {
    try {
      console.log('Analyze button clicked');
      setIsAnalyzing(true)
      emit<AnalyzeFrameHandler>('ANALYZE_FRAME', exceptionPatterns)
    } catch (error) {
      console.error('Error analyzing frame:', error);
      setIsAnalyzing(false);
    }
  }, [exceptionPatterns])

  const handleExceptionPatternsChange = useCallback((event: h.JSX.TargetedEvent<HTMLInputElement>) => {
    try {
      const value = event.currentTarget.value
      console.log('Exception patterns changed:', value);
      setExceptionPatterns(value)
    } catch (error) {
      console.error('Error changing patterns:', error);
    }
  }, [])

  const handleTabChange = useCallback((event: h.JSX.TargetedEvent<HTMLInputElement>) => {
    try {
      const newTab = event.currentTarget.value
      console.log('Tab changed to:', newTab);
      setCurrentTab(newTab)
    } catch (error) {
      console.error('Error changing tab:', error);
    }
  }, [])

  const handleSelectLayer = useCallback((nodeId: string) => {
    try {
      console.log('Selecting layer:', nodeId);
      emit<SelectLayerHandler>('SELECT_LAYER', nodeId);
    } catch (error) {
      console.error('Error selecting layer:', error);
    }
  }, [])

  const handleItemCheckChange = useCallback((itemId: string, event: h.JSX.TargetedEvent<HTMLInputElement>) => {
    try {
      const isChecked = event.currentTarget.checked;
      console.log(`Layer item ${itemId} checked:`, isChecked);
      setCheckedItems(prev => ({
        ...prev,
        [itemId]: isChecked
      }));
    } catch (error) {
      console.error('Error handling item check change:', error);
    }
  }, [])

  // Helper function to get the correct icon based on node type
  const getNodeTypeIcon = (nodeType: string, layoutMode?: string) => {
    // Create a wrapper component to apply the subdued style
    const IconWrapper = (props: { children: JSX.Element }) => (
      <div style={subduedTextStyle}>{props.children}</div>
    );

    // Check for frames with auto-layout
    if (nodeType.toUpperCase() === 'FRAME' && layoutMode) {
      if (layoutMode === 'HORIZONTAL') {
        return <IconWrapper><IconAutoLayoutHorizontalCenter16 /></IconWrapper>
      } else if (layoutMode === 'VERTICAL') {
        return <IconWrapper><IconAutoLayoutVerticalCenter16 /></IconWrapper>
      }
    }

    // For other node types or frames without auto-layout
    switch (nodeType.toUpperCase()) {
      case 'FRAME':
        return <IconWrapper><IconFrame16 /></IconWrapper>
      case 'GROUP':
        return <IconWrapper><IconGroup16 /></IconWrapper>
      case 'INSTANCE':
        return <IconWrapper><IconInstance16 /></IconWrapper>
      case 'TEXT':
        return <IconWrapper><IconShapeText16 /></IconWrapper>
      case 'VECTOR':
      case 'LINE':
      case 'POLYGON':
      case 'ELLIPSE':
      case 'STAR':
        return <IconWrapper><IconPen16 /></IconWrapper>
      default:
        return <IconWrapper><IconInstance16 /></IconWrapper>
    }
  }

  // Helper function to render analysis results grouped by layer
  const renderAnalysisResults = () => {
    if (!hasResults || analysisResults.length === 0) {
      return (
        <Text>No issues found or no analysis has been run.</Text>
      )
    }

    return (
      <div>
        {analysisResults.map((result) => {
          // Only show layers with issues (mismatched properties)
          const mismatchedProperties = result.properties.filter(prop => prop.isMismatched);
          
          if (mismatchedProperties.length === 0) {
            return null;
          }

          return (
            <div style={layerContainer} key={result.nodeId}>
              {/* Layer header */}
              <div 
                style={layerHeader}
                onClick={() => handleSelectLayer(result.nodeId)}
              >
                {getNodeTypeIcon(result.nodeType, result.layoutMode)}
                <Text style="bold"><span style={subduedTextStyle}>{result.nodeName}</span></Text>
              </div>

              {/* Layer properties */}
              <div style={propertiesContainer}>
                {mismatchedProperties.map((prop, propIndex) => {
                  const isUnlinked = !prop.variableId && !prop.styleName;
                  const hasRecommendation = !!prop.suggestedVariable;
                  const itemId = `${result.nodeId}-${propIndex}`;
                  const isChecked = checkedItems[itemId] || false;
                  
                  // Create the description text for display
                  const layerText = prop.name
                    .replace(/Fill \d+/, 'Color fill')
                    .replace(/Stroke \d+/, 'Stroke color');
                  
                  // Format the description text
                  let descriptionText = '';
                  if (isUnlinked) {
                    // Extract the value from the formattedValue for detached items
                    const valueMatch = prop.formattedValue.match(/\d+(\.\d+)?/);
                    const valueStr = valueMatch ? valueMatch[0] : prop.formattedValue;
                    descriptionText = `Detached (${valueStr})`;
                  } else if (prop.isMismatched) {
                    // For mismatched but linked items (wrong library)
                    const styleName = prop.styleName || prop.formattedValue;
                    const truncatedName = styleName.length > 19 
                      ? styleName.substring(0, 19) + '...' 
                      : styleName;
                    descriptionText = `Wrong lib (${truncatedName})`;
                  } else {
                    descriptionText = prop.styleName || prop.formattedValue;
                  }
                  
                  return (
                    <PropertyRow
                      key={itemId}
                      title={layerText}
                      description={descriptionText}
                      hasRecommendation={hasRecommendation}
                      onRecommendationClick={() => console.log('Recommendation clicked', prop.suggestedVariable)}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Tab content components
  const LintTab = (
    <div style={contentStyle}>
      <Container space="medium">
        <VerticalSpace space="large" />
        
        {hasResults ? (
          <div>
            <Text style="bold">Analysis Results</Text>
            <VerticalSpace space="medium" />
            {renderAnalysisResults()}
          </div>
        ) : (
          <div>
            {!hasSingleFrameSelected ? (
              <Text>Select a single frame to analyze</Text>
            ) : (
              <Text>Click "Analyze Frame" to begin analysis</Text>
            )}
          </div>
        )}
      </Container>
    </div>
  )

  const SettingsTab = (
    <div style={contentStyle}>
      <Container space="medium">
        <VerticalSpace space="large" />
        <Text>Variable Collection</Text>
        <VerticalSpace space="small" />
        
        {isLoading ? (
          <LoadingIndicator />
        ) : collections.length === 0 ? (
          <Text>No variable collections found</Text>
        ) : (
          <Dropdown
            onChange={handleCollectionChange}
            options={collections.map((collection) => ({
              value: collection.id,
              text: `${collection.name} ${collection.libraryName ? ` - ${collection.libraryName}` : ''}`
            }))}
            value={selectedCollectionId || ''}
          />
        )}
        
        <VerticalSpace space="large" />
        <Text>Style Exceptions</Text>
        <VerticalSpace space="small" />
        <Textbox
          placeholder="Enter exception patterns..."
          value={exceptionPatterns}
          onChange={handleExceptionPatternsChange}
        />
        
        <VerticalSpace space="large" />
        <Text style="small">
          Enter patterns to exclude styles from analysis, separated by commas.
          For example: "Retail UI/*" will ignore all styles starting with "Retail UI/".
        </Text>
      </Container>
    </div>
  )

  // Define tabs options
  const tabOptions = [
    {
      children: LintTab,
      value: 'lint'
    },
    {
      children: SettingsTab,
      value: 'settings'
    }
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Tabs
        onChange={handleTabChange}
        options={tabOptions}
        value={currentTab}
      />
      
      {/* Fixed footer with CTA button */}
      <div style={footerStyle}>
        <Button 
          disabled={!hasSingleFrameSelected || !selectedCollectionId || isAnalyzing}
          fullWidth
          onClick={handleAnalyzeClick}
        >
          {isAnalyzing ? 'Analyzing...' : 'Analyze Frame'}
        </Button>
      </div>
    </div>
  )
}

export default render(Plugin)

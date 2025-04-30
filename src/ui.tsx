import { h, JSX, Fragment } from 'preact'
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
  IconApprovedCheckmark16,
  IconAdjust16,
  Checkbox,
  MiddleAlign,
  Muted,
  render,
  Stack,
  Divider,
  Bold,
  Modal
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
  ApplyRecommendationHandler,
  RunReviewerHandler,
  FrameImageData,
  FrameImageExportedHandler
} from './types'

// CSS for fixed footer
const footerStyle = {
  position: 'fixed',
  bottom: 0,
  left: 0,
  right: 0,
  padding: '12px 16px', // Updated from 8px to 12px top/bottom, kept 16px left/right
  backgroundColor: 'white',
  borderTop: '1px solid #E5E5E5',
  zIndex: 2
}

// CSS for main content area to add padding at bottom
const contentStyle = {
  paddingBottom: '60px' // Updated from 52px to 60px to account for increased footer height
}

// CSS for layer container
const layerContainer = {
  border: '1px solid #E5E5E5',
  borderRadius: '8px',
  marginBottom: '8px',
  overflow: 'hidden',
  padding: '6px 0' // Added 6px top/bottom padding to the entire container
}

// CSS for layer header
const layerHeader = {
  padding: '4px 10px', // Reduced from 4px 12px to 4px 10px (reduced by 2px)
  display: 'flex',
  alignItems: 'center',
  gap: '4px', // Reduced from 8px to 4px to bring icon and text closer together
  cursor: 'pointer'
}

// CSS for results container
const resultsContainer = {
  border: '1px solid #E5E5E5',
  borderRadius: '8px',
  marginBottom: '16px',
  overflow: 'hidden',
  padding: '10px 10px' // Consistent with layerHeader padding
}

// CSS for properties container
const propertiesContainer = {
  padding: '0 6px 0 6px' // Changed left padding from 8px to 6px, kept 0 top/bottom and 6px right
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
  // Removed backgroundColor
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

// Add style for success icons
const successIconStyle = {
  color: '#2E7D32', // Darker success green color
}

// Add style objects for red text colors
const redTextStyle = {
  color: '#E62E2E', // Strong red color
  fontWeight: 600 // Make property titles heavier
}

const faintRedTextStyle = {
  color: '#E62E2E' // Changed from lighter red to standard red
}

// Add style objects for success text colors
const successTextStyle = {
  color: '#2E7D32', // Darker success green color
  fontWeight: 600 // Make property titles heavier
}

const faintSuccessTextStyle = {
  color: '#2E7D32' // Darker success green color
}

// CSS for subdued text
const subduedTextStyle = {
  color: '#8C8C8C' // Subdued grey color
}

// CSS for smaller icons
const iconSizeStyle = {
  transform: 'scale(0.85)', // Make icons slightly smaller (85% of original size)
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
}

// CSS for modal z-index (higher than footer)
const modalStyle = {
  zIndex: 10 // Higher than the footer's z-index (2)
}

// Custom PropertyRow component (no left icon, with optional right icon)
interface PropertyRowProps {
  title: string
  description: string
  hasRecommendation: boolean
  onRecommendationClick: () => void
  onClick?: () => void
  originalProps: Array<NodeProperty>
  onModalOpen?: () => void
  onModalClose?: () => void
}

function PropertyRow({
  title,
  description,
  hasRecommendation,
  onRecommendationClick,
  onClick,
  originalProps,
  onModalOpen,
  onModalClose
}: PropertyRowProps) {
  const [isHovered, setIsHovered] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isApplied, setIsApplied] = useState<boolean>(false);
  
  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
  }, []);
  
  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
  }, []);
  
  const handleRowClick = useCallback((event: MouseEvent) => {
    if (onClick) {
      onClick();
    }
  }, [onClick]);
  
  const handleButtonClick = useCallback((event: JSX.TargetedMouseEvent<HTMLButtonElement>) => {
    // Don't do anything if already applied
    if (isApplied) return;

    // Stop propagation to prevent triggering row click
    event.stopPropagation();
    
    // Open the modal
    setIsModalOpen(true);
    if (onModalOpen) onModalOpen();
    
    // Also select the layer (if onClick is provided)
    if (onClick) {
      onClick();
    }
  }, [onModalOpen, onClick, isApplied]);
  
  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    if (onModalClose) onModalClose();
  }, [onModalClose]);
  
  const handleApplyRecommendation = useCallback(() => {
    // Only apply if we have the necessary data
    if (originalProps && originalProps.length > 0) {
      const prop = originalProps[0];
      if (prop.suggestedVariable && onClick) {
        // First, select the layer
        onClick();
        
        // Then apply the recommendation by sending data to the main plugin context
        const nodeId = prop.nodeId || '';
        emit<ApplyRecommendationHandler>(
          'APPLY_RECOMMENDATION', 
          nodeId, 
          prop, 
          prop.suggestedVariable
        );
        
        console.log('Applying recommendation:', {
          nodeId,
          property: prop,
          suggestion: prop.suggestedVariable
        });
        
        // Mark as applied
        setIsApplied(true);
        
        // Call the recommendation click handler to notify parent component
        if (onRecommendationClick) {
          onRecommendationClick();
        }
      }
    }
    
    // Close the modal after applying
    setIsModalOpen(false);
    if (onModalClose) onModalClose();
  }, [originalProps, onClick, onModalClose, onRecommendationClick]);
  
  // Outer container style (no hover/click behavior)
  const containerStyle = {
    position: 'relative' as const,
    display: 'flex' as const,
    alignItems: 'center' as const,
    width: '100%',
  };
  
  // Apply cursor pointer style to the clickable row part only
  const rowStyle = {
    display: 'flex' as const,
    alignItems: 'center' as const,
    padding: '4px 8px',
    backgroundColor: isHovered ? '#F5F5F5' : 'transparent',
    cursor: onClick ? 'pointer' : 'default',
    flex: '1',
    borderRadius: '2px',
    // Add right padding to create space for the button
    paddingRight: hasRecommendation ? '32px' : '8px'
  };
  
  // Style for text elements to inherit cursor
  const textStyle = {
    cursor: 'inherit'
  };

  // Style for modal content
  const modalContentStyle = {
    padding: '16px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '16px'
  };

  // Get the suggested variable if available
  const suggestedVariable = originalProps && 
    originalProps.length > 0 && 
    originalProps[0].suggestedVariable ? 
    originalProps[0].suggestedVariable : null;

  // Choose text style based on application status
  const titleTextStyle = isApplied ? successTextStyle : redTextStyle;
  const descriptionTextStyle = isApplied ? faintSuccessTextStyle : faintRedTextStyle;

  return (
    <Fragment>
      <div style={containerStyle}>
        {/* Clickable row part */}
        <div 
          style={rowStyle}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onClick={handleRowClick}
        >
          <div style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            gap: '8px',
            flex: 1,
            cursor: 'inherit'
          }}>
            <Text style="bold"><span style={{...titleTextStyle, ...textStyle}}>{title}</span></Text>
            <span style={{...descriptionTextStyle, ...textStyle}}>{isApplied ? 'Fixed' : description}</span>
          </div>
        </div>
        
        {/* Recommendation or Success icon */}
        {hasRecommendation && (
          <div style={{
            position: 'absolute',
            right: '0',
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 1
          }}>
            <IconButton onClick={handleButtonClick} disabled={isApplied}>
              <div style={isApplied ? successIconStyle : aiIconStyle}>
                {isApplied ? <IconApprovedCheckmark16 /> : <IconAi16 />}
              </div>
            </IconButton>
          </div>
        )}
      </div>
      
      {/* Bottom sheet modal */}
      <Modal 
        onCloseButtonClick={handleCloseModal} 
        open={isModalOpen} 
        position="bottom" 
        title={`AI Recommendation for ${title}`}
        onOverlayClick={handleCloseModal}
        onEscapeKeyDown={handleCloseModal}
        style={modalStyle}
      >
        <div style={modalContentStyle}>
          <div>
            <Text style="bold">Current Value</Text>
            <VerticalSpace space="small" />
            <Text>{description}</Text>
          </div>
          
          {suggestedVariable && (
            <div>
              <Text style="bold">Suggested Fix</Text>
              <VerticalSpace space="small" />
              <Text>Use the variable: "{suggestedVariable.name}" with value: {
                typeof suggestedVariable.value === 'object' && 'r' in suggestedVariable.value
                ? `#${Math.round(suggestedVariable.value.r * 255).toString(16).padStart(2, '0')}${
                     Math.round(suggestedVariable.value.g * 255).toString(16).padStart(2, '0')}${
                     Math.round(suggestedVariable.value.b * 255).toString(16).padStart(2, '0')}`
                : suggestedVariable.value
              }</Text>
            </div>
          )}
          
          {!suggestedVariable && (
            <div>
              <Text style="bold">No Specific Suggestion Available</Text>
              <VerticalSpace space="small" />
              <Text>We recommend using variables from the selected design system library.</Text>
            </div>
          )}
          
          {/* Bottom section with action button */}
          <VerticalSpace space="medium" />
          {suggestedVariable ? (
            <Button 
              fullWidth 
              onClick={handleApplyRecommendation}
              secondary={false} // Primary button styling
            >
              Apply recommendation
            </Button>
          ) : (
            <Button 
              fullWidth 
              onClick={handleCloseModal}
              secondary={true} // Secondary button styling
            >
              Close
            </Button>
          )}
        </div>
      </Modal>
    </Fragment>
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
  const [currentTab, setCurrentTab] = useState<string>('Linter')
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({})
  const [isAnyModalOpen, setIsAnyModalOpen] = useState<boolean>(false)
  const [appliedRecommendationsCount, setAppliedRecommendationsCount] = useState<number>(0)
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false)
  const [isReviewerSettingsModalOpen, setIsReviewerSettingsModalOpen] = useState<boolean>(false)
  const [apiKey, setApiKey] = useState<string>('')
  const [isApiKeySaved, setIsApiKeySaved] = useState<boolean>(false)
  
  // Reviewer-specific state
  const [isReviewing, setIsReviewing] = useState<boolean>(false)
  const [frameImage, setFrameImage] = useState<FrameImageData | null>(null)

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
        // Reset applied recommendations count
        setAppliedRecommendationsCount(0);
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

  // Handler for when any modal opens
  const handleModalOpen = useCallback(() => {
    setIsAnyModalOpen(true);
  }, []);
  
  // Handler for when any modal closes
  const handleModalClose = useCallback(() => {
    setIsAnyModalOpen(false);
  }, []);

  // Handler for when a recommendation is applied
  const handleRecommendationApplied = useCallback(() => {
    setAppliedRecommendationsCount(prev => prev + 1);
  }, []);

  // Settings modal handlers
  const handleOpenSettingsModal = useCallback((event: JSX.TargetedMouseEvent<HTMLButtonElement>) => {
    setIsSettingsModalOpen(true)
  }, [])

  const handleCloseSettingsModal = useCallback((event: JSX.TargetedMouseEvent<HTMLButtonElement>) => {
    setIsSettingsModalOpen(false)
  }, [])
  
  // Reviewer settings modal handlers
  const handleOpenReviewerSettingsModal = useCallback((event: JSX.TargetedMouseEvent<HTMLButtonElement>) => {
    setIsReviewerSettingsModalOpen(true)
  }, [])

  const handleCloseReviewerSettingsModal = useCallback((event: JSX.TargetedMouseEvent<HTMLButtonElement>) => {
    setIsReviewerSettingsModalOpen(false)
  }, [])

  // Handle Run Reviewer click
  const handleRunReviewerClick = useCallback(() => {
    setIsReviewing(true)
    setFrameImage(null)
    emit<RunReviewerHandler>('RUN_REVIEWER')
  }, [])

  // Listen for frame image exported event
  useEffect(() => {
    return on<FrameImageExportedHandler>(
      'FRAME_IMAGE_EXPORTED',
      function (frameImageData: FrameImageData) {
        console.log('Received frame image:', frameImageData.frameName)
        setFrameImage(frameImageData)
        setIsReviewing(false)
      }
    )
  }, [])

  // Handle API key change
  const handleApiKeyChange = useCallback((event: h.JSX.TargetedEvent<HTMLInputElement>) => {
    try {
      const value = event.currentTarget.value
      setApiKey(value)
      setIsApiKeySaved(false)
    } catch (error) {
      console.error('Error changing API key:', error);
    }
  }, [])

  // Handle API key save
  const handleSaveApiKey = useCallback(() => {
    try {
      // Here you would typically store the API key or send it to the main context
      console.log('Saving API key:', apiKey)
      // Later we'll add persistence, for now just mark it as saved for UI feedback
      setIsApiKeySaved(true)
    } catch (error) {
      console.error('Error saving API key:', error);
    }
  }, [apiKey])

  // Handle opening the API key link
  const handleOpenApiKeyLink = useCallback(() => {
    try {
      emit('OPEN_EXTERNAL_URL', 'https://openai-proxy.shopify.io/')
    } catch (error) {
      console.error('Error opening API key link:', error);
    }
  }, [])

  // Helper function to get the correct icon based on node type
  const getNodeTypeIcon = (nodeType: string, layoutMode?: string) => {
    // Create a wrapper component to apply the subdued style and smaller size
    const IconWrapper = (props: { children: JSX.Element }) => (
      <div style={{...subduedTextStyle, ...iconSizeStyle}}>{props.children}</div>
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

          // Improved grouping for radius and padding properties
          const radiusPropertiesByValue = new Map<string, Array<NodeProperty>>();
          const paddingPropertiesByValue = new Map<string, Array<NodeProperty>>();
          const gapProperties: Array<NodeProperty> = [];
          const standardProperties: Array<NodeProperty> = [];
          
          // Sort properties into groups based on their values
          mismatchedProperties.forEach(prop => {
            // Extract the numeric value for grouping
            const valueMatch = prop.formattedValue.match(/\d+(\.\d+)?/);
            const numericValue = valueMatch ? valueMatch[0] : prop.formattedValue;
            
            if (prop.name.includes('Corner Radius')) {
              // Group radius properties by value
              if (!radiusPropertiesByValue.has(numericValue)) {
                radiusPropertiesByValue.set(numericValue, []);
              }
              radiusPropertiesByValue.get(numericValue)?.push(prop);
            } else if (prop.name.includes('Padding')) {
              // Group padding properties by value
              if (!paddingPropertiesByValue.has(numericValue)) {
                paddingPropertiesByValue.set(numericValue, []);
              }
              paddingPropertiesByValue.get(numericValue)?.push(prop);
            } else if (prop.name === 'Gap') {
              gapProperties.push(prop);
            } else {
              standardProperties.push(prop);
            }
          });
          
          // Prepare all properties to render (grouped + standard)
          const propertiesToRender: Array<{
            key: string,
            title: string,
            description: string,
            hasRecommendation: boolean,
            originalProps: Array<NodeProperty>
          }> = [];
          
          // Add radius properties grouped by value
          radiusPropertiesByValue.forEach((props, value) => {
            // Get the corner directions
            const corners = props.map(p => p.name.replace('Corner Radius ', ''));
            
            // Determine if properties are detached, wrong lib, or mixed
            const hasDetached = props.some(p => !p.variableId && !p.styleName);
            const hasWrongLib = props.some(p => p.collectionId && p.isMismatched);
            
            let statusText = "";
            if (hasDetached && hasWrongLib) {
              statusText = "Detached & Wrong lib";
            } else if (hasDetached) {
              statusText = "Detached";
            } else if (hasWrongLib) {
              statusText = "Wrong lib";
            }
            
            // Check if any property has a recommendation
            const hasRecommendation = props.some(p => !!p.suggestedVariable);
            
            // Create title based on how many corners have this value
            let title = "";
            if (corners.length === 4) {
              title = "All Corners Radius";
            } else if (corners.length === 1) {
              title = `${corners[0]} Radius`;
            } else {
              title = `${corners.length} Corners Radius`;
            }
            
            propertiesToRender.push({
              key: `${result.nodeId}-radius-${value}`,
              title,
              description: `${statusText} (${value})`,
              hasRecommendation,
              originalProps: props
            });
          });
          
          // Add padding properties grouped by value
          paddingPropertiesByValue.forEach((props, value) => {
            // Get the padding directions
            const directions = props.map(p => p.name.replace('Padding ', ''));
            
            // Determine if properties are detached, wrong lib, or mixed
            const hasDetached = props.some(p => !p.variableId && !p.styleName);
            const hasWrongLib = props.some(p => p.collectionId && p.isMismatched);
            
            let statusText = "";
            if (hasDetached && hasWrongLib) {
              statusText = "Detached & Wrong lib";
            } else if (hasDetached) {
              statusText = "Detached";
            } else if (hasWrongLib) {
              statusText = "Wrong lib";
            }
            
            // Check if any property has a recommendation
            const hasRecommendation = props.some(p => !!p.suggestedVariable);
            
            // Create title based on how many directions have this value
            let title = "";
            if (directions.length === 4) {
              title = "All Sides Padding";
            } else if (directions.length === 1) {
              title = `${directions[0]} Padding`;
            } else {
              title = `${directions.length} Sides Padding`;
            }
            
            propertiesToRender.push({
              key: `${result.nodeId}-padding-${value}`,
              title,
              description: `${statusText} (${value})`,
              hasRecommendation,
              originalProps: props
            });
          });
          
          // Add gap properties
          if (gapProperties.length > 0) {
            const props = gapProperties;
            // Extract just the values to display, without direction labels
            const values = props.map(p => {
              // Get just the numeric value
              const valueMatch = p.formattedValue.match(/\d+(\.\d+)?/);
              return valueMatch ? valueMatch[0] : p.formattedValue;
            });
            
            // Determine if properties are detached, wrong lib, or mixed
            const hasDetached = props.some(p => !p.variableId && !p.styleName);
            const hasWrongLib = props.some(p => p.collectionId && p.isMismatched);
            
            let statusText = "";
            if (hasDetached && hasWrongLib) {
              statusText = "Detached & Wrong lib";
            } else if (hasDetached) {
              statusText = "Detached";
            } else if (hasWrongLib) {
              statusText = "Wrong lib";
            }
            
            // Check if any property has a recommendation
            const hasRecommendation = props.some(p => !!p.suggestedVariable);
            
            propertiesToRender.push({
              key: `${result.nodeId}-gap`,
              title: "Gap",
              description: `${statusText} (${values.join(', ')})`,
              hasRecommendation,
              originalProps: props
            });
          }
          
          // Add standard properties
          standardProperties.forEach((prop, propIndex) => {
            const isUnlinked = !prop.variableId && !prop.styleName;
            const hasRecommendation = !!prop.suggestedVariable;
            
            // Create the description text for display
            const layerText = prop.name
              .replace(/Fill \d+/, 'Color fill')
              .replace(/Stroke \d+/, 'Stroke color');
            
            // Check if it's a color property (stroke or fill)
            const isColorProperty = prop.name.includes('Fill') || prop.name.includes('Stroke');
            
            // Format the description text
            let descriptionText = '';
            if (isUnlinked) {
              // Extract the value from the formattedValue for detached items (no variable or style)
              if (isColorProperty && prop.formattedValue.startsWith('#')) {
                // For colors, show the hex value
                descriptionText = `Detached (${prop.formattedValue})`;
              } else {
                const valueMatch = prop.formattedValue.match(/\d+(\.\d+)?/);
                const valueStr = valueMatch ? valueMatch[0] : prop.formattedValue;
                descriptionText = `Detached (${valueStr})`;
              }
            } else if (prop.isMismatched) {
              // For mismatched but linked items (wrong library)
              // Check if it has a collection ID (linked to variable/style but wrong library)
              if (prop.collectionId) {
                // If it has a style name, prioritize showing that
                if (prop.styleName) {
                  const truncatedName = prop.styleName.length > 19 
                    ? prop.styleName.substring(0, 19) + '...' 
                    : prop.styleName;
                  descriptionText = `Wrong lib (${truncatedName})`;
                } else {
                  // For variables without a style name, show the variable or color value
                  const displayValue = prop.variableId ? 'variable' : prop.formattedValue;
                  const truncatedName = displayValue.length > 19 
                    ? displayValue.substring(0, 19) + '...' 
                    : displayValue;
                  descriptionText = `Wrong lib (${truncatedName})`;
                }
              } else {
                // It's a value without a collection ID
                if (isColorProperty && prop.formattedValue.startsWith('#')) {
                  descriptionText = `Detached (${prop.formattedValue})`;
                } else {
                  descriptionText = `Detached (${prop.formattedValue})`;
                }
              }
            } else {
              descriptionText = prop.styleName || prop.formattedValue;
            }
            
            propertiesToRender.push({
              key: `${result.nodeId}-${propIndex}`,
              title: layerText,
              description: descriptionText,
              hasRecommendation,
              originalProps: [prop]
            });
          });

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
                {propertiesToRender.map((propInfo) => {
                  return (
                    <PropertyRow
                      key={propInfo.key}
                      title={propInfo.title}
                      description={propInfo.description}
                      hasRecommendation={propInfo.hasRecommendation}
                      onRecommendationClick={() => {
                        // If multiple properties, just use the first one's recommendation for now
                        const prop = propInfo.originalProps[0];
                        console.log('Recommendation clicked', prop.suggestedVariable);
                        handleRecommendationApplied();
                      }}
                      onClick={() => handleSelectLayer(result.nodeId)}
                      originalProps={propInfo.originalProps}
                      onModalOpen={handleModalOpen}
                      onModalClose={handleModalClose}
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
            <div style={resultsContainer}>
              <Text style="bold">
                {analysisResults.reduce((count, result) => 
                  count + result.properties.filter(prop => prop.isMismatched).length, 0
                ) - appliedRecommendationsCount} Issues found
              </Text>
            </div>
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

  const ReviewerTab = (
    <div style={contentStyle}>
      <Container space="medium">
        <VerticalSpace space="large" />
        <Text>Frame Reviewer</Text>
        <VerticalSpace space="large" />
        
        {!hasSingleFrameSelected ? (
          <Text>Select a single frame to review</Text>
        ) : frameImage ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Text style="bold">{frameImage.frameName}</Text>
            <VerticalSpace space="small" />
            <div style={{ 
              maxWidth: '100%', 
              maxHeight: '400px', 
              overflow: 'auto',
              border: '1px solid #E5E5E5',
              borderRadius: '4px',
              padding: '8px'
            }}>
              <img 
                src={frameImage.imageUrl} 
                alt={frameImage.frameName}
                style={{ 
                  maxWidth: '100%', 
                  height: 'auto',
                  display: 'block'
                }} 
              />
            </div>
            <VerticalSpace space="medium" />
            <Text>Frame dimensions: {frameImage.width}px × {frameImage.height}px</Text>
          </div>
        ) : isReviewing ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <LoadingIndicator />
            <VerticalSpace space="small" />
            <Text>Exporting frame...</Text>
          </div>
        ) : (
          <Text>Click "Run Reviewer" to export the selected frame</Text>
        )}
      </Container>
    </div>
  )

  // Define tabs options
  const tabOptions = [
    {
      children: LintTab,
      value: 'Linter'
    },
    {
      children: ReviewerTab,
      value: 'Reviewer'
    }
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Tabs
        onChange={handleTabChange}
        options={tabOptions}
        value={currentTab}
      />
      
      {/* Settings bottom sheet modal */}
      <Modal 
        onCloseButtonClick={handleCloseSettingsModal} 
        open={isSettingsModalOpen} 
        position="bottom" 
        title="Linter Settings"
        style={{ height: '88vh' }}
      >
        <div style={{ padding: '16px' }}>
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
      </Modal>
      
      {/* Reviewer Settings bottom sheet modal */}
      <Modal 
        onCloseButtonClick={handleCloseReviewerSettingsModal} 
        open={isReviewerSettingsModalOpen} 
        position="bottom" 
        title="Reviewer Settings"
        style={{ height: '88vh' }}
      >
        <div style={{ padding: '16px' }}>
          <Container space="medium">
            <VerticalSpace space="large" />
            <Text>Shopify OpenAI Proxy API Key</Text>
            <VerticalSpace space="small" />
            <Textbox
              placeholder="Enter your Shopify OpenAI Proxy API key..."
              value={apiKey}
              onChange={handleApiKeyChange}
              password
            />
            <VerticalSpace space="extraSmall" />
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <Button
                onClick={handleSaveApiKey}
                secondary
              >
                Save API Key
              </Button>
              {isApiKeySaved && (
                <Text style="small">
                  <span style={successTextStyle}>✓ API key saved</span>
                </Text>
              )}
            </div>
            
            <VerticalSpace space="large" />
            <Button 
              onClick={handleOpenApiKeyLink}
              secondary
              fullWidth
            >
              Get Shopify OpenAI Proxy API Key
            </Button>
            
            <VerticalSpace space="large" />
            <Text style="small">
              You need a Shopify OpenAI Proxy API key to use the design reviewer features. 
              The key will be used to analyze design screenshots and provide feedback.
            </Text>
          </Container>
        </div>
      </Modal>
      
      {/* Fixed footer with CTA button - hide when modal is open */}
      {!isAnyModalOpen && !isSettingsModalOpen && !isReviewerSettingsModalOpen && (
        <div style={footerStyle}>
          {currentTab === 'Linter' && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <IconButton 
                onClick={handleOpenSettingsModal}
                style={{ 
                  border: '1px solid rgba(0, 0, 0, 0.1)', 
                  borderRadius: '6px', 
                  padding: '8px',
                  color: '#666666' // Darker gray color for the icon
                }}
              >
                <IconAdjust16 />
              </IconButton>
              <Button 
                disabled={!hasSingleFrameSelected || !selectedCollectionId || isAnalyzing}
                onClick={handleAnalyzeClick}
              >
                {isAnalyzing ? 'Analyzing...' : 'Run Linter'}
              </Button>
            </div>
          )}
          {currentTab === 'Reviewer' && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <IconButton 
                onClick={handleOpenReviewerSettingsModal}
                style={{ 
                  border: '1px solid rgba(0, 0, 0, 0.1)', 
                  borderRadius: '6px', 
                  padding: '8px',
                  color: '#666666' // Darker gray color for the icon
                }}
              >
                <IconAdjust16 />
              </IconButton>
              <Button 
                disabled={!hasSingleFrameSelected || isReviewing}
                onClick={handleRunReviewerClick}
              >
                {isReviewing ? 'Exporting...' : 'Run Reviewer'}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default render(Plugin)

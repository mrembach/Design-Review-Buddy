# Design Review Buddy - Technical Documentation

## Overview
Design Review Buddy is a Figma plugin that helps ensure design consistency by analyzing frames and their children for proper variable and style collection usage. The plugin validates that all design tokens (colors, text styles, spacing, etc.) come from the expected library collections.

## Core Concepts

### Library Collections
- The plugin works with Figma's team library variable collections
- Each collection belongs to a specific library (identified by `libraryName`)
- Collections from the same library are considered related and valid alternatives for each other
- Variables within collections are typed (COLOR, FLOAT, etc.) and contain specific values

### Selection and Analysis Flow
1. Plugin loads all available library variable collections
2. User selects a target collection to validate against
3. Plugin monitors frame selection in Figma
4. When a single frame is selected, analysis can be performed
5. Analysis recursively traverses the frame and all its children

## Matching Logic

### Collection Matching
The `isCollectionMatch` function implements the core matching logic with the following rules:

1. **Exception Matching**
   - Checks if a style name matches any exception patterns
   - Supports exact matches and wildcard patterns (e.g., "Header*")
   - Exception matches override any collection mismatch
   - Returns both match status and the matched exception pattern

2. **Library-Level Matching**
   - Collections from the same library are considered valid matches
   - Example: If collection "Light Mode" is selected and belongs to "Design System", any other collection from "Design System" is valid

3. **Variable vs Style Matching**
   - Variables: Checks if either collection ID contains the other (bidirectional prefix matching)
   - Styles: Checks if the style's collection ID includes our target collection ID
   - Different matching logic accounts for how Figma structures variable vs style references

## Property Analysis

The plugin analyzes the following properties:

### 1. Fill Properties
- Checks both solid colors and gradients
- Handles both style-based and variable-based fills
- For each visible fill:
  - Gets style ID or variable binding
  - Retrieves collection information
  - Formats color values to hex
  - Suggests matching variables if available

### 2. Stroke Properties
- Similar to fill property checking
- Analyzes each visible stroke layer
- Validates collection membership
- Suggests matching variables for mismatches

### 3. Corner Radius
- Checks individual corner properties:
  - Top Left
  - Top Right
  - Bottom Right
  - Bottom Left
- Ignores zero values (no radius)
- Validates variable bindings
- Suggests matching FLOAT variables

### 4. Padding
- Analyzes all four padding directions:
  - Left
  - Right
  - Top
  - Bottom
- Ignores zero padding
- Validates variable bindings
- Suggests matching FLOAT variables

### 5. Gap (Item Spacing)
- Special handling for auto-layout frames
- Checks `itemSpacing` property
- **Special Case**: Ignores gaps when using "Space Between" layout
  - Detected via `primaryAxisAlignItems === 'SPACE_BETWEEN'`
  - Prevents false positives for automatic spacing
- For explicit gaps:
  - Validates variable bindings
  - Suggests matching FLOAT variables

### 6. Text Styles
- Handles both style-based and variable-based text styles
- Checks text style collection membership
- Reports detached text styles

## Variable Resolution

For each property, the plugin follows this resolution order:
1. Check for style ID (if applicable)
2. Check for direct variable binding
3. If variable ID exists but collection ID is missing:
   - Fetch variable by ID
   - Get collection ID from variable
   - Use for matching

## Suggestions Engine

For mismatched properties, the plugin attempts to find matching variables:
1. Matches are found based on:
   - Exact value matching
   - Correct variable type (COLOR, FLOAT, etc.)
   - Variable belonging to the selected collection
2. Suggestions are only provided when:
   - Property is actually mismatched
   - Not matched by an exception pattern
   - A matching variable exists in the selected collection

## Error Handling

The plugin implements robust error handling:
- Safe variable and style resolution
- Graceful handling of missing or inaccessible libraries
- Proper type checking and validation
- Informative error messages and notifications

## Data Serialization

All data passed between the plugin and UI is properly serialized:
- Complex objects are cleaned for serialization
- Color values are converted to readable formats
- Circular references are handled
- Large datasets are properly structured

## Performance Considerations

The plugin optimizes performance through:
1. Efficient traversal of node trees
2. Caching of selected collection data
3. Minimal variable lookups
4. Selective property checking
5. Smart exception pattern matching

## Exception System

The exception system allows for flexible matching rules:
1. Supports comma-separated patterns
2. Handles exact matches
3. Supports wildcard (*) patterns
4. Patterns can match any part of style names
5. Exception matches override collection validation

## Future Considerations

Areas identified for potential enhancement:
1. Support for more property types
2. Enhanced variable suggestion algorithms
3. Batch processing capabilities
4. Custom matching rules
5. Performance optimizations for large frames
6. Extended exception pattern syntax

## Development guide

*This plugin is built with [Create Figma Plugin](https://yuanqing.github.io/create-figma-plugin/).*

### Pre-requisites

- [Node.js](https://nodejs.org) – v22
- [Figma desktop app](https://figma.com/downloads/)

### Build the plugin

To build the plugin:

```
$ npm run build
```

This will generate a [`manifest.json`](https://figma.com/plugin-docs/manifest/) file and a `build/` directory containing the JavaScript bundle(s) for the plugin.

To watch for code changes and rebuild the plugin automatically:

```
$ npm run watch
```

### Install the plugin

1. In the Figma desktop app, open a Figma document.
2. Search for and run `Import plugin from manifest…` via the Quick Actions search bar.
3. Select the `manifest.json` file that was generated by the `build` script.

### Debugging

Use `console.log` statements to inspect values in your code.

To open the developer console, search for and run `Show/Hide Console` via the Quick Actions search bar.

## See also

- [Create Figma Plugin docs](https://yuanqing.github.io/create-figma-plugin/)
- [`yuanqing/figma-plugins`](https://github.com/yuanqing/figma-plugins#readme)

Official docs and code samples from Figma:

- [Plugin API docs](https://figma.com/plugin-docs/)
- [`figma/plugin-samples`](https://github.com/figma/plugin-samples#readme)

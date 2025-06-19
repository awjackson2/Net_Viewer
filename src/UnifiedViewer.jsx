import React, { useEffect, useState, useRef } from 'react';

export default function UnifiedViewer({ electrodeState }) {
  const [dots, setDots] = useState([]);
  const [jsonDots, setJsonDots] = useState([]);
  const [availableElectrodes, setAvailableElectrodes] = useState(new Set());
  const [, forceUpdate] = useState({});
  
  // 3D Projection map zoom/pan state
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [lastMouse, setLastMouse] = useState(null);
  const [dragStart, setDragStart] = useState(null);
  const svgRef = useRef();
  
  // JSON Reference map zoom/pan state
  const [jsonZoom, setJsonZoom] = useState(0.8);
  const [jsonOffset, setJsonOffset] = useState({ x: 0, y: -20 });
  const [jsonDragging, setJsonDragging] = useState(false);
  const [jsonDragOccurred, setJsonDragOccurred] = useState(false);
  const [jsonLastMouse, setJsonLastMouse] = useState(null);
  const [jsonDragStart, setJsonDragStart] = useState(null);
  const jsonSvgRef = useRef();
  
  // Fullscreen SVG refs
  const fullscreenSvgRef = useRef();
  const fullscreenJsonSvgRef = useRef();
  
  // Hover state for JSON reference map
  const [hoveredElectrode, setHoveredElectrode] = useState(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  
  // Fullscreen state for 2D viewers
  const [is3DProjectionFullscreen, setIs3DProjectionFullscreen] = useState(false);
  const [isJsonReferenceFullscreen, setIsJsonReferenceFullscreen] = useState(false);

  // Label visibility state
  const [showAllLabels, setShowAllLabels] = useState(true);

  // Dynamic height state
  const [dynamicHeight, setDynamicHeight] = useState(440);

  // Constants for 2D layout
  const WIDTH = 440;
  const HEIGHT = 440;
  const DOT_RADIUS = 7.5;
  const DRAG_THRESHOLD = 5; // pixels

  // Calculate dynamic height based on screen size
  const calculateDynamicHeight = () => {
    const screenHeight = window.innerHeight;
    const availableHeight = screenHeight - 40; // Account for top/bottom margins
    const minHeight = 200; // Minimum height for each SVG
    const maxHeight = Math.min(HEIGHT, (availableHeight - 120) / 2); // Account for other UI elements
    return Math.max(minHeight, maxHeight);
  };

  const CENTER_X = WIDTH / 2;
  const CENTER_Y = dynamicHeight / 2;

  // Load electrode coordinates from 3D projection
  useEffect(() => {
    const newDots = [];
    
    // Listen for projected coordinates from 3D scene
    const handleProjectionUpdate = (event) => {
      const screenPositions = event.detail;
      const newDots = Object.entries(screenPositions).map(([electrodeName, coords], index) => ({
        id: index + 1,
        name: electrodeName,
        x: coords.x * WIDTH,
        y: coords.y * HEIGHT,
      }));
      setDots(newDots);
    };

    window.addEventListener('projectedElectrodeCoords', handleProjectionUpdate);
    
    return () => {
      window.removeEventListener('projectedElectrodeCoords', handleProjectionUpdate);
    };
  }, []);

  // Load electrode coordinates from JSON file for second map
  useEffect(() => {
    fetch('electrodes_projected.json')
      .then(response => response.json())
      .then(data => {
        const newJsonDots = Object.entries(data).map(([electrodeName, coords], index) => ({
          id: index + 1,
          name: electrodeName,
          x: coords.x * WIDTH,
          y: coords.y * HEIGHT,
        }));
        setJsonDots(newJsonDots);
      })
      .catch(error => {
        console.error('Error loading JSON coordinates:', error);
      });
  }, []);

  // Listen for state changes
  useEffect(() => {
    const handleStateChange = () => forceUpdate({});
    window.addEventListener('electrodeStateChanged', handleStateChange);
    return () => window.removeEventListener('electrodeStateChanged', handleStateChange);
  }, []);

  // Listen for available electrodes update
  useEffect(() => {
    const handleAvailableElectrodes = (event) => {
      setAvailableElectrodes(new Set(event.detail));
    };
    window.addEventListener('availableElectrodesUpdate', handleAvailableElectrodes);
    return () => window.removeEventListener('availableElectrodesUpdate', handleAvailableElectrodes);
  }, []);

  // Handle window resize for dynamic height calculation
  useEffect(() => {
    const handleResize = () => {
      setDynamicHeight(calculateDynamicHeight());
    };
    
    // Set initial height
    setDynamicHeight(calculateDynamicHeight());
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // --- 3D Projection Map Zoom and Pan Handlers ---
  const handleWheel = (e) => {
    e.preventDefault();
    const scaleAmount = e.deltaY < 0 ? 1.1 : 0.9;
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    // Convert mouse to SVG coords
    const svgX = (mouseX - offset.x - CENTER_X) / zoom;
    const svgY = (mouseY - offset.y - CENTER_Y) / zoom;
    // New zoom
    const newZoom = Math.max(0.2, Math.min(zoom * scaleAmount, 10));
    // Adjust offset so zoom is centered on mouse
    const newOffset = {
      x: offset.x - (svgX * (newZoom - zoom)),
      y: offset.y - (svgY * (newZoom - zoom)),
    };
    setZoom(newZoom);
    setOffset(newOffset);
  };

  const handleMouseDown = (e) => {
    setDragStart({ x: e.clientX, y: e.clientY });
    setLastMouse({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e) => {
    if (!dragStart) return;
    
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance > DRAG_THRESHOLD) {
      setDragging(true);
    }
    
    if (dragging) {
      const dx = e.clientX - lastMouse.x;
      const dy = e.clientY - lastMouse.y;
      setOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
      setLastMouse({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseUp = () => {
    setDragging(false);
    setDragStart(null);
  };

  // --- JSON Reference Map Zoom and Pan Handlers ---
  const handleJsonWheel = (e) => {
    e.preventDefault();
    const scaleAmount = e.deltaY < 0 ? 1.1 : 0.9;
    const rect = jsonSvgRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    // Convert mouse to SVG coords
    const svgX = (mouseX - jsonOffset.x - CENTER_X) / jsonZoom;
    const svgY = (mouseY - jsonOffset.y - CENTER_Y) / jsonZoom;
    // New zoom
    const newZoom = Math.max(0.2, Math.min(jsonZoom * scaleAmount, 10));
    // Adjust offset so zoom is centered on mouse
    const newOffset = {
      x: jsonOffset.x - (svgX * (newZoom - jsonZoom)),
      y: jsonOffset.y - (svgY * (newZoom - jsonZoom)),
    };
    setJsonZoom(newZoom);
    setJsonOffset(newOffset);
  };

  const handleJsonMouseDown = (e) => {
    e.stopPropagation();
    setJsonDragStart({ x: e.clientX, y: e.clientY });
    setJsonLastMouse({ x: e.clientX, y: e.clientY });
  };

  const handleJsonMouseMove = (e) => {
    if (!jsonDragStart) return;
    
    const dx = e.clientX - jsonDragStart.x;
    const dy = e.clientY - jsonDragStart.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance > DRAG_THRESHOLD) {
      setJsonDragging(true);
      setJsonDragOccurred(true);
    }
    
    if (jsonDragging) {
      const dx = e.clientX - jsonLastMouse.x;
      const dy = e.clientY - jsonLastMouse.y;
      setJsonOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
      setJsonLastMouse({ x: e.clientX, y: e.clientY });
    }
    
    // Update mouse position for hover tooltip
    if (hoveredElectrode) {
      setMousePosition({ x: e.clientX, y: e.clientY });
    }
  };

  const handleJsonMouseUp = (e) => {
    if (jsonDragStart) {
      setJsonDragging(false);
      setJsonDragStart(null);
    }
  };

  // Set up event listeners for 3D projection map zoom and pan
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = svgRef.current;
    svg.addEventListener('wheel', handleWheel, { passive: false });
    svg.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      svg.removeEventListener('wheel', handleWheel);
      svg.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  });

  // Set up event listeners for JSON reference map zoom and pan
  useEffect(() => {
    if (!jsonSvgRef.current) return;
    const svg = jsonSvgRef.current;
    svg.addEventListener('wheel', handleJsonWheel, { passive: false });
    svg.addEventListener('mousedown', handleJsonMouseDown);
    window.addEventListener('mousemove', handleJsonMouseMove);
    window.addEventListener('mouseup', handleJsonMouseUp);
    
    // Add a global mouseup handler to ensure dragging stops
    const globalMouseUp = () => {
      if (jsonDragStart) {
        setJsonDragging(false);
        setJsonDragStart(null);
        // Keep jsonDragOccurred state for click detection
      }
    };
    document.addEventListener('mouseup', globalMouseUp);
    
    return () => {
      svg.removeEventListener('wheel', handleJsonWheel);
      svg.removeEventListener('mousedown', handleJsonMouseDown);
      window.removeEventListener('mousemove', handleJsonMouseMove);
      window.removeEventListener('mouseup', handleJsonMouseUp);
      document.removeEventListener('mouseup', globalMouseUp);
    };
  });

  // Set up event listeners for fullscreen 3D projection map
  useEffect(() => {
    if (!fullscreenSvgRef.current || !is3DProjectionFullscreen) return;
    const svg = fullscreenSvgRef.current;
    svg.addEventListener('wheel', handleFullscreenWheel, { passive: false });
    svg.addEventListener('mousedown', handleFullscreenMouseDown);
    window.addEventListener('mousemove', handleFullscreenMouseMove);
    window.addEventListener('mouseup', handleFullscreenMouseUp);
    return () => {
      svg.removeEventListener('wheel', handleFullscreenWheel);
      svg.removeEventListener('mousedown', handleFullscreenMouseDown);
      window.removeEventListener('mousemove', handleFullscreenMouseMove);
      window.removeEventListener('mouseup', handleFullscreenMouseUp);
    };
  }, [is3DProjectionFullscreen]);

  // Set up event listeners for fullscreen JSON reference map
  useEffect(() => {
    if (!fullscreenJsonSvgRef.current || !isJsonReferenceFullscreen) return;
    const svg = fullscreenJsonSvgRef.current;
    svg.addEventListener('wheel', handleFullscreenJsonWheel, { passive: false });
    svg.addEventListener('mousedown', handleFullscreenJsonMouseDown);
    window.addEventListener('mousemove', handleFullscreenJsonMouseMove);
    window.addEventListener('mouseup', handleFullscreenJsonMouseUp);
    
    // Add a global mouseup handler to ensure dragging stops
    const globalMouseUp = () => {
      if (jsonDragStart) {
        setJsonDragging(false);
        setJsonDragStart(null);
        // Keep jsonDragOccurred state for click detection
      }
    };
    document.addEventListener('mouseup', globalMouseUp);
    
    return () => {
      svg.removeEventListener('wheel', handleFullscreenJsonWheel);
      svg.removeEventListener('mousedown', handleFullscreenJsonMouseDown);
      window.removeEventListener('mousemove', handleFullscreenJsonMouseMove);
      window.removeEventListener('mouseup', handleFullscreenJsonMouseUp);
      document.removeEventListener('mouseup', globalMouseUp);
    };
  }, [isJsonReferenceFullscreen]);

  // Initialize fullscreen viewBox when 3D projection opens
  useEffect(() => {
    if (is3DProjectionFullscreen && fullscreenSvgRef.current && dots.length > 0) {
      const svg = fullscreenSvgRef.current;
      const { svgWidth, svgHeight } = getFullscreenDimensions();
      
      // Simple centering: set viewBox to show the full content area
      const contentBounds = {
        minX: Math.min(...dots.map(d => d.x)),
        maxX: Math.max(...dots.map(d => d.x)),
        minY: Math.min(...dots.map(d => d.y)),
        maxY: Math.max(...dots.map(d => d.y))
      };
      
      // Add some padding around the content
      const padding = 50;
      const viewBoxX = contentBounds.minX - padding;
      const viewBoxY = contentBounds.minY - padding;
      const viewBoxWidth = (contentBounds.maxX - contentBounds.minX) + 2 * padding;
      const viewBoxHeight = (contentBounds.maxY - contentBounds.minY) + 2 * padding;
      
      svg.setAttribute('viewBox', `${viewBoxX} ${viewBoxY} ${viewBoxWidth} ${viewBoxHeight}`);
    }
  }, [is3DProjectionFullscreen, dots]);

  // Initialize fullscreen viewBox when JSON reference opens
  useEffect(() => {
    if (isJsonReferenceFullscreen && fullscreenJsonSvgRef.current && jsonDots.length > 0) {
      const svg = fullscreenJsonSvgRef.current;
      const { svgWidth, svgHeight } = getFullscreenDimensions();
      
      // Simple centering: set viewBox to show the full content area
      const contentBounds = {
        minX: Math.min(...jsonDots.map(d => d.x)),
        maxX: Math.max(...jsonDots.map(d => d.x)),
        minY: Math.min(...jsonDots.map(d => d.y)),
        maxY: Math.max(...jsonDots.map(d => d.y))
      };
      
      // Add some padding around the content
      const padding = 50;
      const viewBoxX = contentBounds.minX - padding;
      const viewBoxY = contentBounds.minY - padding;
      const viewBoxWidth = (contentBounds.maxX - contentBounds.minX) + 2 * padding;
      const viewBoxHeight = (contentBounds.maxY - contentBounds.minY) + 2 * padding;
      
      svg.setAttribute('viewBox', `${viewBoxX} ${viewBoxY} ${viewBoxWidth} ${viewBoxHeight}`);
    }
  }, [isJsonReferenceFullscreen, jsonDots]);

  // Get color for dot based on group membership and availability
  const getDotColor = (dot) => {
    // Check if electrode is selected in any group
    for (let i = 0; i < electrodeState.selectedGroups.length; i++) {
      if (electrodeState.selectedGroups[i].some(d => d.name === dot.name)) {
        return getPairColor(i);
      }
    }
    
    // Check if electrode is available in 3D model
    const isAvailable = availableElectrodes.has(dot.name);
    
    if (!isAvailable) {
      return 'rgba(204, 204, 204, 0.7)'; // Semi-transparent gray for unavailable electrodes
    }
    
    return electrodeState.currentGroup === electrodeState.selectedGroups.findIndex(group => group.length < electrodeState.groupSize)
      ? 'rgba(119, 119, 119, 0.7)' // Semi-transparent gray for available electrodes
      : 'rgba(85, 85, 85, 0.7)'; // Semi-transparent dark gray for other electrodes
  };
  
  const getPairColor = (index) => [
    'rgba(255, 51, 51, 0.8)',   // Semi-transparent red
    'rgba(51, 204, 51, 0.8)',   // Semi-transparent green
    'rgba(51, 102, 255, 0.8)',  // Semi-transparent blue
    'rgba(255, 204, 0, 0.8)'    // Semi-transparent yellow
  ][index % 4];
  
  const handleDotClick = (dot, isDragging) => {
    // Prevent selection if dragging occurred
    if (isDragging) {
      return;
    }
    
    console.log(`Selecting electrode ${dot.name} from 2D map`);
    
    if (electrodeState.onElectrodeSelect) {
      electrodeState.onElectrodeSelect(dot.name);
    }
  };

  // Handle search bar electrode addition
  const [searchValue, setSearchValue] = useState('');
  const [searchError, setSearchError] = useState('');
  
  const handleAddElectrode = () => {
    if (!searchValue.trim()) return;
    
    // Clear any previous errors
    setSearchError('');
    
    let electrodeName = searchValue.trim();
    
    // Handle different input formats
    if (electrodeName.startsWith('E')) {
      // Format: 'E002' -> 'E002'
      electrodeName = electrodeName.toUpperCase();
    } else {
      // Format: '2' or '002' -> 'E002'
      const number = parseInt(electrodeName);
      if (isNaN(number) || number < 1 || number > 256) {
        setSearchError('Please enter a valid electrode number (1-256)');
        return;
      }
      electrodeName = `E${number.toString().padStart(3, '0')}`;
    }
    
    console.log('Attempting to add electrode:', electrodeName);
    console.log('Available electrodes count:', availableElectrodes.size);
    
    // Check if electrode is available (only if we have available electrodes data)
    if (availableElectrodes.size > 0 && !availableElectrodes.has(electrodeName)) {
      setSearchError(`Electrode ${electrodeName} is not available in the 3D model`);
      return;
    }
    
    // Add the electrode
    if (electrodeState.onElectrodeSelect) {
      console.log('Adding electrode:', electrodeName);
      electrodeState.onElectrodeSelect(electrodeName);
      setSearchValue(''); // Clear the search bar
      setSearchError(''); // Clear any errors
    } else {
      console.log('onElectrodeSelect is not available');
    }
  };

  const handleSearchKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleAddElectrode();
    }
  };

  const handleSearchChange = (e) => {
    const value = e.target.value;
    console.log('Input changed:', value);
    setSearchValue(value);
    // Clear error when user starts typing
    if (searchError) {
      setSearchError('');
    }
  };

  // Hover handlers for JSON reference map
  const handleJsonElectrodeMouseEnter = (dot, e) => {
    setHoveredElectrode(dot);
    setMousePosition({ x: e.clientX, y: e.clientY });
  };

  const handleJsonElectrodeMouseLeave = () => {
    setHoveredElectrode(null);
  };

  // Fullscreen toggle functions
  const toggle3DProjectionFullscreen = () => {
    setIs3DProjectionFullscreen(!is3DProjectionFullscreen);
    setIsJsonReferenceFullscreen(false); // Close other fullscreen
    
    // Reset zoom and offset for fullscreen
    if (!is3DProjectionFullscreen) {
      setZoom(1);
      setOffset({ x: 0, y: 0 });
    } else {
      // Recenter when exiting fullscreen
      setZoom(1);
      setOffset({ x: 0, y: 0 });
    }
  };

  const toggleJsonReferenceFullscreen = () => {
    setIsJsonReferenceFullscreen(!isJsonReferenceFullscreen);
    setIs3DProjectionFullscreen(false); // Close other fullscreen
    
    // Reset zoom and offset for fullscreen
    if (!isJsonReferenceFullscreen) {
      setJsonZoom(0.8);
      setJsonOffset({ x: 0, y: -20 });
    } else {
      // Recenter when exiting fullscreen
      setJsonZoom(0.8);
      setJsonOffset({ x: 0, y: -20 });
    }
  };

  // Calculate fullscreen dimensions and transforms
  const getFullscreenDimensions = () => {
    const modalWidth = window.innerWidth * 0.9 - 40; // 90vw - padding
    const modalHeight = window.innerHeight * 0.9 - 40; // 90vh - padding
    const svgWidth = modalWidth - 40; // Account for container padding
    const svgHeight = modalHeight - 70; // Account for header and padding
    
    return { svgWidth, svgHeight, modalWidth, modalHeight };
  };

  const getFullscreenTransform = (svgWidth, svgHeight) => {
    const centerX = svgWidth / 2;
    const centerY = svgHeight / 2;
    return { centerX, centerY };
  };

  // Fullscreen zoom and pan handlers - NEW METHOD
  const handleFullscreenWheel = (e) => {
    e.preventDefault();
    
    // Get the SVG element and its current viewBox
    const svg = fullscreenSvgRef.current;
    const rect = svg.getBoundingClientRect();
    
    // Calculate mouse position relative to SVG
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // Get current viewBox or create one if it doesn't exist
    let currentViewBox = svg.viewBox.baseVal;
    if (!currentViewBox || currentViewBox.width === 0) {
      // Initialize viewBox to show all content with padding
      const contentBounds = {
        minX: Math.min(...dots.map(d => d.x)),
        maxX: Math.max(...dots.map(d => d.x)),
        minY: Math.min(...dots.map(d => d.y)),
        maxY: Math.max(...dots.map(d => d.y))
      };
      const padding = 50;
      const viewBoxX = contentBounds.minX - padding;
      const viewBoxY = contentBounds.minY - padding;
      const viewBoxWidth = (contentBounds.maxX - contentBounds.minX) + 2 * padding;
      const viewBoxHeight = (contentBounds.maxY - contentBounds.minY) + 2 * padding;
      svg.setAttribute('viewBox', `${viewBoxX} ${viewBoxY} ${viewBoxWidth} ${viewBoxHeight}`);
      currentViewBox = svg.viewBox.baseVal;
    }
    
    // Calculate zoom factor
    const zoomFactor = e.deltaY < 0 ? 0.9 : 1.1; // Zoom in/out factor
    
    // Calculate new viewBox dimensions
    const newWidth = currentViewBox.width * zoomFactor;
    const newHeight = currentViewBox.height * zoomFactor;
    
    // Calculate the point to zoom around (mouse position in viewBox coordinates)
    const viewBoxX = currentViewBox.x + (mouseX / rect.width) * currentViewBox.width;
    const viewBoxY = currentViewBox.y + (mouseY / rect.height) * currentViewBox.height;
    
    // Calculate new viewBox position to keep mouse point in same relative position
    const newX = viewBoxX - (mouseX / rect.width) * newWidth;
    const newY = viewBoxY - (mouseY / rect.height) * newHeight;
    
    // Apply new viewBox
    svg.setAttribute('viewBox', `${newX} ${newY} ${newWidth} ${newHeight}`);
  };

  const handleFullscreenJsonWheel = (e) => {
    e.preventDefault();
    
    // Get the SVG element and its current viewBox
    const svg = fullscreenJsonSvgRef.current;
    const rect = svg.getBoundingClientRect();
    
    // Calculate mouse position relative to SVG
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // Get current viewBox or create one if it doesn't exist
    let currentViewBox = svg.viewBox.baseVal;
    if (!currentViewBox || currentViewBox.width === 0) {
      // Initialize viewBox to show all content with padding
      const contentBounds = {
        minX: Math.min(...jsonDots.map(d => d.x)),
        maxX: Math.max(...jsonDots.map(d => d.x)),
        minY: Math.min(...jsonDots.map(d => d.y)),
        maxY: Math.max(...jsonDots.map(d => d.y))
      };
      const padding = 50;
      const viewBoxX = contentBounds.minX - padding;
      const viewBoxY = contentBounds.minY - padding;
      const viewBoxWidth = (contentBounds.maxX - contentBounds.minX) + 2 * padding;
      const viewBoxHeight = (contentBounds.maxY - contentBounds.minY) + 2 * padding;
      svg.setAttribute('viewBox', `${viewBoxX} ${viewBoxY} ${viewBoxWidth} ${viewBoxHeight}`);
      currentViewBox = svg.viewBox.baseVal;
    }
    
    // Calculate zoom factor
    const zoomFactor = e.deltaY < 0 ? 0.9 : 1.1; // Zoom in/out factor
    
    // Calculate new viewBox dimensions
    const newWidth = currentViewBox.width * zoomFactor;
    const newHeight = currentViewBox.height * zoomFactor;
    
    // Calculate the point to zoom around (mouse position in viewBox coordinates)
    const viewBoxX = currentViewBox.x + (mouseX / rect.width) * currentViewBox.width;
    const viewBoxY = currentViewBox.y + (mouseY / rect.height) * currentViewBox.height;
    
    // Calculate new viewBox position to keep mouse point in same relative position
    const newX = viewBoxX - (mouseX / rect.width) * newWidth;
    const newY = viewBoxY - (mouseY / rect.height) * newHeight;
    
    // Apply new viewBox
    svg.setAttribute('viewBox', `${newX} ${newY} ${newWidth} ${newHeight}`);
  };

  // Fullscreen drag handlers
  const handleFullscreenMouseDown = (e) => {
    setDragStart({ x: e.clientX, y: e.clientY });
    setLastMouse({ x: e.clientX, y: e.clientY });
  };

  const handleFullscreenMouseMove = (e) => {
    if (!dragStart) return;
    
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance > DRAG_THRESHOLD) {
      setDragging(true);
    }
    
    if (dragging) {
      const svg = fullscreenSvgRef.current;
      if (svg) {
        const currentViewBox = svg.viewBox.baseVal;
        const dx = e.clientX - lastMouse.x;
        const dy = e.clientY - lastMouse.y;
        
        // Convert screen movement to viewBox movement
        const svgRect = svg.getBoundingClientRect();
        const viewBoxToScreenRatioX = currentViewBox.width / svgRect.width;
        const viewBoxToScreenRatioY = currentViewBox.height / svgRect.height;
        
        const newX = currentViewBox.x - (dx * viewBoxToScreenRatioX);
        const newY = currentViewBox.y - (dy * viewBoxToScreenRatioY);
        
        svg.setAttribute('viewBox', `${newX} ${newY} ${currentViewBox.width} ${currentViewBox.height}`);
      }
      setLastMouse({ x: e.clientX, y: e.clientY });
    }
  };

  const handleFullscreenMouseUp = () => {
    setDragging(false);
    setDragStart(null);
  };

  const handleFullscreenJsonMouseDown = (e) => {
    e.stopPropagation();
    setJsonDragStart({ x: e.clientX, y: e.clientY });
    setJsonLastMouse({ x: e.clientX, y: e.clientY });
  };

  const handleFullscreenJsonMouseMove = (e) => {
    if (!jsonDragStart) return;
    
    const dx = e.clientX - jsonDragStart.x;
    const dy = e.clientY - jsonDragStart.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance > DRAG_THRESHOLD) {
      setJsonDragging(true);
      setJsonDragOccurred(true);
    }
    
    if (jsonDragging) {
      const svg = fullscreenJsonSvgRef.current;
      if (svg) {
        const currentViewBox = svg.viewBox.baseVal;
        const dx = e.clientX - jsonLastMouse.x;
        const dy = e.clientY - jsonLastMouse.y;
        
        // Convert screen movement to viewBox movement
        const svgRect = svg.getBoundingClientRect();
        const viewBoxToScreenRatioX = currentViewBox.width / svgRect.width;
        const viewBoxToScreenRatioY = currentViewBox.height / svgRect.height;
        
        const newX = currentViewBox.x - (dx * viewBoxToScreenRatioX);
        const newY = currentViewBox.y - (dy * viewBoxToScreenRatioY);
        
        svg.setAttribute('viewBox', `${newX} ${newY} ${currentViewBox.width} ${currentViewBox.height}`);
      }
      setJsonLastMouse({ x: e.clientX, y: e.clientY });
    }
    
    // Update mouse position for hover tooltip
    if (hoveredElectrode) {
      setMousePosition({ x: e.clientX, y: e.clientY });
    }
  };

  const handleFullscreenJsonMouseUp = (e) => {
    if (jsonDragStart) {
      setJsonDragging(false);
      setJsonDragStart(null);
    }
  };

  return (
    <>
      <div style={{
        position: 'absolute',
        top: 20,
        right: 20,
        width: WIDTH,
        maxHeight: 'calc(100vh - 40px)', // Ensure it doesn't exceed screen height
        background: 'rgba(255,255,255,0.92)',
        border: '1px solid #d1d5db',
        borderRadius: 8,
        boxShadow: '0 2px 10px rgba(0,0,0,0.08)',
        zIndex: 10,
        padding: 10,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        overflow: 'auto', // Allow scrolling if content is too tall
        scrollbarWidth: 'thin', // For Firefox
        scrollbarColor: 'rgba(0,0,0,0.3) transparent', // For Firefox
      }}>
        <style>
          {`
            div::-webkit-scrollbar {
              width: 8px;
            }
            div::-webkit-scrollbar-track {
              background: transparent;
            }
            div::-webkit-scrollbar-thumb {
              background: rgba(0,0,0,0.3);
              border-radius: 4px;
            }
            div::-webkit-scrollbar-thumb:hover {
              background: rgba(0,0,0,0.5);
            }
          `}
        </style>
        {/* Search Bar */}
        <div style={{ 
          display: 'flex', 
          gap: '8px', 
          alignItems: 'center',
          padding: '8px',
          background: '#f8f9fa',
          borderRadius: '6px',
          border: '1px solid #e9ecef'
        }}>
          <input
            type="text"
            value={searchValue}
            onChange={handleSearchChange}
            onKeyPress={handleSearchKeyPress}
            placeholder="Enter electrode (E002, 2, 002)"
            style={{
              flex: 1,
              padding: '6px 10px',
              border: searchError ? '1px solid #dc3545' : '1px solid #ced4da',
              borderRadius: '4px',
              fontSize: '12px',
              backgroundColor: searchError ? '#fff5f5' : 'white'
            }}
          />
          <button
            onClick={() => {
              console.log('Add button clicked, searchValue:', searchValue);
              handleAddElectrode();
            }}
            style={{
              padding: '6px 12px',
              background: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 'bold'
            }}
            onMouseOver={(e) => e.target.style.background = '#0056b3'}
            onMouseOut={(e) => e.target.style.background = '#007bff'}
          >
            Add
          </button>
        </div>

        {/* Label Toggle */}
        <div style={{ 
          display: 'flex', 
          gap: '8px', 
          alignItems: 'center',
          padding: '6px 8px',
          background: '#f8f9fa',
          borderRadius: '6px',
          border: '1px solid #e9ecef'
        }}>
          <span style={{ fontSize: '12px', fontWeight: 'bold' }}>Labels:</span>
          <button
            onClick={() => setShowAllLabels(!showAllLabels)}
            style={{
              padding: '4px 8px',
              background: showAllLabels ? '#28a745' : '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '10px',
              fontWeight: 'bold'
            }}
          >
            {showAllLabels ? 'All' : 'Selected Only'}
          </button>
        </div>

        {/* Error Message */}
        {searchError && (
          <div style={{ 
            color: '#dc3545', 
            fontSize: '11px', 
            padding: '6px 8px',
            background: '#f8d7da',
            border: '1px solid #f5c6cb',
            borderRadius: '4px',
            margin: '0 2px'
          }}>
            ⚠️ {searchError}
          </div>
        )}

        {/* 3D Projection Map */}
        <div style={{ 
          textAlign: 'center', 
          fontWeight: 'bold', 
          fontSize: '12px', 
          marginBottom: '5px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>3D Map</span>
          <button
            onClick={toggle3DProjectionFullscreen}
            style={{
              padding: '4px 8px',
              background: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '10px',
              fontWeight: 'bold'
            }}
          >
            Fullscreen
          </button>
        </div>
        <svg 
          ref={svgRef}
          width={WIDTH} 
          height={dynamicHeight}
          style={{ 
            cursor: dragging ? 'grabbing' : 'grab',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            MozUserSelect: 'none',
            msUserSelect: 'none',
            border: '1px solid #ddd',
            borderRadius: '4px'
          }}
        >
          <g transform={`translate(${CENTER_X + offset.x},${CENTER_Y + offset.y}) scale(${zoom})`}>
            {electrodeState.selectedGroups.map((group, groupIndex) =>
              group.map((dot, dotIndex) =>
                group.slice(dotIndex + 1).map((otherDot, otherIndex) => {
                  const dot1 = dots.find(d => d.name === dot.name);
                  const dot2 = dots.find(d => d.name === otherDot.name);
                  if (dot1 && dot2) {
                    return (
                      <line key={`group-${groupIndex}-${dotIndex}-${otherIndex}`}
                        x1={dot1.x - CENTER_X} 
                        y1={dot1.y - CENTER_Y} 
                        x2={dot2.x - CENTER_X} 
                        y2={dot2.y - CENTER_Y}
                        stroke={getPairColor(groupIndex)} 
                        strokeWidth="2" />
                    );
                  }
                  return null;
                })
              )
            ).flat(2)}
            {dots.map((dot) => (
              <g key={dot.id} onClick={(e) => handleDotClick(dot, dragging)}>
                <circle 
                  cx={dot.x - CENTER_X} 
                  cy={dot.y - CENTER_Y} 
                  r={DOT_RADIUS} 
                  fill={getDotColor(dot)} 
                  stroke="#000" 
                  strokeWidth="0.5" 
                  style={{
                    cursor: 'pointer',
                    opacity: 1
                  }} 
                />
                {/* Show text for selected electrodes always, and for all electrodes if toggle is on */}
                {(showAllLabels || electrodeState.selectedGroups.some(group => group.some(d => d.name === dot.name))) && (
                  <text 
                    x={dot.x - CENTER_X} 
                    y={dot.y - CENTER_Y + 2} 
                    textAnchor="middle" 
                    fontSize="5" 
                    fill="#333"
                    style={{
                      userSelect: 'none',
                      WebkitUserSelect: 'none',
                      MozUserSelect: 'none',
                      msUserSelect: 'none',
                      pointerEvents: 'none'
                    }}
                  >
                    {dot.name}
                  </text>
                )}
              </g>
            ))}
          </g>
        </svg>

        {/* JSON Reference Map */}
        <div style={{ 
          textAlign: 'center', 
          fontWeight: 'bold', 
          fontSize: '12px', 
          marginBottom: '5px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>2D Map</span>
          <button
            onClick={toggleJsonReferenceFullscreen}
            style={{
              padding: '4px 8px',
              background: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '10px',
              fontWeight: 'bold'
            }}
          >
            Fullscreen
          </button>
        </div>
        <svg 
          ref={jsonSvgRef}
          width={WIDTH} 
          height={dynamicHeight}
          style={{ 
            border: '1px solid #ddd', 
            borderRadius: '4px',
            cursor: jsonDragging ? 'grabbing' : 'grab',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            MozUserSelect: 'none',
            msUserSelect: 'none'
          }}
        >
          <g transform={`translate(${CENTER_X + jsonOffset.x},${CENTER_Y + jsonOffset.y}) scale(${jsonZoom})`}>
            {electrodeState.selectedGroups.map((group, groupIndex) =>
              group.map((dot, dotIndex) =>
                group.slice(dotIndex + 1).map((otherDot, otherIndex) => {
                  const dot1 = jsonDots.find(d => d.name === dot.name);
                  const dot2 = jsonDots.find(d => d.name === otherDot.name);
                  if (dot1 && dot2) {
                    return (
                      <line key={`json-group-${groupIndex}-${dotIndex}-${otherIndex}`}
                        x1={dot1.x - CENTER_X} 
                        y1={dot1.y - CENTER_Y} 
                        x2={dot2.x - CENTER_X} 
                        y2={dot2.y - CENTER_Y}
                        stroke={getPairColor(groupIndex)} 
                        strokeWidth="2" />
                    );
                  }
                  return null;
                })
              )
            ).flat(2)}
            {jsonDots.map((dot) => (
              <g key={`json-${dot.id}`} onClick={(e) => handleDotClick(dot, jsonDragging)}>
                <circle 
                  cx={dot.x - CENTER_X} 
                  cy={dot.y - CENTER_Y} 
                  r={DOT_RADIUS} 
                  fill={getDotColor(dot)} 
                  stroke="#000" 
                  strokeWidth="0.5" 
                  style={{
                    cursor: 'pointer',
                    opacity: 1
                  }}
                  onMouseEnter={(e) => handleJsonElectrodeMouseEnter(dot, e)}
                  onMouseLeave={handleJsonElectrodeMouseLeave}
                />
                {/* Show text for selected electrodes always, and for all electrodes if toggle is on */}
                {(showAllLabels || electrodeState.selectedGroups.some(group => group.some(d => d.name === dot.name))) && (
                  <text 
                    x={dot.x - CENTER_X} 
                    y={dot.y - CENTER_Y + 2} 
                    textAnchor="middle" 
                    fontSize="5" 
                    fill="#333"
                    style={{
                      userSelect: 'none',
                      WebkitUserSelect: 'none',
                      MozUserSelect: 'none',
                      msUserSelect: 'none',
                      pointerEvents: 'none'
                    }}
                  >
                    {dot.name}
                  </text>
                )}
              </g>
            ))}
          </g>
        </svg>
      </div>

      {/* Hover Tooltip for JSON Reference Map */}
      {hoveredElectrode && (
        <div
          style={{
            position: 'fixed',
            left: mousePosition.x + 10,
            top: mousePosition.y - 30,
            background: 'rgba(0, 0, 0, 0.8)',
            color: 'white',
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: 'bold',
            pointerEvents: 'none',
            zIndex: 1000,
            whiteSpace: 'nowrap'
          }}
        >
          {hoveredElectrode.name}
        </div>
      )}

      {/* Fullscreen Modal for 3D Projection */}
      {is3DProjectionFullscreen && (() => {
        const { svgWidth, svgHeight, modalWidth, modalHeight } = getFullscreenDimensions();
        const { centerX, centerY } = getFullscreenTransform(svgWidth, svgHeight);
        
        return (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100vw',
              height: '100vh',
              background: 'rgba(0, 0, 0, 0.95)',
              zIndex: 9999,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px'
            }}
          >
            <div style={{
              background: 'white',
              borderRadius: '8px',
              padding: '20px',
              width: modalWidth,
              height: modalHeight,
              display: 'flex',
              flexDirection: 'column',
              position: 'relative'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '10px'
              }}>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>
                  3D Projection (Live) - Fullscreen
                </h3>
                <button
                  onClick={toggle3DProjectionFullscreen}
                  style={{
                    padding: '8px 16px',
                    background: '#dc3545',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 'bold'
                  }}
                >
                  ✕ Close
                </button>
              </div>
              <svg 
                ref={fullscreenSvgRef}
                width={svgWidth} 
                height={svgHeight}
                style={{ 
                  cursor: dragging ? 'grabbing' : 'grab',
                  userSelect: 'none',
                  WebkitUserSelect: 'none',
                  MozUserSelect: 'none',
                  msUserSelect: 'none',
                  border: '1px solid #ddd',
                  borderRadius: '4px'
                }}
              >
                {electrodeState.selectedGroups.map((group, groupIndex) =>
                  group.map((dot, dotIndex) =>
                    group.slice(dotIndex + 1).map((otherDot, otherIndex) => {
                      const dot1 = dots.find(d => d.name === dot.name);
                      const dot2 = dots.find(d => d.name === otherDot.name);
                      if (dot1 && dot2) {
                        return (
                          <line key={`group-${groupIndex}-${dotIndex}-${otherIndex}`}
                            x1={dot1.x} 
                            y1={dot1.y} 
                            x2={dot2.x} 
                            y2={dot2.y}
                            stroke={getPairColor(groupIndex)} 
                            strokeWidth="2" />
                        );
                      }
                      return null;
                    })
                  )
                ).flat(2)}
                {dots.map((dot) => (
                  <g key={dot.id} onClick={(e) => handleDotClick(dot, dragging)}>
                    <circle 
                      cx={dot.x} 
                      cy={dot.y} 
                      r={DOT_RADIUS} 
                      fill={getDotColor(dot)} 
                      stroke="#000" 
                      strokeWidth="0.5" 
                      style={{
                        cursor: 'pointer',
                        opacity: 1
                      }} 
                    />
                    {/* Show text for selected electrodes always, and for all electrodes if toggle is on */}
                    {(showAllLabels || electrodeState.selectedGroups.some(group => group.some(d => d.name === dot.name))) && (
                      <text 
                        x={dot.x} 
                        y={dot.y + 2} 
                        textAnchor="middle" 
                        fontSize="5" 
                        fill="#333"
                        style={{
                          userSelect: 'none',
                          WebkitUserSelect: 'none',
                          MozUserSelect: 'none',
                          msUserSelect: 'none',
                          pointerEvents: 'none'
                        }}
                      >
                        {dot.name}
                      </text>
                    )}
                  </g>
                ))}
              </svg>
            </div>
          </div>
        );
      })()}

      {/* Fullscreen Modal for JSON Reference */}
      {isJsonReferenceFullscreen && (() => {
        const { svgWidth, svgHeight, modalWidth, modalHeight } = getFullscreenDimensions();
        const { centerX, centerY } = getFullscreenTransform(svgWidth, svgHeight);
        
        return (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100vw',
              height: '100vh',
              background: 'rgba(0, 0, 0, 0.95)',
              zIndex: 9999,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px'
            }}
          >
            <div style={{
              background: 'white',
              borderRadius: '8px',
              padding: '20px',
              width: modalWidth,
              height: modalHeight,
              display: 'flex',
              flexDirection: 'column',
              position: 'relative'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '10px'
              }}>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>
                  JSON Reference (Interactive) - Fullscreen
                </h3>
                <button
                  onClick={toggleJsonReferenceFullscreen}
                  style={{
                    padding: '8px 16px',
                    background: '#dc3545',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 'bold'
                  }}
                >
                  ✕ Close
                </button>
              </div>
              <svg 
                ref={fullscreenJsonSvgRef}
                width={svgWidth} 
                height={svgHeight}
                style={{ 
                  border: '1px solid #ddd', 
                  borderRadius: '4px',
                  cursor: jsonDragging ? 'grabbing' : 'grab',
                  userSelect: 'none',
                  WebkitUserSelect: 'none',
                  MozUserSelect: 'none',
                  msUserSelect: 'none'
                }}
              >
                {electrodeState.selectedGroups.map((group, groupIndex) =>
                  group.map((dot, dotIndex) =>
                    group.slice(dotIndex + 1).map((otherDot, otherIndex) => {
                      const dot1 = jsonDots.find(d => d.name === dot.name);
                      const dot2 = jsonDots.find(d => d.name === otherDot.name);
                      if (dot1 && dot2) {
                        return (
                          <line key={`json-group-${groupIndex}-${dotIndex}-${otherIndex}`}
                            x1={dot1.x} 
                            y1={dot1.y} 
                            x2={dot2.x} 
                            y2={dot2.y}
                            stroke={getPairColor(groupIndex)} 
                            strokeWidth="2" />
                        );
                      }
                      return null;
                    })
                  )
                ).flat(2)}
                {jsonDots.map((dot) => (
                  <g key={`json-${dot.id}`} onClick={(e) => handleDotClick(dot, jsonDragging)}>
                    <circle 
                      cx={dot.x} 
                      cy={dot.y} 
                      r={DOT_RADIUS} 
                      fill={getDotColor(dot)} 
                      stroke="#000" 
                      strokeWidth="0.5" 
                      style={{
                        cursor: 'pointer',
                        opacity: 1
                      }}
                      onMouseEnter={(e) => handleJsonElectrodeMouseEnter(dot, e)}
                      onMouseLeave={handleJsonElectrodeMouseLeave}
                    />
                    {/* Show text for selected electrodes always, and for all electrodes if toggle is on */}
                    {(showAllLabels || electrodeState.selectedGroups.some(group => group.some(d => d.name === dot.name))) && (
                      <text 
                        x={dot.x} 
                        y={dot.y + 2} 
                        textAnchor="middle" 
                        fontSize="5" 
                        fill="#333"
                        style={{
                          userSelect: 'none',
                          WebkitUserSelect: 'none',
                          MozUserSelect: 'none',
                          msUserSelect: 'none',
                          pointerEvents: 'none'
                        }}
                      >
                        {dot.name}
                      </text>
                    )}
                  </g>
                ))}
              </svg>
            </div>
          </div>
        );
      })()}
    </>
  );
} 
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';

export function startThreeViewer(electrodeState) {
  // ───── Scene Setup ─────
  const container = document.getElementById('three-container');
  
  // Helper function to get current container dimensions
  function getContainerDimensions() {
    const rect = container.getBoundingClientRect();
    return {
      width: rect.width,
      height: rect.height,
      left: rect.left,
      top: rect.top
    };
  }
  
  // Ensure container is ready before initializing
  if (!container) {
    console.error('Three.js container not found');
    return;
  }
  
  // Get initial dimensions
  const initialDims = getContainerDimensions();
  const width = initialDims.width;
  const height = initialDims.height;
  
  // Ensure we have valid dimensions
  if (width <= 0 || height <= 0) {
    console.warn('Container has invalid initial dimensions, retrying...');
    // Retry after a short delay to allow for layout completion
    setTimeout(() => startThreeViewer(electrodeState), 100);
    return;
  }

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  scene.fog = new THREE.Fog(0x000000, 10, 50);

  const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 100);
  camera.position.set(5, 0.5, 2);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(width, height);
  container.appendChild(renderer.domElement);

  // ───── Lights ─────
  const ambientLight = new THREE.AmbientLight(0x404040, 30);
  scene.add(ambientLight);
  const sunLight = new THREE.DirectionalLight(0xffffff, 1);
  sunLight.position.set(5, 10, 5);
  scene.add(sunLight);
  const cameraLight = new THREE.PointLight(0xffffff, 1);
  cameraLight.position.set(0, 0, 0);
  scene.add(cameraLight);

  // ───── Controls ─────
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.minDistance = 2.5;
  controls.maxDistance = 8;
  controls.enableZoom = true;
  controls.mouseButtons = {
    LEFT: THREE.MOUSE.ROTATE,
    MIDDLE: THREE.MOUSE.DOLLY
  };

  // ───── Raycaster Setup ─────
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  let clickableElectrodes = [];

  // Get DOM elements
  const groupSizeSelect = document.getElementById('groupSize');
  const resetButton = document.getElementById('resetButton');
  const statusDiv = document.getElementById('status');
  const groupDisplays = document.querySelectorAll('.group-display .electrodes');
  const redGreenCountSpan = document.getElementById('red-green-count');
  const blueYellowCountSpan = document.getElementById('blue-yellow-count');
  const totalCombinationsSpan = document.getElementById('total-combinations');

  // Update status display
  function updateStatus() {
    const remaining = electrodeState.groupSize - electrodeState.selectedGroups[electrodeState.currentGroup].length;
    statusDiv.textContent = `Select electrodes for ${['E1+', 'E1-', 'E2+', 'E2-'][electrodeState.currentGroup]} (${remaining} remaining)`;
    electrodeState.selectedGroups.forEach((group, index) => {
      groupDisplays[index].textContent = group.map(e => e.name).join(', ');
    });
    updateCombinationsCounter();
  }

  // Update combinations counter
  function updateCombinationsCounter() {
    // Calculate Red ↔ Green (Group 0 ↔ Group 1)
    const redCount = electrodeState.selectedGroups[0] ? electrodeState.selectedGroups[0].length : 0;
    const greenCount = electrodeState.selectedGroups[1] ? electrodeState.selectedGroups[1].length : 0;
    const redGreenCombinations = redCount * greenCount;

    // Calculate Blue ↔ Yellow (Group 2 ↔ Group 3)  
    const blueCount = electrodeState.selectedGroups[2] ? electrodeState.selectedGroups[2].length : 0;
    const yellowCount = electrodeState.selectedGroups[3] ? electrodeState.selectedGroups[3].length : 0;
    const blueYellowCombinations = blueCount * yellowCount;

    // Total combinations
    const totalCombinations = redGreenCombinations + blueYellowCombinations;

    // Update the display
    if (redGreenCountSpan) redGreenCountSpan.textContent = redGreenCombinations;
    if (blueYellowCountSpan) blueYellowCountSpan.textContent = blueYellowCombinations;
    if (totalCombinationsSpan) totalCombinationsSpan.textContent = totalCombinations;
  }

  // Handle group size change
  groupSizeSelect.addEventListener('change', (e) => {
    electrodeState.groupSize = parseInt(e.target.value);
    resetSelection();
  });

  // Handle reset
  resetButton.addEventListener('click', resetSelection);

  function resetSelection() {
    electrodeState.selectedGroups.forEach(group => group.length = 0);
    electrodeState.currentGroup = 0;
    electrodeState.combinations = [];
    updateStatus();
    updateCombinationsCounter();
    clickableElectrodes.forEach(electrode => {
      if (electrode.userData.originalMaterial) {
        electrode.material = electrode.userData.originalMaterial;
        electrode.userData.lit = false;
      }
    });
    updateGroupLines();
    if (electrodeState.onReset) electrodeState.onReset();
  }

  function getGroupColor(groupIndex) {
    const colors = [
      new THREE.Color(0xff3333),
      new THREE.Color(0x33cc33),
      new THREE.Color(0x3366ff),
      new THREE.Color(0xffcc00)
    ];
    return colors[groupIndex];
  }

  // ───── Load GLB Model ─────
  const loader = new GLTFLoader();
  loader.load('scalp_and_net.glb', (gltf) => {
    const model = gltf.scene;
    scene.add(model);

    console.log('=== Scene Objects ===');
    
    // Create a map to group cylinder pieces
    const electrodeGroups = new Map();
    
    model.traverse((child) => {
      if (child.isMesh && child.name.startsWith('Cylinder')) {
        const baseName = child.name.split('_')[0];
        
        if (!electrodeGroups.has(baseName)) {
          electrodeGroups.set(baseName, []);
        }
        electrodeGroups.get(baseName).push(child);
        
        console.log('Found electrode piece:', {
          name: child.name,
          baseName: baseName,
          position: child.position
        });
      }
    });

    // Convert groups to clickable electrodes
    electrodeGroups.forEach((pieces) => {
      clickableElectrodes.push(...pieces);
    });

    console.log('Total clickable objects:', clickableElectrodes.length);
    console.log('Number of unique electrodes:', electrodeGroups.size);

    // ───── Project 3D electrodes to 2D screen space ─────
    const projectElectrodesToScreen = () => {
      const screenPositions = {};
      
      // Group electrode pieces by base name for unique electrodes
      const uniqueElectrodes = new Map();
      clickableElectrodes.forEach((piece) => {
        if (piece.name.startsWith('Cylinder')) {
          const baseName = piece.name.split('_')[0];
          if (!uniqueElectrodes.has(baseName)) {
            uniqueElectrodes.set(baseName, []);
          }
          uniqueElectrodes.get(baseName).push(piece);
        }
      });

      // Project each unique electrode to screen space
      uniqueElectrodes.forEach((pieces, baseName) => {
        // Calculate center position of all pieces for this electrode
        const center = new THREE.Vector3();
        pieces.forEach(piece => {
          const worldPos = new THREE.Vector3();
          piece.getWorldPosition(worldPos);
          center.add(worldPos);
        });
        center.divideScalar(pieces.length);

        // Project to screen space
        const projected = center.clone().project(camera);
        
        // Convert to normalized coordinates (0-1)
        const normalizedX = (projected.x + 1) / 2;
        const normalizedY = (1 - projected.y) / 2;
        
        // Convert cylinder name to electrode name with correct offset
        // E001->Cylinder001, E002->Cylinder002, E003->Cylinder003, E004->Cylinder005, etc.
        const cylinderNumber = parseInt(baseName.replace('Cylinder', ''));
        let electrodeNumber;
        
        if (cylinderNumber <= 3) {
          // First 3 electrodes map directly: E001->Cylinder001, E002->Cylinder002, E003->Cylinder003
          electrodeNumber = cylinderNumber;
        } else {
          // After E003, there's an offset: E004->Cylinder005, E005->Cylinder006, etc.
          // So for cylinderNumber >= 5, electrodeNumber = cylinderNumber - 1
          electrodeNumber = cylinderNumber - 1;
        }
        
        const electrodeName = `E${electrodeNumber.toString().padStart(3, '0')}`;
        
        screenPositions[electrodeName] = {
          x: normalizedX,
          y: normalizedY
        };
      });

      // Send projected coordinates to React component
      const event = new CustomEvent('projectedElectrodeCoords', {
        detail: screenPositions
      });
      window.dispatchEvent(event);
    };

    // Track camera position to only update projection when camera moves
    let lastCameraPosition = new THREE.Vector3();
    let lastCameraRotation = new THREE.Euler();
    let lastCameraFOV = camera.fov;
    const CAMERA_CHANGE_THRESHOLD = 0.001; // Threshold for detecting camera changes

    const hasCameraChanged = () => {
      const currentPosition = camera.position.clone();
      const currentRotation = camera.rotation.clone();
      const currentFOV = camera.fov;
      
      const positionChanged = currentPosition.distanceTo(lastCameraPosition) > CAMERA_CHANGE_THRESHOLD;
      const rotationChanged = Math.abs(currentRotation.x - lastCameraRotation.x) > CAMERA_CHANGE_THRESHOLD ||
                             Math.abs(currentRotation.y - lastCameraRotation.y) > CAMERA_CHANGE_THRESHOLD ||
                             Math.abs(currentRotation.z - lastCameraRotation.z) > CAMERA_CHANGE_THRESHOLD;
      const fovChanged = Math.abs(currentFOV - lastCameraFOV) > CAMERA_CHANGE_THRESHOLD;
      
      if (positionChanged || rotationChanged || fovChanged) {
        lastCameraPosition.copy(currentPosition);
        lastCameraRotation.copy(currentRotation);
        lastCameraFOV = currentFOV;
        return true;
      }
      
      return false;
    };

    // Initial projection
    projectElectrodesToScreen();

    // Update projection only when camera moves
    const originalUpdate = controls.update;
    controls.update = function() {
      originalUpdate.call(this);
      
      // Only update projection if camera has actually changed
      if (hasCameraChanged()) {
        projectElectrodesToScreen();
      }
    };

  }, undefined, (error) => {
    console.error('Error loading model:', error);
  });

  // ───── Group Lines ─────
  const groupLines = [[], [], [], []];
  // Inter-group lines array to store grey lines between specific group pairs
  const interGroupLines = [];
  
  function updateGroupLines() {
    electrodeState.selectedGroups.forEach((group, groupIndex) => {
      const lineArray = groupLines[groupIndex];
      const centers = [];
      group.forEach((electrode) => {
        if (!electrode || !electrode.pieces || !Array.isArray(electrode.pieces)) return;
        const center = new THREE.Vector3();
        let validPieces = 0;
        electrode.pieces.forEach((piece) => {
          if (!piece || typeof piece.getWorldPosition !== 'function') return;
          const worldPos = new THREE.Vector3();
          piece.getWorldPosition(worldPos);
          if (!isNaN(worldPos.x) && !isNaN(worldPos.y) && !isNaN(worldPos.z) &&
              isFinite(worldPos.x) && isFinite(worldPos.y) && isFinite(worldPos.z)) {
            center.add(worldPos);
            validPieces++;
          }
        });
        if (validPieces > 0) {
          center.divideScalar(validPieces);
          if (!isNaN(center.x) && !isNaN(center.y) && !isNaN(center.z) &&
              isFinite(center.x) && isFinite(center.y) && isFinite(center.z)) {
            centers.push(center);
          }
        }
      });
      lineArray.forEach(line => scene.remove(line));
      lineArray.length = 0;
      for (let i = 0; i < centers.length; i++) {
        for (let j = i + 1; j < centers.length; j++) {
          const center1 = centers[i];
          const center2 = centers[j];
          if (center1 && center2) {
            const geometry = new LineGeometry();
            const material = new LineMaterial({
              color: getGroupColor(groupIndex),
              transparent: true,
              opacity: 1,
              linewidth: 0.02,
              worldUnits: true,
              alphaToCoverage: true
            });
            const positions = [center1.x, center1.y, center1.z, center2.x, center2.y, center2.z];
            geometry.setPositions(positions);
            const line = new Line2(geometry, material);
            scene.add(line);
            lineArray.push(line);
          }
        }
      }
    });
    
    // ───── Inter-Group Lines (Grey) ─────
    // Clear existing inter-group lines
    interGroupLines.forEach(line => scene.remove(line));
    interGroupLines.length = 0;
    
    // Helper function to get electrode centers for a group
    const getElectrodeCenters = (group) => {
      const centers = [];
      group.forEach((electrode) => {
        if (!electrode || !electrode.pieces || !Array.isArray(electrode.pieces)) return;
        const center = new THREE.Vector3();
        let validPieces = 0;
        electrode.pieces.forEach((piece) => {
          if (!piece || typeof piece.getWorldPosition !== 'function') return;
          const worldPos = new THREE.Vector3();
          piece.getWorldPosition(worldPos);
          if (!isNaN(worldPos.x) && !isNaN(worldPos.y) && !isNaN(worldPos.z) &&
              isFinite(worldPos.x) && isFinite(worldPos.y) && isFinite(worldPos.z)) {
            center.add(worldPos);
            validPieces++;
          }
        });
        if (validPieces > 0) {
          center.divideScalar(validPieces);
          if (!isNaN(center.x) && !isNaN(center.y) && !isNaN(center.z) &&
              isFinite(center.x) && isFinite(center.y) && isFinite(center.z)) {
            centers.push(center);
          }
        }
      });
      return centers;
    };
    
    // Grey lines between Group 0 (red) ↔ Group 1 (green)
    if (electrodeState.selectedGroups[0] && electrodeState.selectedGroups[1] && 
        electrodeState.selectedGroups[0].length > 0 && electrodeState.selectedGroups[1].length > 0) {
      const group0Centers = getElectrodeCenters(electrodeState.selectedGroups[0]);
      const group1Centers = getElectrodeCenters(electrodeState.selectedGroups[1]);
      
      group0Centers.forEach(center1 => {
        group1Centers.forEach(center2 => {
          if (center1 && center2) {
            const geometry = new LineGeometry();
            const material = new LineMaterial({
              color: 0xff69b4, // Pink color
              transparent: true,
              opacity: 0.8,
              linewidth: 0.015,
              worldUnits: true,
              alphaToCoverage: true
            });
            const positions = [center1.x, center1.y, center1.z, center2.x, center2.y, center2.z];
            geometry.setPositions(positions);
            const line = new Line2(geometry, material);
            scene.add(line);
            interGroupLines.push(line);
          }
        });
      });
    }
    
    // Grey lines between Group 2 (blue) ↔ Group 3 (yellow)
    if (electrodeState.selectedGroups[2] && electrodeState.selectedGroups[3] && 
        electrodeState.selectedGroups[2].length > 0 && electrodeState.selectedGroups[3].length > 0) {
      const group2Centers = getElectrodeCenters(electrodeState.selectedGroups[2]);
      const group3Centers = getElectrodeCenters(electrodeState.selectedGroups[3]);
      
      group2Centers.forEach(center1 => {
        group3Centers.forEach(center2 => {
          if (center1 && center2) {
            const geometry = new LineGeometry();
            const material = new LineMaterial({
              color: 0xff69b4, // Pink color
              transparent: true,
              opacity: 0.8,
              linewidth: 0.015,
              worldUnits: true,
              alphaToCoverage: true
            });
            const positions = [center1.x, center1.y, center1.z, center2.x, center2.y, center2.z];
            geometry.setPositions(positions);
            const line = new Line2(geometry, material);
            scene.add(line);
            interGroupLines.push(line);
          }
        });
      });
    }
  }

  // Function to find electrode by name (E001, E002, etc.)
  function findElectrodeByName(electrodeName) {
    const electrodeGroups = new Map();
    
    // Group electrode pieces by base name
    clickableElectrodes.forEach(obj => {
      if (obj.name.startsWith('Cylinder')) {
        const baseName = obj.name.split('_')[0];
        if (!electrodeGroups.has(baseName)) {
          electrodeGroups.set(baseName, []);
        }
        electrodeGroups.get(baseName).push(obj);
      }
    });
    
    // Convert electrode name (E001, E002, etc.) to cylinder name with correct offset
    const electrodeNumber = parseInt(electrodeName.replace('E', ''));
    let cylinderNumber;
    
    if (electrodeNumber <= 3) {
      // First 3 electrodes map directly: E001->Cylinder001, E002->Cylinder002, E003->Cylinder003
      cylinderNumber = electrodeNumber;
    } else {
      // After E003, there's an offset: E004->Cylinder005, E005->Cylinder006, etc.
      // So for electrodeNumber >= 4, cylinderNumber = electrodeNumber + 1
      cylinderNumber = electrodeNumber + 1;
    }
    
    const cylinderName = `Cylinder${cylinderNumber.toString().padStart(3, '0')}`;
    
    const pieces = electrodeGroups.get(cylinderName);
    if (pieces && pieces.length > 0) {
      return {
        name: electrodeName,
        pieces: pieces
      };
    }
    
    return null;
  }

  function selectElectrodeFrom2D(electrodeName) {
    const electrode = findElectrodeByName(electrodeName);
    if (!electrode) return;
    const isSelected = electrodeState.selectedGroups.some(group =>
      group.some(e => e.name === electrodeName)
    );
    if (!isSelected && electrodeState.selectedGroups[electrodeState.currentGroup].length < electrodeState.groupSize) {
      electrodeState.selectedGroups[electrodeState.currentGroup].push(electrode);
      electrode.pieces.forEach(piece => {
        if (!piece.userData.originalMaterial) {
          piece.userData.originalMaterial = piece.material;
        }
        const glow = piece.material.clone();
        glow.emissive = getGroupColor(electrodeState.currentGroup);
        glow.emissiveIntensity = 1.5;
        piece.material = glow;
        piece.userData.lit = true;
      });
      if (electrodeState.selectedGroups[electrodeState.currentGroup].length === electrodeState.groupSize) {
        electrodeState.currentGroup = (electrodeState.currentGroup + 1) % 4;
      }
      updateStatus();
      updateGroupLines();
      if (electrodeState.selectedGroups.every(group => group.length === electrodeState.groupSize)) {
        generateCombinations();
      }
      if (electrodeState.onGroupChange) electrodeState.onGroupChange();
    }
  }

  function generateCombinations() {
    const combinations = [];
    const [E1_plus, E1_minus, E2_plus, E2_minus] = electrodeState.selectedGroups;
    const pair1Combinations = [];
    for (const plus of E1_plus) {
      for (const minus of E1_minus) {
        pair1Combinations.push([plus, minus]);
      }
    }
    const pair2Combinations = [];
    for (const plus of E2_plus) {
      for (const minus of E2_minus) {
        pair2Combinations.push([plus, minus]);
      }
    }
    for (const pair1 of pair1Combinations) {
      for (const pair2 of pair2Combinations) {
        combinations.push([pair1, pair2]);
      }
    }
    electrodeState.combinations = combinations;
    if (electrodeState.onGroupChange) electrodeState.onGroupChange();
  }

  // 3D click handling
  let isDragging = false;
  let lastMousePosition = { x: 0, y: 0 };
  let movementThreshold = 5;
  let mouseDown = false;
  
  function onMouseDown(event) {
    isDragging = false;
    mouseDown = true;
    lastMousePosition = { x: event.clientX, y: event.clientY };
  }
  
  function onMouseMove(event) {
    if (!mouseDown) return;
    const dx = event.clientX - lastMousePosition.x;
    const dy = event.clientY - lastMousePosition.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance > movementThreshold) {
      isDragging = true;
    }
    lastMousePosition = { x: event.clientX, y: event.clientY };
  }
  
  function onMouseUp(event) {
    mouseDown = false;
    if (!isDragging) {
      // Get the container's current dimensions and position
      const containerDims = getContainerDimensions();
      
      // Ensure we have valid dimensions
      if (containerDims.width <= 0 || containerDims.height <= 0) {
        console.warn('Container has invalid dimensions:', containerDims);
        return;
      }
      
      // Calculate mouse position relative to the container's actual rendered size
      // This accounts for any scaling, zoom, or resolution differences
      const relativeX = (event.clientX - containerDims.left) / containerDims.width;
      const relativeY = (event.clientY - containerDims.top) / containerDims.height;
      
      // Clamp values to ensure they're within bounds
      const clampedX = Math.max(0, Math.min(1, relativeX));
      const clampedY = Math.max(0, Math.min(1, relativeY));
      
      // Convert to Three.js normalized device coordinates (-1 to 1)
      mouse.x = clampedX * 2 - 1;
      mouse.y = -(clampedY * 2 - 1);
      
      raycaster.setFromCamera(mouse, camera);
      raycaster.near = 0.1;
      raycaster.far = 1000;
      const intersects = raycaster.intersectObjects(clickableElectrodes);
      if (intersects.length > 0) {
        const clicked = intersects[0].object;
        const baseName = clicked.name.split('_')[0];
        const cylinderNumber = parseInt(baseName.replace('Cylinder', ''));
        let electrodeNumber;
        
        if (cylinderNumber <= 3) {
          // First 3 cylinders map directly: Cylinder001->E001, Cylinder002->E002, Cylinder003->E003
          electrodeNumber = cylinderNumber;
        } else {
          // After Cylinder003, there's an offset: Cylinder005->E004, Cylinder006->E005, etc.
          // So for cylinderNumber >= 5, electrodeNumber = cylinderNumber - 1
          electrodeNumber = cylinderNumber - 1;
        }
        
        const electrodeName = `E${electrodeNumber.toString().padStart(3, '0')}`;
        selectElectrodeFrom2D(electrodeName);
      }
    }
    isDragging = false;
  }
  container.addEventListener('mousedown', onMouseDown);
  container.addEventListener('mousemove', onMouseMove);
  container.addEventListener('mouseup', onMouseUp);

  // Set up global state callbacks
  electrodeState.onElectrodeSelect = selectElectrodeFrom2D;
  electrodeState.onGroupChange = () => {
    const event = new CustomEvent('electrodeStateChanged');
    window.dispatchEvent(event);
  };
  electrodeState.onReset = () => {
    const event = new CustomEvent('electrodeStateChanged');
    window.dispatchEvent(event);
  };

  // Animate
  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    cameraLight.position.copy(camera.position);
    renderer.render(scene, camera);
  }
  animate();

  // Resize
  window.addEventListener('resize', () => {
    const containerDims = getContainerDimensions();
    const width = containerDims.width;
    const height = containerDims.height;
    
    // Ensure we have valid dimensions
    if (width > 0 && height > 0) {
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
      
      // Force a re-render to ensure everything is properly updated
      renderer.render(scene, camera);
    }
  });

  updateStatus();
} 
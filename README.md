# Net Viewer

A 3D/2D interactive electrode visualization tool built with React and Three.js. This application allows users to view and interact with electrode networks in both 3D space and 2D projections.

## Features

- **3D Visualization**: Interactive 3D model viewer using Three.js
- **2D Projection Maps**: Real-time 2D projections of electrode positions
- **Electrode Selection**: Click to select electrodes and organize them into groups
- **Group Management**: Create electrode groups (E1+, E1-, E2+, E2-) for analysis
- **Real-time Communication**: Synchronized interaction between 3D and 2D views
- **Zoom and Pan**: Interactive controls for both 2D maps
- **Combination Generation**: Automatic generation of electrode combinations

## Technologies Used

- **React 19** - UI framework
- **Three.js** - 3D graphics library
- **Vite** - Build tool and development server
- **GLTFLoader** - 3D model loading
- **OrbitControls** - 3D camera controls

## Project Structure

```
Net_Viewer/
├── public/
│   ├── electrodes_projected.json    # Electrode coordinate data
│   └── scalp_and_net.glb           # 3D model file
├── src/
│   ├── main.jsx                    # Application entry point
│   ├── UnifiedViewer.jsx           # React 2D interface
│   └── threeViewer.js              # Three.js 3D viewer
├── index.html                      # HTML entry point
├── package.json                    # Dependencies and scripts
├── vite.config.js                  # Vite configuration
└── README.md                       # This file
```

## Getting Started

### Prerequisites

- Node.js (version 16 or higher)
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/awjackson2/Net_Viewer.git
   cd Net_Viewer
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open your browser and navigate to `http://localhost:3000`

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

## Usage

1. **3D View**: The left panel shows the 3D electrode model. Use mouse to rotate, zoom, and pan.
2. **2D Maps**: The right panel shows two 2D projections of the electrodes.
3. **Electrode Selection**: Click on electrodes in either 3D or 2D view to select them.
4. **Group Management**: Use the controls to set group size and manage electrode groups.
5. **Reset**: Use the reset button to clear all selections.

## Data Files

- `scalp_and_net.glb`: 3D model containing the electrode network
- `electrodes_projected.json`: JSON file with 2D coordinates for electrode projections



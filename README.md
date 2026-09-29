# 🛰️ ARES-IV · Mars Surface Simulation

An interactive 3D Mars Surface Simulation featuring an autonomous rover equipped with GOAP AI decision-making, scientific research modules, and a futuristic mission-control HUD. Built with Next.js 16, Three.js (WebGL), and TypeScript.

![ARES-IV Mars Surface Simulation](https://img.shields.io/badge/STATUS-OPERATIONAL-36e06a) ![Next.js 16](https://img.shields.io/badge/Next.js-16-black) ![Three.js](https://img.shields.io/badge/Three.js-WebGL-black) ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)

---

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Technology Stack](#technology-stack)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [Controls](#controls)
- [Project Structure](#project-structure)

---

## 🌐 Overview

ARES-IV is a real-time 3D simulation of an autonomous Mars rover exploring the Martian surface. The rover uses a Goal-Oriented Action Planning (GOAP) AI engine to autonomously survey terrain, navigate to scientific points of interest, and conduct field research — all without user intervention. A glassmorphic mission-control HUD provides live telemetry, LIDAR mapping, and scientific data visualization.

---

## ✨ Features

### 3D Environment & World Generation
- **Procedural Martian Landscape** — Heightmap-based terrain using layered simplex/perlin noise with realistic crater formations, canyon ridges, and sand-dune ripples
- **Authentic Color Palette** — Rust-orange (#C1440E), deep dusty red, ochre, and dark basalt rock textures
- **Atmospheric Scattering** — Custom sky shader with butterscotch-orange day sky and bluish sunset horizon gradient
- **Dynamic Day-Night Cycle** — Sun position drives shadows, lighting, and sky color transitions
- **Dust Particle System** — GPU-driven dust-devil effects with vertex shaders

### Autonomous Rover Model
- **Detailed Procedural Geometry** — Chassis, solar panels, high-gain parabolic antenna, gold-foil radiators
- **6-Wheel Rocker-Bogie Suspension** — Individual wheel meshes dynamically align with terrain slope
- **Articulated Robotic Arm** — Shoulder/elbow/wrist joints with drill bit, spectral scanner, and sample container
- **Sensor Mast** — Stereo NavCams, MastCam, and rotating LIDAR head with status LEDs
- **Visual States** — Green (idle/navigation), Amber (task execution), Red (hazard/low power)

### Autonomous AI Engine
- **GOAP Decision Loop** — Survey → Pathfind → Navigate → Execute Science → Repeat
- **A* Pathfinding** — Grid-based navigation avoiding craters, boulders, and steep slopes (>22°)
- **LIDAR Raycasting** — Continuous terrain scanning for obstacle detection and hazard avoidance
- **Resource Management** — Monitors battery/power; aligns solar panels when power is low

### Scientific Research Suite
1. **Subsurface Core Drilling** — Progressive strata reveal (Regolith → Iron Oxides → Silicate → Permafrost) with debris particle effects
2. **X-Ray / Raman Spectroscopy** — Elemental abundance analysis (Fe₂O₃, SiO₂, MgO, CaO, Al₂O₃, SO₃, H₂O, Perchlorates)
3. **Atmospheric Weather Station** — Real-time temperature, pressure, wind speed/direction, and UV index
4. **Biosignature GC-MS Analysis** — Organic compound scanning with confidence telemetry

### Futuristic HUD
- **System Telemetry** — Power, Motor RPM, Internal Temp, Storage, Heading, Slope, Speed
- **LIDAR Mini-Map** — Top-down radar with rotating sweep, path history, obstacles, and POIs
- **Camera Viewport Toggle** — Follow Cam, NavCam (first-person), ArmCam, Orbital Flycam
- **Scientific Data Hub** — Spectral graphs, core sample breakdowns, environmental trends
- **AI Reasoning Terminal** — Real-time log stream of the rover's decision-making process
- **Control Modes** — Toggle between 100% Autonomous AI and Manual Remote Override

---

## 🛠 Technology Stack

| Category | Technology |
|----------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| 3D Graphics | Three.js (WebGL) |
| Styling | Tailwind CSS 4 + shadcn/ui |
| State Management | Zustand |
| Physics | Custom terrain-following kinematics |
| AI | GOAP FSM + A* pathfinding |
| Charts | Custom Canvas rendering |
| Icons | Lucide React |

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────┐
│              React HUD (Zustand)             │
│  Telemetry · MiniMap · ScienceHub · Logs    │
└──────────────────┬──────────────────────────┘
                   │ shared store
┌──────────────────▼──────────────────────────┐
│           SceneManager (Three.js)            │
│  Renderer · Cameras · Render Loop            │
├─────────────┬──────────────┬────────────────┤
│  Terrain    │    Rover     │   AI Engine    │
│  (Noise)    │  (Rocker-    │   (GOAP +     │
│  Craters    │   Bogie)     │    A* Path)   │
│  Boulders   │  Robotic Arm │   LIDAR       │
└─────────────┴──────────────┴────────────────┘
```

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+ or [Bun](https://bun.sh/)
- A modern browser with WebGL support

### Installation

```bash
# Clone the repository
git clone https://github.com/batturamesh7771-sketch/my-1st-phyton-project.git
cd my-1st-phyton-project

# Install dependencies
bun install

# Start the development server
bun run dev
```

Open `http://localhost:3000` in your browser.

### Available Scripts

| Script | Description |
|--------|-------------|
| `bun run dev` | Start development server (port 3000) |
| `bun run lint` | Run ESLint |
| `bun run build` | Production build |
| `bun run db:push` | Push Prisma schema to database |

---

## 🎮 Controls

### Camera Modes
| Key | Mode | Description |
|-----|------|-------------|
| `1` | Follow | Third-person chase camera |
| `2` | NavCam | First-person navigation camera |
| `3` | ArmCam | Close-up of robotic arm |
| `4` | Orbital | Free orbital flycam (mouse drag) |

### Rover Control
| Key | Action |
|-----|--------|
| `M` | Toggle Autonomous/Manual mode |
| `W` / `↑` | Drive forward (manual) |
| `S` / `↓` | Drive backward (manual) |
| `A` / `←` | Turn left (manual) |
| `D` / `→` | Turn right (manual) |

> In **Autonomous AI Mode**, the rover operates entirely on its own — surveying terrain, selecting scientific targets, navigating via A* pathfinding, and conducting research.

---

## 📁 Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── page.tsx           # Main simulation page
│   ├── layout.tsx         # Root layout
│   └── globals.css        # Global styles
├── components/
│   └── mars/
│       ├── MarsSimulation.tsx   # Root simulation component
│       └── hud/                 # HUD panels
│           ├── TelemetryPanel.tsx
│           ├── MiniMap.tsx
│           ├── LogsTerminal.tsx
│           ├── ScienceHub.tsx
│           ├── CameraToggle.tsx
│           └── ControlBar.tsx
└── lib/
    └── mars/
        ├── store.ts           # Zustand state store
        ├── terrain.ts         # Procedural Martian terrain
        ├── environment.ts     # Sky, sun, dust particles
        ├── rover.ts           # Rover 3D model & kinematics
        ├── ai-engine.ts       # GOAP AI + A* pathfinding
        ├── science.ts         # Scientific research modules
        ├── scene-manager.ts   # Three.js scene orchestration
        └── noise.ts           # Simplex noise generators
```

---

## 📜 License

This project is open source and available under the MIT License.

---

## 🙏 Acknowledgments

- Terrain generation inspired by NASA Mars Reconnaissance Orbiter data
- Rover design influenced by NASA's Perseverance/Curiosity missions
- Three.js community for WebGL rendering best practices

---

**ARES-IV · Mission Control v1.0** — Built for exploring the Red Planet. 🪐

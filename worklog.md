---
Task ID: mars-sim-1
Agent: main (Z.ai Code)
Task: Build a fully functional 3D Mars Surface Simulation SPA with autonomous rover, GOAP AI, scientific modules, and futuristic HUD.

Work Log:
- Installed three@0.186.1, simplex-noise@4.0.3, @types/three.
- Created shared Zustand store (src/lib/mars/store.ts) bridging Three.js engine <-> React HUD (telemetry, environment, obstacles, POIs, logs, drill/spectro/weather/biosignature results, mini-map, camera/control modes).
- Built procedural Martian terrain (terrain.ts): layered fbm + ridged noise heightmap, crater bowls+rims, vertex colors (rust-orange/dark-red/ochre/basalt), height/normal/slope query functions, instanced obstacle/POI generation, spawn-zone flattening.
- Built environment (environment.ts): custom atmospheric sky shader (butterscotch day -> bluish sunset horizon), directional sun with 2048 shadow maps + hemisphere/ambient fill, GPU dust-devil particle system (vertex shader), InstancedMesh boulders (110), POI marker beacons.
- Built detailed rover (rover.ts): chassis + gold foil radiator + 3-segment solar panels + high-gain parabolic antenna, sensor mast with stereo NavCams + MastCam + rotating LIDAR head + status LEDs, 5-segment articulated robotic arm (shoulder/elbow/wrist + drill bit/spectral scanner/sample container), 6-wheel Rocker-Bogie-style suspension with per-wheel terrain alignment, headlights spotlight, terrain-following body tilt via averaged normals.
- Built autonomous AI (ai-engine.ts): GOAP/FSM (IDLE->SURVEY->PATHFIND->NAVIGATE->DRILL/SPECTRO/WEATHER/BIOSIGNATURE), A* pathfinding on 3m grid avoiding craters & >23deg slopes, LIDAR raycasting hazard avoidance, low-power solar-align resource management, target selection by nearest un-analyzed POI.
- Built science manager (science.ts): drilling with progressive strata reveal + debris particles + water-ice discovery, XRF/Raman spectroscopy with elemental breakdown (Fe2O3/SiO2/MgO/H2O/Perchlorates), weather station sampling, GC-MS biosignature search.
- Built scene manager (scene-manager.ts): WebGL renderer (ACES tone mapping, PCF shadows), 4 camera modes (follow/navcam/armcam/orbital with OrbitControls), day-night cycle driving sun position + sky + lighting, power drain/charge, manual WASD controls, throttled store pushes, drill particle pool + spectro beam effects.
- Built glassmorphism HUD (components/mars/hud/*): TelemetryPanel (power/RPM/temp/storage/heading/slope/LED), MiniMap (canvas radar with LIDAR sweep + path + POIs + obstacles), LogsTerminal (AI reasoning stream), ScienceHub (tabbed spectro bar chart / drill strata column / weather trend lines / biosignature findings), CameraToggle, ControlBar (autonomous/manual + science triggers).
- Wired main page (page.tsx) with dynamic no-SSR import; updated globals.css (custom scrollbars, full-viewport), layout metadata.
- Fixed lint (set-state-in-effect), Next.js 16 ssr:false requirement (page -> 'use client'), spawn trap (flatten + walkable corridor + crater avoidance), rover silhouette darkness (boosted ambient/hemi + sun target in scene + exposure 1.55), deprecated THREE.Clock -> performance.now(), PCFSoftShadowMap -> PCFShadowMap.

Stage Summary:
- App runs at http://localhost:3000 (only user route /). ESLint clean. Fresh browser console: zero errors, zero warnings.
- Agent Browser + VLM verified end-to-end: 3D terrain well-lit & reddish, rover model visible (wheels/mast/solar panels), autonomous AI runs full cycle (survey -> A* route "3 waypoints" -> navigate -> science), spectroscopy shows elemental breakdown (SiO2 39.4%, Fe2O3 25.4%...), 4 camera modes switch correctly, manual override enables science triggers, mini-map radar + LIDAR sweep render, sticky footer at viewport bottom, responsive on 390px mobile (no overflow). VLM rated 10/10.
- Headless FPS ~20 (software WebGL / no GPU); real GPU hardware targets 60 FPS.
- Artifacts: src/lib/mars/{store,noise,terrain,environment,rover,ai-engine,science,scene-manager}.ts, src/components/mars/{MarsSimulation.tsx, hud/*.tsx}, src/app/page.tsx.

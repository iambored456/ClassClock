/** js/physics.js */
import Matter from 'matter-js';
import { State } from './state.js';
import { Settings } from './settings.js'; // Import settings for particle size

export const Physics = {
    engine: null,
    render: null,
    world: null,
    runner: null,
    isInitialized: false,
    isRunning: false,

    init: function(canvasElement, containerWidth, containerHeight) {
        if (Physics.isInitialized) {
            if (Physics.render && (Physics.render.options.width !== containerWidth || Physics.render.options.height !== containerHeight)) {
                console.log(`Resizing physics renderer to ${containerWidth}x${containerHeight}`);
                Physics.render.bounds.max.x = containerWidth;
                Physics.render.bounds.max.y = containerHeight;
                Physics.render.options.width = containerWidth;
                Physics.render.options.height = containerHeight;
                Physics.render.canvas.width = containerWidth;
                Physics.render.canvas.height = containerHeight;
                Physics.updateWallPositions(containerWidth, containerHeight);
            }
            Physics.start(); // Ensure running
            return;
        }

        console.log(`Initializing Physics Engine: ${containerWidth}x${containerHeight}`);
        if (!canvasElement || isNaN(containerWidth) || isNaN(containerHeight) || containerWidth <= 0 || containerHeight <= 0) {
            console.error("Cannot initialize Physics: Invalid canvas or dimensions.");
            return;
        }

        // --- NEW: Increased Solver Iterations for Rigidity ---
        const engineOptions = {
            enableSleeping: true,
            // Default is 6, higher values increase rigidity but cost performance
            positionIterations: 8,
             // Default is 4, higher values help prevent tunnelling/overlap
            velocityIterations: 6
        };
        Physics.engine = Matter.Engine.create(engineOptions);
        // --- End New ---

        Physics.world = Physics.engine.world;
        Physics.engine.world.gravity.y = 0.7; // Keep gravity relatively low

        Physics.render = Matter.Render.create({
            element: canvasElement.parentNode,
            canvas: canvasElement,
            engine: Physics.engine,
            options: {
                width: containerWidth,
                height: containerHeight,
                wireframes: false,
                background: 'transparent',
                showSleeping: false, // Keep particles visible when sleeping
                pixelRatio: window.devicePixelRatio || 1
            }
        });

        Physics.createWalls(containerWidth, containerHeight);

        Physics.runner = Matter.Runner.create();
        Matter.Runner.run(Physics.runner, Physics.engine);
        Matter.Render.run(Physics.render);

        Physics.isInitialized = true;
        Physics.isRunning = true;
        console.log("Physics engine initialized and running.");
    },

    createWalls: function(width, height) {
        if (!Physics.world) return;

        const staticBodies = Matter.Composite.allBodies(Physics.world).filter(body => body.isStatic);
        if (staticBodies.length > 0) { Matter.World.remove(Physics.world, staticBodies); }

        const numSegments = State.SAND_COLORS.length;
        const segmentWidth = width / numSegments;
        const wallThickness = 15; // Keep thickness reasonable
        const walls = [];
        const wallOptions = {
             isStatic: true,
             friction: 0.6, // Increased friction slightly for walls
             restitution: 0.1, // Keep wall bounce low
             render: { visible: false }
        };

        // Floor
        walls.push(Matter.Bodies.rectangle(width / 2, height + wallThickness / 2, width + wallThickness * 2, wallThickness, wallOptions));
        // Left Outer Wall
        walls.push(Matter.Bodies.rectangle(-wallThickness / 2, height / 2, wallThickness, height + wallThickness * 2, wallOptions));
        // Right Outer Wall
        walls.push(Matter.Bodies.rectangle(width + wallThickness / 2, height / 2, wallThickness, height + wallThickness * 2, wallOptions));
        // Inner Divider Walls
        for (let i = 1; i < numSegments; i++) {
            const dividerX = i * segmentWidth;
             walls.push(Matter.Bodies.rectangle(dividerX, height / 2, wallThickness, height + wallThickness * 2, wallOptions));
        }
        Matter.World.add(Physics.world, walls);
    },

    updateWallPositions: function(newWidth, newHeight) {
        Physics.createWalls(newWidth, newHeight); // Recreate walls on resize
    },

    addParticle: function(segmentIndex, color) {
        if (!Physics.isInitialized || !Physics.engine || !Physics.render?.options?.width) return;
        if (segmentIndex < 0 || segmentIndex >= State.SAND_COLORS.length) return;

        const numSegments = State.SAND_COLORS.length;
        const segmentWidth = Physics.render.options.width / numSegments;
        // For polygons, 'radius' usually means distance from center to vertex
        const radius = Settings.preferences?.sandParticleSize || 5;
        const wallThickness = 15; // Match createWalls collision thickness
        // Buffer calculation might need slight adjustment based on hexagon orientation,
        // but using radius should still be a safe approximation.
        const buffer = radius * 0.5;

        const segmentStartX = segmentIndex * segmentWidth;
        const minX = segmentStartX + (wallThickness / 2) + radius + buffer;
        const maxX = segmentStartX + segmentWidth - (wallThickness / 2) - radius - buffer;

        if (minX >= maxX) {
             // console.warn(`Segment ${segmentIndex} too narrow for particle radius ${radius}.`);
             return;
        }

        const x = minX + (Math.random() * (maxX - minX));
        const y = -radius * 2; // Start just above the visible area

        // --- CHANGE: Use polygon instead of circle ---
        const particle = Matter.Bodies.polygon(x, y, 6, radius, { // 6 sides for hexagon
            restitution: 0.15, // Slightly reduced bounce from 0.2 maybe? Test this.
            friction: 0.7,     // Slightly increased friction (hexagons have flat sides, might help locking)
            frictionAir: 0.01,
            density: 0.01,     // Keep density relatively low
            render: { fillStyle: color },
            sleepThreshold: 60, // Standard sleep threshold
            // --- NEW: Chamfering can sometimes help stacking stability ---
            // chamfer: { radius: radius * 0.1 } // Optional: slightly rounds corners
        });
        // --- End Change ---


        Matter.Body.setVelocity(particle, { x: (Math.random() - 0.5) * 0.1, y: Math.random() * 0.1 });
        // Reduce initial spin slightly as hexagons might rotate more jarringly
        Matter.Body.setAngularVelocity(particle, (Math.random() - 0.5) * 0.01);
        Matter.World.add(Physics.world, particle);
    },

    clearDynamicBodies: function() {
        if (!Physics.world) return;
        const allBodies = Matter.Composite.allBodies(Physics.world);
        const bodiesToRemove = allBodies.filter(body => !body.isStatic);
        if (bodiesToRemove.length > 0) { Matter.World.remove(Physics.world, bodiesToRemove); }
    },

    stop: function() {
         if (!Physics.isRunning) return;
         if (Physics.runner) Matter.Runner.stop(Physics.runner);
         if (Physics.render) Matter.Render.stop(Physics.render);
         Physics.isRunning = false;
    },

    start: function() {
         if (Physics.isRunning || !Physics.isInitialized) return;
         if (Physics.render) Matter.Render.run(Physics.render);
         if (Physics.runner && Physics.engine) {
             Matter.Runner.run(Physics.runner, Physics.engine);
             Physics.isRunning = true;
         } else { console.error("Cannot start physics, not initialized."); }
    },

    destroy: function() {
         console.log("Destroying physics engine...");
         Physics.stop();
         if (Physics.world) Matter.World.clear(Physics.world, false);
         if (Physics.engine) Matter.Engine.clear(Physics.engine);
         Physics.engine = null; Physics.world = null; Physics.render = null; Physics.runner = null;
         Physics.isInitialized = false; Physics.isRunning = false;
         console.log("Physics engine destroyed.");
    }
};
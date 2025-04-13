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

        Physics.engine = Matter.Engine.create({ enableSleeping: true });
        Physics.world = Physics.engine.world;
        Physics.engine.world.gravity.y = 0.7;

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
        // Increase thickness again for better collision detection margin
        const wallThickness = 15;
        const walls = [];
        const wallOptions = {
             isStatic: true,
             friction: 0.5, // Slightly higher friction for stability
             restitution: 0.1, // Low bounce
             render: { visible: false } // Collision walls remain invisible
        };

        // Floor: Centered slightly below the canvas bottom edge
        walls.push(Matter.Bodies.rectangle(width / 2, height + wallThickness / 2, width + wallThickness * 2, wallThickness, wallOptions));

        // Left Outer Wall: Centered slightly left of the canvas left edge
        walls.push(Matter.Bodies.rectangle(-wallThickness / 2, height / 2, wallThickness, height + wallThickness * 2, wallOptions));

        // Right Outer Wall: Centered slightly right of the canvas right edge
        walls.push(Matter.Bodies.rectangle(width + wallThickness / 2, height / 2, wallThickness, height + wallThickness * 2, wallOptions));

        // Inner Divider Walls: Centered exactly on the segment boundaries
        for (let i = 1; i < numSegments; i++) {
            const dividerX = i * segmentWidth;
            // Ensure dividers extend slightly beyond floor/ceiling
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
        const radius = Settings.preferences?.sandParticleSize || 5;
        const wallThickness = 15; // Match createWalls collision thickness
        const buffer = radius * 0.5; // Use half radius as buffer minimum distance from wall center

        // Calculate segment X boundaries based on *collision* walls
        const segmentStartX = segmentIndex * segmentWidth;

        // Min/Max X within the segment, accounting for wall thickness and particle radius
        // Ensure particle center is at least radius + buffer away from the wall's *centerline*
        const minX = segmentStartX + (wallThickness / 2) + radius + buffer;
        const maxX = segmentStartX + segmentWidth - (wallThickness / 2) - radius - buffer;

        // If segment is too narrow for particle + buffers, don't spawn
        if (minX >= maxX) {
             // console.warn(`Segment ${segmentIndex} too narrow (${maxX - minX} available) for particle radius ${radius}.`);
             return;
        }

        const x = minX + (Math.random() * (maxX - minX)); // Random X within the safe spawning area
        const y = -radius * 2; // Start just above the visible area

        const particle = Matter.Bodies.circle(x, y, radius, {
            restitution: 0.2, // Keep low bounce
            friction: 0.6,    // Keep higher friction
            frictionAir: 0.01,
            density: 0.01,
            render: { fillStyle: color },
            sleepThreshold: 60,
        });

        Matter.Body.setVelocity(particle, { x: (Math.random() - 0.5) * 0.1, y: Math.random() * 0.1 });
        Matter.Body.setAngularVelocity(particle, (Math.random() - 0.5) * 0.02);
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
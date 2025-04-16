/**
 * @fileoverview Main game logic for Al Papone.
 * Based on the structure from sample-game.html.
 */

// ---- Get DOM Elements ----
// Ensure these elements exist in your index.html
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreDisplay = document.getElementById('scoreDisplay');
const gameOverOverlay = document.getElementById('gameOverOverlay');
const finalScoreDisplay = document.getElementById('finalScoreDisplay');
const resetButton = document.getElementById('resetButton');
// Assuming UI elements might be added later or managed differently.
// If you have score/message elements, get them here.
// const scoreElement = document.getElementById('score');
// const messageBox = document.getElementById('messageBox');
// const finalScoreElement = document.getElementById('finalScore');
// const resetButton = document.getElementById('resetButton');

// --- Game Constants ---
const GRAVITY = 0.5;
const PLAYER_SPEED = 4;
const JUMP_FORCE = -11;
const BULLET_SPEED = 7;
const ENEMY_BULLET_SPEED = 4;
const ENEMY_SPEED = 1;
const ENEMY_SPAWN_INTERVAL = 180; // Frames between spawns
const ENEMY_SHOOT_INTERVAL = 120; // Frames between enemy shots
// const TOPPING_SPAWN_RATE = 150; // Toppings logic can be added later if needed
const GROUND_Y_OFFSET = 10; // How high the ground platform is from the bottom
const CAMERA_LERP_FACTOR = 0.1; // How quickly the camera catches up (0-1)

// --- Game State ---
let score = 0;
let keys = {}; // Tracks pressed keys
let playerBullets = [];
let enemyBullets = [];
let enemies = [];
let platforms = []; // Array to hold platform objects
let frameCount = 0;
let gameOver = false;
let gameRunning = true;
let groundLevel = canvas.height - GROUND_Y_OFFSET; // Define ground y-coordinate dynamically
let cameraOffsetX = 0; // Tracks the horizontal scroll position of the camera
let levelWidth = 0; // Will be set in defineLevel

// ---- Level Definition ----
/**
 * Defines the platforms AND initial enemy placements for the level.
 */
function defineLevel() {
    groundLevel = canvas.height - GROUND_Y_OFFSET; 
    levelWidth = canvas.width * 3; // Keep level width definition
    platforms = [
        // Ground platform
        { x: 0, y: groundLevel, width: levelWidth, height: GROUND_Y_OFFSET, type: 'ground', color: '#8B4513' }, 
        // Platforms...
        { id: 'p1', x: 150, y: groundLevel - 80, width: 150, height: 15, type: 'brick', color: '#D2691E' },
        { id: 'p2', x: 400, y: groundLevel - 150, width: 200, height: 15, type: 'brick', color: '#D2691E' },
        { id: 'p3', x: 650, y: groundLevel - 250, width: 100, height: 15, type: 'brick', color: '#D2691E' },
        { id: 'p4', x: 900, y: groundLevel - 100, width: 250, height: 15, type: 'brick', color: '#D2691E' },
        { id: 'p5', x: 1050, y: groundLevel - 200, width: 100, height: 15, type: 'brick', color: '#D2691E' },
        { id: 'p6', x: 1250, y: groundLevel - 80, width: 150, height: 15, type: 'brick', color: '#D2691E' },
        { id: 'p7', x: 1500, y: groundLevel - 180, width: 300, height: 15, type: 'brick', color: '#D2691E' },
        { id: 'p8', x: 1900, y: groundLevel - 50, width: 100, height: 15, type: 'brick', color: '#D2691E' }, 
    ];
    console.log("Platforms defined.");

    // Initial Enemy Placement (example)
    enemies = []; // Clear existing enemies before defining new ones
    // Find platforms by ID or coordinates to place enemies
    const ground = platforms[0];
    const p2 = platforms.find(p => p.id === 'p2');
    const p4 = platforms.find(p => p.id === 'p4');
    const p7 = platforms.find(p => p.id === 'p7');

    if(ground) {
        enemies.push(new Enemy(300, ground.y, undefined, undefined, ENEMY_SPEED, 'potato_cop', ground));
        enemies.push(new Enemy(750, ground.y, undefined, undefined, ENEMY_SPEED, 'carrot', ground));
        enemies.push(new Enemy(1300, ground.y, undefined, undefined, ENEMY_SPEED, 'potato_cop', ground));
    }
    if(p2) enemies.push(new Enemy(p2.x + 50, p2.y, undefined, undefined, ENEMY_SPEED, 'carrot', p2));
    if(p4) enemies.push(new Enemy(p4.x + 100, p4.y, undefined, undefined, ENEMY_SPEED, 'potato_cop', p4));
    if(p7) {
         enemies.push(new Enemy(p7.x + 50, p7.y, undefined, undefined, ENEMY_SPEED, 'carrot', p7));
         enemies.push(new Enemy(p7.x + 200, p7.y, undefined, undefined, ENEMY_SPEED, 'potato_cop', p7));
    }
    console.log("Initial enemies placed:", enemies.length);
}

// ---- Player Object ----
// Using an object literal for the player for now
const player = {
    width: 40,
    height: 50,
    x: 50,
    y: groundLevel - 60, // Start above ground
    velocityY: 0,
    velocityX: 0, // Added for consistency
    isOnGround: false,
    direction: 'right', // Track player facing direction

    /**
     * Draws the player placeholder.
     */
    draw() {
        ctx.fillStyle = '#A0522D'; // Sienna brown (Placeholder color)
        ctx.fillRect(this.x, this.y, this.width, this.height);

        // Simple gun representation based on direction
        ctx.fillStyle = '#555'; // Dark grey
        const gunWidth = 15;
        const gunHeight = 6;
        const gunY = this.y + this.height / 2 - gunHeight / 2;
        if (this.direction === 'right') {
            ctx.fillRect(this.x + this.width - 5, gunY, gunWidth, gunHeight);
        } else {
            ctx.fillRect(this.x - gunWidth + 5, gunY, gunWidth, gunHeight);
        }
    },

    /**
     * Updates player position based on input, gravity, and collisions.
     */
    update() {
        // Apply Gravity
        this.velocityY += GRAVITY;
        this.y += this.velocityY;
        this.isOnGround = false; // Assume not on ground until collision check

        // --- Platform Collision ---
        platforms.forEach(platform => {
            // Check for vertical collision (landing on top)
            if (
                this.velocityY >= 0 && // Only check when falling or still
                this.x + this.width > platform.x && // Player right edge > platform left edge
                this.x < platform.x + platform.width && // Player left edge < platform right edge
                this.y + this.height >= platform.y && // Player bottom edge is at or below platform top
                this.y + this.height - this.velocityY <= platform.y + 1 // Check slightly below previous frame's bottom edge
            ) {
                this.y = platform.y - this.height; // Land on platform
                this.velocityY = 0;
                this.isOnGround = true;
            }
            // TODO: Add side/bottom collision if needed later
        });

        // Horizontal Movement
        this.velocityX = 0;
        if (keys['ArrowLeft']) {
            this.velocityX = -PLAYER_SPEED;
            this.direction = 'left';
        }
        if (keys['ArrowRight']) {
            this.velocityX = PLAYER_SPEED;
            this.direction = 'right';
        }
        this.x += this.velocityX;

        // Keep player within WORLD bounds (not just canvas)
        if (this.x < 0) {
            this.x = 0;
        }
        // We remove the canvas boundary check as the camera handles the view

        // Jumping (Allow jump only when on a surface)
        if (keys['ArrowUp'] && this.isOnGround && !keys['ArrowUpHandled']) {
            this.velocityY = JUMP_FORCE;
            this.isOnGround = false; // Player is now in the air
            keys['ArrowUpHandled'] = true; // Prevent holding jump
        }
    },

    /**
     * Creates a player bullet based on direction.
     */
    shoot() {
        const bulletWidth = 10;
        const bulletHeight = 4;
        const bulletY = this.y + this.height / 2 - bulletHeight / 2;
        let bulletX, bulletVelX;

        if (this.direction === 'right') {
            bulletX = this.x + this.width;
            bulletVelX = BULLET_SPEED;
        } else {
            bulletX = this.x - bulletWidth;
            bulletVelX = -BULLET_SPEED;
        }

        playerBullets.push({
            x: bulletX,
            y: bulletY,
            width: bulletWidth,
            height: bulletHeight,
            velX: bulletVelX,
            draw() {
                ctx.fillStyle = 'yellow'; // Starch pellets!
                ctx.fillRect(this.x, this.y, this.width, this.height);
            },
            update() {
                this.x += this.velX;
            }
        });
    }
};

// ---- Enemy Class ----
class Enemy {
    constructor(x, y, width = 35, height = 45, speed = ENEMY_SPEED, type = 'carrot', platform = null) {
        this.x = x;
        this.y = y - height; // Position based on bottom edge landing on y
        this.width = width;
        this.height = height;
        this.speed = speed * (Math.random() < 0.5 ? 1 : -1); // Initial random direction
        this.type = type; // 'carrot' or 'potato_cop'
        this.platform = platform; // Platform the enemy is on (if any)
        this.shootTimer = Math.random() * ENEMY_SHOOT_INTERVAL + 30; // Random initial delay
        this.initialY = this.y; // Store initial Y for potential ground check
    }

    /** Draws the enemy placeholder based on type */
    draw() {
        if (this.type === 'carrot') {
            ctx.fillStyle = 'orange'; // Carrot placeholder
        } else { // potato_cop
            ctx.fillStyle = '#CD853F'; // Peru (Cop placeholder color)
        }
        ctx.fillRect(this.x, this.y, this.width, this.height);
        // Add hat/leaf placeholders if desired
        if (this.type === 'carrot') {
             ctx.fillStyle = 'green';
             ctx.fillRect(this.x + this.width / 2 - 3 , this.y - 5, 6, 5); // Leaf
        } else {
            ctx.fillStyle = 'blue'; // Hat
            ctx.fillRect(this.x + this.width / 2 - 5, this.y - 8, 10, 8);
        }
    }

    /** Updates enemy position and handles shooting */
    update() {
        this.x += this.speed;

        // Boundary check/reversal based on platform OR world bounds for ground enemies
        if (this.platform && this.platform.type !== 'ground') {
            if (this.x <= this.platform.x || this.x + this.width >= this.platform.x + this.platform.width) {
                this.speed *= -1; // Reverse direction
                // Prevent getting stuck
                if (this.x <= this.platform.x) this.x = this.platform.x + 1;
                if (this.x + this.width >= this.platform.x + this.platform.width) this.x = this.platform.x + this.platform.width - this.width - 1;
            }
        } else if (this.platform && this.platform.type === 'ground') {
            // Ground enemies patrol within the level width
             const groundPlatform = platforms[0]; // Assuming ground is always first
             if (this.x <= 0 || this.x + this.width >= groundPlatform.width) { 
                 this.speed *= -1;
                 if (this.x <= 0) this.x = 1;
                 if (this.x + this.width >= groundPlatform.width) this.x = groundPlatform.width - this.width - 1;
             }
        }

        // Enemy Shooting Logic (simple for now, always shoots left)
        this.shootTimer--;
        if (this.shootTimer <= 0) {
            this.shoot();
            this.shootTimer = ENEMY_SHOOT_INTERVAL + Math.random() * 60; // Reset timer with variance
        }
    }

    /** Creates an enemy bullet only if enemy is on screen */
    shoot() {
        // Check if enemy is visible before shooting
        const isVisible = this.x + this.width > cameraOffsetX && this.x < cameraOffsetX + canvas.width;
        if (!isVisible) {
            return; // Don't shoot if off-screen
        }

        const bulletWidth = 8;
        const bulletHeight = 8;
        enemyBullets.push({
            x: this.x,
            y: this.y + this.height / 2 - bulletHeight / 2,
            width: bulletWidth,
            height: bulletHeight,
            speed: ENEMY_BULLET_SPEED,
            draw() {
                ctx.fillStyle = 'red'; // Enemy bullets are red
                ctx.fillRect(this.x, this.y, this.width, this.height);
            },
            update() {
                this.x -= this.speed; // Move left
            }
        });
    }
}

// ---- Event Listeners ----
window.addEventListener('keydown', (e) => {
    // Use e.code for layout-independent key identification
    keys[e.code] = true;
    // Handle shooting on keydown for responsiveness
    if (e.code === 'Space' && !keys['SpaceHandled']) {
        if (!gameOver) player.shoot();
        keys['SpaceHandled'] = true; // Prevent holding down space for rapid fire
    }
});

window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
    // Reset 'handled' flags on keyup
    if (e.code === 'Space') keys['SpaceHandled'] = false;
    if (e.code === 'ArrowUp') keys['ArrowUpHandled'] = false;
});

resetButton.addEventListener('click', resetGame);

// ---- Game Functions ----

/** Updates all game objects */
function updateGameObjects() {
    // Update Player
    player.update();

    // --- Update Camera --- 
    let canScrollRight = true;
    // Check if any enemies are currently visible
    for (const enemy of enemies) {
        if (enemy.x + enemy.width > cameraOffsetX && enemy.x < cameraOffsetX + canvas.width) {
            canScrollRight = false; // Enemy is on screen, block scroll
            break;
        }
    }

    const scrollMarginLeft = canvas.width * 0.3;
    const scrollMarginRight = canvas.width * 0.7;
    let targetCameraX = cameraOffsetX; // Start with current camera position

    // Calculate the ideal camera position to center the player
    const idealCameraX = player.x + player.width / 2 - canvas.width / 2;

    if (player.x < cameraOffsetX + scrollMarginLeft) {
        // Player moving left, target ideal position respecting margin
        targetCameraX = Math.max(0, player.x - scrollMarginLeft);
    } else if (canScrollRight && player.x + player.width > cameraOffsetX + scrollMarginRight) {
        // Player moving right (and allowed), target ideal position respecting margin
        targetCameraX = player.x + player.width - scrollMarginRight;
    } else {
        // Player is within margins, gently move towards ideal centering position
        // Only do this if not blocked by enemies? Or always try to center?
        // Let's try always centering gently when within margins:
        targetCameraX = idealCameraX;
    }
    
    // Ensure target doesn't go out of bounds
    targetCameraX = Math.max(0, targetCameraX);
    targetCameraX = Math.min(levelWidth - canvas.width, targetCameraX); 

    // Apply smooth camera movement using lerp
    cameraOffsetX += (targetCameraX - cameraOffsetX) * CAMERA_LERP_FACTOR;

    // Prevent minuscule movements (optional)
    if (Math.abs(targetCameraX - cameraOffsetX) < 0.5) {
        cameraOffsetX = targetCameraX;
    }

    // Ensure camera doesn't scroll past level boundaries after lerp
    // cameraOffsetX = Math.max(0, cameraOffsetX); // Already handled by target check
    // cameraOffsetX = Math.min(levelWidth - canvas.width, cameraOffsetX); // Already handled by target check

    // Update Player Bullets & Remove off-screen
    playerBullets.forEach((bullet, index) => {
        bullet.update();
        // Remove if off visible screen area
        if (bullet.x > cameraOffsetX + canvas.width || bullet.x + bullet.width < cameraOffsetX) {
            playerBullets.splice(index, 1);
        }
    });

    // Update Enemy Bullets & Remove off-screen
    enemyBullets.forEach((bullet, index) => {
        bullet.update();
        // Remove if off visible screen area (left side)
        if (bullet.x + bullet.width < cameraOffsetX) {
            enemyBullets.splice(index, 1);
        }
    });

    // Update Enemies
    enemies.forEach((enemy, index) => {
        enemy.update();
        // Keep enemy removal logic simple for now (or remove it entirely)
        // if (enemy.x + enemy.width < -100 || enemy.x > levelWidth + 100) { ... }
    });

    // Spawn Logic - REMOVED timed spawning
    // frameCount++;
    // if (frameCount % ENEMY_SPAWN_INTERVAL === 0) { ... }
}

/** Draws background elements */
function drawBackground() {
    // Simple Sky (doesn't scroll)
    ctx.fillStyle = '#87CEEB';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // TODO: Add parallax background elements later that scroll at different rates
}

/** Draws all game objects relative to the camera */
function drawGameObjects() {
    // Draw Background first
    drawBackground();

    // Use translate to simulate camera scroll
    ctx.save(); // Save the default state
    ctx.translate(-cameraOffsetX, 0); // Shift the coordinate system

    // --- Draw all world objects within the translated context --- 

    // Draw Platforms
    platforms.forEach(platform => {
        // Basic culling: Only draw if platform is potentially visible
        if (platform.x + platform.width > cameraOffsetX && platform.x < cameraOffsetX + canvas.width) {
             ctx.fillStyle = platform.color || '#888';
             ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
        }
    });

    // Draw Player
    player.draw(); // Player draw method already uses player.x/y

    // Draw Player Bullets
    playerBullets.forEach(bullet => {
        if (bullet.x + bullet.width > cameraOffsetX && bullet.x < cameraOffsetX + canvas.width) {
            bullet.draw(); // Bullet draw method uses bullet.x/y
        }
    });

    // Draw Enemy Bullets
    enemyBullets.forEach(bullet => {
        if (bullet.x + bullet.width > cameraOffsetX && bullet.x < cameraOffsetX + canvas.width) {
             bullet.draw();
        }
    });

    // Draw Enemies
    enemies.forEach(enemy => {
         if (enemy.x + enemy.width > cameraOffsetX && enemy.x < cameraOffsetX + canvas.width) {
            enemy.draw(); // Enemy draw method uses enemy.x/y
         }
    });

    // Draw Toppings if implemented
    // toppings.forEach(topping => topping.draw());

    // --- End of translated drawing --- 
    ctx.restore(); // Restore the original coordinate system (for UI elements)

    // Draw UI elements (like score) if they exist and should be static
    // updateScoreDisplay(); 
}

/** Handles various collision checks */
function handleCollisions() {
    // Player Bullet <-> Enemy Collisions
    playerBullets.forEach((bullet, bulletIndex) => {
        enemies.forEach((enemy, enemyIndex) => {
            // Basic AABB collision check
            if (bullet.x < enemy.x + enemy.width &&
                bullet.x + bullet.width > enemy.x &&
                bullet.y < enemy.y + enemy.height &&
                bullet.y + bullet.height > enemy.y) {
                enemies.splice(enemyIndex, 1);
                playerBullets.splice(bulletIndex, 1);
                score += 50;
                // updateScoreDisplay(); // Update score display if element exists
                console.log("Enemy hit! Score:", score);
                // Exit inner loop once bullet hits an enemy
                return;
            }
        });
    });

    // Player <-> Enemy Collisions
    enemies.forEach((enemy) => {
        if (player.x < enemy.x + enemy.width &&
            player.x + player.width > enemy.x &&
            player.y < enemy.y + enemy.height &&
            player.y + player.height > enemy.y) {
            console.log("Player hit by enemy!");
            triggerGameOver();
        }
    });

    // Player <-> Enemy Bullet Collisions
    enemyBullets.forEach((bullet, bulletIndex) => {
        if (player.x < bullet.x + bullet.width &&
            player.x + player.width > bullet.x &&
            player.y < bullet.y + bullet.height &&
            player.y + player.height > bullet.y) {
            enemyBullets.splice(bulletIndex, 1); // Remove bullet
            console.log("Player hit by bullet!");
            triggerGameOver();
        }
    });

    // Player <-> Topping Collisions (Add later if needed)
}

/** Updates the score display */
function updateScoreDisplay() {
    if (scoreDisplay) {
        scoreDisplay.textContent = `Score: ${score}`;
    }
}

/** Handles game over state */
function triggerGameOver() {
    if (gameOver) return; 
    console.log("--- GAME OVER --- Final Score:", score);
    gameOver = true;
    gameRunning = false;
    if (finalScoreDisplay) {
        finalScoreDisplay.textContent = `Final Score: ${score}`;
    }
    if (gameOverOverlay) {
        gameOverOverlay.style.display = 'flex'; // Show the overlay
    }
    // Remove alert:
    // alert(`Game Over! Final Score: ${score}. Refresh to retry.`);
}

/** Resets the game state */
function resetGame() {
    console.log("Resetting game...");
    score = 0;
    keys = {};
    playerBullets = [];
    enemyBullets = [];
    enemies = [];
    // toppings = [];
    frameCount = 0;
    gameOver = false;
    gameRunning = true;
    cameraOffsetX = 0; // Reset camera scroll

    // Reset player position and state
    player.x = 50;
    player.y = groundLevel - 60;
    player.velocityY = 0;
    player.isOnGround = false;
    player.direction = 'right';

    // Redefine platforms and spawn initial enemies/toppings
    defineLevel();
    // Spawn a couple of enemies to start
    // spawnEnemy();
    // spawnEnemy();

    // Hide game over overlay
    if (gameOverOverlay) {
        gameOverOverlay.style.display = 'none';
    }
    updateScoreDisplay(); // Reset score display

    // Restart the loop ONLY if it's not already running (safety check)
    if (!gameRunning) { 
       gameRunning = true; 
       gameLoop(); 
    } else {
       // If reset is called mid-game, just reset state, loop continues
    }
}

// ---- Game Loop ----
function gameLoop() {
    if (!gameRunning) {
        console.log("Game loop stopped.");
        return;
    }

    // Update game state
    updateGameObjects();

    // Handle collisions
    handleCollisions();

    // Draw everything
    drawGameObjects();

    // Request next frame
    requestAnimationFrame(gameLoop);
}

// ---- Initial Setup ----
console.log("Setting up game...");
defineLevel(); // Define platforms and place initial enemies

// Initialise player state (redundant if resetGame did it, but safe)
player.x = 50;
player.y = groundLevel - 60;
player.velocityY = 0;
player.isOnGround = false;
player.direction = 'right';
cameraOffsetX = 0;
score = 0;
keys = {};
playerBullets = [];
enemyBullets = [];
// Enemies are already placed by defineLevel
frameCount = 0;
gameOver = false;
gameRunning = true;

// Set initial UI state
if (gameOverOverlay) gameOverOverlay.style.display = 'none';
updateScoreDisplay(); // Set initial score display

// Start the game loop!
console.log("Game initialised. Starting loop...");
gameLoop(); 
// Game configuration
const config = {
    asteroidSpeed: 1, // Base speed
    spawnRate: 4000, // Spawn rate in milliseconds
    maxAsteroids: 4, // Maximum number of asteroids
    words: [
        'COSMIC', 'NEBULA', 'GALAXY', 'PULSAR', 'QUASAR',
        'NOVA', 'ORBIT', 'COMET', 'METEOR', 'WARP',
        'SPACE', 'STAR', 'VOID', 'ALIEN', 'LASER',
        'SOLAR', 'LUNAR', 'ASTRO', 'HYPER', 'ZERO'
    ],
    // Removed fixed directions as we'll calculate them dynamically
    homingFactor: 0.8 // How strongly asteroids home in on spacecraft (0-1)
};

// Game state
const gameState = {
    score: 0,
    level: 1,
    lives: 3,
    isPlaying: false,
    currentWord: '',
    typedWord: '',
    asteroids: [],
    attacks: [],
    spawnInterval: null,
    gameLoop: null
};

// DOM Elements
const elements = {
    spacecraft: document.getElementById('spacecraft'),
    gameArea: document.getElementById('game-area'),
    scoreValue: document.getElementById('score-value'),
    levelValue: document.getElementById('level-value'),
    livesValue: document.getElementById('lives-value'),
    currentWordDisplay: document.getElementById('current-word'),
    gameOver: document.getElementById('game-over'),
    finalScore: document.getElementById('final-score'),
    restartBtn: document.getElementById('restart-btn'),
    startScreen: document.getElementById('start-screen'),
    startBtn: document.getElementById('start-btn')
};

// Initialize game
function initGame() {
    elements.startBtn.addEventListener('click', startGame);
    elements.restartBtn.addEventListener('click', restartGame);
    document.addEventListener('keydown', handleKeyDown);
    
    // Set initial values
    updateHUD();
}

// Start the game
function startGame() {
    gameState.isPlaying = true;
    gameState.score = 0;
    gameState.level = 1;
    gameState.lives = 3;
    gameState.asteroids = [];
    gameState.attacks = [];
    gameState.typedWord = '';
    
    elements.startScreen.classList.add('hidden');
    elements.gameOver.classList.add('hidden');
    
    updateHUD();
    startGameLoop();
}

// Restart the game
function restartGame() {
    // Stop all game loops and intervals
    if (gameState.spawnInterval) clearInterval(gameState.spawnInterval);
    if (gameState.gameLoop) cancelAnimationFrame(gameState.gameLoop);
    
    // Clear all game objects
    clearAllGameObjects();
    
    // Reset game state
    gameState.score = 0;
    gameState.level = 1;
    gameState.lives = 3;
    gameState.isPlaying = false;
    gameState.currentWord = '';
    gameState.typedWord = '';
    
    // Update HUD
    updateHUD();
    updateCurrentWordDisplay();
    
    // Start fresh
    startGame();
}

// Game loop
function startGameLoop() {
    // Clear any existing intervals
    if (gameState.spawnInterval) clearInterval(gameState.spawnInterval);
    if (gameState.gameLoop) cancelAnimationFrame(gameState.gameLoop);
    
    // Start spawning asteroids
    gameState.spawnInterval = setInterval(() => {
        if (gameState.asteroids.length < config.maxAsteroids) {
            spawnAsteroid();
        }
    }, config.spawnRate);
    
    // Start game loop
    gameLoop();
}

// Main game loop
function gameLoop() {
    moveAsteroids();
    moveAttacks();
    checkCollisions();
    
    if (gameState.isPlaying) {
        gameState.gameLoop = requestAnimationFrame(gameLoop);
    }
}

// Spawn a new asteroid
function spawnAsteroid() {
    const asteroid = document.createElement('div');
    asteroid.className = 'asteroid';
    
    // Random position at the top, sides, or corners
    let posX, posY;
    const spawnSide = Math.floor(Math.random() * 3); // 0: top, 1: left side, 2: right side
    
    if (spawnSide === 0) {
        // Spawn from top
        posX = Math.random() * (elements.gameArea.offsetWidth - 80);
        posY = -80;
    } else if (spawnSide === 1) {
        // Spawn from left
        posX = -80;
        posY = Math.random() * (elements.gameArea.offsetHeight / 2);
    } else {
        // Spawn from right
        posX = elements.gameArea.offsetWidth;
        posY = Math.random() * (elements.gameArea.offsetHeight / 2);
    }
    
    asteroid.style.left = `${posX}px`;
    asteroid.style.top = `${posY}px`;
    
    // Random word
    const word = config.words[Math.floor(Math.random() * config.words.length)];
    
    // Create text element (separate from asteroid rotation)
    const textElement = document.createElement('div');
    textElement.className = 'asteroid-text glow';
    textElement.textContent = word;
    asteroid.appendChild(textElement);
    
    // Add to game area
    elements.gameArea.appendChild(asteroid);
    
    // Get spacecraft position for initial direction calculation
    const spacecraftRect = elements.spacecraft.getBoundingClientRect();
    const gameAreaRect = elements.gameArea.getBoundingClientRect();
    const targetX = spacecraftRect.left - gameAreaRect.left + (spacecraftRect.width / 2);
    const targetY = spacecraftRect.top - gameAreaRect.top + (spacecraftRect.height / 2);
    
    // Calculate initial direction toward spacecraft
    const dx = targetX - posX;
    const dy = targetY - posY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Normalize direction vector
    const dirX = dx / distance;
    const dirY = dy / distance;
    
    // Add to game state
    gameState.asteroids.push({
        element: asteroid,
        word: word,
        posX: posX,
        posY: posY,
        dirX: dirX,
        dirY: dirY,
        lastUpdateTime: Date.now()
    });
    
    // If this is the first asteroid, set it as the current target
    if (gameState.currentWord === '') {
        setCurrentWord(word);
    }
}

// Move asteroids toward spacecraft
function moveAsteroids() {
    // Get spacecraft position
    const spacecraftRect = elements.spacecraft.getBoundingClientRect();
    const gameAreaRect = elements.gameArea.getBoundingClientRect();
    const targetX = spacecraftRect.left - gameAreaRect.left + (spacecraftRect.width / 2);
    const targetY = spacecraftRect.top - gameAreaRect.top + (spacecraftRect.height / 2);
    
    for (let i = gameState.asteroids.length - 1; i >= 0; i--) {
        const asteroid = gameState.asteroids[i];
        const now = Date.now();
        const deltaTime = (now - asteroid.lastUpdateTime) / 16; // Normalize to ~60fps
        asteroid.lastUpdateTime = now;
        
        // Calculate direction to spacecraft
        const dx = targetX - asteroid.posX;
        const dy = targetY - asteroid.posY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Update direction with homing behavior
        if (distance > 0) {
            const newDirX = dx / distance;
            const newDirY = dy / distance;
            
            // Blend old and new directions based on homing factor
            asteroid.dirX = asteroid.dirX * (1 - config.homingFactor) + newDirX * config.homingFactor;
            asteroid.dirY = asteroid.dirY * (1 - config.homingFactor) + newDirY * config.homingFactor;
            
            // Normalize direction
            const dirMagnitude = Math.sqrt(asteroid.dirX * asteroid.dirX + asteroid.dirY * asteroid.dirY);
            if (dirMagnitude > 0) {
                asteroid.dirX /= dirMagnitude;
                asteroid.dirY /= dirMagnitude;
            }
        }
        
        // Apply movement
        const speed = config.asteroidSpeed * (1 + (gameState.level * 0.1));
        asteroid.posX += asteroid.dirX * speed * deltaTime;
        asteroid.posY += asteroid.dirY * speed * deltaTime;
        
        // Update position
        asteroid.element.style.top = `${asteroid.posY}px`;
        asteroid.element.style.left = `${asteroid.posX}px`;
        
        // Check if asteroid hit the spacecraft
        if (distance < 70) { // Approximate collision with spacecraft
            // Remove asteroid
            elements.gameArea.removeChild(asteroid.element);
            gameState.asteroids.splice(i, 1);
            
            // Create explosion
            createExplosion(asteroid.posX, asteroid.posY);
            
            // Lose a life
            gameState.lives--;
            updateHUD();
            
            // Check if game over
            if (gameState.lives <= 0) {
                endGame();
            }
            
            // Set new current word if needed
            if (gameState.asteroids.length > 0 && gameState.currentWord === asteroid.word) {
                const sortedAsteroids = [...gameState.asteroids].sort((a, b) => b.posY - a.posY);
                setCurrentWord(sortedAsteroids[0].word);
            } else if (gameState.asteroids.length === 0) {
                setCurrentWord('');
            }
        }
        // Check if asteroid went far off screen
        else if (asteroid.posY > elements.gameArea.offsetHeight + 100 || 
                asteroid.posY < -100 || 
                asteroid.posX < -100 || 
                asteroid.posX > elements.gameArea.offsetWidth + 100) {
            
            // Remove asteroid
            elements.gameArea.removeChild(asteroid.element);
            gameState.asteroids.splice(i, 1);
            
            // Set new current word if needed
            if (gameState.asteroids.length > 0 && gameState.currentWord === asteroid.word) {
                const sortedAsteroids = [...gameState.asteroids].sort((a, b) => b.posY - a.posY);
                setCurrentWord(sortedAsteroids[0].word);
            } else if (gameState.asteroids.length === 0) {
                setCurrentWord('');
            }
        }
    }
}

// Move attacks toward their targets
function moveAttacks() {
    for (let i = gameState.attacks.length - 1; i >= 0; i--) {
        const attack = gameState.attacks[i];
        
        // Move attack according to its velocity
        attack.posX += attack.vx;
        attack.posY += attack.vy;
        
        // Update position
        attack.element.style.top = `${attack.posY}px`;
        attack.element.style.left = `${attack.posX}px`;
        
        // Remove attack if it goes off screen
        if (attack.posY < -30 || attack.posY > elements.gameArea.offsetHeight || 
            attack.posX < -30 || attack.posX > elements.gameArea.offsetWidth) {
            if (attack.element.parentNode === elements.gameArea) {
                elements.gameArea.removeChild(attack.element);
            }
            gameState.attacks.splice(i, 1);
        }
    }
}

// Check for collisions between attacks and asteroids
function checkCollisions() {
    for (let i = gameState.attacks.length - 1; i >= 0; i--) {
        const attack = gameState.attacks[i];
        
        for (let j = gameState.asteroids.length - 1; j >= 0; j--) {
            const asteroid = gameState.asteroids[j];
            
            // Simplified collision detection - if attack is close enough to the asteroid with matching word
            if (attack.targetWord === asteroid.word) {
                const attackRect = attack.element.getBoundingClientRect();
                const asteroidRect = asteroid.element.getBoundingClientRect();
                
                // Calculate centers
                const attackCenterX = attackRect.left + attackRect.width / 2;
                const attackCenterY = attackRect.top + attackRect.height / 2;
                const asteroidCenterX = asteroidRect.left + asteroidRect.width / 2;
                const asteroidCenterY = asteroidRect.top + asteroidRect.height / 2;
                
                // Calculate distance between centers
                const distance = Math.sqrt(
                    Math.pow(attackCenterX - asteroidCenterX, 2) + 
                    Math.pow(attackCenterY - asteroidCenterY, 2)
                );
                
                // If distance is small enough, consider it a collision
                if (distance < (asteroidRect.width / 2 + attackRect.width / 2)) {
                    // Collision detected
                    createExplosion(asteroid.posX, asteroid.posY);
                    
                    // Remove asteroid and attack
                    if (asteroid.element.parentNode === elements.gameArea) {
                        elements.gameArea.removeChild(asteroid.element);
                    }
                    if (attack.element.parentNode === elements.gameArea) {
                        elements.gameArea.removeChild(attack.element);
                    }
                    
                    gameState.asteroids.splice(j, 1);
                    gameState.attacks.splice(i, 1);
                    
                    // Update score
                    gameState.score += asteroid.word.length * 10;
                    updateHUD();
                    
                    // Check for level up
                    if (gameState.score >= gameState.level * 200) {
                        gameState.level++;
                        updateHUD();
                    }
                    
                    // Set new current word if needed
                    if (gameState.asteroids.length > 0) {
                        // Sort by Y position (closest to bottom first)
                        const sortedAsteroids = [...gameState.asteroids].sort((a, b) => b.posY - a.posY);
                        setCurrentWord(sortedAsteroids[0].word);
                    } else {
                        setCurrentWord('');
                    }
                    
                    break;
                }
            }
        }
    }
}

// Create explosion effect
function createExplosion(x, y) {
    const explosion = document.createElement('div');
    explosion.className = 'explosion';
    
    // Center the explosion on the asteroid
    explosion.style.left = `${x}px`;
    explosion.style.top = `${y}px`;
    
    // Add to game area
    elements.gameArea.appendChild(explosion);
    
    // Optional: Play explosion sound
    // playSound('explosion');
    
    // Remove explosion after animation
    setTimeout(() => {
        if (explosion && explosion.parentNode === elements.gameArea) {
            elements.gameArea.removeChild(explosion);
        }
    }, 500);
}

// Fire attack from spacecraft
function fireAttack(targetWord) {
    // Find the target asteroid
    const targetAsteroid = gameState.asteroids.find(a => a.word === targetWord);
    if (!targetAsteroid) return;
    
    const attack = document.createElement('div');
    attack.className = 'attack';
    
    // Get positions
    const spacecraftRect = elements.spacecraft.getBoundingClientRect();
    const gameAreaRect = elements.gameArea.getBoundingClientRect();
    
    // Starting position (center of spacecraft)
    const posX = spacecraftRect.left - gameAreaRect.left + (spacecraftRect.width / 2) - 15;
    const posY = spacecraftRect.top - gameAreaRect.top;
    
    attack.style.left = `${posX}px`;
    attack.style.top = `${posY}px`;
    
    elements.gameArea.appendChild(attack);
    
    // Calculate direction to target
    const targetX = targetAsteroid.posX + 40; // Center of asteroid
    const targetY = targetAsteroid.posY + 40;
    
    // Calculate angle to target
    const dx = targetX - posX;
    const dy = targetY - posY;
    const angle = Math.atan2(dy, dx);
    
    // Calculate velocity components
    const speed = 15;
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;
    
    gameState.attacks.push({
        element: attack,
        posX: posX,
        posY: posY,
        vx: vx,
        vy: vy,
        targetWord: targetWord
    });
}

// Handle keyboard input
function handleKeyDown(e) {
    if (!gameState.isPlaying) return;
    
    // Prevent default behavior to avoid scrolling with spacebar
    if (e.key === ' ') {
        e.preventDefault();
    }
    
    // If no current word and there are asteroids, set one
    if (gameState.currentWord === '' && gameState.asteroids.length > 0) {
        // Sort by Y position (closest to bottom first)
        const sortedAsteroids = [...gameState.asteroids].sort((a, b) => b.posY - a.posY);
        setCurrentWord(sortedAsteroids[0].word);
        return;
    }
    
    // If still no current word, nothing to do
    if (gameState.currentWord === '') return;
    
    const key = e.key.toUpperCase();
    
    // Check if the key matches the next letter in the current word
    if (key === gameState.currentWord[gameState.typedWord.length]) {
        gameState.typedWord += key;
        updateCurrentWordDisplay();
        
        // If word is complete
        if (gameState.typedWord.length === gameState.currentWord.length) {
            // Find the asteroid with this word
            const targetAsteroid = gameState.asteroids.find(a => a.word === gameState.currentWord);
            
            if (targetAsteroid) {
                // Fire attack at this asteroid
                fireAttack(gameState.currentWord);
                
                // Reset typed word
                gameState.typedWord = '';
                
                // Find next asteroid to target - prioritize the closest one to the bottom
                const remainingAsteroids = gameState.asteroids.filter(a => a.word !== gameState.currentWord);
                if (remainingAsteroids.length > 0) {
                    // Sort by Y position (closest to bottom first)
                    const sortedAsteroids = [...remainingAsteroids].sort((a, b) => b.posY - a.posY);
                    setCurrentWord(sortedAsteroids[0].word);
                } else {
                    setCurrentWord('');
                }
            } else {
                // If target asteroid no longer exists, reset and find a new target
                gameState.typedWord = '';
                if (gameState.asteroids.length > 0) {
                    const sortedAsteroids = [...gameState.asteroids].sort((a, b) => b.posY - a.posY);
                    setCurrentWord(sortedAsteroids[0].word);
                } else {
                    setCurrentWord('');
                }
            }
        }
    } else {
        // Wrong key - flash the display
        elements.currentWordDisplay.classList.add('error');
        setTimeout(() => {
            elements.currentWordDisplay.classList.remove('error');
        }, 200);
    }
}

// Set the current target word
function setCurrentWord(word) {
    gameState.currentWord = word;
    gameState.typedWord = '';
    updateCurrentWordDisplay();
}

// Update the current word display
function updateCurrentWordDisplay() {
    if (gameState.currentWord === '') {
        elements.currentWordDisplay.innerHTML = '';
        return;
    }
    
    let html = '';
    for (let i = 0; i < gameState.currentWord.length; i++) {
        if (i < gameState.typedWord.length) {
            html += `<span class="active-letter">${gameState.currentWord[i]}</span>`;
        } else {
            html += gameState.currentWord[i];
        }
    }
    
    elements.currentWordDisplay.innerHTML = html;
}

// Update HUD elements
function updateHUD() {
    elements.scoreValue.textContent = gameState.score;
    elements.levelValue.textContent = gameState.level;
    elements.livesValue.textContent = gameState.lives;
}

// End the game
function endGame() {
    gameState.isPlaying = false;
    
    if (gameState.spawnInterval) clearInterval(gameState.spawnInterval);
    if (gameState.gameLoop) cancelAnimationFrame(gameState.gameLoop);
    
    elements.finalScore.textContent = gameState.score;
    elements.gameOver.classList.remove('hidden');
}

// Clear all game objects
function clearAllGameObjects() {
    try {
        // Remove all asteroids
        for (let i = 0; i < gameState.asteroids.length; i++) {
            const asteroid = gameState.asteroids[i];
            if (asteroid && asteroid.element && asteroid.element.parentNode === elements.gameArea) {
                elements.gameArea.removeChild(asteroid.element);
            }
        }
        
        // Remove all attacks
        for (let i = 0; i < gameState.attacks.length; i++) {
            const attack = gameState.attacks[i];
            if (attack && attack.element && attack.element.parentNode === elements.gameArea) {
                elements.gameArea.removeChild(attack.element);
            }
        }
        
        // Remove any explosions
        const explosions = document.querySelectorAll('.explosion');
        explosions.forEach(explosion => {
            if (explosion.parentNode === elements.gameArea) {
                elements.gameArea.removeChild(explosion);
            }
        });
        
        // Clear arrays
        gameState.asteroids = [];
        gameState.attacks = [];
    } catch (error) {
        console.error("Error clearing game objects:", error);
    }
}

// Initialize the game when the page loads
window.addEventListener('load', initGame);
# 3D Tower Defense Game

A mobile-friendly 3D tower defense game built with HTML, CSS, and JavaScript.

## Features

- **3D Isometric View**: Uses CSS 3D transforms for an immersive 3D experience
- **Player Character**: Move a humanoid figure around the map
- **Building System**: Build towers (100 gold) and walls (50 gold) to defend your base
- **Terrain System**: Hills with exit ramps where monsters spawn
- **Monster Waves**: Enemies spawn from outside the fog of war and follow paths to your base
- **Camera Controls**: Pan and zoom controls in the bottom right corner
- **Fog of War**: Limited visibility that follows the player
- **Mobile Support**: Touch controls with joystick for movement

## How to Play

1. **Movement**:
   - Desktop: Use arrow keys or WASD
   - Mobile: Use the joystick in the bottom left

2. **Building**:
   - Click on a build button (tower or wall) to select it
   - Click on the map to place the building
   - Buildings can only be placed on walkable terrain

3. **Camera**:
   - Use the camera controls in the bottom right to pan and zoom
   - Buttons: ↑ ↓ ← → for panning, + - for zoom

4. **Objective**:
   - Defend your home base (center) from waves of monsters
   - Monsters spawn from hills and follow paths to your base
   - Towers automatically attack nearby monsters
   - Earn gold by defeating monsters
   - Survive as many waves as possible!

## Game Mechanics

- **Gold**: Start with 500 gold, earn more by defeating monsters
- **Health**: Base starts with 100 health, loses 10 per monster that reaches it
- **Waves**: Each wave spawns more monsters
- **Towers**: Attack monsters within range, cost 100 gold
- **Walls**: Block monster paths, cost 50 gold

## Running the Game

Simply open `index.html` in a web browser. No build process or dependencies required!

## Browser Compatibility

Works best in modern browsers that support CSS 3D transforms:
- Chrome/Edge (recommended)
- Firefox
- Safari
- Mobile browsers (iOS Safari, Chrome Mobile)

## Controls Summary

| Action | Desktop | Mobile |
|--------|---------|--------|
| Move | Arrow Keys / WASD | Joystick |
| Build Tower | Click build button + map | Tap build button + map |
| Build Wall | Click build button + map | Tap build button + map |
| Camera | Camera buttons | Camera buttons |

Enjoy defending your base!

